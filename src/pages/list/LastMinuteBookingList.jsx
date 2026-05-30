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
} from "react-bootstrap";
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
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h4 className="mb-0">Last Minute Bookings</h4>
                <small className="text-muted">
                  All bookings created via the Last Minute Booking flow.
                </small>
              </div>
              <div className="d-flex align-items-center gap-2">
                <FaSearch className="text-muted" />
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search by code / customer / hotel"
                  style={{ minWidth: 280 }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <Card className="shadow-sm">
              <Card.Body className="p-0">
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" />
                    <div className="text-muted mt-2 small">Loading…</div>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <FaInbox className="display-4 mb-3" />
                    <h5>No last-minute bookings yet</h5>
                    <p className="mb-0">
                      They'll appear here once you create one via{" "}
                      <em>New Booking → Last Minute Booking</em>.
                    </p>
                  </div>
                ) : (
                  <Table responsive hover className="mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 60 }}>S.N</th>
                        <th>Customer</th>
                        <th>Booking Code</th>
                        <th>Hotel</th>
                        <th>Supplier</th>
                        <th>Supplier Ref</th>
                        <th>Check-in</th>
                        <th>Check-out</th>
                        <th>Total</th>
                        <th>Payment Method</th>
                        <th>Status</th>
                        <th style={{ width: 180 }} className="text-center">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((b, idx) => (
                        <tr key={b.bookingId}>
                          <td>{idx + 1}</td>
                          <td>{b.customerName || "-"}</td>
                          <td className="fw-semibold text-primary">
                            {b.bookingCode || "-"}
                          </td>
                          <td>{b.hotelName || "-"}</td>
                          {/* Supplier name — left blank for later entry. */}
                          <td>
                            {b.supplierName && b.supplierName !== "Inhouse"
                              ? b.supplierName
                              : "-"}
                          </td>
                          {/* Supplier ref — backend defaults to "0"; render
                              "-" so it can be edited/entered later. */}
                          <td>
                            {b.supplierReference &&
                            b.supplierReference !== "0"
                              ? b.supplierReference
                              : "-"}
                          </td>
                          <td>{formatDateTime(b.checkInDate)}</td>
                          <td>{formatDateTime(b.checkOutDate)}</td>
                          <td>
                            {b.totalRate != null
                              ? `AED ${Number(b.totalRate).toFixed(2)}`
                              : "-"}
                          </td>
                          {/* Payment Method — e.g. Credit Limit / Card /
                              Bank Transfer / Top Up / Credit Points. The
                              backend resolves the value from the booking's
                              payment record when available; renders "-" until
                              the payment integration is wired up. */}
                          <td>{b.paymentMethod || "-"}</td>
                          <td>
                            {b.isCancelled ? (
                              <Badge bg="danger">Cancelled</Badge>
                            ) : (
                              <Badge bg="success">
                                {b.confirmationStatus || "Confirmed"}
                              </Badge>
                            )}
                          </td>
                          <td>
                            <div className="d-flex justify-content-center gap-2">
                              <FaEye
                                role="button"
                                title="View details"
                                className="text-primary"
                                style={{ fontSize: 18, cursor: "pointer" }}
                                onClick={() => handleView(b.bookingId)}
                              />
                              {!b.isCancelled && (
                                <FaTrashAlt
                                  role="button"
                                  title="Cancel booking"
                                  className="text-danger"
                                  style={{ fontSize: 18, cursor: "pointer" }}
                                  onClick={() =>
                                    handleCancel(b.bookingId, b.bookingCode)
                                  }
                                />
                              )}
                              <FaFilePdf
                                role="button"
                                title="View Voucher"
                                className="text-success"
                                style={{ fontSize: 18, cursor: "pointer" }}
                                onClick={() => handleViewVoucher(b.bookingId)}
                              />
                              <FaFileInvoice
                                role="button"
                                title="View Invoice"
                                className="text-warning"
                                style={{ fontSize: 18, cursor: "pointer" }}
                                onClick={() => handleViewInvoice(b.bookingId)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
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
