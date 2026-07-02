import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Form,
  Button,
  Row,
  Col,
  Spinner,
  Badge,
  Modal,
  Accordion,
} from "react-bootstrap";
import {
  FaHotel,
  FaCalendarAlt,
  FaUsers,
  FaUtensils,
  FaCheckCircle,
} from "react-icons/fa";
import axiosInstance from "../../components/AxiosInstance";
import { createAmendmentLink } from "../../utils/amendmentLink";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import AgentBalanceDisplay from "../../components/AgentBalanceDisplay";
import { toast } from "react-hot-toast";
import { toLocalDateTime, formatDateTime } from "../../utils/dateUtils";
// Reuse the hotel-booking-page styles so the long-stay page renders
// with the same shell, summary cards, and Policies & Terms modal as
// /booking/hotel.
import "../../styles/HotelBookingPage.css";

// Pretty-print the structured cancellation policy chargeType + value
// rendered on the booking page. Mirrors the dropdown labels used in
// the contract create/edit table editor.
const formatChargeType = (t) => {
  switch ((t || "").toUpperCase()) {
    case "PERCENT": return "%";
    case "AMOUNT": return "Amount (AED)";
    case "FULL_STAY": return "Full Stay";
    case "NIGHTS": return "Nights";
    default: return t || "—";
  }
};
const formatChargeValue = (p) => {
  if (p == null || p.value == null) return "—";
  const t = (p.chargeType || "").toUpperCase();
  if (t === "PERCENT") return `${p.value}%`;
  if (t === "AMOUNT") return `AED ${p.value}`;
  if (t === "NIGHTS") return `${p.value} night${p.value === 1 ? "" : "s"}`;
  return String(p.value);
};

// Render one cancellation-policy row as a natural-language line —
// matches the plain-text rendering used by /booking/hotel's policy
// modal (e.g. "10% cancelled within 30 days", "Full Stay (100) no-show").
const formatCancellationPolicyLine = (p) => {
  if (!p) return "";
  const value = formatChargeValue(p);
  const cond = (p.condition || "").trim();
  return cond ? `${value} ${cond}` : value;
};

export default function LongStayBookingPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState("");
  const [rooms, setRooms] = useState([]);
  const [primaryGuest, setPrimaryGuest] = useState({
    salutation: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    passportNo: "",
    nationality: "",
    gender: "",
  });
  // ── Lead passenger marker — { roomIdx, guestIdx } pointing at the
  //    single guest the user has flagged as Lead. Mirrors the gov /
  //    SC / Student / Hotel / LastMinute booking pages. Defaults to
  //    the first guest (room 0, guest 0) so the column always has
  //    one selection on first render. Children can't be Lead. The
  //    Lead-marked guest drives the submitted `primaryGuestName /
  //    Details` (replacing the hidden Lead Passenger card).
  const [leadIndex, setLeadIndex] = useState({ roomIdx: 0, guestIdx: 0 });

  const handleLeadSelect = (roomIdx, guestIdx) => {
    const g = rooms?.[roomIdx]?.guests?.[guestIdx];
    if (g?.isChild) return;
    setLeadIndex({ roomIdx, guestIdx });
  };

  const [remarks, setRemarks] = useState("");
  const [tourismDirham, setTourismDirham] = useState("");
  // Payment mode — mirrors the selector on /hotel-booking-page. Display-only;
  // default CREDITLIMIT keeps the legacy behaviour (credit debit happens
  // regardless of the chosen mode).
  const [paymentMode, setPaymentMode] = useState("CREDITLIMIT");

  // ── Voucher-choice + booking-flow status (mirrors HotelBookingPage) ──
  // Refundable rate + a cancellation policy on the contract → surface the
  // "Book Now & Voucher Now" / "Book Now & Voucher Later" choice above the
  // Confirm Booking button. Non-refundable rates and rates with no policy
  // skip the choice and are treated as "voucher now" → RECONFIRMED.
  const [bookingConfirmation, setBookingConfirmation] = useState("Book & Voucher");
  const [voucherChoiceMade, setVoucherChoiceMade] = useState(false);
  const [voucherChoiceError, setVoucherChoiceError] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // Pre-confirmation Policies & Terms modal — mirrors
  // HotelBookingPage's flow: Confirm Booking → policy modal → accept
  // → summary modal → final Confirm.
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("longStayBookingDraft");
    if (!raw) {
      toast.error("No booking draft — please search again");
      navigate("/new-booking/long-stay", { replace: true });
      return;
    }
    const parsed = JSON.parse(raw);
    setDraft(parsed);
    if (parsed.agentId) setAgentId(String(parsed.agentId));
    if (parsed.nationality) {
      setPrimaryGuest((g) => ({ ...g, nationality: parsed.nationality }));
    }

    // Initialize rooms with guests array based on search criteria
    const initialRooms = (parsed.rooms || [{ adults: 1, children: 0, childAges: [] }]).map(
      (room) => ({
        adults: room.adults || 1,
        children: room.children || 0,
        childAges: room.childAges || [],
        guests: Array.from(
          { length: (room.adults || 1) + (room.children || 0) },
          (_, i) => ({
            salutation: "",
            firstName: "",
            lastName: "",
            gender: "",
            isChild: i >= (room.adults || 1),
          })
        ),
      })
    );
    setRooms(initialRooms);

    axiosInstance
      .get("/api/agent?activeOnly=true")
      .then((res) => setAgents(res.data || []))
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    if (!draft) return;
    const fetchQuote = async () => {
      try {
        setQuoteError(null);
        // Send the party size so the backend can add extra-adult and
        // child charges. Each room's adults/children count maps 1:1
        // to LongStayRoomGuestsDTO on the backend, which is what
        // LongStayBookingService#countExtras reads.
        const partyRooms = (rooms || []).map((r) => ({
          adults: Number(r.adults) || 0,
          children: Number(r.children) || 0,
          childAges: r.childAges || [],
        }));
        const res = await axiosInstance.post("/api/longStayBooking/quote", {
          hotelId: draft.hotelId,
          longStayRoomId: draft.room.longStayRoomId,
          // agentId lets the backend apply this agent's configured
          // markup (PERCENT or AMOUNT) on top of the room rate —
          // mirrors the hotel booking flow.
          agentId: agentId ? Number(agentId) : draft.agentId || null,
          checkInDate: toLocalDateTime(draft.checkIn),
          checkOutDate: toLocalDateTime(draft.checkOut),
          rooms: partyRooms,
        });
        setQuote(res.data);
      } catch (err) {
        const msg = err.response?.data?.message || err.message || "Could not compute quote";
        setQuoteError(msg);
        setQuote(null);
      }
    };
    fetchQuote();
  }, [draft, rooms, agentId]);

  // ────────────────────────────────────────────────────────────────
  // Booking-flow derivation — mirrors HotelBookingPage's confirm-booking
  // flowchart. Long-stay data model doesn't carry a maxCancellationNights
  // number, so the cancellation deadline is derived from the contract's
  // structured cancellationPolicy tiers: if any policy row is configured
  // for the contract, we treat the check-in date as the free-cancellation
  // cutoff (any earlier tiered rules already inform the operator via the
  // Policies modal). Non-refundable rooms and rooms whose contract has no
  // policy tiers skip the choice entirely and resolve to RECONFIRMED —
  // exactly like the hotel flow's "no deadline applies" branch.
  // ────────────────────────────────────────────────────────────────
  const isRefundableRate = draft?.room?.refundable === true;
  const hasCancellationPolicy = Array.isArray(
    draft?.contract?.cancellationPolicy,
  ) && draft.contract.cancellationPolicy.length > 0;
  const cancellationDeadline = (() => {
    if (!isRefundableRate || !hasCancellationPolicy) return null;
    const cinRaw = draft?.checkIn;
    if (!cinRaw) return null;
    const cin = new Date(cinRaw);
    if (isNaN(cin.getTime())) return null;
    const deadline = new Date(cin);
    deadline.setHours(0, 0, 0, 0);
    return deadline;
  })();
  const isOutsideDeadline = (() => {
    if (!cancellationDeadline) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today > cancellationDeadline;
  })();
  // Only shown for Refundable rates whose deadline hasn't passed.
  // Non-refundable / past-deadline skip the choice.
  const showVoucherChoice =
    isRefundableRate && !!cancellationDeadline && !isOutsideDeadline;
  // Resolved status that will travel to the backend on
  // payload.bookingFlowStatus. Same rules as HotelBookingPage:
  //   • Non-refundable       → RECONFIRMED
  //   • Deadline already past → RECONFIRMED (force Voucher Now)
  //   • Within deadline       → respect the radio pick
  //       - "Book Now & Voucher later" → CONFIRMED
  //       - otherwise                  → RECONFIRMED
  const resolvedBookingFlowStatus = (() => {
    if (!isRefundableRate) return "RECONFIRMED";
    if (isOutsideDeadline) return "RECONFIRMED";
    return bookingConfirmation === "Book Now & Voucher later"
      ? "CONFIRMED"
      : "RECONFIRMED";
  })();
  // Reset bookingConfirmation to the default whenever "Voucher Later" no
  // longer applies (non-refundable draft, or we've crossed the deadline).
  // Same guard as HotelBookingPage so a stale pick can't leak into the
  // create payload.
  useEffect(() => {
    if (!draft) return;
    if (!showVoucherChoice && bookingConfirmation !== "Book & Voucher") {
      setBookingConfirmation("Book & Voucher");
    }
    if (!showVoucherChoice && voucherChoiceMade) {
      setVoucherChoiceMade(false);
      setVoucherChoiceError(false);
    }
  }, [draft, bookingConfirmation, showVoucherChoice, voucherChoiceMade]);

  const handleGuestChange = (rIdx, gIdx, field, value) => {
    setRooms((prev) => {
      const updated = [...prev];
      updated[rIdx] = {
        ...updated[rIdx],
        guests: updated[rIdx].guests.map((g, i) =>
          i === gIdx ? { ...g, [field]: value } : g
        ),
      };
      return updated;
    });
    if (rIdx === 0 && gIdx === 0 && ["salutation", "firstName", "lastName", "gender"].includes(field)) {
      setPrimaryGuest((p) => ({ ...p, [field]: value }));
    }
    const key = `r${rIdx}_g${gIdx}_${field}`;
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handlePrimaryGuestChange = (field, value) => {
    setPrimaryGuest((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = () => {
    const e = {};
    // Lead Passenger / Primary Guest validation removed — the card
    // has been hidden. The Guest Details grid above is the single
    // source of customer details; the submit payload derives the
    // primary-guest fields from Room 1 / Guest 1 at build time.
    rooms.forEach((room, rIdx) => {
      room.guests.forEach((g, gIdx) => {
        if (!g.salutation) e[`r${rIdx}_g${gIdx}_salutation`] = "Required";
        if (!g.firstName?.trim()) e[`r${rIdx}_g${gIdx}_firstName`] = "Required";
        if (!g.lastName?.trim()) e[`r${rIdx}_g${gIdx}_lastName`] = "Required";
      });
    });
    return e;
  };

  const handleBook = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    if (!quote || quoteError) {
      toast.error("Price quote not ready — please wait or retry");
      return;
    }
    // Voucher-choice gate — mirrors HotelBookingPage. When the Voucher
    // Now / Later choice is shown, the user must pick one explicitly
    // before we can proceed to the policies / confirm modal.
    if (showVoucherChoice && !voucherChoiceMade) {
      setVoucherChoiceError(true);
      toast.error("Please select a booking option to continue.");
      return;
    }
    // If the contract has any cancellation rules / notes / T&C, gate
    // the booking summary behind the Policies & Terms modal. If
    // nothing is configured (legacy contracts), skip straight to the
    // confirmation modal so the agent flow doesn't change for them.
    const hasPolicy =
      (draft?.contract?.cancellationPolicy || []).length > 0 ||
      !!draft?.contract?.cancellationPolicyNotes ||
      (draft?.contract?.termsAndConditions || []).length > 0;
    if (hasPolicy) {
      setPolicyAccepted(false);
      setShowPolicyModal(true);
    } else {
      setShowConfirmModal(true);
    }
  };

  const confirmBooking = async () => {
    try {
      setSubmitting(true);
      // Lead Passenger card is hidden — derive primary-guest fields
      // from the Lead-marked guest in the Guest Details grid
      // (defaults to Room 1 / Guest 1 if the user hasn't moved the
      // radio). Email / phone / passportNo / nationality are no
      // longer collected on the form and are sent as empty strings
      // (or null on optional fields). The backend ignores empty
      // optional values so the /api/longStayBooking/create contract
      // stays intact.
      const leadGuest =
        rooms?.[leadIndex.roomIdx]?.guests?.[leadIndex.guestIdx] || {};
      const fullName = [
        leadGuest.salutation,
        leadGuest.firstName,
        leadGuest.middleName,
        leadGuest.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      const payload = {
        hotelId: draft.hotelId,
        longStayContractId: draft.contract.longStayContractId,
        longStayRoomId: draft.room.longStayRoomId,
        agentId: agentId ? Number(agentId) : null,
        // Optional "Booking Done By Employee" — set in LongStaySearch,
        // threaded through LongStayRoomList's draft into the create call.
        // Backend's LongStayBookingService.create resolves it via
        // EmployeeRepository and stamps the relation on the new
        // long_stay_booking row.
        employeeId: draft.employeeId || null,
        checkInDate: toLocalDateTime(draft.checkIn),
        checkOutDate: toLocalDateTime(draft.checkOut),
        primaryGuestName: fullName,
        primaryGuestEmail: "",
        primaryGuestPhone: "",
        nationality: null,
        remarks: remarks || null,
        // Payment mode chosen below — stored on the booking (display-only).
        paymentMode,
        // Booking-flow status + voucher choice — mirrors HotelBookingPage.
        // The backend can trust these directly instead of re-deriving from
        // (refundable, deadlineDate, bookingConfirmation).
        bookingConfirmation: bookingConfirmation || "Book & Voucher",
        bookingFlowStatus: resolvedBookingFlowStatus,
        isBookandVoucher: isRefundableRate
          ? bookingConfirmation === "Book & Voucher"
          : false,
        isOutsideDeadline,
        deadlineDate: cancellationDeadline
          ? `${cancellationDeadline.getFullYear()}-${String(
              cancellationDeadline.getMonth() + 1,
            ).padStart(2, "0")}-${String(
              cancellationDeadline.getDate(),
            ).padStart(2, "0")}T00:00:00`
          : null,
        tourismDirham:
          tourismDirham !== "" && !isNaN(Number(tourismDirham))
            ? Number(tourismDirham)
            : null,
        // Display currency chosen on the search page. `displayCurrencyRate` is
        // the AED→target factor; the booking total stays AED and the backend
        // stores the code + converted amount. AED → factor 1.
        displayCurrencyCode: draft?.currency?.code || "AED",
        displayCurrencyRate:
          Number(draft?.currency?.factor) > 0 ? Number(draft.currency.factor) : 1,
        primaryGuestDetails: {
          salutation: leadGuest.salutation || "",
          firstName: (leadGuest.firstName || "").trim(),
          middleName: leadGuest.middleName?.trim() || null,
          lastName: (leadGuest.lastName || "").trim(),
          email: "",
          phone: "",
          passportNo: null,
          nationality: null,
          gender: leadGuest.gender || null,
        },
        rooms: rooms.map((room, rIdx) => ({
          adults: room.adults,
          children: room.children,
          childAges: room.childAges,
          guests: room.guests.map((g, gIdx) => ({
            salutation: g.salutation,
            firstName: g.firstName?.trim() || "",
            lastName: g.lastName?.trim() || "",
            gender: g.gender || null,
            isChild: !!g.isChild,
            childAge: g.isChild
              ? room.childAges[gIdx - room.adults] ?? null
              : null,
            // Lead flag mirrors the other dedicated-flow booking
            // pages. Backend ignores unknown fields so this stays
            // backward-compatible with /api/longStayBooking/create.
            isLead: rIdx === leadIndex.roomIdx && gIdx === leadIndex.guestIdx,
          })),
        })),
      };
      const res = await axiosInstance.post("/api/longStayBooking/create", payload);
      toast.success(`Booking confirmed: ${res.data.bookingCode}`);
      sessionStorage.removeItem("longStayBookingDraft");
      setShowConfirmModal(false);
      // "Add New Item" amendment flow: link to the parent hotel booking and
      // return to its detail page; otherwise keep the normal list redirect.
      // The create call above is unchanged.
      if (draft.parentBookingCode) {
        const parentId = await createAmendmentLink({
          parentBookingCode: draft.parentBookingCode,
          childType: "LONG_STAY",
          childTypeLabel: "Long Stay",
          childBookingId: res.data.longStayBookingId,
          childBookingCode: res.data.bookingCode,
          childDetailRoutePrefix: "/booking-details/long-stay-booking/",
          childReferenceNumber: res.data.referenceNumber || res.data.bookingCode,
          childStatus: res.data.confirmationStatus || res.data.status || "Confirmed",
          childHotelName: draft.hotelName,
          childCheckInDate: draft.checkIn,
          childCheckOutDate: draft.checkOut,
          childTotalRate: quote?.totalAmount,
          childGuestName: fullName,
        });
        if (parentId) {
          navigate(`/booking-details/hotel-booking/${parentId}`);
          return;
        }
      }
      navigate("/booking-details/long-stay-booking-list");
    } catch (err) {
      toast.error(`Booking failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft) return null;

  // Display currency carried from the search/room-list (rates are AED; this
  // converts them for display only — the create payload stays AED). AED → 1.
  const _lsCur = draft?.currency || { code: "AED", factor: 1 };
  const curCode = _lsCur.code || "AED";
  const curFactor = Number(_lsCur.factor) > 0 ? Number(_lsCur.factor) : 1;
  const formatPrice = (price) =>
    `${curCode} ${((Number(price) || 0) * curFactor).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // Tourism Dirham parsed for live summary calculations — mirrors
  // HotelBookingPage#tourismDirhamsAmount so the two flows behave
  // identically.
  const tdAmount =
    tourismDirham !== "" && !isNaN(Number(tourismDirham))
      ? Number(tourismDirham)
      : 0;
  // quote.totalAmount is already agent-markup-inclusive (see
  // LongStayBookingService#quote). totalAmountWithoutMarkup +
  // markupAmount are the pre-markup audit values backend now ships
  // so we can render the same Selling Price → Markup → Total
  // breakdown the hotel booking page shows.
  const sellingPrice = quote?.totalAmount != null ? Number(quote.totalAmount) : 0;
  const preMarkupRate =
    quote?.totalAmountWithoutMarkup != null
      ? Number(quote.totalAmountWithoutMarkup)
      : sellingPrice;
  const markupAmount =
    quote?.markupAmount != null ? Number(quote.markupAmount) : 0;
  const markupType = quote?.markupType || null;
  const markupValue = quote?.markupValue != null ? Number(quote.markupValue) : null;
  const newTotal = sellingPrice + tdAmount;

  // ── derived totals for header chips ────────────────────────────────────
  const totalAdults = rooms.reduce((s, r) => s + (r.adults || 0), 0);
  const totalChildren = rooms.reduce((s, r) => s + (r.children || 0), 0);
  const totalGuests = totalAdults + totalChildren;

  const mealPlanLabel =
    draft.room.roomTypeName ||
    (draft.room.meal ? "Meal included" : "Room only");

  return (
    <div className="min-vh-100 bg-light d-flex flex-column hotel-booking-container">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        {/* overflow-x: clip (not hidden) so the right-column Booking Summary's
            position: sticky keeps working — `hidden` turns <main> into a scroll
            container and breaks sticky; `clip` still hides horizontal overflow. */}
        <main className="content-wrapper py-4 flex-grow-1" style={{ minWidth: 0, overflowX: "clip" }}>
          <Container fluid="xl">
            <div className="d-flex justify-content-end mb-2">
              <AgentBalanceDisplay agentId={agentId} />
            </div>

            <Form
              onSubmit={(e) => {
                e.preventDefault();
                handleBook();
              }}
            >
              <Row className="g-3">
                <Col lg={8} className="hbp-left-col">
                  {/* Guest Details */}
                  <Card className="mb-2 shadow-sm border-0">
                    <Card.Header className="bg-light py-2">
                      <div className="d-flex align-items-center">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => navigate(-1)}
                          className="me-3"
                        >
                          ← Back
                        </Button>
                        <h6 className="mb-0 fw-bold text-dark">Guest Details</h6>
                      </div>
                    </Card.Header>
                    <Card.Body className="p-0">
                      <Accordion
                        alwaysOpen
                        defaultActiveKey={rooms.map((_, i) => i.toString())}
                        className="guest-details-accordion"
                      >
                        {rooms.map((room, rIdx) => (
                          <Accordion.Item
                            key={rIdx}
                            eventKey={rIdx.toString()}
                            className="mb-3 guest-room-item"
                          >
                            <Accordion.Header className="bg-primary text-white">
                              <h6 className="mb-0 fw-bold w-100 d-flex flex-wrap align-items-center gap-2">
                                <span>
                                  Room {rIdx + 1} -{" "}
                                  {room.roomCategoryName ||
                                    draft.room.roomCategoryName ||
                                    `Category #${draft.room.hotelRoomCategoryId}`}
                                </span>
                                {mealPlanLabel && (
                                  <Badge bg="light" text="dark" className="ms-2">
                                    <FaUtensils className="me-1" />
                                    {mealPlanLabel}
                                  </Badge>
                                )}
                              </h6>
                            </Accordion.Header>
                            <Accordion.Body className="p-3">
                              {/* Column headers — mirrors the rest
                                  of the dedicated-flow booking pages
                                  so every Guest Details grid looks
                                  identical. */}
                              <Row className="fw-semibold small text-muted px-2 mb-1 d-none d-md-flex">
                                <Col md={2}>Passenger</Col>
                                <Col md={2}>Title *</Col>
                                <Col md={3}>First Name *</Col>
                                <Col md={3}>Surname *</Col>
                                <Col md={2} className="text-center">Lead</Col>
                              </Row>
                              {room.guests.map((g, gIdx) => {
                                const isLead =
                                  leadIndex.roomIdx === rIdx &&
                                  leadIndex.guestIdx === gIdx;
                                return (
                                <div key={gIdx} className="guest-row mb-2">
                                  <Row className="align-items-center g-2">
                                    <Col md={2}>
                                      <span className="fw-semibold text-muted">
                                        {g.isChild
                                          ? `Child ${
                                              gIdx - room.adults + 1
                                            } (Age: ${
                                              room.childAges[gIdx - room.adults] ??
                                              "-"
                                            })`
                                          : `Adult ${gIdx + 1}`}
                                      </span>
                                    </Col>
                                    <Col md={2}>
                                      <Form.Select
                                        value={g.salutation}
                                        onChange={(e) =>
                                          handleGuestChange(
                                            rIdx,
                                            gIdx,
                                            "salutation",
                                            e.target.value
                                          )
                                        }
                                        className="form-control-sm"
                                        isInvalid={
                                          !!errors[`r${rIdx}_g${gIdx}_salutation`]
                                        }
                                      >
                                        <option value="">SELECT</option>
                                        <option value="Mr">Mr</option>
                                        <option value="Mrs">Mrs</option>
                                        <option value="Ms">Ms</option>
                                        <option value="Master">Master</option>
                                      </Form.Select>
                                    </Col>
                                    <Col md={3}>
                                      <Form.Control
                                        type="text"
                                        placeholder="First Name"
                                        value={g.firstName}
                                        onChange={(e) =>
                                          handleGuestChange(
                                            rIdx,
                                            gIdx,
                                            "firstName",
                                            e.target.value
                                          )
                                        }
                                        className="form-control-sm"
                                        isInvalid={
                                          !!errors[`r${rIdx}_g${gIdx}_firstName`]
                                        }
                                      />
                                    </Col>
                                    <Col md={3}>
                                      <Form.Control
                                        type="text"
                                        placeholder="Surname"
                                        value={g.lastName}
                                        onChange={(e) =>
                                          handleGuestChange(
                                            rIdx,
                                            gIdx,
                                            "lastName",
                                            e.target.value
                                          )
                                        }
                                        className="form-control-sm"
                                        isInvalid={
                                          !!errors[`r${rIdx}_g${gIdx}_lastName`]
                                        }
                                      />
                                    </Col>
                                    {/* Gender column hidden by
                                        request. State `g.gender`
                                        keeps its default empty
                                        string so the payload key
                                        stays intact. */}
                                    <Col md={2} className="text-center">
                                      {/* Lead radio — only adults can
                                          be lead. Disabled+greyed for
                                          children so the row still
                                          aligns. The Lead-marked guest
                                          drives the `primaryGuestName /
                                          Details` payload. */}
                                      <Form.Check
                                        type="radio"
                                        name="ls-lead-guest"
                                        id={`ls-lead-${rIdx}-${gIdx}`}
                                        checked={isLead}
                                        disabled={g.isChild}
                                        onChange={() =>
                                          handleLeadSelect(rIdx, gIdx)
                                        }
                                        title={
                                          g.isChild
                                            ? "Children cannot be the lead"
                                            : "Mark as Lead passenger"
                                        }
                                      />
                                    </Col>
                                  </Row>
                                </div>
                                );
                              })}
                            </Accordion.Body>
                          </Accordion.Item>
                        ))}
                      </Accordion>
                    </Card.Body>
                  </Card>

                  {/* Lead Passenger / Primary Guest Details card
                      hidden by request — the Guest Details grid
                      above is the single source of customer details.
                      The submit payload still carries
                      `primaryGuestName / Email / Phone` and
                      `primaryGuestDetails` (derived from Room 1 /
                      Guest 1 in confirmBooking) so the
                      /api/longStayBooking/create contract stays
                      intact. Email / phone / passport / nationality
                      aren't collected on the form any more and ride
                      along as empty strings. */}

                  {/* Stay & Room Details */}
                  <Card className="p-4 mb-4 shadow-sm border-0">
                    <h5 className="mb-3 fw-bold">Stay &amp; Room Details</h5>
                    <Row className="g-3">
                      <Col md={4}>
                        <div className="text-muted small fw-semibold">Hotel</div>
                        <div className="fw-semibold">{draft.hotelName}</div>
                      </Col>
                      <Col md={4}>
                        <div className="text-muted small fw-semibold">Contract</div>
                        <div className="fw-semibold">{draft.contract.rateCode}</div>
                      </Col>
                      <Col md={4}>
                        <div className="text-muted small fw-semibold">Billing</div>
                        <div className="fw-semibold">
                          {draft.contract.additionalCostType === "WEEKLY"
                            ? "Weekly"
                            : "Day-wise"}
                        </div>
                      </Col>
                      <Col md={4}>
                        <div className="text-muted small fw-semibold">
                          Room Category
                        </div>
                        <div className="fw-semibold">
                          {draft.room.roomCategoryName ||
                            `Category #${draft.room.hotelRoomCategoryId}`}
                        </div>
                      </Col>
                      <Col md={4}>
                        <div className="text-muted small fw-semibold">Meal Plan</div>
                        <div className="fw-semibold d-flex align-items-center">
                          <FaUtensils className="me-2 text-muted" />
                          {mealPlanLabel}
                        </div>
                      </Col>
                      <Col md={4}>
                        <div className="text-muted small fw-semibold">Occupancy</div>
                        <div className="fw-semibold">
                          {draft.room.occupancyTypeName ||
                            `Occ-${draft.room.occupancyTypeId}`}
                        </div>
                      </Col>
                      <Col md={4}>
                        <div className="text-muted small fw-semibold">Check-In</div>
                        <div className="fw-semibold">
                          {formatDateTime(draft.checkIn)}
                        </div>
                      </Col>
                      <Col md={4}>
                        <div className="text-muted small fw-semibold">Check-Out</div>
                        <div className="fw-semibold">
                          {formatDateTime(draft.checkOut)}
                        </div>
                      </Col>
                      <Col md={4}>
                        <div className="text-muted small fw-semibold">
                          Refund Policy
                        </div>
                        <div>
                          {draft.room.refundable ? (
                            <Badge bg="success">
                              <FaCheckCircle className="me-1" /> Flexible
                            </Badge>
                          ) : (
                            <Badge bg="danger">Non-Refundable</Badge>
                          )}
                        </div>
                      </Col>
                    </Row>
                  </Card>

                  {/* Tourism Dirhams (AED) input hidden per request. The
                      `tourismDirham` state stays at its default ("") so the
                      create payload sends null and downstream totals are
                      unaffected. */}

                  {/* Payment Mode — mirrors the selector on /hotel-booking-page.
                      Drives the paymentMode field on the
                      /api/longStayBooking/create payload (display-only). */}
                  <Card className="p-4 mb-2 shadow-sm border-0">
                    <h5 className="mb-3 fw-bold">Payment Mode</h5>
                    <Row className="g-3">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-semibold mb-1">
                            Mode
                          </Form.Label>
                          {/* Only Credit Limit / Cash / Card are exposed
                              per business decision. Online, Bank Transfer,
                              and Cheque enums stay valid on the backend but
                              are hidden here. Mirrors HotelBookingPage. */}
                          <Form.Select
                            value={paymentMode}
                            onChange={(e) => setPaymentMode(e.target.value)}
                          >
                            <option value="CREDITLIMIT">Credit Limit</option>
                            <option value="CASH">Cash</option>
                            <option value="CARD">Card</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card>
                </Col>

                {/* Right sticky column — Booking Summary + Price */}
                <Col lg={4} className="hbp-right-col">
                  <div className="hbp-sticky-summary">
                    <Card className="shadow-sm rounded-3 mb-3 booking-summary-card border-0 overflow-hidden">
                      <Card.Header className="bg-primary text-white py-2 rounded-top">
                        <h6 className="mb-0 d-flex align-items-center">
                          <FaHotel className="me-2" /> Booking Summary
                        </h6>
                      </Card.Header>
                      <Card.Body className="p-3">
                        <div className="mb-3">
                          <div className="fw-bold text-primary mb-1">
                            {draft.hotelName}
                          </div>
                          {draft.address && (
                            <div className="text-muted small mb-2">
                              {draft.address}
                            </div>
                          )}
                          <div className="d-flex flex-wrap align-items-center gap-2">
                            <span className="badge bg-secondary">
                              {draft.contract.additionalCostType === "WEEKLY"
                                ? "Weekly billing"
                                : "Day-wise billing"}
                            </span>
                            {draft.room.refundable ? (
                              <Badge bg="success">Flexible</Badge>
                            ) : (
                              <Badge bg="danger">Non-Refundable</Badge>
                            )}
                          </div>
                        </div>

                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaCalendarAlt className="me-2 text-primary" />
                            Check-in
                          </div>
                          <div className="hbp-summary-value">
                            {formatDateTime(draft.checkIn)}
                          </div>
                        </div>
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaCalendarAlt className="me-2 text-primary" />
                            Check-out
                          </div>
                          <div className="hbp-summary-value">
                            {formatDateTime(draft.checkOut)}
                          </div>
                        </div>
                        <div className="hbp-summary-row align-items-start">
                          <div className="hbp-summary-label">
                            <FaUsers className="me-2 text-primary" />
                            Guests
                          </div>
                          <div className="hbp-summary-value text-end">
                            {rooms.map((room, i) => (
                              <div key={i} className="small">
                                Room {i + 1}: {room.adults} Adult
                                {room.adults > 1 ? "s" : ""}
                                {room.children
                                  ? `, ${room.children} Child${
                                      room.children > 1 ? "ren" : ""
                                    }`
                                  : ""}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaUtensils className="me-2 text-primary" />
                            Meal Plan
                          </div>
                          <div className="hbp-summary-value">{mealPlanLabel}</div>
                        </div>
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">Nights</div>
                          <div className="hbp-summary-value">
                            {quote?.totalNights ?? "—"}
                          </div>
                        </div>
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">Contract</div>
                          <div className="hbp-summary-value">
                            {draft.contract.rateCode}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>

                    <Card className="shadow-sm rounded-3 border-0 hbp-price-card">
                      <Card.Header className="bg-light py-2">
                        <h6 className="mb-0 fw-bold">Price Details</h6>
                      </Card.Header>
                      <Card.Body className="p-3">
                        {quoteError ? (
                          <div
                            className="text-danger small p-2 rounded"
                            style={{ background: "#fee2e2" }}
                          >
                            {quoteError}
                          </div>
                        ) : !quote ? (
                          <div className="text-center py-4">
                            <Spinner animation="border" size="sm" />
                            <div className="small text-muted mt-2">
                              Computing quote…
                            </div>
                          </div>
                        ) : (
                          <>
                            {quote.contractsUsed &&
                              quote.contractsUsed.length > 1 && (
                                <div
                                  className="small mb-2 p-2 rounded"
                                  style={{ background: "#eff6ff", color: "#1e40af" }}
                                >
                                  Booking spans{" "}
                                  <strong>{quote.contractsUsed.length}</strong>{" "}
                                  contract validities — billed pro-rata.
                                </div>
                              )}

                            {quote.remainder && quote.remainder.days > 0 && (
                              <div
                                className="mb-2 p-2 rounded"
                                style={{ background: "#fffbeb" }}
                              >
                                <div className="d-flex justify-content-between">
                                  <div>
                                    <div
                                      className="fw-semibold small"
                                      style={{ color: "#92400e" }}
                                    >
                                      Remainder · {quote.remainder.days} day
                                      {quote.remainder.days > 1 ? "s" : ""}
                                    </div>
                                    <div
                                      className="text-muted"
                                      style={{ fontSize: 11 }}
                                    >
                                      {quote.remainder.costType === "WEEKLY"
                                        ? "Weekly"
                                        : "Day-wise"}
                                    </div>
                                  </div>
                                  <span
                                    className="fw-bold small"
                                    style={{ color: "#92400e" }}
                                  >
                                    {formatPrice(quote.remainder.amount)}
                                  </span>
                                </div>
                              </div>
                            )}

                            <hr className="my-2" />
                            {markupAmount > 0 && (
                              <div className="hbp-summary-row">
                                <div className="hbp-summary-label">
                                  Pre-Markup Rate
                                </div>
                                <div className="hbp-summary-value">
                                  {formatPrice(preMarkupRate)}
                                </div>
                              </div>
                            )}
                            {markupAmount > 0 && (
                              <div className="hbp-summary-row">
                                <div className="hbp-summary-label">
                                  Agent Markup
                                  {markupType && markupValue != null && (
                                    <span
                                      className="text-muted ms-1"
                                      style={{ fontSize: 11 }}
                                    >
                                      (
                                      {markupType === "PERCENT"
                                        ? `${markupValue}%`
                                        : `AED ${markupValue}`}
                                      )
                                    </span>
                                  )}
                                </div>
                                <div className="hbp-summary-value">
                                  {formatPrice(markupAmount)}
                                </div>
                              </div>
                            )}
                            <div className="hbp-summary-row">
                              <div className="hbp-summary-label">Selling Price</div>
                              <div className="hbp-summary-value">
                                {formatPrice(sellingPrice)}
                              </div>
                            </div>
                            {/* Tourism Dirhams summary row hidden per request. */}
                            <hr className="my-2" />
                            <div className="hbp-summary-row fw-bold">
                              <div className="hbp-summary-label text-danger">
                                New Total
                              </div>
                              <div className="hbp-summary-value text-danger">
                                {formatPrice(newTotal)}
                              </div>
                            </div>
                          </>
                        )}
                      </Card.Body>
                    </Card>

                    {/* Voucher-choice card — mirrors HotelBookingPage.
                        Shown only when the rate is refundable AND the
                        contract has a cancellation policy AND the
                        deadline hasn't passed. Non-refundable / past-
                        deadline flows skip it and resolve to
                        RECONFIRMED automatically. */}
                    {showVoucherChoice && (
                      <Card className="shadow-sm rounded-3 border-0 mt-3">
                        <Card.Body className="p-3">
                          <Form.Group className="mb-0">
                            <Form.Label className="mb-2 fw-semibold">
                              Are you sure to continue booking?
                            </Form.Label>
                            <div className="d-flex flex-column gap-2 mt-1">
                              <Form.Check
                                type="radio"
                                id="ls-book-voucher"
                                name="lsBookingConfirmation"
                                label="Book Now & Voucher Now "
                                value="Book & Voucher"
                                checked={
                                  voucherChoiceMade &&
                                  bookingConfirmation === "Book & Voucher"
                                }
                                onChange={(e) => {
                                  setBookingConfirmation(e.target.value);
                                  setVoucherChoiceMade(true);
                                  setVoucherChoiceError(false);
                                }}
                                className="mb-0"
                              />
                              <Form.Check
                                type="radio"
                                id="ls-book-now-voucher-later"
                                name="lsBookingConfirmation"
                                label="Book Now & Voucher Later"
                                value="Book Now & Voucher later"
                                checked={
                                  voucherChoiceMade &&
                                  bookingConfirmation ===
                                    "Book Now & Voucher later"
                                }
                                onChange={(e) => {
                                  setBookingConfirmation(e.target.value);
                                  setVoucherChoiceMade(true);
                                  setVoucherChoiceError(false);
                                }}
                              />
                            </div>
                            {voucherChoiceError && (
                              <div className="text-danger small mt-2">
                                Please select a booking option to continue.
                              </div>
                            )}
                          </Form.Group>
                        </Card.Body>
                      </Card>
                    )}

                    <div className="hbp-action-bar mt-3 d-flex gap-2">
                      <Button
                        variant="outline-secondary"
                        onClick={() => navigate(-1)}
                        className="flex-grow-1"
                      >
                        Back
                      </Button>
                      <Button
                        variant="primary"
                        type="button"
                        onClick={handleBook}
                        disabled={!quote || !!quoteError || submitting}
                        className="flex-grow-1"
                      >
                        Confirm Booking
                      </Button>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* ── Policies & Terms Modal (pre-confirmation gate) ─────────────── */}
              {/*
                Uses the same .policy-modal-* CSS classes as
                /booking/hotel so the long-stay modal is visually identical
                to the hotel one (plain white header, uppercase section
                titles, dividers, neutral footer with checkbox + Cancel +
                Proceed). Styling lives in styles/HotelBookingPage.css.
              */}
              <Modal
                show={showPolicyModal}
                onHide={() => setShowPolicyModal(false)}
                centered
                backdrop="static"
                size="lg"
                scrollable
                dialogClassName="policy-modal"
              >
                <Modal.Header closeButton className="policy-modal-header">
                  <Modal.Title className="policy-modal-title">
                    Hotel Policies &amp; Terms
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body className="policy-modal-body">
                  {/* Cancellation Policy */}
                  <section className="policy-section">
                    <h6 className="policy-section-title">Cancellation Policy</h6>
                    {(draft?.contract?.cancellationPolicy || []).length > 0 ? (
                      draft.contract.cancellationPolicy.map((p, i) => (
                        <div key={i} className="policy-item">
                          <div className="policy-text">
                            {formatCancellationPolicyLine(p)}
                          </div>
                        </div>
                      ))
                    ) : !draft?.contract?.cancellationPolicyNotes ? (
                      <div className="policy-empty">
                        No cancellation policy configured.
                      </div>
                    ) : null}
                    {draft?.contract?.cancellationPolicyNotes && (
                      <div className="policy-item">
                        <div className="policy-text">
                          {draft.contract.cancellationPolicyNotes}
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Terms & Conditions */}
                  <section className="policy-section policy-section-last">
                    <h6 className="policy-section-title">Terms &amp; Conditions</h6>
                    {(draft?.contract?.termsAndConditions || []).length > 0 ? (
                      draft.contract.termsAndConditions.map((t, i) => (
                        <div key={i} className="policy-item">
                          <div className="policy-text">{t}</div>
                        </div>
                      ))
                    ) : (
                      <div className="policy-empty">
                        No terms &amp; conditions configured.
                      </div>
                    )}
                  </section>
                </Modal.Body>
                <Modal.Footer className="policy-modal-footer">
                  <Form.Check
                    type="checkbox"
                    id="ls-policy-accept"
                    className="me-auto policy-accept-check"
                    label={
                      <span>
                        I have read and accept the{" "}
                        <span className="text-primary">policies</span> and{" "}
                        <span className="text-primary">terms &amp; conditions</span>
                      </span>
                    }
                    checked={policyAccepted}
                    onChange={(e) => setPolicyAccepted(e.target.checked)}
                  />
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setShowPolicyModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!policyAccepted}
                    onClick={() => {
                      // Accept → close this modal, open the summary modal.
                      // Mirrors HotelBookingPage policy → summary chain.
                      setShowPolicyModal(false);
                      setShowConfirmModal(true);
                    }}
                  >
                    Proceed
                  </Button>
                </Modal.Footer>
              </Modal>

              {/* ── Confirmation Modal ─────────────────────────────────────────── */}
              <Modal
                show={showConfirmModal}
                onHide={() => !submitting && setShowConfirmModal(false)}
                centered
                backdrop="static"
                size="lg"
                dialogClassName="confirm-booking-modal"
              >
                {/*
                  Unified confirmation modal — structure copied from
                  HotelBookingPage so the operator sees the same shape across
                  the hotel and long-stay flows (per product spec / screenshot
                  reference). Sections (top → bottom):
                    1. Hotel name + address
                    2. Check-In / Check-Out / Rooms / Nights grid
                    3. Cancellation Policy bullet list
                    4. Selling Price card
                    5. Total Price green gradient band ("for N room(s)")
                    6. Rate Split card (Selling / Tourism Dirhams / Total in red)
                    7. Green tick — policies accepted
                    8. Grey footer note
                */}
                <Modal.Header
                  closeButton={!submitting}
                  className="bg-primary text-white py-2"
                  style={{ borderBottom: "none" }}
                >
                  <Modal.Title className="fw-semibold d-flex align-items-center">
                    <FaHotel className="me-2" /> Confirm Your Booking
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body className="px-3 py-2 bg-light">
                  {draft && (
                    <div className="border rounded-3 bg-white shadow-sm p-2">
                      <div className="mb-2">
                        <p className="mb-0 d-flex align-items-center flex-wrap">
                          <span className="fw-bold text-primary fs-5">
                            {draft.hotelName}
                          </span>
                          {draft.address && (
                            <span className="text-muted small ms-1">
                              , {draft.address}
                            </span>
                          )}
                        </p>
                      </div>

                      <hr className="my-2" />

                      <Row className="gy-2">
                        <Col xs={6}>
                          <p className="mb-1">
                            <strong>Check-In:</strong>
                            <br />
                            <span className="text-dark">
                              {formatDateTime(draft.checkIn)}
                            </span>
                          </p>
                        </Col>
                        <Col xs={6}>
                          <p className="mb-1">
                            <strong>Check-Out:</strong>
                            <br />
                            <span className="text-dark">
                              {formatDateTime(draft.checkOut)}
                            </span>
                          </p>
                        </Col>
                        <Col xs={6}>
                          <p className="mb-1">
                            <strong>Rooms:</strong> {rooms.length}
                          </p>
                        </Col>
                        <Col xs={6}>
                          <p className="mb-1">
                            <strong>Nights:</strong> {quote?.totalNights ?? "—"}
                          </p>
                        </Col>

                        {/* Room category + room type — same "what am I
                            booking" info the hotel confirm modal shows. Uses
                            roomBreakdown for multi-room, else the single room. */}
                        {(() => {
                          const slots =
                            Array.isArray(draft.roomBreakdown) &&
                            draft.roomBreakdown.length > 0
                              ? draft.roomBreakdown.map((s) => s.room)
                              : [draft.room];
                          return slots.map((s, i) => (
                            <React.Fragment key={i}>
                              <Col xs={6}>
                                <p className="mb-1">
                                  <strong>Room Category:</strong>
                                  <br />
                                  <span className="text-dark">
                                    {slots.length > 1 ? `Room ${i + 1} - ` : ""}
                                    {s?.roomCategoryName || "—"}
                                    {s?.roomTypeName ? ` (${s.roomTypeName})` : ""}
                                  </span>
                                </p>
                              </Col>
                              <Col xs={6}>
                                <p className="mb-1">
                                  <strong>Occupancy:</strong>
                                  <br />
                                  <span className="text-dark">
                                    {s?.occupancyTypeName || "—"}
                                  </span>
                                </p>
                              </Col>
                            </React.Fragment>
                          ));
                        })()}

                        {/* Cancellation block — mirrors HotelBookingPage's
                            confirm modal. Non-refundable → clear "no refund"
                            notice (red). Refundable + deadline → the free-
                            cancellation deadline with a green "Refundable
                            until this date" badge, or a red "Passed" badge
                            if already crossed. */}
                        {!isRefundableRate ? (
                          <Col xs={12}>
                            <div
                              className="p-2 rounded border mt-2"
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
                              <p className="mb-1 text-dark small">
                                No refund will be provided if this booking is
                                cancelled.
                              </p>
                              <p className="mb-0 text-dark small">
                                100% cancellation charges apply from the time
                                of booking.
                              </p>
                            </div>
                          </Col>
                        ) : (
                          cancellationDeadline && (
                            <Col xs={12}>
                              <p className="mb-1 mt-2">
                                <strong>Cancellation Deadline:</strong>
                                <br />
                                <span className="text-dark">
                                  {cancellationDeadline.toLocaleDateString(
                                    "en-GB",
                                    {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    },
                                  )}
                                </span>
                                {isOutsideDeadline ? (
                                  <span
                                    className="badge bg-danger ms-2"
                                    style={{ fontSize: "0.7rem" }}
                                  >
                                    Passed
                                  </span>
                                ) : (
                                  <span
                                    className="badge bg-success ms-2"
                                    style={{ fontSize: "0.7rem" }}
                                  >
                                    Refundable until this date
                                  </span>
                                )}
                              </p>
                            </Col>
                          )
                        )}

                        <Col xs={12}>
                          <div className="p-2 rounded bg-white border mt-2 d-flex justify-content-between align-items-center">
                            <h6 className="mb-0 text-muted">Selling Price</h6>
                            <h5 className="mb-0 text-success fw-bold">
                              {formatPrice(sellingPrice)}
                            </h5>
                          </div>

                          <div className="p-2 rounded bg-white border mt-2 d-flex justify-content-between align-items-center">
                            <h6 className="mb-0 fw-bold">Payable</h6>
                            <h5 className="mb-0 fw-bold">
                              {formatPrice(newTotal)}{" "}
                              <span className="text-muted small fw-normal">
                                for {rooms.length}{" "}
                                {rooms.length > 1 ? "rooms" : "room"}
                              </span>
                            </h5>
                          </div>
                        </Col>
                      </Row>

                      <div className="mt-2 p-2 bg-white border rounded">
                        <h6 className="fw-bold mb-1">Rate Split</h6>
                        <div className="d-flex justify-content-between">
                          <span>Selling Price</span>
                          <span>{formatPrice(sellingPrice)}</span>
                        </div>
                        <hr className="my-1" />
                        <div className="d-flex justify-content-between fw-bold">
                          <span>Total (Selling)</span>
                          <span>{formatPrice(newTotal)}</span>
                        </div>
                      </div>

                      <div className="mt-2 p-2 bg-white border rounded d-flex align-items-center">
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
                          Hotel policies and terms &amp; conditions accepted
                        </span>
                      </div>

                      <div className="mt-2 text-center">
                        <p className="text-muted small mb-0">
                          Please review the booking details carefully before
                          confirming.
                        </p>
                      </div>
                    </div>
                  )}
                </Modal.Body>
                <Modal.Footer className="bg-light border-0 d-flex justify-content-between">
                  <Button
                    variant="outline-secondary"
                    onClick={() => setShowConfirmModal(false)}
                    disabled={submitting}
                  >
                    <i className="bi bi-x-circle me-1"></i> Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={confirmBooking}
                    disabled={submitting}
                    className="px-4 fw-semibold"
                  >
                    {submitting ? (
                      <>
                        <Spinner
                          animation="border"
                          size="sm"
                          className="me-2"
                          role="status"
                        />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FaCheckCircle className="me-1" /> Confirm
                      </>
                    )}
                  </Button>
                </Modal.Footer>
              </Modal>
            </Form>
          </Container>
        </main>
      </div>
    </div>
  );
}
