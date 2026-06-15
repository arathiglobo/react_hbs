/**
 * CabBookingDetailView.jsx
 *
 * Full-page detail view for a single Cab booking. Replaces the modal-based
 * "View" that used to live in CabBookingList. Per-row Voucher / Cancel
 * icons now sit at the bottom-left of this page as buttons. All endpoints
 * / behaviour are unchanged:
 *   - Voucher PDF :  GET  /api/cab/{id}/pdf?type=VOUCHER
 *   - Send voucher:  POST /api/cab/{id}/voucher/send  { email }
 *   - Cancel      :  DELETE /api/cab/delete/{id}
 *
 * Booking summary is passed via location.state when the user clicks the
 * eye icon on CabBookingList. On hard refresh we surface a "Booking not
 * found — go back" hint because the list endpoint doesn't expose a
 * per-id GET.
 */
import React, { useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Badge,
  Spinner,
  Form,
  Modal,
  Button,
  InputGroup,
} from "react-bootstrap";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  FaCar,
  FaTrash,
  FaFileInvoice,
  FaEnvelope,
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

const formatPrice = (price) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
  }).format(price || 0);

const formatDate = (date) => {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return date;
  }
};

// Two-column key/value row helper, matched to the original modal's
// "label · value · label · value" layout.
const KV = ({ label, value }) => (
  <Row className="g-0 py-2 border-bottom border-light-subtle">
    <Col xs={5} md={4} className="text-muted">
      {label}
    </Col>
    <Col xs={7} md={8} className="fw-semibold text-dark">
      {value || "—"}
    </Col>
  </Row>
);

const SectionHeader = ({ children }) => (
  <div
    className="px-3 py-2 fw-semibold text-dark border rounded-top"
    style={{ backgroundColor: "#f1f3f5" }}
  >
    {children}
  </div>
);

const SectionBody = ({ children }) => (
  <div className="border border-top-0 rounded-bottom px-3 py-2 mb-3 bg-white">
    {children}
  </div>
);

export default function CabBookingDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const booking = location.state?.booking || null;

  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Voucher: track loading state for the PDF generation
  const [voucherLoadingId, setVoucherLoadingId] = useState(null);

  // Voucher modal — opens an in-page iframe preview of the PDF and
  // lets the operator email the voucher to an arbitrary recipient.
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherPdfUrl, setVoucherPdfUrl] = useState("");
  const [voucherEmail, setVoucherEmail] = useState("");
  const [voucherEmailError, setVoucherEmailError] = useState("");
  const [voucherSending, setVoucherSending] = useState(false);

  const isCancelled = !!booking?.cancelStatus;

  const handleCancelBooking = async () => {
    if (!booking) return;
    try {
      setCancelling(true);
      const response = await axiosInstance.delete(
        `/api/cab/delete/${booking.custombookingId}`
      );
      if (response.data?.status === "success") {
        toast.success("Booking cancelled");
        setShowCancelModal(false);
        navigate(-1);
      } else {
        toast.error("Cancel failed");
      }
    } catch {
      toast.error("Error cancelling booking");
    } finally {
      setCancelling(false);
    }
  };

  // Voucher action → backend (CabBookingController#getCabBookingPdf) returns a
  // PdfGenerationResponseDTO with { status, message, pdfUrl }; instead of
  // opening a new tab, surface the URL inside an in-page modal with an
  // iframe preview + an email-to field.
  const handleVoucher = async () => {
    if (!booking) return;
    const bid = booking.custombookingId;
    if (!bid) return;
    try {
      setVoucherLoadingId(bid);
      const res = await axiosInstance.get(`/api/cab/${bid}/pdf`, {
        params: { type: "VOUCHER" },
      });
      if (res.data && res.data.status === "SUCCESS" && res.data.pdfUrl) {
        setVoucherPdfUrl(res.data.pdfUrl);
        setVoucherEmail(booking.customer?.emailId || "");
        setVoucherEmailError("");
        setShowVoucherModal(true);
      } else {
        toast.error(res.data?.message || "Failed to generate voucher");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate voucher");
    } finally {
      setVoucherLoadingId(null);
    }
  };

  // Email the voucher PDF to the address typed into the modal.
  const sendVoucherEmail = async () => {
    if (!booking) return;
    const email = (voucherEmail || "").trim();
    if (!email) {
      setVoucherEmailError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setVoucherEmailError("Please enter a valid email address");
      return;
    }
    setVoucherEmailError("");
    try {
      setVoucherSending(true);
      await axiosInstance.post(
        `/api/cab/${booking.custombookingId}/voucher/send`,
        { email }
      );
      toast.success(`Voucher sent to ${email}`);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to send voucher email"
      );
    } finally {
      setVoucherSending(false);
    }
  };

  const closeVoucherModal = () => {
    if (voucherSending) return;
    setShowVoucherModal(false);
    setVoucherPdfUrl("");
    setVoucherEmail("");
    setVoucherEmailError("");
  };

  if (!booking) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4">
            <Container fluid style={{ maxWidth: "1100px" }}>
              <div className="text-center py-5">
                <p className="text-muted mb-3">
                  Booking not found. Please reopen it from the Cab Bookings list.
                </p>
                <button
                  style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                  onClick={() =>
                    navigate("/booking-details/cab-booking-list")
                  }
                >
                  ← Back to list
                </button>
              </div>
            </Container>
          </main>
        </div>
      </div>
    );
  }

  const customerName = [
    booking.customer?.salutaion,
    booking.customer?.firstName,
    booking.customer?.lastName,
  ]
    .filter(Boolean)
    .join(" ");

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
                <FaCar className="me-2 text-secondary" />
                Booking Details
                {booking.packageBookCode && (
                  <Badge
                    bg="light"
                    text="dark"
                    className="ms-3 fw-semibold border"
                  >
                    {booking.packageBookCode}
                  </Badge>
                )}
              </span>
            </div>

            {/* ── Booking Information ── */}
            <SectionHeader>Booking Information</SectionHeader>
            <SectionBody>
              <Row className="g-3">
                <Col md={6}>
                  <KV label="Booking Code" value={booking.packageBookCode} />
                  <KV
                    label="Booking Date"
                    value={formatDate(booking.bookingDate)}
                  />
                  <KV label="Cab" value={booking.cabName} />
                  <KV label="Transporter" value={booking.transporter} />
                  <KV label="Pickup Date" value={booking.pickupDate} />
                  <KV
                    label="Dropoff Date"
                    value={
                      booking.dropOffDate ||
                      booking.dropoffDate ||
                      booking.pickupDate
                    }
                  />
                </Col>
                <Col md={6}>
                  <KV label="Agent" value={booking.agentName} />
                  <KV
                    label="Pickup"
                    value={
                      [booking.pickupName, booking.pickupTime]
                        .filter(Boolean)
                        .join(" @ ")
                    }
                  />
                  <KV
                    label="Dropoff"
                    value={
                      [booking.dropoffName, booking.dropoffTime]
                        .filter(Boolean)
                        .join(" @ ")
                    }
                  />
                  <KV
                    label="Driver"
                    value={
                      [booking.driverName, booking.driverContact]
                        .filter(Boolean)
                        .join(" · ")
                    }
                  />
                  <KV
                    label="Voucher"
                    value={
                      booking.voucherIssued || booking.voucher ? "Yes" : "No"
                    }
                  />
                  <KV
                    label="Status"
                    value={
                      <span
                        className={
                          booking.cancelStatus
                            ? "text-danger fw-bold"
                            : "text-success fw-bold"
                        }
                      >
                        {booking.cancelStatus ? "Cancelled" : "Confirmed"}
                      </span>
                    }
                  />
                </Col>
              </Row>
            </SectionBody>

            {/* ── Guest Information ── */}
            <SectionHeader>Guest Information</SectionHeader>
            <SectionBody>
              <Row className="g-3">
                <Col md={6}>
                  <KV label="Guest Name" value={customerName} />
                  <KV label="Email" value={booking.customer?.emailId} />
                  <KV label="Phone" value={booking.customer?.contactNumber} />
                </Col>
                <Col md={6}>
                  <KV
                    label="Passport No."
                    value={booking.customer?.passportNumber}
                  />
                  <KV
                    label="Nationality"
                    value={
                      booking.customer?.nationality || booking.nationality
                    }
                  />
                  <KV label="Agent LPO" value={booking.lpo} />
                </Col>
              </Row>
            </SectionBody>

            {/* ── Passenger Details ── */}
            <SectionHeader>
              Passenger Details
              <span className="text-muted small fw-normal ms-2">
                ({booking.noOfAdult ?? 0} Adult
                {(booking.noOfAdult ?? 0) !== 1 ? "s" : ""}
                {(booking.noOfChild ?? 0) > 0
                  ? `, ${booking.noOfChild} Child${
                      booking.noOfChild !== 1 ? "ren" : ""
                    }`
                  : ""}
                )
              </span>
            </SectionHeader>
            <div className="border border-top-0 rounded-bottom mb-3 bg-white">
              {Array.isArray(booking.guests) && booking.guests.length > 0 ? (
                <Table size="sm" hover className="mb-0 align-middle">
                  <thead style={{ backgroundColor: "#f8f9fa" }}>
                    <tr>
                      <th style={{ width: 50 }}>#</th>
                      <th style={{ width: 90 }}>Type</th>
                      <th>Name</th>
                      <th style={{ width: 80 }}>Age</th>
                      <th>Passport</th>
                    </tr>
                  </thead>
                  <tbody>
                    {booking.guests.map((g, idx) => (
                      <tr key={g.id || idx}>
                        <td>{g.guestIndex || idx + 1}</td>
                        <td>
                          <Badge bg={g.isChild ? "secondary" : "dark"}>
                            {g.isChild ? "Child" : "Adult"}
                          </Badge>
                        </td>
                        <td>
                          {[
                            g.salutation,
                            g.firstName,
                            g.middleName,
                            g.lastName,
                          ]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </td>
                        <td>{g.age ?? "—"}</td>
                        <td>{g.passportNo || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="small text-muted px-3 py-2">
                  No per-pax manifest captured for this booking.
                  {Array.isArray(booking.childAgeArray) &&
                    booking.childAgeArray.length > 0 && (
                      <span>
                        {" "}
                        Child ages: {booking.childAgeArray.join(", ")}.
                      </span>
                    )}
                </div>
              )}
            </div>

            {/* ── Price Details ── */}
            <SectionHeader>Price Details</SectionHeader>
            <SectionBody>
              {booking.sellingPrice != null && (
                <KV
                  label="Selling Price"
                  value={formatPrice(booking.sellingPrice)}
                />
              )}
              {booking.totalRate != null &&
                Number(booking.totalRate) !== Number(booking.totalPrice) && (
                  <KV
                    label="Total Rate"
                    value={formatPrice(booking.totalRate)}
                  />
                )}
              {booking.tourismDirham != null &&
                Number(booking.tourismDirham) > 0 && (
                  <KV
                    label="Tourism Dirham"
                    value={`+ ${formatPrice(booking.tourismDirham)}`}
                  />
                )}
              <Row className="g-0 pt-2">
                <Col xs={5} md={4} className="fw-semibold text-dark">
                  Total Amount
                </Col>
                <Col xs={7} md={8} className="fw-bold text-success fs-6">
                  {formatPrice(booking.totalPrice)}
                </Col>
              </Row>
            </SectionBody>

            {/* Bottom action buttons (left-aligned) — mirrors the row icons
                that used to sit in the list's Action column. */}
            <div
              className="d-flex gap-2 justify-content-start flex-wrap"
              style={{ marginTop: "16px", marginBottom: "20px" }}
            >
              <button
                style={{ ...BUTTON_STYLE, backgroundColor: "#198754" }}
                onClick={handleVoucher}
                disabled={voucherLoadingId === booking.custombookingId}
                title="Voucher"
              >
                {voucherLoadingId === booking.custombookingId ? (
                  <Spinner
                    size="sm"
                    style={{ width: 12, height: 12, marginRight: 6 }}
                  />
                ) : (
                  <FaFileInvoice style={{ marginRight: "6px" }} />
                )}
                Voucher
              </button>
              {!isCancelled && (
                <button
                  style={{ ...BUTTON_STYLE, backgroundColor: "#dc3545" }}
                  onClick={() => setShowCancelModal(true)}
                  title="Cancel booking"
                >
                  <FaTrash style={{ marginRight: "6px" }} />
                  Cancel
                </button>
              )}
            </div>
          </Container>
        </main>
      </div>

      {/* Cancel confirmation */}
      <Modal
        show={showCancelModal}
        onHide={() => !cancelling && setShowCancelModal(false)}
        centered
      >
        <Modal.Header closeButton={!cancelling}>
          <Modal.Title>Cancel Cab Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          <p className="mb-1 text-muted">
            Are you sure you want to cancel this booking?
          </p>
          <h5 className="mb-0">{booking.packageBookCode}</h5>
          <p className="text-primary small mt-2">{booking.cabName}</p>
        </Modal.Body>
        <Modal.Footer className="justify-content-center border-0 pb-4">
          <Button
            variant="light"
            className="px-4"
            onClick={() => setShowCancelModal(false)}
            disabled={cancelling}
          >
            No, Keep
          </Button>
          <Button
            variant="dark"
            className="px-4"
            onClick={handleCancelBooking}
            disabled={cancelling}
          >
            {cancelling ? <Spinner size="sm" className="me-2" /> : "Yes, Cancel"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Voucher modal — iframe preview + email-send form ───── */}
      <Modal
        show={showVoucherModal}
        onHide={closeVoucherModal}
        size="xl"
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header
          closeButton={!voucherSending}
          className="border-bottom"
          style={{ backgroundColor: "#f1f3f5" }}
        >
          <Modal.Title className="d-flex align-items-center text-dark fw-semibold">
            <FaFileInvoice className="me-2 text-secondary" />
            Voucher
            {booking.packageBookCode && (
              <Badge
                bg="light"
                text="dark"
                className="ms-3 fw-semibold border"
              >
                {booking.packageBookCode}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 bg-white">
          {/* Email Voucher panel — sits ABOVE the PDF preview. */}
          <Card className="border shadow-none rounded-3 mb-3">
            <Card.Header
              className="py-2 fw-semibold text-dark d-flex align-items-center"
              style={{ backgroundColor: "#f1f3f5" }}
            >
              <FaEnvelope className="me-2 text-secondary" /> Email Voucher
            </Card.Header>
            <Card.Body className="p-3">
              <Row className="g-2 align-items-start">
                <Col md={8}>
                  <Form.Label className="small fw-semibold mb-1">
                    Recipient Email <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="name@example.com"
                    value={voucherEmail}
                    onChange={(e) => {
                      setVoucherEmail(e.target.value);
                      if (voucherEmailError) setVoucherEmailError("");
                    }}
                    isInvalid={!!voucherEmailError}
                    disabled={voucherSending}
                  />
                  {voucherEmailError ? (
                    <div className="invalid-feedback d-block">
                      {voucherEmailError}
                    </div>
                  ) : (
                    <Form.Text className="text-muted">
                      The voucher PDF will be attached and sent to this address.
                    </Form.Text>
                  )}
                </Col>
                <Col md={4} className="d-flex flex-column gap-2 mt-md-4">
                  <Button
                    variant="dark"
                    onClick={sendVoucherEmail}
                    disabled={voucherSending}
                  >
                    {voucherSending ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <FaEnvelope className="me-2" /> Send
                      </>
                    )}
                  </Button>
                  {voucherPdfUrl && (
                    <Button
                      variant="outline-secondary"
                      href={voucherPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      disabled={voucherSending}
                    >
                      Open in New Tab
                    </Button>
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* PDF preview below the email form. */}
          <Card className="border shadow-none rounded-3 overflow-hidden">
            <Card.Body className="p-0">
              {voucherPdfUrl ? (
                <iframe
                  title="Voucher PDF"
                  src={voucherPdfUrl}
                  style={{
                    width: "100%",
                    height: "65vh",
                    border: "none",
                    display: "block",
                  }}
                />
              ) : (
                <div className="text-center text-muted py-5">
                  No voucher loaded.
                </div>
              )}
            </Card.Body>
          </Card>
        </Modal.Body>
        <Modal.Footer
          className="border-top"
          style={{ backgroundColor: "#f8f9fa" }}
        >
          <Button
            variant="secondary"
            onClick={closeVoucherModal}
            disabled={voucherSending}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
