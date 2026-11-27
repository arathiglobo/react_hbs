/**
 * OfflineBookingList.jsx
 *
 * Booking-list page for offline bookings, reskinned to match the shared
 * `hbl-modern` look used by HotelBookingList / LongStayBookingList. The
 * Action column contains only the View (eye) icon — clicking it navigates
 * to a dedicated detail page (/booking-details/offline-booking/:id) where
 * Voucher / Invoice / Tax live as buttons at the bottom-left.
 *
 * Filters mirror Hotel Booking List:
 *   - "Booking Type" card with 7 options (All / Upcoming / Completed /
 *     Cancelled / On Request / Reconfirmed / Invoiced). The first four map
 *     to the backend `status` query param; the remaining three are applied
 *     client-side on top of the same fetch — they light up automatically
 *     once the backend starts emitting the corresponding fields.
 *   - Time Period (Month + Year) card → backend `month` / `year`.
 *   - Search (left, 300px) — passed to the backend as `search`.
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Container,
  Card,
  Form,
  Table,
  InputGroup,
  Spinner,
  Pagination,
  Row,
  Col,
  Button,
} from "react-bootstrap";
import { FaSearch, FaEye, FaInbox, FaArrowLeft, FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";
import RoomCountSummary from "../../components/RoomCountSummary";
import { getCurrentActiveRole, getUserRole } from "../../utils/authSession";
import "../../styles/HotelBookingListModern.css";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Columns of the hotel booking list (HotelBookingList.jsx), same order and
// width hints, so the two pages read alike under the shared hbl-modern skin.
const COLUMN_WIDTHS = {
  sn: "40px",
  agentName: "90px",
  customerName: "120px",
  bookingCode: "95px",
  confirmationNo: "130px",
  bookDate: "90px",
  bookingDetails: "210px",
  noOfRooms: "120px",
  deadlineDate: "105px",
  paymentMode: "110px",
  paymentStatus: "115px",
  notification: "120px",
  action: "110px",
};

// Reads the leading "yyyy-MM-dd" as a LOCAL calendar date. `new Date("2026-11-20")`
// would be UTC midnight, which shows as 19 Nov in any timezone west of UTC.
const parseLocalDate = (value) => {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return isNaN(d) ? null : d;
};

// "20/11/2026" — the hotel list's date format; "" when there is no date.
const fmtDate = (value) => {
  const d = parseLocalDate(value);
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
};

// Deadline Date: "2026-11-26 17:39" (UAE time). An offline deadline is exact
// to the minute, so its time is kept next to the hotel list's ISO date.
const fmtDeadline = (value) => {
  if (!value) return "-";
  const s = String(value).replace("T", " ");
  return s.length >= 16 ? s.slice(0, 16) : s.slice(0, 10);
};

// Payment Mode — offline bookings are paid from the agent's credit limit
// (debited when our team confirms them). Bookings made before that rule
// (no cancellation deadline) never used it.
const offlinePaymentMode = (b) => (b?.cancellationDeadline ? "Credit Limit Payment" : "-");

// Payment Status — the hotel list's labels, from what the agent's credit
// paid: On Request → Payment Pending (debited when confirmed); confirmed and
// debited → Paid; cancelled → Paid when the debit was kept (after the
// deadline), Refunded when it went back (before the deadline), Un-Paid when
// it was never debited. A confirmed booking from before the rule took no
// credit and shows "-".
const offlinePaymentStatus = (b, statusKey) => {
  const debited = Number(b?.agentCreditDebited) > 0;
  const refunded = Number(b?.agentCreditRefunded) > 0;
  if (statusKey === "ON_REQUEST") return "Payment Pending";
  if (statusKey === "CANCELLED") {
    if (!debited) return "Un-Paid";
    return refunded ? "Refunded" : "Paid";
  }
  return debited ? "Paid" : "-";
};

const PAYMENT_STATUS_COLOR = {
  Paid: "#06a301",
  "Un-Paid": "#dc3545",
  "Payment Pending": "#e67e22",
  Refunded: "#6c757d",
};

// Status column — the same words and look as the hotel Booking List's status
// column (HotelBookingList.jsx): plain coloured text, no pill.
//   On Request → orange · Confirmed → green · Cancelled → red · other → grey
// A past booking still reads "Confirmed", as on the hotel list (the Completed
// filter is where past bookings are picked out).
const STATUS_TEXT_STYLE = {
  padding: "0.32rem 0.6rem",
  fontSize: "0.82rem",
  fontWeight: "600",
  borderRadius: "0.375rem",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
};

// Each "/"-separated part coloured on its own, as on the hotel list.
const statusSegColor = (part) => {
  const p = (part || "").trim().replace(/\s+/g, "").toLowerCase();
  if (p.startsWith("reconfirmed")) return "#06a301";
  if (p.startsWith("confirmed")) return "#06a301";
  if (p.startsWith("cancelled")) return "#dc3545";
  if (p === "onrequest") return "#ff9800";
  return "#6c757d";
};

const renderColoredStatus = (text) =>
  String(text ?? "-")
    .split("/")
    .map((part, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span style={{ color: "#6c757d" }}>/</span>}
        <span style={{ color: statusSegColor(part) }}>{part}</span>
      </React.Fragment>
    ));

const StatusText = ({ statusKey, raw }) => {
  if (statusKey === "ON_REQUEST") {
    return <span style={{ ...STATUS_TEXT_STYLE, color: "#e67e22" }}>On Request</span>;
  }
  if (statusKey === "CONFIRMED" || statusKey === "COMPLETED") {
    return <span style={{ ...STATUS_TEXT_STYLE, color: "#06a301" }}>Confirmed</span>;
  }
  // Cancelled and anything else: the hotel list's smaller per-part colouring.
  const label = statusKey === "CANCELLED" ? "Cancelled" : raw || "-";
  return (
    <div
      className="d-inline-flex align-items-center justify-content-center gap-2"
      style={{
        padding: "0.32rem 0.6rem",
        borderRadius: "0.375rem",
        backgroundColor: "transparent",
        color: "#6c757d",
        fontSize: "0.72rem",
        fontWeight: "600",
      }}
    >
      {renderColoredStatus(label)}
    </div>
  );
};

const normStatus = (v) =>
  String(v ?? "").replace(/[\s_-]+/g, "").toLowerCase();

// Derive the status key for the Status column. The list API sends `bookingStatus`
// (Confirmed / Completed / Cancelled — the same rule as the All Bookings
// list); the check-out fallback only covers an older backend.
const deriveStatusKey = (b) => {
  const raw = normStatus(b?.bookingStatus || b?.status);
  if (raw === "cancelled" || b?.cancelStatus === true) return "CANCELLED";
  if (raw === "confirmed") return "CONFIRMED";
  if (raw === "completed") return "COMPLETED";
  if (b?.statusCode === "ON_REQUEST" || raw === "onrequest") return "ON_REQUEST";
  if (raw === "pending") return "PENDING";
  const co = parseLocalDate(b?.checkOut);
  if (co) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return co < today ? "COMPLETED" : "CONFIRMED";
  }
  return null;
};

const OfflineBookingList = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  // Active role from this tab's session, like the All Bookings list. It used
  // to be overridden by a "currentActiveRole" left in localStorage by older
  // builds, which hid the Agent column from admins.
  const [role] = useState(() => {
    const active = getCurrentActiveRole().toLowerCase();
    if (active) return active;
    const userRoles = getUserRole().toLowerCase().split(",").map((r) => r.trim());
    if (userRoles.includes("agent")) return "agent";
    if (userRoles.includes("staff")) return "staff";
    if (userRoles.includes("admin")) return "admin";
    return userRoles[0] || null;
  });
  const isAdmin = role === "admin" || role === "super_admin";
  const [userId, setUserId] = useState(() => {
    const stored = sessionStorage.getItem("userId");
    return stored && stored !== "null" ? stored : null;
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Default landing tab is "all" to mirror Hotel Booking List.
  const [bookingType, setBookingType] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 2014 }, (_, i) => 2020 + i);
  }, []);

  // Same seven booking-type options Hotel Booking List ships with.
  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "upcoming", label: "Upcoming" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
      { value: "onrequest", label: "On Request" },
      { value: "reconfirmed", label: "Reconfirmed" },
      { value: "invoiced", label: "Invoiced" },
    ],
    [],
  );

  // Fetch userId if missing
  useEffect(() => {
    const fetchUserId = async () => {
      if (userId && userId !== "null") return;
      const userName =
        sessionStorage.getItem("UserName");
      if (!userName) return;
      try {
        const response = await axiosInstance.get(
          `/api/personalProfile/${userName}`,
        );
        if (response.data && response.data.id) {
          const id = String(response.data.id);
          setUserId(id);
          sessionStorage.setItem("userId", id);
        }
      } catch (error) {
        console.error("Error fetching user profile for ID:", error);
      }
    };
    if (role === "agent" || role === "staff") {
      fetchUserId();
    }
  }, [role, userId]);

  const fetchBookings = useCallback(async () => {
    if (!role) return;
    if (
      (role === "agent" || role === "staff") &&
      (!userId || userId === "null")
    )
      return;

    try {
      setLoading(true);
      // Statuses the backend filters (and pages) itself; the remaining two
      // are filtered client-side from a status-less response.
      const serverStatuses = {
        upcoming: "UPCOMING",
        completed: "COMPLETED",
        cancelled: "CANCELLED",
        onrequest: "ON_REQUEST",
      };
      const params = {
        page: page - 1,
        limit: perPage,
        search: search.trim() || undefined,
        status: serverStatuses[bookingType],
        month: selectedMonth || undefined,
        year: selectedYear || undefined,
      };

      if (role === "agent" && userId) {
        params.agentId = userId;
      } else if (role === "staff" && userId) {
        params.agentId = userId;
      }

      const response = await axiosInstance.get(
        "/api/v1/offline-booking/all-list",
        { params },
      );

      if (response.data) {
        const data = response.data.content || response.data;
        setBookings(Array.isArray(data) ? data : []);
        setTotalElements(
          response.data.totalElements || (data.length || 0),
        );
        setTotalPages(
          response.data.totalPages ||
            Math.ceil((data.length || 0) / perPage),
        );
      }
    } catch (error) {
      console.error("Error fetching offline bookings:", error);
      toast.error("Failed to load offline bookings");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    perPage,
    search,
    role,
    userId,
    bookingType,
    selectedMonth,
    selectedYear,
  ]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Client-side narrowing for the three filter values the backend doesn't
  // yet understand. Returns the server list unchanged for "all" and for
  // the three statuses the backend already handled.
  const visibleBookings = useMemo(() => {
    if (
      bookingType === "all" ||
      bookingType === "upcoming" ||
      bookingType === "completed" ||
      bookingType === "cancelled" ||
      bookingType === "onrequest"
    ) {
      return bookings;
    }
    return (bookings || []).filter((b) => {
      const isCancelled =
        normStatus(b?.bookingStatus) === "cancelled" ||
        b?.cancelStatus === true;
      if (isCancelled) return false;
      if (bookingType === "onrequest") {
        const s = normStatus(b?.bookingStatus || b?.confirmationStatus);
        return s === "pending" || s === "onrequest";
      }
      if (bookingType === "reconfirmed") {
        return normStatus(b?.confirmationStatus) === "reconfirmed";
      }
      if (bookingType === "invoiced") {
        return (
          normStatus(b?.invoiceStatus) === "invoiced" ||
          b?.invoiced === true ||
          b?.isInvoiced === true
        );
      }
      return false;
    });
  }, [bookings, bookingType]);

  const handlePageChange = (newPage) => setPage(newPage);

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

  const baseHeaderStyle = {
    padding: "0.45rem 0.6rem",
    fontWeight: 600,
    textTransform: "uppercase",
    color: "#495057",
    border: "1px solid #dee2e6",
    whiteSpace: "normal",
    lineHeight: 1.2,
  };

  const colCount = isAdmin ? 13 : 12;
  const safeTotalPages = Math.max(1, totalPages || 1);
  const hasResults = visibleBookings.length > 0;
  const displayStart = hasResults ? (page - 1) * perPage + 1 : 0;
  const displayEnd = hasResults
    ? Math.min((page - 1) * perPage + visibleBookings.length, totalElements)
    : 0;

  return (
    <div className="min-vh-100 bg-light d-flex flex-column hbl-modern">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main
          className="flex-grow-1 p-3"
          style={{ width: "100%", overflow: "hidden" }}
        >
          <Container fluid className="px-0">
            {/* Back to Admin Dashboard — top-left, above the header row */}
            <div className="mb-3">
              <Button
                variant="outline-secondary"
                onClick={() => navigate("/adminDashboard")}
                className="d-inline-flex align-items-center gap-2 rounded-pill px-3 py-2"
              >
                <FaArrowLeft />
                Back
              </Button>
            </div>

            {/* Header: Title + Search (left) | Time Period (right) */}
            <div className="d-flex justify-content-between align-items-end mb-3 hbl-header">
              <div className="hbl-header-left">
                <h3 className="fw-bold text-dark mb-2">Offline Bookings</h3>
                <InputGroup className="hbl-search" style={{ height: "40px", width: "300px" }}>
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
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
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
                className="shadow-sm border-0 hbl-timecard"
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
                          setPage(1);
                        }}
                        className="form-control"
                        size="sm"
                        style={{ fontSize: "0.82rem", height: "45px" }}
                      >
                        <option value="">Month</option>
                        {MONTHS.map((month, index) => (
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
                          setPage(1);
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

            {/* Filters Section */}
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
                          onChange={(e) => {
                            setBookingType(e.target.value);
                            setPage(1);
                          }}
                          size="sm"
                          aria-label="Booking type filter"
                          style={{ fontSize: "0.85rem", height: "46px" }}
                        >
                          {statusOptions.map((opt) => (
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
              style={{
                borderRadius: "8px",
                overflow: "hidden",
                width: "100%",
              }}
            >
              <Card.Body className="p-0" style={{ width: "100%" }}>
                {loading ? (
                  <div className="text-center p-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">Loading bookings...</p>
                  </div>
                ) : (
                  <div
                    className="thin-scrollbar"
                    style={{ overflowX: "auto", width: "100%" }}
                  >
                    <Table
                      hover
                      size="sm"
                      className="mb-0 align-middle table-bordered hbl-table"
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
                        {/* The hotel booking list's columns, in its order. */}
                        <tr>
                          <th style={{ ...baseHeaderStyle, textAlign: "center", width: COLUMN_WIDTHS.sn }}>
                            S.N
                          </th>
                          {isAdmin && (
                            <th style={{ ...baseHeaderStyle, width: COLUMN_WIDTHS.agentName }}>
                              Agent Name
                            </th>
                          )}
                          <th style={{ ...baseHeaderStyle, width: COLUMN_WIDTHS.customerName }}>
                            Customer Name
                          </th>
                          <th style={{ ...baseHeaderStyle, width: COLUMN_WIDTHS.bookingCode }}>
                            Booking Code
                          </th>
                          <th style={{ ...baseHeaderStyle, width: COLUMN_WIDTHS.confirmationNo }}>
                            Confirmation No
                          </th>
                          <th style={{ ...baseHeaderStyle, textAlign: "center", width: COLUMN_WIDTHS.bookDate }}>
                            Book Date
                          </th>
                          <th style={{ ...baseHeaderStyle, width: COLUMN_WIDTHS.bookingDetails }}>
                            Booking Details
                          </th>
                          <th style={{ ...baseHeaderStyle, textAlign: "center", width: COLUMN_WIDTHS.noOfRooms }}>
                            No. of Rooms
                          </th>
                          <th style={{ ...baseHeaderStyle, textAlign: "center", width: COLUMN_WIDTHS.deadlineDate }}>
                            Deadline Date
                          </th>
                          <th style={{ ...baseHeaderStyle, textAlign: "center", width: COLUMN_WIDTHS.paymentMode }}>
                            Payment Mode
                          </th>
                          <th style={{ ...baseHeaderStyle, textAlign: "center", width: COLUMN_WIDTHS.paymentStatus }}>
                            Payment Status
                          </th>
                          <th style={{ ...baseHeaderStyle, textAlign: "center", width: COLUMN_WIDTHS.notification }}>
                            Notification
                          </th>
                          <th style={{ ...baseHeaderStyle, textAlign: "center", width: COLUMN_WIDTHS.action }}>
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleBookings.length === 0 ? (
                          <tr>
                            <td
                              colSpan={colCount}
                              className="text-center py-5 text-muted"
                              style={{
                                border: "1px solid #dee2e6",
                                backgroundColor: "#ffffff",
                              }}
                            >
                              <FaInbox
                                style={{
                                  fontSize: "2.5rem",
                                  marginBottom: "10px",
                                  color: "#adb5bd",
                                }}
                              />
                              <p className="mt-2 mb-0 fs-5">
                                No bookings found.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          visibleBookings.map((booking, idx) => {
                            const statusKey = deriveStatusKey(booking);
                            const paymentMode = offlinePaymentMode(booking);
                            const paymentStatus = offlinePaymentStatus(booking, statusKey);
                            const stayFrom = fmtDate(booking.checkIn);
                            const stayTo = fmtDate(booking.checkOut);
                            const serviceFrom = fmtDate(booking.serviceFrom);
                            const serviceTo = fmtDate(booking.serviceTo);
                            const openDetails = () =>
                              navigate(`/booking-details/offline-booking/${booking.supplierMainBasicId}`, {
                                state: { booking },
                              });
                            return (
                              <tr
                                key={booking.supplierMainBasicId || booking.id || idx}
                                style={{
                                  backgroundColor:
                                    idx % 2 === 0 ? "#ffffff" : "#f8f9fa",
                                  transition: "background-color 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    "#e7f3ff";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    idx % 2 === 0 ? "#ffffff" : "#f8f9fa";
                                }}
                              >
                                <td
                                  className="text-muted fw-semibold"
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    color: "#6c757d",
                                    width: COLUMN_WIDTHS.sn,
                                  }}
                                >
                                  {(page - 1) * perPage + idx + 1}
                                </td>
                                {isAdmin && (
                                  <td style={{ ...baseCellStyle, width: COLUMN_WIDTHS.agentName }}>
                                    <span className="fw-medium text-dark">
                                      {booking.agentName || "-"}
                                    </span>
                                  </td>
                                )}
                                {/* Customer Name — the booking's passenger. */}
                                <td style={{ ...baseCellStyle, width: COLUMN_WIDTHS.customerName }}>
                                  <span className="d-inline-flex align-items-center" style={{ gap: "0.3rem" }}>
                                    <FaUser style={{ color: "#6c757d", fontSize: "0.78rem", flexShrink: 0 }} />
                                    <span className="fw-medium text-dark">
                                      {booking.customerName || "-"}
                                    </span>
                                  </span>
                                </td>
                                {/* Booking Code — the offline booking's invoice number. */}
                                <td style={{ ...baseCellStyle, width: COLUMN_WIDTHS.bookingCode }}>
                                  <span className="fw-bold text-primary">
                                    {booking.invoiceNumber || "-"}
                                  </span>
                                </td>
                                {/* Confirmation No — the hotel's own number, saved
                                    with the CONFIRMATION NO. button; blank until then. */}
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    width: COLUMN_WIDTHS.confirmationNo,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {booking.hotelConfirmationNo ? (
                                    <span className="fw-semibold text-dark" style={{ fontSize: "0.85rem" }}>
                                      {booking.hotelConfirmationNo}
                                    </span>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                                <td
                                  className="text-muted"
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.bookDate,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {fmtDate(booking.bookingDate || booking.createdAt) || "-"}
                                </td>
                                {/* Booking Details — the hotel(s) and stay dates, as
                                    on the hotel list; a booking without a hotel shows
                                    its services and their dates instead. */}
                                <td style={{ ...baseCellStyle, width: COLUMN_WIDTHS.bookingDetails }}>
                                  <div className="d-flex align-items-center" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                                    <span className="fw-semibold text-dark" style={{ fontSize: "0.875rem" }}>
                                      {booking.hotelName || booking.services || "-"}
                                    </span>
                                    {booking.hotelName
                                      ? stayFrom &&
                                        stayTo && (
                                          <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                            ({stayFrom} - {stayTo})
                                          </span>
                                        )
                                      : serviceFrom && (
                                          <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                            ({serviceFrom}
                                            {serviceTo && serviceTo !== serviceFrom ? ` - ${serviceTo}` : ""})
                                          </span>
                                        )}
                                  </div>
                                  {booking.hotelName && booking.services && (
                                    <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                                      + {booking.services}
                                    </div>
                                  )}
                                </td>
                                {/* No. of Rooms — summed across the booking's
                                    hotel lines (totalRooms / roomSummary). */}
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.noOfRooms,
                                  }}
                                >
                                  <RoomCountSummary
                                    total={booking.totalRooms}
                                    lines={booking.roomSummary}
                                  />
                                </td>
                                {/* Deadline Date — the cancellation deadline (UAE time). */}
                                <td
                                  className="text-muted"
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    fontFamily: "monospace",
                                    width: COLUMN_WIDTHS.deadlineDate,
                                    whiteSpace: "nowrap",
                                  }}
                                  title={booking.cancellationDeadline ? "UAE time" : undefined}
                                >
                                  {fmtDeadline(booking.cancellationDeadline)}
                                </td>
                                {/* Payment Mode — plain black text, as on the hotel list. */}
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.paymentMode,
                                  }}
                                >
                                  {paymentMode === "-" ? (
                                    <span className="text-muted">-</span>
                                  ) : (
                                    <span style={{ color: "#000" }}>{paymentMode}</span>
                                  )}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.paymentStatus,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {paymentStatus === "-" ? (
                                    <span className="text-muted">-</span>
                                  ) : (
                                    <span
                                      style={{
                                        color: PAYMENT_STATUS_COLOR[paymentStatus] || "#6c757d",
                                        fontSize: "0.82rem",
                                        fontWeight: "600",
                                      }}
                                    >
                                      {paymentStatus}
                                    </span>
                                  )}
                                </td>
                                {/* Notification — the booking's status, in the
                                    hotel list's words and colours. */}
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.notification,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <StatusText
                                    statusKey={statusKey}
                                    raw={booking.bookingStatus}
                                  />
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
                                      style={{
                                        fontSize: "18px",
                                        color: "#007bff",
                                        cursor: "pointer",
                                      }}
                                      onClick={openDetails}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          openDetails();
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
            {!loading && hasResults && (
              <Card
                className="shadow-sm border-0 mt-3"
                style={{ borderRadius: "8px" }}
              >
                <Card.Body className="py-3">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 hbl-pagination-bar">
                    <div
                      className="text-muted"
                      style={{ fontSize: "0.875rem" }}
                    >
                      Showing{" "}
                      <span className="fw-semibold text-dark">
                        {displayStart}
                      </span>{" "}
                      to{" "}
                      <span className="fw-semibold text-dark">
                        {displayEnd}
                      </span>{" "}
                      of{" "}
                      <span className="fw-semibold text-dark">
                        {totalElements}
                      </span>{" "}
                      entries
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span
                        className="text-muted"
                        style={{ fontSize: "0.8rem" }}
                      >
                        Rows per page
                      </span>
                      <Form.Select
                        size="sm"
                        value={perPage}
                        onChange={(e) => {
                          setPerPage(Number(e.target.value));
                          setPage(1);
                        }}
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
                        disabled={page === 1}
                        onClick={() =>
                          page > 1 && handlePageChange(page - 1)
                        }
                        style={{
                          cursor: page === 1 ? "not-allowed" : "pointer",
                          opacity: page === 1 ? 0.5 : 1,
                        }}
                      />
                      {Array.from(
                        { length: Math.min(5, safeTotalPages) },
                        (_, i) => {
                          let pageNum;
                          if (safeTotalPages <= 5) pageNum = i + 1;
                          else if (page <= 3) pageNum = i + 1;
                          else if (page >= safeTotalPages - 2)
                            pageNum = safeTotalPages - 4 + i;
                          else pageNum = page - 2 + i;
                          return (
                            <Pagination.Item
                              key={pageNum}
                              active={pageNum === page}
                              onClick={() => handlePageChange(pageNum)}
                              style={{
                                cursor: "pointer",
                                minWidth: "38px",
                                textAlign: "center",
                              }}
                            >
                              {pageNum}
                            </Pagination.Item>
                          );
                        },
                      )}
                      <Pagination.Next
                        disabled={page === safeTotalPages}
                        onClick={() =>
                          page < safeTotalPages && handlePageChange(page + 1)
                        }
                        style={{
                          cursor:
                            page === safeTotalPages
                              ? "not-allowed"
                              : "pointer",
                          opacity: page === safeTotalPages ? 0.5 : 1,
                        }}
                      />
                    </Pagination>
                  </div>
                </Card.Body>
              </Card>
            )}
          </Container>
        </main>
      </div>
    </div>
  );
};

export default OfflineBookingList;
