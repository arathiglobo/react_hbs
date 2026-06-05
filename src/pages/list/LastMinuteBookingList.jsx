import React, { useEffect, useState } from "react";
import {
  Container,
  Card,
  Table,
  Spinner,
  Badge,
  Button,
  Modal,
  Row,
  Col,
  Alert,
  Form,
  InputGroup,
} from "react-bootstrap";

const STATUS_META = {
  CONFIRMED: { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  Confirmed: { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  PENDING:   { label: "Pending",   bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  CANCELLED: { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
  Cancelled: { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
};

const StatusPill = ({ meta, raw }) => {
  if (!meta) return <span className="text-muted">{raw || "-"}</span>;
  return (
    <span
      className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill"
      style={{
        backgroundColor: meta.bg,
        color: meta.color,
        fontSize: "0.7rem",
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {meta.dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: meta.dot,
            display: "inline-block",
          }}
        />
      )}
      {meta.label}
    </span>
  );
};
import {
  FaEye,
  FaTrashAlt,
  FaSearch,
  FaInbox,
  FaFileInvoice,
  FaFilePdf,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { formatDateTime } from "../../utils/dateUtils";

/**
 * LastMinuteBookingList — mirrors HotelBookingList.jsx structure for the
 * Last Minute flow. Talks to /api/last-minute-booking/list, /api/last-minute-
 * booking/{id} (view), and /api/last-minute-booking/{id}/cancel.
 *
 * Columns: S.N · Customer · Booking Code · Hotel · Supplier · Supplier Ref ·
 * Check-in · Check-out · Total · Payment Method · Status · Actions.
 * Actions: View · Cancel (trash) · View Voucher · View Invoice.
 *
 * Supplier / Supplier Ref / Payment Method may be left blank by the backend
 * and rendered as "-" — they are populated by ops at a later stage.
 *
 * View click → opens a Modal showing the full booking detail. Cancel click →
 * SweetAlert confirm, then PATCH cancel; on success refreshes the list.
 */
export default function LastMinuteBookingList() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // View modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewBooking, setViewBooking] = useState(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/api/last-minute-booking/list");
      setBookings(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load last-minute bookings");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // ── View handler ──
  const handleView = async (bookingId) => {
    try {
      setShowViewModal(true);
      setViewLoading(true);
      setViewBooking(null);
      const res = await axiosInstance.get(`/api/last-minute-booking/${bookingId}`);
      setViewBooking(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load booking details");
      setShowViewModal(false);
    } finally {
      setViewLoading(false);
    }
  };

  // ── View Voucher handler — calls the existing PDF endpoint and opens the
  //    returned URL in a new tab. The backend returns a path under /uploads/…
  //    that the FE can render directly.
  const handleViewVoucher = async (bookingId) => {
    try {
      const res = await axiosInstance.get(
        `/api/last-minute-booking/${bookingId}/voucher`
      );
      const status = res.data?.status;
      const url = res.data?.pdfUrl || res.data?.pdfPath;
      if (status === "SUCCESS" && url) {
        window.open(url, "_blank");
      } else {
        toast.error(res.data?.message || "Voucher not available yet.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load voucher");
    }
  };

  // ── View Invoice handler — opens the invoice page for this booking. The
  //    existing /invoice page accepts bookingId via query string.
  const handleViewInvoice = (bookingId) => {
    window.open(`/invoice?bookingId=${bookingId}`, "_blank");
  };

  // ── Cancel handler ──
  const handleCancel = async (bookingId, bookingCode) => {
    const result = await Swal.fire({
      title: "Cancel this booking?",
      text: `Booking ${bookingCode} will be marked as cancelled. This sets is_cancelled = true and records the cancellation timestamp.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, cancel it",
      cancelButtonText: "Keep booking",
      input: "textarea",
      inputLabel: "Reason (optional)",
      inputPlaceholder: "Why are you cancelling?",
    });
    if (!result.isConfirmed) return;

    try {
      const res = await axiosInstance.patch(
        `/api/last-minute-booking/${bookingId}/cancel`,
        { reason: result.value || null }
      );
      if (res.data?.success) {
        toast.success("Booking cancelled");
        fetchBookings();
      } else {
        toast.error(res.data?.message || "Cancel failed");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Cancel failed");
    }
  };

  // Client-side filter by search term (booking code / customer / hotel name).
  const filtered = bookings.filter((b) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (b.bookingCode || "").toLowerCase().includes(q) ||
      (b.customerName || "").toLowerCase().includes(q) ||
      (b.hotelName || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main
          className="flex-grow-1 p-3"
          style={{ width: "100%", overflow: "hidden" }}
        >
          <Container
            fluid
            style={{
              maxWidth: "100%",
              paddingLeft: "0.5rem",
              paddingRight: "0.5rem",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="mb-0 text-dark fw-semibold">Last Minute Bookings</h5>
            </div>

            <Card
              className="border mb-3 shadow-sm"
              style={{ borderRadius: "6px" }}
            >
              <Card.Header
                className="d-flex justify-content-between align-items-center text-dark border-bottom py-2"
                style={{
                  borderRadius: "6px 6px 0 0",
                  backgroundColor: "#f8f9fa",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                <span>List of Bookings</span>
              </Card.Header>
              <Card.Body style={{ padding: "1.5rem 1rem 1rem" }}>
                <div
                  className="d-flex flex-wrap justify-content-end align-items-center gap-2"
                  style={{ marginBottom: "1.5rem" }}
                >
                  <InputGroup size="sm" style={{ width: "300px" }}>
                    <InputGroup.Text
                      style={{
                        fontSize: "0.75rem",
                        backgroundColor: "#ffffff",
                        borderRight: "none",
                        color: "#98a2b3",
                      }}
                    >
                      <FaSearch />
                    </InputGroup.Text>
                    <Form.Control
                      type="text"
                      placeholder="Search by code / customer / hotel"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ fontSize: "0.8rem", borderLeft: "none" }}
                    />
                  </InputGroup>
                </div>

                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3 text-muted">Loading bookings...</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <FaInbox className="display-4 mb-3" style={{ opacity: 0.4 }} />
                    <h6 className="fw-semibold">No last-minute bookings yet</h6>
                    <p className="mb-0 small">
                      They'll appear here once you create one via{" "}
                      <em>New Booking → Last Minute Booking</em>.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="table-responsive saas-table-wrap">
                      <Table hover className="mb-0 align-middle saas-table">
                        <thead>
                          <tr>
                            <th style={{ width: "48px" }}>#</th>
                            <th>Customer</th>
                            <th>Booking</th>
                            <th>Hotel</th>
                            <th>Supplier</th>
                            <th>Supplier Ref</th>
                            <th>Stay</th>
                            <th className="text-end">Total</th>
                            <th>Payment</th>
                            <th>Status</th>
                            <th className="text-center" style={{ width: "140px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((b, idx) => {
                            const statusText = b.isCancelled
                              ? "Cancelled"
                              : b.confirmationStatus || "Confirmed";
                            const sMeta = STATUS_META[statusText];
                            return (
                              <tr key={b.bookingId}>
                                <td className="text-muted">{idx + 1}</td>
                                <td>
                                  <span className="fw-medium text-dark">
                                    {b.customerName || "-"}
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className="fw-semibold"
                                    style={{ color: "#1d4ed8" }}
                                  >
                                    {b.bookingCode || "-"}
                                  </span>
                                </td>
                                <td>{b.hotelName || "-"}</td>
                                <td>
                                  {b.supplierName && b.supplierName !== "Inhouse"
                                    ? b.supplierName
                                    : "-"}
                                </td>
                                <td>
                                  {b.supplierReference && b.supplierReference !== "0"
                                    ? b.supplierReference
                                    : "-"}
                                </td>
                                <td style={{ whiteSpace: "nowrap" }}>
                                  <div>{formatDateTime(b.checkInDate)}</div>
                                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                    → {formatDateTime(b.checkOutDate)}
                                  </div>
                                </td>
                                <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                                  <span className="fw-semibold text-dark">
                                    {b.totalRate != null
                                      ? `AED ${Number(b.totalRate).toFixed(2)}`
                                      : "-"}
                                  </span>
                                </td>
                                <td>{b.paymentMethod || "-"}</td>
                                <td>
                                  <StatusPill meta={sMeta} raw={statusText} />
                                </td>
                                <td className="text-center">
                                  <div className="d-flex justify-content-center gap-1">
                                    <button
                                      type="button"
                                      className="btn btn-sm border-0 p-1"
                                      style={{
                                        backgroundColor: "#eff6ff",
                                        color: "#1d4ed8",
                                        borderRadius: "6px",
                                      }}
                                      onClick={() => handleView(b.bookingId)}
                                      title="View details"
                                    >
                                      <FaEye style={{ fontSize: "12px" }} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm border-0 p-1"
                                      style={{
                                        backgroundColor: "#ecfdf5",
                                        color: "#1b7f3a",
                                        borderRadius: "6px",
                                      }}
                                      onClick={() => handleViewVoucher(b.bookingId)}
                                      title="View Voucher"
                                    >
                                      <FaFilePdf style={{ fontSize: "12px" }} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm border-0 p-1"
                                      style={{
                                        backgroundColor: "#fff7e6",
                                        color: "#b76e00",
                                        borderRadius: "6px",
                                      }}
                                      onClick={() => handleViewInvoice(b.bookingId)}
                                      title="View Invoice"
                                    >
                                      <FaFileInvoice style={{ fontSize: "12px" }} />
                                    </button>
                                    {!b.isCancelled && (
                                      <button
                                        type="button"
                                        className="btn btn-sm border-0 p-1"
                                        style={{
                                          backgroundColor: "#fef2f2",
                                          color: "#b42318",
                                          borderRadius: "6px",
                                        }}
                                        onClick={() =>
                                          handleCancel(b.bookingId, b.bookingCode)
                                        }
                                        title="Cancel booking"
                                      >
                                        <FaTrashAlt style={{ fontSize: "12px" }} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>

                    <style>{`
                      .saas-table-wrap { border: 1px solid #eaecf0; border-radius: 8px; overflow-x: auto; }
                      .saas-table { font-size: 0.8rem; margin-bottom: 0; }
                      .saas-table thead th {
                        background-color: #f9fafb;
                        color: #667085;
                        font-size: 0.68rem;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                        border-bottom: 1px solid #eaecf0;
                        border-top: none;
                        padding: 0.65rem 0.75rem;
                        white-space: nowrap;
                      }
                      .saas-table tbody td {
                        padding: 0.65rem 0.75rem;
                        border-top: 1px solid #f2f4f7;
                        vertical-align: middle;
                        color: #344054;
                      }
                      .saas-table tbody tr:first-child td { border-top: none; }
                      .saas-table tbody tr:hover { background-color: #fafbfc; }
                    `}</style>
                  </>
                )}
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>

      {/* ── View Modal — full booking detail ─────────────────────────── */}
      <Modal
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Booking Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewLoading ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : !viewBooking ? (
            <Alert variant="warning">No data available.</Alert>
          ) : (
            <BookingDetailContent booking={viewBooking} />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowViewModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// ─── Detail content used inside the View modal ─────────────────────────────
function BookingDetailContent({ booking: b }) {
  const fmt = (v) => (v == null || v === "" ? "—" : String(v));
  const fmtDt = (v) => {
    if (!v) return "—";
    const normalized = String(v).includes("T") ? v : `${v}T00:00:00`;
    return new Date(normalized).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  };
  const c = b.customer || {};
  return (
    <div>
      {b.isCancelled && (
        <Alert variant="danger" className="py-2">
          <strong>Cancelled</strong> at {fmtDt(b.cancelledAt)}
          {b.cancellationReason ? ` — ${b.cancellationReason}` : ""}
        </Alert>
      )}

      <h6 className="fw-bold mb-2">Booking</h6>
      <Row className="mb-3">
        <Col md={4}>
          <small className="text-muted d-block">Booking Code</small>
          <strong className="text-primary">{fmt(b.bookingCode)}</strong>
        </Col>
        <Col md={4}>
          <small className="text-muted d-block">Reference No.</small>
          <span>{fmt(b.referenceNumber)}</span>
        </Col>
        <Col md={4}>
          <small className="text-muted d-block">Booking Date</small>
          <span>{fmtDt(b.bookingDate)}</span>
        </Col>
      </Row>

      <h6 className="fw-bold mb-2">Hotel</h6>
      <Row className="mb-3">
        <Col md={6}>
          <small className="text-muted d-block">Hotel Name</small>
          <span>{fmt(b.hotelName)}</span>
        </Col>
        <Col md={6}>
          <small className="text-muted d-block">Address</small>
          <span>{fmt(b.address)}</span>
        </Col>
      </Row>

      <h6 className="fw-bold mb-2">Stay</h6>
      <Row className="mb-3">
        <Col md={3}>
          <small className="text-muted d-block">Check-in</small>
          <span>{fmt(b.checkInDate)}</span>
        </Col>
        <Col md={3}>
          <small className="text-muted d-block">Check-out</small>
          <span>{fmt(b.checkOutDate)}</span>
        </Col>
        <Col md={3}>
          <small className="text-muted d-block">Nights</small>
          <span>{fmt(b.nights)}</span>
        </Col>
        <Col md={3}>
          <small className="text-muted d-block">Total</small>
          <strong>
            {b.totalRate != null ? `AED ${Number(b.totalRate).toFixed(2)}` : "—"}
          </strong>
        </Col>
      </Row>

      <h6 className="fw-bold mb-2">Primary Guest</h6>
      <Row className="mb-3">
        <Col md={6}>
          <small className="text-muted d-block">Name</small>
          <span>
            {[c.salutation, c.firstName, c.middleName, c.lastName]
              .filter(Boolean)
              .join(" ") || "—"}
          </span>
        </Col>
        <Col md={3}>
          <small className="text-muted d-block">Email</small>
          <span>{fmt(c.email)}</span>
        </Col>
        <Col md={3}>
          <small className="text-muted d-block">Phone</small>
          <span>{fmt(c.phone)}</span>
        </Col>
        <Col md={3} className="mt-2">
          <small className="text-muted d-block">Passport</small>
          <span>{fmt(c.passportNo)}</span>
        </Col>
        <Col md={3} className="mt-2">
          <small className="text-muted d-block">Nationality</small>
          <span>{fmt(c.nationality)}</span>
        </Col>
      </Row>

      <h6 className="fw-bold mb-2">Rooms ({b.rooms?.length || 0})</h6>
      {b.rooms && b.rooms.length > 0 ? (
        <Table size="sm" bordered className="mb-3">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Category</th>
              <th>Meal Plan</th>
              <th>Adults</th>
              <th>Children</th>
              <th>Rate</th>
              <th>Refund</th>
            </tr>
          </thead>
          <tbody>
            {b.rooms.map((r, i) => (
              <tr key={i}>
                <td>{r.roomNo ?? i + 1}</td>
                <td>{fmt(r.roomCategory)}</td>
                <td>{fmt(r.mealPlan)}</td>
                <td>{fmt(r.adults)}</td>
                <td>{fmt(r.children)}</td>
                <td>
                  {r.rate != null ? `${r.currency || "AED"} ${Number(r.rate).toFixed(2)}` : "—"}
                </td>
                <td>
                  {r.nonRefundable ? (
                    <Badge bg="danger">Non-Refundable</Badge>
                  ) : (
                    <Badge bg="success">Flexible</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="text-muted small">No rooms on this booking.</p>
      )}

      {b.remarks && (
        <>
          <h6 className="fw-bold mb-2">Remarks</h6>
          <p className="text-muted">{b.remarks}</p>
        </>
      )}
    </div>
  );
}
