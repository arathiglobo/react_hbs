/**
 * RestaurantBookingDetailView.jsx
 *
 * Full-page detail view for a single restaurant booking. Replaces
 * the modal-based "View" that used to live inside RestaurantBookingList.
 * Per-row Edit / Remark / Voucher / Cancel icons now sit at the
 * bottom-left of this page as buttons. Functionality unchanged — same
 * voucher download/email, status update, reconfirm, date-change, and
 * cancel endpoints as before.
 *
 * The backend currently exposes only /api/restaurant/booking/list, so
 * this page loads the list and finds the booking by id. Matches the
 * existing data flow used by the list page.
 */
import React, { useEffect, useState, useMemo } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Spinner,
  Modal,
  Button,
  Badge,
} from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaEdit,
  FaTimes,
  FaFileInvoice,
  FaCommentDots,
  FaSyncAlt,
  FaCalendarAlt,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
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

const statusVariant = (s) => {
  switch (s) {
    case "Confirmed":
      return "success";
    case "Reconfirmed":
      return "info";
    case "Pending":
    case "Pending Approval":
      return "warning";
    case "Guarantee Pending":
      return "warning";
    case "Date Change Requested":
      return "warning";
    case "Checked In":
      return "success";
    case "No Show":
      return "dark";
    case "Completed":
      return "primary";
    case "Rejected":
      return "danger";
    case "Cancelled":
      return "danger";
    case "Auto Cancelled":
      return "dark";
    default:
      return "secondary";
  }
};

export default function RestaurantBookingDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);

  // Voucher modal — { url, label } when open, null when closed
  const [pdfPreview, setPdfPreview] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  // Remark modal state
  const [showRemark, setShowRemark] = useState(false);

  const fetchBooking = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/restaurant/booking/list");
      const data = Array.isArray(res.data) ? res.data : res.data?.content || [];
      const found = data.find((b) => String(b.id) === String(id));
      if (!found) {
        toast.error("Booking not found");
        setBooking(null);
      } else {
        setBooking(found);
      }
    } catch (e) {
      console.error("Failed to load booking", e);
      toast.error("Failed to load booking");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooking(); /* eslint-disable-next-line */
  }, [id]);

  const isCancelledOrCompleted = useMemo(
    () =>
      booking?.bookingStatus === "Cancelled" ||
      booking?.bookingStatus === "Completed",
    [booking],
  );

  // ── Edit (reopen booking page pre-filled) ───────────────────────
  const handleEdit = () => {
    if (!booking) return;
    navigate("/new-booking/restaurant/booking", {
      state: {
        restaurant: {
          id: booking.restaurantId,
          restaurantName: booking.restaurantName,
          taxPercent: booking.taxPercent,
          bookingModes: "Both",
          advanceBookingMinHours: 0,
          images: [],
        },
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        memberCount: booking.memberCount,
        agentId: booking.agentId,
        agentName: booking.agentName,
        editingBookingId: booking.id,
      },
    });
  };

  // ── Voucher — fetch PDF URL from backend, render in iframe modal ─
  // Mirrors the hotel-booking detail-view pattern (BookingDetailedView).
  // GET /api/restaurant/booking/{id}/voucher is expected to return a
  // `pdfUrl` once the backend's PDF generation lands. While the backend
  // is still stubbed (returns just metadata + a `message` field), we
  // surface that message via toast so the operator knows the PDF
  // pipeline isn't ready yet — instead of opening an empty iframe.
  const openVoucher = async () => {
    if (!booking) return;
    setVoucherLoading(true);
    try {
      const res = await axiosInstance.get(
        `/api/restaurant/booking/${booking.id}/voucher`,
      );
      const payload = res.data || {};
      if (payload.pdfUrl) {
        setPdfPreview({
          url: payload.pdfUrl,
          label: "Voucher",
        });
      } else {
        // Backend hasn't returned a URL — show whatever explanation it
        // sent (e.g. "Voucher PDF generation pending — endpoint
        // returns metadata for now.") so the issue is visible.
        toast.error(payload.message || "Voucher PDF not available yet");
      }
    } catch (e) {
      console.error("Voucher fetch failed", e);
      toast.error(
        e?.response?.data?.message || "Failed to load voucher PDF",
      );
    } finally {
      setVoucherLoading(false);
    }
  };

  // ── Cancel ──────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!booking) return;
    const conf = await Swal.fire({
      icon: "warning",
      title: "Cancel this booking?",
      text: `Booking ${booking.bookingNumber}`,
      showCancelButton: true,
      confirmButtonColor: "#d33",
    });
    if (!conf.isConfirmed) return;
    try {
      await axiosInstance.put(`/api/restaurant/booking/${booking.id}/cancel`);
      toast.success("Booking cancelled");
      fetchBooking();
    } catch (e) {
      toast.error("Failed to cancel");
    }
  };

  // ── Reconfirm / Date-change helpers (used by ReconfirmPanel) ────
  const handleReconfirm = async () => {
    if (!booking) return;
    const conf = await Swal.fire({
      icon: "question",
      title: "Reconfirm this booking?",
      text: `Booking ${booking.bookingNumber}`,
      showCancelButton: true,
      confirmButtonColor: "#0d6efd",
    });
    if (!conf.isConfirmed) return;
    try {
      await axiosInstance.post(
        `/api/restaurant/booking/${booking.id}/reconfirm`,
      );
      toast.success("Booking reconfirmed");
      fetchBooking();
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to reconfirm booking",
      );
    }
  };

  const handleAcceptDateChange = async (useAlternate = false) => {
    if (!booking) return;
    try {
      await axiosInstance.post(
        `/api/restaurant/booking/${booking.id}/accept-date-change`,
        { useAlternate },
      );
      toast.success(
        useAlternate
          ? "Alternate date/time accepted"
          : "Proposed date/time accepted",
      );
      fetchBooking();
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to accept date change",
      );
    }
  };

  const handleRejectDateChange = async () => {
    if (!booking) return;
    const conf = await Swal.fire({
      icon: "warning",
      title: "Reject proposed date change?",
      text: `Booking ${booking.bookingNumber}`,
      showCancelButton: true,
      confirmButtonColor: "#d33",
    });
    if (!conf.isConfirmed) return;
    try {
      await axiosInstance.post(
        `/api/restaurant/booking/${booking.id}/reject-date-change`,
      );
      toast.success("Date change rejected");
      fetchBooking();
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to reject date change",
      );
    }
  };

  const handleReconfirmAndContinue = async (useAlternate = false) => {
    if (!booking) return;
    try {
      await axiosInstance.post(
        `/api/restaurant/booking/${booking.id}/accept-date-change`,
        { useAlternate },
      );
      await axiosInstance.post(
        `/api/restaurant/booking/${booking.id}/reconfirm`,
      );
      toast.success("Date change accepted and booking reconfirmed");
      fetchBooking();
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to reconfirm booking",
      );
    }
  };

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
                style={{
                  marginLeft: "12px",
                  fontWeight: "700",
                  fontSize: "1.1rem",
                  color: "#333",
                }}
                className="d-flex align-items-center"
              >
                <FaFileInvoice className="me-2 text-secondary" />
                Booking Details
                {booking?.bookingNumber && (
                  <Badge
                    bg="light"
                    text="dark"
                    className="ms-3 fw-semibold border"
                  >
                    {booking.bookingNumber}
                  </Badge>
                )}
              </span>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-3 text-muted">Loading booking details...</p>
              </div>
            ) : !booking ? (
              <div className="text-center py-5 text-muted">
                Booking not found.
              </div>
            ) : (
              <>
                {/* Reconfirmation panel — surfaces when restaurant flagged
                    booking for guarantee capture or proposed date change. */}
                {(booking.bookingStatus === "Guarantee Pending" ||
                  booking.bookingStatus === "Date Change Requested") && (
                  <div
                    className="mb-3 p-3 border"
                    style={{
                      background: "#fffbe6",
                      borderRadius: "8px",
                      borderLeft: "4px solid #f59e0b",
                    }}
                  >
                    <ReconfirmPanel
                      booking={booking}
                      onReconfirm={handleReconfirm}
                      onCancel={handleCancel}
                      onAcceptPrimary={() => handleAcceptDateChange(false)}
                      onAcceptAlternate={() => handleAcceptDateChange(true)}
                      onReject={handleRejectDateChange}
                      onReconfirmAndContinuePrimary={() =>
                        handleReconfirmAndContinue(false)
                      }
                      onReconfirmAndContinueAlternate={() =>
                        handleReconfirmAndContinue(true)
                      }
                    />
                  </div>
                )}

                {/* Booking info */}
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Booking Information
                  </Card.Header>
                  <Card.Body>
                    <Row className="g-2">
                      <Col md={6}>
                        <strong>Restaurant:</strong> {booking.restaurantName}
                      </Col>
                      <Col md={6}>
                        <strong>Date / Time:</strong> {booking.bookingDate}{" "}
                        {booking.bookingTime}
                      </Col>
                      <Col md={6}>
                        <strong>Members:</strong> {booking.memberCount}
                      </Col>
                      <Col md={6}>
                        <strong>Customer:</strong> {booking.customerName} (
                        {booking.mobile})
                      </Col>
                      <Col md={6}>
                        <strong>Agent:</strong> {booking.agentName || "-"}
                      </Col>
                      <Col md={6}>
                        <strong>Status:</strong>{" "}
                        <Badge bg={statusVariant(booking.bookingStatus)}>
                          {booking.bookingStatus}
                        </Badge>
                      </Col>
                      <Col md={6}>
                        <strong>Meal Type:</strong> {booking.mealType || "—"}
                      </Col>
                      <Col md={6}>
                        <strong>Seating:</strong>{" "}
                        {booking.seatingPreference || "—"}
                      </Col>
                      <Col md={12}>
                        <strong>Special Request:</strong>{" "}
                        {booking.specialRequest || "-"}
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                {/* Guarantee card details — only when captured */}
                {booking.guaranteeStatus === "Provided" && (
                  <Card className="mb-3">
                    <Card.Header
                      className="fw-semibold"
                      style={{ backgroundColor: "#f0f9ff" }}
                    >
                      Credit Card Guarantee (on file)
                    </Card.Header>
                    <Card.Body>
                      <Row className="g-2 small">
                        <Col md={6}>
                          <strong>Card Holder:</strong>{" "}
                          {booking.guaranteeCardHolder || "—"}
                        </Col>
                        <Col md={6}>
                          <strong>Card Number:</strong>{" "}
                          {booking.guaranteeCardNumber || "—"}
                        </Col>
                        <Col md={6}>
                          <strong>Card Type:</strong>{" "}
                          {booking.guaranteeCardType || "—"}
                        </Col>
                        <Col md={6}>
                          <strong>Expiry:</strong>{" "}
                          {booking.guaranteeCardExpiry || "—"}
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                )}

                {/* Date-change snapshot */}
                {(booking.proposedDate || booking.originalBookingDate) && (
                  <Card className="mb-3">
                    <Card.Header
                      className="fw-semibold"
                      style={{ backgroundColor: "#fffbeb" }}
                    >
                      Date Change
                    </Card.Header>
                    <Card.Body>
                      <div className="small mb-1">
                        <strong>Original:</strong>{" "}
                        {booking.originalBookingDate || booking.bookingDate}{" "}
                        {booking.originalBookingTime || booking.bookingTime}
                      </div>
                      {booking.proposedDate && (
                        <div className="small mb-1">
                          <strong>Proposed:</strong> {booking.proposedDate}{" "}
                          {booking.proposedTime || ""}
                          {(booking.proposedDateAlt ||
                            booking.proposedTimeAlt) && (
                            <>
                              {" "}
                              <span className="text-muted">OR</span>{" "}
                              {booking.proposedDateAlt || ""}{" "}
                              {booking.proposedTimeAlt || ""}
                            </>
                          )}
                        </div>
                      )}
                      {booking.dateChangeReason && (
                        <div className="small">
                          <strong>Reason:</strong> {booking.dateChangeReason}
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                )}

                {/* Items */}
                {Array.isArray(booking.items) && booking.items.length > 0 && (
                  <Card className="mb-3">
                    <Card.Header
                      className="fw-semibold"
                      style={{ backgroundColor: "#f1f3f5" }}
                    >
                      Items
                    </Card.Header>
                    <Card.Body className="p-0">
                      <Table size="sm" bordered className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Item</th>
                            <th>Qty</th>
                            <th>Price</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {booking.items.map((it, i) => (
                            <tr key={i}>
                              <td>{it.menuName}</td>
                              <td>{it.qty}</td>
                              <td>₹ {Number(it.price).toFixed(2)}</td>
                              <td>₹ {Number(it.total).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                )}

                {/* Total */}
                <div className="text-end mb-3">
                  {booking.totalAmount != null &&
                  Number(booking.totalAmount) > 0 ? (
                    <strong>
                      Grand Total: ₹ {Number(booking.totalAmount).toFixed(2)}
                    </strong>
                  ) : (
                    <span className="text-muted fst-italic">
                      Price not set yet — add it from the bookings list.
                    </span>
                  )}
                </div>

                {/* Cancellation block */}
                {booking.bookingStatus === "Cancelled" &&
                  booking.cancellationReason && (
                    <Card className="mb-3">
                      <Card.Header
                        className="fw-semibold"
                        style={{ backgroundColor: "#fff5f5" }}
                      >
                        Cancellation
                      </Card.Header>
                      <Card.Body>
                        <div className="small">
                          <strong>Reason:</strong> {booking.cancellationReason}
                        </div>
                      </Card.Body>
                    </Card>
                  )}

                {/* Bottom action buttons (left-aligned) */}
                <div
                  className="d-flex gap-2 justify-content-start flex-wrap"
                  style={{ marginTop: "16px", marginBottom: "20px" }}
                >
                  {!isCancelledOrCompleted && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#0d6efd" }}
                      onClick={handleEdit}
                      title="Edit"
                    >
                      <FaEdit style={{ marginRight: "6px" }} />
                      Edit
                    </button>
                  )}
                  <button
                    style={{
                      ...BUTTON_STYLE,
                      backgroundColor: "#0dcaf0",
                      opacity:
                        booking.restaurantRemark || booking.cancellationReason
                          ? 1
                          : 0.65,
                    }}
                    onClick={() => setShowRemark(true)}
                    title={
                      booking.restaurantRemark || booking.cancellationReason
                        ? "View remark"
                        : "No remark yet"
                    }
                  >
                    <FaCommentDots style={{ marginRight: "6px" }} />
                    Remark
                  </button>
                  <button
                    style={{
                      ...BUTTON_STYLE,
                      backgroundColor: "#198754",
                      opacity: voucherLoading ? 0.7 : 1,
                    }}
                    onClick={openVoucher}
                    disabled={voucherLoading}
                    title="Voucher"
                  >
                    <FaFileInvoice style={{ marginRight: "6px" }} />
                    {voucherLoading ? "Loading…" : "Voucher"}
                  </button>
                  {!isCancelledOrCompleted && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#dc3545" }}
                      onClick={handleCancel}
                      title="Cancel"
                    >
                      <FaTimes style={{ marginRight: "6px" }} />
                      Cancel
                    </button>
                  )}
                </div>
              </>
            )}
          </Container>
        </main>
      </div>

      {/*
        Voucher PDF Preview Modal — renders the backend-supplied PDF URL
        in an <iframe>. Mirrors the hotel-booking detail pattern
        (BookingDetailedView). Footer offers Open-in-new-tab + Download
        for users who still need them.
      */}
      <Modal
        show={!!pdfPreview}
        onHide={() => setPdfPreview(null)}
        size="xl"
        centered
        backdrop="static"
        keyboard
      >
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "1rem", fontWeight: 700 }}>
            {pdfPreview?.label || "Voucher"}
            {booking?.bookingNumber ? ` — ${booking.bookingNumber}` : ""}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0, height: "80vh" }}>
          {pdfPreview?.url ? (
            <iframe
              key={pdfPreview.url}
              src={pdfPreview.url}
              title={pdfPreview.label || "PDF preview"}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
              }}
            />
          ) : (
            <div className="text-center text-muted py-5">No PDF loaded.</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {pdfPreview?.url && (
            <>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() =>
                  window.open(
                    pdfPreview.url,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                Open in new tab
              </Button>
              <Button
                variant="outline-primary"
                size="sm"
                as="a"
                href={pdfPreview.url}
                download={`Restaurant_${booking?.bookingNumber || booking?.id || "voucher"}.pdf`}
              >
                Download
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPdfPreview(null)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Remark viewer modal ─────────────────────────────────── */}
      <Modal
        show={showRemark}
        onHide={() => setShowRemark(false)}
        centered
        size="md"
      >
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center">
            <FaCommentDots className="me-2 text-info" />
            Restaurant Remark
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {booking && (
            <>
              <div className="small text-muted mb-3">
                <strong>{booking.bookingNumber}</strong> ·{" "}
                {booking.restaurantName || "Restaurant"} ·{" "}
                {booking.bookingDate || "—"} {booking.bookingTime || ""}
              </div>

              <div className="mb-3">
                <div className="fw-semibold small text-muted mb-1">
                  Remarks (from restaurant manager)
                </div>
                {booking.restaurantRemark ? (
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      background: "#f8f9fa",
                      padding: "10px 12px",
                      borderRadius: 6,
                      borderLeft: "3px solid #0d6efd",
                      fontSize: "0.9rem",
                    }}
                  >
                    {booking.restaurantRemark}
                  </div>
                ) : (
                  <div className="text-muted small fst-italic">
                    No remark added by the restaurant yet.
                  </div>
                )}
              </div>

              {booking.cancellationReason && (
                <div>
                  <div className="fw-semibold small text-muted mb-1">
                    Cancellation / Rejection Reason
                  </div>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      background: "#fff5f5",
                      padding: "10px 12px",
                      borderRadius: 6,
                      borderLeft: "3px solid #dc3545",
                      fontSize: "0.9rem",
                    }}
                  >
                    {booking.cancellationReason}
                  </div>
                </div>
              )}

              {booking.restaurantActionedAt && (
                <div className="small text-muted mt-3">
                  Last updated by restaurant:{" "}
                  {new Date(booking.restaurantActionedAt).toLocaleString()}
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setShowRemark(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

/** Inline panel for "Guarantee Pending" / "Date Change Requested" states.
 *  Combined case (date change + guarantee) chains accept + reconfirm. */
const ReconfirmPanel = ({
  booking,
  onReconfirm,
  onCancel,
  onAcceptPrimary,
  onAcceptAlternate,
  onReject,
  onReconfirmAndContinuePrimary,
  onReconfirmAndContinueAlternate,
}) => {
  const isDateChange = booking.bookingStatus === "Date Change Requested";
  const isGuaranteePending = booking.bookingStatus === "Guarantee Pending";
  const combined = isDateChange && booking.guaranteeStatus === "Pending";
  const hasAlternate = !!(booking.proposedDateAlt || booking.proposedTimeAlt);
  const originalDate = booking.originalBookingDate || booking.bookingDate;
  const originalTime = booking.originalBookingTime || booking.bookingTime;

  if (combined) {
    return (
      <div>
        <div className="d-flex align-items-center mb-2">
          <FaSyncAlt className="me-2 text-warning" />
          <strong>Reconfirmation Required</strong>
        </div>
        <div className="mb-2">
          Restaurant proposed a new reservation time AND requires a credit
          card guarantee.
        </div>
        <div className="small mb-1">
          <strong>Original:</strong> {originalDate || "—"} {originalTime || ""}
        </div>
        <div className="small mb-1">
          <strong>Proposed:</strong> {booking.proposedDate || "—"}{" "}
          {booking.proposedTime || ""}
          {hasAlternate && (
            <>
              {" "}
              <span className="text-muted">OR</span>{" "}
              {booking.proposedDateAlt || "—"} {booking.proposedTimeAlt || ""}
            </>
          )}
        </div>
        <div className="small mb-1">
          <strong>Guarantee Required:</strong> Yes
        </div>
        <div className="small mb-2">
          <strong>Reason:</strong> {booking.dateChangeReason || "—"}
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="primary"
            onClick={onReconfirmAndContinuePrimary}
          >
            Reconfirm &amp; Continue
            {hasAlternate ? " (Primary)" : ""}
          </Button>
          {hasAlternate && (
            <Button
              size="sm"
              variant="outline-primary"
              onClick={onReconfirmAndContinueAlternate}
            >
              Reconfirm &amp; Continue (Alternate)
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={onReject}>
            Reject
          </Button>
        </div>
      </div>
    );
  }

  if (isDateChange) {
    return (
      <div>
        <div className="d-flex align-items-center mb-2">
          <FaCalendarAlt className="me-2 text-warning" />
          <strong>Restaurant has requested a date/time change</strong>
        </div>
        <div className="small mb-1">
          <strong>Original:</strong> {originalDate || "—"} {originalTime || ""}
        </div>
        <div className="small mb-1">
          <strong>Proposed:</strong> {booking.proposedDate || "—"}{" "}
          {booking.proposedTime || ""}
          {hasAlternate && (
            <>
              {" "}
              <span className="text-muted">OR</span>{" "}
              {booking.proposedDateAlt || "—"} {booking.proposedTimeAlt || ""}
            </>
          )}
        </div>
        <div className="small mb-2">
          <strong>Reason:</strong> {booking.dateChangeReason || "—"}
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {hasAlternate ? (
            <>
              <Button size="sm" variant="success" onClick={onAcceptPrimary}>
                Accept Primary
              </Button>
              <Button
                size="sm"
                variant="outline-success"
                onClick={onAcceptAlternate}
              >
                Accept Alternate
              </Button>
            </>
          ) : (
            <Button size="sm" variant="success" onClick={onAcceptPrimary}>
              Accept
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={onReject}>
            Reject
          </Button>
        </div>
      </div>
    );
  }

  if (isGuaranteePending) {
    return (
      <div>
        <div className="d-flex align-items-center mb-2">
          <FaSyncAlt className="me-2 text-warning" />
          <strong>Reconfirmation Required</strong>
        </div>
        <div className="mb-2">
          Restaurant requires a credit card guarantee before confirming this
          reservation.
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button size="sm" variant="primary" onClick={onReconfirm}>
            Reconfirm
          </Button>
          <Button size="sm" variant="outline-danger" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
