/**
 * PackageBookingDetailView.jsx
 *
 * Full-page detail view for a single Package booking. Replaces the
 * modal-based "View" that used to live in PackageBookingList. The
 * Edit / Voucher / Cancel action icons from the row now sit at the
 * bottom-left of this page as buttons. All endpoints / behaviour are
 * unchanged:
 *   - Detail fetch   :  GET  /api/v1/package-booking/booking/{id}
 *   - Voucher PDF    :  GET  /api/v1/package-booking/generate-pdf/{id}  (blob)
 *   - Send voucher   :  POST /api/v1/package-booking/send-voucher/{id}  { email }
 *   - Cancel         :  PUT  /api/v1/package-booking/cancel/{id}
 *   - Amend / Edit   :  navigate('/new-booking/package-booking/{packageId}', state)
 *
 * The list row is forwarded via location.state.booking so the Edit
 * button has access to packageId / agentId / destinationCountryId
 * (those aren't returned by the detail endpoint). On hard refresh the
 * detail endpoint is still called by id, but Edit will toast "package
 * id missing" if state was lost — same guard as the original list.
 */
import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Table,
  InputGroup,
  Spinner,
  Modal,
  Button,
} from "react-bootstrap";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  FaEye,
  FaTrash,
  FaFileAlt,
  FaEdit,
  FaEnvelope,
  FaDownload,
  FaExclamationCircle,
  FaExclamationTriangle,
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

const formatDate = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
};

export default function PackageBookingDetailView() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // The list row (carries packageId / agentId / destinationCountryId
  // for the Edit button) plus the bucket key (so we can mirror the
  // "actions only on non-cancelled rows" gate from the list).
  const rowStub = location.state?.booking || null;
  const listStatus = location.state?.status || "upcoming";
  const bookingId = rowStub?.bookingId || rowStub?.id || routeId;

  const [bookingDetails, setBookingDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(true);

  // Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Voucher modal state — keeps the same iframe + email-send shape as
  // the list page. We hold a same-origin blob URL so the iframe loads
  // even when the backend ships Content-Disposition: attachment.
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherEmail, setVoucherEmail] = useState("");
  const [isSendingVoucher, setIsSendingVoucher] = useState(false);
  const [voucherBlobUrl, setVoucherBlobUrl] = useState("");
  const [isLoadingVoucherPdf, setIsLoadingVoucherPdf] = useState(false);

  const fetchDetails = async () => {
    if (!bookingId) {
      toast.error("Booking ID not found");
      setLoadingDetails(false);
      return;
    }
    try {
      setLoadingDetails(true);
      const response = await axiosInstance.get(
        `/api/v1/package-booking/booking/${bookingId}`
      );
      if (response.data) {
        setBookingDetails(response.data);
      } else {
        toast.error("Failed to load booking details");
      }
    } catch (error) {
      console.error("Error fetching booking details:", error);
      toast.error(
        error.response?.data?.message || "Failed to load booking details"
      );
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // ── Amendment / Edit handler ───────────────────────────────────────
  const handleEditClick = () => {
    const source = rowStub || bookingDetails || {};
    const packageId = source.packageId;
    if (!packageId) {
      toast.error("Cannot amend — package id missing on booking row");
      return;
    }
    navigate(`/new-booking/package-booking/${packageId}`, {
      state: {
        mode: "edit",
        bookingId,
        agentId: source.agentId || null,
        destinationCountryId: source.destinationCountryId || null,
      },
    });
  };

  // ── Cancel handlers ─────────────────────────────────────────────────
  const confirmCancelBooking = async () => {
    if (!bookingId) return;
    try {
      setIsCancelling(true);
      const response = await axiosInstance.put(
        `/api/v1/package-booking/cancel/${bookingId}`
      );
      if (response.data && response.data.status === "success") {
        toast.success(
          response.data.message || "Booking cancelled successfully"
        );
        setShowCancelModal(false);
        navigate(-1);
      } else {
        toast.error(response.data?.message || "Failed to cancel booking");
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error(
        error.response?.data?.message ||
          "Error cancelling booking. Please try again."
      );
    } finally {
      setIsCancelling(false);
    }
  };

  // ── Voucher handlers ───────────────────────────────────────────────
  /** Fetch the PDF as a blob and build a same-origin Object URL the iframe
   *  can render. Keeps us safe from popup blockers and from the backend's
   *  attachment Content-Disposition header. */
  const loadVoucherPdf = async () => {
    if (!bookingId) return;
    setIsLoadingVoucherPdf(true);
    try {
      const response = await axiosInstance.get(
        `/api/v1/package-booking/generate-pdf/${bookingId}`,
        { responseType: "blob" }
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      setVoucherBlobUrl(url);
    } catch (err) {
      console.error("Voucher load failed:", err);
      toast.error("Failed to load voucher PDF");
    } finally {
      setIsLoadingVoucherPdf(false);
    }
  };

  const openVoucher = () => {
    const seedEmail =
      bookingDetails?.contactInfo?.email ||
      rowStub?.contactEmail ||
      rowStub?.email ||
      "";
    setVoucherEmail(seedEmail);
    setVoucherBlobUrl("");
    setShowVoucherModal(true);
    loadVoucherPdf();
  };

  const closeVoucher = () => {
    if (isSendingVoucher) return;
    setShowVoucherModal(false);
    setVoucherEmail("");
    if (voucherBlobUrl) {
      window.URL.revokeObjectURL(voucherBlobUrl);
    }
    setVoucherBlobUrl("");
  };

  const handleDownloadVoucher = async () => {
    if (!bookingId) {
      toast.error("Booking ID not found");
      return;
    }
    try {
      let url = voucherBlobUrl;
      if (!url) {
        const response = await axiosInstance.get(
          `/api/v1/package-booking/generate-pdf/${bookingId}`,
          { responseType: "blob" }
        );
        const blob = new Blob([response.data], { type: "application/pdf" });
        url = window.URL.createObjectURL(blob);
        setVoucherBlobUrl(url);
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = `PackageBooking_${bookingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Voucher download failed:", err);
      toast.error("Failed to download voucher");
    }
  };

  const handleSendVoucherEmail = async () => {
    if (!bookingId) {
      toast.error("Booking ID not found");
      return;
    }
    const trimmed = (voucherEmail || "").trim();
    if (!trimmed) {
      toast.error("Please enter a recipient email");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }
    try {
      setIsSendingVoucher(true);
      const res = await axiosInstance.post(
        `/api/v1/package-booking/send-voucher/${bookingId}`,
        { email: trimmed }
      );
      if (res.data?.status === "success") {
        toast.success(res.data.message || "Voucher emailed");
        closeVoucher();
      } else {
        toast.error(res.data?.message || "Failed to send voucher");
      }
    } catch (err) {
      console.error("Voucher email failed:", err);
      toast.error(err.response?.data?.message || "Failed to send voucher");
    } finally {
      setIsSendingVoucher(false);
    }
  };

  // The Edit / Voucher / Cancel actions are hidden when the booking is
  // already cancelled. Mirrors the row icon visibility on the list.
  const isCancellable = listStatus !== "cancelled";

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
              </span>
            </div>

            {loadingDetails ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3 text-muted fw-medium">
                  Fetching details...
                </p>
              </div>
            ) : !bookingDetails ? (
              <div className="text-center py-5">
                <FaExclamationTriangle
                  size={40}
                  className="text-muted mb-3"
                />
                <p className="text-muted">
                  Booking data is unavailable at this moment.
                </p>
              </div>
            ) : (
              <>
                {/* Summary Strip — Code · Travel · Total · Pax */}
                <Row className="mb-3">
                  <Col md={3}>
                    <div className="border p-2 bg-white">
                      <div
                        className="text-muted mb-1"
                        style={{ fontSize: "0.6rem" }}
                      >
                        CONF CODE
                      </div>
                      <div
                        className="text-break"
                        style={{ fontSize: "0.9rem" }}
                      >
                        {bookingDetails.confirmationCode || "-"}
                      </div>
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="border p-2 bg-white">
                      <div
                        className="text-muted mb-1"
                        style={{ fontSize: "0.6rem" }}
                      >
                        TRAVEL DATE
                      </div>
                      <div style={{ fontSize: "0.9rem" }}>
                        {formatDate(bookingDetails.travelDate)}
                      </div>
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="border p-2 bg-white">
                      <div
                        className="text-muted mb-1"
                        style={{ fontSize: "0.6rem" }}
                      >
                        TOTAL PRICE
                      </div>
                      <div style={{ fontSize: "0.9rem" }}>
                        AED{" "}
                        {parseFloat(
                          bookingDetails.totalPrice || 0
                        ).toLocaleString()}
                      </div>
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="border p-2 bg-white">
                      <div
                        className="text-muted mb-1"
                        style={{ fontSize: "0.6rem" }}
                      >
                        PAX COUNT
                      </div>
                      <div style={{ fontSize: "0.9rem" }}>
                        {bookingDetails.counts?.adultCount}A /{" "}
                        {bookingDetails.counts?.childCount}C
                      </div>
                    </div>
                  </Col>
                </Row>

                <Row className="g-4">
                  {/* Left: Contact + Travellers */}
                  <Col lg={5}>
                    <div className="border mb-3 p-3 bg-white">
                      <h6 className="mb-3">Contact Information</h6>
                      <div className="mb-2">
                        <label className="text-muted mb-0 d-block small">
                          Primary Contact
                        </label>
                        <div className="small">
                          {bookingDetails.contactInfo?.title}{" "}
                          {bookingDetails.contactInfo?.name}
                        </div>
                      </div>
                      <Row className="g-2">
                        <Col sm={6}>
                          <label className="text-muted mb-0 d-block small">
                            Email
                          </label>
                          <div className="small text-break">
                            {bookingDetails.contactInfo?.email}
                          </div>
                        </Col>
                        <Col sm={6}>
                          <label className="text-muted mb-0 d-block small">
                            Mobile
                          </label>
                          <div className="small">
                            {bookingDetails.contactInfo?.mobile}
                          </div>
                        </Col>
                      </Row>
                    </div>

                    <div className="border mb-3 bg-white">
                      <div className="p-2 border-bottom">
                        <h6 className="mb-0 small">Travellers List</h6>
                      </div>
                      <div>
                        <Table size="sm" className="mb-0">
                          <thead>
                            <tr className="bg-light small text-muted">
                              <th className="ps-3">Type</th>
                              <th>Name</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bookingDetails.travellers?.map(
                              (traveller, idx) => (
                                <tr
                                  key={idx}
                                  style={{ fontSize: "0.75rem" }}
                                >
                                  <td className="ps-3">{traveller.type}</td>
                                  <td>
                                    {traveller.title} {traveller.firstName}{" "}
                                    {traveller.lastName}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </Table>
                      </div>
                    </div>
                  </Col>

                  {/* Right: Selections */}
                  <Col lg={7}>
                    <div className="border p-3 bg-white">
                      <h6 className="mb-3">Selected Services</h6>
                      {bookingDetails.selections?.hotels &&
                      bookingDetails.selections.hotels.length > 0 ? (
                        <div className="mb-3">
                          <div className="small mb-2 text-muted fw-bold">
                            Hotel Selections
                          </div>
                          {bookingDetails.selections.hotels.map(
                            (hotel, hIdx) => (
                              <div
                                key={hotel.hotelId || hIdx}
                                className="p-2 border mb-2 bg-white shadow-sm rounded"
                              >
                                <div className="d-flex justify-content-between align-items-center">
                                  <div>
                                    <div className="fw-bold small">
                                      {hotel.hotelName}
                                    </div>
                                    <div
                                      className="text-muted"
                                      style={{ fontSize: "0.7rem" }}
                                    >
                                      Hotel ID: {hotel.hotelId}
                                    </div>
                                  </div>
                                  <div className="text-end">
                                    <div className="fw-bold small text-primary">
                                      {hotel.selectedRate}{" "}
                                      {hotel.currency || "AED"}
                                    </div>
                                    <div
                                      className="text-muted"
                                      style={{ fontSize: "0.7rem" }}
                                    >
                                      Per Pax Rate
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : null}

                      {bookingDetails.selections?.cab && (
                        <div className="p-2 border mb-2 bg-white shadow-sm rounded">
                          <div className="small mb-1 text-muted fw-bold">
                            Transfer Selection
                          </div>
                          <div className="d-flex justify-content-between align-items-center">
                            <div className="small">
                              {bookingDetails.selections.cab.cabName}
                            </div>
                            <div className="small fw-bold text-primary">
                              {bookingDetails.selections.cab.selectedRate} AED
                            </div>
                          </div>
                        </div>
                      )}

                      {bookingDetails.selections?.activity && (
                        <div className="p-2 border bg-white shadow-sm rounded">
                          <div className="small mb-1 text-muted fw-bold">
                            Activity Selection
                          </div>
                          <div className="d-flex justify-content-between align-items-center">
                            <div className="small">
                              {
                                bookingDetails.selections.activity
                                  .activityName
                              }
                            </div>
                            <div className="small fw-bold text-primary">
                              {
                                bookingDetails.selections.activity
                                  .selectedRate
                              }{" "}
                              AED
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Col>
                </Row>

                {/* Bottom action buttons (left-aligned) — mirrors the
                    Edit / Voucher / Cancel row icons. Same status gate
                    (hidden when the booking is in the "cancelled"
                    bucket) and same handlers as the original list. */}
                <div
                  className="d-flex gap-2 justify-content-start flex-wrap"
                  style={{ marginTop: "16px", marginBottom: "20px" }}
                >
                  <button
                    style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                    onClick={() => window.print()}
                  >
                    Print Preview
                  </button>
                  {isCancellable && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#6c5ce7" }}
                      onClick={handleEditClick}
                      title="Amend booking"
                    >
                      <FaEdit style={{ marginRight: "6px" }} />
                      Amend
                    </button>
                  )}
                  {isCancellable && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#198754" }}
                      onClick={openVoucher}
                      title="Voucher"
                    >
                      <FaFileAlt style={{ marginRight: "6px" }} />
                      Voucher
                    </button>
                  )}
                  {isCancellable && (
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
              </>
            )}
          </Container>
        </main>
      </div>

      {/* ── Cancellation Modal ──────────────────────────────────────── */}
      <Modal
        show={showCancelModal}
        onHide={() => !isCancelling && setShowCancelModal(false)}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton={!isCancelling} className="border-0">
          <Modal.Title className="fw-bold d-flex align-items-center">
            <FaExclamationCircle className="me-2 text-danger" />
            <span>Cancel Booking</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-4 text-center">
          <p className="fs-5 mb-0">
            Are you sure you want to cancel this booking?
          </p>
          {bookingDetails && (
            <div className="mt-3 text-muted small">
              <div className="fw-bold text-dark">
                {bookingDetails.confirmationCode}
              </div>
              <div>{bookingDetails.packageName || rowStub?.packageName}</div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 justify-content-center pb-4">
          <Button
            variant="secondary"
            className="px-4 fw-bold"
            onClick={() => setShowCancelModal(false)}
            disabled={isCancelling}
          >
            No
          </Button>
          <Button
            variant="danger"
            className="px-4 fw-bold shadow-sm"
            onClick={confirmCancelBooking}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Cancelling...
              </>
            ) : (
              "Yes, Cancel"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Voucher Modal — iframe + email-send form ────────────────── */}
      <Modal
        show={showVoucherModal}
        onHide={closeVoucher}
        centered
        size="xl"
        backdrop="static"
        keyboard={!isSendingVoucher}
      >
        <Modal.Header
          closeButton={!isSendingVoucher}
          className="bg-dark text-white border-0"
        >
          <Modal.Title className="d-flex align-items-center gap-2">
            <FaFileAlt className="text-success" />
            <span className="fw-bold">Booking Voucher</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {bookingDetails && (
            <div className="mb-3 d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div className="text-muted small">
                <div className="fw-bold text-dark">
                  {bookingDetails.confirmationCode}
                </div>
                <div>
                  {bookingDetails.packageName || rowStub?.packageName}
                </div>
              </div>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={handleDownloadVoucher}
                disabled={isLoadingVoucherPdf}
              >
                <FaDownload className="me-2" /> Download PDF
              </Button>
            </div>
          )}

          {/* Inline PDF preview — same-origin Object URL so the iframe
              loads even when the underlying endpoint sends an attachment
              Content-Disposition. */}
          <div
            className="border rounded mb-3"
            style={{ background: "#f8fafc", minHeight: "520px" }}
          >
            {isLoadingVoucherPdf && (
              <div className="text-center text-muted py-5">
                <Spinner animation="border" size="sm" className="me-2" />
                Loading voucher PDF...
              </div>
            )}
            {!isLoadingVoucherPdf && voucherBlobUrl && (
              <iframe
                src={voucherBlobUrl}
                title="Package Booking Voucher"
                style={{ width: "100%", height: "520px", border: "none" }}
              />
            )}
            {!isLoadingVoucherPdf && !voucherBlobUrl && (
              <div className="text-center text-muted py-5">
                Voucher preview unavailable. Try Download or Send Email below.
              </div>
            )}
          </div>

          <Form.Group className="mb-2">
            <Form.Label className="fw-semibold">
              Send voucher by email
            </Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <FaEnvelope />
              </InputGroup.Text>
              <Form.Control
                type="email"
                placeholder="recipient@example.com"
                value={voucherEmail}
                onChange={(e) => setVoucherEmail(e.target.value)}
                disabled={isSendingVoucher}
              />
            </InputGroup>
            <Form.Text className="text-muted">
              The voucher PDF will be attached to the email.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button
            variant="secondary"
            onClick={closeVoucher}
            disabled={isSendingVoucher}
          >
            Close
          </Button>
          <Button
            variant="success"
            onClick={handleSendVoucherEmail}
            disabled={isSendingVoucher || !voucherEmail.trim()}
          >
            {isSendingVoucher ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Sending...
              </>
            ) : (
              <>
                <FaEnvelope className="me-2" /> Send Email
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
