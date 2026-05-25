import React, { useEffect, useMemo, useState } from "react";
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
  Button,
  Modal,
} from "react-bootstrap";
import {
  FaSearch,
  FaEye,
  FaTrash,
  FaFileAlt,
  FaEnvelope,
  FaPaperPlane,
  FaDownload,
  FaSync,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { ADDON_SERVICES_CATALOG } from "../../components/AddOnServicesPanel";

/**
 * /booking-details/make-your-own-package-v2-list
 *
 * UI mirrors HotelBookingList.jsx — TopBar + Sidebar shell with two
 * stacked cards (header+search + table) and a third pagination/info
 * card below. Each row carries View / Cancel / Voucher actions; the
 * voucher button fetches a PDF link from the backend and renders it
 * in an iframe modal with email + download controls (same pattern as
 * /booking-details/offline-booking-list).
 */

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

// ── Status taxonomy (Make Your Own Package V2 booking list) ──────
// The backend stores the canonical status string on
// `mypkg_v2_booking.booking_status` plus an `is_cancelled` boolean.
// We surface a fuller set of tabs here to match the operator's
// mental model. `match(b)` is the per-tab predicate: it consumes a
// booking-list row exactly as the backend returns it and decides
// whether the row belongs in this tab.
//
// Status string comparison is case-insensitive — older bookings may
// have been saved with "Confirmed" / "CONFIRMED" / "confirmed". The
// "Upcoming" tab includes any non-cancelled booking whose tourDate is
// today or later. "Completed" is non-cancelled + past tourDate, OR a
// row already stamped "Completed" by ops. Tabs other than All /
// Cancelled / Upcoming / Completed filter purely on the status string.
const _isToday0 = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const _statusEq = (s, target) =>
  String(s || "").trim().toLowerCase() === target.toLowerCase();
const STATUS_TABS = [
  { key: "all", label: "All", match: () => true },
  {
    key: "upcoming",
    label: "Upcoming",
    match: (b) => {
      if (b.isCancelled) return false;
      if (!b.tourDate) return true; // no tour date → treat as upcoming
      const t = new Date(b.tourDate);
      if (Number.isNaN(t.getTime())) return true;
      t.setHours(0, 0, 0, 0);
      return t.getTime() >= _isToday0().getTime();
    },
  },
  {
    key: "completed",
    label: "Completed",
    match: (b) => {
      if (b.isCancelled) return false;
      if (_statusEq(b.bookingStatus, "Completed")) return true;
      if (!b.tourDate) return false;
      const t = new Date(b.tourDate);
      if (Number.isNaN(t.getTime())) return false;
      t.setHours(0, 0, 0, 0);
      return t.getTime() < _isToday0().getTime();
    },
  },
  {
    key: "cancelled",
    label: "Cancelled",
    match: (b) =>
      !!b.isCancelled || _statusEq(b.bookingStatus, "Cancelled"),
  },
  {
    key: "onrequest",
    label: "On Request",
    match: (b) =>
      !b.isCancelled && _statusEq(b.bookingStatus, "On Request"),
  },
  {
    key: "reconfirmed",
    label: "Reconfirmed",
    match: (b) =>
      !b.isCancelled && _statusEq(b.bookingStatus, "Reconfirmed"),
  },
  {
    key: "invoiced",
    label: "Invoiced",
    match: (b) =>
      !b.isCancelled && _statusEq(b.bookingStatus, "Invoiced"),
  },
  {
    key: "failed",
    label: "Failed",
    match: (b) =>
      !b.isCancelled && _statusEq(b.bookingStatus, "Failed"),
  },
];

const MakeYourOwnPackageV2BookingList = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all"); // see STATUS_TABS

  // Details modal
  const [showDetails, setShowDetails] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [toCancel, setToCancel] = useState(null);

  // Voucher / PDF modal
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfBooking, setPdfBooking] = useState(null);

  // Email send
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sendingMail, setSendingMail] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const role = (
        localStorage.getItem("currentActiveRole") || ""
      ).toLowerCase();
      const params = {};
      if (role === "agent") {
        const agentId = localStorage.getItem("agentId");
        if (agentId && agentId !== "null") params.agentId = agentId;
      }
      const res = await axiosInstance.get(
        "/api/makeYourOwnPackageV2/booking/list",
        { params },
      );
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("v2 booking list error", e);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tab = STATUS_TABS.find((t) => t.key === status) || STATUS_TABS[0];
    return rows.filter((b) => {
      if (!tab.match(b)) return false;
      if (!q) return true;
      const blob = [
        b.bookingCode,
        b.customerFirstName,
        b.customerLastName,
        b.customerEmail,
        b.customerPhone,
        b.agentName,
        b.bookingStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, status, search]);

  // Per-tab counts — computed once per `rows` change. Search does not
  // affect counts (matches the convention of similar list pages).
  const tabCounts = useMemo(() => {
    const out = {};
    STATUS_TABS.forEach((t) => {
      out[t.key] = rows.filter((b) => t.match(b)).length;
    });
    return out;
  }, [rows]);

  // ── actions ────────────────────────────────────────────────────────
  // Eye-icon → re-fetch the booking by ID so the modal always shows
  // the latest server-side data (including the freshly-saved primary
  // guest + per-room pax manifest). We seed `selected` with the list
  // row immediately so the modal header has the booking code while
  // the GET is in flight.
  const onView = async (b) => {
    setSelected(b);
    setShowDetails(true);
    setLoadingDetails(true);
    try {
      const res = await axiosInstance.get(
        `/api/makeYourOwnPackageV2/booking/${b.id}`,
      );
      if (res.data) setSelected(res.data);
    } catch (e) {
      console.error("v2 booking detail error", e);
      toast.error("Failed to load booking details");
    } finally {
      setLoadingDetails(false);
    }
  };
  const closeDetails = () => {
    setShowDetails(false);
    setSelected(null);
    setLoadingDetails(false);
  };
  const onCancelClick = (b) => {
    setToCancel(b);
    setCancelReason("");
    setShowCancel(true);
  };
  const doCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    try {
      await axiosInstance.delete(
        `/api/makeYourOwnPackageV2/booking/${toCancel.id}`,
        { params: { reason: cancelReason || "" } },
      );
      toast.success("Booking cancelled");
      setShowCancel(false);
      setToCancel(null);
      setCancelReason("");
      fetchList();
    } catch (e) {
      console.error("v2 cancel error", e);
      toast.error("Failed to cancel booking");
    } finally {
      setCancelling(false);
    }
  };

  const onVoucher = async (b) => {
    setPdfBooking(b);
    setEmail("");
    setEmailError("");
    setPdfUrl("");
    setShowPdfModal(true);
    setLoadingPdf(true);
    try {
      const res = await axiosInstance.get(
        `/api/makeYourOwnPackageV2/booking/${b.id}/voucher`,
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
    setPdfBooking(null);
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
          bookingId: pdfBooking?.id,
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

  // ── render ─────────────────────────────────────────────────────────
  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main
          className="flex-grow-1 p-3"
          style={{ width: "100%", overflow: "hidden" }}
        >
          <Container fluid className="px-0">
            {/* Header + search card */}
            <Card
              className="shadow-sm border-0 mb-3"
              style={{ borderRadius: 8 }}
            >
              <Card.Body className="d-flex justify-content-between align-items-center">
                <h3 className="fw-bold text-dark mb-0">
                  Make Your Own Package Bookings
                </h3>
                <div className="d-flex gap-2 align-items-center">
                  <InputGroup style={{ width: 300 }}>
                    <InputGroup.Text className="bg-white">
                      <FaSearch className="text-muted" />
                    </InputGroup.Text>
                    <Form.Control
                      placeholder="Search by Booking Code, Customer, Agent…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </InputGroup>
                  <Button
                    variant="outline-primary"
                    onClick={fetchList}
                    disabled={loading}
                  >
                    <FaSync className={loading ? "me-1 fa-spin" : "me-1"} />
                    Refresh
                  </Button>
                </div>
              </Card.Body>
            </Card>

            {/* Booking Types card (same pattern as HotelBookingList) */}
            <Card
              className="shadow-sm border-0 mb-3"
              style={{ borderRadius: 8 }}
            >
              <Card.Body>
                <h6 className="fw-bold text-secondary mb-2">Booking Types</h6>
                <Row className="g-2">
                  {STATUS_TABS.map((t) => (
                    <Col xs={6} md={4} lg={3} xl={2} key={t.key}>
                      <Form.Check
                        type="radio"
                        name="bookingType"
                        id={`bt-${t.key}`}
                        label={`${t.label} (${tabCounts[t.key] || 0})`}
                        checked={status === t.key}
                        onChange={() => setStatus(t.key)}
                      />
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>

            {/* Table card */}
            <Card
              className="shadow-sm border-0"
              style={{ borderRadius: 8, overflow: "hidden" }}
            >
              <Card.Body className="p-0">
                <Table
                  hover
                  size="sm"
                  className="mb-0 align-middle table-bordered"
                  style={{ tableLayout: "fixed", fontSize: "0.85rem" }}
                >
                  <thead
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderBottom: "2px solid #dee2e6",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
                    }}
                  >
                    <tr
                      style={{
                        textTransform: "uppercase",
                        fontSize: "0.72rem",
                      }}
                    >
                      <th style={{ width: 50 }}>S.N</th>
                      <th style={{ width: 130 }}>Booking Code</th>
                      <th>Customer</th>
                      <th style={{ width: 160 }}>Agent</th>
                      <th style={{ width: 110 }}>Tour Date</th>
                      <th style={{ width: 110 }}>Total</th>
                      <th style={{ width: 110 }}>Status</th>
                      <th style={{ width: 140 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={8} className="text-center py-4">
                          <Spinner animation="border" size="sm" /> Loading…
                        </td>
                      </tr>
                    )}
                    {!loading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center text-muted py-4">
                          No bookings found.
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      filtered.map((b, i) => (
                        <tr key={b.id}>
                          <td>{i + 1}</td>
                          <td className="fw-semibold text-primary">
                            {b.bookingCode}
                          </td>
                          <td>
                            <div className="fw-semibold">
                              {[
                                b.salutation,
                                b.customerFirstName,
                                b.customerLastName,
                              ]
                                .filter(Boolean)
                                .join(" ") || "—"}
                            </div>
                            <small className="text-muted d-block">
                              {b.customerEmail || ""}
                            </small>
                            <small className="text-muted d-block">
                              {b.customerPhone || ""}
                            </small>
                          </td>
                          <td>{b.agentName || "—"}</td>
                          <td>{b.tourDate || "—"}</td>
                          <td className="fw-semibold">
                            ₹ {Number(b.totalPrice || 0).toLocaleString()}
                          </td>
                          <td>
                            {(() => {
                              // Status badge — colour-coded so an ops
                              // user can scan the table at a glance.
                              if (b.isCancelled) {
                                return <Badge bg="danger">Cancelled</Badge>;
                              }
                              const s = String(b.bookingStatus || "Confirmed").trim();
                              const map = {
                                confirmed: "success",
                                completed: "secondary",
                                "on request": "warning",
                                reconfirmed: "info",
                                invoiced: "primary",
                                failed: "dark",
                                cancelled: "danger",
                              };
                              const variant = map[s.toLowerCase()] || "success";
                              return <Badge bg={variant}>{s}</Badge>;
                            })()}
                          </td>
                          <td>
                            <div className="d-flex align-items-center gap-3">
                              <FaEye
                                title="View"
                                role="button"
                                style={{ color: "#007bff", cursor: "pointer" }}
                                onClick={() => onView(b)}
                              />
                              <FaFileAlt
                                title="Voucher"
                                role="button"
                                style={{ color: "#28a745", cursor: "pointer" }}
                                onClick={() => onVoucher(b)}
                              />
                              {!b.isCancelled && (
                                <FaTrash
                                  title="Cancel"
                                  role="button"
                                  style={{
                                    color: "#dc3545",
                                    cursor: "pointer",
                                  }}
                                  onClick={() => onCancelClick(b)}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

            <Card
              className="shadow-sm border-0 mt-3"
              style={{ borderRadius: 8 }}
            >
              <Card.Body className="d-flex justify-content-between align-items-center small text-muted">
                <span>
                  Showing {filtered.length} of {rows.length} bookings
                </span>
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>

      {/* Details modal — backdrop="static" + keyboard={false} so the modal
          only closes when the user clicks the explicit Close / X button
          (no accidental close on outside-click or Esc). */}
      <Modal
        show={showDetails}
        onHide={closeDetails}
        size="lg"
        scrollable
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton className="bg-light">
          <Modal.Title className="fw-bold">
            Booking Details — {selected?.bookingCode}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingDetails && (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" /> Loading details…
            </div>
          )}
          {!loadingDetails && selected && (
            <>
              {/* Customer details */}
              <h6 className="fw-bold border-bottom pb-1 mb-2">
                Customer Details
              </h6>
              <Row className="g-2 mb-3">
                <Col md={6}>
                  <strong>Name:</strong>{" "}
                  {[
                    selected.salutation,
                    selected.customerFirstName,
                    selected.customerLastName,
                  ]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </Col>
                <Col md={6}>
                  <strong>Email:</strong> {selected.customerEmail || "—"}
                </Col>
                <Col md={6}>
                  <strong>Phone:</strong> {selected.customerPhone || "—"}
                </Col>
                <Col md={6}>
                  <strong>Passport:</strong> {selected.customerPassport || "—"}
                </Col>
                <Col md={6}>
                  <strong>Nationality:</strong>{" "}
                  {selected.customerNationality || "—"}
                </Col>
                <Col md={6}>
                  <strong>Agent:</strong> {selected.agentName || "—"}
                </Col>
              </Row>

              {/* Pre-booking acceptance audit — mirrors the
                  accepted_terms / accepted_cancellation /accepted_at
                  columns persisted on mypkg_v2_booking when the customer
                  ticked the policy modal before the Order Summary. */}
              <h6 className="fw-bold border-bottom pb-1 mb-2">
                Policy Acceptance
              </h6>
              <Row className="g-2 mb-3">
                <Col md={6}>
                  <strong>Terms &amp; Conditions:</strong>{" "}
                  {selected.acceptedTerms ? (
                    <Badge bg="success">Accepted</Badge>
                  ) : (
                    <Badge bg="secondary">Not recorded</Badge>
                  )}
                </Col>
                <Col md={6}>
                  <strong>Cancellation Policies:</strong>{" "}
                  {selected.acceptedCancellation ? (
                    <Badge bg="success">Accepted</Badge>
                  ) : (
                    <Badge bg="secondary">Not recorded</Badge>
                  )}
                </Col>
                <Col md={12}>
                  <strong>Accepted On:</strong>{" "}
                  {selected.acceptedAt
                    ? new Date(selected.acceptedAt).toLocaleString()
                    : "—"}
                </Col>
              </Row>

              {/* Booking summary */}
              <h6 className="fw-bold border-bottom pb-1 mb-2">
                Booking Summary
              </h6>
              <Row className="g-2 mb-3">
                <Col md={6}>
                  <strong>Booking Date:</strong>{" "}
                  {selected.bookingDate
                    ? new Date(selected.bookingDate).toLocaleString()
                    : "—"}
                </Col>
                <Col md={6}>
                  <strong>Tour Date:</strong> {selected.tourDate || "—"}
                </Col>
                <Col md={6}>
                  <strong>Status:</strong>{" "}
                  {(() => {
                    if (selected.isCancelled) {
                      return <Badge bg="danger">Cancelled</Badge>;
                    }
                    const s = String(selected.bookingStatus || "Confirmed").trim();
                    const map = {
                      confirmed: "success",
                      completed: "secondary",
                      "on request": "warning",
                      reconfirmed: "info",
                      invoiced: "primary",
                      failed: "dark",
                      cancelled: "danger",
                    };
                    return <Badge bg={map[s.toLowerCase()] || "success"}>{s}</Badge>;
                  })()}
                </Col>
                <Col md={6}>
                  <strong>Payment Mode:</strong> {selected.paymentMode || "—"}
                </Col>
                <Col md={6}>
                  <strong>Selling Price:</strong> ₹{" "}
                  {Number(selected.sellingPrice || 0).toLocaleString()}
                </Col>
                <Col md={6}>
                  <strong>Total Price:</strong> ₹{" "}
                  {Number(selected.totalPrice || 0).toLocaleString()}
                </Col>
              </Row>

              {/* Hotels */}
              {selected.hotels?.length > 0 && (
                <>
                  <h6 className="fw-bold border-bottom pb-1 mb-2">Hotels</h6>
                  <Table size="sm" bordered className="mb-3">
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
                      {selected.hotels.map((h, i) => (
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
                          <td>₹ {Number(h.totalRate || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}

              {/* Transfers */}
              {selected.cabs?.length > 0 && (
                <>
                  <h6 className="fw-bold border-bottom pb-1 mb-2">Transfers</h6>
                  <Table size="sm" bordered className="mb-3">
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
                      {selected.cabs.map((c, i) => (
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
                          <td>₹ {Number(c.totalRate || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}

              {/* Activities */}
              {selected.activities?.length > 0 && (
                <>
                  <h6 className="fw-bold border-bottom pb-1 mb-2">
                    Tours &amp; Activities
                  </h6>
                  <Table size="sm" bordered className="mb-3">
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
                      {selected.activities.map((a, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{a.activityName || `#${a.activityId}`}</td>
                          <td>{a.tourDate || "—"}</td>
                          <td>
                            {a.noOfAdult || 0}A / {a.noOfChild || 0}C
                          </td>
                          <td>₹ {Number(a.totalRate || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}

              {/* Guests — full pax manifest. The lead traveller is
                  flagged with a "Primary" badge and surfaces the
                  booking-owner contact details (email / phone /
                  passport / native country / agent LPO). */}
              {selected.guests?.length > 0 && (
                <>
                  <h6 className="fw-bold border-bottom pb-1 mb-2">
                    Guests ({selected.guests.length})
                  </h6>
                  <Table size="sm" bordered className="mb-3">
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
                      {selected.guests.map((g, i) => {
                        const isPrimary = g.primaryGuest === true;
                        const contactBits = [];
                        if (g.email) contactBits.push(`✉ ${g.email}`);
                        if (g.phone) contactBits.push(`☎ ${g.phone}`);
                        if (g.passportNo)
                          contactBits.push(`Passport: ${g.passportNo}`);
                        if (g.nativeCountry)
                          contactBits.push(`Nationality: ${g.nativeCountry}`);
                        if (g.agentLpo) contactBits.push(`LPO: ${g.agentLpo}`);
                        return (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>
                              {g.isChild ? "CHD" : "ADT"}
                              {isPrimary && <span className="ms-1"></span>}
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
                </>
              )}

              {/* Add-on services */}
              {selected.addOnServices &&
                Object.keys(selected.addOnServices).length > 0 && (
                  <>
                    <h6 className="fw-bold border-bottom pb-1 mb-2">
                      Add-On Services
                    </h6>
                    <Row className="g-2 mb-3">
                      {Object.entries(selected.addOnServices).map(
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
                  </>
                )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeDetails}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancel modal */}
      <Modal show={showCancel} onHide={() => setShowCancel(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Cancel Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Cancel booking <strong>{toCancel?.bookingCode}</strong>?
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
            Voucher — {pdfBooking?.bookingCode || ""}
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
};

export default MakeYourOwnPackageV2BookingList;
