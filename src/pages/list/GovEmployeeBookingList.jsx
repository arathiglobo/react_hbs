/**
 * GovEmployeeBookingList.jsx
 *
 * Booking-list page for the gov-employee flow.
 *
 * Cancel: DELETE /api/gov-employee-booking/{id}   (server refunds credit)
 * View  : navigate to /booking-details/gov-employee-booking/{id}
 * Voucher: GET /api/gov-employee-booking/{id}/voucher (PDF stream)
 */

import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Table,
  Spinner,
  Form,
  Container,
  InputGroup,
  Pagination,
} from "react-bootstrap";
import { FaEye, FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from(
  { length: CURRENT_YEAR - 2014 },
  (_, i) => 2020 + i,
);

const STATUS_META = {
  CONFIRMED:  { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  Confirmed:  { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  RECONFIRMED:{ label: "Reconfirmed", bg: "#eff8ff", color: "#175cd3", dot: "#3b82f6" },
  ONREQUEST:  { label: "On request", bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  PENDING:    { label: "Pending",   bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  Cancelled:  { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
  CANCELLED:  { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
};

const REFUND_META = {
  REFUNDABLE:      { label: "Refundable",     bg: "#e7f6ec", color: "#1b7f3a" },
  "Non-Refundable":{ label: "Non-Refundable", bg: "#f3f4f6", color: "#475467" },
  NON_REFUNDABLE:  { label: "Non-Refundable", bg: "#f3f4f6", color: "#475467" },
  REFUNDED:        { label: "Refunded",       bg: "#eff8ff", color: "#175cd3" },
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

const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return iso.slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export default function GovEmployeeBookingList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [agentId, setAgentId] = useState("");
  const [search, setSearch] = useState("");
  const [bookingType, setBookingType] = useState("upcoming");
  const [selectedMonth, setSelectedMonth] = useState(""); // "1".."12"
  const [selectedYear, setSelectedYear] = useState("");
  const [role, setRole] = useState(
    (localStorage.getItem("currentActiveRole") || "").toLowerCase(),
  );

  // If the current role is an agent, restrict to their own bookings.
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
        `/api/gov-employee-booking/list?${params.toString()}`,
      );
      setRows(data?.content || []);
      setTotalPages(data?.totalPages || 0);
    } catch (e) {
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage();
    // eslint-disable-next-line
  }, [page, size, agentId]);

  // Client-side filter combining booking type, time period (month/year of
  // check-in), and free-text search against the already-fetched page.
  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const needle = search.trim().toLowerCase();
    const m = selectedMonth ? Number(selectedMonth) : null; // 1..12
    const y = selectedYear ? Number(selectedYear) : null;
    return (rows || []).filter((r) => {
      const isCancelled =
        r.cancelled === true ||
        String(r.bookingStatus || "").toUpperCase() === "CANCELLED" ||
        String(r.confirmationStatus || "").toUpperCase() === "CANCELLED";

      if (bookingType === "cancelled") {
        if (!isCancelled) return false;
      } else {
        if (isCancelled) return false;
        const ref = r.checkOutDate || r.checkInDate;
        const refDate = ref ? new Date(ref) : null;
        if (refDate && !isNaN(refDate.getTime())) {
          refDate.setHours(0, 0, 0, 0);
          if (bookingType === "completed" && refDate >= today) return false;
          if (bookingType === "upcoming" && refDate < today) return false;
        }
      }

      if (m || y) {
        const ci = r.checkInDate ? new Date(r.checkInDate) : null;
        if (!ci || isNaN(ci.getTime())) return false;
        if (m && ci.getMonth() + 1 !== m) return false;
        if (y && ci.getFullYear() !== y) return false;
      }

      if (needle) {
        const hay = [
          r.bookingCode,
          r.customerName,
          r.hotelName,
          r.govEmployeeCode,
          r.govEmployeeName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }

      return true;
    });
  }, [rows, search, bookingType, selectedMonth, selectedYear]);

  // Reset to page 0 whenever any filter changes.
  useEffect(() => {
    setPage(0);
  }, [search, bookingType, selectedMonth, selectedYear]);

  const totalElements =
    rows.length === 0
      ? 0
      : totalPages > 1
        ? totalPages * size
        : filtered.length;
  const displayStart = filtered.length === 0 ? 0 : page * size + 1;
  const displayEnd = page * size + filtered.length;

  const clearTimePeriod = () => {
    setSelectedMonth("");
    setSelectedYear("");
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
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="mb-0 text-dark fw-semibold">Government Employee Booking</h5>
            </div>

            {/* List of Bookings Section */}
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
                {/* Toolbar row 1: Booking-type pills + Time Period (right) */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <div className="d-inline-flex p-1 rounded" style={{ backgroundColor: "#f3f4f6" }}>
                    {[
                      { value: "upcoming", label: "Upcoming" },
                      { value: "completed", label: "Completed" },
                      { value: "cancelled", label: "Cancelled" },
                    ].map((opt) => {
                      const active = bookingType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setBookingType(opt.value)}
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
                      {MONTHS.map((month, idx) => (
                        <option key={month} value={idx + 1}>
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
                      {YEARS.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </Form.Select>
                    {(selectedMonth || selectedYear) && (
                      <button
                        type="button"
                        onClick={clearTimePeriod}
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

                {/* Toolbar row 2: page size + search */}
                <div
                  className="d-flex flex-wrap justify-content-end align-items-center gap-2"
                  style={{ marginBottom: "1.5rem" }}
                >
                  <Form.Select
                    value={size}
                    onChange={(e) => {
                      setSize(Number(e.target.value));
                      setPage(0);
                    }}
                    size="sm"
                    style={{ width: "auto", fontSize: "0.8rem" }}
                  >
                    {PER_PAGE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option} / page
                      </option>
                    ))}
                  </Form.Select>
                  <InputGroup size="sm" style={{ width: "240px" }}>
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
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3 text-muted">Loading bookings...</p>
                  </div>
                ) : (
                  <>
                    <div className="table-responsive saas-table-wrap">
                      <Table hover className="mb-0 align-middle saas-table">
                        <thead>
                          <tr>
                            <th style={{ width: "48px" }}>#</th>
                            <th>Booking</th>
                            {role === "admin" && <th>Agent</th>}
                            <th>Customer</th>
                            <th>Govt Emp</th>
                            <th>Hotel</th>
                            <th>Stay</th>
                            <th className="text-end">Amount</th>
                            <th>Status</th>
                            <th>Refund</th>
                            <th className="text-center" style={{ width: "80px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length > 0 ? (
                            filtered.map((r, i) => {
                              const statusText = r.cancelled
                                ? "Cancelled"
                                : r.confirmationStatus || "-";
                              const sMeta = STATUS_META[statusText];
                              const rMeta = REFUND_META[r.refundStatus];
                              return (
                                <tr key={r.bookingId}>
                                  <td className="text-muted">{page * size + i + 1}</td>
                                  <td>
                                    <span className="fw-semibold text-dark">
                                      {r.bookingCode || "-"}
                                    </span>
                                  </td>
                                  {role === "admin" && (
                                    <td>{r.agentName || r.agentId || "-"}</td>
                                  )}
                                  <td>{r.customerName || "-"}</td>
                                  <td>
                                    <div className="fw-medium text-dark">
                                      {r.govEmployeeCode || "-"}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                      {r.govEmployeeName || ""}
                                    </div>
                                  </td>
                                  <td>{r.hotelName || "-"}</td>
                                  <td style={{ whiteSpace: "nowrap" }}>
                                    <div>{fmtDate(r.checkInDate)}</div>
                                    <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                      → {fmtDate(r.checkOutDate)}
                                    </div>
                                  </td>
                                  <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                                    <div className="fw-semibold text-dark">
                                      {r.totalRate != null ? `AED ${r.totalRate}` : "-"}
                                    </div>
                                    {r.totalRateBeforeDiscount != null &&
                                      r.totalRateBeforeDiscount !== r.totalRate && (
                                        <div
                                          className="text-muted text-decoration-line-through"
                                          style={{ fontSize: "0.7rem" }}
                                        >
                                          AED {r.totalRateBeforeDiscount}
                                        </div>
                                      )}
                                  </td>
                                  <td>
                                    <StatusPill meta={sMeta} raw={statusText} />
                                  </td>
                                  <td>
                                    <StatusPill meta={rMeta} raw={r.refundStatus} />
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
                                          `/booking-details/gov-employee-booking/${r.bookingId}`,
                                        )
                                      }
                                      title="View details"
                                    >
                                      <FaEye style={{ fontSize: "12px" }} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                colSpan={role === "admin" ? 11 : 10}
                                className="text-center py-5 text-muted"
                              >
                                No bookings found
                              </td>
                            </tr>
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

                    {/* Pagination */}
                    <div className="d-flex justify-content-between align-items-center mt-3">
                      <div className="text-muted small">
                        Showing {displayStart} to {displayEnd} of {totalElements}{" "}
                        entries
                      </div>
                      {totalPages > 1 && (
                        <Pagination className="mb-0">
                          <Pagination.Prev
                            disabled={page === 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                          />
                          {Array.from(
                            { length: Math.min(5, totalPages) },
                            (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i;
                              } else if (page <= 2) {
                                pageNum = i;
                              } else if (page >= totalPages - 3) {
                                pageNum = totalPages - 5 + i;
                              } else {
                                pageNum = page - 2 + i;
                              }
                              return (
                                <Pagination.Item
                                  key={pageNum}
                                  active={pageNum === page}
                                  onClick={() => setPage(pageNum)}
                                >
                                  {pageNum + 1}
                                </Pagination.Item>
                              );
                            },
                          )}
                          <Pagination.Next
                            disabled={page + 1 >= totalPages}
                            onClick={() => setPage((p) => p + 1)}
                          />
                        </Pagination>
                      )}
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>
    </div>
  );
}
