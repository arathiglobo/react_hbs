import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Accordion,
  Badge,
  Alert,
  Modal,
} from "react-bootstrap";
import {
  FaHotel,
  FaCalendarAlt,
  FaUsers,
  FaUtensils,
  FaArrowLeft,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import AgentBalanceDisplay from "../../components/AgentBalanceDisplay";
import "../../styles/HotelBookingPage.css";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";
import { toLocalDateTime } from "../../utils/dateUtils";

/**
 * LastMinuteBookingForm — booking creation page for the Last Minute flow.
 *
 * Layout mirrors HotelBookingPage.jsx:
 *   1. Top: Back button + Booking Summary card (hotel name + dates + guests
 *      + meal plan + total price).
 *   2. Guest Details accordion — one panel per room, with per-guest rows
 *      (salutation / first / middle / last / gender / child).
 *   3. Primary Guest Details card — full guest profile form.
 *   4. Special Requests card.
 *   5. Submit row at the bottom.
 *
 * Data source: react-router state (passed by /last-minute-room-list "Book")
 * carrying { ctx: { hotel, room, checkInDate, checkOutDate, nights } }.
 *
 * Hits POST /api/last-minute-booking/create on submit.
 */

const SPECIAL_REQUEST_OPTIONS = [
  "Early Check-In",
  "Non-Smoking Rooms",
  "High Floor",
  "VIP Client",
  "Late Check-In",
  "Inter-connecting rooms",
  "Low Floor",
  "Room with Bathtub",
  "Late check-Out",
  "Honeymooners / Anniversary",
  "Smoking Room",
];

const formatPrice = (price) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(
    price || 0
  );

// Rates saved in the DB already include the admin markup (it is pre-applied
// on the contract rate form). Return the base rate as-is to avoid double-applying.
const applyMarkup = (baseRate, _markupPct) => {
  return Number(baseRate || 0);
};

export default function LastMinuteBookingForm() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const ctx = state?.ctx;

  const [primaryGuest, setPrimaryGuest] = useState({
    salutation: "Mr",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    passportNo: "",
    customerNationality:
      state?.ctx?.nationalityCode || state?.ctx?.nationalityName || "",
    agentLpo: "",
  });

  // Each "room" is a single room in this booking. The Last Minute search
  // returns one rate per room slot, so we default to a 1-room booking and
  // let the user add more rooms (each room duplicates the chosen rate).
  const [rooms, setRooms] = useState(() => {
    const sr = state?.ctx?.searchRooms;
    if (Array.isArray(sr) && sr.length > 0) {
      return sr.map((r) => {
        const adults = r.adults || 1;
        const children = r.children || 0;
        const childAges = r.childAges || [];
        const guests = [];
        for (let i = 0; i < adults; i++) guests.push(defaultGuest(false));
        for (let i = 0; i < children; i++) {
          const g = defaultGuest(true);
          g.childAge = childAges[i] ?? 5;
          guests.push(g);
        }
        return { adults, children, childAges: [...childAges], guests };
      });
    }
    return [{ adults: 1, children: 0, childAges: [], guests: [defaultGuest(false)] }];
  });

  const [remarks, setRemarks] = useState("");
  const [specialRequests, setSpecialRequests] = useState([]);
  const [bookingConfirmation, setBookingConfirmation] = useState("Book & Voucher");
  const [tourismDirham, setTourismDirham] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Per-field validation errors. Keys follow the same naming convention as
  // HotelBookingPage: `room_{i}_guest_{j}_{field}` for guests, `primary_{field}`
  // for primary-guest fields.
  const [validationErrors, setValidationErrors] = useState({});

  // Order Summary modal — shown after validation passes; the actual backend
  // submit only fires on Confirm inside the modal.
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // ── Total price computed from per-night × nights × roomCount + extras ──
  const markupPct = ctx?.room?.markup || 0;
  const perNight = applyMarkup(ctx?.room?.lastMinuteRate || 0, markupPct);
  const adultRate = applyMarkup(ctx?.room?.adultRate || 0, markupPct);
  const childRate = applyMarkup(ctx?.room?.childRate || 0, markupPct);
  const nights = Number(ctx?.nights || 1);
  const totalRoomCount = rooms.length;
  const { totalPrice, extraAdults, totalChildren } = useMemo(() => {
    let extra = 0;
    let kids = 0;
    rooms.forEach((r) => {
      const a = Number(r.adults) || 1;
      const c = Number(r.children) || 0;
      extra += Math.max(0, a - 2);
      kids += c;
    });
    const base = perNight * nights * totalRoomCount;
    const adultExtra = extra * adultRate * nights;
    const childExtra = kids * childRate * nights;
    return {
      totalPrice: base + adultExtra + childExtra,
      extraAdults: extra,
      totalChildren: kids,
    };
  }, [perNight, adultRate, childRate, nights, totalRoomCount, rooms]);

  // Resync rooms[].guests array when adults/children counts change.
  useEffect(() => {
    setRooms((prev) =>
      prev.map((r) => {
        const totalGuests = (r.adults || 0) + (r.children || 0);
        const guests = [...(r.guests || [])];
        while (guests.length < totalGuests) {
          guests.push(defaultGuest(guests.length >= r.adults));
        }
        return { ...r, guests: guests.slice(0, totalGuests) };
      })
    );
  }, []); // run once after mount

  function defaultGuest(isChild) {
    return {
      salutation: "",
      firstName: "",
      middleName: "",
      lastName: "",
      gender: "",
      isChild,
    };
  }

  // ── Field handlers ──
  const setRoomCount = (count) => {
    const n = Math.max(1, Math.min(10, count));
    setRooms((prev) => {
      const out = [...prev];
      while (out.length < n) {
        out.push({ adults: 1, children: 0, childAges: [], guests: [defaultGuest(false)] });
      }
      return out.slice(0, n);
    });
  };

  const setRoomField = (idx, field, value) =>
    setRooms((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, [field]: Number(value) };
        if (field === "adults" || field === "children") {
          const totalGuests = (updated.adults || 0) + (updated.children || 0);
          const guests = [...(r.guests || [])];
          while (guests.length < totalGuests) {
            guests.push(defaultGuest(guests.length >= updated.adults));
          }
          updated.guests = guests.slice(0, totalGuests);
        }
        return updated;
      })
    );

  const setGuestField = (roomIdx, guestIdx, field, value) =>
    setRooms((prev) =>
      prev.map((r, i) => {
        if (i !== roomIdx) return r;
        const guests = r.guests.map((g, gi) =>
          gi === guestIdx ? { ...g, [field]: value } : g
        );
        return { ...r, guests };
      })
    );

  const togglePrimaryFromFirstGuest = (field, value) => {
    if (rooms[0]?.guests[0]) {
      // Mirror Room1 Adult1's salutation/firstName/lastName into primary guest.
      if (["salutation", "firstName", "lastName"].includes(field)) {
        setPrimaryGuest((p) => ({ ...p, [field]: value }));
      }
    }
  };

  // ── Validation ──
  // Walks all guests in all rooms + primary-guest fields and builds an error
  // map keyed by `room_{i}_guest_{j}_{field}` / `primary_{field}`.
  const validateAll = () => {
    const errs = {};

    // Per-room, per-guest mandatory fields: salutation, firstName, lastName, gender.
    rooms.forEach((r, ri) => {
      (r.guests || []).forEach((g, gi) => {
        if (!g.salutation || !g.salutation.trim())
          errs[`room_${ri}_guest_${gi}_salutation`] = "Required";
        if (!g.firstName || !g.firstName.trim())
          errs[`room_${ri}_guest_${gi}_firstName`] = "Required";
        if (!g.lastName || !g.lastName.trim())
          errs[`room_${ri}_guest_${gi}_lastName`] = "Required";
        if (!g.gender || !g.gender.trim())
          errs[`room_${ri}_guest_${gi}_gender`] = "Required";
        if (g.isChild && (g.childAge == null || g.childAge === ""))
          errs[`room_${ri}_guest_${gi}_childAge`] = "Required";
      });
    });

    // Primary guest mandatory fields.
    if (!primaryGuest.salutation || !primaryGuest.salutation.trim())
      errs.primary_salutation = "Required";
    if (!primaryGuest.firstName || !primaryGuest.firstName.trim())
      errs.primary_firstName = "Required";
    if (!primaryGuest.lastName || !primaryGuest.lastName.trim())
      errs.primary_lastName = "Required";
    if (!primaryGuest.email || !primaryGuest.email.trim())
      errs.primary_email = "Required";
    else if (!/^\S+@\S+\.\S+$/.test(primaryGuest.email))
      errs.primary_email = "Invalid email";
    if (!primaryGuest.phone || !primaryGuest.phone.trim())
      errs.primary_phone = "Required";

    return errs;
  };

  // ── Confirm flow ──
  // Step 1 — click "Confirm Booking" on the form: validate, then OPEN the
  // Order Summary modal (no backend call yet).
  const handleConfirmClick = (e) => {
    e?.preventDefault?.();
    setError(null);
    if (!ctx?.room?.lastMinuteRateId) {
      setError("Missing rate context. Go back and pick a room again.");
      return;
    }
    const errs = validateAll();
    setValidationErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = Object.values(errs)[0];
      toast.error(first === "Required"
        ? "Please fill all mandatory fields."
        : first);
      return;
    }
    setShowSummaryModal(true);
  };

  // Step 2 — click "Confirm" inside the Order Summary modal: actually POST
  // and on success redirect to the new last-minute booking list page.
  const handleConfirmFromModal = async () => {
    setError(null);

    const agentId =
      (ctx?.agentId && String(ctx.agentId)) ||
      localStorage.getItem("userId") ||
      localStorage.getItem("agentId") ||
      "0";
    const createdByRole =
      localStorage.getItem("currentActiveRole") || "agent";

    const customerWithNationality = {
      ...primaryGuest,
      customerNationality:
        primaryGuest.customerNationality ||
        ctx?.nationalityCode ||
        ctx?.nationalityName ||
        "",
    };

    const payload = {
      lastMinuteRateId: ctx.room.lastMinuteRateId,
      checkInDate: toLocalDateTime(ctx.checkInDate),
      checkOutDate: toLocalDateTime(ctx.checkOutDate),
      agentId,
      nationalityId: ctx?.nationalityId ?? null,
      createdByRole,
      tourismDirham:
        tourismDirham !== "" && !isNaN(Number(tourismDirham))
          ? Number(tourismDirham)
          : null,
      customer: customerWithNationality,
      rooms: rooms.map((r) => ({
        adults: Number(r.adults) || 1,
        children: Number(r.children) || 0,
        guests: (r.guests || []).map((g) => ({
          salutation: g.salutation,
          firstName: g.firstName,
          lastName: g.lastName,
          gender: g.gender,
          isChild: g.isChild,
          childAge: g.isChild ? Number(g.childAge) || 5 : null,
        })),
      })),
      remarks:
        [remarks, specialRequests.length ? `Requests: ${specialRequests.join(", ")}` : null]
          .filter(Boolean)
          .join("\n") || null,
    };

    try {
      setSubmitting(true);
      const res = await axiosInstance.post(
        "/api/last-minute-booking/create",
        payload
      );
      if (res.data?.success) {
        toast.success("Last Minute booking created");
        setShowSummaryModal(false);
        navigate("/booking-details/last-minute-booking-list");
      } else {
        const msg = res.data?.message || "Booking failed";
        setError(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || "Booking failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Fallback when context is missing ──
  if (!ctx) {
    return (
      <Layout>
        <Card className="shadow-sm">
          <Card.Body className="text-center">
            <p>No room selected.</p>
            <Button
              onClick={() => navigate("/new-booking/last-minute-booking")}
              style={{ backgroundColor: "#c0392b", border: "none" }}
            >
              Back to Search
            </Button>
          </Card.Body>
        </Card>
      </Layout>
    );
  }

  const hotel = ctx.hotel || {};
  const room = ctx.room || {};

  return (
    <Layout>
      <Container fluid>
        {/* Back button + page title */}
        <div className="d-flex align-items-center gap-2 mb-3">
          <Button
            variant="light"
            onClick={() => navigate(-1)}
            className="d-flex align-items-center gap-2"
          >
            <FaArrowLeft /> Back
          </Button>
          <h5 className="mb-0">Last Minute Booking — Confirm Details</h5>
          <Badge bg="warning" text="dark" className="ms-2">
            LAST MINUTE
          </Badge>
          <div className="ms-auto">
            <AgentBalanceDisplay agentId={ctx?.agentId} />
          </div>
        </div>

        {/* ── Booking Summary card (HotelBookingPage style) ── */}
        <Row>
          <Col xs={12}>
            <Card className="shadow-lg rounded-xl mb-3 booking-summary-card border-0 overflow-hidden">
              <Card.Header className="bg-gradient-secondary text-black py-2 rounded-top">
                <h4 className="mb-0 d-flex align-items-center">
                  <FaHotel className="me-1 fs-4" /> Booking Summary
                </h4>
              </Card.Header>
              <Card.Body className="p-4 bg-light">
                <Row className="gy-4">
                  <Col md={6} lg={4}>
                    <div className="hotel-info-card p-3 bg-white rounded shadow-sm h-100">
                      <h5 className="fw-bold text-primary mb-3">
                        {hotel.hotelName}
                      </h5>
                      <p className="text-muted mb-2 d-flex align-items-start">
                        <i className="bi bi-geo-alt-fill me-2 mt-1 text-primary"></i>
                        {hotel.address || "—"}
                      </p>
                      <div className="d-flex align-items-center mb-2 flex-wrap gap-2">
                        {hotel.starRating != null && (
                          <span className="badge bg-warning text-dark">
                            ⭐ {hotel.starRating} Star
                          </span>
                        )}
                        <Badge bg="danger">Non-Refundable</Badge>
                        {room.rateCode && (
                          <Badge bg="secondary">{room.rateCode}</Badge>
                        )}
                      </div>
                    </div>
                  </Col>
                  <Col md={6} lg={2}>
                    <div className="info-card p-3 bg-white rounded shadow-sm h-100 text-center">
                      <FaCalendarAlt className="me-2 text-primary fs-5 mb-2" />
                      <h6 className="fw-bold text-primary mb-2">Check-in</h6>
                      <p className="mb-0 fw-semibold text-dark">
                        {ctx.checkInDate}
                      </p>
                    </div>
                  </Col>
                  <Col md={6} lg={2}>
                    <div className="info-card p-3 bg-white rounded shadow-sm h-100 text-center">
                      <FaCalendarAlt className="me-2 text-primary fs-5 mb-2" />
                      <h6 className="fw-bold text-primary mb-2">Check-out</h6>
                      <p className="mb-0 fw-semibold text-dark">
                        {ctx.checkOutDate}
                      </p>
                    </div>
                  </Col>
                  <Col md={6} lg={2}>
                    <div className="info-card p-3 bg-white rounded shadow-sm h-100 text-center">
                      <FaUsers className="me-2 text-primary fs-5 mb-2" />
                      <h6 className="fw-bold text-primary mb-2">Guests</h6>
                      <div className="text-start">
                        {rooms.map((r, i) => (
                          <div key={i} className="mb-1">
                            <small className="fw-semibold text-dark">
                              Room {i + 1}: {r.adults} Adult
                              {r.adults !== 1 ? "s" : ""}
                              {r.children
                                ? `, ${r.children} Child${r.children !== 1 ? "ren" : ""}`
                                : ""}
                            </small>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Col>
                  <Col md={6} lg={2}>
                    <div className="info-card p-3 bg-white rounded shadow-sm h-100 text-center">
                      <FaUtensils className="me-2 text-primary fs-5 mb-2" />
                      <h6 className="fw-bold text-primary mb-2">Meal Plan</h6>
                      <p className="mb-0 fw-semibold text-dark">
                        {room.mealPlanName || `#${room.mealPlanId || ""}`}
                      </p>
                    </div>
                  </Col>
                </Row>

                <hr className="my-4" />

                <div className="pricing-section p-3 bg-gradient-success text-white rounded shadow-sm">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">
                      Total Price ({nights} night{nights !== 1 ? "s" : ""} × {totalRoomCount} room{totalRoomCount !== 1 ? "s" : ""})
                    </h5>
                    <h4 className="mb-0 fw-bold">{formatPrice(totalPrice)}</h4>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {error && (
          <Alert variant="danger" className="py-2 mb-3">
            {error}
          </Alert>
        )}

        {/* ── Form ── */}
        <Form onSubmit={handleConfirmClick} noValidate>
        

          {/* ── Guest Details accordion ── */}
          <Card className="mb-2 shadow-sm border-0">
            <Card.Header className="bg-light text-center py-3">
              <h5 className="mb-0 fw-bold text-dark">Guest Details</h5>
            </Card.Header>
            <Card.Body className="p-0">
              <Accordion defaultActiveKey="0">
                {rooms.map((r, roomIdx) => (
                  <Accordion.Item
                    key={roomIdx}
                    eventKey={String(roomIdx)}
                    className="mb-3"
                  >
                    <Accordion.Header className="bg-primary text-white">
                      <h6 className="mb-0 fw-bold">
                        Room {roomIdx + 1} -{" "}
                        {room.roomCategoryName || `Category #${room.roomCategoryId}`}{" "}
                        ({room.roomTypeName || `Type #${room.roomTypeId}`})
                         ({r.adults} Adult{r.adults !== 1 ? "s" : ""} ,  {r.children} Child{r.children !== 1 ? "ren" : ""})
                      </h6>
                    </Accordion.Header>
                    <Accordion.Body className="p-3">
                    

                      {/* Per-guest rows */}
                      {r.guests.map((g, gIdx) => (
                        <div key={gIdx} className="guest-row mb-2 p-2 border rounded">
                          <Row className="align-items-center g-2">
                            <Col md={2}>
                              <span className="fw-semibold text-muted small">
                                {g.isChild
                                  ? `Child ${gIdx - r.adults + 1}`
                                  : `Adult ${gIdx + 1}`}{" "}
                                *
                              </span>
                            </Col>
                            <Col md={2}>
                              <Form.Select
                                size="sm"
                                value={g.salutation}
                                isInvalid={!!validationErrors[`room_${roomIdx}_guest_${gIdx}_salutation`]}
                                onChange={(e) => {
                                  setGuestField(roomIdx, gIdx, "salutation", e.target.value);
                                  if (roomIdx === 0 && gIdx === 0)
                                    togglePrimaryFromFirstGuest("salutation", e.target.value);
                                }}
                              >
                                <option value="">SELECT</option>
                                <option value="Mr">Mr</option>
                                <option value="Mrs">Mrs</option>
                                <option value="Ms">Ms</option>
                                <option value="Master">Master</option>
                              </Form.Select>
                              <Form.Control.Feedback type="invalid">
                                {validationErrors[`room_${roomIdx}_guest_${gIdx}_salutation`]}
                              </Form.Control.Feedback>
                            </Col>
                            <Col md={3}>
                              <Form.Control
                                size="sm"
                                placeholder="First Name *"
                                value={g.firstName}
                                isInvalid={!!validationErrors[`room_${roomIdx}_guest_${gIdx}_firstName`]}
                                onChange={(e) => {
                                  setGuestField(roomIdx, gIdx, "firstName", e.target.value);
                                  if (roomIdx === 0 && gIdx === 0)
                                    togglePrimaryFromFirstGuest("firstName", e.target.value);
                                }}
                              />
                              <Form.Control.Feedback type="invalid">
                                {validationErrors[`room_${roomIdx}_guest_${gIdx}_firstName`]}
                              </Form.Control.Feedback>
                            </Col>
                            <Col md={2}>
                              <Form.Control
                                size="sm"
                                placeholder="Middle Name"
                                value={g.middleName}
                                onChange={(e) =>
                                  setGuestField(roomIdx, gIdx, "middleName", e.target.value)
                                }
                              />
                            </Col>
                            <Col md={3}>
                              <Form.Control
                                size="sm"
                                placeholder="Last Name *"
                                value={g.lastName}
                                isInvalid={!!validationErrors[`room_${roomIdx}_guest_${gIdx}_lastName`]}
                                onChange={(e) => {
                                  setGuestField(roomIdx, gIdx, "lastName", e.target.value);
                                  if (roomIdx === 0 && gIdx === 0)
                                    togglePrimaryFromFirstGuest("lastName", e.target.value);
                                }}
                              />
                              <Form.Control.Feedback type="invalid">
                                {validationErrors[`room_${roomIdx}_guest_${gIdx}_lastName`]}
                              </Form.Control.Feedback>
                            </Col>
                          </Row>
                          <Row className="align-items-center g-2 mt-1">
                            <Col md={{ offset: 2, span: 3 }}>
                              <Form.Select
                                size="sm"
                                value={g.gender}
                                isInvalid={!!validationErrors[`room_${roomIdx}_guest_${gIdx}_gender`]}
                                onChange={(e) =>
                                  setGuestField(roomIdx, gIdx, "gender", e.target.value)
                                }
                              >
                                <option value="">Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                              </Form.Select>
                              <Form.Control.Feedback type="invalid">
                                {validationErrors[`room_${roomIdx}_guest_${gIdx}_gender`]}
                              </Form.Control.Feedback>
                            </Col>
                            {g.isChild && (
                              <Col md={3}>
                                <Form.Control
                                  size="sm"
                                  type="number"
                                  min="0"
                                  max="17"
                                  placeholder="Child age *"
                                  value={g.childAge || ""}
                                  isInvalid={!!validationErrors[`room_${roomIdx}_guest_${gIdx}_childAge`]}
                                  onChange={(e) =>
                                    setGuestField(roomIdx, gIdx, "childAge", e.target.value)
                                  }
                                />
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors[`room_${roomIdx}_guest_${gIdx}_childAge`]}
                                </Form.Control.Feedback>
                              </Col>
                            )}
                          </Row>
                        </div>
                      ))}
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Card.Body>
          </Card>

          {/* ── Primary Guest ── */}
          <Card className="mb-2 shadow-sm border-0">
            <Card.Body className="p-3">
              <h5 className="mb-3 fw-bold">Primary Guest Details</h5>
              <Row className="g-2">
                <Col md={2}>
                  <Form.Label>Salutation *</Form.Label>
                  <Form.Select
                    value={primaryGuest.salutation}
                    isInvalid={!!validationErrors.primary_salutation}
                    onChange={(e) =>
                      setPrimaryGuest({ ...primaryGuest, salutation: e.target.value })
                    }
                  >
                    <option value="">SELECT</option>
                    <option value="Mr">Mr</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Ms">Ms</option>
                    <option value="Dr">Dr</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.primary_salutation}
                  </Form.Control.Feedback>
                </Col>
                <Col md={3}>
                  <Form.Label>First Name *</Form.Label>
                  <Form.Control
                    value={primaryGuest.firstName}
                    isInvalid={!!validationErrors.primary_firstName}
                    onChange={(e) =>
                      setPrimaryGuest({ ...primaryGuest, firstName: e.target.value })
                    }
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.primary_firstName}
                  </Form.Control.Feedback>
                </Col>
                <Col md={3}>
                  <Form.Label>Middle Name</Form.Label>
                  <Form.Control
                    value={primaryGuest.middleName}
                    onChange={(e) =>
                      setPrimaryGuest({ ...primaryGuest, middleName: e.target.value })
                    }
                  />
                </Col>
                <Col md={4}>
                  <Form.Label>Last Name *</Form.Label>
                  <Form.Control
                    value={primaryGuest.lastName}
                    isInvalid={!!validationErrors.primary_lastName}
                    onChange={(e) =>
                      setPrimaryGuest({ ...primaryGuest, lastName: e.target.value })
                    }
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.primary_lastName}
                  </Form.Control.Feedback>
                </Col>
              </Row>
              <Row className="g-2 mt-2">
                <Col md={4}>
                  <Form.Label>Email *</Form.Label>
                  <Form.Control
                    type="email"
                    value={primaryGuest.email}
                    isInvalid={!!validationErrors.primary_email}
                    onChange={(e) =>
                      setPrimaryGuest({ ...primaryGuest, email: e.target.value })
                    }
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.primary_email}
                  </Form.Control.Feedback>
                </Col>
                <Col md={4}>
                  <Form.Label>Phone *</Form.Label>
                  <Form.Control
                    value={primaryGuest.phone}
                    isInvalid={!!validationErrors.primary_phone}
                    onChange={(e) =>
                      setPrimaryGuest({ ...primaryGuest, phone: e.target.value })
                    }
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.primary_phone}
                  </Form.Control.Feedback>
                </Col>
                {/* <Col md={4}>
                  <Form.Label>Nationality</Form.Label>
                  <Form.Control
                    value={primaryGuest.customerNationality}
                    onChange={(e) =>
                      setPrimaryGuest({
                        ...primaryGuest,
                        customerNationality: e.target.value,
                      })
                    }
                  />
                </Col> */}
              </Row>
              <Row className="g-2 mt-2">
                <Col md={4}>
                  <Form.Label>Passport No.</Form.Label>
                  <Form.Control
                    value={primaryGuest.passportNo}
                    onChange={(e) =>
                      setPrimaryGuest({ ...primaryGuest, passportNo: e.target.value })
                    }
                  />
                </Col>
                {/* Agent LPO — hidden for Last Minute bookings (kept in state
                    so the existing payload mapping still works). */}
                <Col md={4} style={{ display: "none" }}>
                  <Form.Label>Agent LPO</Form.Label>
                  <Form.Control
                    value={primaryGuest.agentLpo}
                    onChange={(e) =>
                      setPrimaryGuest({ ...primaryGuest, agentLpo: e.target.value })
                    }
                  />
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* ── Special Requests ── mirrors HotelBookingPage's grid layout */}
          <Card className="p-4 mb-2 shadow-sm border-0">
            <h5 className="mb-3 fw-bold">Special Requests</h5>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Tourism Dirhams (AED)</Form.Label>
                  <Form.Control
                    type="number"
                    value={tourismDirham}
                    onChange={(e) => setTourismDirham(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Special Request</Form.Label>
                  <div className="special-request-grid">
                    {SPECIAL_REQUEST_OPTIONS.map((opt) => (
                      <Form.Check
                        key={opt}
                        type="checkbox"
                        id={`lm-sr-${opt.replace(/[^a-zA-Z0-9]/g, "-")}`}
                        label={opt}
                        checked={specialRequests.includes(opt)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setSpecialRequests([...specialRequests, opt]);
                          else
                            setSpecialRequests(
                              specialRequests.filter((x) => x !== opt)
                            );
                        }}
                        className="mb-2 special-request-check"
                      />
                    ))}
                  </div>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Label>Booking Confirmation</Form.Label>
                <Form.Select
                  value={bookingConfirmation}
                  onChange={(e) => setBookingConfirmation(e.target.value)}
                >
                  <option>Book & Voucher</option>
                  <option>Book on Hold</option>
                </Form.Select>
              </Col>
            </Row>
          </Card>

          {/* ── Submit row ── */}
          <Card className="shadow-sm border-0 mb-4">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small">Total payable</div>
                <h4 className="mb-0 text-success fw-bold">
                  {formatPrice(
                    Number(totalPrice || 0) +
                      (tourismDirham !== "" && !isNaN(Number(tourismDirham))
                        ? Number(tourismDirham)
                        : 0)
                  )}
                </h4>
              </div>
              <div className="d-flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  style={{ backgroundColor: "#c0392b", border: "none" }}
                  size="lg"
                >
                  {submitting ? "Booking…" : "Confirm Booking"}
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Form>

        {/* ── Order Summary Modal — mirrors /hotel-booking-page confirm modal */}
        <Modal
          show={showSummaryModal}
          onHide={() => !submitting && setShowSummaryModal(false)}
          centered
          backdrop="static"
          size="md"
        >
          <Modal.Header
            closeButton={!submitting}
            className="bg-primary text-white py-2"
            style={{ borderBottom: "none" }}
          >
            <Modal.Title className="fw-semibold d-flex align-items-center">
              <FaHotel className="me-2" /> Confirm Your Booking
            </Modal.Title>
          </Modal.Header>

          <Modal.Body className="px-4 py-3 bg-light">
            <div className="border rounded-3 bg-white shadow-sm p-3">
              <div className="mb-3">
                <h5 className="fw-bold text-primary mb-2">
                  {hotel.hotelName}
                </h5>
                <p className="text-muted mb-0">{hotel.address || "—"}</p>
              </div>

              <hr />

              <Row className="gy-2">
                <Col xs={6}>
                  <p className="mb-1">
                    <strong>Check-In:</strong>
                    <br />
                    <span className="text-dark">{ctx.checkInDate}</span>
                  </p>
                </Col>
                <Col xs={6}>
                  <p className="mb-1">
                    <strong>Check-Out:</strong>
                    <br />
                    <span className="text-dark">{ctx.checkOutDate}</span>
                  </p>
                </Col>
                <Col xs={6}>
                  <p className="mb-1">
                    <strong>Rooms:</strong> {totalRoomCount}
                  </p>
                </Col>
                <Col xs={6}>
                  <p className="mb-1">
                    <strong>Nights:</strong> {nights}
                  </p>
                </Col>
                <Col xs={12}>
                  <p className="mb-1">
                    <strong>Primary Guest:</strong>{" "}
                    {[primaryGuest.salutation, primaryGuest.firstName,
                      primaryGuest.middleName, primaryGuest.lastName]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                  <p className="mb-0 text-muted small">
                    {primaryGuest.email} · {primaryGuest.phone}
                  </p>
                </Col>
                {specialRequests.length > 0 && (
                  <Col xs={12}>
                    <p className="mb-1">
                      <strong>Special Requests:</strong>
                    </p>
                    <p className="mb-0 text-muted small">
                      {specialRequests.join(", ")}
                    </p>
                  </Col>
                )}
                <Col xs={12}>
                  <div className="p-3 rounded bg-gradient-success text-white text-center mt-2">
                    <h6 className="mb-0 fw-bold">Total Price</h6>
                    <h4 className="mb-0">
                      {formatPrice(
                        Number(totalPrice || 0) +
                          (tourismDirham !== "" && !isNaN(Number(tourismDirham))
                            ? Number(tourismDirham)
                            : 0)
                      )}{" "}
                      for {totalRoomCount}{" "}
                      {totalRoomCount > 1 ? "rooms" : "room"}
                    </h4>
                  </div>
                </Col>
              </Row>

              <div className="mt-3 p-3 bg-white border rounded">
                <h6 className="fw-bold mb-2">Rate Split</h6>
                <div className="d-flex justify-content-between">
                  <span>Selling Price</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Tourism Dirhams</span>
                  <span>
                    {formatPrice(
                      tourismDirham !== "" && !isNaN(Number(tourismDirham))
                        ? Number(tourismDirham)
                        : 0
                    )}
                  </span>
                </div>
                <hr className="my-2" />
                <div className="d-flex justify-content-between fw-bold text-danger">
                  <span>Total (Selling + TD)</span>
                  <span>
                    {formatPrice(
                      Number(totalPrice || 0) +
                        (tourismDirham !== "" && !isNaN(Number(tourismDirham))
                          ? Number(tourismDirham)
                          : 0)
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-4 text-center">
                <p className="text-muted small mb-0">
                  Please review the booking details carefully before
                  confirming.
                </p>
              </div>
            </div>

            {error && (
              <Alert variant="danger" className="mt-3 mb-0">
                {error}
              </Alert>
            )}
          </Modal.Body>

          <Modal.Footer className="bg-light border-0 d-flex justify-content-between">
            <Button
              variant="outline-secondary"
              onClick={() => setShowSummaryModal(false)}
              disabled={submitting}
            >
              <i className="bi bi-x-circle me-1"></i> Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmFromModal}
              disabled={submitting}
              className="px-4 fw-semibold"
            >
              {submitting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                  ></span>
                  Processing...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-1"></i> Confirm
                </>
              )}
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </Layout>
  );
}

function Layout({ children }) {
  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
