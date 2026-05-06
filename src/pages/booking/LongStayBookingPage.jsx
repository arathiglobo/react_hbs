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
} from "react-bootstrap";
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

  const handleBook = async () => {
    if (!guest.name.trim()) return toast.error("Guest name is required");
    if (!guest.email.trim()) return toast.error("Guest email is required");
    if (!guest.phone.trim()) return toast.error("Guest phone is required");

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
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1">
        <Topbar />
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
                  <strong>Room ID:</strong> #{draft.room.longStayRoomId} (Occ {draft.room.occupancyTypeId})
                </p>
                <p className="mb-1">
                  <strong>Check-in:</strong> {draft.checkIn}
                </p>
                <p className="mb-1">
                  <strong>Check-out:</strong> {draft.checkOut}
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
                        onChange={(e) => setGuest({ ...guest, name: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Email *</Form.Label>
                      <Form.Control
                        type="email"
                        value={guest.email}
                        onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Phone *</Form.Label>
                      <Form.Control
                        value={guest.phone}
                        onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Nationality (ISO 2)</Form.Label>
                      <Form.Control
                        maxLength={2}
                        value={guest.nationality}
                        onChange={(e) =>
                          setGuest({
                            ...guest,
                            nationality: e.target.value.toUpperCase(),
                          })
                        }
                      />
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
                  {submitting ? <Spinner size="sm" animation="border" /> : "Confirm Booking"}
                </Button>
              </div>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  );
}
