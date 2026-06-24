import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Container,
  Card,
  Table,
  Button,
  Spinner,
  Pagination,
  Form,
  InputGroup,
  Modal,
  Row,
  Col,
} from "react-bootstrap";
import {
  FaEye,
  FaSearch,
  FaInbox,
  FaSpa,
  FaUserMd,
  FaBookOpen,
  FaTrashAlt,
} from "react-icons/fa";
import toast from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import "../../styles/HotelBookingListModern.css";

const AYURVEDA_API = "/api/v1/ayurveda";
const PER_PAGE_OPTIONS = [10, 25, 50, 100];

// Column-width hints kept in sync with HotelBookingList so the two
// pages line up visually under the shared hbl-modern skin.
const COLUMN_WIDTHS = {
  sn: "40px",
  reference: "110px",
  type: "120px",
  item: "180px",
  booked: "95px",
  period: "150px",
  pax: "60px",
  total: "100px",
  status: "110px",
  payment: "110px",
  action: "90px",
};

const STATUS_META = {
  CONFIRMED: { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  COMPLETED: { label: "Completed", bg: "#eff8ff", color: "#175cd3", dot: "#3b82f6" },
  PENDING:   { label: "Pending",   bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  CANCELLED: { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
  Cancelled: { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
};

const PAYMENT_META = {
  PAID:      { label: "Paid",     bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  PENDING:   { label: "Pending",  bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  FAILED:    { label: "Failed",   bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
  REFUNDED:  { label: "Refunded", bg: "#eff8ff", color: "#175cd3", dot: "#3b82f6" },
  UNPAID:    { label: "Unpaid",   bg: "#f3f4f6", color: "#475467" },
};

const TYPE_META = {
  PACKAGE:      { bg: "#f0f9ff", color: "#0369a1" },
  CONSULTATION: { bg: "#faf5ff", color: "#7e22ce" },
  COURSE:       { bg: "#fff7ed", color: "#c2410c" },
};

const typeIcon = (type) => {
  if (type === "PACKAGE") return <FaSpa className="me-1" />;
  if (type === "CONSULTATION") return <FaUserMd className="me-1" />;
  if (type === "COURSE") return <FaBookOpen className="me-1" />;
  return null;
};

const formatAmount = (a) => (a != null ? `₹${Number(a).toFixed(2)}` : "-");

// "dd/mm/yyyy" — same shape HotelBookingList uses in the table cells so
// dates render identically across both pages.
const formatShortDate = (dateString) => {
  if (!dateString) return "";
  const normalized = String(dateString).includes("T")
    ? dateString
    : `${dateString}T00:00:00`;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
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

const AyurvedaBookingList = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1); // 1-indexed to mirror HotelBookingList
  const [perPage, setPerPage] = useState(10);

  // Filters — mirror the Hotel Booking List: a single "Booking Type"
  // dropdown (All / Upcoming / Completed / Cancelled / On Request /
  // Reconfirmed / Invoiced), a search box and a Month + Year time-period
  // card. All applied client-side over the single fetch.
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  // Modals — kept from the original page.
  const [detailsBooking, setDetailsBooking] = useState(null);
  const [cancelBooking, setCancelBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Same seven booking-type options Hotel Booking List ships with. The
  // last three map to closest available fields on the Ayurveda booking —
  // PENDING status counts as On Request; Reconfirmed / Invoiced read
  // optional flags so they light up the moment the backend emits them.
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

  const normStatus = (v) =>
    String(v ?? "").replace(/[\s_-]+/g, "").toLowerCase();

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 2014 }, (_, i) => 2020 + i);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Pull a wide window once and filter client-side so the new design
      // can keep the rich filter set without extra endpoints.
      const res = await axiosInstance.get(`${AYURVEDA_API}/bookings`, {
        params: { page: 0, size: 500 },
      });
      const data = res.data || {};
      setBookings(Array.isArray(data.content) ? data.content : []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Apply search + status + time-period filters in one pass.
  const filteredBookings = useMemo(() => {
    const now = new Date();
    const needle = search.trim().toLowerCase();
    return (bookings || []).filter((b) => {
      const isCancelled =
        b.isCancelled === true || b.status === "CANCELLED" || b.status === "Cancelled";
      const startDate = b.startDate ? new Date(b.startDate) : null;
      const endDate = b.endDate ? new Date(b.endDate) : null;

      if (status === "cancelled" && !isCancelled) return false;
      if (status === "upcoming") {
        if (isCancelled) return false;
        if (!startDate || startDate < now) return false;
      }
      if (status === "completed") {
        if (isCancelled) return false;
        const ref = endDate || startDate;
        if (!ref || ref > now) return false;
      }
      if (status === "onrequest") {
        if (isCancelled) return false;
        const s = normStatus(b.status || b.confirmationStatus);
        if (s !== "pending" && s !== "onrequest") return false;
      }
      if (status === "reconfirmed") {
        if (isCancelled) return false;
        const cs = normStatus(b.confirmationStatus);
        if (cs !== "reconfirmed") return false;
      }
      if (status === "invoiced") {
        if (isCancelled) return false;
        const inv =
          normStatus(b.invoiceStatus) === "invoiced" ||
          b.invoiced === true ||
          b.isInvoiced === true;
        if (!inv) return false;
      }

      if (startDate && (selectedMonth || selectedYear)) {
        const m = startDate.getMonth() + 1;
        const y = startDate.getFullYear();
        if (selectedMonth && Number(selectedMonth) !== m) return false;
        if (selectedYear && Number(selectedYear) !== y) return false;
      }

      if (needle) {
        const hay = [
          b.bookingReference,
          b.packageName,
          b.doctorName,
          b.courseName,
          b.status,
          b.bookingType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [bookings, search, status, selectedMonth, selectedYear]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [search, status, selectedMonth, selectedYear, perPage]);

  // Pagination derived from the filtered list (single client-side window).
  const totalEntries = filteredBookings.length;
  const safeTotalPages = Math.max(1, Math.ceil(totalEntries / perPage));
  const currentPage = Math.min(page, safeTotalPages);
  const serialNumberBase = (currentPage - 1) * perPage;
  const pageBookings = filteredBookings.slice(
    serialNumberBase,
    serialNumberBase + perPage,
  );
  const hasResults = totalEntries > 0;
  const displayStart = hasResults ? serialNumberBase + 1 : 0;
  const displayEnd = hasResults
    ? Math.min(serialNumberBase + pageBookings.length, totalEntries)
    : 0;

  const submitCancel = async () => {
    if (!cancelBooking) return;
    setCancelling(true);
    try {
      await axiosInstance.post(
        `${AYURVEDA_API}/bookings/${cancelBooking.id}/cancel`,
        { reason: cancelReason || "Cancelled by user" },
      );
      toast.success("Booking cancelled");
      setCancelBooking(null);
      setCancelReason("");
      load();
    } catch (e) {
      console.error(e);
      toast.error("Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

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
            {/* Header: Title + Search (left) | Time Period (right) */}
            <div className="d-flex justify-content-between align-items-end mb-3">
              <div>
                <h3 className="fw-bold text-dark mb-2">Ayurveda Bookings</h3>
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
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
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
              style={{ borderRadius: "8px", overflow: "hidden", width: "100%" }}
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
                          <th
                            style={{
                              ...baseHeaderStyle,
                              textAlign: "center",
                              width: COLUMN_WIDTHS.sn,
                            }}
                          >
                            S.N
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              width: COLUMN_WIDTHS.reference,
                            }}
                          >
                            Reference
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              width: COLUMN_WIDTHS.type,
                            }}
                          >
                            Type
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              width: COLUMN_WIDTHS.item,
                            }}
                          >
                            Item
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              textAlign: "center",
                              width: COLUMN_WIDTHS.booked,
                            }}
                          >
                            Booked
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              width: COLUMN_WIDTHS.period,
                            }}
                          >
                            Period
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              textAlign: "center",
                              width: COLUMN_WIDTHS.pax,
                            }}
                          >
                            Pax
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              textAlign: "right",
                              width: COLUMN_WIDTHS.total,
                            }}
                          >
                            Total
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              textAlign: "center",
                              width: COLUMN_WIDTHS.status,
                            }}
                          >
                            Status
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              textAlign: "center",
                              width: COLUMN_WIDTHS.payment,
                            }}
                          >
                            Payment
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              textAlign: "center",
                              width: COLUMN_WIDTHS.action,
                            }}
                          >
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageBookings.length === 0 ? (
                          <tr>
                            <td
                              colSpan={11}
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
                          pageBookings.map((b, i) => {
                            const sMeta = STATUS_META[b.status];
                            const pMeta = PAYMENT_META[b.paymentStatus];
                            const tMeta =
                              TYPE_META[b.bookingType] || {
                                bg: "#f3f4f6",
                                color: "#475467",
                              };
                            return (
                              <tr
                                key={b.id}
                                style={{
                                  backgroundColor:
                                    i % 2 === 0 ? "#ffffff" : "#f8f9fa",
                                  transition: "background-color 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    "#e7f3ff";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    i % 2 === 0 ? "#ffffff" : "#f8f9fa";
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
                                  {serialNumberBase + i + 1}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    width: COLUMN_WIDTHS.reference,
                                  }}
                                >
                                  <span className="fw-bold text-primary">
                                    {b.bookingReference || "-"}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    width: COLUMN_WIDTHS.type,
                                  }}
                                >
                                  <span
                                    className="d-inline-flex align-items-center px-2 py-1 rounded"
                                    style={{
                                      backgroundColor: tMeta.bg,
                                      color: tMeta.color,
                                      fontSize: "0.7rem",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {typeIcon(b.bookingType)}
                                    {b.bookingType || "-"}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    width: COLUMN_WIDTHS.item,
                                  }}
                                >
                                  <span className="fw-semibold text-dark">
                                    {b.packageName ||
                                      b.doctorName ||
                                      b.courseName ||
                                      "-"}
                                  </span>
                                </td>
                                <td
                                  className="text-muted"
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.booked,
                                  }}
                                >
                                  {formatShortDate(b.bookingDate) || "-"}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    width: COLUMN_WIDTHS.period,
                                  }}
                                >
                                  <div
                                    className="d-flex align-items-center"
                                    style={{
                                      gap: "0.35rem",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <span
                                      className="text-muted"
                                      style={{ fontSize: "0.75rem" }}
                                    >
                                      {formatShortDate(b.startDate) || "-"}
                                      {formatShortDate(b.endDate)
                                        ? ` → ${formatShortDate(b.endDate)}`
                                        : ""}
                                    </span>
                                  </div>
                                </td>
                                <td
                                  className="text-muted"
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    fontFamily: "monospace",
                                    width: COLUMN_WIDTHS.pax,
                                  }}
                                >
                                  {b.numberOfParticipants ?? "-"}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "right",
                                    width: COLUMN_WIDTHS.total,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <span className="fw-semibold text-dark">
                                    {formatAmount(b.totalPrice)}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.status,
                                  }}
                                >
                                  <StatusPill meta={sMeta} raw={b.status} />
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.payment,
                                  }}
                                >
                                  <StatusPill
                                    meta={pMeta}
                                    raw={b.paymentStatus}
                                  />
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.action,
                                  }}
                                >
                                  <div className="d-flex justify-content-center align-items-center gap-2">
                                    <FaEye
                                      role="button"
                                      tabIndex={0}
                                      title="View full booking details"
                                      style={{
                                        fontSize: "18px",
                                        color: "#007bff",
                                        cursor: "pointer",
                                      }}
                                      onClick={() => setDetailsBooking(b)}
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === "Enter" ||
                                          e.key === " "
                                        ) {
                                          e.preventDefault();
                                          setDetailsBooking(b);
                                        }
                                      }}
                                    />
                                    {!b.isCancelled && (
                                      <FaTrashAlt
                                        role="button"
                                        tabIndex={0}
                                        title="Cancel booking"
                                        style={{
                                          fontSize: "15px",
                                          color: "#b42318",
                                          cursor: "pointer",
                                        }}
                                        onClick={() => setCancelBooking(b)}
                                        onKeyDown={(e) => {
                                          if (
                                            e.key === "Enter" ||
                                            e.key === " "
                                          ) {
                                            e.preventDefault();
                                            setCancelBooking(b);
                                          }
                                        }}
                                      />
                                    )}
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
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
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
                        {totalEntries}
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
                        disabled={currentPage === 1}
                        onClick={() =>
                          currentPage > 1 && setPage(currentPage - 1)
                        }
                        style={{
                          cursor:
                            currentPage === 1 ? "not-allowed" : "pointer",
                          opacity: currentPage === 1 ? 0.5 : 1,
                        }}
                      />
                      {Array.from(
                        { length: safeTotalPages },
                        (_, i) => i + 1,
                      ).map((pageNumber) => (
                        <Pagination.Item
                          key={pageNumber}
                          active={currentPage === pageNumber}
                          onClick={() => setPage(pageNumber)}
                          style={{
                            cursor: "pointer",
                            minWidth: "38px",
                            textAlign: "center",
                          }}
                        >
                          {pageNumber}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={currentPage === safeTotalPages}
                        onClick={() =>
                          currentPage < safeTotalPages &&
                          setPage(currentPage + 1)
                        }
                        style={{
                          cursor:
                            currentPage === safeTotalPages
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            currentPage === safeTotalPages ? 0.5 : 1,
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

      {/* Details Modal */}
      <Modal
        show={!!detailsBooking}
        onHide={() => setDetailsBooking(null)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Booking Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailsBooking && (
            <Row className="g-2">
              <Col md={6}>
                <strong>Reference:</strong> {detailsBooking.bookingReference}
              </Col>
              <Col md={6}>
                <strong>Type:</strong> {detailsBooking.bookingType}
              </Col>
              <Col md={6}>
                <strong>Status:</strong> {detailsBooking.status}
              </Col>
              <Col md={6}>
                <strong>Payment:</strong> {detailsBooking.paymentStatus}
              </Col>
              <Col md={6}>
                <strong>Booking Date:</strong>{" "}
                {formatShortDate(detailsBooking.bookingDate)}
              </Col>
              <Col md={6}>
                <strong>Participants:</strong>{" "}
                {detailsBooking.numberOfParticipants}
              </Col>
              <Col md={6}>
                <strong>Start Date:</strong>{" "}
                {formatShortDate(detailsBooking.startDate)}
              </Col>
              <Col md={6}>
                <strong>End Date:</strong>{" "}
                {formatShortDate(detailsBooking.endDate)}
              </Col>
              {detailsBooking.packageName && (
                <Col md={12}>
                  <strong>Package:</strong> {detailsBooking.packageName}
                </Col>
              )}
              {detailsBooking.doctorName && (
                <Col md={12}>
                  <strong>Doctor:</strong> {detailsBooking.doctorName}
                </Col>
              )}
              {detailsBooking.courseName && (
                <Col md={12}>
                  <strong>Course:</strong> {detailsBooking.courseName}
                </Col>
              )}
              {detailsBooking.symptoms && (
                <Col md={12}>
                  <strong>Symptoms:</strong> {detailsBooking.symptoms}
                </Col>
              )}
              {detailsBooking.previousExperience && (
                <Col md={12}>
                  <strong>Previous Experience:</strong>{" "}
                  {detailsBooking.previousExperience}
                </Col>
              )}
              {detailsBooking.specialRequests && (
                <Col md={12}>
                  <strong>Special Requests:</strong>{" "}
                  {detailsBooking.specialRequests}
                </Col>
              )}
              <Col md={12}>
                <strong>Total:</strong>{" "}
                {formatAmount(detailsBooking.totalPrice)}
              </Col>
              {detailsBooking.isCancelled && (
                <Col md={12}>
                  <strong>Cancelled on:</strong>{" "}
                  {formatShortDate(detailsBooking.cancelledDate)} —{" "}
                  {detailsBooking.cancellationReason}
                </Col>
              )}
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDetailsBooking(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        show={!!cancelBooking}
        onHide={() => setCancelBooking(null)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Cancel Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cancelBooking && (
            <>
              <p>
                Are you sure you want to cancel booking{" "}
                <strong>{cancelBooking.bookingReference}</strong>?
              </p>
              <Form.Group>
                <Form.Label>Reason</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setCancelBooking(null)}
            disabled={cancelling}
          >
            Close
          </Button>
          <Button
            variant="danger"
            onClick={submitCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <Spinner size="sm" animation="border" />
            ) : (
              "Confirm Cancel"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AyurvedaBookingList;
