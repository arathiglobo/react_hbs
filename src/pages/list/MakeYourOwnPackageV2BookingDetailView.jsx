/**
 * MakeYourOwnPackageV2BookingDetailView.jsx
 *
 * Full-page detail view for a single MYOP v2 booking. Replaces the
 * modal-based "View" that used to live in MakeYourOwnPackageV2BookingList.
 * The Voucher / Cancel row icons now sit at the bottom-left of this page
 * as buttons. All endpoints / behaviour are unchanged:
 *   - Detail fetch :  GET    /api/makeYourOwnPackageV2/booking/{id}
 *   - Voucher PDF  :  GET    /api/makeYourOwnPackageV2/booking/{id}/voucher
 *   - Send by mail :  POST   /api/makeYourOwnPackageV2/booking/send-pdf-email
 *                     { email, pdfUrl, bookingId }
 *   - Cancel       :  DELETE /api/makeYourOwnPackageV2/booking/{id}?reason=...
 *
 * The list row is forwarded via location.state.booking so the page has a
 * booking-code header even before the detail fetch resolves. On hard
 * refresh the route id alone drives the fetch and the page recovers.
 */
import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Table,
  Badge,
  InputGroup,
  Spinner,
  Modal,
  Button,
} from "react-bootstrap";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  FaTrash,
  FaFileAlt,
  FaEnvelope,
  FaPaperPlane,
  FaDownload,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { ADDON_SERVICES_CATALOG } from "../../components/AddOnServicesPanel";

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

const _catalogByKey = ADDON_SERVICES_CATALOG.reduce((acc, svc) => {
  acc[svc.key] = svc;
  return acc;
}, {});
const _fieldLabel = (svcKey, fieldName) => {
  const svc = _catalogByKey[svcKey];
  if (!svc) return fieldName;
  const f = (svc.fields || []).find((x) => x.name === fieldName);
  return f ? f.label : fieldName;
};

// Status badge colour mapping — same table the list uses so the row →
// detail-view transition feels seamless.
const statusVariant = (raw) => {
  const s = String(raw || "").trim().toLowerCase();
  const map = {
    confirmed: "success",
    completed: "secondary",
    "on request": "warning",
    reconfirmed: "info",
    invoiced: "primary",
    failed: "dark",
    cancelled: "danger",
  };
  return map[s] || "success";
};

export default function MakeYourOwnPackageV2BookingDetailView() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const rowStub = location.state?.booking || null;
  const bookingId = rowStub?.id || routeId;

  const [details, setDetails] = useState(rowStub);
  const [loadingDetails, setLoadingDetails] = useState(true);

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Voucher modal — iframe preview + send-email form
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sendingMail, setSendingMail] = useState(false);

  const fetchDetail = async () => {
    if (!bookingId) {
      toast.error("Booking id missing");
      setLoadingDetails(false);
      return;
    }
    setLoadingDetails(true);
    try {
      const res = await axiosInstance.get(
        `/api/makeYourOwnPackageV2/booking/${bookingId}`,
      );
      if (res.data) setDetails(res.data);
    } catch (e) {
      console.error("v2 booking detail error", e);
      toast.error("Failed to load booking details");
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // ── Cancel ─────────────────────────────────────────────────────────
  const doCancel = async () => {
    if (!bookingId) return;
    setCancelling(true);
    try {
      await axiosInstance.delete(
        `/api/makeYourOwnPackageV2/booking/${bookingId}`,
        { params: { reason: cancelReason || "" } },
      );
      toast.success("Booking cancelled");
      setShowCancel(false);
      setCancelReason("");
      navigate(-1);
    } catch (e) {
      console.error("v2 cancel error", e);
      toast.error("Failed to cancel booking");
    } finally {
      setCancelling(false);
    }
  };

  // ── Voucher / PDF ──────────────────────────────────────────────────
  const onVoucher = async () => {
    if (!bookingId) return;
    setEmail("");
    setEmailError("");
    setPdfUrl("");
    setShowPdfModal(true);
    setLoadingPdf(true);
    try {
      const res = await axiosInstance.get(
        `/api/makeYourOwnPackageV2/booking/${bookingId}/voucher`,
      );
      if (res.data?.status === "SUCCESS" && res.data?.pdfUrl) {
        setPdfUrl(res.data.pdfUrl);
      } else {
        toast.error(res.data?.message || "Failed to generate voucher");
        setShowPdfModal(false);
      }
    } catch (e) {
      console.error("voucher error", e);
      toast.error("Failed to generate voucher");
      setShowPdfModal(false);
    } finally {
      setLoadingPdf(false);
    }
  };

  const closePdfModal = () => {
    setShowPdfModal(false);
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
        "/api/makeYourOwnPackageV2/booking/send-pdf-email",
        {
          email,
          pdfUrl,
          bookingId,
        },
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

  const isCancelled = !!details?.isCancelled;

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
                Booking Details
                {details?.bookingCode && (
                  <Badge bg="light" text="dark" className="ms-3 fw-semibold border">
                    {details.bookingCode}
                  </Badge>
                )}
              </span>
            </div>

            {loadingDetails && !details ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-2 text-muted small">Loading details…</p>
              </div>
            ) : !details ? (
              <div className="text-center py-5 text-muted">
                Booking not found.
              </div>
            ) : (
              <>
                {/* Customer details */}
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Customer Details
                  </Card.Header>
                  <Card.Body>
                    <Row className="g-2">
                      <Col md={6}>
                        <strong>Name:</strong>{" "}
                        {[
                          details.salutation,
                          details.customerFirstName,
                          details.customerLastName,
                        ]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </Col>
                      <Col md={6}>
                        <strong>Email:</strong> {details.customerEmail || "—"}
                      </Col>
                      <Col md={6}>
                        <strong>Phone:</strong> {details.customerPhone || "—"}
                      </Col>
                      <Col md={6}>
                        <strong>Passport:</strong>{" "}
                        {details.customerPassport || "—"}
                      </Col>
                      <Col md={6}>
                        <strong>Nationality:</strong>{" "}
                        {details.customerNationality || "—"}
                      </Col>
                      <Col md={6}>
                        <strong>Agent:</strong> {details.agentName || "—"}
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                {/* Pre-booking acceptance audit */}
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Policy Acceptance
                  </Card.Header>
                  <Card.Body>
                    <Row className="g-2">
                      <Col md={6}>
                        <strong>Terms &amp; Conditions:</strong>{" "}
                        {details.acceptedTerms ? (
                          <Badge bg="success">Accepted</Badge>
                        ) : (
                          <Badge bg="secondary">Not recorded</Badge>
                        )}
                      </Col>
                      <Col md={6}>
                        <strong>Cancellation Policies:</strong>{" "}
                        {details.acceptedCancellation ? (
                          <Badge bg="success">Accepted</Badge>
                        ) : (
                          <Badge bg="secondary">Not recorded</Badge>
                        )}
                      </Col>
                      <Col md={12}>
                        <strong>Accepted On:</strong>{" "}
                        {details.acceptedAt
                          ? new Date(details.acceptedAt).toLocaleString()
                          : "—"}
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                {/* Booking summary */}
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Booking Summary
                  </Card.Header>
                  <Card.Body>
                    <Row className="g-2">
                      <Col md={6}>
                        <strong>Booking Date:</strong>{" "}
                        {details.bookingDate
                          ? new Date(details.bookingDate).toLocaleString()
                          : "—"}
                      </Col>
                      <Col md={6}>
                        <strong>Tour Date:</strong> {details.tourDate || "—"}
                      </Col>
                      <Col md={6}>
                        <strong>Status:</strong>{" "}
                        {details.isCancelled ? (
                          <Badge bg="danger">Cancelled</Badge>
                        ) : (
                          <Badge bg={statusVariant(details.bookingStatus)}>
                            {String(
                              details.bookingStatus || "Confirmed",
                            ).trim()}
                          </Badge>
                        )}
                      </Col>
                      <Col md={6}>
                        <strong>Payment Mode:</strong>{" "}
                        {details.paymentMode || "—"}
                      </Col>
                      <Col md={6}>
                        <strong>Selling Price:</strong> ₹{" "}
                        {Number(details.sellingPrice || 0).toLocaleString()}
                      </Col>
                      <Col md={6}>
                        <strong>Total Price:</strong> ₹{" "}
                        {Number(details.totalPrice || 0).toLocaleString()}
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                {/* Hotels */}
                {details.hotels?.length > 0 && (
                  <Card className="mb-3">
                    <Card.Header
                      className="fw-semibold"
                      style={{ backgroundColor: "#f1f3f5" }}
                    >
                      Hotels
                    </Card.Header>
                    <Card.Body>
                      <Table responsive size="sm" bordered className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>#</th>
                            <th>Hotel</th>
                            <th>Room</th>
                            <th>Check-in / Out</th>
                            <th>Pax</th>
                            <th>Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.hotels.map((h, i) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td>{h.hotelName || `#${h.hotelId}`}</td>
                              <td>{h.roomCategory || "—"}</td>
                              <td>
                                {h.checkIn || "—"} → {h.checkOut || "—"}
                              </td>
                              <td>
                                {h.noOfAdults || 0}A / {h.noOfChildren || 0}C
                              </td>
                              <td>
                                ₹ {Number(h.totalRate || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                )}

                {/* Transfers */}
                {details.cabs?.length > 0 && (
                  <Card className="mb-3">
                    <Card.Header
                      className="fw-semibold"
                      style={{ backgroundColor: "#f1f3f5" }}
                    >
                      Transfers
                    </Card.Header>
                    <Card.Body>
                      <Table responsive size="sm" bordered className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>#</th>
                            <th>Cab</th>
                            <th>Pickup → Dropoff</th>
                            <th>Date</th>
                            <th>Pax</th>
                            <th>Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.cabs.map((c, i) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td>{c.cabName || `#${c.cabId}`}</td>
                              <td>
                                {c.pickupName || "—"}
                                {c.pickupTime ? ` @ ${c.pickupTime}` : ""} →{" "}
                                {c.dropoffName || "—"}
                                {c.dropoffTime ? ` @ ${c.dropoffTime}` : ""}
                              </td>
                              <td>
                                {c.pickupDate || "—"}
                                {c.dropoffDate ? ` → ${c.dropoffDate}` : ""}
                              </td>
                              <td>
                                {c.noOfAdult || 0}A / {c.noOfChild || 0}C
                              </td>
                              <td>
                                ₹ {Number(c.totalRate || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                )}

                {/* Activities */}
                {details.activities?.length > 0 && (
                  <Card className="mb-3">
                    <Card.Header
                      className="fw-semibold"
                      style={{ backgroundColor: "#f1f3f5" }}
                    >
                      Tours &amp; Activities
                    </Card.Header>
                    <Card.Body>
                      <Table responsive size="sm" bordered className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>#</th>
                            <th>Activity</th>
                            <th>Date</th>
                            <th>Pax</th>
                            <th>Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.activities.map((a, i) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td>{a.activityName || `#${a.activityId}`}</td>
                              <td>{a.tourDate || "—"}</td>
                              <td>
                                {a.noOfAdult || 0}A / {a.noOfChild || 0}C
                              </td>
                              <td>
                                ₹ {Number(a.totalRate || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                )}

                {/* Guests — full pax manifest. The lead traveller is flagged
                    with a "Primary" badge and surfaces the booking-owner
                    contact details (email / phone / passport / native country
                    / agent LPO). */}
                {details.guests?.length > 0 && (
                  <Card className="mb-3">
                    <Card.Header
                      className="fw-semibold"
                      style={{ backgroundColor: "#f1f3f5" }}
                    >
                      Guests ({details.guests.length})
                    </Card.Header>
                    <Card.Body>
                      <Table responsive size="sm" bordered className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: 40 }}>S.No</th>
                            <th style={{ width: 80 }}>Type</th>
                            <th>Name</th>
                            <th style={{ width: 80 }}>Gender</th>
                            <th style={{ width: 70 }}>Age</th>
                            <th>Contact / Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.guests.map((g, i) => {
                            const isPrimary = g.primaryGuest === true;
                            const contactBits = [];
                            if (g.email) contactBits.push(`✉ ${g.email}`);
                            if (g.phone) contactBits.push(`☎ ${g.phone}`);
                            if (g.passportNo)
                              contactBits.push(`Passport: ${g.passportNo}`);
                            if (g.nativeCountry)
                              contactBits.push(
                                `Nationality: ${g.nativeCountry}`,
                              );
                            if (g.agentLpo)
                              contactBits.push(`LPO: ${g.agentLpo}`);
                            return (
                              <tr key={i}>
                                <td>{i + 1}</td>
                                <td>
                                  {g.isChild ? "CHD" : "ADT"}
                                  {isPrimary && (
                                    <Badge bg="info" className="ms-1">
                                      Primary
                                    </Badge>
                                  )}
                                </td>
                                <td>
                                  {[
                                    g.salutation,
                                    g.firstName,
                                    g.middleName,
                                    g.lastName,
                                  ]
                                    .filter(Boolean)
                                    .join(" ") || ""}
                                </td>
                                <td>{g.gender || ""}</td>
                                <td>{g.age || ""}</td>
                                <td className="small">
                                  {contactBits.length
                                    ? contactBits.join(" · ")
                                    : ""}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                )}

                {/* Add-on services */}
                {details.addOnServices &&
                  Object.keys(details.addOnServices).length > 0 && (
                    <Card className="mb-3">
                      <Card.Header
                        className="fw-semibold"
                        style={{ backgroundColor: "#f1f3f5" }}
                      >
                        Add-On Services
                      </Card.Header>
                      <Card.Body>
                        <Row className="g-2">
                          {Object.entries(details.addOnServices).map(
                            ([svcKey, data]) => {
                              if (!data || data.enabled !== true) return null;
                              const svc = _catalogByKey[svcKey];
                              const label = svc ? svc.label : svcKey;
                              const filled = Object.entries(data || {}).filter(
                                ([k, v]) =>
                                  k !== "enabled" &&
                                  v !== undefined &&
                                  v !== null &&
                                  v !== "",
                              );
                              return (
                                <Col md={6} key={svcKey}>
                                  <Card className="h-100 border-success-subtle">
                                    <Card.Header className="bg-success-subtle py-2">
                                      <strong className="small">{label}</strong>
                                    </Card.Header>
                                    <Card.Body className="p-2">
                                      {filled.length === 0 ? (
                                        <span className="small text-muted fst-italic">
                                          Enabled (no extra details)
                                        </span>
                                      ) : (
                                        <Table
                                          responsive
                                          size="sm"
                                          borderless
                                          className="mb-0"
                                        >
                                          <tbody>
                                            {filled.map(([k, v]) => (
                                              <tr key={k}>
                                                <td
                                                  className="small text-muted fw-semibold"
                                                  style={{ width: "45%" }}
                                                >
                                                  {_fieldLabel(svcKey, k)}
                                                </td>
                                                <td className="small">
                                                  {String(v)}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </Table>
                                      )}
                                    </Card.Body>
                                  </Card>
                                </Col>
                              );
                            },
                          )}
                        </Row>
                      </Card.Body>
                    </Card>
                  )}

                {/* Bottom action buttons (left-aligned) — mirrors the row
                    icons that used to sit in the list's Action column.
                    Voucher remains accessible even on a cancelled booking
                    (matches the original behaviour where the green icon
                    was shown unconditionally). */}
                <div
                  className="d-flex gap-2 justify-content-start flex-wrap"
                  style={{ marginTop: "16px", marginBottom: "20px" }}
                >
                  <button
                    style={{ ...BUTTON_STYLE, backgroundColor: "#198754" }}
                    onClick={onVoucher}
                    title="Voucher"
                  >
                    <FaFileAlt style={{ marginRight: "6px" }} />
                    Voucher
                  </button>
                  {!isCancelled && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#dc3545" }}
                      onClick={() => setShowCancel(true)}
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

      {/* Cancel modal */}
      <Modal show={showCancel} onHide={() => setShowCancel(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Cancel Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Cancel booking <strong>{details?.bookingCode}</strong>?
          <Form.Control
            as="textarea"
            rows={2}
            placeholder="Reason (optional)"
            className="mt-2"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowCancel(false)}
            disabled={cancelling}
          >
            No
          </Button>
          <Button variant="danger" onClick={doCancel} disabled={cancelling}>
            {cancelling ? "Cancelling..." : "Yes, Cancel"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Voucher / PDF modal — iframe + send-email */}
      <Modal
        show={showPdfModal}
        onHide={closePdfModal}
        size="xl"
        centered
        scrollable
        backdrop="static"
      >
        <Modal.Header closeButton className="bg-light">
          <Modal.Title className="fw-bold">
            Voucher — {details?.bookingCode || ""}
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
          <Button variant="secondary" onClick={closePdfModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
