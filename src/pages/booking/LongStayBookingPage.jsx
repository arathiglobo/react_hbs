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
} from "react-bootstrap";
import { FaHotel } from "react-icons/fa";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import { toast } from "react-hot-toast";

export default function LongStayBookingPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState("");
  const [guest, setGuest] = useState({
    name: "",
    email: "",
    phone: "",
    nationality: "",
    remarks: "",
  });
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
    setDraft(JSON.parse(raw));
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
          checkInDate: draft.checkIn,
          checkOutDate: draft.checkOut,
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

  const validateGuest = () => {
    const e = {};
    if (!guest.name.trim()) e.name = "Guest name is required";
    if (!guest.email.trim()) {
      e.email = "Guest email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email.trim())) {
      e.email = "Enter a valid email address";
    }
    if (!guest.phone.trim()) {
      e.phone = "Guest phone is required";
    } else if (!/^[+0-9\s\-()]{7,}$/.test(guest.phone.trim())) {
      e.phone = "Enter a valid phone number";
    }
    if (guest.nationality && guest.nationality.length !== 2) {
      e.nationality = "Use 2-letter ISO code (e.g. IN, AE)";
    }
    return e;
  };

  // Step 1: validate, then open the order-summary modal
  const handleBook = () => {
    const e = validateGuest();
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

  // Step 2: actually create the booking after the user confirms in the modal
  const confirmBooking = async () => {
    try {
      setSubmitting(true);
      const payload = {
        hotelId: draft.hotelId,
        longStayContractId: draft.contract.longStayContractId,
        longStayRoomId: draft.room.longStayRoomId,
        agentId: agentId ? Number(agentId) : null,
        checkInDate: draft.checkIn,
        checkOutDate: draft.checkOut,
        primaryGuestName: guest.name.trim(),
        primaryGuestEmail: guest.email.trim(),
        primaryGuestPhone: guest.phone.trim(),
        nationality: guest.nationality || null,
        remarks: guest.remarks || null,
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
        <div className="p-4">
          <h4 className="mb-3">Long Stay Booking — Confirmation</h4>

          <Row>
            <Col md={7}>
              <Card className="p-3 mb-3">
                <h5 className="mb-3">Stay Details</h5>
                <p className="mb-1">
                  <strong>Hotel:</strong> {draft.hotelName} (id {draft.hotelId})
                </p>
                <p className="mb-1">
                  <strong>Selected contract (start of stay):</strong>{" "}
                  {draft.contract.rateCode}{" "}
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
                  {draft.room.meal && (
                    <Badge bg="success" className="ms-2">
                      Meal included
                    </Badge>
                  )}
                </p>
                <p className="mb-1">
                  <strong>Occupancy:</strong>{" "}
                  {draft.room.occupancyTypeName ||
                    `Occ-${draft.room.occupancyTypeId}`}
                  {draft.room.extraBed && (
                    <Badge bg="info" className="ms-2">
                      Extra bed
                    </Badge>
                  )}
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
                  <strong>Check-in:</strong> {draft.checkIn}
                </p>
                <p className="mb-1">
                  <strong>Check-out:</strong> {draft.checkOut}
                </p>
                <p className="mb-0 text-muted small">
                  Room ID #{draft.room.longStayRoomId}
                </p>
              </Card>

              <Card className="p-3 mb-3">
                <h5 className="mb-3">Primary Guest</h5>
                <Row className="g-2">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Name *</Form.Label>
                      <Form.Control
                        value={guest.name}
                        isInvalid={!!errors.name}
                        onChange={(e) => {
                          setGuest({ ...guest, name: e.target.value });
                          if (errors.name) setErrors({ ...errors, name: undefined });
                        }}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.name}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Email *</Form.Label>
                      <Form.Control
                        type="email"
                        value={guest.email}
                        isInvalid={!!errors.email}
                        onChange={(e) => {
                          setGuest({ ...guest, email: e.target.value });
                          if (errors.email) setErrors({ ...errors, email: undefined });
                        }}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.email}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Phone *</Form.Label>
                      <Form.Control
                        value={guest.phone}
                        isInvalid={!!errors.phone}
                        onChange={(e) => {
                          setGuest({ ...guest, phone: e.target.value });
                          if (errors.phone) setErrors({ ...errors, phone: undefined });
                        }}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.phone}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Nationality (ISO 2)</Form.Label>
                      <Form.Control
                        maxLength={2}
                        value={guest.nationality}
                        isInvalid={!!errors.nationality}
                        onChange={(e) => {
                          setGuest({
                            ...guest,
                            nationality: e.target.value.toUpperCase(),
                          });
                          if (errors.nationality)
                            setErrors({ ...errors, nationality: undefined });
                        }}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.nationality}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Remarks</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={guest.remarks}
                        onChange={(e) => setGuest({ ...guest, remarks: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Agent</Form.Label>
                      <Form.Select
                        value={agentId}
                        onChange={(e) => setAgentId(e.target.value)}
                      >
                        <option value="">-- (none) --</option>
                        {agents.map((a) => (
                          <option key={a.agentId || a.id} value={a.agentId || a.id}>
                            {a.companyName || a.name || `Agent ${a.agentId || a.id}`}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
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
                                    <th>Per-day</th>
                                    <th className="text-end">Sub-total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {m.slices.map((s, i) => (
                                    <tr key={i}>
                                      <td>{s.rateCode}</td>
                                      <td>{s.days}</td>
                                      <td>
                                        {fmt(s.monthlyRate)} ÷ 30 = {fmt(s.perDayPortion)}
                                      </td>
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
                        {quote.remainder.costType === "WEEKLY" && (
                          <small className="text-muted">
                            {quote.remainder.weeks} full week
                            {quote.remainder.weeks === 1 ? "" : "s"} ({fmt(quote.remainder.weeksAmount)}) +{" "}
                            {quote.remainder.dayRemainder} day
                            {quote.remainder.dayRemainder === 1 ? "" : "s"} (
                            {fmt(quote.remainder.daysAmount)})
                          </small>
                        )}
                        {quote.remainder.slices && quote.remainder.slices.length > 0 && (
                          <Table size="sm" className="mt-2 mb-0">
                            <thead>
                              <tr>
                                <th>Validity</th>
                                <th>Days</th>
                                <th className="text-end">Sub-total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {quote.remainder.slices.map((s, i) => (
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
                    )}

                    <hr />
                    <div className="d-flex justify-content-between fs-5">
                      <strong>Total</strong>
                      <strong className="text-success">{fmt(quote.totalAmount)}</strong>
                    </div>

                    {quote.contractsUsed && quote.contractsUsed.length > 0 && (
                      <small className="text-muted d-block mt-2">
                        Rate plans used:{" "}
                        {quote.contractsUsed
                          .map(
                            (c) =>
                              `${c.rateCode}${
                                c.maxBookingDays ? ` (max ${c.maxBookingDays} nights)` : ""
                              }`
                          )
                          .join(", ")}
                      </small>
                    )}
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

      {/* Order Summary / Confirmation Modal */}
      <Modal
        show={showConfirmModal}
        onHide={() => !submitting && setShowConfirmModal(false)}
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
            <FaHotel className="me-2" /> Confirm Your Long Stay Booking
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="px-4 py-3 bg-light">
          {draft && (
            <div className="border rounded-3 bg-white shadow-sm p-3">
              <div className="mb-3">
                <h5 className="fw-bold text-primary mb-1">{draft.hotelName}</h5>
                <p className="text-muted mb-0 small">
                  Contract <strong>{draft.contract.rateCode}</strong>
                  {" · "}
                  {draft.contract.additionalCostType === "WEEKLY"
                    ? "Weekly billing"
                    : "Day-wise billing"}
                </p>
              </div>

              <hr />

              <Row className="gy-2">
                <Col xs={6}>
                  <p className="mb-1">
                    <strong>Check-In:</strong>
                    <br />
                    <span className="text-dark">{draft.checkIn}</span>
                  </p>
                </Col>
                <Col xs={6}>
                  <p className="mb-1">
                    <strong>Check-Out:</strong>
                    <br />
                    <span className="text-dark">{draft.checkOut}</span>
                  </p>
                </Col>
                <Col xs={6}>
                  <p className="mb-1">
                    <strong>Nights:</strong>{" "}
                    {quote?.totalNights ?? "—"}
                  </p>
                </Col>
                <Col xs={6}>
                  <p className="mb-1">
                    <strong>Occupancy:</strong>{" "}
                    {draft.room.occupancyTypeName ||
                      `Occ-${draft.room.occupancyTypeId}`}
                  </p>
                </Col>
                <Col xs={12}>
                  <p className="mb-1">
                    <strong>Room:</strong>{" "}
                    {draft.room.roomCategoryName ||
                      `Category #${draft.room.hotelRoomCategoryId}`}
                    {" — "}
                    {draft.room.roomTypeName ||
                      (draft.room.meal ? "Meal included" : "Room only")}
                  </p>
                </Col>
                <Col xs={12}>
                  <p className="mb-1">
                    <strong>Primary Guest:</strong> {guest.name}
                  </p>
                  <p className="mb-1 small text-muted">
                    {guest.email} · {guest.phone}
                    {guest.nationality ? ` · ${guest.nationality}` : ""}
                  </p>
                </Col>
                <Col xs={12}>
                  <p className="mb-1">
                    <strong>Refund:</strong>{" "}
                    {draft.room.refundable ? (
                      <Badge bg="success">Flexible</Badge>
                    ) : (
                      <Badge bg="danger">Non-Refundable</Badge>
                    )}
                  </p>
                </Col>

                <Col xs={12}>
                  <div className="p-3 rounded text-white text-center mt-2"
                    style={{ background: "linear-gradient(135deg,#198754,#157347)" }}
                  >
                    <h6 className="mb-0 fw-bold">Total Price</h6>
                    <h4 className="mb-0">
                      {quote?.totalAmount != null
                        ? Number(quote.totalAmount).toFixed(2)
                        : "—"}
                    </h4>
                    <small>Final amount as quoted</small>
                  </div>
                </Col>
              </Row>

              <div className="mt-3 text-center">
                <p className="text-muted small mb-0">
                  Please review the booking details carefully before confirming.
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
                <Spinner
                  size="sm"
                  animation="border"
                  className="me-2"
                />
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
