/**
 * DayStayBookingDetailView.jsx
 *
 * Full-page detail view for a single Day Stay booking. Replaces the
 * modal-based "View" that used to live in DayStayBookingList. The
 * Voucher / Cancel row icons now sit at the bottom-left of this page as
 * buttons. Endpoints:
 *   - Detail fetch :  GET    /api/day-stay-booking/{id}
 *   - Voucher PDF  :  GET    /api/day-stay-booking/{id}/voucher
 *                     → { status: "SUCCESS", pdfUrl }
 *   - Send by mail :  POST   /api/day-stay-booking/send-pdf-email
 *                     { email, pdfUrl, bookingId }
 *   - Cancel       :  POST   /api/day-stay-booking/{id}/cancel  { reason }
 *
 * The voucher click now opens a modal with an in-page iframe preview
 * of the returned PDF (same pattern as
 * MakeYourOwnPackageV2BookingDetailView).
 *
 * The list row is forwarded via location.state.booking so the page has a
 * booking-code header even before the detail fetch resolves. On hard
 * refresh the route id alone drives the fetch.
 */
import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Badge,
  Spinner,
  Form,
  InputGroup,
  Modal,
  Button,
} from "react-bootstrap";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  FaEye,
  FaFileAlt,
  FaTrashAlt,
  FaEnvelope,
  FaPaperPlane,
  FaDownload,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

const BUTTON_STYLE = {
  color: "#fff",
  border: "none",
  borderRadius: "3px",
  padding: "6px 14px",
  fontSize: "0.78rem",
  fontWeight: "600",
  cursor: "pointer",
  letterSpacing: "0.4px",
  whiteSpace: "nowrap",
};

const statusBadge = (r) => {
  if (r?.isCancelled) return <Badge bg="danger">Cancelled</Badge>;
  if ((r?.status || "").toUpperCase() === "CONFIRMED")
    return <Badge bg="success">Confirmed</Badge>;
  return <Badge bg="secondary">{r?.status || "—"}</Badge>;
};

export default function DayStayBookingDetailView() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const rowStub = location.state?.booking || null;
  const bookingId = rowStub?.id || routeId;

  // Details (modal body content, fetched via the same endpoint the list
  // used). Seeded with the row stub so the header renders immediately.
  const [selected, setSelected] = useState(rowStub);
  const [detailsLoading, setDetailsLoading] = useState(true);

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Voucher modal — iframe preview of the returned PDF + send-email form.
  // Same shape as MakeYourOwnPackageV2BookingDetailView.
  const [showVoucher, setShowVoucher] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sendingMail, setSendingMail] = useState(false);

  const fetchDetail = async () => {
    if (!bookingId) {
      toast.error("Booking id missing");
      setDetailsLoading(false);
      return;
    }
    setDetailsLoading(true);
    try {
      const res = await axiosInstance.get(`/api/day-stay-booking/${bookingId}`);
      setSelected(res.data);
    } catch {
      // Fall back to the row stub — preserves the original "if /id fails,
      // render what we have" behaviour the list modal used.
      if (!rowStub) toast.error("Failed to load booking details");
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // ── Cancel ─────────────────────────────────────────────────────────
  const openCancel = () => {
    setCancelReason("");
    setShowCancel(true);
  };

  const submitCancel = async () => {
    if (!bookingId) return;
    setCancelling(true);
    try {
      await axiosInstance.post(
        `/api/day-stay-booking/${bookingId}/cancel`,
        { reason: cancelReason || null }
      );
      toast.success("Booking cancelled");
      setShowCancel(false);
      setCancelReason("");
      navigate(-1);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Cancellation failed");
    } finally {
      setCancelling(false);
    }
  };

  // ── Voucher ────────────────────────────────────────────────────────
  // Click → backend returns { status, message, pdfUrl }. We open the
  // modal with the iframe loading the returned URL, plus a recipient
  // email field that posts to /send-pdf-email (mirrors the MYOP v2
  // pattern). Errors surface as toasts and the modal stays closed.
  const handleVoucher = async () => {
    if (!bookingId) return;
    setEmail("");
    setEmailError("");
    setPdfUrl("");
    setShowVoucher(true);
    setLoadingPdf(true);
    try {
      const res = await axiosInstance.get(
        `/api/day-stay-booking/${bookingId}/voucher`
      );
      if (res.data?.status === "SUCCESS" && res.data?.pdfUrl) {
        setPdfUrl(res.data.pdfUrl);
      } else {
        toast.error(res.data?.message || "Failed to generate voucher");
        setShowVoucher(false);
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to generate voucher"
      );
      setShowVoucher(false);
    } finally {
      setLoadingPdf(false);
    }
  };

  const closeVoucher = () => {
    setShowVoucher(false);
    setPdfUrl("");
    setEmail("");
    setEmailError("");
  };

  const handleSendMail = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError("");
    setSendingMail(true);
    try {
      const res = await axiosInstance.post(
        "/api/day-stay-booking/send-pdf-email",
        {
          email,
          pdfUrl,
          bookingId,
        }
      );
      if (res.data?.status === "SUCCESS") {
        toast.success("Voucher emailed to " + email);
        setEmail("");
      } else {
        toast.error(res.data?.message || "Failed to send email");
      }
    } catch (e) {
      console.error("send mail error", e);
      toast.error("Failed to send email");
    } finally {
      setSendingMail(false);
    }
  };

  const isCancelled = !!selected?.isCancelled;

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* Header */}
            <div className="mb-3 d-flex align-items-center flex-wrap gap-2">
              <button
                style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                onClick={() => navigate(-1)}
              >
                ← Back
              </button>
              <span
                className="d-flex align-items-center"
                style={{
                  marginLeft: "12px",
                  fontWeight: "700",
                  fontSize: "1.1rem",
                  color: "#333",
                }}
              >
                <FaEye className="me-2 text-info" />
                Booking Details
                {selected?.bookingCode && (
                  <Badge
                    bg="light"
                    text="dark"
                    className="ms-3 fw-semibold border"
                  >
                    {selected.bookingCode}
                  </Badge>
                )}
              </span>
            </div>

            {detailsLoading && !selected ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-2 text-muted small">Loading details…</p>
              </div>
            ) : !selected ? (
              <div className="text-center py-5 text-muted">
                Booking not found.
              </div>
            ) : (
              <>
                {/* Booking Information */}
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Booking Information
                  </Card.Header>
                  <Card.Body>
                    <Row className="g-2 mb-0">
                      <Col md={6}>
                        <strong>Booking Code:</strong> {selected.bookingCode}
                      </Col>
                      <Col md={6}>
                        <strong>Status:</strong> {statusBadge(selected)}
                      </Col>
                      <Col md={6}>
                        <strong>Hotel:</strong> {selected.hotelName}
                      </Col>
                      <Col md={6}>
                        <strong>Address:</strong> {selected.address || "—"}
                      </Col>
                      <Col md={6}>
                        <strong>Date:</strong> {selected.checkInDate}
                      </Col>
                      <Col md={6}>
                        <strong>Window:</strong>{" "}
                        {(selected.checkInTime || "").slice(0, 5)} –{" "}
                        {(selected.checkOutTime || "").slice(0, 5)}
                      </Col>
                      <Col md={6}>
                        <strong>Agent:</strong> {selected.agentId || "—"}
                      </Col>
                      <Col md={6}>
                        <strong>Total:</strong>{" "}
                        {selected.totalAmount != null
                          ? `AED ${Number(selected.totalAmount).toFixed(2)}`
                          : "—"}
                      </Col>
                      {/* Optional "Booking Done By Employee" — rendered
                          only when an employee was selected at search
                          time. Backend resolves the name from the
                          joined employee row. */}
                      {selected.employeeName && (
                        <Col md={6}>
                          <strong>Booked By Employee:</strong>{" "}
                          {selected.employeeName}
                        </Col>
                      )}
                    </Row>
                  </Card.Body>
                </Card>

                {/* Primary Guest */}
                {selected.primaryGuest && (
                  <Card className="mb-3">
                    <Card.Header
                      className="fw-semibold"
                      style={{ backgroundColor: "#f1f3f5" }}
                    >
                      Primary Guest
                    </Card.Header>
                    <Card.Body>
                      <Row className="g-2 small">
                        <Col md={6}>
                          {selected.primaryGuest.salutation}{" "}
                          {selected.primaryGuest.firstName}{" "}
                          {selected.primaryGuest.lastName}
                        </Col>
                        <Col md={6}>📧 {selected.primaryGuest.email}</Col>
                        <Col md={6}>📞 {selected.primaryGuest.phone}</Col>
                        <Col md={6}>
                          LPO: {selected.primaryGuest.agentLpo || "—"}
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                )}

                {/* Rooms */}
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Rooms
                  </Card.Header>
                  <Card.Body>
                    <Table responsive size="sm" bordered className="mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>Category</th>
                          <th>Meal Plan</th>
                          <th>Adults</th>
                          <th>Children</th>
                          <th className="text-end">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selected.rooms || []).map((r, i) => (
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
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>

                {/* Requests / Policy / Cancellation info */}
                {(selected.specialRequests?.length > 0 ||
                  selected.cancellationPolicy?.length > 0 ||
                  selected.isCancelled) && (
                  <Card className="mb-3">
                    <Card.Header
                      className="fw-semibold"
                      style={{ backgroundColor: "#f1f3f5" }}
                    >
                      Notes
                    </Card.Header>
                    <Card.Body>
                      {selected.specialRequests?.length > 0 && (
                        <p className="small mb-1">
                          <strong>Special Requests:</strong>{" "}
                          {selected.specialRequests.join(", ")}
                        </p>
                      )}
                      {selected.cancellationPolicy?.length > 0 && (
                        <p className="small mb-1">
                          <strong>Cancellation Policy:</strong>{" "}
                          {selected.cancellationPolicy.join(" / ")}
                        </p>
                      )}
                      {selected.isCancelled && (
                        <div className="alert alert-danger mt-2 mb-0 py-2 small">
                          <strong>Cancelled at:</strong>{" "}
                          {selected.cancelledAt}
                          <br />
                          <strong>Reason:</strong>{" "}
                          {selected.cancellationReason || "—"}
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                )}

                {/* Bottom action buttons (left-aligned) — mirrors the
                    row icons. Voucher is dimmed when the booking is
                    cancelled (same gate as the list — the original
                    icon stayed visible but switched to grey and showed
                    "Cancelled bookings have no voucher" on hover). */}
                <div
                  className="d-flex gap-2 justify-content-start flex-wrap"
                  style={{ marginTop: "16px", marginBottom: "20px" }}
                >
                  <button
                    style={{
                      ...BUTTON_STYLE,
                      backgroundColor: isCancelled ? "#6c757d" : "#198754",
                      cursor: isCancelled ? "not-allowed" : "pointer",
                      opacity: isCancelled ? 0.7 : 1,
                    }}
                    onClick={isCancelled ? undefined : handleVoucher}
                    disabled={isCancelled}
                    title={
                      isCancelled
                        ? "Cancelled bookings have no voucher"
                        : "Voucher"
                    }
                  >
                    <FaFileAlt style={{ marginRight: "6px" }} />
                    Voucher
                  </button>
                  {!isCancelled && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#dc3545" }}
                      onClick={openCancel}
                      title="Cancel Booking"
                    >
                      <FaTrashAlt style={{ marginRight: "6px" }} />
                      Cancel
                    </button>
                  )}
                </div>
              </>
            )}
          </Container>
        </main>
      </div>

      {/* Cancel modal */}
      <Modal
        show={showCancel}
        onHide={() => !cancelling && setShowCancel(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton={!cancelling}>
          <Modal.Title>Cancel Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to cancel this Day Stay booking?</p>
          <Form.Label>Reason (optional)</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            disabled={cancelling}
            onClick={() => setShowCancel(false)}
          >
            Back
          </Button>
          <Button
            variant="danger"
            disabled={cancelling}
            onClick={submitCancel}
          >
            {cancelling ? "Cancelling..." : "Confirm Cancellation"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Voucher / PDF modal — iframe + send-email
          (same shape as MakeYourOwnPackageV2BookingDetailView) */}
      <Modal
        show={showVoucher}
        onHide={closeVoucher}
        size="xl"
        centered
        scrollable
        backdrop="static"
      >
        <Modal.Header closeButton className="bg-light">
          <Modal.Title className="fw-bold">
            Voucher — {selected?.bookingCode || ""}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0" style={{ height: "70vh" }}>
          {loadingPdf ? (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Generating Voucher…</p>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0`}
              width="100%"
              height="100%"
              title="Voucher PDF"
              style={{ border: "none" }}
            />
          ) : (
            <div className="h-100 d-flex align-items-center justify-content-center">
              <p className="text-danger">Failed to load PDF.</p>
            </div>
          )}
        </Modal.Body>
        <div className="p-3 border-top bg-light">
          <Row className="g-2 align-items-center">
            <Col md={8}>
              <InputGroup>
                <InputGroup.Text>
                  <FaEnvelope />
                </InputGroup.Text>
                <Form.Control
                  type="email"
                  placeholder="recipient@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  isInvalid={!!emailError}
                />
                <Button
                  variant="primary"
                  onClick={handleSendMail}
                  disabled={sendingMail || !pdfUrl}
                >
                  {sendingMail ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-1" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <FaPaperPlane className="me-1" /> Send Mail
                    </>
                  )}
                </Button>
              </InputGroup>
              {emailError && (
                <div className="text-danger small mt-1">{emailError}</div>
              )}
            </Col>
            <Col md={4} className="text-end">
              {pdfUrl && (
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => window.open(pdfUrl, "_blank")}
                >
                  <FaDownload className="me-1" /> Download
                </Button>
              )}
            </Col>
          </Row>
        </div>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeVoucher}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
