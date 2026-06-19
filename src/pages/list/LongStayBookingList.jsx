import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Table,
  Spinner,
  Pagination,
  Container,
  Form,
  InputGroup,
  Badge,
  Modal,
} from "react-bootstrap";
import { FaEye, FaSearch, FaUser, FaUsers } from "react-icons/fa";
import axiosInstance from "../../components/AxiosInstance";
import { formatDateTime } from "../../utils/dateUtils";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import { toast } from "react-hot-toast";

const STATUS_META = {
  CONFIRMED: { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  COMPLETED: { label: "Completed", bg: "#eff8ff", color: "#175cd3", dot: "#3b82f6" },
  PENDING:   { label: "Pending",   bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  CANCELLED: { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
};

// Every customer/guest name on a long-stay booking. The list payload
// already carries the full guest list under `rooms[].guests[]`; fall back
// to the single `primaryGuestName` when no per-room guests are present.
const getGuestNames = (booking) => {
  const names = [];
  if (Array.isArray(booking?.rooms)) {
    booking.rooms.forEach((room) => {
      (room?.guests || []).forEach((g) => {
        const n = [g?.salutation, g?.firstName, g?.lastName]
          .filter((p) => String(p ?? "").trim())
          .join(" ")
          .trim();
        if (n) names.push(n);
      });
    });
  }
  if (names.length === 0 && booking?.primaryGuestName) {
    names.push(booking.primaryGuestName);
  }
  return names;
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

export default function LongStayBookingList() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  // "Customers (N)" modal — opened from the "+N more" badge on the Guest
  // column to show every guest on a booking.
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [customersModalBooking, setCustomersModalBooking] = useState(null);

  const handleShowCustomers = (booking) => {
    setCustomersModalBooking(booking);
    setShowCustomersModal(true);
  };

  // Filters — mirrors /booking-details/24hr-booking-list (which
  // reuses HotelBookingList). All three are applied client-side over
  // the full list returned by /api/longStayBooking.
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all"); // all | upcoming | completed | cancelled
  const [selectedMonth, setSelectedMonth] = useState(""); // "" | 1..12
  const [selectedYear, setSelectedYear] = useState("");

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1, current + 2];
  }, []);

  // Fetch a large page so the three client-side filters (search /
  // status / month+year) can all run together. Backend pagination is
  // bypassed in favour of a single client-side window — same trade-off
  // HotelBookingList makes.
  const PAGE_SIZE = 10;

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(
        `/api/longStayBooking?page=0&size=500`
      );
      setBookings(res.data.content || []);
    } catch {
      toast.error("Failed to load Long Stay bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Apply search + status + time-period filters in one pass.
  const filteredBookings = useMemo(() => {
    const now = new Date();
    const needle = search.trim().toLowerCase();
    return (bookings || []).filter((b) => {
      // ── Status filter ──────────────────────────────────────────
      const isCancelled =
        b.bookingStatus === "CANCELLED" || b.cancelStatus === true;
      const checkIn = b.checkInDate ? new Date(b.checkInDate) : null;
      const checkOut = b.checkOutDate ? new Date(b.checkOutDate) : null;
      if (status === "cancelled" && !isCancelled) return false;
      if (status === "upcoming") {
        if (isCancelled) return false;
        if (!checkIn || checkIn < now) return false;
      }
      if (status === "completed") {
        if (isCancelled) return false;
        if (!checkOut || checkOut > now) return false;
      }

      // ── Time-period filter (uses check-in date) ────────────────
      if (checkIn && (selectedMonth || selectedYear)) {
        const m = checkIn.getMonth() + 1;
        const y = checkIn.getFullYear();
        if (selectedMonth && Number(selectedMonth) !== m) return false;
        if (selectedYear && Number(selectedYear) !== y) return false;
      }

      // ── Free-text search (booking code, guest, hotel, email) ───
      if (needle) {
        const hay = [
          b.bookingCode,
          b.primaryGuestName,
          ...getGuestNames(b),
          b.primaryGuestEmail,
          b.hotelName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [bookings, search, status, selectedMonth, selectedYear]);

  // Reset to page 0 whenever a filter changes.
  useEffect(() => {
    setPage(0);
  }, [search, status, selectedMonth, selectedYear]);

  // Derive pagination from the filtered list (not from backend).
  const filteredTotalPages = Math.max(
    1,
    Math.ceil(filteredBookings.length / PAGE_SIZE)
  );
  const pageBookings = filteredBookings.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );
  // Keep the existing totalPages state in sync (used by the
  // Pagination block below, unchanged).
  useEffect(() => {
    setTotalPages(filteredTotalPages);
  }, [filteredTotalPages]);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
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
              <h5 className="mb-0 text-dark fw-semibold">Long Stay Bookings</h5>
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
                {/* Toolbar row 1: pills + Time Period */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <div className="d-inline-flex p-1 rounded" style={{ backgroundColor: "#f3f4f6" }}>
                    {[
                      { value: "all", label: "All" },
                      { value: "upcoming", label: "Upcoming" },
                      { value: "completed", label: "Completed" },
                      { value: "cancelled", label: "Cancelled" },
                    ].map((opt) => {
                      const active = status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStatus(opt.value)}
                          className="border-0 px-3 py-1"
                          style={{
                            backgroundColor: active ? "#ffffff" : "transparent",
                            color: active ? "#101828" : "#667085",
                            fontSize: "0.78rem",
                            fontWeight: active ? 600 : 500,
                            borderRadius: "6px",
                            boxShadow: active ? "0 1px 2px rgba(16,24,40,0.08)" : "none",
                            transition: "all 0.15s",
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <span
                      className="text-uppercase text-muted fw-semibold"
                      style={{ fontSize: "0.68rem", letterSpacing: "0.05em" }}
                    >
                      Time Period
                    </span>
                    <Form.Select
                      size="sm"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      style={{ width: "auto", fontSize: "0.8rem", minWidth: "100px" }}
                    >
                      <option value="">Month</option>
                      {months.map((month, index) => (
                        <option key={month} value={index + 1}>
                          {month.slice(0, 3)}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Select
                      size="sm"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      style={{ width: "auto", fontSize: "0.8rem", minWidth: "90px" }}
                    >
                      <option value="">Year</option>
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </Form.Select>
                    {(selectedMonth || selectedYear) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMonth("");
                          setSelectedYear("");
                        }}
                        className="btn btn-sm border-0"
                        style={{
                          fontSize: "0.72rem",
                          color: "#667085",
                          padding: "0.25rem 0.5rem",
                        }}
                        title="Clear time period"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Toolbar row 2: search */}
                <div
                  className="d-flex flex-wrap justify-content-end align-items-center gap-2"
                  style={{ marginBottom: "1.5rem" }}
                >
                  <InputGroup size="sm" style={{ width: "280px" }}>
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
                      placeholder="Search bookings..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ fontSize: "0.8rem", borderLeft: "none" }}
                    />
                  </InputGroup>
                </div>

                {/* Table */}
                <div className="table-responsive saas-table-wrap">
                  <Table hover className="mb-0 align-middle saas-table">
                    <thead>
                      <tr>
                        <th style={{ width: "48px" }}>#</th>
                        <th>Booking</th>
                        <th>Booked On</th>
                        <th>Hotel</th>
                        <th>Guest</th>
                        <th>Stay</th>
                        <th className="text-center">Nights</th>
                        <th className="text-end">Total</th>
                        <th>Status</th>
                        <th className="text-center" style={{ width: "70px" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={10} className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-2 text-muted mb-0">Loading bookings...</p>
                          </td>
                        </tr>
                      ) : pageBookings.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="text-center py-5 text-muted">
                            No bookings found
                          </td>
                        </tr>
                      ) : (
                        pageBookings.map((b, i) => {
                          const sMeta = STATUS_META[b.bookingStatus];
                          return (
                            <tr key={b.longStayBookingId}>
                              <td className="text-muted">{i + 1 + page * PAGE_SIZE}</td>
                              <td>
                                <span className="fw-semibold text-dark">
                                  {b.bookingCode || "-"}
                                </span>
                              </td>
                              <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(b.bookingDateTime)}</td>
                              <td>{b.hotelName || "-"}</td>
                              {/* Guest — a booking can hold many guests. Show
                                  the first prominently; the rest sit behind a
                                  "+N more" badge that opens the Customers
                                  modal. Email stays as a sub-line. */}
                              <td>
                                {(() => {
                                  const names = getGuestNames(b);
                                  const first = names[0] || "-";
                                  const extra = Math.max(0, names.length - 1);
                                  return (
                                    <>
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
                                      <div
                                        className="text-muted"
                                        style={{ fontSize: "0.7rem" }}
                                      >
                                        {b.primaryGuestEmail || ""}
                                      </div>
                                    </>
                                  );
                                })()}
                              </td>
                              <td style={{ whiteSpace: "nowrap" }}>
                                <div>{formatDateTime(b.checkInDate)}</div>
                                <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                  → {formatDateTime(b.checkOutDate)}
                                </div>
                              </td>
                              <td className="text-center">{b.totalNights || "-"}</td>
                              <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                                <span className="fw-semibold text-dark">
                                  {b.displayCurrencyCode &&
                                  b.displayCurrencyCode !== "AED" &&
                                  Number(b.displayAmount) > 0
                                    ? `${b.displayCurrencyCode} ${Number(b.displayAmount).toFixed(2)}`
                                    : (b.totalAmount ?? "-")}
                                </span>
                              </td>
                              <td>
                                <StatusPill meta={sMeta} raw={b.bookingStatus} />
                              </td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  className="btn btn-sm d-inline-flex align-items-center gap-1"
                                  style={{
                                    backgroundColor: "#eff6ff",
                                    color: "#1d4ed8",
                                    borderRadius: "6px",
                                    fontSize: "0.72rem",
                                    fontWeight: 600,
                                    padding: "0.25rem 0.6rem",
                                  }}
                                  onClick={() =>
                                    navigate(
                                      `/booking-details/long-stay-booking/${b.longStayBookingId}`,
                                      { state: { booking: b } },
                                    )
                                  }
                                  title="View details"
                                >
                                  <FaEye style={{ fontSize: "12px" }} /> View
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
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

                {totalPages > 1 && (
                  <Pagination className="justify-content-center mt-3 mb-0">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <Pagination.Item
                        key={i}
                        active={i === page}
                        onClick={() => setPage(i)}
                      >
                        {i + 1}
                      </Pagination.Item>
                    ))}
                  </Pagination>
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
