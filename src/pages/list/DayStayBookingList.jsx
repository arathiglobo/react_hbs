import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Table,
  Spinner,
  Form,
  Pagination,
  Container,
  InputGroup,
} from "react-bootstrap";
import { FaEye, FaSearch } from "react-icons/fa";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const STATUS_META = {
  CONFIRMED: { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  Confirmed: { label: "Confirmed", bg: "#e7f6ec", color: "#1b7f3a", dot: "#22c55e" },
  COMPLETED: { label: "Completed", bg: "#eff8ff", color: "#175cd3", dot: "#3b82f6" },
  PENDING:   { label: "Pending",   bg: "#fff7e6", color: "#b76e00", dot: "#f59e0b" },
  Cancelled: { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
  CANCELLED: { label: "Cancelled", bg: "#fdecec", color: "#b42318", dot: "#ef4444" },
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

const fmtDateLong = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return typeof iso === "string" ? iso.slice(0, 10) : "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

/**
 * DayStayBookingList — mirrors HotelBookingList for the Day Stay flow.
 * Action column is the eye icon only; it navigates to
 * /booking-details/day-stay-booking/:id where Voucher (GET .../voucher)
 * and Cancel (POST .../cancel with reason) live as buttons at the
 * bottom-left of the detail view.
 */
export default function DayStayBookingList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [bookingType, setBookingType] = useState("upcoming");

  const fetchRows = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/api/day-stay-booking");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to load Day Stay bookings");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const byType = rows.filter((r) => {
      if (bookingType === "cancelled") return !!r.isCancelled;
      if (r.isCancelled) return false;
      const ref = r.checkInDate;
      const refDate = ref ? new Date(ref) : null;
      if (refDate && !isNaN(refDate.getTime())) {
        refDate.setHours(0, 0, 0, 0);
        if (bookingType === "completed") return refDate < today;
        if (bookingType === "upcoming") return refDate >= today;
      }
      return bookingType === "upcoming";
    });
    const q = (search || "").trim().toLowerCase();
    if (!q) return byType;
    return byType.filter(
      (r) =>
        (r.bookingCode || "").toLowerCase().includes(q) ||
        (r.hotelName || "").toLowerCase().includes(q) ||
        (r.primaryGuest?.firstName || "").toLowerCase().includes(q) ||
        (r.primaryGuest?.lastName || "").toLowerCase().includes(q),
    );
  }, [rows, search, bookingType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, totalPages - 1);
  const pageData = filtered.slice(safePage * size, (safePage + 1) * size);
  const displayStart = filtered.length === 0 ? 0 : safePage * size + 1;
  const displayEnd = Math.min(filtered.length, (safePage + 1) * size);

  useEffect(() => {
    setPage(0);
  }, [search, bookingType]);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
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
              <h5 className="mb-0 text-dark fw-semibold">Day Stay Booking</h5>
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
                {/* Toolbar: pills + page size + search */}
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
                            <th>Hotel</th>
                            <th>Guest</th>
                            <th>Date / Time</th>
                            <th className="text-center">Rooms</th>
                            <th className="text-end">Total</th>
                            <th>Status</th>
                            <th className="text-center" style={{ width: "70px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageData.length > 0 ? (
                            pageData.map((r, i) => {
                              const statusText = r.isCancelled ? "Cancelled" : (r.status || "");
                              const sMeta = STATUS_META[statusText];
                              return (
                                <tr key={r.id}>
                                  <td className="text-muted">{safePage * size + i + 1}</td>
                                  <td>
                                    <span className="fw-semibold text-dark">
                                      {r.bookingCode || "-"}
                                    </span>
                                  </td>
                                  <td>{r.hotelName || "-"}</td>
                                  <td>
                                    <span className="fw-medium text-dark">
                                      {r.primaryGuest
                                        ? `${r.primaryGuest.salutation || ""} ${
                                            r.primaryGuest.firstName || ""
                                          } ${r.primaryGuest.lastName || ""}`.trim()
                                        : "-"}
                                    </span>
                                  </td>
                                  <td style={{ whiteSpace: "nowrap" }}>
                                    <div>{fmtDateLong(r.checkInDate)}</div>
                                    <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                      {(r.checkInTime || "").slice(0, 5)} – {(r.checkOutTime || "").slice(0, 5)}
                                    </div>
                                  </td>
                                  <td className="text-center">{r.noOfRooms || 1}</td>
                                  <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                                    <span className="fw-semibold text-dark">
                                      {r.totalAmount != null
                                        ? `AED ${Number(r.totalAmount).toFixed(2)}`
                                        : "—"}
                                    </span>
                                  </td>
                                  <td>
                                    <StatusPill meta={sMeta} raw={statusText} />
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
                                          `/booking-details/day-stay-booking/${r.id}`,
                                          { state: { booking: r } },
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
                              <td colSpan={9} className="text-center py-5 text-muted">
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
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
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
