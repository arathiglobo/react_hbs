import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Row, Col, Form, Modal, Button, Table } from "react-bootstrap";
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
  FaCreditCard,
} from "react-icons/fa";

// Payment mode options — mirrors the PAYMENT_MODES list in PackageBooking.jsx
// (kept in sync so the Mode of Payment picker rendered here writes the same
// stored values the /book payload and detail-view expect).
const PAYMENT_MODES = [
  { value: "CREDIT", label: "Credit Limit" },
  { value: "CARD", label: "Card" },
];

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

const PaxInformation = forwardRef(({
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
}, ref) => {
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
    if (!bookingData?.programme?.flightDetails?.trim()) {
      toast.error("Please fill in Flight details.");
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

  // Same logic the sticky-nav Confirm button used to run. Exposed via ref so
  // the sidebar Confirm button PackageCheckout renders directly below the
  // "Are you sure you want to continue with the booking?" card can invoke
  // it — the two must gate identically (validate pax → require modeOfPayment
  // → require bookingConfirmation → open the Terms & Conditions modal that
  // ultimately fires handleSubmitBooking).
  const triggerConfirmClick = () => {
    if (!validatePaxData()) return;
    if (!bookingData?.programme?.modeOfPayment) {
      toast.error("Please select a mode of payment.");
      return;
    }
    if (!bookingData?.programme?.bookingConfirmation) {
      toast.error("Please select a booking option to continue.");
      return;
    }
    setTermsCheck(!!bookingData?.programme?.termsAccepted);
    setShowTermsModal(true);
  };

  useImperativeHandle(ref, () => ({ triggerConfirmClick }));

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

      {/* Travel details — Flight details sits after the travellers, just
          before the add-extra controls. Written to
          bookingData.programme.flightDetails and forwarded as `flightDetails`
          on the /book payload (see the payload block above at ~L451).
          Required — validatePaxData() blocks submit when it's blank. */}
      <p className="tab-section-title mt-3">Travel details</p>
      <Row className="g-3 mb-2">
        {/* Free-text alphanumeric field — accepts flight number, airport
            codes and times, e.g. "EK 503  STN-DXB  21:45 / 06:50". Persisted
            on the booking so the supplier can plan pickups / arrivals. */}
        <Col md={12}>
          <Form.Group>
            <Form.Label className="booking-field-label">
              Flight details <span className="required-dot">*</span>
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

      {/* Mode of payment — relocated here from the right sidebar per product
          spec. Reads / writes bookingData.programme.modeOfPayment through
          the same updateData(prev => …) channel the Notes field uses, so
          the /book payload and the existing "no payment mode" gate at the
          Confirm-booking step (see line ~806 below) keep working unchanged. */}
      <Row className="g-3 mb-2">
        <Col md={6}>
          <Form.Group>
            <Form.Label className="booking-field-label">
              <FaCreditCard className="me-2 text-primary" />
              Mode of payment <span className="text-danger">*</span>
            </Form.Label>
            <Form.Select
              aria-label="Mode of payment"
              value={bookingData?.programme?.modeOfPayment || ""}
              disabled={isViewMode}
              onChange={(e) => {
                const val = e.target.value;
                updateData((prev) => ({
                  ...prev,
                  programme: {
                    ...prev.programme,
                    modeOfPayment: val,
                  },
                }));
              }}
            >
              <option value="">Select payment mode</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Form.Select>
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
        {/* Confirm booking → button removed from here; PackageCheckout now
            renders it in the right sidebar directly below the "Are you sure
            you want to continue with the booking?" card. It triggers the
            same triggerConfirmClick() flow via the ref exposed below. */}
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

      {/* Order Summary Modal — laid out to match HotelBookingPage.jsx's
          "Confirm Your Booking" popup (red primary header, compact single
          bordered card body with dates / lead / cancellation / payment /
          payable / rate-split / policies-accepted / review note, split
          Cancel + Confirm footer). Field mapping is package-appropriate:
          hotel name → package name, address → destination country,
          check-in / check-out → travel date + duration, rooms/nights →
          adults/children, etc. */}
      <Modal
        show={showSummary}
        onHide={() => setShowSummary(false)}
        centered
        backdrop="static"
        dialogClassName="confirm-booking-modal"
      >
        <Modal.Header
          closeButton
          className="bg-primary text-white py-2"
          style={{ borderBottom: "none" }}
        >
          <Modal.Title className="fw-semibold d-flex align-items-center">
            <FaPlaneDeparture className="me-2" /> Confirm Your Booking
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-3 py-2 bg-light">
          {(() => {
            // Local helpers — kept inline so this modal has no external
            // dependency other than the props/state PaxInformation already
            // computes above.
            const activeUserRole = localStorage.getItem("currentActiveRole");
            const formatPrice = (v) =>
              `AED ${Number(v || 0).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`;
            const tdNum =
              tourismDirham !== "" && !isNaN(Number(tourismDirham))
                ? Number(tourismDirham)
                : 0;
            const payableTotal = Number(totalPrice || 0) + tdNum;
            const paymentModeLabel = (() => {
              const m = bookingData?.programme?.modeOfPayment;
              if (m === "CREDIT") return "Credit Limit";
              if (m === "CARD") return "Card";
              return m || "—";
            })();
            const leadName = primary
              ? [primary.title, primary.firstName, primary.middleName, primary.lastName]
                  .filter(Boolean)
                  .join(" ")
                  .trim()
              : "";
            const travelDateStr = searchParams?.travelDate
              ? new Date(searchParams.travelDate).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "—";
            // Non-refundable equivalent for packages — a cancellation
            // policy whose "with charge" band charges 100% (or has no free
            // days). Falls back to the styled deadline card below when
            // partially refundable.
            const isNonRefundable = (() => {
              const free = packageView?.cancellationDaysFree;
              const value = packageView?.cancellationChargeValue;
              const type = packageView?.cancellationChargeType;
              return (
                (free == null || Number(free) === 0) &&
                type &&
                type.toLowerCase() === "percent" &&
                Number(value) >= 100
              );
            })();
            return (
              <div className="border rounded-3 bg-white shadow-sm p-2">
                <div className="mb-2">
                  <p className="mb-0 d-flex align-items-center flex-wrap">
                    <span className="fw-bold text-primary fs-5">
                      {packageData?.packageName ||
                        packageView?.packageName ||
                        "Package"}
                    </span>
                    {packageView?.arriveCountryName && (
                      <span className="text-muted small ms-1">
                        , {packageView.arriveCountryName}
                      </span>
                    )}
                  </p>
                </div>

                <hr className="my-2" />

                <Row className="gy-1">
                  <Col xs={6}>
                    <p className="mb-1">
                      <strong>Travel Date:</strong>
                      <br />
                      <span className="text-dark">{travelDateStr}</span>
                    </p>
                  </Col>
                  <Col xs={6}>
                    <p className="mb-1">
                      <strong>Duration:</strong>
                      <br />
                      <span className="text-dark">
                        {nights
                          ? `${String(nights).padStart(2, "0")} Nights / ${String(
                              daysInt ?? "",
                            ).padStart(2, "0")} Days`
                          : "—"}
                      </span>
                    </p>
                  </Col>
                  <Col xs={6}>
                    <p className="mb-1">
                      <strong>Adults:</strong> {currentAdults}
                    </p>
                  </Col>
                  <Col xs={6}>
                    <p className="mb-1">
                      <strong>Children:</strong> {currentChildren}
                    </p>
                  </Col>

                  {bookingData?.programme?.flightDetails && (
                    <Col xs={12}>
                      <p className="mb-1">
                        <strong>Flight details:</strong>
                        <br />
                        <span className="text-dark">
                          {bookingData.programme.flightDetails}
                        </span>
                      </p>
                    </Col>
                  )}

                  {leadName && (
                    <Col xs={12}>
                      <p className="mb-1">
                        <strong>Lead Passenger:</strong>
                        <br />
                        <span className="text-dark">{leadName}</span>
                      </p>
                    </Col>
                  )}

                  {/* Cancellation block — Non-Refundable rates get a red
                      warning card (mirrors HotelBookingPage); anything else
                      lists the cancellation policy timeline inline. Payment
                      Mode badge sits in a paired md=6 column so the two read
                      as one row on tablet+ and stack cleanly on mobile. */}
                  {isNonRefundable ? (
                    <Col xs={12} md={6}>
                      <div
                        className="p-2 rounded border"
                        style={{
                          borderColor: "#dc2626",
                          background: "#fef2f2",
                        }}
                      >
                        <p
                          className="mb-1 fw-bold"
                          style={{ color: "#dc2626" }}
                        >
                          Non-refundable
                        </p>
                        <p className="mb-0 text-dark small">
                          100% cancellation charges apply.
                        </p>
                      </div>
                    </Col>
                  ) : (
                    cancellationParts.length > 0 && (
                      <Col xs={12} md={6}>
                        <p className="mb-1">
                          <strong>Cancellation Policy:</strong>
                        </p>
                        {cancellationParts.map((p, i) => (
                          <p
                            key={`sum-cancel-${i}`}
                            className="mb-1 small text-dark"
                            style={{ lineHeight: 1.35 }}
                          >
                            {p.text}
                          </p>
                        ))}
                      </Col>
                    )
                  )}

                  <Col
                    xs={12}
                    md={6}
                    className="d-flex align-items-start justify-content-md-end"
                  >
                    <p className="mb-1">
                      <strong>Payment Mode:</strong>
                      <br />
                      <span
                        className="badge bg-success"
                        style={{ fontSize: "0.75rem" }}
                      >
                        {paymentModeLabel}
                      </span>
                    </p>
                  </Col>

                  <Col xs={12}>
                    {activeUserRole === "ADMIN" && (
                      <div className="p-2 rounded bg-white border mt-2">
                        <div className="d-flex justify-content-between align-items-center">
                          <h6 className="mb-0 text-muted">Selling Price</h6>
                          <h5 className="mb-0 text-success fw-bold">
                            {formatPrice(payableTotal)}
                          </h5>
                        </div>
                      </div>
                    )}
                    <div className="p-2 rounded bg-white border mt-2 d-flex justify-content-between align-items-center">
                      <h6 className="mb-0 fw-bold">Payable</h6>
                      <h5 className="mb-0 fw-bold">
                        {formatPrice(payableTotal)}
                      </h5>
                    </div>
                  </Col>
                </Row>

                <div className="mt-1 p-2 bg-white border rounded">
                  <h6 className="fw-bold mb-1">Rate Split</h6>
                  <div className="d-flex justify-content-between">
                    <span>Selling Price</span>
                    <span>{formatPrice(totalPrice)}</span>
                  </div>
                  {tdNum > 0 && (
                    <div className="d-flex justify-content-between">
                      <span>Tourism Dirhams</span>
                      <span>{formatPrice(tdNum)}</span>
                    </div>
                  )}
                  <hr className="my-1" />
                  <div className="d-flex justify-content-between fw-bold">
                    <span>Total (Selling)</span>
                    <span>{formatPrice(payableTotal)}</span>
                  </div>
                </div>

                <div className="mt-1 p-2 bg-white border rounded d-flex align-items-center">
                  <span
                    className="me-2 d-inline-flex align-items-center justify-content-center"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#16a34a",
                      color: "#fff",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span className="small text-dark">
                    Package policies and terms &amp; conditions accepted
                  </span>
                </div>

                <div className="mt-1 text-center">
                  <p className="text-muted small mb-0">
                    Please review the booking details carefully before
                    confirming.
                  </p>
                </div>
              </div>
            );
          })()}
        </Modal.Body>

        <Modal.Footer className="bg-light border-0 d-flex justify-content-between">
          <Button
            variant="outline-secondary"
            onClick={() => setShowSummary(false)}
            disabled={isSubmitting}
          >
            <i className="bi bi-x-circle me-1"></i> Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmitBooking}
            disabled={isSubmitting}
            className="px-4 fw-semibold"
          >
            {isSubmitting ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                ></span>
                Processing...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle me-1"></i>{" "}
                {editingBookingId ? "Save Amendment" : "Confirm"}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  );
});

export default PaxInformation;
