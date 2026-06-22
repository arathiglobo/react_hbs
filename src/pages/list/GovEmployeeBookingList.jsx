/**
 * GovEmployeeBookingList.jsx
 *
 * Booking-list page for the government-employee flow. UI EXACTLY mirrors
 * StudentBookingList.jsx (which mirrors HotelBookingList.jsx):
 *   - Title + search (left) | Time Period card (right)
 *   - Booking Type card (full-width row)
 *   - Auto-layout, page-fitting table with columns:
 *       S.N · Agent Name · Customer Name · Booking Code · Reference Code ·
 *       Book Date · Booking Details · Deadline Date · Payment Mode ·
 *       Notification · Action
 *   - Card-style pagination footer
 *
 * Rows come from GET /api/gov-employee-booking/list. BookingType + Time-Period
 * filters are applied client-side over the fetched page.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Table,
  Spinner,
  Form,
  Row,
  Col,
  Container,
  InputGroup,
  Pagination,
  Badge,
  Modal,
} from "react-bootstrap";
import {
  FaEye,
  FaSearch,
  FaUser,
  FaUsers,
  FaExclamationCircle,
  FaInbox,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

// Column widths — soft hints for the auto-layout table (same as HotelBookingList).
const COLUMN_WIDTHS = {
  sn: "40px",
  agentName: "90px",
  customerName: "120px",
  bookingCode: "95px",
  referenceCode: "160px",
  bookDate: "90px",
  bookingDetails: "230px",
  deadlineDate: "105px",
  paymentMode: "110px",
  notification: "100px",
  action: "110px",
};

// BookingType dropdown options — mirrors HotelBookingList's status filter.
const TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "onrequest", label: "On Request" },
  { value: "reconfirmed", label: "Reconfirmed" },
];

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i);

// Payment-mode label — same mapping as HotelBookingList.jsx.
const getPaymentModeLabel = (booking) => {
  const raw =
    booking?.paymentMode || booking?.payment_mode || booking?.paymentType || "";
  const norm = String(raw).trim().toUpperCase();
  if (
    norm === "CREDIT" || norm === "CREDIT_LIMIT" ||
    norm === "CREDIT LIMIT" || norm === "CREDITLIMIT"
  ) {
    return "Credit Limit Payment";
  }
  if (norm === "ONLINE" || norm === "ONLINE_PAYMENT" || norm === "ONLINE PAYMENT") {
    return "Online Payment";
  }
  if (norm === "CASH") return "Cash";
  if (norm === "CARD") return "Card";
  if (norm === "BANK_TRANSFER" || norm === "BANK TRANSFER") return "Bank Transfer";
  if (norm === "CHEQUE") return "Cheque";
  if (norm) return raw;
  return "-";
};

const getGuestNames = (booking) => {
  if (Array.isArray(booking?.guestNames) && booking.guestNames.length > 0) {
    return booking.guestNames.filter((n) => String(n ?? "").trim());
  }
  return booking?.customerName ? [booking.customerName] : [];
};

// DD/MM/YYYY — matches HotelBookingList.formatDate.
const formatDate = (dateString) => {
  if (!dateString) return "";
  const normalized = String(dateString).includes("T")
    ? dateString
    : `${dateString}T00:00:00`;
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
};

const formatDeadlineDate = (dateString) => {
  if (!dateString) return "-";
  return String(dateString).split("T")[0] || "-";
};

export default function GovEmployeeBookingList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0); // 0-based
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [backendTotal, setBackendTotal] = useState(0);
  const [agentId, setAgentId] = useState("");
  const [search, setSearch] = useState("");

  // BookingType + time-period filters (client-side over the fetched page).
  const [bookingType, setBookingType] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  const [role, setRole] = useState(
    (localStorage.getItem("currentActiveRole") || "").toLowerCase()
  );

  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [customersModalBooking, setCustomersModalBooking] = useState(null);
  const handleShowCustomers = (booking) => {
    setCustomersModalBooking(booking);
    setShowCustomersModal(true);
  };

  useEffect(() => {
    const r = (localStorage.getItem("currentActiveRole") || "").toLowerCase();
    setRole(r);
    if (r === "agent") {
      const uid = localStorage.getItem("userId");
      if (uid && uid !== "null") setAgentId(uid);
    }
  }, []);

  const fetchPage = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, size });
      if (agentId) params.append("agentId", agentId);
      const { data } = await axiosInstance.get(
        `/api/gov-employee-booking/list?${params.toString()}`
      );
      setRows(data?.content || []);
      setTotalPages(data?.totalPages || 0);
      setBackendTotal(data?.totalElements || 0);
    } catch (e) {
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchPage(); /* eslint-disable-next-line */
  }, [page, size, agentId]);

  // Composite status — a booking that was Confirmed and is later Cancelled
  // shows "Confirmed / Cancelled".
  const compositeStatus = (b) => {
    const raw = String(b?.confirmationStatus || "").trim();
    const normalized = raw.replace(/\s+/g, "").toLowerCase();
    if (b?.cancelled) {
      if (normalized === "confirmed" || normalized === "reconfirmed") {
        return { label: `${raw} / Cancelled`, kind: "cancelled" };
      }
      return { label: "Cancelled", kind: "cancelled" };
    }
    if (normalized === "confirmed") return { label: "Confirmed", kind: "confirmed" };
    if (normalized === "reconfirmed") return { label: "ReConfirmed", kind: "confirmed" };
    if (normalized === "notconfirmed") return { label: "Not Confirmed", kind: "notconfirmed" };
    return { label: raw || "-", kind: "other" };
  };

  const filtered = useMemo(() => {
    let list = Array.isArray(rows) ? [...rows] : [];

    if (bookingType !== "all") {
      const now = new Date();
      list = list.filter((b) => {
        const normalized = String(b.confirmationStatus || "")
          .replace(/\s+/g, "")
          .toLowerCase();
        const checkout = b.checkOutDate ? new Date(b.checkOutDate) : null;
        switch (bookingType) {
          case "cancelled":
            return !!b.cancelled;
          case "upcoming":
            return !b.cancelled && checkout && checkout >= now;
          case "completed":
            return !b.cancelled && checkout && checkout < now;
          case "onrequest":
            return !b.cancelled && normalized === "notconfirmed";
          case "reconfirmed":
            return (
              !b.cancelled &&
              (normalized === "confirmed" || normalized === "reconfirmed")
            );
          default:
            return true;
        }
      });
    }

    if (selectedMonth || selectedYear) {
      list = list.filter((b) => {
        if (!b.bookingDate) return false;
        const d = new Date(b.bookingDate);
        if (isNaN(d.getTime())) return false;
        if (selectedMonth && d.getMonth() + 1 !== Number(selectedMonth)) return false;
        if (selectedYear && d.getFullYear() !== Number(selectedYear)) return false;
        return true;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.bookingCode || "").toLowerCase().includes(q) ||
          (r.referenceNumber || "").toLowerCase().includes(q) ||
          (r.customerName || "").toLowerCase().includes(q) ||
          getGuestNames(r).some((n) => n.toLowerCase().includes(q)) ||
          (r.hotelName || "").toLowerCase().includes(q) ||
          (r.agentName || "").toLowerCase().includes(q) ||
          (r.govEmployeeName || "").toLowerCase().includes(q) ||
          (r.govEmployeeCode || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [rows, bookingType, selectedMonth, selectedYear, search]);

  const clientFilterActive =
    bookingType !== "all" || !!selectedMonth || !!selectedYear || !!search.trim();
  const currentPage = page + 1; // 1-based for display
  const safeTotalPages = Math.max(1, totalPages || 1);
  const totalEntries = clientFilterActive
    ? filtered.length
    : backendTotal || filtered.length;
  const displayStart = filtered.length === 0 ? 0 : page * size + 1;
  const displayEnd = clientFilterActive
    ? filtered.length
    : page * size + filtered.length;

  const handlePageChange = (oneBased) => setPage(Math.max(0, oneBased - 1));
  const handlePageSizeChange = (n) => {
    setSize(n);
    setPage(0);
  };

  const colSpan = role === "admin" ? 11 : 10;

  // Notification cell renderer — reuses HotelBookingList's colour language.
  const renderNotification = (b) => {
    const status = compositeStatus(b);
    if (status.kind === "confirmed") {
      return (
        <span style={{ color: "#06a301", fontSize: "0.82rem", fontWeight: 600 }}>
          {status.label}
        </span>
      );
    }
    if (status.kind === "cancelled") {
      return (
        <span style={{ color: "#b42318", fontSize: "0.8rem", fontWeight: 600 }}>
          {status.label}
        </span>
      );
    }
    if (status.kind === "notconfirmed") {
      return (
        <span
          className="d-inline-flex align-items-center gap-1"
          style={{ color: "#dc3545", fontSize: "0.78rem", fontWeight: 600 }}
        >
          {status.label}
          <FaExclamationCircle style={{ color: "#ff9800", fontSize: "15px" }} />
        </span>
      );
    }
    return (
      <span className="text-muted" style={{ fontSize: "0.8rem" }}>
        {status.label}
      </span>
    );
  };

  const thStyle = (w, center) => ({
    padding: "0.45rem 0.6rem",
    fontWeight: "600",
    textTransform: "uppercase",
    color: "#495057",
    textAlign: center ? "center" : undefined,
    border: "1px solid #dee2e6",
    whiteSpace: "normal",
    lineHeight: 1.2,
    width: w,
  });
  const baseCellStyle = {
    padding: "0.5rem 0.6rem",
    fontSize: "0.8rem",
    border: "1px solid #dee2e6",
    verticalAlign: "middle",
    whiteSpace: "normal",
    overflow: "visible",
    wordBreak: "break-word",
    lineHeight: 1.4,
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-3" style={{ width: "100%", overflow: "hidden" }}>
          <Container fluid className="px-0">
            {/* Header: Title + Search (left) | Time Period (right) */}
            <div className="d-flex justify-content-between align-items-end mb-3">
              <div>
                <h3 className="fw-bold text-dark mb-2">Government Employee Bookings</h3>
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
                    placeholder="Search here..."
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
                        onChange={(e) => {
                          setSelectedMonth(e.target.value);
                          setPage(0);
                        }}
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
                        onChange={(e) => {
                          setSelectedYear(e.target.value);
                          setPage(0);
                        }}
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

            {/* Booking Type filter */}
            <Row className="mb-2 g-1">
              <Col xs={12}>
                <Card className="shadow-sm border-0 w-100" style={{ borderRadius: "8px" }}>
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
                          onChange={(e) => {
                            setBookingType(e.target.value);
                            setPage(0);
                          }}
                          size="sm"
                          aria-label="Booking type filter"
                          style={{ fontSize: "0.85rem", height: "46px" }}
                        >
                          {TYPE_OPTIONS.map((opt) => (
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

            {/* Table */}
            <Card
              className="shadow-sm border-0"
              style={{ borderRadius: "8px", overflow: "hidden", width: "100%" }}
            >
              <Card.Body className="p-0" style={{ width: "100%" }}>
                {loading ? (
                  <div className="text-center p-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">Loading bookings...</p>
                  </div>
                ) : (
                  <div className="thin-scrollbar" style={{ overflowX: "auto", width: "100%" }}>
                    <Table
                      hover
                      size="sm"
                      className="mb-0 align-middle table-bordered"
                      style={{
                        tableLayout: "auto",
                        width: "100%",
                        fontSize: "0.78rem",
                        borderCollapse: "separate",
                        borderSpacing: 0,
                        wordBreak: "break-word",
                      }}
                    >
                      <thead
                        style={{
                          backgroundColor: "#f8f9fa",
                          borderBottom: "2px solid #dee2e6",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                          fontSize: "0.7rem",
                          letterSpacing: "0.03em",
                        }}
                      >
                        <tr>
                          <th style={thStyle(COLUMN_WIDTHS.sn, true)}>S.N</th>
                          {role === "admin" && (
                            <th style={thStyle(COLUMN_WIDTHS.agentName)}>Agent Name</th>
                          )}
                          <th style={thStyle(COLUMN_WIDTHS.customerName)}>Customer Name</th>
                          <th style={thStyle(COLUMN_WIDTHS.bookingCode)}>Booking Code</th>
                          <th style={thStyle(COLUMN_WIDTHS.referenceCode)}>Reference Code</th>
                          <th style={thStyle(COLUMN_WIDTHS.bookDate, true)}>Book Date</th>
                          <th style={thStyle(COLUMN_WIDTHS.bookingDetails)}>Booking Details</th>
                          <th style={thStyle(COLUMN_WIDTHS.deadlineDate, true)}>Deadline Date</th>
                          <th style={thStyle(COLUMN_WIDTHS.paymentMode, true)}>Payment Mode</th>
                          <th style={thStyle(COLUMN_WIDTHS.notification, true)}>Notification</th>
                          <th style={thStyle(COLUMN_WIDTHS.action, true)}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr>
                            <td
                              colSpan={colSpan}
                              className="text-center py-5 text-muted"
                              style={{ border: "1px solid #dee2e6", backgroundColor: "#ffffff" }}
                            >
                              <FaInbox
                                style={{ fontSize: "2.5rem", marginBottom: "10px", color: "#adb5bd" }}
                              />
                              <p className="mt-2 mb-0 fs-5">No bookings found.</p>
                            </td>
                          </tr>
                        ) : (
                          filtered.map((b, i) => {
                            const names = getGuestNames(b);
                            const first = names[0] || "-";
                            const extra = Math.max(0, names.length - 1);
                            const payLabel = getPaymentModeLabel(b);
                            return (
                              <tr
                                key={b.bookingId}
                                style={{
                                  backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8f9fa",
                                  transition: "background-color 0.2s ease",
                                }}
                              >
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    color: "#6c757d",
                                    width: COLUMN_WIDTHS.sn,
                                  }}
                                >
                                  {page * size + i + 1}
                                </td>
                                {role === "admin" && (
                                  <td style={{ ...baseCellStyle, width: COLUMN_WIDTHS.agentName }}>
                                    <span className="fw-medium text-dark">
                                      {b.agentName || b.agentId || "-"}
                                    </span>
                                  </td>
                                )}
                                <td style={{ ...baseCellStyle, width: COLUMN_WIDTHS.customerName }}>
                                  <div
                                    className="d-flex align-items-center"
                                    style={{ gap: "0.4rem", flexWrap: "wrap" }}
                                  >
                                    <span
                                      className="d-inline-flex align-items-center"
                                      style={{ gap: "0.3rem" }}
                                    >
                                      <FaUser
                                        style={{ color: "#6c757d", fontSize: "0.78rem", flexShrink: 0 }}
                                      />
                                      <span className="fw-medium text-dark">{first}</span>
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
                                          fontSize: "0.7rem",
                                        }}
                                      >
                                        +{extra} more
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td style={{ ...baseCellStyle, width: COLUMN_WIDTHS.bookingCode }}>
                                  <span className="fw-bold text-primary">
                                    {b.bookingCode || "-"}
                                  </span>
                                </td>
                                <td style={{ ...baseCellStyle, width: COLUMN_WIDTHS.referenceCode }}>
                                  <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                                    {b.referenceNumber || "-"}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    color: "#6c757d",
                                    width: COLUMN_WIDTHS.bookDate,
                                  }}
                                >
                                  {formatDate(b.bookingDate) || "-"}
                                </td>
                                <td style={{ ...baseCellStyle, width: COLUMN_WIDTHS.bookingDetails }}>
                                  <div
                                    className="d-flex align-items-center"
                                    style={{ gap: "0.35rem", flexWrap: "wrap" }}
                                  >
                                    <span className="fw-semibold text-dark" style={{ fontSize: "0.875rem" }}>
                                      {b.hotelName || "-"}
                                    </span>
                                    {formatDate(b.checkInDate) && formatDate(b.checkOutDate) && (
                                      <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                        ({formatDate(b.checkInDate)} - {formatDate(b.checkOutDate)})
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    fontFamily: "monospace",
                                    color: "#6c757d",
                                    width: COLUMN_WIDTHS.deadlineDate,
                                  }}
                                >
                                  {formatDeadlineDate(b.deadlineDate)}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.paymentMode,
                                  }}
                                >
                                  {payLabel === "-" ? (
                                    <span className="text-muted">-</span>
                                  ) : (
                                    <span style={{ color: "#000" }}>{payLabel}</span>
                                  )}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.notification,
                                  }}
                                >
                                  {renderNotification(b)}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.action,
                                  }}
                                >
                                  <div className="d-flex justify-content-center align-items-center">
                                    <FaEye
                                      role="button"
                                      tabIndex={0}
                                      title="View full booking details"
                                      style={{ fontSize: "18px", color: "#007bff", cursor: "pointer" }}
                                      onClick={() =>
                                        navigate(`/booking-details/gov-employee-booking/${b.bookingId}`)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          navigate(`/booking-details/gov-employee-booking/${b.bookingId}`);
                                        }
                                      }}
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Pagination */}
            {!loading && filtered.length > 0 && (
              <Card className="shadow-sm border-0 mt-3" style={{ borderRadius: "8px" }}>
                <Card.Body className="py-3">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div className="text-muted" style={{ fontSize: "0.875rem" }}>
                      Showing <span className="fw-semibold text-dark">{displayStart}</span> to{" "}
                      <span className="fw-semibold text-dark">{displayEnd}</span> of{" "}
                      <span className="fw-semibold text-dark">{totalEntries}</span> entries
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted" style={{ fontSize: "0.8rem" }}>
                        Rows per page
                      </span>
                      <Form.Select
                        size="sm"
                        value={size}
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                        style={{ width: "auto", fontSize: "0.8rem" }}
                      >
                        {PER_PAGE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                    {totalPages > 1 && (
                      <Pagination className="mb-0">
                        <Pagination.Prev
                          disabled={currentPage === 1}
                          onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                          style={{
                            cursor: currentPage === 1 ? "not-allowed" : "pointer",
                            opacity: currentPage === 1 ? 0.5 : 1,
                          }}
                        />
                        {Array.from({ length: safeTotalPages }, (_, i) => i + 1).map((pageNumber) => (
                          <Pagination.Item
                            key={pageNumber}
                            active={currentPage === pageNumber}
                            onClick={() => handlePageChange(pageNumber)}
                            style={{ cursor: "pointer", minWidth: "38px", textAlign: "center" }}
                          >
                            {pageNumber}
                          </Pagination.Item>
                        ))}
                        <Pagination.Next
                          disabled={currentPage === safeTotalPages}
                          onClick={() =>
                            currentPage < safeTotalPages && handlePageChange(currentPage + 1)
                          }
                          style={{
                            cursor: currentPage === safeTotalPages ? "not-allowed" : "pointer",
                            opacity: currentPage === safeTotalPages ? 0.5 : 1,
                          }}
                        />
                      </Pagination>
                    )}
                  </div>
                </Card.Body>
              </Card>
            )}

            {/* Customers Modal — full guest list for a single booking */}
            <Modal
              show={showCustomersModal}
              onHide={() => setShowCustomersModal(false)}
              centered
              size="sm"
            >
              <Modal.Header closeButton style={{ borderBottom: "2px solid #e9ecef" }}>
                <Modal.Title className="fw-bold d-flex align-items-center" style={{ fontSize: "1rem" }}>
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
          </Container>
        </main>
      </div>
    </div>
  );
}
