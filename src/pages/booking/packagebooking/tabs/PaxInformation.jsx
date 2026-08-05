import React, { useState, useEffect, useRef } from "react";
import { Row, Col, Form, Modal, Button, Table } from "react-bootstrap";
import AsyncSelect from "react-select/async";
import axiosInstance from "../../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
  FaClipboardList,
  FaUsers,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaShieldAlt,
  FaPlaneDeparture,
  FaTimesCircle,
  FaInfoCircle,
} from "react-icons/fa";

// Reverse-geocode browser coordinates to a readable address for the Booking
// History audit trail. Tries OpenStreetMap Nominatim first (street-level),
// then BigDataCloud (locality-level, keyless) — both free, CORS-enabled.
// Returns null when neither responds so the caller keeps its IP-derived
// fallback. Mirrors the other booking pages (DayStay / Student / etc.).
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`,
      { headers: { Accept: "application/json" } },
    );
    if (res.ok) {
      const a = (await res.json())?.address || {};
      const parts = [
        a.road,
        a.neighbourhood || a.suburb,
        a.village || a.town || a.city || a.municipality,
        a.state,
        a.postcode,
        a.country,
      ].filter(Boolean);
      const line = parts.filter((p, i) => parts.indexOf(p) === i).join(", ");
      if (line) return line.slice(0, 255); // DB column is VARCHAR(255)
    }
  } catch {
    // fall through to BigDataCloud
  }
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    if (res.ok) {
      const d = await res.json();
      const parts = [
        d.locality,
        d.city,
        d.principalSubdivision,
        d.countryName,
      ].filter(Boolean);
      const line = parts.filter((p, i) => parts.indexOf(p) === i).join(", ");
      if (line) return line.slice(0, 255);
    }
  } catch {
    // give up — caller keeps the IP-based fallback
  }
  return null;
}

const PaxInformation = ({
  searchParams,
  bookingData,
  updateData,
  onPrev,
  onFinish,
  packageData,
  totalPrice,
  // When set, the submit button performs an amendment (PUT) on the
  // existing booking instead of creating a new one (POST).
  editingBookingId,
  // When set (Amend → child-booking flow from PackageBookingDetailView),
  // forwarded to /book so the backend stamps "{parent}/{n}" — e.g.
  // amending GPKG-4 yields GPKG-4/1. Mirrors Hotel ADD NEW ITEM.
  parentBookingCode,
}) => {
  const navigate = useNavigate();
  const [showSummary, setShowSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tourismDirham, setTourismDirham] = useState("");

  // Edit mode: the parent loads the saved booking asynchronously, so
  // bookingData.tourismDirham may arrive after this component mounts. Sync it
  // in once, without clobbering user input made in the meantime. Prevents
  // the amend flow from silently dropping the previously-entered TD.
  const hasHydratedTD = useRef(false);
  useEffect(() => {
    if (!hasHydratedTD.current && bookingData?.tourismDirham != null) {
      setTourismDirham(String(bookingData.tourismDirham));
      hasHydratedTD.current = true;
    }
  }, [bookingData?.tourismDirham]);

  // Client location snapshot for the Booking History audit trail, resolved
  // once on this step and sent on the /book payload. Location comes from
  // browser geolocation (reverse-geocoded), with a coarse IP-derived city as
  // the fallback. The IP Address column is NOT resolved here — the backend
  // stamps each system's unique IPv4 from the request itself.
  const [clientNetwork, setClientNetwork] = useState({ bookingLocation: null });
  useEffect(() => {
    let cancelled = false;

    fetch("https://ipapi.co/json/")
      .then((res) => (res.ok ? res.json() : null))
      .then((info) => {
        if (cancelled || !info) return;
        setClientNetwork((prev) => ({
          // Never clobber a precise geolocation result that already landed.
          bookingLocation:
            prev.bookingLocation ||
            [info.city, info.region, info.country_name]
              .filter(Boolean)
              .join(", ") ||
            null,
        }));
      })
      .catch(() => {});

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          const precise = await reverseGeocode(coords.latitude, coords.longitude);
          if (!cancelled && precise) {
            setClientNetwork({ bookingLocation: precise });
          }
        },
        () => {}, // denied / unavailable — keep the IP-derived fallback
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
      );
    }

    return () => {
      cancelled = true;
    };
  }, []);

  // Terms acceptance — moved off the Hotels step. After Confirm booking
  // is clicked we open a popup with the package's full T&C text and a
  // single checkbox. The user must tick it before the order-summary
  // modal opens.
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsCheck, setTermsCheck] = useState(
    !!bookingData?.programme?.termsAccepted,
  );
  // Full package detail view — fuels both the T&C popup and the Order
  // Summary modal (nights/days, itinerary, includes, excludes,
  // cancellation policy).
  const [packageView, setPackageView] = useState(null);

  // Lazy-fetch the package detail once we know the packageId. Re-uses
  // /api/TravelPackage/view/{id} which is also called by the Hotels tab.
  useEffect(() => {
    const pkgId = searchParams?.packageId;
    if (!pkgId) return;
    let cancelled = false;
    axiosInstance
      .get(`/api/TravelPackage/view/${pkgId}`)
      .then((res) => {
        if (cancelled) return;
        setPackageView(res.data || null);
      })
      .catch(() => {
        if (!cancelled) setPackageView(null);
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams?.packageId]);

  // Derived lists used by both the T&C popup and the Order Summary.
  const termsList = Array.isArray(packageView?.termsAndConditions)
    ? packageView.termsAndConditions
    : [];
  const itineraries = Array.isArray(packageView?.itineraries)
    ? packageView.itineraries
    : [];
  const inclusions = Array.isArray(packageView?.inclusions)
    ? packageView.inclusions
    : [];
  const exclusions = Array.isArray(packageView?.exclusions)
    ? packageView.exclusions
    : [];
  const nights = packageView?.noOfNights ?? "";
  const nightsInt = parseInt(nights, 10);
  const daysInt = Number.isFinite(nightsInt) ? nightsInt + 1 : null;

  // Mirror of HotelsTab's cancellation breakdown so the same policy text
  // shows up inside the Order Summary modal.
  const cancellationParts = (() => {
    const free = packageView?.cancellationDaysFree;
    const withCharge = packageView?.cancellationDaysWithCharge;
    const type = packageView?.cancellationChargeType;
    const value = packageView?.cancellationChargeValue;
    if (free == null && withCharge == null && !value) {
      return [
        {
          tone: "muted",
          text: "Cancellation policy will be confirmed by the supplier.",
        },
      ];
    }
    const parts = [];
    if (free != null) {
      parts.push({
        tone: "ok",
        text: `Free cancellation up to ${free} day${free === 1 ? "" : "s"} before travel.`,
      });
    }
    if (withCharge != null) {
      let chargeText = "";
      if (value) {
        chargeText =
          type && type.toLowerCase() === "percent" ? `${value}%` : value;
      }
      parts.push({
        tone: "warn",
        text: `Within ${withCharge} day${withCharge === 1 ? "" : "s"} of travel${
          chargeText
            ? `, ${chargeText} cancellation charge applies`
            : ", cancellation charge applies"
        }.`,
      });
    }
    return parts;
  })();

  // The standalone Contact card has been removed — the first traveller IS
  // the contact. Their email + mobile are captured directly on that row
  // and reused as the booking's primary contact at submission time.
  const [localData, setLocalData] = useState(
    bookingData.paxInfo || {
      travellers: [],
    },
  );

  // The package category defines the MAX number of adults and children the
  // user may enter. They start with only the primary (lead) adult and may
  // opt in to enter more via the "Add extra adult" / "Add extra child"
  // buttons — they are not forced to fill every seat the category allows.
  // Always allow at least one extra adult above whatever was searched
  // for — the "Add extra adult" button needs a non-zero headroom to be
  // useful even when the search began with a single adult.
  const searchedAdults = Number(searchParams.adultCount) || 1;
  const maxAdults = Math.max(2, searchedAdults);
  const maxChildren = Number(searchParams.childCount) || 0;

  const currentAdults = localData.travellers.filter((t) => t.type === "Adult").length;
  const currentChildren = localData.travellers.filter((t) => t.type === "Child").length;
  const canAddAdult = currentAdults < maxAdults;
  const canAddChild = currentChildren < maxChildren;

  const makeTraveller = (type) => ({
    type,
    id: `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: "Mr",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    mobile: "",
  });

  // Initialize / reconcile traveller list when the page mounts or the
  // category caps change.
  //   • No travellers yet → seed with one primary Adult.
  //   • Caps reduced (e.g. user went back and picked a smaller category) →
  //     trim extras but always keep the lead Adult.
  useEffect(() => {
    if (!localData.travellers || localData.travellers.length === 0) {
      const seeded = { ...localData, travellers: [makeTraveller("Adult")] };
      setLocalData(seeded);
      // Functional setter — spreading the `bookingData` prop directly would
      // capture a stale snapshot and wipe any concurrent parent updates
      // (e.g. the async agent-credit-limit hook seeding modeOfPayment).
      updateData((prev) => ({ ...prev, paxInfo: seeded }));
      return;
    }
    const adults = localData.travellers.filter((t) => t.type === "Adult");
    const children = localData.travellers.filter((t) => t.type === "Child");
    if (adults.length > maxAdults || children.length > maxChildren) {
      const trimmedAdults = adults.slice(0, Math.max(1, maxAdults));
      const trimmedChildren = children.slice(0, maxChildren);
      const merged = [...trimmedAdults, ...trimmedChildren];
      const updated = { ...localData, travellers: merged };
      setLocalData(updated);
      updateData((prev) => ({ ...prev, paxInfo: updated }));
    }
  }, [maxAdults, maxChildren]);

  const handleTravellerChange = (index, field, value) => {
    const updatedTravellers = [...localData.travellers];
    updatedTravellers[index] = { ...updatedTravellers[index], [field]: value };
    const updated = { ...localData, travellers: updatedTravellers };
    setLocalData(updated);
    // Functional setter avoids stale-closure bugs — see comment in the seed
    // effect above. A raw `{ ...bookingData, paxInfo }` spread here caused
    // every keystroke to revert whatever the parent had just set (payment
    // mode, hotel selection, etc.).
    updateData((prev) => ({ ...prev, paxInfo: updated }));
  };

  const addExtraTraveller = (type) => {
    if (type === "Adult" && !canAddAdult) return;
    if (type === "Child" && !canAddChild) return;
    // Keep adults before children so the primary stays first and child rows
    // appear after the adult rows in the UI.
    const adults = localData.travellers.filter((t) => t.type === "Adult");
    const children = localData.travellers.filter((t) => t.type === "Child");
    const newRow = makeTraveller(type);
    const merged = type === "Adult"
      ? [...adults, newRow, ...children]
      : [...adults, ...children, newRow];
    const updated = { ...localData, travellers: merged };
    setLocalData(updated);
    updateData((prev) => ({ ...prev, paxInfo: updated }));
  };

  const removeTraveller = (index) => {
    // Primary (index 0) cannot be removed — always required as the contact.
    if (index === 0) return;
    const newList = localData.travellers.filter((_, i) => i !== index);
    const updated = { ...localData, travellers: newList };
    setLocalData(updated);
    updateData((prev) => ({ ...prev, paxInfo: updated }));
  };

  const primary = localData.travellers && localData.travellers[0];

  // Pax passport — moved here from the removed Basic Details step. Updates the
  // shared searchParams so the submit payload's nativeCountry is populated.
  const loadPassportOptions = async (inputValue) => {
    try {
      const response = await axiosInstance.get(
        `/api/country?page=0&limit=20&search=${encodeURIComponent(inputValue)}`,
      );
      return (response.data || []).map((country) => ({
        value: country.id,
        label: country.name,
      }));
    } catch {
      return [];
    }
  };

  const setPaxPassport = (option) => {
    updateData((prev) => ({
      ...prev,
      searchParams: {
        ...prev.searchParams,
        paxPassport: option,
        nativeCountry: option ? option.value : "",
      },
    }));
  };

  const validatePaxData = () => {
    if (!primary) {
      toast.error("No travellers configured.");
      return false;
    }
    if (!primary.firstName || !primary.lastName) {
      toast.error("Please fill the lead traveller's first and last name.");
      return false;
    }
    if (!primary.mobile) {
      toast.error("Please fill the lead traveller's mobile (contact info).");
      return false;
    }
    const incompleteTraveller = localData.travellers.find(
      (t) => !t.firstName || !t.lastName,
    );
    if (incompleteTraveller) {
      toast.error("Please fill in first and last names for all travellers.");
      return false;
    }
    return true;
  };

  const handleSubmitBooking = async () => {
    try {
      setIsSubmitting(true);

      // Construct the comprehensive payload
      const payload = {
        packageId: searchParams.packageId,
        agentId: searchParams.agentId,
        // "Booking Done By Employee" carried over from the Package Search
        // page. Optional — blank for agent logins and when none was picked.
        employeeId: searchParams.employeeId || "",
        countryId: searchParams.destinationCountryId,
        cityId: searchParams.destinationCityId || "", // City ID from search or basic details
        travelDate: searchParams.travelDate,
        packageCategory: searchParams.packageCategory,
        nativeCountry: searchParams.nativeCountry,
        // Booking History audit — client location (backend stamps the IP).
        bookingLocation: clientNetwork.bookingLocation,
        // Amend → child-booking lineage. Backend uses this to compute
        // "{parent}/{n}" for the new booking's code.
        parentBookingCode: parentBookingCode || null,
        // NOTE: totalPrice is the package BASE (before Tourism Dirham). The
        // backend stores base+TD as the row's total_price, so the Grand Total
        // shown in Order Summary (Number(totalPrice)+Number(tourismDirham))
        // matches what ends up persisted. Do NOT change this to
        // "totalPrice: totalPrice + tourismDirham" — the backend would then
        // add TD a second time, silently inflating every booking's total.
        totalPrice: totalPrice,
        tourismDirham:
          tourismDirham !== "" && !isNaN(Number(tourismDirham))
            ? Number(tourismDirham)
            : null,
        // counts now reflect the actual entered travellers, not the
        // category cap — the user can opt to enter fewer than the package
        // allows.
        counts: {
          adultCount: currentAdults,
          childCount: currentChildren,
          infantCount: Number(searchParams.infantCount) || 0,
          childAge: searchParams.childAge,
          infantAge: searchParams.infantAge,
        },
        // Contact info is now derived from the first (lead) traveller —
        // the standalone Contact card was removed from the UI.
        contactInfo: {
          title: primary?.title || "Mr",
          name: [primary?.firstName, primary?.middleName, primary?.lastName]
            .filter(Boolean)
            .join(" ")
            .trim(),
          email: primary?.email || "",
          mobile: primary?.mobile || "",
        },
        travellers: localData.travellers,
        selections: {
          hotels: (bookingData.selections.selectedHotels || []).map((h) => ({
            hotelId: h.hotelId,
            hotelName: h.hotelName,
            selectedRate: h.totalRateWithMarkup,
            currency: h.currencyCode || "AED",
          })),
          cab: null,
          activity: null,
        },
        // Programme fields captured on the Hotels tab.
        checkInDate: bookingData.programme?.checkInDate || null,
        flightDetails: bookingData.programme?.flightDetails || null,
        // Optional "Others → Notes" free-text field. Backend saves it as a
        // package_booking_related_notes row on create so it appears in the
        // detail view's Notes panel. Only sent on create (PUT/amend ignores
        // it — additional notes go through POST /booking/{id}/notes).
        initialNote: editingBookingId
          ? null
          : bookingData.programme?.notes || null,
        modeOfPayment: bookingData.programme?.modeOfPayment || null,
        bookingConfirmation: bookingData.programme?.bookingConfirmation || null,
        termsAccepted: !!bookingData.programme?.termsAccepted,
      };

      console.log("Final Booking Payload:", payload);

      // Amendment path uses PUT against /booking/{id}; create path stays
      // on POST /book. Both return { status: "success", ... } on OK.
      const response = editingBookingId
        ? await axiosInstance.put(
            `/api/v1/package-booking/booking/${editingBookingId}`,
            payload,
          )
        : await axiosInstance.post(
            "/api/v1/package-booking/book",
            payload,
          );

      // Trust the HTTP layer: axios throws for non-2xx, so reaching this
      // line already means the request succeeded. Requiring
      // `data.status === "success"` used to silently swallow any 2xx that
      // omitted or renamed the status field — the button re-enabled with no
      // toast, and users re-clicked, creating duplicate bookings. We now
      // treat 2xx as success unless the body explicitly says otherwise.
      const httpOk =
        response && response.status >= 200 && response.status < 300;
      const bodyErrored = response?.data?.status === "error";
      if (httpOk && !bodyErrored) {
        toast.success(
          response.data?.message ||
            (editingBookingId
              ? "Booking amended successfully!"
              : "Booking confirmed successfully!"),
        );
        setShowSummary(false);
        // ADD NEW ITEM (sub-booking) flow: when a child of an existing
        // primary booking was just created, jump straight to the parent's
        // detail page so the user sees the newly-stamped "Related
        // Sub-Bookings (N)" card without having to navigate manually.
        // Root primary codes look like "GPKG-{id}" — extract the id.
        // Falls back to the list page if the code can't be parsed or
        // this was a normal (non-child) booking.
        const parentMatch = parentBookingCode
          ? String(parentBookingCode).match(/GPKG-(\d+)/)
          : null;
        if (parentMatch && parentMatch[1] && !editingBookingId) {
          navigate(`/booking-details/package-booking/${parentMatch[1]}`);
        } else {
          navigate("/booking-details/package-booking-list");
        }
      } else {
        // 2xx with an explicit error body — surface it so the user knows
        // the submission was rejected and doesn't try again.
        toast.error(
          response?.data?.message ||
            "Booking was not confirmed. Please try again.",
        );
      }
    } catch (error) {
      console.error("Booking submission error:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to confirm booking. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleSelect = (value, onChange) => (
    <Form.Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      // minWidth + paddingRight ensure the selected text ("Mr"/"Ms"/"Mrs")
      // isn't hidden behind Bootstrap's chevron arrow inside a narrow column.
      style={{ height: "58px", minWidth: "90px", paddingRight: "2rem" }}
      disabled={isViewMode}
    >
      <option value="Mr">Mr</option>
      <option value="Ms">Ms</option>
      <option value="Mrs">Mrs</option>
    </Form.Select>
  );

  const isViewMode = false; // Add check if needed

  return (
    <div className="tab-pane-active">
      {/* Travellers — the first (lead) traveller doubles as the booking's
          contact. Extras (additional adults / children) are opt-in via the
          buttons below this list and are capped at the package category's
          configured adults / children counts. */}
      <p className="tab-section-title">Traveller information</p>
      {localData.travellers.map((pax, index) => {
        // Numbering within type so extras read "Adult 2", "Child 2" etc.
        const sameTypeBefore = localData.travellers
          .slice(0, index)
          .filter((t) => t.type === pax.type).length;
        return (
        <div key={pax.id} className="pax-card">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span className="pax-type-badge">
              {pax.type} {sameTypeBefore + 1}
              {index === 0 && (
                <span
                  className="ms-2 badge bg-primary"
                  style={{ fontSize: "0.65rem" }}
                >
                  Primary contact
                </span>
              )}
            </span>
            {index > 0 && (
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => removeTraveller(index)}
              >
                Remove
              </Button>
            )}
          </div>
          <Row className="g-3">
            <Col md={2}>
              <Form.Group>
                <Form.Label className="booking-field-label">Title</Form.Label>
                {titleSelect(pax.title, (v) =>
                  handleTravellerChange(index, "title", v),
                )}
              </Form.Group>
            </Col>
            <Col md={5}>
              <Form.Group>
                <Form.Label className="booking-field-label">
                  First name <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  value={pax.firstName}
                  onChange={(e) =>
                    handleTravellerChange(index, "firstName", e.target.value)
                  }
                />
              </Form.Group>
            </Col>
            {/* Middle name input intentionally removed from the form. The
                `middleName` field is still carried on traveller state (seeded
                at makeTraveller, hydrated from saved bookings in amend mode,
                folded into the composite contactInfo.name, and rendered in
                the PackageBookingDetailView) so existing bookings that
                already have a middle name saved don't lose it on amend. */}
            <Col md={5}>
              <Form.Group>
                <Form.Label className="booking-field-label">
                  Last name <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  value={pax.lastName}
                  onChange={(e) =>
                    handleTravellerChange(index, "lastName", e.target.value)
                  }
                />
              </Form.Group>
            </Col>
          </Row>
          {/* Only show mobile for the lead traveller (acts as contact). The
              Email input was intentionally removed from this form. The `email`
              field is still carried on traveller state (seeded at
              makeTraveller, hydrated from saved bookings in amend mode,
              propagated to contactInfo.email on submit, rendered on the PDF
              voucher and in the amend confirmation dialog) so bookings that
              were saved with an email before this change don't silently lose
              it on amend, and existing detail views keep displaying it. */}
          {index === 0 && (
            <Row className="g-3 mt-1">
              <Col md={12}>
                <Form.Group>
                  <Form.Label className="booking-field-label">
                    Passenger Mobile Number{" "}
                    <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    placeholder="+971 ..."
                    value={pax.mobile || ""}
                    onChange={(e) =>
                      handleTravellerChange(index, "mobile", e.target.value)
                    }
                  />
                </Form.Group>
              </Col>
            </Row>
          )}
        </div>
        );
      })}

      {/* Travel details — Pax passport + optional Flight details sit after the
          travellers, just before the add-extra controls. Passport feeds
          searchParams.nativeCountry for submit; Flight details is written to
          bookingData.programme.flightDetails and forwarded as `flightDetails`
          on the /book payload (see the payload block above at ~L451). */}
      <p className="tab-section-title mt-3">Travel details</p>
      <Row className="g-3 mb-2">
        <Col md={4}>
          <Form.Group>
            <Form.Label className="booking-field-label">
              Pax passport <span className="required-dot">*</span>
            </Form.Label>
            <AsyncSelect
              cacheOptions
              defaultOptions
              loadOptions={loadPassportOptions}
              value={searchParams.paxPassport || null}
              onChange={setPaxPassport}
              placeholder="Select country"
              className="modern-select"
              classNamePrefix="react-select"
              isDisabled={isViewMode}
              // Render the menu in a body-level portal so it isn't clipped or
              // covered by the sticky Previous/Confirm nav row directly below.
              menuPortalTarget={
                typeof document !== "undefined" ? document.body : null
              }
              menuPosition="fixed"
              styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
            />
          </Form.Group>
        </Col>
        {/* Optional free-text alphanumeric field — accepts flight number,
            airport codes and times, e.g. "EK 503  STN-DXB  21:45 / 06:50".
            Not validated; not required. Persisted on the booking so the
            supplier can plan pickups / arrivals. */}
        <Col md={8}>
          <Form.Group>
            <Form.Label className="booking-field-label">
              Flight details{" "}
              <span className="text-muted small">(optional)</span>
            </Form.Label>
            <Form.Control
              type="text"
              value={bookingData?.programme?.flightDetails || ""}
              disabled={isViewMode}
              onChange={(e) => {
                const val = e.target.value;
                updateData((prev) => ({
                  ...prev,
                  programme: {
                    ...prev.programme,
                    flightDetails: val,
                  },
                }));
              }}
            />
          </Form.Group>
        </Col>
      </Row>

      {/* Others — free-form fields that don't belong under Traveller or Travel
          headings. Notes is optional; when the user types anything here it is
          sent as `initialNote` on the /book POST, and the backend appends it
          to package_booking_related_notes so it appears in the "Notes" panel
          on the detail view alongside any notes added later via the NOTES
          button. Not consumed on amend (PUT). */}
      <p className="tab-section-title mt-3">Others</p>
      <Row className="g-3 mb-2">
        <Col md={12}>
          <Form.Group>
            <Form.Label className="booking-field-label">
              Notes <span className="text-muted small">(optional)</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={bookingData?.programme?.notes || ""}
              disabled={isViewMode || !!editingBookingId}
              onChange={(e) => {
                const val = e.target.value;
                updateData((prev) => ({
                  ...prev,
                  programme: {
                    ...prev.programme,
                    notes: val,
                  },
                }));
              }}
            />
            {editingBookingId && (
              <div className="text-muted small mt-1">
                To add more notes to an existing booking, use the
                &quot;Notes&quot; button on the booking detail page.
              </div>
            )}
          </Form.Group>
        </Col>
      </Row>

      {/* Add-extra controls — the Adult button is always rendered (cap is
          guaranteed >= 2 above); the Child button only renders when the
          package category actually allows children. Both buttons disable
          themselves when the user has already reached the cap. */}
      <div className="d-flex flex-wrap gap-2 mt-2">
        <Button
          variant="outline-primary"
          size="sm"
          onClick={() => addExtraTraveller("Adult")}
          disabled={!canAddAdult}
          title={
            canAddAdult
              ? `Add another adult (max ${maxAdults})`
              : `Maximum ${maxAdults} adult${maxAdults === 1 ? "" : "s"} for this package category`
          }
        >
          + Add extra adult{" "}
          <span className="text-muted">
            ({currentAdults}/{maxAdults})
          </span>
        </Button>
        {maxChildren > 0 && (
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => addExtraTraveller("Child")}
            disabled={!canAddChild}
            title={
              canAddChild
                ? `Add a child (max ${maxChildren})`
                : `Maximum ${maxChildren} child${maxChildren === 1 ? "" : "ren"} for this package category`
            }
          >
            + Add extra child{" "}
            <span className="text-muted">
              ({currentChildren}/{maxChildren})
            </span>
          </Button>
        )}
      </div>

      <div className="sticky-nav-row d-flex justify-content-between">
        <button className="btn-nav-prev" onClick={onPrev}>
          ← Previous
        </button>
        <button
          className="btn-nav-next"
          onClick={() => {
            if (!validatePaxData()) return;
            // Mode of payment moved to this step's right sidebar; gate the
            // confirm-booking flow on it being selected.
            if (!bookingData?.programme?.modeOfPayment) {
              toast.error("Please select a mode of payment.");
              return;
            }
            // Mandatory "continue with the booking?" choice (Book and Pay Now /
            // Hold Room and Pay Later) — mirrors the hotel booking page.
            if (!bookingData?.programme?.bookingConfirmation) {
              toast.error("Please select a booking option to continue.");
              return;
            }
            // Prime the popup with whatever was previously accepted so a
            // user who reopens it doesn't have to re-tick the box.
            setTermsCheck(!!bookingData?.programme?.termsAccepted);
            setShowTermsModal(true);
          }}
        >
          {editingBookingId ? "Save amendment →" : "Confirm booking →"}
        </button>
      </div>

      {/* Terms & Conditions popup — gates the order-summary modal. */}
      <Modal
        show={showTermsModal}
        onHide={() => setShowTermsModal(false)}
        size="lg"
        centered
        backdrop="static"
        className="terms-accept-modal"
      >
        <Modal.Header closeButton style={{ background: "#f8fafc" }}>
          <Modal.Title className="d-flex align-items-center">
            <FaShieldAlt className="me-2 text-primary" />
            Terms &amp; Conditions
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <p className="text-muted small mb-3">
            Please review the package terms and the cancellation policy
            below. Tick the box to confirm you accept them, then continue
            to the order summary.
          </p>

          {/* Time-period reminder — the package dates/duration must be
              verified against the traveller's schedule before proceeding,
              since they are locked once the booking is confirmed. */}
          <div
            className="d-flex align-items-start gap-2 p-3 mb-3 rounded"
            style={{
              border: "1px solid #fcd34d",
              background: "#fffbeb",
              color: "#92400e",
            }}
          >
            <FaCalendarAlt style={{ marginTop: 2, flexShrink: 0 }} />
            <div className="small">
              <strong>Confirm the package time period.</strong> Before
              proceeding, please make sure the package's time period — the
              travel dates and duration (number of nights / days) — has been
              reviewed and confirmed against the traveller's arrival and
              departure schedule. Once the booking is confirmed these dates
              are locked, and the cancellation charges below will apply to any
              changes.
            </div>
          </div>

          <div
            className="terms-scroll p-3 mb-3 rounded border bg-light"
            style={{ maxHeight: 260, overflowY: "auto" }}
          >
            {termsList.length > 0 ? (
              <ul className="mb-0 ps-3 small">
                {termsList.map((t) => (
                  <li key={`pax-tnc-${t.otherId}`} className="mb-2">
                    {t.description}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-0 small text-muted fst-italic">
                No specific terms were attached to this package. By
                proceeding you confirm you have read the cancellation
                window and accept the standard package conditions.
              </p>
            )}
          </div>

          <Form.Check
            type="checkbox"
            id="pax-terms-accept"
            checked={termsCheck}
            onChange={(e) => setTermsCheck(e.target.checked)}
            label="I have read and accept the Terms & Conditions and cancellation policy, and I confirm the package time period (travel dates and duration) has been checked."
          />
        </Modal.Body>
        <Modal.Footer
          className="border-top-0 p-3"
          style={{ background: "#f1f5f9" }}
        >
          <Button
            variant="outline-secondary"
            onClick={() => setShowTermsModal(false)}
          >
            Cancel
          </Button>
          <Button
            className="btn-nav-next"
            disabled={!termsCheck}
            onClick={() => {
              // Persist acceptance into the shared booking state so the
              // submit payload (programme.termsAccepted) reflects it,
              // close this popup, and open the order summary.
              updateData({
                ...bookingData,
                programme: {
                  ...(bookingData.programme || {}),
                  termsAccepted: true,
                },
              });
              setShowTermsModal(false);
              setShowSummary(true);
            }}
            style={{ minWidth: "180px" }}
          >
            <FaCheckCircle className="me-2" />
            Accept &amp; Continue
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Order Summary Modal */}
      <Modal
        show={showSummary}
        onHide={() => setShowSummary(false)}
        size="lg"
        centered
        className="order-summary-modal"
      >
        <Modal.Header closeButton style={{ background: "#f8fafc" }}>
          <Modal.Title className="d-flex align-items-center">
            <FaClipboardList className="me-2 text-primary" />
            Order Summary
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4" style={{ background: "#f8fafc" }}>
          <div className="summary-section mb-4">
            <h6 className="section-header d-flex align-items-center mb-3">
              <FaCalendarAlt className="me-2 text-muted" size={14} />
              Package & Schedule
            </h6>
            <div className="summary-card p-3 bg-white rounded shadow-sm border">
              <Row>
                <Col sm={6}>
                  <p className="mb-1 text-muted small">Package</p>
                  <p className="fw-semibold mb-0">
                    {packageData?.packageName || "Standard Package"}
                  </p>
                </Col>
                <Col sm={3}>
                  <p className="mb-1 text-muted small">Date</p>
                  <p className="fw-semibold mb-0">{searchParams.travelDate}</p>
                </Col>
                <Col sm={3}>
                  <p className="mb-1 text-muted small">Passengers</p>
                  <p className="fw-semibold mb-0">
                    {currentAdults} Adult, {currentChildren} Child
                  </p>
                </Col>
              </Row>
            </div>
          </div>

          {/* ── Programme strip — nights/days + flight ──
              Check-in date was intentionally removed from this popup. The
              underlying `programme.checkInDate` field is still on state and
              still forwarded on the submit payload so any code path that
              consumes it (e.g. amend hydration, backend voucher metadata)
              keeps working; only the visible row is gone. */}
          {(nights || bookingData.programme?.flightDetails) && (
            <div className="summary-section mb-4">
              <h6 className="section-header d-flex align-items-center mb-3">
                <FaPlaneDeparture className="me-2 text-muted" size={14} />
                Programme
              </h6>
              <div className="summary-card p-3 bg-white rounded shadow-sm border">
                <Row className="g-3 align-items-center">
                  <Col md={6}>
                    <p className="mb-1 text-muted small">Duration</p>
                    <p className="fw-semibold mb-0">
                      {nights
                        ? `${String(nights).padStart(2, "0")} Nights / ${String(
                            daysInt ?? "",
                          ).padStart(2, "0")} Days`
                        : "—"}
                    </p>
                  </Col>
                  <Col md={6}>
                    <p className="mb-1 text-muted small">Flight details</p>
                    <p className="fw-semibold mb-0">
                      {bookingData.programme?.flightDetails || "—"}
                    </p>
                  </Col>
                </Row>
              </div>
            </div>
          )}

          {/* ── Day-wise Itinerary ── */}
          {itineraries.length > 0 && (
            <div className="summary-section mb-4">
              <h6 className="section-header d-flex align-items-center mb-3">
                <FaMapMarkerAlt className="me-2 text-muted" size={14} />
                Day-wise Itinerary
                <span
                  className="ms-2 badge bg-light text-muted fw-normal"
                  style={{ fontSize: "0.7rem" }}
                >
                  {itineraries.length}{" "}
                  {itineraries.length === 1 ? "day" : "days"}
                </span>
              </h6>
              <div className="summary-card p-3 bg-white rounded shadow-sm border">
                {[...itineraries]
                  .sort((a, b) => a.day - b.day)
                  .map((it, idx, arr) => (
                    <div
                      key={`pax-day-${it.day}-${idx}`}
                      className={`pb-3 ${
                        idx !== arr.length - 1 ? "mb-3 border-bottom" : ""
                      }`}
                    >
                      <div className="d-flex align-items-start">
                        <div
                          className="me-3 d-flex align-items-center justify-content-center fw-bold text-white"
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background:
                              "linear-gradient(135deg, #EC0B43, #8b5cf6)",
                            flexShrink: 0,
                            fontSize: "0.8rem",
                          }}
                        >
                          {String(it.day).padStart(2, "0")}
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-semibold">
                            Day {String(it.day).padStart(2, "0")}
                            {it.heading ? ` – ${it.heading}` : ""}
                          </div>
                          {it.placeName && (
                            <div
                              className="text-muted small mb-1"
                              style={{ fontSize: "0.78rem" }}
                            >
                              <FaMapMarkerAlt
                                size={10}
                                className="me-1"
                              />
                              {it.placeName}
                            </div>
                          )}
                          {it.dayActivities && (
                            <p
                              className="text-muted small mb-0"
                              style={{
                                whiteSpace: "pre-line",
                                fontSize: "0.8rem",
                                lineHeight: 1.5,
                              }}
                            >
                              {it.dayActivities}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── Includes / Excludes / Cancellation ── */}
          <div className="summary-section mb-4">
            <Row className="g-3">
              <Col md={6}>
                <h6 className="section-header d-flex align-items-center mb-3">
                  <FaCheckCircle className="me-2 text-success" size={14} />
                  Includes
                </h6>
                <div className="summary-card p-3 bg-white rounded shadow-sm border h-100">
                  {inclusions.length > 0 ? (
                    <ul
                      className="list-unstyled mb-0 small"
                      style={{ fontSize: "0.8rem", lineHeight: 1.6 }}
                    >
                      {inclusions.map((i) => (
                        <li
                          key={`inc-${i.otherId}`}
                          className="d-flex align-items-start mb-2"
                        >
                          <FaCheckCircle
                            className="text-success me-2 mt-1 flex-shrink-0"
                            size={10}
                          />
                          <span>{i.description}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted small fst-italic mb-0">
                      No inclusions listed.
                    </p>
                  )}
                </div>
              </Col>
              <Col md={6}>
                <h6 className="section-header d-flex align-items-center mb-3">
                  <FaTimesCircle className="me-2 text-danger" size={14} />
                  Excludes
                </h6>
                <div className="summary-card p-3 bg-white rounded shadow-sm border h-100">
                  {exclusions.length > 0 ? (
                    <ul
                      className="list-unstyled mb-0 small"
                      style={{ fontSize: "0.8rem", lineHeight: 1.6 }}
                    >
                      {exclusions.map((i) => (
                        <li
                          key={`exc-${i.otherId}`}
                          className="d-flex align-items-start mb-2"
                        >
                          <FaTimesCircle
                            className="text-danger me-2 mt-1 flex-shrink-0"
                            size={10}
                          />
                          <span>{i.description}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted small fst-italic mb-0">
                      No exclusions listed.
                    </p>
                  )}
                </div>
              </Col>
            </Row>
          </div>

          <div className="summary-section mb-4">
            <h6 className="section-header d-flex align-items-center mb-3">
              <FaInfoCircle className="me-2 text-warning" size={14} />
              Cancellation Policy
            </h6>
            <div
              className="summary-card p-3 rounded shadow-sm border"
              style={{ background: "#FFF8E6", borderColor: "#FCE6A6" }}
            >
              {cancellationParts.map((p, i) => (
                <div
                  key={`cancel-${i}`}
                  className={`small ${i !== 0 ? "mt-2 pt-2 border-top" : ""}`}
                  style={{
                    color:
                      p.tone === "ok"
                        ? "#0f5132"
                        : p.tone === "warn"
                          ? "#8a4b00"
                          : "#6c757d",
                    fontSize: "0.82rem",
                    lineHeight: 1.5,
                  }}
                >
                  {p.text}
                </div>
              ))}
            </div>
          </div>

          <div className="summary-section mb-4">
            <h6 className="section-header d-flex align-items-center mb-3">
              <FaMapMarkerAlt className="me-2 text-muted" size={14} />
              Selections
            </h6>
            <Table
              borderless
              className="bg-white rounded shadow-sm border mb-0"
            >
              <thead className="table-light">
                <tr>
                  <th>Service</th>
                  <th>Selection</th>
                  <th className="text-end">Price</th>
                </tr>
              </thead>
              <tbody>
                {/*
                  Hotel selection uses REPLACEMENT semantics — the hotel's
                  totalRateWithMarkup (already sized to the searched category +
                  pax count on the backend) becomes the package total, it is
                  NOT added on top of packageData.rate. So the "Package Base"
                  row is shown only when no hotel has been picked. Without this
                  guard the summary showed "Base + Hotel = 2500" but the Grand
                  Total (which comes from the sidebar total = hotel only) said
                  1500 — rows didn't sum to the total.
                */}
                {(!bookingData.selections.selectedHotels ||
                  bookingData.selections.selectedHotels.length === 0) && (
                  <tr>
                    <td className="text-muted">Package Base</td>
                    <td>Included Services</td>
                    <td className="text-end">
                      AED {Number(packageData?.rate || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
                {bookingData.selections.selectedHotels && bookingData.selections.selectedHotels.map((hotel, idx) => (
                  <tr key={hotel.hotelId || idx}>
                    <td className="text-muted">Hotel {bookingData.selections.selectedHotels.length > 1 ? idx + 1 : ""}</td>
                    <td>{hotel.hotelName}</td>
                    <td className="text-end">
                      AED {Number(hotel.totalRateWithMarkup || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="table-light">
                <tr className="fw-bold fw-large">
                  <td colSpan={2}>Grand Total</td>
                  <td
                    className="text-end text-primary"
                    style={{ fontSize: "1.1rem" }}
                  >
                    AED {Number(totalPrice || 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </Table>
            {/* Tourism Dirham input was intentionally removed from this popup.
                The `tourismDirham` state slot is still hydrated from saved
                bookings in amend mode (see the useEffect near the top of this
                component) and still forwarded on the submit payload, so
                bookings that were saved with a Tourism Dirham amount before
                this change round-trip cleanly. New bookings simply save with
                TD = 0. */}
          </div>

          <div className="summary-section">
            <h6 className="section-header d-flex align-items-center mb-3">
              <FaUsers className="me-2 text-muted" size={14} />
              Contact & Travellers
            </h6>
            <div className="summary-card p-3 bg-white rounded shadow-sm border">
              <p className="mb-2">
                <strong>Contact:</strong>{" "}
                {primary
                  ? `${[primary.firstName, primary.lastName].filter(Boolean).join(" ")} (${primary.email || "-"})`
                  : "-"}
              </p>
              <p className="mb-0 text-muted small">
                <strong>Travellers:</strong>{" "}
                {localData.travellers
                  .map((t) => `${t.firstName} ${t.lastName}`)
                  .join(", ")}
              </p>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer
          className="border-top-0 p-3"
          style={{ background: "#f1f5f9" }}
        >
          <Button
            variant="outline-secondary"
            onClick={() => setShowSummary(false)}
            disabled={isSubmitting}
          >
            Modify selections
          </Button>
          <Button
            className="btn-nav-next"
            onClick={handleSubmitBooking}
            disabled={isSubmitting}
            style={{ minWidth: "160px" }}
          >
            {isSubmitting ? (
              "Processing..."
            ) : (
              <>
                <FaCheckCircle className="me-2" />{" "}
                {editingBookingId ? "Save Amendment" : "Submit Booking"}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .order-summary-modal .modal-content {
          border: none;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
          border-radius: 12px;
          overflow: hidden;
        }
        .section-header {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
        }
        .fw-large {
          font-size: 1.1rem;
        }
      `}</style>
    </div>
  );
};

export default PaxInformation;
