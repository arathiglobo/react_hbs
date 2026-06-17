/**
 * SeniorCitizenBookingList.jsx
 *
 * Lists senior-citizen bookings for the current agent / admin.
 * Actions: View, Voucher (PDF), Cancel.
 *
 * Endpoints:
 *   GET    /api/senior-citizen-booking/list?agentId=&page=&size=
 *   GET    /api/senior-citizen-booking/{id}/voucher    (PDF blob)
 *   DELETE /api/senior-citizen-booking/{id}?reason=...
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Table,
  Spinner,
  Form,
  Container,
  InputGroup,
  Pagination,
  Badge,
  Modal,
} from "react-bootstrap";
import { FaEye, FaSearch, FaUser, FaUsers } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const STATUS_META = {
  CONFIRMED:  { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  Confirmed:  { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  Cancelled:  { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
  CANCELLED:  { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
  PENDING:    { label: "Pending",   bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  COMPLETED:  { label: "Completed", bg: "#eff8ff", color: "#175cd3", dot: "#3b82f6" },
};

const REFUND_META = {
  REFUNDABLE:      { label: "Refundable",     bg: "#e7f6ec", color: "#1b7f3a" },
  "Non-Refundable":{ label: "Non-Refundable", bg: "#f3f4f6", color: "#475467" },
  NON_REFUNDABLE:  { label: "Non-Refundable", bg: "#f3f4f6", color: "#475467" },
  REFUNDED:        { label: "Refunded",       bg: "#eff8ff", color: "#175cd3" },
};

// Every customer/guest name on a booking. The backend now sends a
// `guestNames` array (collected across all room bookings); fall back to
// the single `customerName` for older payload shapes.
const getGuestNames = (booking) => {
  if (Array.isArray(booking?.guestNames) && booking.guestNames.length > 0) {
    return booking.guestNames.filter((n) => String(n ?? "").trim());
  }
  return booking?.customerName ? [booking.customerName] : [];
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

export default function SeniorCitizenBookingList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [agentId, setAgentId] = useState("");
  const [search, setSearch] = useState("");
  // Booking-type filter: upcoming / completed / cancelled. Filtered
  // client-side against the row's cancelled flag + checkOutDate so we
  // don't need a new backend endpoint.
  const [bookingType, setBookingType] = useState("upcoming");
  const [role, setRole] = useState(
    (localStorage.getItem("currentActiveRole") || "").toLowerCase(),
  );
  // "Customers (N)" modal — opened from the "+N more" badge on the
  // Customer column to show every guest on a booking.
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
        `/api/senior-citizen-booking/list?${params.toString()}`,
      );
      setRows(data?.content || data || []);
      setTotalPages(data?.totalPages || 0);
    } catch (e) {
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchPage(); /* eslint-disable-next-line */
  }, [page, size, agentId]);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const byType = rows.filter((r) => {
      if (bookingType === "cancelled") return !!r.cancelled;
      if (r.cancelled) return false;
      const ref = r.checkOutDate || r.checkInDate;
      const refDate = ref ? new Date(ref) : null;
      if (!refDate || isNaN(refDate.getTime())) {
        return bookingType === "upcoming";
      }
      refDate.setHours(0, 0, 0, 0);
      if (bookingType === "completed") return refDate < today;
      return refDate >= today;
    });
    if (!search.trim()) return byType;
    const q = search.toLowerCase();
    return byType.filter(
      (r) =>
        (r.bookingCode || "").toLowerCase().includes(q) ||
        (r.customerName || "").toLowerCase().includes(q) ||
        getGuestNames(r).some((n) => n.toLowerCase().includes(q)) ||
        (r.hotelName || "").toLowerCase().includes(q),
    );
  }, [rows, search, bookingType]);

  const totalElements =
    rows.length === 0
      ? 0
      : totalPages > 1
        ? totalPages * size
        : filtered.length;
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
              <h5 className="mb-0 text-dark fw-semibold">Senior Citizen Booking</h5>
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
                      { value: "upcoming", label: "Upcoming" },
                      { value: "completed", label: "Completed" },
                      { value: "cancelled", label: "Cancelled" },
                    ].map((opt) => {
                      const active = bookingType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setBookingType(opt.value);
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
                            <th>Hotel</th>
                            <th>Stay</th>
                            <th>Adult Ages</th>
                            <th className="text-end">Amount</th>
                            <th>Status</th>
                            <th>Refund</th>
                            <th className="text-center" style={{ width: "80px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length > 0 ? (
                            filtered.map((r, i) => {
                              const ages = [];
                              (r.rooms || []).forEach((rm) => {
                                if (Array.isArray(rm.adultAges))
                                  ages.push(...rm.adultAges);
                              });
                              const statusText = r.cancelled
                                ? "Cancelled"
                                : r.roomStatus || r.confirmationStatus || "CONFIRMED";
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
                                  {/* Customer — a booking can hold many
                                      guests. Show the first prominently; the
                                      rest sit behind a "+N more" badge that
                                      opens the Customers modal. */}
                                  <td>
                                    {(() => {
                                      const names = getGuestNames(r);
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
                                              onClick={() => handleShowCustomers(r)}
                                              onKeyDown={(e) => {
                                                if (
                                                  e.key === "Enter" ||
                                                  e.key === " "
                                                ) {
                                                  e.preventDefault();
                                                  handleShowCustomers(r);
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
                                  <td>{r.hotelName || "-"}</td>
                                  <td style={{ whiteSpace: "nowrap" }}>
                                    <div>{fmtDate(r.checkInDate)}</div>
                                    <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                      → {fmtDate(r.checkOutDate)}
                                    </div>
                                  </td>
                                  <td>
                                    {ages.length ? (
                                      <div className="d-flex flex-wrap gap-1">
                                        {ages.map((age, idx) => (
                                          <span
                                            key={idx}
                                            className="px-2 py-1 rounded"
                                            style={{
                                              backgroundColor: "#f3f4f6",
                                              color: "#475467",
                                              fontSize: "0.7rem",
                                              fontWeight: 500,
                                            }}
                                          >
                                            {age}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-muted">-</span>
                                    )}
                                  </td>
                                  <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                                    <span className="fw-semibold text-dark">
                                      {r.displayCurrencyCode &&
                                      r.displayCurrencyCode !== "AED" &&
                                      Number(r.displayAmount) > 0
                                        ? `${r.displayCurrencyCode} ${Number(r.displayAmount).toFixed(2)}`
                                        : r.totalRate != null
                                          ? `AED ${r.totalRate}`
                                          : "-"}
                                    </span>
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
                                          `/booking-details/senior-citizen-booking/${r.bookingId}`,
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
