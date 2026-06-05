/**
 * RestaurantBookingList.jsx
 *
 * Booking-list page for restaurant bookings. The Action column now
 * contains only the View (eye) icon — clicking it navigates to a
 * dedicated detail page (/booking-details/restaurant-booking/:id)
 * where Edit / Remark / Voucher / Cancel live as buttons at the
 * bottom-left, alongside any reconfirm / date-change flow.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Form,
  Table,
  InputGroup,
  Spinner,
  Pagination,
  Container,
} from "react-bootstrap";
import { FaSearch, FaEye } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

const BOOKING_STATUS_OPTIONS = [
  "Pending Approval",
  "Guarantee Pending",
  "Confirmed",
  "Reconfirmed",
  "Date Change Requested",
  "Checked In",
  "No Show",
  "Completed",
  "Rejected",
  "Cancelled",
  "Auto Cancelled",
];

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_META = {
  "Confirmed":             { label: "Confirmed",   bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  "Checked In":            { label: "Checked In",  bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  "Reconfirmed":           { label: "Reconfirmed", bg: "#eff8ff", color: "#175cd3", dot: "#3b82f6" },
  "Completed":             { label: "Completed",   bg: "#eff8ff", color: "#175cd3", dot: "#3b82f6" },
  "Pending Approval":      { label: "Pending Approval",      bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  "Guarantee Pending":     { label: "Guarantee Pending",     bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  "Date Change Requested": { label: "Date Change Requested", bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  "Pending":               { label: "Pending",               bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  "Cancelled":             { label: "Cancelled",     bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
  "Rejected":              { label: "Rejected",      bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
  "Auto Cancelled":        { label: "Auto Cancelled",bg: "#f3f4f6", color: "#475467", dot: "#98a2b3" },
  "No Show":               { label: "No Show",       bg: "#f3f4f6", color: "#475467", dot: "#98a2b3" },
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
  if (isNaN(d)) return typeof iso === "string" ? iso.slice(0, 10) : "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const RestaurantBookingList = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bookingType, setBookingType] = useState("upcoming");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  // Time Period filter (Month + Year). Empty means "all".
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - 2014 },
    (_, i) => 2020 + i,
  );

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/restaurant/booking/list");
      const data = Array.isArray(res.data) ? res.data : res.data?.content || [];
      setItems(data);
    } catch (e) {
      console.error(e);
      setItems(demoBookings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((b) => {
      const q = search.toLowerCase();
      const matchQ =
        !q ||
        b.bookingNumber?.toLowerCase().includes(q) ||
        b.restaurantName?.toLowerCase().includes(q) ||
        b.customerName?.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "all" || b.bookingStatus === statusFilter;
      const isCancelled = b.bookingStatus === "Cancelled";
      const isCompleted = b.bookingStatus === "Completed";
      let matchType = true;
      if (bookingType === "cancelled") matchType = isCancelled;
      else if (bookingType === "completed") matchType = isCompleted;
      else matchType = !isCancelled && !isCompleted;

      let matchTime = true;
      if (selectedMonth || selectedYear) {
        const normalized = b.bookingDate
          ? String(b.bookingDate).includes("T")
            ? b.bookingDate
            : `${b.bookingDate}T00:00:00`
          : null;
        const d = normalized ? new Date(normalized) : null;
        if (!d || isNaN(d.getTime())) {
          matchTime = false;
        } else {
          if (selectedMonth && d.getMonth() + 1 !== Number(selectedMonth)) {
            matchTime = false;
          }
          if (selectedYear && d.getFullYear() !== Number(selectedYear)) {
            matchTime = false;
          }
        }
      }

      return matchQ && matchStatus && matchType && matchTime;
    });
  }, [items, search, statusFilter, bookingType, selectedMonth, selectedYear]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const pageData = filtered.slice((page - 1) * size, page * size);
  const displayStart = filtered.length === 0 ? 0 : (page - 1) * size + 1;
  const displayEnd = Math.min(filtered.length, page * size);

  const clearTimePeriod = () => {
    setSelectedMonth("");
    setSelectedYear("");
    setPage(1);
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
              <h5 className="mb-0 text-dark fw-semibold">Restaurant Bookings</h5>
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
                {/* Toolbar row 1: Booking-type pills + Time Period */}
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
                          onClick={() => {
                            setBookingType(opt.value);
                            setPage(1);
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
                    <span
                      className="text-uppercase text-muted fw-semibold"
                      style={{ fontSize: "0.68rem", letterSpacing: "0.05em" }}
                    >
                      Time Period
                    </span>
                    <Form.Select
                      size="sm"
                      value={selectedMonth}
                      onChange={(e) => {
                        setSelectedMonth(e.target.value);
                        setPage(1);
                      }}
                      style={{ width: "auto", fontSize: "0.8rem", minWidth: "100px" }}
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m, idx) => (
                        <option key={m} value={idx + 1}>
                          {m.slice(0, 3)}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Select
                      size="sm"
                      value={selectedYear}
                      onChange={(e) => {
                        setSelectedYear(e.target.value);
                        setPage(1);
                      }}
                      style={{ width: "auto", fontSize: "0.8rem", minWidth: "90px" }}
                    >
                      <option value="">Year</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
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

                {/* Toolbar row 2: status select + page size + search */}
                <div
                  className="d-flex flex-wrap justify-content-end align-items-center gap-2"
                  style={{ marginBottom: "1.5rem" }}
                >
                  <Form.Select
                    size="sm"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    style={{ width: "auto", fontSize: "0.8rem" }}
                  >
                    <option value="all">All Statuses</option>
                    {BOOKING_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Select
                    value={size}
                    onChange={(e) => {
                      setSize(Number(e.target.value));
                      setPage(1);
                    }}
                    size="sm"
                    style={{ width: "auto", fontSize: "0.8rem" }}
                  >
                    {PER_PAGE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n} / page
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
                      placeholder="Search bookings..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      style={{ fontSize: "0.8rem", borderLeft: "none" }}
                    />
                  </InputGroup>
                </div>

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
                            <th>Restaurant</th>
                            <th>Date / Time</th>
                            <th className="text-center">Members</th>
                            <th>Customer</th>
                            <th>Status</th>
                            <th className="text-center" style={{ width: "80px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageData.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="text-center py-5 text-muted">
                                No bookings found
                              </td>
                            </tr>
                          ) : (
                            pageData.map((b, i) => {
                              const sMeta = STATUS_META[b.bookingStatus];
                              return (
                                <tr key={b.id || i}>
                                  <td className="text-muted">{(page - 1) * size + i + 1}</td>
                                  <td>
                                    <span className="fw-semibold text-dark">
                                      {b.bookingNumber || "-"}
                                    </span>
                                  </td>
                                  <td>{b.restaurantName || "-"}</td>
                                  <td style={{ whiteSpace: "nowrap" }}>
                                    <div>{fmtDate(b.bookingDate)}</div>
                                    <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                      {b.bookingTime || ""}
                                    </div>
                                  </td>
                                  <td className="text-center">{b.memberCount ?? "-"}</td>
                                  <td>
                                    <div className="fw-medium text-dark">
                                      {b.customerName || "-"}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                      {b.mobile || ""}
                                    </div>
                                  </td>
                                  <td>
                                    <StatusPill meta={sMeta} raw={b.bookingStatus} />
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
                                          `/booking-details/restaurant-booking/${b.id}`,
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

                    <div className="d-flex justify-content-between align-items-center mt-3">
                      <div className="text-muted small">
                        Showing {displayStart} to {displayEnd} of {filtered.length}{" "}
                        entries
                      </div>
                      {totalPages > 1 && (
                        <Pagination size="sm" className="mb-0">
                          <Pagination.Prev
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                          />
                          {Array.from(
                            { length: Math.min(5, totalPages) },
                            (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) pageNum = i + 1;
                              else if (page <= 3) pageNum = i + 1;
                              else if (page >= totalPages - 2)
                                pageNum = totalPages - 4 + i;
                              else pageNum = page - 2 + i;
                              return (
                                <Pagination.Item
                                  key={pageNum}
                                  active={page === pageNum}
                                  onClick={() => setPage(pageNum)}
                                >
                                  {pageNum}
                                </Pagination.Item>
                              );
                            },
                          )}
                          <Pagination.Next
                            disabled={page === totalPages}
                            onClick={() => setPage(page + 1)}
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
};

const demoBookings = [
  {
    id: 101,
    bookingNumber: "RB-2026-0001",
    restaurantName: "Spice Garden",
    bookingDate: "2026-05-15",
    bookingTime: "20:00",
    memberCount: 4,
    customerName: "John Doe",
    mobile: "9876543210",
    agentName: "Travel Plus",
    totalAmount: 1450,
    bookingStatus: "Confirmed",
    specialRequest: "Window seat preferred",
    items: [
      { menuName: "Chicken Biriyani", qty: 2, price: 250, total: 500 },
      { menuName: "Shawarma", qty: 5, price: 180, total: 900 },
    ],
  },
];

export default RestaurantBookingList;
