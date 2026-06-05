/**
 * StudentBookingList.jsx
 *
 * Booking-list page for the student flow (reference:
 * HotelBookingList.jsx). Shows columns:
 *   #, Agent, Customer, Student/Institution, Hotel, Booking Code,
 *   Stay, Before/After totals, Method, Verification Status, Refund,
 *   Actions
 *
 * Actions per row:
 *   - View      → /booking-details/student-booking/:id
 *   - Voucher   → GET /api/student-booking/:id/voucher
 *   - Cancel    → DELETE /api/student-booking/:id (refunds credit for
 *                 refundable bookings)
 *   - Approve / Reject / Re-upload (ADMIN ONLY, only when the booking
 *                 is still PENDING_STUDENT_VERIFICATION or
 *                 REQUEST_REUPLOAD) → POST /api/student-booking-admin/{id}/decision
 *
 * The admin actions live on this page so admins don't need to bounce
 * to a separate verification screen.
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
} from "react-bootstrap";
import { FaEye, FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const METHOD_META = {
  STUDENT_ID_UPLOAD:     { label: "ID Upload" },
  MANUAL_ADMIN_APPROVAL: { label: "Manual" },
  INSTITUTIONAL_EMAIL:   { label: "Email OTP" },
};

const VERIFICATION_META = {
  PENDING_STUDENT_VERIFICATION: { label: "Pending",   bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  APPROVED:                     { label: "Approved",  bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  REJECTED:                     { label: "Rejected",  bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
  REQUEST_REUPLOAD:             { label: "Re-upload", bg: "#eef2ff", color: "#3538cd", dot: "#6366f1" },
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

export default function StudentBookingList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [agentId, setAgentId] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("");
  const [search, setSearch] = useState("");

  const [role, setRole] = useState(
    (localStorage.getItem("currentActiveRole") || "").toLowerCase()
  );

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
      if (verificationStatus) params.append("verificationStatus", verificationStatus);
      const { data } = await axiosInstance.get(`/api/student-booking/list?${params.toString()}`);
      setRows(data?.content || []);
      setTotalPages(data?.totalPages || 0);
    } catch (e) {
      toast.error("Failed to load bookings");
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchPage(); /* eslint-disable-next-line */ }, [page, size, agentId, verificationStatus]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      (r.bookingCode || "").toLowerCase().includes(q) ||
      (r.customerName || "").toLowerCase().includes(q) ||
      (r.hotelName || "").toLowerCase().includes(q) ||
      (r.studentName || "").toLowerCase().includes(q) ||
      (r.institutionName || "").toLowerCase().includes(q) ||
      (r.studentIdNumber || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalElements = rows.length === 0 ? 0 : (totalPages > 1 ? totalPages * size : filtered.length);
  const displayStart = filtered.length === 0 ? 0 : page * size + 1;
  const displayEnd = page * size + filtered.length;

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
              <h5 className="mb-0 text-dark fw-semibold">Student Booking</h5>
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
                {/* Compact toolbar: filter + display + search */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2" style={{ marginBottom: "1.5rem" }}>
                  <div className="d-inline-flex p-1 rounded" style={{ backgroundColor: "#f3f4f6" }}>
                    {[
                      { value: "", label: "All" },
                      { value: "PENDING_STUDENT_VERIFICATION", label: "Pending" },
                      { value: "APPROVED", label: "Approved" },
                      { value: "REJECTED", label: "Rejected" },
                      { value: "REQUEST_REUPLOAD", label: "Re-upload" },
                    ].map((opt) => {
                      const active = verificationStatus === opt.value;
                      return (
                        <button
                          key={opt.value || "all"}
                          type="button"
                          onClick={() => {
                            setVerificationStatus(opt.value);
                            setPage(0);
                          }}
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
                    <Form.Select
                      value={size}
                      onChange={(e) => {
                        setSize(Number(e.target.value));
                        setPage(0);
                      }}
                      size="sm"
                      style={{ width: "auto", fontSize: "0.8rem",height:"49px" }}
                    >
                      {PER_PAGE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option} / page
                        </option>
                      ))}
                    </Form.Select>
                    <InputGroup size="sm" style={{ width: "240px",height:"49px !important"  }}>
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
                      <Table
                        hover
                        className="mb-0 align-middle saas-table"
                      >
                        <thead>
                          <tr>
                            <th style={{ width: "48px" }}>#</th>
                            <th>Booking</th>
                            {role === "admin" && <th>Agent</th>}
                            <th>Customer</th>
                            <th>Student / Institution</th>
                            <th>Hotel</th>
                            <th>Stay</th>
                            <th className="text-end">Amount</th>
                            <th>Method</th>
                            <th>Verification</th>
                            <th>Refund</th>
                            <th className="text-center" style={{ width: "80px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length > 0 ? (
                            filtered.map((r, i) => {
                              const methodLabel =
                                METHOD_META[r.verificationMethod]?.label ||
                                r.verificationMethod ||
                                "-";
                              const vMeta = VERIFICATION_META[r.verificationStatus];
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
                                      {r.studentName || "-"}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                      {r.institutionName}
                                      {r.studentIdNumber ? ` · ${r.studentIdNumber}` : ""}
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
                                      {r.totalRate ?? "-"}
                                    </div>
                                    {r.totalRateBeforeDiscount != null &&
                                      r.totalRateBeforeDiscount !== r.totalRate && (
                                        <div
                                          className="text-muted text-decoration-line-through"
                                          style={{ fontSize: "0.7rem" }}
                                        >
                                          {r.totalRateBeforeDiscount}
                                        </div>
                                      )}
                                  </td>
                                  <td>
                                    <span
                                      className="px-2 py-1 rounded"
                                      style={{
                                        backgroundColor: "#f3f4f6",
                                        color: "#475467",
                                        fontSize: "0.7rem",
                                        fontWeight: 500,
                                      }}
                                    >
                                      {methodLabel}
                                    </span>
                                  </td>
                                  <td>
                                    <StatusPill meta={vMeta} raw={r.verificationStatus} />
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
                                          `/booking-details/student-booking/${r.bookingId}`,
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
                                colSpan={role === "admin" ? 12 : 11}
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
                            onClick={() =>
                              setPage((p) => Math.max(0, p - 1))
                            }
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
