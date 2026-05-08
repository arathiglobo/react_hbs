import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Form,
  Button,
  Row,
  Col,
  Spinner,
  Badge,
  Table,
  Modal,
  Accordion,
} from "react-bootstrap";
import { FaHotel } from "react-icons/fa";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import { toast } from "react-hot-toast";
import { toLocalDateTime, formatDateTime } from "../../utils/dateUtils";

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
  const [remarks, setRemarks] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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
      .get("/api/agent")
      .then((res) => setAgents(res.data || []))
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    if (!draft) return;
    const fetchQuote = async () => {
      try {
        setQuoteError(null);
        const res = await axiosInstance.post("/api/longStayBooking/quote", {
          hotelId: draft.hotelId,
          longStayRoomId: draft.room.longStayRoomId,
          checkInDate: toLocalDateTime(draft.checkIn),
          checkOutDate: toLocalDateTime(draft.checkOut),
        });
        setQuote(res.data);
      } catch (err) {
        const msg = err.response?.data?.message || err.message || "Could not compute quote";
        setQuoteError(msg);
        setQuote(null);
      }
    };
    fetchQuote();
  }, [draft]);

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
    // Auto-populate primary guest from Room 1 Adult 1
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
    if (!primaryGuest.salutation) e.salutation = "Salutation is required";
    if (!primaryGuest.firstName.trim()) e.firstName = "First name is required";
    if (!primaryGuest.lastName.trim()) e.lastName = "Last name is required";
    if (!primaryGuest.email.trim()) {
      e.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryGuest.email.trim())) {
      e.email = "Enter a valid email";
    }
    if (!primaryGuest.phone.trim()) {
      e.phone = "Phone is required";
    } else if (!/^[+0-9\s\-()]{7,}$/.test(primaryGuest.phone.trim())) {
      e.phone = "Enter a valid phone";
    }
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
    setShowConfirmModal(true);
  };

  const confirmBooking = async () => {
    try {
      setSubmitting(true);
      const fullName = [
        primaryGuest.salutation,
        primaryGuest.firstName,
        primaryGuest.middleName,
        primaryGuest.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      const payload = {
        hotelId: draft.hotelId,
        longStayContractId: draft.contract.longStayContractId,
        longStayRoomId: draft.room.longStayRoomId,
        agentId: agentId ? Number(agentId) : null,
        checkInDate: toLocalDateTime(draft.checkIn),
        checkOutDate: toLocalDateTime(draft.checkOut),
        primaryGuestName: fullName,
        primaryGuestEmail: primaryGuest.email.trim(),
        primaryGuestPhone: primaryGuest.phone.trim(),
        nationality: primaryGuest.nationality || null,
        remarks: remarks || null,
        primaryGuestDetails: {
          salutation: primaryGuest.salutation,
          firstName: primaryGuest.firstName.trim(),
          middleName: primaryGuest.middleName?.trim() || null,
          lastName: primaryGuest.lastName.trim(),
          email: primaryGuest.email.trim(),
          phone: primaryGuest.phone.trim(),
          passportNo: primaryGuest.passportNo?.trim() || null,
          nationality: primaryGuest.nationality || null,
          gender: primaryGuest.gender || null,
        },
        rooms: rooms.map((room) => ({
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
          })),
        })),
      };
      const res = await axiosInstance.post("/api/longStayBooking/create", payload);
      toast.success(`Booking confirmed: ${res.data.bookingCode}`);
      sessionStorage.removeItem("longStayBookingDraft");
      setShowConfirmModal(false);
      navigate("/booking-details/long-stay-booking-list");
    } catch (err) {
      toast.error(`Booking failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft) return null;
  const fmt = (n) => (n == null ? "-" : Number(n).toFixed(2));

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <div className="p-4 flex-grow-1">
          <h4 className="mb-3">Long Stay Booking — Confirmation</h4>

          <Row>
            <Col md={7}>
              <Card className="p-3 mb-3">
                <h5 className="mb-3">Stay Details</h5>
                <p className="mb-1">
                  <strong>Hotel:</strong> {draft.hotelName} (id {draft.hotelId})
                </p>
                <p className="mb-1">
                  <strong>Selected contract:</strong> {draft.contract.rateCode}{" "}
                  <Badge bg="info">
                    {draft.contract.additionalCostType === "WEEKLY" ? "Weekly" : "Day-wise"}
                  </Badge>
                </p>
                <p className="mb-1">
                  <strong>Room Category:</strong>{" "}
                  {draft.room.roomCategoryName ||
                    `Category #${draft.room.hotelRoomCategoryId}`}
                </p>
                <p className="mb-1">
                  <strong>Meal Plan:</strong>{" "}
                  {draft.room.roomTypeName ||
                    (draft.room.meal ? "Meal included" : "Room only")}
                </p>
                <p className="mb-1">
                  <strong>Occupancy:</strong>{" "}
                  {draft.room.occupancyTypeName || `Occ-${draft.room.occupancyTypeId}`}
                </p>
                <p className="mb-1">
                  <strong>Refund:</strong>{" "}
                  {draft.room.refundable ? (
                    <Badge bg="success">Flexible</Badge>
                  ) : (
                    <Badge bg="danger">Non-Refundable</Badge>
                  )}
                </p>
                <p className="mb-1">
                  <strong>Check-in:</strong> {formatDateTime(draft.checkIn)}
                </p>
                <p className="mb-1">
                  <strong>Check-out:</strong> {formatDateTime(draft.checkOut)}
                </p>
              </Card>

              {/* Passenger / Guest details */}
              <Card className="mb-3 shadow-sm border-0">
                <Card.Header className="bg-light">
                  <h5 className="mb-0 fw-bold">Guest Details</h5>
                </Card.Header>
                <Card.Body className="p-0">
                  <Accordion defaultActiveKey="0">
                    {rooms.map((room, rIdx) => (
                      <Accordion.Item key={rIdx} eventKey={String(rIdx)}>
                        <Accordion.Header>
                          <strong>
                            Room {rIdx + 1} — {room.adults} Adult
                            {room.adults > 1 ? "s" : ""}
                            {room.children > 0
                              ? `, ${room.children} Child${room.children > 1 ? "ren" : ""}`
                              : ""}
                          </strong>
                        </Accordion.Header>
                        <Accordion.Body>
                          {room.guests.map((g, gIdx) => (
                            <div key={gIdx} className="mb-3">
                              <Row className="g-2 align-items-center">
                                <Col md={2}>
                                  <span className="fw-semibold text-muted small">
                                    {g.isChild
                                      ? `Child ${gIdx - room.adults + 1} (Age ${
                                          room.childAges[gIdx - room.adults] ?? "-"
                                        })`
                                      : `Adult ${gIdx + 1}`}
                                    {" *"}
                                  </span>
                                </Col>
                                <Col md={2}>
                                  <Form.Select
                                    size="sm"
                                    value={g.salutation}
                                    isInvalid={!!errors[`r${rIdx}_g${gIdx}_salutation`]}
                                    onChange={(e) =>
                                      handleGuestChange(rIdx, gIdx, "salutation", e.target.value)
                                    }
                                  >
                                    <option value="">Sal *</option>
                                    <option value="Mr">Mr</option>
                                    <option value="Mrs">Mrs</option>
                                    <option value="Ms">Ms</option>
                                    <option value="Master">Master</option>
                                  </Form.Select>
                                </Col>
                                <Col md={3}>
                                  <Form.Control
                                    size="sm"
                                    placeholder="First Name *"
                                    value={g.firstName}
                                    isInvalid={!!errors[`r${rIdx}_g${gIdx}_firstName`]}
                                    onChange={(e) =>
                                      handleGuestChange(rIdx, gIdx, "firstName", e.target.value)
                                    }
                                  />
                                </Col>
                                <Col md={3}>
                                  <Form.Control
                                    size="sm"
                                    placeholder="Last Name *"
                                    value={g.lastName}
                                    isInvalid={!!errors[`r${rIdx}_g${gIdx}_lastName`]}
                                    onChange={(e) =>
                                      handleGuestChange(rIdx, gIdx, "lastName", e.target.value)
                                    }
                                  />
                                </Col>
                                <Col md={2}>
                                  <Form.Select
                                    size="sm"
                                    value={g.gender}
                                    onChange={(e) =>
                                      handleGuestChange(rIdx, gIdx, "gender", e.target.value)
                                    }
                                  >
                                    <option value="">Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                  </Form.Select>
                                </Col>
                              </Row>
                            </div>
                          ))}
                        </Accordion.Body>
                      </Accordion.Item>
                    ))}
                  </Accordion>
                </Card.Body>
              </Card>

              {/* Primary Guest */}
              <Card className="p-3 mb-3 shadow-sm border-0">
                <h5 className="mb-3 fw-bold">Primary Guest Details</h5>
                <Row className="g-3">
                  <Col md={3}>
                    <Form.Label>
                      <span style={{ color: "red" }}>*</span>Salutation
                    </Form.Label>
                    <Form.Select
                      value={primaryGuest.salutation}
                      isInvalid={!!errors.salutation}
                      onChange={(e) => handlePrimaryGuestChange("salutation", e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Ms">Ms</option>
                      <option value="Dr">Dr</option>
                    </Form.Select>
                  </Col>
                  <Col md={3}>
                    <Form.Label>
                      <span style={{ color: "red" }}>*</span>First Name
                    </Form.Label>
                    <Form.Control
                      value={primaryGuest.firstName}
                      isInvalid={!!errors.firstName}
                      onChange={(e) => handlePrimaryGuestChange("firstName", e.target.value)}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Middle Name</Form.Label>
                    <Form.Control
                      value={primaryGuest.middleName}
                      onChange={(e) => handlePrimaryGuestChange("middleName", e.target.value)}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>
                      <span style={{ color: "red" }}>*</span>Last Name
                    </Form.Label>
                    <Form.Control
                      value={primaryGuest.lastName}
                      isInvalid={!!errors.lastName}
                      onChange={(e) => handlePrimaryGuestChange("lastName", e.target.value)}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>
                      <span style={{ color: "red" }}>*</span>Email
                    </Form.Label>
                    <Form.Control
                      type="email"
                      value={primaryGuest.email}
                      isInvalid={!!errors.email}
                      onChange={(e) => handlePrimaryGuestChange("email", e.target.value)}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>
                      <span style={{ color: "red" }}>*</span>Phone
                    </Form.Label>
                    <Form.Control
                      value={primaryGuest.phone}
                      isInvalid={!!errors.phone}
                      onChange={(e) => handlePrimaryGuestChange("phone", e.target.value)}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Passport No</Form.Label>
                    <Form.Control
                      value={primaryGuest.passportNo}
                      onChange={(e) => handlePrimaryGuestChange("passportNo", e.target.value)}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Nationality</Form.Label>
                    <Form.Control
                      maxLength={2}
                      value={primaryGuest.nationality}
                      onChange={(e) =>
                        handlePrimaryGuestChange("nationality", e.target.value.toUpperCase())
                      }
                    />
                  </Col>
                  <Col md={12}>
                    <Form.Label>Remarks</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>

            <Col md={5}>
              <Card className="p-3 mb-3">
                <h5 className="mb-3">Price Breakdown</h5>
                {quoteError ? (
                  <div className="alert alert-danger mb-0">{quoteError}</div>
                ) : !quote ? (
                  <Spinner animation="border" />
                ) : (
                  <>
                    <div className="d-flex justify-content-between mb-1">
                      <span>Total nights</span>
                      <strong>{quote.totalNights}</strong>
                    </div>

                    {quote.contractsUsed && quote.contractsUsed.length > 1 && (
                      <div className="alert alert-info p-2 small mb-2">
                        Booking spans <strong>{quote.contractsUsed.length}</strong> contract validities.
                        Days are billed pro-rata against each.
                      </div>
                    )}

                    {quote.months && quote.months.length > 0 && (
                      <>
                        <h6 className="mt-2 mb-1">30-day month chunks</h6>
                        {quote.months.map((m) => (
                          <Card key={m.monthIndex} className="p-2 mb-2 border-info">
                            <div className="d-flex justify-content-between">
                              <strong>Month {m.monthIndex}</strong>
                              <span className="text-success fw-bold">{fmt(m.amount)}</span>
                            </div>
                            <small className="text-muted">
                              {m.from} → {m.to}
                            </small>
                            {m.slices && m.slices.length > 0 && (
                              <Table size="sm" className="mt-2 mb-0">
                                <thead>
                                  <tr>
                                    <th>Validity</th>
                                    <th>Days</th>
                                    <th className="text-end">Sub-total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {m.slices.map((s, i) => (
                                    <tr key={i}>
                                      <td>{s.rateCode}</td>
                                      <td>{s.days}</td>
                                      <td className="text-end">{fmt(s.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            )}
                          </Card>
                        ))}
                      </>
                    )}

                    {quote.remainder && quote.remainder.days > 0 && (
                      <Card className="p-2 mb-2 border-warning">
                        <div className="d-flex justify-content-between">
                          <strong>
                            Remainder ({quote.remainder.days} day
                            {quote.remainder.days > 1 ? "s" : ""},{" "}
                            {quote.remainder.costType === "WEEKLY" ? "Weekly" : "Day-wise"})
                          </strong>
                          <span className="text-success fw-bold">
                            {fmt(quote.remainder.amount)}
                          </span>
                        </div>
                      </Card>
                    )}

                    <hr />
                    <div className="d-flex justify-content-between fs-5">
                      <strong>Total</strong>
                      <strong className="text-success">{fmt(quote.totalAmount)}</strong>
                    </div>
                  </>
                )}
              </Card>

              <div className="d-flex justify-content-between">
                <Button variant="outline-secondary" onClick={() => navigate(-1)}>
                  Back
                </Button>
                <Button
                  variant="success"
                  onClick={handleBook}
                  disabled={!quote || !!quoteError || submitting}
                >
                  Confirm Booking
                </Button>
              </div>
            </Col>
          </Row>
        </div>
      </div>

      <Modal
        show={showConfirmModal}
        onHide={() => !submitting && setShowConfirmModal(false)}
        centered
        backdrop="static"
        size="md"
      >
        <Modal.Header closeButton={!submitting} className="bg-primary text-white py-2">
          <Modal.Title className="fw-semibold d-flex align-items-center">
            <FaHotel className="me-2" /> Confirm Long Stay Booking
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-4 py-3 bg-light">
          {draft && (
            <div className="border rounded-3 bg-white shadow-sm p-3">
              <h5 className="fw-bold text-primary mb-1">{draft.hotelName}</h5>
              <hr />
              <Row className="gy-2">
                <Col xs={6}>
                  <p className="mb-1">
                    <strong>Check-In:</strong>
                    <br />
                    {formatDateTime(draft.checkIn)}
                  </p>
                </Col>
                <Col xs={6}>
                  <p className="mb-1">
                    <strong>Check-Out:</strong>
                    <br />
                    {formatDateTime(draft.checkOut)}
                  </p>
                </Col>
                <Col xs={6}>
                  <p className="mb-1">
                    <strong>Nights:</strong> {quote?.totalNights ?? "—"}
                  </p>
                </Col>
                <Col xs={6}>
                  <p className="mb-1">
                    <strong>Guests:</strong>{" "}
                    {rooms.reduce((s, r) => s + r.adults, 0)} Adult
                    {rooms.reduce((s, r) => s + r.adults, 0) !== 1 ? "s" : ""}
                    {rooms.reduce((s, r) => s + r.children, 0) > 0
                      ? `, ${rooms.reduce((s, r) => s + r.children, 0)} Child${
                          rooms.reduce((s, r) => s + r.children, 0) > 1 ? "ren" : ""
                        }`
                      : ""}
                  </p>
                </Col>
                <Col xs={12}>
                  <p className="mb-1">
                    <strong>Primary Guest:</strong> {primaryGuest.salutation}{" "}
                    {primaryGuest.firstName} {primaryGuest.lastName}
                  </p>
                  <p className="mb-1 small text-muted">
                    {primaryGuest.email} · {primaryGuest.phone}
                    {primaryGuest.nationality ? ` · ${primaryGuest.nationality}` : ""}
                  </p>
                </Col>
                <Col xs={12}>
                  <div
                    className="p-3 rounded text-white text-center mt-2"
                    style={{ background: "linear-gradient(135deg,#198754,#157347)" }}
                  >
                    <h6 className="mb-0 fw-bold">Total Price</h6>
                    <h4 className="mb-0">
                      {quote?.totalAmount != null
                        ? Number(quote.totalAmount).toFixed(2)
                        : "—"}
                    </h4>
                  </div>
                </Col>
              </Row>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-light border-0 d-flex justify-content-between">
          <Button
            variant="outline-secondary"
            onClick={() => setShowConfirmModal(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={confirmBooking}
            disabled={submitting}
            className="px-4 fw-semibold"
          >
            {submitting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Processing…
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
