import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Form,
  Button,
  Row,
  Col,
  Badge,
  Modal,
  Table,
  Spinner,
  Accordion,
} from "react-bootstrap";
import {
  FaHotel,
  FaCalendarAlt,
  FaUsers,
  FaUtensils,
  FaClock,
  FaCheckCircle,
} from "react-icons/fa";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import { createAmendmentLink } from "../../../utils/amendmentLink";
import { toast } from "react-hot-toast";
import "../../../styles/HotelBookingPage.css";

/**
 * DayStayBookingPage — mirrors HotelBookingPage structure.
 * Builds per-room guest forms, validates, shows order summary, persists via
 * /api/day-stay-booking/save then redirects to the booking list.
 */
const SALUTATIONS = ["Mr", "Mrs", "Ms", "Miss", "Dr", "Master"];
const GENDERS = ["Male", "Female", "Other"];
const SPECIAL_REQUESTS = [
  "Early Check-In",
  "Late Check-Out",
  "Non-Smoking Room",
  "High Floor",
  "Low Floor",
  "Quiet Room",
  "Connecting Rooms",
  "Extra Towels",
];
const PAYMENT_MODES = ["Cash", "Card", "Online", "Bank Transfer"];

export default function DayStayBookingPage() {
  const navigate = useNavigate();

  const [payload, setPayload] = useState(null);
  const [primaryGuest, setPrimaryGuest] = useState({
    salutation: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    passportNo: "",
    agentLpo: "",
    nativeCountry: "",
  });
  const [rooms, setRooms] = useState([]);

  // ── Lead passenger marker — { roomIdx, guestIdx } pointing at the
  //    single guest the user has flagged as Lead. Mirrors the gov /
  //    SC / Student / Hotel / LastMinute / LongStay booking pages.
  //    Defaults to the first guest (room 0, guest 0) so the column
  //    has one selection on first render. Children can't be Lead.
  //    The Lead-marked guest drives the submitted `primaryGuest`
  //    (replacing the hidden Lead Passenger card).
  const [leadIndex, setLeadIndex] = useState({ roomIdx: 0, guestIdx: 0 });

  const handleLeadSelect = (roomIdx, guestIdx) => {
    const g = rooms?.[roomIdx]?.guests?.[guestIdx];
    if (g?.isChild) return;
    setLeadIndex({ roomIdx, guestIdx });
  };

  const [selectedSpecialRequests, setSelectedSpecialRequests] = useState([]);
  const [remarks, setRemarks] = useState("");
  const [paymentMode, setPaymentMode] = useState("Online");
  const [bookingConfirmation, setBookingConfirmation] = useState("Book & Voucher");
  const [validationErrors, setValidationErrors] = useState({});
  const [showSummary, setShowSummary] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedBooking, setSavedBooking] = useState(null);
  const [agentBalance, setAgentBalance] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("dayStayBookingPayload");
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      setPayload(p);
      // Pre-fill nationality / native country from the day-stay search.
      if (p.nationality || p.nationalityLabel) {
        setPrimaryGuest((prev) => ({
          ...prev,
          nativeCountry: p.nationalityLabel || p.nationality || "",
        }));
      }
      const adultsTotal = Number(p.adults || 1);
      const childrenTotal = Number(p.children || 0);
      const noOfRooms = Math.max(1, Number(p.rooms || 1));

      const perRoomAdults = Math.max(1, Math.floor(adultsTotal / noOfRooms));
      const perRoomChildren = Math.floor(childrenTotal / noOfRooms);
      const ages = Array.isArray(p.childAges) ? p.childAges : [];
      let agePtr = 0;
      const initRooms = [];
      for (let i = 0; i < noOfRooms; i++) {
        const aRoom =
          i === noOfRooms - 1
            ? adultsTotal - perRoomAdults * (noOfRooms - 1)
            : perRoomAdults;
        const cRoom =
          i === noOfRooms - 1
            ? childrenTotal - perRoomChildren * (noOfRooms - 1)
            : perRoomChildren;
        const guests = [];
        for (let g = 0; g < aRoom; g++) {
          guests.push({
            salutation: "",
            firstName: "",
            middleName: "",
            lastName: "",
            gender: "",
            isChild: false,
          });
        }
        for (let g = 0; g < cRoom; g++) {
          guests.push({
            salutation: "",
            firstName: "",
            middleName: "",
            lastName: "",
            gender: "",
            isChild: true,
            age: ages[agePtr] != null ? ages[agePtr] : null,
          });
          agePtr++;
        }
        initRooms.push({
          roomNo: i + 1,
          roomCategory:
            p.roomCategory || p.rateRow?.roomCategoryName || "Standard",
          mealPlan:
            p.rateRow?.mealPlan ||
            p.rateRow?.roomTypeName ||
            "Room Only",
          nonRefundable: !(p.rateRow?.refundable ?? true),
          currency: "AED",
          rate: Number(p.dayStayRate || 0),
          rateWithoutMarkup: Number(p.dayStayRate || 0),
          adults: aRoom,
          children: cRoom,
          guests,
        });
      }
      setRooms(initRooms);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!payload?.agentId) {
      setAgentBalance(null);
      return;
    }
    let cancelled = false;
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${payload.agentId}`)
      .then((res) => {
        if (!cancelled)
          setAgentBalance(res?.data?.availableCreditLimit ?? null);
      })
      .catch(() => {
        if (!cancelled) setAgentBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  const totals = useMemo(() => {
    const baseTotal = rooms.reduce((s, r) => s + Number(r.rate || 0), 0);
    return { baseTotal, grandTotal: baseTotal };
  }, [rooms]);

  const handlePrimary = (field, value) => {
    setPrimaryGuest((p) => ({ ...p, [field]: value }));
    setValidationErrors((errs) => {
      const n = { ...errs };
      delete n[field];
      return n;
    });
  };

  const handleGuest = (roomIdx, guestIdx, field, value) => {
    setRooms((prev) => {
      const next = [...prev];
      next[roomIdx] = {
        ...next[roomIdx],
        guests: next[roomIdx].guests.map((g, i) =>
          i === guestIdx ? { ...g, [field]: value } : g
        ),
      };
      return next;
    });
    if (
      roomIdx === 0 &&
      guestIdx === 0 &&
      ["salutation", "firstName", "lastName"].includes(field)
    ) {
      setPrimaryGuest((p) => ({ ...p, [field]: value }));
    }
    const key = `room_${roomIdx}_guest_${guestIdx}_${field}`;
    setValidationErrors((errs) => {
      const n = { ...errs };
      delete n[key];
      delete n[field];
      return n;
    });
  };

  const toggleSpecial = (txt) => {
    setSelectedSpecialRequests((prev) =>
      prev.includes(txt) ? prev.filter((x) => x !== txt) : [...prev, txt]
    );
  };

  const validate = () => {
    const errs = {};
    // Lead Passenger / Primary Guest validation removed — the card
    // has been hidden. The Guest Details grid above is the single
    // source of customer details; the submit payload derives
    // `primaryGuest` from the Lead-marked guest at build time.

    rooms.forEach((room, ri) => {
      room.guests.forEach((g, gi) => {
        const k = (f) => `room_${ri}_guest_${gi}_${f}`;
        if (!g.salutation) errs[k("salutation")] = "Required";
        if (!g.firstName?.trim()) errs[k("firstName")] = "First name required";
        if (!g.lastName?.trim()) errs[k("lastName")] = "Last name required";
      });
    });
    return errs;
  };

  const handleReview = (e) => {
    e.preventDefault();
    const errs = validate();
    setValidationErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setPolicyAccepted(false);
    setShowPolicyModal(true);
  };

  const proceedAfterPolicyAcceptance = () => {
    if (!policyAccepted) {
      toast.error("Please accept the policies and terms to continue");
      return;
    }
    setShowPolicyModal(false);
    setShowSummary(true);
  };

  const confirmAndSave = async () => {
    if (!payload) return;
    setSubmitting(true);
    try {
      const body = {
        hotelId: payload.hotelId,
        agentId: Number(payload.agentId) || null,
        // Optional "Booking Done By Employee" — picked in DayStaySearch,
        // spread through DayStayRoomList's payload. Backend resolves it
        // to an Employee row in DayStayBookingServiceImpl.create.
        employeeId: payload.employeeId || null,
        contractId: payload.contractId,
        checkInDate: payload.checkInDate,
        checkInTime: payload.checkInTime,
        checkOutTime: payload.checkOutTime,
        nationality:
          payload.nationalityLabel || payload.nationality || null,
        nationalityCode: payload.nationality || null,
        childAges: payload.childAges || [],
        totalAdults: rooms.reduce((s, r) => s + r.adults, 0),
        totalChildren: rooms.reduce((s, r) => s + r.children, 0),
        totalAmount: totals.grandTotal,
        bookingConfirmation,
        remarks: remarks?.trim() || null,
        // Lead Passenger / Primary Guest card is hidden — derive
        // primaryGuest from the Lead-marked guest in the Guest
        // Details grid above. Email / phone / passportNo / agentLpo
        // / nativeCountry are no longer collected on the form and
        // are sent as empty strings. Backend ignores empty optional
        // values so the existing booking-create contract is
        // preserved.
        primaryGuest: (() => {
          const leadGuest =
            rooms?.[leadIndex.roomIdx]?.guests?.[leadIndex.guestIdx] || {};
          return {
            salutation: leadGuest.salutation || "",
            firstName: leadGuest.firstName || "",
            middleName: leadGuest.middleName || "",
            lastName: leadGuest.lastName || "",
            email: "",
            phone: "",
            passportNo: "",
            agentLpo: "",
            nativeCountry: "",
          };
        })(),
        rooms: rooms.map((r, rIdx) => ({
          roomNo: r.roomNo,
          roomCategory: r.roomCategory,
          mealPlan: r.mealPlan,
          nonRefundable: r.nonRefundable,
          currency: r.currency,
          rate: r.rate,
          rateWithoutMarkup: r.rateWithoutMarkup,
          adults: r.adults,
          children: r.children,
          // Mark each guest with an additive `isLead` flag mirroring
          // the other dedicated-flow booking pages. Backend ignores
          // unknown fields.
          guests: (r.guests || []).map((g, gi) => ({
            ...g,
            isLead: rIdx === leadIndex.roomIdx && gi === leadIndex.guestIdx,
          })),
        })),
        policyAccepted: true,
        acceptedTermsAndConditions: true,
        acceptedCancellationPolicies: true,
        termsAndConditions: payload.termsAndConditions || [],
        cancellationPolicy: payload.cancellationPolicies || [],
        specialRequests: selectedSpecialRequests,
      };
      const res = await axiosInstance.post(
        "/api/day-stay-booking/save",
        body
      );
      setSavedBooking(res.data);
      setShowSummary(false);
      sessionStorage.removeItem("dayStayBookingPayload");
      toast.success("Day Stay booking confirmed");
      // "Add New Item" amendment flow: link to the parent hotel booking and
      // return to its detail page; otherwise keep the normal list redirect.
      // The create call above is unchanged.
      if (payload.parentBookingCode) {
        const parentId = await createAmendmentLink({
          parentBookingCode: payload.parentBookingCode,
          childType: "DAY_STAY",
          childTypeLabel: "Day Stay",
          childBookingId: res.data.id,
          childBookingCode: res.data.bookingCode,
          childDetailRoutePrefix: "/booking-details/day-stay-booking/",
          childReferenceNumber: res.data.referenceNumber || res.data.bookingCode,
          childStatus: res.data.confirmationStatus || res.data.status || "Confirmed",
          childHotelName: payload.hotelName,
          childCheckInDate: payload.checkInDate,
          childCheckOutDate: payload.checkInDate,
          childTotalRate: payload.totalAmount,
          childGuestName: `${body.primaryGuest?.firstName || ""} ${
            body.primaryGuest?.lastName || ""
          }`.trim(),
        });
        if (parentId) {
          navigate(`/booking-details/hotel-booking/${parentId}`);
          return;
        }
      }
      setTimeout(
        () => navigate("/booking-details/day-stay-booking-list"),
        800
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!payload && !savedBooking) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column hotel-booking-container">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="content-wrapper py-4 flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
            <Container fluid="xl">
              <Card className="shadow-sm border-0">
                <Card.Body className="text-center text-muted py-5">
                  <h5>No booking in progress</h5>
                  <Button
                    className="mt-2"
                    onClick={() => navigate("/new-booking/day-stay")}
                  >
                    Go to Day Stay Search
                  </Button>
                </Card.Body>
              </Card>
            </Container>
          </main>
        </div>
      </div>
    );
  }

  if (savedBooking) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column hotel-booking-container">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="content-wrapper py-4 flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
            <Container fluid="xl">
              <Card className="shadow-sm border-0">
                <Card.Body className="text-center py-5">
                  <FaCheckCircle size={48} className="text-success mb-3" />
                  <h4>Day Stay Booking Confirmed</h4>
                  <p className="text-muted mb-2">
                    Reference: <strong>{savedBooking.bookingCode}</strong>
                  </p>
                  <Button
                    onClick={() =>
                      navigate("/booking-details/day-stay-booking-list")
                    }
                  >
                    Go to Booking List
                  </Button>
                </Card.Body>
              </Card>
            </Container>
          </main>
        </div>
      </div>
    );
  }

  const mealPlanLabel = rooms[0]?.mealPlan || "Room Only";

  return (
    <div className="min-vh-100 bg-light d-flex flex-column hotel-booking-container">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="content-wrapper py-4 flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
          <Container fluid="xl">
            <div className="d-flex justify-content-end mb-2">
              {payload.agentId && (
                <span className="small">
                  Agent #{payload.agentId}
                  {agentBalance != null && (
                    <span
                      className="ms-2 fw-semibold"
                      style={{ color: "#dc3545" }}
                    >
                      Available Balance: {Number(agentBalance).toFixed(2)}
                    </span>
                  )}
                </span>
              )}
            </div>

            <Form onSubmit={handleReview} noValidate>
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
                        {rooms.map((room, ri) => (
                          <Accordion.Item
                            key={ri}
                            eventKey={ri.toString()}
                            className="mb-3 guest-room-item"
                          >
                            <Accordion.Header className="bg-primary text-white">
                              <h6 className="mb-0 fw-bold w-100 d-flex flex-wrap align-items-center gap-2">
                                <span>
                                  Room {room.roomNo} - {room.roomCategory}
                                </span>
                                {room.mealPlan && (
                                  <Badge bg="light" text="dark" className="ms-2">
                                    <FaUtensils className="me-1" />
                                    {room.mealPlan}
                                  </Badge>
                                )}
                              </h6>
                            </Accordion.Header>
                            <Accordion.Body className="p-3">
                              {/* Column headers — mirrors the other
                                  dedicated-flow booking pages so
                                  every Guest Details grid looks
                                  identical. */}
                              <Row className="fw-semibold small text-muted px-2 mb-1 d-none d-md-flex">
                                <Col md={2}>Passenger</Col>
                                <Col md={2}>Title *</Col>
                                <Col md={3}>First Name *</Col>
                                <Col md={3}>Surname *</Col>
                                <Col md={2} className="text-center">Lead</Col>
                              </Row>
                              {room.guests.map((g, gi) => {
                                const lbl = g.isChild
                                  ? `Child ${gi - room.adults + 1}`
                                  : `Adult ${gi + 1}`;
                                const isLead =
                                  leadIndex.roomIdx === ri &&
                                  leadIndex.guestIdx === gi;
                                return (
                                  <div key={gi} className="guest-row mb-2">
                                    <Row className="align-items-center g-2">
                                      <Col md={2}>
                                        <span className="fw-semibold text-muted">
                                          {lbl}
                                        </span>
                                      </Col>
                                      <Col md={2}>
                                        <Form.Select
                                          value={g.salutation}
                                          isInvalid={
                                            !!validationErrors[
                                              `room_${ri}_guest_${gi}_salutation`
                                            ]
                                          }
                                          onChange={(e) =>
                                            handleGuest(
                                              ri,
                                              gi,
                                              "salutation",
                                              e.target.value
                                            )
                                          }
                                          className="form-control-sm"
                                        >
                                          <option value="">--</option>
                                          {SALUTATIONS.map((s) => (
                                            <option key={s} value={s}>
                                              {s}
                                            </option>
                                          ))}
                                        </Form.Select>
                                      </Col>
                                      <Col md={3}>
                                        <Form.Control
                                          placeholder="First Name"
                                          value={g.firstName}
                                          isInvalid={
                                            !!validationErrors[
                                              `room_${ri}_guest_${gi}_firstName`
                                            ]
                                          }
                                          onChange={(e) =>
                                            handleGuest(
                                              ri,
                                              gi,
                                              "firstName",
                                              e.target.value
                                            )
                                          }
                                          className="form-control-sm"
                                        />
                                      </Col>
                                      <Col md={3}>
                                        <Form.Control
                                          placeholder="Surname"
                                          value={g.lastName}
                                          isInvalid={
                                            !!validationErrors[
                                              `room_${ri}_guest_${gi}_lastName`
                                            ]
                                          }
                                          onChange={(e) =>
                                            handleGuest(
                                              ri,
                                              gi,
                                              "lastName",
                                              e.target.value
                                            )
                                          }
                                          className="form-control-sm"
                                        />
                                      </Col>
                                      {/* Gender column hidden by
                                          request. State `g.gender`
                                          keeps its default empty
                                          string. */}
                                      <Col md={2} className="text-center">
                                        {/* Lead radio — only adults
                                            can be lead. Disabled+greyed
                                            for children so the row
                                            still aligns. The Lead-marked
                                            guest drives the `primaryGuest`
                                            payload (replacing the hidden
                                            Lead Passenger card). */}
                                        <Form.Check
                                          type="radio"
                                          name="ds-lead-guest"
                                          id={`ds-lead-${ri}-${gi}`}
                                          checked={isLead}
                                          disabled={g.isChild}
                                          onChange={() =>
                                            handleLeadSelect(ri, gi)
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
                      above is the single source of customer details,
                      with the Lead radio marking the head guest. The
                      submit payload still carries a `primaryGuest`
                      object: it's derived from the Lead-marked
                      passenger in handleReview / submit, so the
                      booking-create contract stays intact. */}

                  {/* Special Requests (Remarks textarea hidden by
                      request — state `remarks` keeps its default
                      empty string so the payload key stays intact). */}
                  <Card className="p-4 mb-2 shadow-sm border-0">
                    <h5 className="mb-3 fw-bold">Special Requests</h5>
                    <div className="special-request-grid mb-3">
                      {SPECIAL_REQUESTS.map((req) => (
                        <Form.Check
                          key={req}
                          type="checkbox"
                          id={`spreq-${req}`}
                          label={req}
                          className="special-request-check"
                          checked={selectedSpecialRequests.includes(req)}
                          onChange={() => toggleSpecial(req)}
                        />
                      ))}
                    </div>
                    <Row className="g-3">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label>Payment Mode</Form.Label>
                          <Form.Select
                            value={paymentMode}
                            onChange={(e) => setPaymentMode(e.target.value)}
                          >
                            {PAYMENT_MODES.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label>Booking Confirmation</Form.Label>
                          <Form.Select
                            value={bookingConfirmation}
                            onChange={(e) =>
                              setBookingConfirmation(e.target.value)
                            }
                          >
                            <option>Book &amp; Voucher</option>
                            <option>On Hold</option>
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
                            {payload.hotelName}
                          </div>
                          {payload.hotelAddress && (
                            <div className="text-muted small mb-2">
                              {payload.hotelAddress}
                            </div>
                          )}
                          <div className="d-flex flex-wrap align-items-center gap-2">
                            <Badge bg="info">Day Stay</Badge>
                            {(payload.windowStart || payload.windowEnd) && (
                              <Badge bg="light" text="dark" className="border">
                                {payload.windowStart} – {payload.windowEnd}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaCalendarAlt className="me-2 text-primary" />
                            Date
                          </div>
                          <div className="hbp-summary-value">
                            {payload.checkInDate}
                          </div>
                        </div>
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaClock className="me-2 text-primary" />
                            Check-In
                          </div>
                          <div className="hbp-summary-value">
                            {payload.checkInTime}
                          </div>
                        </div>
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaClock className="me-2 text-primary" />
                            Check-Out
                          </div>
                          <div className="hbp-summary-value">
                            {payload.checkOutTime}
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
                                Room {room.roomNo}: {room.adults} Adult
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
                      </Card.Body>
                    </Card>

                    <Card className="shadow-sm rounded-3 border-0 hbp-price-card">
                      <Card.Header className="bg-light py-2">
                        <h6 className="mb-0 fw-bold">Price Details</h6>
                      </Card.Header>
                      <Card.Body className="p-3">
                        {rooms.map((r, i) => (
                          <div className="hbp-summary-row" key={i}>
                            <div className="hbp-summary-label">
                              Room {r.roomNo}
                            </div>
                            <div className="hbp-summary-value">
                              AED {Number(r.rate || 0).toFixed(2)}
                            </div>
                          </div>
                        ))}
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">Base Total</div>
                          <div className="hbp-summary-value">
                            AED {totals.baseTotal.toFixed(2)}
                          </div>
                        </div>
                        <hr className="my-2" />
                        <div className="hbp-summary-row fw-bold">
                          <div className="hbp-summary-label text-danger">
                            Total
                          </div>
                          <div className="hbp-summary-value text-danger">
                            AED {totals.grandTotal.toFixed(2)}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>

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
                        type="submit"
                        disabled={submitting}
                        className="flex-grow-1"
                      >
                        Submit
                      </Button>
                    </div>
                  </div>
                </Col>
              </Row>
            </Form>
          </Container>
        </main>
      </div>

      <Modal
        show={showPolicyModal}
        onHide={() => !submitting && setShowPolicyModal(false)}
        size="lg"
        centered
        backdrop="static"
        dialogClassName="policy-modal"
      >
        <Modal.Header closeButton={!submitting} className="policy-modal-header">
          <Modal.Title className="policy-modal-title">
            Day Stay Policies &amp; Terms
          </Modal.Title>
        </Modal.Header>
        <Modal.Body
          className="policy-modal-body"
          style={{ maxHeight: "65vh", overflowY: "auto" }}
        >
          <section className="policy-section">
            <h6 className="policy-section-title">Terms &amp; Conditions</h6>
            {payload?.termsAndConditions?.length ? (
              payload.termsAndConditions.map((item, idx) => (
                <div key={`day-stay-term-${idx}`} className="policy-item">
                  <div className="policy-text">{item}</div>
                </div>
              ))
            ) : (
              <div className="policy-empty">
                No terms and conditions configured for this day stay contract.
              </div>
            )}
          </section>
          <section className="policy-section policy-section-last">
            <h6 className="policy-section-title">Cancellation Policy</h6>
            {payload?.cancellationPolicies?.length ? (
              payload.cancellationPolicies.map((item, idx) => (
                <div
                  key={`day-stay-cancellation-${idx}`}
                  className="policy-item"
                >
                  <div className="policy-text">{item}</div>
                </div>
              ))
            ) : (
              <div className="policy-empty">
                No cancellation policy configured for this day stay contract.
              </div>
            )}
          </section>
          <div className="policy-accept-box mt-3">
            <Form.Check
              id="day-stay-policy-acceptance"
              className="policy-accept-check"
              checked={policyAccepted}
              onChange={(e) => setPolicyAccepted(e.target.checked)}
              label="I have read and agree to the terms and conditions and cancellation policies."
            />
          </div>
        </Modal.Body>
        <Modal.Footer className="policy-modal-footer">
          <Button
            variant="outline-secondary"
            disabled={submitting}
            onClick={() => setShowPolicyModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!policyAccepted || submitting}
            onClick={proceedAfterPolicyAcceptance}
          >
            Proceed
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showSummary}
        onHide={() => !submitting && setShowSummary(false)}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header
          closeButton={!submitting}
          className="bg-primary text-white py-2"
          style={{ borderBottom: "none" }}
        >
          <Modal.Title className="fw-semibold d-flex align-items-center">
            <FaHotel className="me-2" /> Order Summary
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-light">
          <Row className="g-2 mb-3">
            <Col md={6}>
              <strong>Hotel:</strong> {payload?.hotelName}
            </Col>
            <Col md={6}>
              <strong>Date:</strong> {payload?.checkInDate}
            </Col>
            <Col md={6}>
              <strong>Check-In:</strong> {payload?.checkInTime}
            </Col>
            <Col md={6}>
              <strong>Check-Out:</strong> {payload?.checkOutTime}
            </Col>
            {/* Guest summary now reads the Lead-marked passenger
                straight off the rooms array — the Primary Guest
                Details card was hidden. Email / Phone / Agent LPO
                are no longer collected on the form. */}
            {(() => {
              const lead =
                rooms?.[leadIndex.roomIdx]?.guests?.[leadIndex.guestIdx] || {};
              return (
                <Col md={6}>
                  <strong>Guest:</strong> {lead.salutation}{" "}
                  {lead.firstName} {lead.lastName}
                </Col>
              );
            })()}
          </Row>
          <Table size="sm" bordered>
            <thead className="table-light">
              <tr>
                <th>Room</th>
                <th>Category</th>
                <th>Meal Plan</th>
                <th>Adults</th>
                <th>Children</th>
                <th className="text-end">Rate</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r, i) => (
                <tr key={i}>
                  <td>{r.roomNo}</td>
                  <td>{r.roomCategory}</td>
                  <td>{r.mealPlan}</td>
                  <td>{r.adults}</td>
                  <td>{r.children}</td>
                  <td className="text-end">
                    AED {Number(r.rate || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} className="text-end fw-semibold">
                  Total
                </td>
                <td className="text-end fw-semibold text-danger">
                  AED {totals.grandTotal.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </Table>
          {selectedSpecialRequests.length > 0 && (
            <p className="mb-1 small">
              <strong>Special Requests:</strong>{" "}
              {selectedSpecialRequests.join(", ")}
            </p>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-light border-0 d-flex justify-content-between">
          <Button
            variant="outline-secondary"
            disabled={submitting}
            onClick={() => setShowSummary(false)}
          >
            Edit
          </Button>
          <Button
            variant="primary"
            disabled={submitting}
            onClick={confirmAndSave}
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
                Saving...
              </>
            ) : (
              <>
                <FaCheckCircle className="me-1" /> Confirm Booking
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
