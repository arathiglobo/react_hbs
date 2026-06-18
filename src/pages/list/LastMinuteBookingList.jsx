import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Table,
  Spinner,
  Form,
  InputGroup,
  Badge,
  Modal,
  Row,
  Col,
  Pagination,
} from "react-bootstrap";
import {
  FaEye,
  FaSearch,
  FaInbox,
  FaUser,
  FaUsers,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";
import { formatDateTime } from "../../utils/dateUtils";

// Rows-per-page choices — same set as /booking-details/hotel-booking-list.
const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const STATUS_META = {
  CONFIRMED: { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  Confirmed: { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  ReConfirmed: { label: "ReConfirmed", bg: "#e6f0ff", color: "#1d4ed8", dot: "#3b82f6" },
  Requested: { label: "Requested", bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  PENDING:   { label: "Pending",   bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  CANCELLED: { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
  Cancelled: { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
};

// Every customer/guest name on a booking. The backend now sends a
// `guestNames` array (collected across all room bookings); fall back to
// the single `customerName` for older payload shapes.
const getGuestNames = (booking) => {
  if (Array.isArray(booking?.guestNames) && booking.guestNames.length > 0) {
    return booking.guestNames.filter((n) => String(n ?? "").trim());
  }
  return booking?.customerName && booking.customerName !== "-"
    ? [booking.customerName]
    : [];
};

// Booking Type filter options — mirrors the dropdown on
// /booking-details/hotel-booking-list, adapted to the fields the
// last-minute list row actually carries (confirmationStatus / isCancelled /
// checkOutDate). Filtering is client-side over the already-fetched list.
const BOOKING_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "reconfirmed", label: "ReConfirmed" },
  { value: "confirmed", label: "Confirmed" },
  { value: "requested", label: "Requested" },
  { value: "cancelled", label: "Cancelled" },
];

// True when a booking matches the selected Booking Type. "Upcoming" /
// "Completed" are derived from the stay's check-out date (cancelled rows are
// excluded from both); the status options match the backend's formatted
// confirmationStatus ("ReConfirmed" / "Confirmed" / "Requested").
const matchesBookingType = (booking, type) => {
  if (!type || type === "all") return true;
  const isCancelled = booking?.isCancelled === true;
  if (type === "cancelled") return isCancelled;
  if (isCancelled) return false;

  const status = String(booking?.confirmationStatus || "")
    .replace(/\s+/g, "")
    .toLowerCase();
  if (type === "reconfirmed") return status === "reconfirmed";
  if (type === "confirmed") return status === "confirmed";
  if (type === "requested") return status === "requested";

  const co = booking?.checkOutDate ? new Date(booking.checkOutDate) : null;
  if (!co || isNaN(co.getTime())) return type === "upcoming";
  co.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (type === "upcoming") return co >= today;
  if (type === "completed") return co < today;
  return true;
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
/**
 * LastMinuteBookingList — mirrors HotelBookingList.jsx structure for the
 * Last Minute flow. Talks to /api/last-minute-booking/list, /api/last-minute-
 * booking/{id} (view), and /api/last-minute-booking/{id}/cancel.
 *
 * Columns: S.N · Customer · Booking Code · Hotel · Supplier · Supplier Ref ·
 * Check-in · Check-out · Total · Payment Method · Status · Actions.
 * Action column is the eye icon only; it navigates to
 * /booking-details/last-minute-booking/:id where Voucher (PDF in new
 * tab), Invoice (/invoice?bookingId=... in new tab), and Cancel
 * (SweetAlert confirm + PATCH .../cancel) live as buttons at the
 * bottom-left of the detail view.
 *
 * Supplier / Supplier Ref / Payment Method may be left blank by the backend
 * and rendered as "-" — they are populated by ops at a later stage.
 */
export default function LastMinuteBookingList() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Booking Type filter — same control as /booking-details/hotel-booking-list.
  const [bookingType, setBookingType] = useState("all");
  // Time Period filter (by check-in month/year) — same control + position as
  // /booking-details/hotel-booking-list. Either field can be set independently.
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  // Client-side pagination — same UX as /booking-details/hotel-booking-list.
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_OPTIONS[0]);
  // "Customers (N)" modal — opened from the "+N more" badge on the
  // Customer column to show every guest on a booking.
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [customersModalBooking, setCustomersModalBooking] = useState(null);

  const handleShowCustomers = (booking) => {
    setCustomersModalBooking(booking);
    setShowCustomersModal(true);
  };

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

  // Month / Year option lists for the Time Period selectors.
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2014 }, (_, i) => 2020 + i);

  // Client-side filter by Booking Type, Time Period (check-in month/year),
  // then search term (booking code / customer / hotel name).
  const filtered = bookings.filter((b) => {
    if (!matchesBookingType(b, bookingType)) return false;
    // Time Period — match the check-in date's month/year (mirrors the hotel
    // list, whose month/year primarily filters on checkInDate). Each field is
    // optional and applied independently.
    if (selectedMonth || selectedYear) {
      const ci = b.checkInDate ? new Date(b.checkInDate) : null;
      if (!ci || isNaN(ci.getTime())) return false;
      if (selectedMonth && ci.getMonth() + 1 !== Number(selectedMonth)) return false;
      if (selectedYear && ci.getFullYear() !== Number(selectedYear)) return false;
    }
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (b.bookingCode || "").toLowerCase().includes(q) ||
      (b.customerName || "").toLowerCase().includes(q) ||
      getGuestNames(b).some((n) => n.toLowerCase().includes(q)) ||
      (b.hotelName || "").toLowerCase().includes(q)
    );
  });

  // ── Pagination (client-side, over the filtered list) ──────────────────
  const totalEntries = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / perPage));
  // Clamp the active page if filtering/resizing shrank the result set.
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * perPage;
  const pageItems = filtered.slice(startIdx, startIdx + perPage);
  const displayStart = totalEntries === 0 ? 0 : startIdx + 1;
  const displayEnd = Math.min(startIdx + perPage, totalEntries);

  // Jump back to page 1 whenever the filters change so the user isn't
  // stranded on an out-of-range page.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, bookingType, selectedMonth, selectedYear, perPage]);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
  };

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
            {/* Header: Title + Search (left) | Time Period (right) — mirrors
                /booking-details/hotel-booking-list */}
            <div className="d-flex justify-content-between align-items-end mb-3">
              <div>
                <h3 className="fw-bold text-dark mb-2">Last Minute Bookings</h3>
                <InputGroup style={{ height: "40px", width: "300px" }}>
                  <InputGroup.Text
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderRight: "none",
                      borderColor: "#dee2e6",
                    }}
                  >
                    <FaSearch style={{ color: "#6c757d" }} />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search by code / customer / hotel"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      borderLeft: "none",
                      fontSize: "0.85rem",
                      borderColor: "#dee2e6",
                      height: "40px",
                    }}
                  />
                </InputGroup>
              </div>
              <Card
                className="shadow-sm border-0"
                style={{ borderRadius: "8px", minWidth: "260px" }}
              >
                <Card.Body className="p-3">
                  <h6
                    className="mb-2 fw-bold text-dark"
                    style={{ fontSize: "0.85rem", letterSpacing: "0.4px" }}
                  >
                    Time Period
                  </h6>
                  <Row className="g-2">
                    <Col xs={6}>
                      <Form.Select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="form-control"
                        size="sm"
                        style={{ fontSize: "0.82rem", height: "45px" }}
                      >
                        <option value="">Month</option>
                        {months.map((month, index) => (
                          <option key={month} value={index + 1}>
                            {month.slice(0, 3)}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col xs={6}>
                      <Form.Select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="form-control"
                        size="sm"
                        style={{ fontSize: "0.82rem", height: "45px" }}
                      >
                        <option value="">Year</option>
                        {years.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </div>

            {/* Booking Type filter — mirrors /booking-details/hotel-booking-list */}
            <Row className="mb-2 g-1">
              <Col xs={12}>
                <Card
                  className="shadow-sm border-0 w-100"
                  style={{ borderRadius: "8px" }}
                >
                  <Card.Body className="p-3">
                    <h6
                      className="mb-2 fw-bold text-dark"
                      style={{ fontSize: "0.85rem", letterSpacing: "0.4px" }}
                    >
                      Booking Type
                    </h6>

                    <Row className="g-2">
                      <Col xs={12} md={6} lg={4} xl={3}>
                        <Form.Select
                          value={bookingType}
                          onChange={(e) => setBookingType(e.target.value)}
                          size="sm"
                          aria-label="Booking type filter"
                          style={{ fontSize: "0.85rem", height: "46px" }}
                        >
                          {BOOKING_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

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
                            <th className="text-center" style={{ width: "70px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageItems.map((b, idx) => {
                            const statusText = b.isCancelled
                              ? "Cancelled"
                              : b.confirmationStatus || "Confirmed";
                            const sMeta = STATUS_META[statusText];
                            return (
                              <tr key={b.bookingId}>
                                <td className="text-muted">{startIdx + idx + 1}</td>
                                {/* Customer — a booking can hold many guests.
                                    Show the first prominently; the rest sit
                                    behind a "+N more" badge that opens the
                                    Customers modal. */}
                                <td>
                                  {(() => {
                                    const names = getGuestNames(b);
                                    const first = names[0] || "-";
                                    const extra = Math.max(0, names.length - 1);
                                    return (
                                      <div
                                        className="d-flex align-items-center"
                                        style={{ gap: "0.4rem", flexWrap: "wrap" }}
                                      >
                                        <span
                                          className="d-inline-flex align-items-center"
                                          style={{ gap: "0.3rem" }}
                                        >
                                          <FaUser
                                            style={{
                                              color: "#98a2b3",
                                              fontSize: "0.72rem",
                                              flexShrink: 0,
                                            }}
                                          />
                                          <span className="fw-medium text-dark">
                                            {first}
                                          </span>
                                        </span>
                                        {extra > 0 && (
                                          <Badge
                                            bg="light"
                                            text="primary"
                                            role="button"
                                            tabIndex={0}
                                            title="View all customers"
                                            onClick={() => handleShowCustomers(b)}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                handleShowCustomers(b);
                                              }
                                            }}
                                            style={{
                                              cursor: "pointer",
                                              border: "1px solid #cfe2ff",
                                              fontWeight: 600,
                                              fontSize: "0.68rem",
                                            }}
                                          >
                                            +{extra} more
                                          </Badge>
                                        )}
                                      </div>
                                    );
                                  })()}
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
                                    {b.displayCurrencyCode &&
                                    b.displayCurrencyCode !== "AED" &&
                                    Number(b.displayAmount) > 0
                                      ? `${b.displayCurrencyCode} ${Number(b.displayAmount).toFixed(2)}`
                                      : b.totalRate != null
                                        ? `AED ${Number(b.totalRate).toFixed(2)}`
                                        : "-"}
                                  </span>
                                </td>
                                <td>{b.paymentMethod || "-"}</td>
                                <td>
                                  <StatusPill meta={sMeta} raw={statusText} />
                                </td>
                                <td className="text-center">
                                  <button
                                    type="button"
                                    className="btn btn-sm border-0 p-1"
                                    style={{
                                      backgroundColor: "#eff6ff",
                                      color: "#1d4ed8",
                                      borderRadius: "6px",
                                    }}
                                    onClick={() =>
                                      navigate(
                                        `/booking-details/last-minute-booking/${b.bookingId}`,
                                        { state: { booking: b } },
                                      )
                                    }
                                    title="View details"
                                  >
                                    <FaEye style={{ fontSize: "12px" }} />
                                  </button>
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

                    {/* Pagination footer — mirrors /booking-details/hotel-booking-list */}
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mt-3">
                      <div className="text-muted" style={{ fontSize: "0.875rem" }}>
                        Showing{" "}
                        <span className="fw-semibold text-dark">{displayStart}</span>{" "}
                        to <span className="fw-semibold text-dark">{displayEnd}</span>{" "}
                        of <span className="fw-semibold text-dark">{totalEntries}</span>{" "}
                        entries
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="text-muted" style={{ fontSize: "0.8rem" }}>
                          Rows per page
                        </span>
                        <Form.Select
                          size="sm"
                          value={perPage}
                          onChange={(e) => setPerPage(Number(e.target.value))}
                          style={{ width: "auto", fontSize: "0.8rem" }}
                        >
                          {PER_PAGE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </Form.Select>
                      </div>
                      <Pagination className="mb-0">
                        <Pagination.Prev
                          disabled={safePage === 1}
                          onClick={() => goToPage(safePage - 1)}
                          style={{
                            cursor: safePage === 1 ? "not-allowed" : "pointer",
                            opacity: safePage === 1 ? 0.5 : 1,
                          }}
                        />
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                          (pageNumber) => (
                            <Pagination.Item
                              key={pageNumber}
                              active={safePage === pageNumber}
                              onClick={() => goToPage(pageNumber)}
                              style={{
                                cursor: "pointer",
                                minWidth: "38px",
                                textAlign: "center",
                              }}
                            >
                              {pageNumber}
                            </Pagination.Item>
                          ),
                        )}
                        <Pagination.Next
                          disabled={safePage === totalPages}
                          onClick={() => goToPage(safePage + 1)}
                          style={{
                            cursor:
                              safePage === totalPages ? "not-allowed" : "pointer",
                            opacity: safePage === totalPages ? 0.5 : 1,
                          }}
                        />
                      </Pagination>
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>

      {/* Customers Modal — full guest list for a single booking */}
      <Modal
        show={showCustomersModal}
        onHide={() => setShowCustomersModal(false)}
        centered
        size="sm"
      >
        <Modal.Header closeButton style={{ borderBottom: "2px solid #e9ecef" }}>
          <Modal.Title
            className="fw-bold d-flex align-items-center"
            style={{ fontSize: "1rem" }}
          >
            <FaUsers className="me-2 text-primary" />
            <span>Customers ({getGuestNames(customersModalBooking).length})</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {customersModalBooking?.bookingCode && (
            <div className="text-muted mb-2" style={{ fontSize: "0.78rem" }}>
              Booking Code:{" "}
              <span className="fw-semibold" style={{ color: "#1d4ed8" }}>
                {customersModalBooking.bookingCode}
              </span>
            </div>
          )}
          <ul className="list-unstyled mb-0">
            {getGuestNames(customersModalBooking).map((name, idx) => (
              <li
                key={idx}
                className="d-flex align-items-center py-2"
                style={{ gap: "0.5rem", borderBottom: "1px solid #f1f3f5" }}
              >
                <FaUser style={{ color: "#98a2b3", flexShrink: 0 }} />
                <span className="fw-medium text-dark">{name}</span>
              </li>
            ))}
            {getGuestNames(customersModalBooking).length === 0 && (
              <li className="text-muted py-2">No customers found.</li>
            )}
          </ul>
        </Modal.Body>
      </Modal>
    </div>
  );
}
