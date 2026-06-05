import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Form,
  Table,
  InputGroup,
  Spinner,
  Button,
} from "react-bootstrap";
import {
  FaSearch,
  FaEye,
  FaSync,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

const STATUS_PILL_META = {
  Confirmed:   { label: "Confirmed",   bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  Completed:   { label: "Completed",   bg: "#eff8ff", color: "#175cd3", dot: "#3b82f6" },
  "On Request":{ label: "On Request",  bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  Reconfirmed: { label: "Reconfirmed", bg: "#eef2ff", color: "#3538cd", dot: "#6366f1" },
  Invoiced:    { label: "Invoiced",    bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6" },
  Failed:      { label: "Failed",      bg: "#f3f4f6", color: "#475467", dot: "#98a2b3" },
  Cancelled:   { label: "Cancelled",   bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
};

const renderStatusPill = (raw) => {
  const key = String(raw || "Confirmed").trim();
  const meta =
    STATUS_PILL_META[key] ||
    STATUS_PILL_META[Object.keys(STATUS_PILL_META).find(
      (k) => k.toLowerCase() === key.toLowerCase(),
    )];
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
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: meta.dot,
          display: "inline-block",
        }}
      />
      {meta.label}
    </span>
  );
};

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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all"); // see STATUS_TABS

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
          <Container
            fluid
            style={{
              maxWidth: "100%",
              paddingLeft: "0.5rem",
              paddingRight: "0.5rem",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="mb-0 text-dark fw-semibold">
                Make Your Own Package Bookings
              </h5>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={fetchList}
                disabled={loading}
                style={{ fontSize: "0.78rem" }}
              >
                <FaSync className={`me-1 ${loading ? "fa-spin" : ""}`} style={{ fontSize: "0.7rem" }} />
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
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
                {/* Status pills with counts (wraps to a second row on narrow screens) */}
                <div
                  className="d-flex flex-wrap p-1 rounded mb-3"
                  style={{ backgroundColor: "#f3f4f6", gap: "2px" }}
                >
                  {STATUS_TABS.map((t) => {
                    const active = status === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setStatus(t.key)}
                        className="border-0 d-inline-flex align-items-center gap-2 px-3 py-1"
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
                        {t.label}
                        <span
                          style={{
                            backgroundColor: active ? "#eff6ff" : "#e4e7ec",
                            color: active ? "#1d4ed8" : "#667085",
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            padding: "1px 7px",
                            borderRadius: "10px",
                            lineHeight: 1.4,
                          }}
                        >
                          {tabCounts[t.key] || 0}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search */}
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
                      placeholder="Search by code, customer, agent..."
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
                        <th>Customer</th>
                        <th>Agent</th>
                        <th>Tour Date</th>
                        <th className="text-end">Total</th>
                        <th>Status</th>
                        <th className="text-center" style={{ width: "70px" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && (
                        <tr>
                          <td colSpan={8} className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-2 text-muted mb-0">Loading bookings...</p>
                          </td>
                        </tr>
                      )}
                      {!loading && filtered.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-5 text-muted">
                            No bookings found
                          </td>
                        </tr>
                      )}
                      {!loading &&
                        filtered.map((b, i) => (
                          <tr key={b.id}>
                            <td className="text-muted">{i + 1}</td>
                            <td>
                              <span
                                className="fw-semibold"
                                style={{ color: "#1d4ed8" }}
                              >
                                {b.bookingCode || "-"}
                              </span>
                            </td>
                            <td>
                              <div className="fw-medium text-dark">
                                {[
                                  b.salutation,
                                  b.customerFirstName,
                                  b.customerLastName,
                                ]
                                  .filter(Boolean)
                                  .join(" ") || "—"}
                              </div>
                              <div className="text-muted" style={{ fontSize: "0.7rem", lineHeight: 1.4 }}>
                                {b.customerEmail || ""}
                                {b.customerEmail && b.customerPhone ? " · " : ""}
                                {b.customerPhone || ""}
                              </div>
                            </td>
                            <td>{b.agentName || "—"}</td>
                            <td style={{ whiteSpace: "nowrap" }}>{b.tourDate || "—"}</td>
                            <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                              <span className="fw-semibold text-dark">
                                ₹ {Number(b.totalPrice || 0).toLocaleString()}
                              </span>
                            </td>
                            <td>
                              {b.isCancelled
                                ? renderStatusPill("Cancelled")
                                : renderStatusPill(b.bookingStatus || "Confirmed")}
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
                                    `/booking-details/make-your-own-package-v2/${b.id}`,
                                    { state: { booking: b } },
                                  )
                                }
                                title="View details"
                              >
                                <FaEye style={{ fontSize: "12px" }} />
                              </button>
                            </td>
                          </tr>
                        ))}
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

                <div className="d-flex justify-content-between align-items-center mt-3">
                  <span className="small text-muted">
                    Showing {filtered.length} of {rows.length} bookings
                  </span>
                </div>
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>

    </div>
  );
};

export default MakeYourOwnPackageV2BookingList;
