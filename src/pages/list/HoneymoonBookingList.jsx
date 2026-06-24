import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Form,
  Row,
  Col,
  Table,
  Badge,
  InputGroup,
  Spinner,
  Pagination,
  Button,
  Modal,
  Container,
} from "react-bootstrap";
import {
  FaSearch,
  FaEye,
  FaTimes,
  FaExclamationTriangle,
  FaFilePdf,
  FaDownload,
  FaInbox,
  FaUser,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import "../../styles/HotelBookingListModern.css";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

// Column-width hints kept in sync with HotelBookingList/LongStayBookingList
// so the honeymoon page lines up visually under the shared hbl-modern skin.
const COLUMN_WIDTHS = {
  sn: "40px",
  customerName: "150px",
  bookingCode: "110px",
  bookDate: "95px",
  bookingDetails: "260px",
  pax: "90px",
  total: "120px",
  status: "110px",
  action: "110px",
};

const STATUS_META = {
  CONFIRMED: { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  Confirmed: { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  COMPLETED: { label: "Completed", bg: "#eff8ff", color: "#175cd3", dot: "#3b82f6" },
  Completed: { label: "Completed", bg: "#eff8ff", color: "#175cd3", dot: "#3b82f6" },
  PENDING:   { label: "Pending",   bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  Pending:   { label: "Pending",   bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
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

// "dd/mm/yyyy" — same shape HotelBookingList uses so dates render identically.
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

const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return typeof iso === "string" ? iso.slice(0, 10) : "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const HoneymoonBookingList = () => {
  const [data, setData] = useState({ content: [], totalElements: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [status, setStatus] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selected, setSelected] = useState(null);
  const [toCancel, setToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // ── Voucher modal state ────────────────────────────────────────────
  const [voucherFor, setVoucherFor] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherPdfUrl, setVoucherPdfUrl] = useState("");

  const openVoucher = async (booking) => {
    setVoucherFor(booking);
    setVoucherLoading(true);
    setVoucherPdfUrl("");
    try {
      const res = await axiosInstance.get(
        `/api/honeymoon/booking/${booking.id}/voucher`
      );
      if (res.data && res.data.status === "SUCCESS" && res.data.pdfUrl) {
        setVoucherPdfUrl(res.data.pdfUrl);
      } else {
        toast.error(res.data?.message || "Failed to generate voucher PDF");
      }
    } catch (e) {
      console.error("Voucher fetch failed", e);
      toast.error(
        e?.response?.data?.message || "Failed to load voucher PDF"
      );
    } finally {
      setVoucherLoading(false);
    }
  };

  const closeVoucher = () => {
    setVoucherFor(null);
    setVoucherPdfUrl("");
  };

  // Same seven booking-type options the Hotel Booking List ships with.
  // Honeymoon bookings have no Reconfirmed / Invoiced flag today; those
  // filters fall through to `false` until backend emits matching fields.
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

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        `/api/honeymoon/booking/list?page=${page}&size=${size}&search=${encodeURIComponent(debouncedSearch)}`
      );
      setData(res.data);
    } catch (e) {
      console.error(e);
      setData({ content: [], totalElements: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Debounce the search box so we don't fire on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    load();
  }, [page, size, debouncedSearch]); // eslint-disable-line

  // Reset to first page whenever a client-side filter changes.
  useEffect(() => {
    setPage(0);
  }, [status, selectedMonth, selectedYear]);

  // Client-side filter pass over the current server page — mirrors the
  // seven booking-type options + month/year time period used elsewhere.
  const filteredContent = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return (data.content || []).filter((b) => {
      const isCancelled = !!b.isCancelled;
      const ref = b.startingDate;
      const refDate = ref ? new Date(ref) : null;
      if (refDate && !isNaN(refDate.getTime())) refDate.setHours(0, 0, 0, 0);

      if (status === "cancelled") return isCancelled;
      if (isCancelled) return false;

      if (status === "upcoming") {
        if (!refDate || refDate < now) return false;
      }
      if (status === "completed") {
        if (!refDate || refDate >= now) return false;
      }
      if (status === "onrequest") {
        const s = normStatus(b.bookingStatus || b.confirmationStatus);
        if (s !== "pending" && s !== "onrequest") return false;
      }
      if (status === "reconfirmed") {
        const cs = normStatus(b.confirmationStatus);
        if (cs !== "reconfirmed") return false;
      }
      if (status === "invoiced") {
        const inv =
          normStatus(b.invoiceStatus) === "invoiced" ||
          b.invoiced === true ||
          b.isInvoiced === true;
        if (!inv) return false;
      }

      if (refDate && (selectedMonth || selectedYear)) {
        const m = refDate.getMonth() + 1;
        const y = refDate.getFullYear();
        if (selectedMonth && Number(selectedMonth) !== m) return false;
        if (selectedYear && Number(selectedYear) !== y) return false;
      }

      return true;
    });
  }, [data.content, status, selectedMonth, selectedYear]);

  const handleCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    try {
      await axiosInstance.put(`/api/honeymoon/booking/${toCancel.id}/cancel`, {
        reason: cancelReason || "Cancelled by user",
      });
      toast.success("Booking cancelled");
      setToCancel(null);
      setCancelReason("");
      load();
    } catch (e) {
      toast.error("Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  const totalEntries = filteredContent.length;
  const safeTotalPages = Math.max(1, data.totalPages || 1);
  const currentPage = page + 1;
  const serialNumberBase = page * size;
  const hasResults = totalEntries > 0;
  const displayStart = hasResults ? serialNumberBase + 1 : 0;
  const displayEnd = hasResults
    ? serialNumberBase + filteredContent.length
    : 0;

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
                <h3 className="fw-bold text-dark mb-2">Honeymoon Bookings</h3>
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
                              width: COLUMN_WIDTHS.customerName,
                            }}
                          >
                            Customer Name
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              width: COLUMN_WIDTHS.bookingCode,
                            }}
                          >
                            Booking Code
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              textAlign: "center",
                              width: COLUMN_WIDTHS.bookDate,
                            }}
                          >
                            Start Date
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              width: COLUMN_WIDTHS.bookingDetails,
                            }}
                          >
                            Booking Details
                          </th>
                          <th
                            style={{
                              ...baseHeaderStyle,
                              textAlign: "center",
                              width: COLUMN_WIDTHS.pax,
                            }}
                          >
                            Pax / Rooms
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
                              width: COLUMN_WIDTHS.action,
                            }}
                          >
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContent.length === 0 ? (
                          <tr>
                            <td
                              colSpan={9}
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
                          filteredContent.map((b, i) => {
                            const statusText = b.isCancelled
                              ? "Cancelled"
                              : b.bookingStatus || "Confirmed";
                            const sMeta = STATUS_META[statusText];
                            const pax = (b.adults || 0) + (b.children || 0);
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
                                    width: COLUMN_WIDTHS.customerName,
                                  }}
                                >
                                  <div
                                    className="d-flex align-items-center"
                                    style={{ gap: "0.35rem" }}
                                  >
                                    <FaUser
                                      style={{
                                        color: "#6c757d",
                                        fontSize: "0.78rem",
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span className="fw-medium text-dark">
                                      {b.customerName || "-"}
                                    </span>
                                  </div>
                                  {b.mobile && (
                                    <div
                                      className="text-muted"
                                      style={{ fontSize: "0.7rem" }}
                                    >
                                      {b.mobile}
                                    </div>
                                  )}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    width: COLUMN_WIDTHS.bookingCode,
                                  }}
                                >
                                  <span className="fw-bold text-primary">
                                    {b.bookingNumber || "-"}
                                  </span>
                                </td>
                                <td
                                  className="text-muted"
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.bookDate,
                                  }}
                                >
                                  {formatShortDate(b.startingDate) || "-"}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    width: COLUMN_WIDTHS.bookingDetails,
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
                                      className="fw-semibold text-dark"
                                      style={{ fontSize: "0.875rem" }}
                                    >
                                      {b.packageName || "-"}
                                    </span>
                                    {(b.startingFrom || b.destination) && (
                                      <span
                                        className="text-muted"
                                        style={{ fontSize: "0.75rem" }}
                                      >
                                        ({b.startingFrom || "-"} →{" "}
                                        {b.destination || "-"})
                                      </span>
                                    )}
                                  </div>
                                  {b.noOfNights ? (
                                    <div
                                      className="text-muted"
                                      style={{ fontSize: "0.7rem" }}
                                    >
                                      {b.noOfNights} night
                                      {b.noOfNights === 1 ? "" : "s"}
                                    </div>
                                  ) : null}
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
                                  <div>{pax} pax</div>
                                  <div
                                    className="text-muted"
                                    style={{ fontSize: "0.7rem" }}
                                  >
                                    {b.rooms || 0} room
                                    {(b.rooms || 0) === 1 ? "" : "s"}
                                  </div>
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
                                    ₹ {Number(b.totalAmount || 0).toFixed(2)}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    width: COLUMN_WIDTHS.status,
                                  }}
                                >
                                  <StatusPill meta={sMeta} raw={statusText} />
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
                                      onClick={() => setSelected(b)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          setSelected(b);
                                        }
                                      }}
                                    />
                                    <FaFilePdf
                                      role="button"
                                      tabIndex={0}
                                      title="Voucher"
                                      style={{
                                        fontSize: "16px",
                                        color: b.isCancelled
                                          ? "#adb5bd"
                                          : "#b42318",
                                        cursor: b.isCancelled
                                          ? "not-allowed"
                                          : "pointer",
                                      }}
                                      onClick={() =>
                                        !b.isCancelled && openVoucher(b)
                                      }
                                      onKeyDown={(e) => {
                                        if (
                                          !b.isCancelled &&
                                          (e.key === "Enter" || e.key === " ")
                                        ) {
                                          e.preventDefault();
                                          openVoucher(b);
                                        }
                                      }}
                                    />
                                    {!b.isCancelled && (
                                      <FaTimes
                                        role="button"
                                        tabIndex={0}
                                        title="Cancel booking"
                                        style={{
                                          fontSize: "16px",
                                          color: "#b42318",
                                          cursor: "pointer",
                                        }}
                                        onClick={() => setToCancel(b)}
                                        onKeyDown={(e) => {
                                          if (
                                            e.key === "Enter" ||
                                            e.key === " "
                                          ) {
                                            e.preventDefault();
                                            setToCancel(b);
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
                        {data.totalElements || totalEntries}
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
                        value={size}
                        onChange={(e) => {
                          setSize(Number(e.target.value));
                          setPage(0);
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
                        disabled={currentPage === 1}
                        onClick={() =>
                          currentPage > 1 && setPage(page - 1)
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
                          onClick={() => setPage(pageNumber - 1)}
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
                          currentPage < safeTotalPages && setPage(page + 1)
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

      <Modal show={!!selected} onHide={() => setSelected(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Booking Details — {selected?.bookingNumber}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selected && (
            <>
              <Row className="g-2 mb-3">
                <Col md={6}><strong>Package:</strong> {selected.packageName}</Col>
                <Col md={6}><strong>Route:</strong> {selected.startingFrom} → {selected.destination}</Col>
                <Col md={6}><strong>Start Date:</strong> {fmtDate(selected.startingDate)}</Col>
                <Col md={6}><strong>Nights:</strong> {selected.noOfNights}</Col>
                <Col md={6}><strong>Rooms:</strong> {selected.rooms}</Col>
                <Col md={6}>
                  <strong>Pax:</strong> {selected.adults} Adults
                  {selected.children
                    ? `, ${selected.children} Children${
                        Array.isArray(selected.childAges) && selected.childAges.length
                          ? ` (ages: ${selected.childAges.join(", ")})`
                          : ""
                      }`
                    : ""}
                </Col>
                <Col md={6}><strong>Customer:</strong> {selected.customerName} ({selected.mobile})</Col>
                <Col md={6}><strong>Email:</strong> {selected.email || "-"}</Col>
                <Col md={6}><strong>Agent:</strong> {selected.agentName || "-"}</Col>
                <Col md={6}>
                  <strong>Status:</strong>{" "}
                  {selected.isCancelled ? (
                    <Badge bg="danger">Cancelled</Badge>
                  ) : (
                    <Badge bg="success">{selected.bookingStatus || "Confirmed"}</Badge>
                  )}
                </Col>
                <Col md={6}><strong>Payment Mode:</strong> {selected.paymentMode || "-"}</Col>
                <Col md={6}><strong>Booked on:</strong> {selected.createdDate}</Col>
                {selected.isCancelled && (
                  <>
                    <Col md={6}><strong>Cancelled at:</strong> {selected.cancelledAt}</Col>
                    <Col md={12}><strong>Cancellation reason:</strong> {selected.cancellationReason || "-"}</Col>
                  </>
                )}
                <Col md={12}><strong>Special Request:</strong> {selected.specialRequest || "-"}</Col>
              </Row>
              <Table size="sm" bordered>
                <tbody>
                  <tr><td>Base Rate (per pax)</td><td className="text-end">₹ {Number(selected.baseRate || 0).toFixed(2)}</td></tr>
                  <tr><td>Markup ({selected.markupPercent || 0}%)</td><td className="text-end">₹ {Number(selected.markupAmount || 0).toFixed(2)}</td></tr>
                  <tr><td>Tax ({selected.taxPercent || 0}%)</td><td className="text-end">₹ {Number(selected.taxAmount || 0).toFixed(2)}</td></tr>
                  <tr className="table-light fw-bold">
                    <td>Grand Total</td>
                    <td className="text-end text-success">₹ {Number(selected.totalAmount || 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* Voucher modal — backend returns { status, message, pdfUrl };
          the pdfUrl is loaded into an inline iframe so the agent can scroll
          through the voucher without leaving the page. */}
      <Modal
        show={!!voucherFor}
        onHide={closeVoucher}
        size="xl"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaFilePdf className="text-danger me-2" />
            Voucher — {voucherFor?.bookingNumber}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {voucherLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <div className="mt-2 small text-muted">
                Generating voucher PDF…
              </div>
            </div>
          ) : voucherPdfUrl ? (
            <div
              style={{
                border: "1px solid #dee2e6",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  background: "#f8f9fa",
                  fontWeight: 600,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Voucher PDF Preview</span>
                <a
                  href={voucherPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm btn-outline-primary"
                >
                  <FaDownload className="me-1" /> Open / Download
                </a>
              </div>
              <iframe
                src={voucherPdfUrl}
                title="Honeymoon Voucher"
                width="100%"
                height="560px"
                style={{ border: "none" }}
              />
            </div>
          ) : (
            <div className="text-muted text-center py-4">
              No voucher available for this booking.
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeVoucher}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!toCancel} onHide={() => !cancelling && setToCancel(null)} centered>
        <Modal.Header closeButton={!cancelling}>
          <Modal.Title>
            <FaExclamationTriangle className="text-primary me-2" /> Cancel Booking
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Cancel booking <strong>{toCancel?.bookingNumber}</strong>?
          <Form.Group className="mt-3">
            <Form.Label>Reason (optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={cancelling} onClick={() => setToCancel(null)}>
            Back
          </Button>
          <Button variant="danger" disabled={cancelling} onClick={handleCancel}>
            {cancelling ? "Cancelling..." : "Confirm Cancel"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HoneymoonBookingList;
