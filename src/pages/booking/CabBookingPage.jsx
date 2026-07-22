import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Badge,
  Spinner,
  Modal,
  Table,
} from "react-bootstrap";
import {
  FaCar,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaArrowLeft,
  FaUsers,
  FaCreditCard,
  FaHeadset,
  FaInfoCircle,
  FaEdit,
  FaClock,
} from "react-icons/fa";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import AgentBalanceDisplay from "../../components/AgentBalanceDisplay";
import "../../styles/HotelBookingPage.css";

const emptyCabPolicies = {
  terms: [],
  cancellations: [],
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Payment Method options — mirrors the package booking's "Mode of payment"
// dropdown (PackageBooking.jsx PAYMENT_MODES). "CREDIT" (Agent credit limit)
// settles against the agent wallet; CARD / BANK_TRANSFER / CASH are settled
// out-of-band and skip the wallet deduction server-side.
const PAYMENT_MODES = [
  { value: "CREDIT", label: "Agent credit limit" },
  { value: "CARD", label: "Card payment" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
];

const paymentModeLabel = (value) =>
  PAYMENT_MODES.find((m) => m.value === value)?.label || value || "—";

const formatDateToDDMMYYYY = (dateString) => {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${day}-${month}-${year}`;
};

// "2026-07-22" → "22 Jul 2026" for the Booking Summary strip. Falls back to
// the raw value when the string isn't the expected ISO shape.
const formatTransferDate = (dateString) => {
  if (!dateString) return "—";
  const parts = String(dateString).split("-");
  if (parts.length !== 3) return dateString;
  const [y, m, d] = parts;
  const mi = parseInt(m, 10) - 1;
  if (Number.isNaN(mi) || mi < 0 || mi > 11) return dateString;
  return `${parseInt(d, 10)} ${MONTHS[mi]} ${y}`;
};

// Reverse-geocode browser coordinates to a readable address for the Booking
// History audit trail. Tries OpenStreetMap Nominatim first (street-level),
// then BigDataCloud (locality-level, keyless) — both free, CORS-enabled.
// Returns null when neither responds so the caller keeps its IP-derived
// fallback. Mirrors the other dedicated-flow booking pages (Long Stay etc.).
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`,
      { headers: { Accept: "application/json" } }
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
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    if (res.ok) {
      const d = await res.json();
      const parts = [d.locality, d.city, d.principalSubdivision, d.countryName].filter(Boolean);
      const line = parts.filter((p, i) => parts.indexOf(p) === i).join(", ");
      if (line) return line.slice(0, 255);
    }
  } catch {
    // give up — caller keeps the IP-based fallback
  }
  return null;
}

const CabBookingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cab, selectedOption, searchCriteria } = location.state || {};
  const selectedAgentId =
    searchCriteria?.agentId != null && searchCriteria.agentId !== ""
      ? String(searchCriteria.agentId)
      : sessionStorage.getItem("makeYourOwnPackageAgentId") ||
        localStorage.getItem("makeYourOwnPackageAgentId") ||
        "";

  // If accessed directly without state, we should probably redirect or show an error
  const hasValidState = !!cab && !!selectedOption && !!searchCriteria;

  // Client location snapshot for the booking-history audit trail, resolved
  // once on page load and sent on the create payload. Location — browser
  // geolocation (GPS/WiFi) reverse-geocoded to a precise readable address;
  // the coarse IP-derived city is only the fallback when the permission is
  // denied or the lookup times out. The IP Address column is stamped
  // server-side from the create request (browsers can't read their own
  // public IP reliably), so it is not resolved here. Mirrors the other
  // dedicated-flow booking pages.
  const [clientNetwork, setClientNetwork] = useState({
    bookingLocation: null,
  });
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
            [info.city, info.region, info.country_name].filter(Boolean).join(", ") ||
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
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    }

    return () => { cancelled = true; };
  }, []);

  // ── Full pax manifest (one row per adult + child) ────────────────────
  // Seeded from the searchCriteria counts so the operator can capture
  // names for every traveller. The Lead radio (one per row) picks which
  // pax becomes the primary/lead — that row's contact + LPO fields are
  // captured inline and persisted to the customer/lead-passenger table,
  // while the other rows are persisted to the guest table as-is.
  const totalAdults = Math.max(0, Number(searchCriteria?.adults) || 0);
  const totalChildren = Math.max(0, Number(searchCriteria?.children) || 0);
  const childAges = Array.isArray(searchCriteria?.childAges)
    ? searchCriteria.childAges
    : [];
  const initialGuests = useMemo(() => {
    const out = [];
    for (let i = 0; i < totalAdults; i++) {
      out.push({
        salutation: i === 0 ? "Mr" : "",
        firstName: "",
        middleName: "",
        lastName: "",
        gender: "",
        isChild: false,
        age: null,
        passportNo: "",
        // Lead-only contact fields. Captured inline when the row is
        // marked as Lead and forwarded as the customer/primary record.
        contactNumber: "",
        emailId: "",
        lpo: "",
      });
    }
    for (let i = 0; i < totalChildren; i++) {
      out.push({
        salutation: "",
        firstName: "",
        middleName: "",
        lastName: "",
        gender: "",
        isChild: true,
        age: childAges[i] != null ? Number(childAges[i]) : null,
        passportNo: "",
        contactNumber: "",
        emailId: "",
        lpo: "",
      });
    }
    return out;
    // eslint-disable-next-line
  }, []);
  const [guests, setGuests] = useState(initialGuests);

  // Lead-passenger index — points at the row whose details build the
  // primary customer record. Defaults to the first adult; children are
  // never allowed to be the lead (the radio is disabled for them).
  const [leadIndex, setLeadIndex] = useState(0);

  // Derived "primary guest" — exposed under the same shape the rest of
  // this file already consumes (Order Summary modal, payload), so we
  // didn't have to rename references. Always reflects whichever row is
  // currently flagged as Lead.
  const leadGuest = guests[leadIndex] || {};
  const primaryGuest = {
    salutation: leadGuest.salutation || "",
    firstName: leadGuest.firstName || "",
    lastName: leadGuest.lastName || "",
    contactNumber: leadGuest.contactNumber || "",
    emailId: leadGuest.emailId || "",
    passportNumber: leadGuest.passportNo || "",
    lpo: leadGuest.lpo || "",
  };

  const handleGuestChange = (index, field, value) => {
    setGuests((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    // Clear inline error if any.
    const key = `guest_${index}_${field}`;
    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    }
  };

  const handleLeadSelect = (index) => {
    if (guests[index]?.isChild) return;
    setLeadIndex(index);
    // Lead changed → clear any errors that were attached to the old lead's
    // contact/email/lpo so they don't keep showing on the new lead's row.
    setValidationErrors((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (
          k === "contactNumber" ||
          k === "emailId" ||
          k === "lpo" ||
          k === "lead"
        ) {
          delete next[k];
        }
      });
      return next;
    });
  };

  // Transporter & driver details were removed from the booking form, but the
  // booking payload still carries these (empty) fields so the backend contract
  // is unchanged. They're assigned on the backend / a later workflow stage.
  const transporterDetails = {
    transporter: "",
    contactNumber: "",
    driverName: "",
    driverContact: "",
  };

  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [cabPolicies, setCabPolicies] = useState(emptyCabPolicies);

  // ── Order Summary modal — mirrors HotelBookingPage.jsx pattern ─────
  // The "Confirm Booking" button now validates + builds the payload and
  // opens this modal. Only the modal's own confirm action actually POSTs
  // to /api/cab/book, giving the user a final review step before save.
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  // Resolved agent display name for the Booking Summary strip. We only
  // carry the agentId through the search → booking hand-off, so the
  // human-readable label is fetched here. Falls back to "Agent #id".
  const [agentName, setAgentName] = useState("");
  useEffect(() => {
    if (!selectedAgentId) {
      setAgentName("");
      return;
    }
    let cancelled = false;
    axiosInstance
      .get(`/api/agent/${selectedAgentId}`)
      .then((res) => {
        if (cancelled) return;
        const a = res?.data || {};
        const full = [a.firstName, a.lastName].filter(Boolean).join(" ").trim();
        setAgentName(a.companyName || a.name || full || `Agent #${selectedAgentId}`);
      })
      .catch(() => {
        if (!cancelled) setAgentName(`Agent #${selectedAgentId}`);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAgentId]);

  // Settlement mode picked on the Payment Method dropdown. Mirrors the
  // package booking's "Mode of payment": "CREDIT" (Agent credit limit) is
  // the only mode that deducts the agent wallet; CARD / BANK_TRANSFER /
  // CASH are settled out-of-band and skip the deduction (honoured
  // server-side). Empty until the credit-based default below seeds it.
  const [paymentMode, setPaymentMode] = useState("");

  // Default the payment mode from the agent's available credit, exactly
  // like the package "Mode of payment" dropdown: credit available →
  // "CREDIT"; none / unavailable → "CARD". Only seeds when nothing is
  // chosen yet, so a manual pick is never clobbered.
  useEffect(() => {
    if (!selectedAgentId) return;
    let cancelled = false;
    const applyDefault = (mode) => {
      if (!cancelled) setPaymentMode((prev) => prev || mode);
    };
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${selectedAgentId}`)
      .then((res) => {
        const avail =
          res?.data?.effectiveAvailableCreditLimit ??
          res?.data?.availableCreditLimit ??
          null;
        applyDefault(avail != null && Number(avail) > 0 ? "CREDIT" : "CARD");
      })
      .catch(() => applyDefault("CARD"));
    return () => {
      cancelled = true;
    };
  }, [selectedAgentId]);

  // Free-text special requirements (baby seat, wheelchair, extra luggage …).
  // Persisted on the cab booking via the new specialRequirements field.
  const [specialRequirements, setSpecialRequirements] = useState("");

  // ── Per-leg pickup / dropoff details ────────────────────────────────
  // Only the fields relevant to the chosen leg type are surfaced on the
  // UI; the others stay null in the payload. The full set is persisted
  // on the cab booking entity (backend additive change), so the booking
  // detail view + voucher can render either flavour.
  // Note: Estimated Arrival Time is NOT in this state — it now comes from
  // the airport master (searchCriteria.pickupEstimatedArrivalTime) and is
  // rendered read-only on the page.
  const [pickupDetails, setPickupDetails] = useState({
    arrivingFrom: "",
    flightNo: "",
    greetingSign: "",
  });

  // HQ amount — operator-side adjustment to the supplier-side total.
  // Sent to the backend as `adjustmentAmount` on the booking payload.
  // Free-form string in state so the user can type the value naturally;
  // converted to a Number at submit time. Blank → null (no adjustment).
  const [hqAmount, setHqAmount] = useState("");
  const [dropoffDetails, setDropoffDetails] = useState({
    departingTo: "",
    flightNo: "",
    terminal: "",
    departureTime: searchCriteria.dropoffTime || "",
  });
  // Hotel addresses auto-fetched from /api/hotels/lookup when the leg
  // type is HOTEL. We resolve by matching hotelName (case-insensitive),
  // scoped by destination cityId when known. Empty string falls back to
  // "—" on the UI; the resolved value is also forwarded in the booking
  // payload so the voucher PDF doesn't need a second lookup.
  const [pickupHotelAddress, setPickupHotelAddress] = useState("");
  const [dropoffHotelAddress, setDropoffHotelAddress] = useState("");

  // Default the greeting sign to the lead passenger's full name once the
  // operator fills it in. Only seeds when the field is still blank so an
  // explicitly entered sign isn't clobbered.
  useEffect(() => {
    if (
      searchCriteria.pickupType === "AIRPORT" &&
      !pickupDetails.greetingSign
    ) {
      const leadName = [
        leadGuest?.salutation,
        leadGuest?.firstName,
        leadGuest?.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (leadName) {
        setPickupDetails((prev) =>
          prev.greetingSign ? prev : { ...prev, greetingSign: leadName },
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    leadGuest?.firstName,
    leadGuest?.lastName,
    leadGuest?.salutation,
    searchCriteria.pickupType,
  ]);

  // Lookup hotel addresses whenever a leg is HOTEL. /api/hotels/lookup
  // returns rows with `hotelName` + `address`; we filter by name. The
  // lookup is keyed by (cityId, hotelName) so it only fires once.
  useEffect(() => {
    const cityId = searchCriteria.city?.value || searchCriteria.destination?.value;
    const fetchAddr = async (name, setter) => {
      if (!name) {
        setter("");
        return;
      }
      try {
        const params = { search: name, limit: 50 };
        if (cityId) params.cityId = cityId;
        const res = await axiosInstance.get("/api/hotels/lookup", { params });
        const arr = Array.isArray(res.data) ? res.data : [];
        const hit = arr.find(
          (h) =>
            (h.hotelName || "").trim().toLowerCase() ===
            name.trim().toLowerCase(),
        ) || arr[0];
        setter(hit?.address || "");
      } catch (err) {
        console.warn("Hotel address lookup failed:", err);
        setter("");
      }
    };
    if (searchCriteria.pickupType === "HOTEL") {
      fetchAddr(searchCriteria.pickupName, setPickupHotelAddress);
    } else {
      setPickupHotelAddress("");
    }
    if (searchCriteria.dropoffType === "HOTEL") {
      fetchAddr(searchCriteria.dropoffName, setDropoffHotelAddress);
    } else {
      setDropoffHotelAddress("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchCriteria.pickupType,
    searchCriteria.pickupName,
    searchCriteria.dropoffType,
    searchCriteria.dropoffName,
  ]);

  useEffect(() => {
    const cabId = cab?.cabid || cab?.cabId;
    if (!cabId) {
      setCabPolicies(emptyCabPolicies);
      return;
    }
    let cancelled = false;
    setPolicyLoading(true);
    axiosInstance
      .get(`/api/cabRates/cab/${cabId}/policies`)
      .then((res) => {
        if (cancelled) return;
        setCabPolicies({
          terms: Array.isArray(res.data?.termsAndConditions)
            ? res.data.termsAndConditions.filter(Boolean)
            : [],
          cancellations: Array.isArray(res.data?.cancellationPolicies)
            ? res.data.cancellationPolicies.filter(Boolean)
            : [],
        });
      })
      .catch((err) => {
        console.warn("Failed to load cab policies:", err);
        if (!cancelled) setCabPolicies(emptyCabPolicies);
      })
      .finally(() => {
        if (!cancelled) setPolicyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cab?.cabid, cab?.cabId]);

  const rate = selectedOption?.types === "SIC" ? selectedOption.sicRate : selectedOption?.privateRate;
  // Prefer the new markup-applied total (`totalRate`) from the search
  // result so the price shown here matches what the operator clicked.
  // Fall back to the legacy `totalRateWithoutMrk` for older responses
  // and finally to the per-row rate. The supplier-base (no markup)
  // amount is still kept on `selectedOption.totalRateWithoutMrk` and
  // sent as `totalRateWithoutmrk` in the booking POST below.
  const initialTotalRate =
    selectedOption?.totalRate ||
    selectedOption?.totalRateWithoutMrk ||
    rate ||
    0;

  const [prices, setPrices] = useState({
    sellingPrice: initialTotalRate.toString(),
    totalPrice: initialTotalRate.toString(),
  });
  const [tourismDirham, setTourismDirham] = useState("");

  // If no state, show prompt
  if (!hasValidState) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4 d-flex justify-content-center align-items-center">
            <Card className="text-center p-5 shadow-sm border-0 rounded-4">
              <Card.Body>
                <FaCar className="display-4 text-warning mb-3" />
                <h4 className="fw-bold mb-3">No Transfer Selected</h4>
                <p className="text-muted mb-4">Please select a transfer from the search page first.</p>
                <Button variant="primary" onClick={() => navigate("/new-booking/cab")}>
                  Go to Cab Search
                </Button>
              </Card.Body>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  const totalRate = parseFloat(prices.totalPrice) || initialTotalRate;

  const handlePriceChange = (field, value) => {
    setPrices((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const errors = {};
    let hasErrors = false;

    const lead = guests[leadIndex];
    if (!lead) {
      errors.lead = "Please mark a passenger as Lead";
      hasErrors = true;
    } else if (lead.isChild) {
      errors.lead = "The lead must be an adult passenger";
      hasErrors = true;
    }

    // Each pax row needs at least a first + last name. Salutation is
    // required for adults; children can leave it blank.
    guests.forEach((g, idx) => {
      if (!g.firstName || !g.firstName.trim()) {
        errors[`guest_${idx}_firstName`] = "Required";
        hasErrors = true;
      }
      if (!g.lastName || !g.lastName.trim()) {
        errors[`guest_${idx}_lastName`] = "Required";
        hasErrors = true;
      }
      if (!g.isChild && (!g.salutation || !g.salutation.trim())) {
        errors[`guest_${idx}_salutation`] = "Required";
        hasErrors = true;
      }
    });

    // Contact Details — the lead passenger's email + phone are mandatory
    // (captured on the Contact Details card; the phone doubles as the lead
    // row's Contact No. in the passenger table, so the error keys match).
    if (lead) {
      if (!lead.emailId || !lead.emailId.trim()) {
        errors[`guest_${leadIndex}_emailId`] = "Email is required";
        hasErrors = true;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.emailId.trim())) {
        errors[`guest_${leadIndex}_emailId`] = "Enter a valid email address";
        hasErrors = true;
      }
      if (!lead.contactNumber || !lead.contactNumber.trim()) {
        errors[`guest_${leadIndex}_contactNumber`] = "Phone is required";
        hasErrors = true;
      }
    }

    return { errors, hasErrors };
  };

  // ── Step 1: validate + build payload + open Order Summary modal.
  // No backend call yet — the user must explicitly confirm in the modal.
  const handleConfirmClick = () => {
    const { errors, hasErrors } = validateForm();

    if (hasErrors) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields correctly.");
      return;
    }

    if (!selectedAgentId) {
      toast.error("Agent is required for cab booking.");
      return;
    }

    if (!paymentMode) {
      toast.error("Please select a payment method.");
      return;
    }

    if (!acceptedPolicies) {
      toast.error(
        "Please accept the Terms & Conditions and Cancellation Policy to continue.",
      );
      return;
    }

    const tdNumber =
      tourismDirham !== "" && !isNaN(Number(tourismDirham))
        ? Number(tourismDirham)
        : 0;
    const hqNumber =
      hqAmount !== "" && !isNaN(Number(hqAmount))
        ? Number(hqAmount)
        : 0;
    const sellingWithTd = (parseFloat(prices.sellingPrice) || 0) + tdNumber;
    // Grand total shown on the Price Details card = base total + Tourism
    // Dirham + HQ adjustment. This is the amount saved against the booking
    // and (for CREDIT mode) deducted from the agent wallet, so the HQ
    // amount is rolled into the saved total here — not just displayed.
    const grandTotal =
      (parseFloat(prices.totalPrice) || totalRate) + tdNumber + hqNumber;

    const payload = {
      cabId: cab.cabid,
      noOfCabs: cab.noOfCabs || 1,
      pickupDate: formatDateToDDMMYYYY(searchCriteria.pickupDate),
      dropOffDate: formatDateToDDMMYYYY(searchCriteria.dropoffDate || searchCriteria.pickupDate),
      travelType: parseInt(selectedOption.travelType) || 1,
      locationId: parseInt(selectedOption.locationId) || 0,
      noOfAdult: parseInt(searchCriteria.adults) || 1,
      noOfChild: parseInt(searchCriteria.children) || 0,
      childAgeArray: (searchCriteria.childAges || []).map(age => parseInt(age)),
      totalRate: grandTotal,
      totalRateWithoutmrk: parseFloat(selectedOption.totalRateWithoutMrk || totalRate),
      tourismDirham: tdNumber > 0 ? tdNumber : null,
      agentId: parseInt(selectedAgentId),
      userId: parseInt(selectedAgentId),
      customerDTO: {
        salutation: primaryGuest.salutation,
        firstName: primaryGuest.firstName,
        lastName: primaryGuest.lastName,
        contactNumber: primaryGuest.contactNumber,
        emailId: primaryGuest.emailId,
        passportNumber: primaryGuest.passportNumber,
        lpo: primaryGuest.lpo
      },
      // Full pax manifest — backend persists each row into cab_guest. The
      // row marked as Lead also has its name/contact data forwarded into
      // customerDTO above, so the backend can split lead-vs-guest rows.
      guests: guests.map((g, idx) => {
        const adultsBefore = totalAdults;
        const seatNumber = g.isChild
          ? idx - adultsBefore + 1
          : idx + 1;
        return {
          salutation: g.salutation || null,
          firstName: g.firstName || null,
          middleName: g.middleName || null,
          lastName: g.lastName || null,
          gender: g.gender || null,
          isChild: !!g.isChild,
          age: g.age != null ? Number(g.age) : null,
          passportNo: g.passportNo || null,
          guestIndex: seatNumber,
          isLead: idx === leadIndex,
        };
      }),
      transporter: transporterDetails.transporter,
      contactNumber: transporterDetails.contactNumber,
      driverName: transporterDetails.driverName,
      driverContact: transporterDetails.driverContact,
      sellingPrice: String(sellingWithTd.toFixed(2)),
      totalPrice: String(grandTotal.toFixed(2)),
      // Pickup / Drop-off details forwarded from the search page. The
      // per-leg fields (arrivingFrom / flightNo / greetingSign /
      // departingTo / terminal / hotelAddress) are entered on the new
      // Pick Up Details / Drop Off Details cards above; for legs that
      // don't apply the field stays null so the entity row keeps a
      // clean NULL instead of an empty-string artefact.
      pickupType: searchCriteria.pickupType || null,
      pickupName: searchCriteria.pickupName || null,
      pickupTime:
        searchCriteria.pickupType === "AIRPORT"
          ? searchCriteria.pickupEstimatedArrivalTime ||
            searchCriteria.pickupTime ||
            null
          : null,
      pickupArrivingFrom:
        searchCriteria.pickupType === "AIRPORT"
          ? pickupDetails.arrivingFrom || null
          : null,
      pickupFlightNo:
        searchCriteria.pickupType === "AIRPORT"
          ? pickupDetails.flightNo || null
          : null,
      pickupGreetingSign:
        searchCriteria.pickupType === "AIRPORT"
          ? pickupDetails.greetingSign || null
          : null,
      pickupHotelAddress:
        searchCriteria.pickupType === "HOTEL"
          ? pickupHotelAddress || null
          : null,
      dropoffType: searchCriteria.dropoffType || null,
      dropoffName: searchCriteria.dropoffName || null,
      dropoffTime:
        searchCriteria.dropoffType === "AIRPORT"
          ? dropoffDetails.departureTime ||
            searchCriteria.dropoffTime ||
            null
          : null,
      dropoffDepartingTo:
        searchCriteria.dropoffType === "AIRPORT"
          ? dropoffDetails.departingTo || null
          : null,
      dropoffFlightNo:
        searchCriteria.dropoffType === "AIRPORT"
          ? dropoffDetails.flightNo || null
          : null,
      dropoffTerminal:
        searchCriteria.dropoffType === "AIRPORT"
          ? dropoffDetails.terminal || null
          : null,
      dropoffHotelAddress:
        searchCriteria.dropoffType === "HOTEL"
          ? dropoffHotelAddress || null
          : null,
      // HQ amount (operator-side Adjustment Amt). Blank → null so the
      // backend stores SQL NULL instead of 0 (lets reports tell apart
      // "no adjustment" from "zero adjustment").
      adjustmentAmount:
        hqAmount !== "" && !isNaN(Number(hqAmount))
          ? Number(hqAmount)
          : null,
      // Payment mode chosen on the Payment Method dropdown. Only "CREDIT"
      // (Agent credit limit) deducts the agent wallet; CARD / BANK_TRANSFER
      // / CASH are settled out-of-band and skip the deduction server-side.
      paymentMode,
      // Free-text special requirements captured on the checkout page.
      specialRequirements: specialRequirements.trim() || null,
      // Lead passenger email — the voucher/updates recipient.
      sendEmailTo: primaryGuest.emailId || null,
      policyAccepted: true,
      acceptedTermsAndConditions: true,
      acceptedCancellationPolicies: true,
      termsAndConditions: cabPolicies.terms,
      cancellationPolicies: cabPolicies.cancellations,
      // Reverse-geocoded client location for the Booking History audit trail's
      // Location column. The IP Address column is stamped server-side from the
      // create request, so it is not sent here.
      bookingLocation: clientNetwork.bookingLocation,
    };

    setPendingPayload(payload);
    setShowSummaryModal(true);
  };

  // ── Step 2: actually POST to /api/cab/book once the user confirms in
  // the Order Summary modal. Mirrors HotelBookingPage.jsx's confirmBooking.
  const submitBooking = async () => {
    if (!pendingPayload) return;
    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post("/api/cab/book", pendingPayload);

      if (response && (response.data?.success !== false && response.status === 200)) {
        toast.success("Cab booked successfully!");
        setShowSummaryModal(false);
        navigate("/booking-details/cab-booking-list");
      } else {
        toast.error(response.data?.message || "Failed to book cab.");
      }
    } catch (error) {
      console.error("Booking error:", error);
      toast.error("An error occurred during booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
    }).format(price || 0);
  };

  // Shared card-header style so every section reads as one system.
  const cardHeaderStyle = { backgroundColor: "#ffffff" };
  const routeArrow = " → ";

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid className="px-0">
            {/* ── Page header — Back + title on the left, agent balance
                 on the right (mirrors the other checkout pages). */}
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="d-flex align-items-center gap-1"
                  onClick={() => navigate("/new-booking/cab")}
                >
                  <FaArrowLeft /> Back
                </Button>
                <h5 className="mb-0 fw-bold text-dark">Cab Booking Checkout</h5>
              </div>
              <AgentBalanceDisplay agentId={selectedAgentId} />
            </div>

            <Row className="g-4">
              {/* ── Left column — trip + traveller data ─────────────── */}
              <Col lg={8}>
                {/* Booking Summary */}
                <Card className="border rounded-3 mb-4 overflow-hidden shadow-sm">
                  <Card.Header
                    className="py-3 px-4 d-flex justify-content-between align-items-center border-bottom"
                    style={cardHeaderStyle}
                  >
                    <span className="fw-bold text-dark">Booking Summary</span>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="d-flex align-items-center gap-1"
                      onClick={() => navigate("/new-booking/cab")}
                    >
                      <FaEdit /> Edit Search
                    </Button>
                  </Card.Header>
                  <Card.Body className="p-4">
                    <Row className="g-3">
                      <Col xs={6} md>
                        <div className="text-muted small mb-1">Agent</div>
                        <div className="fw-semibold text-dark">
                          {agentName || "—"}
                        </div>
                      </Col>
                      <Col xs={6} md>
                        <div className="text-muted small mb-1">Transfer Date</div>
                        <div className="fw-semibold text-dark">
                          {formatTransferDate(searchCriteria.pickupDate)}
                        </div>
                      </Col>
                      <Col xs={6} md>
                        <div className="text-muted small mb-1">City</div>
                        <div className="fw-semibold text-dark">
                          {searchCriteria.city?.label ||
                            searchCriteria.destination?.label ||
                            "—"}
                        </div>
                      </Col>
                      <Col xs={6} md>
                        <div className="text-muted small mb-1">Nationality</div>
                        <div className="fw-semibold text-dark">
                          {searchCriteria.nationality?.label || "—"}
                        </div>
                      </Col>
                      <Col xs={6} md>
                        <div className="text-muted small mb-1">Adults</div>
                        <div className="fw-semibold text-dark">
                          {searchCriteria.adults || 0}
                        </div>
                      </Col>
                      <Col xs={6} md>
                        <div className="text-muted small mb-1">Children</div>
                        <div className="fw-semibold text-dark">
                          {searchCriteria.children || 0}
                        </div>
                      </Col>
                    </Row>
                    <hr className="my-3" />
                    <Row className="g-3">
                      <Col md={6}>
                        <div className="text-muted small mb-1">Route</div>
                        <div className="fw-semibold text-dark d-flex align-items-center gap-1">
                          <FaMapMarkerAlt style={{ color: "#EC0B43" }} />
                          <span>
                            {selectedOption.location || "N/A"}
                            {routeArrow}
                            {selectedOption.dropOff || "N/A"}
                          </span>
                        </div>
                      </Col>
                      <Col xs={6} md={3}>
                        <div className="text-muted small mb-1">Pickup Time</div>
                        <div className="fw-semibold text-dark d-flex align-items-center gap-1">
                          <FaClock className="text-muted" />
                          {searchCriteria.pickupTime ||
                            searchCriteria.arrivalTime ||
                            "—"}
                        </div>
                      </Col>
                      <Col xs={6} md={3}>
                        <div className="text-muted small mb-1">Drop Time</div>
                        <div className="fw-semibold text-dark d-flex align-items-center gap-1">
                          <FaClock className="text-muted" />
                          {searchCriteria.dropoffTime
                            ? `${searchCriteria.dropoffTime} (Est.)`
                            : "—"}
                        </div>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                {/* ── Passenger Details — single source of truth for
                     traveller data. The row marked "Lead" is also
                     persisted as the customer/lead-passenger record;
                     all other rows go to the guest table. */}
                {guests.length > 0 && (
                  <Card className="border rounded-3 mb-4 overflow-hidden shadow-sm">
                    <Card.Header
                      className="py-3 px-4 text-dark border-bottom"
                      style={cardHeaderStyle}
                    >
                      <span className="d-flex align-items-center">
                        <FaUsers className="me-2" style={{ color: "#EC0B43" }} />
                        <span className="fw-bold">Passenger Details</span>
                        <span className="text-muted small ms-2">
                          ({totalAdults} Adult{totalAdults !== 1 ? "s" : ""}
                          {totalChildren > 0
                            ? `, ${totalChildren} Child${
                                totalChildren !== 1 ? "ren" : ""
                              }`
                            : ""}
                          )
                        </span>
                      </span>
                      {validationErrors.lead && (
                        <small className="text-danger d-block mt-1">
                          {validationErrors.lead}
                        </small>
                      )}
                    </Card.Header>
                    <Card.Body className="px-4 pt-3 pb-3">
                      <Row className="small text-muted px-2 mb-2 d-none d-md-flex fw-semibold text-uppercase">
                        <Col md={2}>Passenger Type</Col>
                        <Col md={2}>Title</Col>
                        <Col md={2}>
                          First Name <span className="text-danger">*</span>
                        </Col>
                        <Col md={2}>
                          Last Name <span className="text-danger">*</span>
                        </Col>
                        <Col md={2}>Contact No.</Col>
                        <Col md={2} className="text-center">
                          Lead
                        </Col>
                      </Row>
                      {guests.map((g, idx) => {
                        const adultSeat = idx + 1;
                        const childSeat = idx - totalAdults + 1;
                        const label = g.isChild
                          ? `Child ${childSeat}${
                              g.age != null ? ` (Age ${g.age})` : ""
                            }`
                          : `Adult ${adultSeat}`;
                        const isLead = leadIndex === idx;
                        return (
                          <Row
                            key={idx}
                            className="g-2 align-items-center mb-2"
                          >
                            <Col xs={12} md={2}>
                              <span className="text-dark small fw-semibold">
                                {label}
                              </span>
                            </Col>
                            <Col xs={6} md={2}>
                              <Form.Select
                                size="sm"
                                value={g.salutation}
                                onChange={(e) =>
                                  handleGuestChange(
                                    idx,
                                    "salutation",
                                    e.target.value,
                                  )
                                }
                                isInvalid={
                                  !!validationErrors[`guest_${idx}_salutation`]
                                }
                              >
                                <option value="">Title</option>
                                {g.isChild ? (
                                  <>
                                    <option value="Mstr">Mstr</option>
                                    <option value="Miss">Miss</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="Mr">Mr</option>
                                    <option value="Mrs">Mrs</option>
                                    <option value="Ms">Ms</option>
                                  </>
                                )}
                              </Form.Select>
                            </Col>
                            <Col xs={6} md={2}>
                              <Form.Control
                                size="sm"
                                type="text"
                                placeholder="First Name"
                                value={g.firstName}
                                onChange={(e) =>
                                  handleGuestChange(
                                    idx,
                                    "firstName",
                                    e.target.value,
                                  )
                                }
                                isInvalid={
                                  !!validationErrors[`guest_${idx}_firstName`]
                                }
                              />
                            </Col>
                            <Col xs={6} md={2}>
                              <Form.Control
                                size="sm"
                                type="text"
                                placeholder="Last Name"
                                value={g.lastName}
                                onChange={(e) =>
                                  handleGuestChange(
                                    idx,
                                    "lastName",
                                    e.target.value,
                                  )
                                }
                                isInvalid={
                                  !!validationErrors[`guest_${idx}_lastName`]
                                }
                              />
                            </Col>
                            {/* Contact No. — captured per-passenger so the
                                operator can dispatch updates to whoever is
                                actually in the cab. The Lead row's value
                                is what flows into customerDTO.contactNumber
                                on save (existing behaviour). */}
                            <Col xs={6} md={2}>
                              <Form.Control
                                size="sm"
                                type="text"
                                placeholder="Contact No."
                                value={g.contactNumber || ""}
                                onChange={(e) =>
                                  handleGuestChange(
                                    idx,
                                    "contactNumber",
                                    e.target.value,
                                  )
                                }
                                isInvalid={
                                  !!validationErrors[`guest_${idx}_contactNumber`]
                                }
                              />
                            </Col>
                            <Col xs={6} md={2} className="text-center">
                              <Form.Check
                                type="radio"
                                name="lead-guest"
                                id={`lead-${idx}`}
                                checked={isLead}
                                disabled={g.isChild}
                                onChange={() => handleLeadSelect(idx)}
                                title={
                                  g.isChild
                                    ? "Children cannot be the lead"
                                    : "Mark as Lead passenger"
                                }
                              />
                            </Col>
                          </Row>
                        );
                      })}
                    </Card.Body>
                  </Card>
                )}

                {/* ── Pick Up Details ────────────────────────────────
                     Type-aware leg card. For AIRPORT pickups we collect
                     Arriving From / Flight No / Estimated Arrival Time
                     / Greeting Sign (the "Flight / Arrival Details" of
                     the mockup); for HOTEL pickups we display the hotel
                     name + address auto-fetched from /api/hotels/lookup;
                     for PLACE we show the place name. Hidden when no
                     pickup was selected on the search page. */}
                {searchCriteria.pickupType && (
                  <Card className="border rounded-3 mb-4 overflow-hidden shadow-sm">
                    <Card.Header
                      className="py-3 px-4 text-dark border-bottom"
                      style={cardHeaderStyle}
                    >
                      <span className="fw-bold">
                        {searchCriteria.pickupType === "AIRPORT"
                          ? "Flight / Arrival Details"
                          : "Pick Up Details"}
                        <span className="text-muted small ms-2">
                          —{" "}
                          {searchCriteria.pickupType === "AIRPORT"
                            ? "Airport"
                            : searchCriteria.pickupType === "HOTEL"
                              ? "Accommodation"
                              : "Place"}
                        </span>
                      </span>
                    </Card.Header>
                    <Card.Body className="px-4 pt-3 pb-3">
                      {searchCriteria.pickupType === "AIRPORT" && (
                        <>
                          <div className="mb-3">
                            <strong>Airport Name : </strong>
                            {searchCriteria.pickupName || "—"}
                          </div>
                          <Row className="g-3">
                            <Col md={6}>
                              <Form.Label className="small text-muted fw-semibold mb-1">
                                Arriving From
                              </Form.Label>
                              <Form.Control
                                size="sm"
                                type="text"
                                placeholder="Arriving From*"
                                value={pickupDetails.arrivingFrom}
                                onChange={(e) =>
                                  setPickupDetails((p) => ({
                                    ...p,
                                    arrivingFrom: e.target.value,
                                  }))
                                }
                              />
                            </Col>
                            <Col md={6}>
                              <Form.Label className="small text-muted fw-semibold mb-1">
                                Flight No.
                              </Form.Label>
                              <Form.Control
                                size="sm"
                                type="text"
                                placeholder="Flight No.*"
                                value={pickupDetails.flightNo}
                                onChange={(e) =>
                                  setPickupDetails((p) => ({
                                    ...p,
                                    flightNo: e.target.value,
                                  }))
                                }
                              />
                            </Col>
                            {/* Read-only — sourced from the airport master
                                (set on /master/Airport per airport) and
                                forwarded through CabSearch.jsx. Empty
                                means the master row has no value yet, so
                                we show a hint pointing the operator at
                                the right setup page. */}
                            <Col md={6}>
                              <Form.Label className="small text-muted fw-semibold mb-1">
                                Estimated Arrival Time
                              </Form.Label>
                              <Form.Control
                                size="sm"
                                type="text"
                                value={
                                  searchCriteria.pickupEstimatedArrivalTime || ""
                                }
                                placeholder="Configure on the airport master"
                                readOnly
                                disabled
                              />
                            </Col>
                            <Col md={6}>
                              <Form.Label className="small text-muted fw-semibold mb-1">
                                Greeting Sign
                              </Form.Label>
                              <Form.Control
                                size="sm"
                                type="text"
                                placeholder="Name on the greeting sign"
                                value={pickupDetails.greetingSign}
                                onChange={(e) =>
                                  setPickupDetails((p) => ({
                                    ...p,
                                    greetingSign: e.target.value,
                                  }))
                                }
                              />
                            </Col>
                          </Row>
                          <div className="small text-muted mt-3">
                            <strong>Note:</strong> Driver will call you before
                            the ride. The driver will contact you in advance and
                            we will send you their contact number via SMS. We
                            will put the sign in the front of the bus, so you
                            could easily identify it. Please note that on group
                            trips, drivers do not meet you in the arrivals hall,
                            but wait for a signal from the group leader that
                            they are ready to board.
                          </div>
                        </>
                      )}
                      {searchCriteria.pickupType === "HOTEL" && (
                        <>
                          <div className="mb-2">
                            <strong>Hotel Name : </strong>
                            {searchCriteria.pickupName || "—"}
                          </div>
                          <div>
                            <div className="small text-muted fw-semibold">
                              Hotel Address
                            </div>
                            <div>{pickupHotelAddress || "—"}</div>
                          </div>
                        </>
                      )}
                      {searchCriteria.pickupType === "PLACE" && (
                        <div>
                          <strong>Place : </strong>
                          {searchCriteria.pickupName || "—"}
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                )}

                {/* ── Drop Off Details ───────────────────────────────
                     Same pattern as Pick Up but for the drop leg. For
                     AIRPORT drops we collect Departing To / Flight No /
                     Terminal / Departure Time; for HOTEL drops we
                     display the hotel name + auto-fetched address. */}
                {searchCriteria.dropoffType && (
                  <Card className="border rounded-3 mb-4 overflow-hidden shadow-sm">
                    <Card.Header
                      className="py-3 px-4 text-dark border-bottom"
                      style={cardHeaderStyle}
                    >
                      <span className="fw-bold">
                        Drop Off Details
                        <span className="text-muted small ms-2">
                          —{" "}
                          {searchCriteria.dropoffType === "AIRPORT"
                            ? "Airport"
                            : searchCriteria.dropoffType === "HOTEL"
                              ? "Accommodation"
                              : "Place"}
                        </span>
                      </span>
                    </Card.Header>
                    <Card.Body className="px-4 pt-3 pb-3">
                      {searchCriteria.dropoffType === "AIRPORT" && (
                        <>
                          <div className="mb-3">
                            <strong>Airport Name : </strong>
                            {searchCriteria.dropoffName || "—"}
                          </div>
                          <Row className="g-3">
                            <Col md={6}>
                              <Form.Label className="small text-muted fw-semibold mb-1">
                                Departing To
                              </Form.Label>
                              <Form.Control
                                size="sm"
                                type="text"
                                placeholder="Departing To"
                                value={dropoffDetails.departingTo}
                                onChange={(e) =>
                                  setDropoffDetails((p) => ({
                                    ...p,
                                    departingTo: e.target.value,
                                  }))
                                }
                              />
                            </Col>
                            <Col md={6}>
                              <Form.Label className="small text-muted fw-semibold mb-1">
                                Flight No.
                              </Form.Label>
                              <Form.Control
                                size="sm"
                                type="text"
                                placeholder="Flight No."
                                value={dropoffDetails.flightNo}
                                onChange={(e) =>
                                  setDropoffDetails((p) => ({
                                    ...p,
                                    flightNo: e.target.value,
                                  }))
                                }
                              />
                            </Col>
                            <Col md={6}>
                              <Form.Label className="small text-muted fw-semibold mb-1">
                                Select Terminal
                              </Form.Label>
                              <Form.Control
                                size="sm"
                                type="text"
                                placeholder="e.g. Terminal 3"
                                value={dropoffDetails.terminal}
                                onChange={(e) =>
                                  setDropoffDetails((p) => ({
                                    ...p,
                                    terminal: e.target.value,
                                  }))
                                }
                              />
                            </Col>
                            <Col md={6}>
                              <Form.Label className="small text-muted fw-semibold mb-1">
                                Departure Time
                              </Form.Label>
                              <Form.Control
                                size="sm"
                                type="text"
                                placeholder="e.g. 07 Hrs 00 Min"
                                value={dropoffDetails.departureTime}
                                onChange={(e) =>
                                  setDropoffDetails((p) => ({
                                    ...p,
                                    departureTime: e.target.value,
                                  }))
                                }
                              />
                            </Col>
                          </Row>
                        </>
                      )}
                      {searchCriteria.dropoffType === "HOTEL" && (
                        <>
                          <div className="mb-2">
                            <strong>Hotel Name : </strong>
                            {searchCriteria.dropoffName || "—"}
                          </div>
                          <div>
                            <div className="small text-muted fw-semibold">
                              Hotel Address
                            </div>
                            <div>{dropoffHotelAddress || "—"}</div>
                          </div>
                        </>
                      )}
                      {searchCriteria.dropoffType === "PLACE" && (
                        <div>
                          <strong>Place : </strong>
                          {searchCriteria.dropoffName || "—"}
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                )}

                {/* ── Special Requirements — free text persisted to the
                     cab booking's specialRequirements field. */}
                <Card className="border rounded-3 mb-4 overflow-hidden shadow-sm">
                  <Card.Header
                    className="py-3 px-4 text-dark border-bottom"
                    style={cardHeaderStyle}
                  >
                    <span className="fw-bold">Special Requirements</span>
                    <span className="text-muted small ms-2">(Optional)</span>
                  </Card.Header>
                  <Card.Body className="px-4 pt-3 pb-3">
                    <div className="position-relative">
                      <Form.Control
                        as="textarea"
                        rows={2}
                        maxLength={200}
                        placeholder="e.g. Baby seat, Wheelchair, Extra luggage…"
                        value={specialRequirements}
                        onChange={(e) => setSpecialRequirements(e.target.value)}
                      />
                      <span
                        className="text-muted small position-absolute"
                        style={{ right: 10, bottom: 6 }}
                      >
                        {specialRequirements.length}/200
                      </span>
                    </div>
                  </Card.Body>
                </Card>

                {/* ── Contact Details — lead passenger's email + phone.
                     Email flows to sendEmailTo (voucher recipient); phone
                     is the same value as the Lead row's Contact No. */}
                <Card className="border rounded-3 mb-4 overflow-hidden shadow-sm">
                  <Card.Header
                    className="py-3 px-4 text-dark border-bottom"
                    style={cardHeaderStyle}
                  >
                    <span className="fw-bold">Contact Details</span>
                  </Card.Header>
                  <Card.Body className="px-4 pt-3 pb-3">
                    <Row className="g-3">
                      <Col md={6}>
                        <Form.Label className="small text-muted fw-semibold mb-1">
                          Email <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          size="sm"
                          type="email"
                          placeholder="name@example.com"
                          value={leadGuest.emailId || ""}
                          onChange={(e) =>
                            handleGuestChange(leadIndex, "emailId", e.target.value)
                          }
                          isInvalid={
                            !!validationErrors[`guest_${leadIndex}_emailId`]
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors[`guest_${leadIndex}_emailId`]}
                        </Form.Control.Feedback>
                      </Col>
                      <Col md={6}>
                        <Form.Label className="small text-muted fw-semibold mb-1">
                          Phone <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          size="sm"
                          type="text"
                          placeholder="+971 50 123 4567"
                          value={leadGuest.contactNumber || ""}
                          onChange={(e) =>
                            handleGuestChange(
                              leadIndex,
                              "contactNumber",
                              e.target.value,
                            )
                          }
                          isInvalid={
                            !!validationErrors[`guest_${leadIndex}_contactNumber`]
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors[`guest_${leadIndex}_contactNumber`]}
                        </Form.Control.Feedback>
                      </Col>
                    </Row>
                    <div className="text-muted small mt-2">
                      The voucher and booking updates are sent to the lead
                      passenger&apos;s email.
                    </div>
                  </Card.Body>
                </Card>

                {/* ── HQ amount — operator-side Adjustment Amt persisted
                     to cab booking's adjustmentAmount column. The value
                     rolls into the Total on the right-hand Price Details
                     card. */}
                <Card className="border rounded-3 mb-4 overflow-hidden shadow-sm">
                  <Card.Header
                    className="py-3 px-4 text-dark border-bottom"
                    style={cardHeaderStyle}
                  >
                    <span className="fw-bold">HQ Amount</span>
                  </Card.Header>
                  <Card.Body className="px-4 pt-3 pb-3">
                    <Row className="g-3 align-items-center">
                      <Col md={4}>
                        <Form.Label className="small text-muted fw-semibold mb-1">
                          HQ amount
                        </Form.Label>
                        <Form.Control
                          size="sm"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={hqAmount}
                          onChange={(e) => setHqAmount(e.target.value)}
                        />
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                {/* ── Important note banner */}
                <div
                  className="d-flex align-items-start gap-2 p-3 mb-4 rounded-3"
                  style={{ background: "#FFF8E1", border: "1px solid #FFECB3" }}
                >
                  <FaInfoCircle className="mt-1" style={{ color: "#B7791F" }} />
                  <div className="small text-dark">
                    <strong>Important Note:</strong> Please arrive at the pickup
                    point 10 minutes before the scheduled time.
                  </div>
                </div>

                {/* ── Footer — Cancellation Policy + Need Help */}
                <Row className="g-4">
                  <Col md={7}>
                    <Card className="border rounded-3 h-100 shadow-sm">
                      <Card.Body className="p-4">
                        <h6 className="fw-bold mb-3">Cancellation Policy</h6>
                        {cabPolicies.cancellations.length > 0 ? (
                          <ul className="mb-0 ps-3 small text-dark">
                            {cabPolicies.cancellations.map((c, i) => (
                              <li key={`cxl-${i}`} className="mb-1">
                                {c}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-muted small">
                            The cancellation policy for this transfer will be
                            confirmed with your booking.
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={5}>
                    <Card className="border rounded-3 h-100 shadow-sm">
                      <Card.Body className="p-4">
                        <h6 className="fw-bold mb-3">Need Help?</h6>
                        <div className="d-flex align-items-start gap-2">
                          <FaHeadset
                            className="mt-1"
                            style={{ color: "#EC0B43" }}
                          />
                          <div className="small">
                            <div className="fw-semibold text-dark">
                              24/7 Customer Support
                            </div>
                            <div className="text-muted">
                              Contact your account manager for help with this
                              booking.
                            </div>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Col>

              {/* ── Right sticky column — Price / Vehicle / Payment /
                   Terms + Confirm action. */}
              <Col lg={4} className="hbp-right-col">
                <div className="hbp-sticky-summary">
                  {/* Price Details */}
                  <Card className="rounded-3 border hbp-price-card shadow-sm">
                    <Card.Header
                      className="py-3 text-dark border-bottom fw-bold"
                      style={cardHeaderStyle}
                    >
                      Price Details
                    </Card.Header>
                    <Card.Body className="p-3">
                      {(() => {
                        const tdNum =
                          tourismDirham !== "" && !isNaN(Number(tourismDirham))
                            ? Number(tourismDirham)
                            : 0;
                        const hqNum =
                          hqAmount !== "" && !isNaN(Number(hqAmount))
                            ? Number(hqAmount)
                            : 0;
                        const grandTotal =
                          Number(totalRate || 0) + tdNum + hqNum;
                        return (
                          <>
                            <div className="hbp-summary-row">
                              <div className="hbp-summary-label text-muted">
                                Selling Price
                              </div>
                              <div className="hbp-summary-value">
                                {formatPrice(totalRate)}
                              </div>
                            </div>
                            <div className="hbp-summary-row">
                              <div className="hbp-summary-label text-muted">
                                Tourism Dirhams
                              </div>
                              <div className="hbp-summary-value">
                                {formatPrice(tdNum)}
                              </div>
                            </div>
                            {hqNum > 0 && (
                              <div className="hbp-summary-row">
                                <div className="hbp-summary-label text-muted">
                                  HQ Amount
                                </div>
                                <div className="hbp-summary-value">
                                  {formatPrice(hqNum)}
                                </div>
                              </div>
                            )}
                            <hr className="my-2" />
                            <div className="hbp-summary-row">
                              <div className="hbp-summary-label fw-bold text-dark">
                                Total
                              </div>
                              <div
                                className="fw-bold"
                                style={{ color: "#EC0B43", fontSize: "1.1rem" }}
                              >
                                {formatPrice(grandTotal)}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </Card.Body>
                  </Card>

                  {/* Vehicle Details */}
                  <Card className="rounded-3 border shadow-sm mt-3">
                    <Card.Header
                      className="py-3 d-flex justify-content-between align-items-center text-dark border-bottom"
                      style={cardHeaderStyle}
                    >
                      <span className="fw-bold">Vehicle Details</span>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="d-flex align-items-center gap-1"
                        onClick={() => navigate("/new-booking/cab")}
                      >
                        <FaEdit /> Change
                      </Button>
                    </Card.Header>
                    <Card.Body className="p-3">
                      <div className="d-flex gap-3">
                        {cab.cabpic ? (
                          <img
                            src={cab.cabpic}
                            alt={cab.cabname}
                            style={{
                              width: 96,
                              height: 68,
                              objectFit: "cover",
                              borderRadius: 8,
                              flexShrink: 0,
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 96,
                              height: 68,
                              borderRadius: 8,
                              background: "#f1f3f5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <FaCar style={{ color: "#adb5bd", fontSize: 24 }} />
                          </div>
                        )}
                        <div className="flex-grow-1">
                          <div className="fw-bold text-dark">{cab.cabname}</div>
                          <div className="d-flex flex-wrap gap-3 mt-1 text-muted small">
                            {cab.capacityMax != null && (
                              <span className="d-flex align-items-center gap-1">
                                <FaUsers /> {cab.capacityMax} Seats
                              </span>
                            )}
                            <span className="d-flex align-items-center gap-1">
                              <FaCar /> {selectedOption.types}
                            </span>
                          </div>
                          {cab.cabProviderName && (
                            <div className="text-muted small mt-1">
                              {cab.cabProviderName}
                            </div>
                          )}
                        </div>
                      </div>
                      {cab.cabdetails && (
                        <div className="text-muted small mt-2">
                          {cab.cabdetails}
                        </div>
                      )}
                    </Card.Body>
                  </Card>

                  {/* Payment Method — dropdown mirroring the package
                       booking's "Mode of payment" (same options + the
                       credit-based default seeded above). Only "Agent
                       credit limit" deducts the wallet; the rest settle
                       out-of-band. */}
                  <Card className="rounded-3 border shadow-sm mt-3">
                    <Card.Header
                      className="py-3 text-dark border-bottom fw-bold d-flex align-items-center"
                      style={cardHeaderStyle}
                    >
                      <FaCreditCard className="me-2" style={{ color: "#EC0B43" }} />
                      Payment Method
                      <span className="text-danger ms-2">*</span>
                    </Card.Header>
                    <Card.Body className="p-3">
                      <Form.Select
                        aria-label="Payment Method"
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                      >
                        <option value="">Select payment mode</option>
                        {PAYMENT_MODES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </Form.Select>
                      {paymentMode && paymentMode !== "CREDIT" && (
                        <div className="small text-muted mt-2">
                          Settled via {paymentModeLabel(paymentMode)} — the agent
                          wallet will not be charged for this booking.
                        </div>
                      )}
                    </Card.Body>
                  </Card>

                  {/* Terms acceptance — links open the policy detail modal. */}
                  <div className="mt-3 px-1">
                    <Form.Check
                      type="checkbox"
                      id="cab-accept-terms"
                      checked={acceptedPolicies}
                      onChange={(e) => setAcceptedPolicies(e.target.checked)}
                      label={
                        <span className="small">
                          I have read and agree to the{" "}
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowPolicyModal(true);
                            }}
                            style={{
                              color: "#EC0B43",
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            Terms &amp; Conditions
                          </span>{" "}
                          and{" "}
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowPolicyModal(true);
                            }}
                            style={{
                              color: "#EC0B43",
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            Cancellation Policy
                          </span>
                          .
                        </span>
                      }
                    />
                  </div>

                  <div className="hbp-action-bar mt-3 d-flex gap-2">
                    <Button
                      variant="outline-secondary"
                      onClick={() => navigate(-1)}
                      className="flex-grow-1"
                      disabled={isSubmitting}
                    >
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      type="button"
                      onClick={handleConfirmClick}
                      disabled={isSubmitting}
                      className="flex-grow-1"
                    >
                      {isSubmitting ? (
                        <>
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FaCheckCircle className="me-1" />
                          Confirm Booking
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Col>
            </Row>
          </Container>
        </main>
      </div>

      {/* ── Transfer Policies & Terms modal — opened from the inline
           Terms & Conditions / Cancellation Policy links. Informational:
           accepting here also ticks the page-level acceptance checkbox. */}
      <Modal
        show={showPolicyModal}
        onHide={() => setShowPolicyModal(false)}
        dialogClassName="policy-modal"
        centered
      >
        <Modal.Header closeButton className="policy-modal-header">
          <Modal.Title className="policy-modal-title">
            Transfer Policies &amp; Terms
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="policy-modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
          {policyLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3 text-muted">Loading policies...</p>
            </div>
          ) : (
            <>
              <section className="policy-section">
                <h6 className="policy-section-title">Terms &amp; Conditions</h6>
                {cabPolicies.terms.length > 0 ? (
                  cabPolicies.terms.map((item, idx) => (
                    <div key={`cab-term-${idx}`} className="policy-item">
                      <div className="policy-text">{item}</div>
                    </div>
                  ))
                ) : (
                  <div className="policy-empty">No terms and conditions configured for this cab rate.</div>
                )}
              </section>

              <section className="policy-section policy-section-last">
                <h6 className="policy-section-title">Cancellation Policy</h6>
                {cabPolicies.cancellations.length > 0 ? (
                  cabPolicies.cancellations.map((item, idx) => (
                    <div key={`cab-cancellation-${idx}`} className="policy-item">
                      <div className="policy-text">{item}</div>
                    </div>
                  ))
                ) : (
                  <div className="policy-empty">No cancellation policy configured for this cab rate.</div>
                )}
              </section>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="policy-modal-footer">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setShowPolicyModal(false)}
          >
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={policyLoading}
            onClick={() => {
              setAcceptedPolicies(true);
              setShowPolicyModal(false);
            }}
          >
            I Agree
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showSummaryModal}
        onHide={() => !isSubmitting && setShowSummaryModal(false)}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton={!isSubmitting}>
          <Modal.Title>
            <FaCar className="me-2 text-primary" />
            Order Summary — please review
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Vehicle */}
          <Row className="mb-3">
            <Col md={2}>
              <img
                src={cab.cabpic || "https://via.placeholder.com/80?text=Cab"}
                alt={cab.cabname}
                style={{ width: "100%", height: 70, objectFit: "cover", borderRadius: 8 }}
              />
            </Col>
            <Col md={10}>
              <h6 className="fw-bold mb-1">{cab.cabname}</h6>
              <Badge bg={selectedOption?.types === "Private" ? "success" : "info"}>
                {selectedOption?.types}
              </Badge>
              {cab.cabdetails && (
                <div className="text-muted small mt-1">{cab.cabdetails}</div>
              )}
            </Col>
          </Row>

          <hr />

          {/* Trip */}
          <h6 className="fw-bold mb-2">Trip</h6>
          <Row className="mb-3">
            <Col md={4}>
              <small className="text-muted d-block">Pickup Date</small>
              <span>{searchCriteria.pickupDate || "—"}</span>
            </Col>
            <Col md={4}>
              <small className="text-muted d-block">Dropoff Date</small>
              <span>{searchCriteria.dropoffDate || searchCriteria.pickupDate || "—"}</span>
            </Col>
            <Col md={4}>
              <small className="text-muted d-block">Route</small>
              <span>
                {selectedOption?.location || "N/A"} → {selectedOption?.dropOff || "N/A"}
              </span>
            </Col>
          </Row>

          {/* Pickup / Dropoff details — only shown when chosen upstream */}
          {(searchCriteria.pickupType || searchCriteria.dropoffType) && (
            <>
              <h6 className="fw-bold mb-2">Pickup &amp; Dropoff</h6>
              <Table responsive size="sm" bordered className="mb-3">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "20%" }}></th>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {searchCriteria.pickupType && (
                    <tr>
                      <td className="fw-semibold">Pickup</td>
                      <td>
                        <Badge bg="success-subtle" text="success">
                          {searchCriteria.pickupType}
                        </Badge>
                      </td>
                      <td>{searchCriteria.pickupName || "—"}</td>
                      <td>
                        {searchCriteria.pickupType === "AIRPORT" && searchCriteria.pickupTime
                          ? searchCriteria.pickupTime
                          : "—"}
                      </td>
                    </tr>
                  )}
                  {searchCriteria.dropoffType && (
                    <tr>
                      <td className="fw-semibold">Dropoff</td>
                      <td>
                        <Badge bg="warning-subtle" text="warning">
                          {searchCriteria.dropoffType}
                        </Badge>
                      </td>
                      <td>{searchCriteria.dropoffName || "—"}</td>
                      <td>{searchCriteria.dropoffTime || "—"}</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </>
          )}

          {/* Passengers */}
          <h6 className="fw-bold mb-2">Passengers</h6>
          <Row className="mb-3">
            <Col md={6}>
              <small className="text-muted d-block">Adults</small>
              <span>{searchCriteria.adults || 0}</span>
            </Col>
            <Col md={6}>
              <small className="text-muted d-block">Children</small>
              <span>{searchCriteria.children || 0}</span>
            </Col>
          </Row>

          <hr />

          {/* Pax manifest in the order summary so the operator can
              double-check every traveller before confirming. */}
          {guests.length > 0 && (
            <>
              <h6 className="fw-bold mb-2">Passengers ({guests.length})</h6>
              <Table responsive size="sm" bordered className="mb-3">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Name</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((g, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>
                        {g.isChild
                          ? `Child${g.age != null ? ` (${g.age})` : ""}`
                          : "Adult"}
                      </td>
                      <td>
                        {[g.salutation, g.firstName, g.lastName]
                          .filter(Boolean).join(" ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}

          {/* Primary guest */}
          <h6 className="fw-bold mb-2">Primary Guest</h6>
          <Row className="mb-3">
            <Col md={6}>
              <small className="text-muted d-block">Name</small>
              <span>
                {[primaryGuest.salutation, primaryGuest.firstName, primaryGuest.lastName]
                  .filter(Boolean).join(" ") || "—"}
              </span>
            </Col>
            <Col md={3}>
              <small className="text-muted d-block">Phone</small>
              <span>{primaryGuest.contactNumber || "—"}</span>
            </Col>
            <Col md={3}>
              <small className="text-muted d-block">LPO</small>
              <span>{primaryGuest.lpo || "—"}</span>
            </Col>
            <Col md={6} className="mt-2">
              <small className="text-muted d-block">Email</small>
              <span>{primaryGuest.emailId || "—"}</span>
            </Col>
          </Row>

          {/* Settlement mode + special requirements */}
          <Row className="mb-3">
            <Col md={6}>
              <small className="text-muted d-block">Payment Method</small>
              <span>
                {paymentModeLabel(pendingPayload?.paymentMode || paymentMode)}
              </span>
            </Col>
            {specialRequirements.trim() && (
              <Col md={6}>
                <small className="text-muted d-block">Special Requirements</small>
                <span>{specialRequirements.trim()}</span>
              </Col>
            )}
          </Row>

          <hr />

          {/* Pricing breakdown — selling, total, optional TD + HQ, grand
              total. HQ Amount must roll into the Grand Total so the modal
              matches the right-hand Price Details card + the saved amount. */}
          {(() => {
            const tdNum =
              tourismDirham !== "" && !isNaN(Number(tourismDirham))
                ? Number(tourismDirham)
                : 0;
            const hqNum =
              hqAmount !== "" && !isNaN(Number(hqAmount))
                ? Number(hqAmount)
                : 0;
            const sellingBase = Number(prices.sellingPrice) || 0;
            const totalBase = Number(prices.totalPrice) || 0;
            const grand = totalBase + tdNum + hqNum;
            return (
              <div className="p-3 bg-light rounded">
                <div className="d-flex justify-content-between mb-2 text-muted">
                  <span>Selling Price</span>
                  <span className="fw-medium">
                    AED {sellingBase.toFixed(2)}
                  </span>
                </div>
                <div className="d-flex justify-content-between mb-2 text-muted">
                  <span>Total Price</span>
                  <span className="fw-medium">
                    AED {totalBase.toFixed(2)}
                  </span>
                </div>
                {tdNum > 0 && (
                  <div className="d-flex justify-content-between mb-2 text-primary">
                    <span>Tourism Dirham</span>
                    <span className="fw-medium">+ AED {tdNum.toFixed(2)}</span>
                  </div>
                )}
                {hqNum > 0 && (
                  <div className="d-flex justify-content-between mb-2 text-primary">
                    <span>HQ Amount</span>
                    <span className="fw-medium">+ AED {hqNum.toFixed(2)}</span>
                  </div>
                )}
                <hr className="my-2" />
                <div className="d-flex justify-content-between align-items-center">
                  <span className="fw-semibold">Grand Total</span>
                  <span className="fs-4 fw-bold text-success">
                    AED {grand.toFixed(2)}
                  </span>
                </div>
                <small className="text-muted d-block mt-1">
                  This is the amount that will be saved against the booking.
                </small>
              </div>
            );
          })()}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowSummaryModal(false)}
            disabled={isSubmitting}
          >
            Edit Details
          </Button>
          <Button
            variant="success"
            onClick={submitBooking}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Booking…
              </>
            ) : (
              <>
                <FaCheckCircle className="me-2" />
                Confirm &amp; Book
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CabBookingPage;
