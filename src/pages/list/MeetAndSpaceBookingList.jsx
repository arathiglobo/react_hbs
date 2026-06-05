/**
 * MeetAndSpaceBookingList.jsx
 *
 * Booking-list page for the Meet & Space feature. Visual shell
 * mirrors SeniorCitizenBookingList. The Action column now contains
 * only the View (eye) icon — clicking it navigates to a dedicated
 * detail page (/booking-details/meet-and-space-booking/:id) where
 * Edit / Voucher / Cancel live as buttons at the bottom-left.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Card,
  Table,
  Spinner,
  Form,
  InputGroup,
  Pagination,
} from "react-bootstrap";
import { FaEye, FaSearch } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

// Map the local "bookingType" radio value to the backend's
// bookingStatus column so the filter row stays in sync with what the
// data actually holds.
const BOOKING_TYPE_TO_STATUS = {
  upcoming: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
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

const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return typeof iso === "string" ? iso.slice(0, 10) : "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export default function MeetAndSpaceBookingList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingType, setBookingType] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  const fetchList = async () => {
    setLoading(true);
    try {
      const mapped = BOOKING_TYPE_TO_STATUS[bookingType];
      const url = mapped
        ? `/api/meet-and-space/booking/list?status=${encodeURIComponent(mapped)}`
        : "/api/meet-and-space/booking/list";
      const res = await axiosInstance.get(url);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Load bookings failed", e);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line
  }, [bookingType]);

  // Free-text search over the already-fetched page.
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const hay = [
        r.bookingNumber,
        r.meetingSpaceName,
        r.hotelName,
        r.customer
          ? `${r.customer.firstName || ""} ${r.customer.lastName || ""}`.trim()
          : "",
        r.customer?.mobile,
        r.customer?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, search]);

  // Reset paging when filters change.
  useEffect(() => {
    setPage(0);
  }, [search, bookingType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, totalPages - 1);
  const displayStart = filtered.length === 0 ? 0 : safePage * size + 1;
  const displayEnd = Math.min(filtered.length, (safePage + 1) * size);
  const paginated = filtered.slice(safePage * size, (safePage + 1) * size);

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
              <h5 className="mb-0 text-dark fw-semibold">Meet &amp; Space Bookings</h5>
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
                {/* Compact toolbar: filter pills + page size + search */}
                <div
                  className="d-flex flex-wrap justify-content-between align-items-center gap-2"
                  style={{ marginBottom: "1.5rem" }}
                >
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
                            <th>Space / Hotel</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th className="text-center">Attendees</th>
                            <th className="text-end">Total</th>
                            <th>Status</th>
                            <th className="text-center" style={{ width: "80px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginated.length > 0 ? (
                            paginated.map((r, i) => {
                              const sMeta = STATUS_META[r.bookingStatus];
                              const customerName = r.customer
                                ? `${r.customer.firstName || ""} ${r.customer.lastName || ""}`.trim()
                                : "";
                              return (
                                <tr key={r.id}>
                                  <td className="text-muted">{safePage * size + i + 1}</td>
                                  <td>
                                    <span className="fw-semibold text-dark">
                                      {r.bookingNumber || "-"}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="fw-medium text-dark">
                                      {r.meetingSpaceName || "-"}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                      {r.hotelName || ""}
                                    </div>
                                  </td>
                                  <td>
                                    <div className="fw-medium text-dark">
                                      {customerName || "—"}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                      {r.customer?.mobile || ""}
                                    </div>
                                  </td>
                                  <td style={{ whiteSpace: "nowrap" }}>
                                    {fmtDate(r.bookingDate)}
                                  </td>
                                  <td style={{ whiteSpace: "nowrap" }}>
                                    <div>
                                      {r.startTime || "-"} – {r.endTime || "-"}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                      {r.durationHours != null ? `${r.durationHours}h` : ""}
                                    </div>
                                  </td>
                                  <td className="text-center">
                                    {r.attendees ?? "—"}
                                  </td>
                                  <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                                    <span className="fw-semibold text-dark">
                                      {r.currency || "INR"}{" "}
                                      {Number(r.totalAmount || 0).toFixed(2)}
                                    </span>
                                  </td>
                                  <td>
                                    <StatusPill meta={sMeta} raw={r.bookingStatus} />
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
                                          `/booking-details/meet-and-space-booking/${r.id}`,
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
                                colSpan={10}
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
                        Showing {displayStart} to {displayEnd} of{" "}
                        {filtered.length} entries
                      </div>
                      {totalPages > 1 && (
                        <Pagination className="mb-0">
                          <Pagination.Prev
                            disabled={safePage === 0}
                            onClick={() =>
                              setPage((p) => Math.max(0, p - 1))
                            }
                          />
                          {Array.from(
                            { length: Math.min(5, totalPages) },
                            (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) pageNum = i;
                              else if (safePage <= 2) pageNum = i;
                              else if (safePage >= totalPages - 3)
                                pageNum = totalPages - 5 + i;
                              else pageNum = safePage - 2 + i;
                              return (
                                <Pagination.Item
                                  key={pageNum}
                                  active={pageNum === safePage}
                                  onClick={() => setPage(pageNum)}
                                >
                                  {pageNum + 1}
                                </Pagination.Item>
                              );
                            },
                          )}
                          <Pagination.Next
                            disabled={safePage + 1 >= totalPages}
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
