/**
 * OfflineBookingDetailView.jsx
 *
 * Full-page detail view for a single offline booking. Replaces the
 * modal-based "View" that used to live in OfflineBookingList. Per-row
 * Voucher / Invoice / Tax icons now sit at the bottom-left of this
 * page as buttons. All endpoints are unchanged:
 *   - Items / summary table:  GET  /api/v1/offline-booking/list/{invoiceNumber}/{id}
 *   - PDF (voucher/invoice/tax): GET /api/v1/offline-booking/{id}/pdf?type=...
 *   - Email PDF:              POST /api/v1/offline-booking/send-pdf-email
 *
 * Booking summary metadata (customer, dates, invoice no) is passed
 * via location.state from the list page. On hard-refresh the page
 * falls back to fetching the all-list endpoint and finding the row
 * by `supplierMainBasicId`.
 */
import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Spinner,
  Form,
  Modal,
  Button,
  InputGroup,
} from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  FaFileAlt,
  FaFileInvoice,
  FaPercent,
  FaEnvelope,
  FaPaperPlane,
  FaDownload,
  FaEye,
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

export default function OfflineBookingDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // booking summary (header info). Comes from location.state when the
  // user clicks the eye icon, else fetched from the all-list endpoint
  // on hard refresh so the page survives reloads.
  const [booking, setBooking] = useState(location.state?.booking || null);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingBooking, setLoadingBooking] = useState(!booking);

  // PDF modal state (Voucher / Invoice / Tax)
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sendingMail, setSendingMail] = useState(false);

  // Hydrate booking from all-list on hard refresh when we don't have
  // location.state. The list endpoint is the authoritative source for
  // the row summary (customerName, checkIn, etc.).
  useEffect(() => {
    if (booking) return;
    (async () => {
      setLoadingBooking(true);
      try {
        const res = await axiosInstance.get(
          "api/v1/offline-booking/all-list",
          { params: { page: 0, limit: 500 } },
        );
        const data = res.data?.content || res.data || [];
        const found = (Array.isArray(data) ? data : []).find(
          (b) => String(b.supplierMainBasicId) === String(id),
        );
        if (found) {
          setBooking(found);
        } else {
          toast.error("Booking not found");
        }
      } catch (e) {
        console.error("Failed to load booking summary", e);
        toast.error("Failed to load booking");
      } finally {
        setLoadingBooking(false);
      }
    })();
  }, [id, booking]);

  // Load supplier-type items once we know the invoice number.
  useEffect(() => {
    if (!booking?.invoiceNumber || !booking?.supplierMainBasicId) return;
    (async () => {
      setLoadingItems(true);
      try {
        const res = await axiosInstance.get(
          `api/v1/offline-booking/list/${booking.invoiceNumber}/${booking.supplierMainBasicId}`,
        );
        setItems(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("Failed to load offline-booking items", e);
        toast.error("Failed to load booking details");
      } finally {
        setLoadingItems(false);
      }
    })();
  }, [booking?.invoiceNumber, booking?.supplierMainBasicId]);

  const handlePdfClick = async (type) => {
    if (!booking) return;
    setPdfTitle(type);
    setShowPdfModal(true);
    setLoadingPdf(true);
    setPdfUrl("");
    try {
      const response = await axiosInstance.get(
        `api/v1/offline-booking/${booking.supplierMainBasicId}/pdf`,
        { params: { type: type.toUpperCase() } },
      );
      if (response.data && response.data.status === "SUCCESS") {
        setPdfUrl(response.data.pdfUrl);
      } else {
        toast.error(response.data?.message || `Failed to generate ${type}`);
        setShowPdfModal(false);
      }
    } catch (error) {
      console.error(`Error fetching ${type} PDF:`, error);
      toast.error(`Failed to load ${type}`);
      setShowPdfModal(false);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleSendMail = async () => {
    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Invalid email format");
      return;
    }
    setEmailError("");
    setSendingMail(true);
    try {
      const response = await axiosInstance.post(
        "api/v1/offline-booking/send-pdf-email",
        {
          email,
          pdfUrl,
          type: pdfTitle,
          invoiceNumber: booking?.invoiceNumber,
          bookingId: booking?.supplierMainBasicId,
        },
      );
      if (response.status === 200) {
        toast.success("Email sent successfully");
        setEmail("");
      } else {
        toast.error("Failed to send email");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("An error occurred while sending email");
    } finally {
      setSendingMail(false);
    }
  };

  const closePdfModal = () => {
    setShowPdfModal(false);
    setEmail("");
    setEmailError("");
    setPdfUrl("");
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
                className="d-flex align-items-center"
                style={{
                  marginLeft: "12px",
                  fontWeight: "700",
                  fontSize: "1.1rem",
                  color: "#333",
                }}
              >
                <FaEye className="me-2 text-secondary" />
                Booking Details
                {booking?.invoiceNumber && (
                  <span
                    className="ms-3 px-2 py-1 fw-semibold border rounded"
                    style={{
                      backgroundColor: "#f1f3f5",
                      fontSize: "0.85rem",
                    }}
                  >
                    {booking.invoiceNumber}
                  </span>
                )}
              </span>
            </div>

            {loadingBooking ? (
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
                {/* Booking Summary */}
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
                        <strong>Invoice Number:</strong>{" "}
                        {booking.invoiceNumber || "-"}
                      </Col>
                      <Col md={6}>
                        <strong>Booking Date:</strong>{" "}
                        {booking.bookingDate ||
                          booking.createdAt ||
                          "-"}
                      </Col>
                      <Col md={6}>
                        <strong>Customer:</strong>{" "}
                        {booking.customerName || "-"}
                      </Col>
                      <Col md={6}>
                        <strong>Agent:</strong>{" "}
                        {booking.agentName ||
                          booking.agentFullName ||
                          "Direct Client"}
                      </Col>
                      <Col md={6}>
                        <strong>Check-In:</strong> {booking.checkIn || "-"}
                      </Col>
                      <Col md={6}>
                        <strong>Check-Out:</strong> {booking.checkOut || "-"}
                      </Col>
                      <Col md={6}>
                        <strong>Total Pax:</strong>{" "}
                        {booking.totalPax != null
                          ? booking.totalPax
                          : `${booking.adult || 0} adult(s), ${booking.child || 0} child(ren)`}
                      </Col>
                      <Col md={6}>
                        <strong>Total Amount:</strong>{" "}
                        {booking.totalAmount ?? booking.grandTotal ?? "0.00"}
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                {/* Supplier Type Items */}
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Supplier Details
                  </Card.Header>
                  <Card.Body className="p-0">
                    {loadingItems ? (
                      <div className="text-center py-4">
                        <Spinner animation="border" size="sm" />
                        <p className="mt-2 text-muted small mb-0">
                          Loading items...
                        </p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <Table
                          bordered
                          hover
                          size="sm"
                          className="align-middle mb-0"
                        >
                          <thead className="bg-light">
                            <tr>
                              <th>S.N</th>
                              <th>Supplier Type</th>
                              <th>Description</th>
                              <th>Qty</th>
                              <th>Unit Price</th>
                              <th>Tax (%)</th>
                              <th>Tax Amount</th>
                              <th>Sub Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.length > 0 ? (
                              items.map((item, idx) => (
                                <tr key={idx}>
                                  <td>{idx + 1}</td>
                                  <td className="fw-bold text-primary">
                                    {item.supplierType}
                                  </td>
                                  <td style={{ maxWidth: "300px" }}>
                                    {item.description}
                                  </td>
                                  <td>{item.quantity}</td>
                                  <td>{item.unitPrice}</td>
                                  <td>{item.tax}%</td>
                                  <td>{item.taxAmount}</td>
                                  <td className="fw-bold">{item.subTotal}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="8" className="text-center py-3">
                                  No details available.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </Table>
                      </div>
                    )}
                  </Card.Body>
                </Card>

                {/* Bottom action buttons (left-aligned) */}
                <div
                  className="d-flex gap-2 justify-content-start flex-wrap"
                  style={{ marginTop: "16px", marginBottom: "20px" }}
                >
                  <button
                    style={{ ...BUTTON_STYLE, backgroundColor: "#198754" }}
                    onClick={() => handlePdfClick("VOUCHER")}
                    title="Voucher"
                  >
                    <FaFileAlt style={{ marginRight: "6px" }} />
                    Voucher
                  </button>
                  <button
                    style={{ ...BUTTON_STYLE, backgroundColor: "#0dcaf0" }}
                    onClick={() => handlePdfClick("INVOICE")}
                    title="Invoice"
                  >
                    <FaFileInvoice style={{ marginRight: "6px" }} />
                    Invoice
                  </button>
                  <button
                    style={{ ...BUTTON_STYLE, backgroundColor: "#6c757d" }}
                    onClick={() => handlePdfClick("TAX")}
                    title="Tax"
                  >
                    <FaPercent style={{ marginRight: "6px" }} />
                    Tax
                  </button>
                </div>
              </>
            )}
          </Container>
        </main>
      </div>

      {/* PDF Modal — iframe preview + email-send form (unchanged) */}
      <Modal
        show={showPdfModal}
        onHide={closePdfModal}
        size="xl"
        centered
        scrollable
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header className="bg-light">
          <Modal.Title className="fw-bold">
            {pdfTitle} - {booking?.invoiceNumber}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0" style={{ height: "70vh" }}>
          {loadingPdf ? (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Generating {pdfTitle}...</p>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0`}
              width="100%"
              height="100%"
              title="PDF Viewer"
              style={{ border: "none" }}
            />
          ) : (
            <div className="h-100 d-flex align-items-center justify-content-center">
              <p className="text-danger">Failed to load PDF.</p>
            </div>
          )}
        </Modal.Body>
        <div className="p-3 border-top bg-light">
          <Row className="align-items-center">
            <Col md={8}>
              <Form.Group>
                <InputGroup className={emailError ? "is-invalid" : ""}>
                  <InputGroup.Text className="bg-white">
                    <FaEnvelope className="text-muted" />
                  </InputGroup.Text>
                  <Form.Control
                    type="email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    className={emailError ? "is-invalid" : ""}
                  />
                  <Button
                    variant="primary"
                    onClick={handleSendMail}
                    disabled={sendingMail || !pdfUrl}
                  >
                    {sendingMail ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <>
                        <FaPaperPlane className="me-2" />
                        Send Mail
                      </>
                    )}
                  </Button>
                </InputGroup>
                {emailError && (
                  <div className="invalid-feedback d-block">{emailError}</div>
                )}
              </Form.Group>
            </Col>
            <Col md={4} className="text-end">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => window.open(pdfUrl, "_blank")}
                disabled={!pdfUrl}
              >
                <FaDownload className="me-1" /> Download
              </Button>
            </Col>
          </Row>
        </div>
        <Modal.Footer>
          <Button variant="secondary" onClick={closePdfModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
