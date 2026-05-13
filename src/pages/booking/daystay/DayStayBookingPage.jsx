import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Form,
  Button,
  Row,
  Col,
  Badge,
  Modal,
  Table,
  Alert,
} from "react-bootstrap";
import { FaArrowLeft, FaCheckCircle, FaClock } from "react-icons/fa";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

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
  const [selectedSpecialRequests, setSelectedSpecialRequests] = useState([]);
  const [remarks, setRemarks] = useState("");
  const [paymentMode, setPaymentMode] = useState("Online");
  const [bookingConfirmation, setBookingConfirmation] = useState("Book & Voucher");
  const [validationErrors, setValidationErrors] = useState({});
  const [showSummary, setShowSummary] = useState(false);
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
    if (!primaryGuest.salutation) errs.salutation = "Salutation is required";
    if (!primaryGuest.firstName.trim()) errs.firstName = "First name is required";
    if (!primaryGuest.lastName.trim()) errs.lastName = "Last name is required";
    if (!primaryGuest.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryGuest.email))
      errs.email = "Invalid email";
    if (!primaryGuest.phone.trim()) errs.phone = "Phone is required";
    else if (primaryGuest.phone.trim().length > 15)
      errs.phone = "Phone cannot exceed 15 digits";
    if (!primaryGuest.agentLpo.trim()) errs.agentLpo = "Agent LPO is required";

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
    setShowSummary(true);
  };

  const confirmAndSave = async () => {
    if (!payload) return;
    setSubmitting(true);
    try {
      const body = {
        hotelId: payload.hotelId,
        agentId: Number(payload.agentId) || null,
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
        primaryGuest,
        rooms: rooms.map((r) => ({
          roomNo: r.roomNo,
          roomCategory: r.roomCategory,
          mealPlan: r.mealPlan,
          nonRefundable: r.nonRefundable,
          currency: r.currency,
          rate: r.rate,
          rateWithoutMarkup: r.rateWithoutMarkup,
          adults: r.adults,
          children: r.children,
          guests: r.guests,
        })),
        cancellationPolicy: [],
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
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4">
            <Card className="shadow-sm">
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
          </main>
        </div>
      </div>
    );
  }

  if (savedBooking) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4">
            <Card className="shadow-sm">
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
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <div className="d-flex align-items-center gap-2 mb-3">
            <Button
              variant="light"
              onClick={() => navigate(-1)}
              className="d-flex align-items-center gap-2"
            >
              <FaArrowLeft /> Back
            </Button>
            <h5 className="mb-0">Day Stay Booking</h5>
          </div>

          <Form onSubmit={handleReview} noValidate>
            <Row className="g-3">
              <Col lg={8}>
                <Card className="shadow-sm mb-3">
                  <Card.Header className="bg-white fw-semibold">
                    {payload.hotelName}
                    <Badge bg="info" className="ms-2">
                      Day Stay
                    </Badge>
                  </Card.Header>
                  <Card.Body>
                    <p className="mb-1 text-muted small">
                      📍 {payload.hotelAddress || "—"}
                    </p>
                    <Row className="mt-2">
                      <Col md={3}>
                        <div className="text-muted small">Date</div>
                        <strong>{payload.checkInDate}</strong>
                      </Col>
                      <Col md={3}>
                        <div className="text-muted small">
                          <FaClock className="me-1" />
                          Check-In
                        </div>
                        <strong>{payload.checkInTime}</strong>
                      </Col>
                      <Col md={3}>
                        <div className="text-muted small">
                          <FaClock className="me-1" />
                          Check-Out
                        </div>
                        <strong>{payload.checkOutTime}</strong>
                      </Col>
                      <Col md={3}>
                        <div className="text-muted small">Hotel Window</div>
                        <Badge bg="light" text="dark" className="border">
                          {payload.windowStart} – {payload.windowEnd}
                        </Badge>
                      </Col>
                    </Row>
                    {payload.agentId && (
                      <div className="mt-2 small">
                        Agent #{payload.agentId}
                        {agentBalance != null && (
                          <span
                            className="ms-2 fw-semibold"
                            style={{ color: "#dc3545" }}
                          >
                            Available Balance:{" "}
                            {Number(agentBalance).toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                  </Card.Body>
                </Card>

                {rooms.map((room, ri) => (
                  <Card className="shadow-sm mb-3" key={ri}>
                    <Card.Header className="bg-white fw-semibold">
                      Room {room.roomNo}{" "}
                      <Badge bg="secondary" className="ms-2">
                        {room.roomCategory}
                      </Badge>{" "}
                      <Badge bg="light" text="dark" className="ms-1 border">
                        {room.adults} Adult{room.adults > 1 ? "s" : ""}
                        {room.children
                          ? `, ${room.children} Child${
                              room.children > 1 ? "ren" : ""
                            }`
                          : ""}
                      </Badge>
                    </Card.Header>
                    <Card.Body>
                      {room.guests.map((g, gi) => {
                        const lbl = g.isChild
                          ? `Child ${gi - room.adults + 1}`
                          : `Adult ${gi + 1}`;
                        return (
                          <Row className="g-2 mb-2 align-items-end" key={gi}>
                            <Col md={1}>
                              <small className="text-muted">{lbl}</small>
                            </Col>
                            <Col md={2}>
                              <Form.Label className="mb-1">
                                Salutation *
                              </Form.Label>
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
                              <Form.Label className="mb-1">
                                First Name *
                              </Form.Label>
                              <Form.Control
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
                              />
                            </Col>
                            <Col md={2}>
                              <Form.Label className="mb-1">Middle</Form.Label>
                              <Form.Control
                                value={g.middleName}
                                onChange={(e) =>
                                  handleGuest(
                                    ri,
                                    gi,
                                    "middleName",
                                    e.target.value
                                  )
                                }
                              />
                            </Col>
                            <Col md={2}>
                              <Form.Label className="mb-1">
                                Last Name *
                              </Form.Label>
                              <Form.Control
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
                              />
                            </Col>
                            <Col md={2}>
                              <Form.Label className="mb-1">Gender</Form.Label>
                              <Form.Select
                                value={g.gender}
                                onChange={(e) =>
                                  handleGuest(
                                    ri,
                                    gi,
                                    "gender",
                                    e.target.value
                                  )
                                }
                              >
                                <option value="">--</option>
                                {GENDERS.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </Form.Select>
                            </Col>
                          </Row>
                        );
                      })}
                    </Card.Body>
                  </Card>
                ))}

                <Card className="shadow-sm mb-3">
                  <Card.Header className="bg-white fw-semibold">
                    Primary Guest
                  </Card.Header>
                  <Card.Body>
                    <Row className="g-2">
                      <Col md={2}>
                        <Form.Label>Salutation *</Form.Label>
                        <Form.Select
                          value={primaryGuest.salutation}
                          isInvalid={!!validationErrors.salutation}
                          onChange={(e) =>
                            handlePrimary("salutation", e.target.value)
                          }
                        >
                          <option value="">--</option>
                          {SALUTATIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Form.Select>
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.salutation}
                        </Form.Control.Feedback>
                      </Col>
                      <Col md={3}>
                        <Form.Label>First Name *</Form.Label>
                        <Form.Control
                          value={primaryGuest.firstName}
                          isInvalid={!!validationErrors.firstName}
                          onChange={(e) =>
                            handlePrimary("firstName", e.target.value)
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.firstName}
                        </Form.Control.Feedback>
                      </Col>
                      <Col md={2}>
                        <Form.Label>Middle</Form.Label>
                        <Form.Control
                          value={primaryGuest.middleName}
                          onChange={(e) =>
                            handlePrimary("middleName", e.target.value)
                          }
                        />
                      </Col>
                      <Col md={3}>
                        <Form.Label>Last Name *</Form.Label>
                        <Form.Control
                          value={primaryGuest.lastName}
                          isInvalid={!!validationErrors.lastName}
                          onChange={(e) =>
                            handlePrimary("lastName", e.target.value)
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.lastName}
                        </Form.Control.Feedback>
                      </Col>
                      <Col md={2}>
                        <Form.Label>Agent LPO *</Form.Label>
                        <Form.Control
                          value={primaryGuest.agentLpo}
                          isInvalid={!!validationErrors.agentLpo}
                          onChange={(e) =>
                            handlePrimary("agentLpo", e.target.value)
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.agentLpo}
                        </Form.Control.Feedback>
                      </Col>
                      <Col md={4}>
                        <Form.Label>Email *</Form.Label>
                        <Form.Control
                          type="email"
                          value={primaryGuest.email}
                          isInvalid={!!validationErrors.email}
                          onChange={(e) =>
                            handlePrimary("email", e.target.value)
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.email}
                        </Form.Control.Feedback>
                      </Col>
                      <Col md={3}>
                        <Form.Label>Phone *</Form.Label>
                        <Form.Control
                          value={primaryGuest.phone}
                          isInvalid={!!validationErrors.phone}
                          onChange={(e) =>
                            handlePrimary("phone", e.target.value)
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.phone}
                        </Form.Control.Feedback>
                      </Col>
                      <Col md={2}>
                        <Form.Label>Passport No</Form.Label>
                        <Form.Control
                          value={primaryGuest.passportNo}
                          onChange={(e) =>
                            handlePrimary("passportNo", e.target.value)
                          }
                        />
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                <Card className="shadow-sm mb-3">
                  <Card.Header className="bg-white fw-semibold">
                    Special Requests
                  </Card.Header>
                  <Card.Body>
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {SPECIAL_REQUESTS.map((req) => (
                        <Form.Check
                          key={req}
                          type="checkbox"
                          id={`spreq-${req}`}
                          label={req}
                          checked={selectedSpecialRequests.includes(req)}
                          onChange={() => toggleSpecial(req)}
                          inline
                        />
                      ))}
                    </div>
                    <Form.Label>Remarks</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                    <Row className="mt-3">
                      <Col md={6}>
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
                      </Col>
                      <Col md={6}>
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
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={4}>
                <div className="sticky-top" style={{ top: 80 }}>
                  <Card className="shadow-sm">
                    <Card.Header className="bg-danger text-white fw-semibold">
                      Price Summary
                    </Card.Header>
                    <Card.Body>
                      <Table size="sm" borderless className="mb-0">
                        <tbody>
                          {rooms.map((r, i) => (
                            <tr key={i}>
                              <td>Room {r.roomNo}</td>
                              <td className="text-end">
                                AED {Number(r.rate || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                          <tr>
                            <td className="fw-semibold">Base Total</td>
                            <td className="text-end fw-semibold">
                              AED {totals.baseTotal.toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td className="fs-5 fw-bold">Total</td>
                            <td className="text-end fs-5 fw-bold text-success">
                              AED {totals.grandTotal.toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-100 mt-3 rounded-pill"
                  >
                    Review &amp; Submit
                  </Button>
                  {Object.keys(validationErrors).length > 0 && (
                    <Alert variant="danger" className="mt-2 py-2 small">
                      Please fix the highlighted fields before submitting.
                    </Alert>
                  )}
                </div>
              </Col>
            </Row>
          </Form>
        </main>
      </div>

      <Modal
        show={showSummary}
        onHide={() => !submitting && setShowSummary(false)}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton={!submitting}>
          <Modal.Title>
            <FaCheckCircle className="text-success me-2" /> Order Summary
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
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
            <Col md={6}>
              <strong>Guest:</strong> {primaryGuest.salutation}{" "}
              {primaryGuest.firstName} {primaryGuest.lastName}
            </Col>
            <Col md={6}>
              <strong>Email:</strong> {primaryGuest.email}
            </Col>
            <Col md={6}>
              <strong>Phone:</strong> {primaryGuest.phone}
            </Col>
            <Col md={6}>
              <strong>Agent LPO:</strong> {primaryGuest.agentLpo}
            </Col>
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
                <td className="text-end fw-semibold text-success">
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
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={submitting}
            onClick={() => setShowSummary(false)}
          >
            Edit
          </Button>
          <Button
            variant="success"
            disabled={submitting}
            onClick={confirmAndSave}
          >
            {submitting ? "Saving..." : "Confirm Booking"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
