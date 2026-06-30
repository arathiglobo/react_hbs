/**
 * MeetAndSpaceBookingDetailView.jsx
 *
 * Full-page detail view for a single Meet & Space booking. Replaces
 * the modal-based "View" that used to live inside
 * MeetAndSpaceBookingList. Per-row Edit / Voucher / Cancel icons now
 * sit at the bottom-left of this page as buttons. Functionality
 * unchanged — same booking GET, cancel PUT, voucher PDF GET, and
 * voucher email POST endpoints as before.
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
  Badge,
} from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaEdit,
  FaEnvelope,
  FaTrashAlt,
  FaFileInvoice,
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

export default function MeetAndSpaceBookingDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Cancel modal state
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);

  // Voucher modal — iframe preview + email-to-recipient form
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherPdfUrl, setVoucherPdfUrl] = useState("");
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherEmail, setVoucherEmail] = useState("");
  const [voucherEmailError, setVoucherEmailError] = useState("");
  const [voucherSending, setVoucherSending] = useState(false);

  const fetchBooking = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        `/api/meet-and-space/booking/${id}`,
      );
      setData(res.data);
    } catch (e) {
      console.error("Load booking detail failed", e);
      toast.error("Failed to load booking");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooking(); /* eslint-disable-next-line */
  }, [id]);

  // ── Voucher PDF + email-send (same endpoints as the list page) ──
  const fetchVoucherPdf = async () => {
    if (!data) return;
    setVoucherLoading(true);
    setVoucherPdfUrl("");
    try {
      const res = await axiosInstance.get(
        `api/meet_and_space_booking/${data.id}/pdf?type=VOUCHER`,
      );
      if (res.data && res.data.status === "SUCCESS" && res.data.pdfUrl) {
        setVoucherPdfUrl(res.data.pdfUrl);
      } else {
        toast.error(res.data?.message || "Failed to generate voucher PDF");
      }
    } catch (e) {
      console.error("Voucher fetch failed", e);
      toast.error(e?.response?.data?.message || "Failed to load voucher PDF");
    } finally {
      setVoucherLoading(false);
    }
  };

  const openVoucher = () => {
    if (!data) return;
    setShowVoucherModal(true);
    setVoucherEmail(data?.customer?.email || "");
    setVoucherEmailError("");
    fetchVoucherPdf();
  };

  const closeVoucher = () => {
    if (voucherSending) return;
    setShowVoucherModal(false);
    setVoucherPdfUrl("");
    setVoucherEmail("");
    setVoucherEmailError("");
  };

  const sendVoucherEmail = async () => {
    if (!data) return;
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
        `/api/meet-and-space/booking/${data.id}/voucher/send`,
        { email },
      );
      toast.success(`Voucher sent to ${email}`);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to send voucher email",
      );
    } finally {
      setVoucherSending(false);
    }
  };

  // ── Cancel (same endpoint as the list page) ──────────────────────
  const openCancel = () => {
    setShowCancel(true);
    setCancelReason("");
  };

  const handleCancelSubmit = async () => {
    if (!data) return;
    setCancelSaving(true);
    try {
      await axiosInstance.put(
        `/api/meet-and-space/booking/${data.id}/cancel`,
        { reason: cancelReason || "Cancelled by user" },
      );
      toast.success("Booking cancelled");
      setShowCancel(false);
      setCancelReason("");
      fetchBooking();
    } catch (e) {
      console.error("Cancel failed", e);
      toast.error("Failed to cancel booking");
    } finally {
      setCancelSaving(false);
    }
  };

  const isCancelled = data?.bookingStatus === "Cancelled";

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* Back button + page title */}
            <div className="mb-3 d-flex align-items-center">
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
                {data?.bookingNumber && (
                  <Badge
                    bg="light"
                    text="dark"
                    className="ms-3 fw-semibold border"
                  >
                    {data.bookingNumber}
                  </Badge>
                )}
              </span>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-3 text-muted">Loading booking details...</p>
              </div>
            ) : !data ? (
              <div className="text-center py-5 text-muted">
                Booking not found.
              </div>
            ) : (
              <>
                {/* Booking & Event */}
                <SectionHeader>Booking &amp; Event</SectionHeader>
                <SectionBody>
                  <Row className="g-3">
                    <Col md={6}>
                      <KV label="Booking #" value={data.bookingNumber} />
                      <KV label="Space" value={data.meetingSpaceName} />
                      <KV label="Hotel" value={data.hotelName} />
                      <KV label="Date" value={data.bookingDate} />
                      <KV
                        label="Time"
                        value={
                          data.startTime
                            ? `${data.startTime} – ${data.endTime} (${data.durationHours}h)`
                            : "—"
                        }
                      />
                    </Col>
                    <Col md={6}>
                      <KV label="Event Type" value={data.eventType} />
                      <KV label="Layout" value={data.layout} />
                      <KV label="Attendees" value={data.attendees} />
                      <KV
                        label="Rate Plan"
                        value={
                          data.ratePlan
                            ? `${data.ratePlan} (${data.rateType})`
                            : "—"
                        }
                      />
                      <KV
                        label="Unit Rate"
                        value={
                          data.unitRate != null
                            ? `${data.currency || ""} ${Number(data.unitRate).toFixed(2)}`
                            : "—"
                        }
                      />
                      <KV
                        label="Status"
                        value={
                          <span
                            className={
                              isCancelled
                                ? "text-danger fw-bold"
                                : "text-success fw-bold"
                            }
                          >
                            {data.bookingStatus || "-"}
                          </span>
                        }
                      />
                    </Col>
                    {data.requestedAmenities && (
                      <Col md={12}>
                        <KV
                          label="Requested Amenities"
                          value={data.requestedAmenities}
                        />
                      </Col>
                    )}
                    {data.additionalRequirements && (
                      <Col md={12}>
                        <KV
                          label="Notes"
                          value={data.additionalRequirements}
                        />
                      </Col>
                    )}
                  </Row>
                </SectionBody>

                {/* Customer */}
                <SectionHeader>Customer</SectionHeader>
                <SectionBody>
                  {data.customer ? (
                    <Row className="g-3">
                      <Col md={6}>
                        <KV
                          label="Name"
                          value={[
                            data.customer.salutation,
                            data.customer.firstName,
                            data.customer.lastName,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        />
                        <KV label="Mobile" value={data.customer.mobile} />
                        <KV label="Email" value={data.customer.email} />
                        <KV
                          label="Company"
                          value={
                            data.customer.companyName
                              ? `${data.customer.companyName}${data.customer.designation ? ` (${data.customer.designation})` : ""}`
                              : "—"
                          }
                        />
                        <KV label="GSTIN" value={data.customer.gstNumber} />
                      </Col>
                      <Col md={6}>
                        <KV
                          label="Address"
                          value={
                            [
                              data.customer.address,
                              data.customer.city,
                              data.customer.state,
                              data.customer.country,
                              data.customer.pincode,
                            ]
                              .filter(Boolean)
                              .join(", ") || "—"
                          }
                        />
                        <KV
                          label="ID"
                          value={
                            [data.customer.idType, data.customer.idNumber]
                              .filter(Boolean)
                              .join(" ") || "—"
                          }
                        />
                        <KV label="Remarks" value={data.customer.remarks} />
                      </Col>
                    </Row>
                  ) : (
                    <em className="small text-muted">No customer record.</em>
                  )}
                </SectionBody>

                {/* Payment */}
                <SectionHeader>Payment</SectionHeader>
                <SectionBody>
                  {data.payment ? (
                    <Row className="g-3">
                      <Col md={6}>
                        <KV label="Mode" value={data.payment.paymentMode} />
                        <KV
                          label="Status"
                          value={data.payment.paymentStatus}
                        />
                        <KV
                          label="Reference"
                          value={data.payment.transactionReference}
                        />
                      </Col>
                      <Col md={6}>
                        <KV
                          label="Amount Paid"
                          value={
                            data.payment.amountPaid != null
                              ? `${data.currency || ""} ${Number(data.payment.amountPaid).toFixed(2)}`
                              : "—"
                          }
                        />
                        <KV
                          label="Balance Due"
                          value={
                            data.payment.balanceDue != null
                              ? `${data.currency || ""} ${Number(data.payment.balanceDue).toFixed(2)}`
                              : "—"
                          }
                        />
                        <KV label="Notes" value={data.payment.notes} />
                      </Col>
                    </Row>
                  ) : (
                    <em className="small text-muted">No payment record.</em>
                  )}
                </SectionBody>

                {/* Add-ons */}
                {data.addons && data.addons.length > 0 && (
                  <>
                    <SectionHeader>Add-ons</SectionHeader>
                    <div className="border border-top-0 rounded-bottom mb-3 bg-white">
                      <Table size="sm" hover className="mb-0 align-middle">
                        <thead style={{ backgroundColor: "#f8f9fa" }}>
                          <tr>
                            <th>Item</th>
                            <th style={{ width: 80 }}>Qty</th>
                            <th style={{ width: 100 }}>Unit</th>
                            <th style={{ width: 100 }}>Total</th>
                            <th>Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.addons.map((a) => (
                            <tr key={a.id}>
                              <td>{a.addonName}</td>
                              <td>{a.quantity}</td>
                              <td>{Number(a.unitPrice || 0).toFixed(2)}</td>
                              <td>{Number(a.totalPrice || 0).toFixed(2)}</td>
                              <td>{a.remarks}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </>
                )}

                {/* Price Summary */}
                <SectionHeader>Price Summary</SectionHeader>
                <SectionBody>
                  <KV
                    label="Sub Total"
                    value={`${data.currency} ${Number(data.subTotal || 0).toFixed(2)}`}
                  />
                  <KV
                    label="Add-ons"
                    value={Number(data.addonTotal || 0).toFixed(2)}
                  />
                  <KV
                    label={`Tax (${data.taxPercent || 0}%)`}
                    value={`${data.currency} ${Number(data.taxAmount || 0).toFixed(2)}`}
                  />
                  <KV
                    label="Discount"
                    value={Number(data.discountAmount || 0).toFixed(2)}
                  />
                  <Row className="g-0 pt-2">
                    <Col xs={5} md={4} className="fw-semibold text-dark">
                      Total
                    </Col>
                    <Col xs={7} md={8} className="fw-bold text-success fs-6">
                      {data.currency}{" "}
                      {Number(data.totalAmount || 0).toFixed(2)}
                    </Col>
                  </Row>
                </SectionBody>

                {/* Cancellation */}
                {isCancelled && (
                  <>
                    <SectionHeader>Cancellation</SectionHeader>
                    <SectionBody>
                      <KV label="Reason" value={data.cancellationReason} />
                      <KV label="Cancelled At" value={data.cancelledAt} />
                    </SectionBody>
                  </>
                )}

                {/* Bottom action buttons (left-aligned) */}
                <div
                  className="d-flex gap-2 justify-content-start flex-wrap"
                  style={{ marginTop: "16px", marginBottom: "20px" }}
                >
                  {!isCancelled && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#f39c12" }}
                      onClick={() =>
                        navigate(
                          `/booking-details/meet-and-space-booking-list/${data.id}/edit`,
                        )
                      }
                      title="Edit Booking"
                    >
                      <FaEdit style={{ marginRight: "6px" }} />
                      Edit
                    </button>
                  )}
                  <button
                    style={{ ...BUTTON_STYLE, backgroundColor: "#198754" }}
                    onClick={openVoucher}
                    title="Voucher / Confirmation"
                  >
                    <FaEnvelope style={{ marginRight: "6px" }} />
                    Voucher
                  </button>
                  {/* <button
                    style={{ ...BUTTON_STYLE, backgroundColor: "#241987" }}
                    onClick={openInvoice}
                    title="Invoice"
                  >
                    <FaEnvelope style={{ marginRight: "6px" }} />
                    Invoice
                  </button> */}
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

      {/* ── Voucher modal — iframe preview + email-send form ───── */}
      <Modal
        show={showVoucherModal}
        onHide={closeVoucher}
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
            {data?.bookingNumber && (
              <Badge bg="light" text="dark" className="ms-3 fw-semibold border">
                {data.bookingNumber}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 bg-white">
          {/* Email Voucher panel — sits above the PDF preview. */}
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
                      The voucher PDF will be attached and sent to this
                      address.
                    </Form.Text>
                  )}
                </Col>
                <Col md={4} className="d-flex flex-column gap-2 mt-md-4">
                  <Button
                    variant="dark"
                    onClick={sendVoucherEmail}
                    disabled={voucherSending || !voucherPdfUrl}
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
              {voucherLoading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                  <div className="mt-2 small text-muted">
                    Generating voucher PDF…
                  </div>
                </div>
              ) : voucherPdfUrl ? (
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
                <div className="text-muted text-center py-5">
                  No voucher available for this booking.
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
            onClick={closeVoucher}
            disabled={voucherSending}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancel modal */}
      <Modal show={showCancel} onHide={() => setShowCancel(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Cancel Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Cancel booking <strong>{data?.bookingNumber}</strong>?
          </p>
          <Form.Label>Reason</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Optional reason for cancellation"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowCancel(false)}
            disabled={cancelSaving}
          >
            Keep Booking
          </Button>
          <Button
            variant="danger"
            onClick={handleCancelSubmit}
            disabled={cancelSaving}
          >
            {cancelSaving ? (
              <>
                <Spinner size="sm" animation="border" /> Cancelling...
              </>
            ) : (
              "Confirm Cancellation"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
