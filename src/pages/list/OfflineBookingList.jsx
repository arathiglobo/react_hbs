/**
 * OfflineBookingList.jsx
 *
 * Booking-list page for offline bookings. The Action column now contains
 * only the View (eye) icon — clicking it navigates to a dedicated detail
 * page (/booking-details/offline-booking/:id) where Voucher / Invoice /
 * Tax live as buttons at the bottom-left.
 *
 * Filters (mirrors HotelBookingList):
 *   - Booking Types pills (Upcoming / Completed / Cancelled) → backend
 *     `status` query param.
 *   - Time Period (Month + Year) → backend `month` / `year`.
 * Backend interprets UPCOMING as checkOut ≥ today, COMPLETED as
 * checkOut < today, CANCELLED as soft-deleted rows.
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  Container,
  Card,
  Form,
  Table,
  InputGroup,
  Spinner,
  Pagination,
} from "react-bootstrap";
import { FaSearch, FaEye } from "react-icons/fa";
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

const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return typeof iso === "string" ? iso.slice(0, 10) : "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const OfflineBookingList = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [role, setRole] = useState(() => {
    return localStorage.getItem("currentActiveRole")?.toLowerCase() || null;
  });
  const [userId, setUserId] = useState(() => {
    const stored = localStorage.getItem("userId");
    return stored && stored !== "null" ? stored : null;
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [bookingType, setBookingType] = useState("upcoming");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - 2014 },
    (_, i) => 2020 + i,
  );

  // Role sync if missing from localStorage initially
  useEffect(() => {
    const storedRole = localStorage
      .getItem("currentActiveRole")
      ?.toLowerCase();
    if (storedRole && storedRole !== role) {
      setRole(storedRole);
    } else if (!storedRole) {
      const userRoles = (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .split(",");
      if (userRoles.includes("agent")) setRole("agent");
      else if (userRoles.includes("staff")) setRole("staff");
      else if (userRoles.includes("admin")) setRole("admin");
    }
  }, [role]);

  // Fetch userId if missing
  useEffect(() => {
    const fetchUserId = async () => {
      if (userId && userId !== "null") return;
      const userName =
        localStorage.getItem("UserName") ||
        sessionStorage.getItem("UserName");
      if (!userName) return;
      try {
        const response = await axiosInstance.get(
          `/api/personalProfile/${userName}`,
        );
        if (response.data && response.data.id) {
          const id = String(response.data.id);
          setUserId(id);
          localStorage.setItem("userId", id);
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
      const params = {
        page: page - 1,
        limit: perPage,
        search: search.trim() || undefined,
        status: bookingType ? bookingType.toUpperCase() : undefined,
        month: selectedMonth || undefined,
        year: selectedYear || undefined,
      };

      if (role === "agent" && userId) {
        params.agentId = userId;
      } else if (role === "staff" && userId) {
        params.agentId = userId;
      }

      const response = await axiosInstance.get(
        "api/v1/offline-booking/all-list",
        { params },
      );

      if (response.data) {
        const data = response.data.content || response.data;
        setBookings(Array.isArray(data) ? data : []);
        setTotalElements(
          response.data.totalElements || (data.length || 0),
        );
        setTotalPages(
          response.data.totalPages || Math.ceil((data.length || 0) / perPage),
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

  const handlePageChange = (newPage) => setPage(newPage);

  const clearTimePeriod = () => {
    setSelectedMonth("");
    setSelectedYear("");
    setPage(1);
  };

  const colCount = role === "admin" ? 7 : 6;

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
              <h5 className="mb-0 text-dark fw-semibold">Offline Bookings</h5>
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

                {/* Toolbar row 2: page size + search */}
                <div
                  className="d-flex flex-wrap justify-content-end align-items-center gap-2"
                  style={{ marginBottom: "1.5rem" }}
                >
                  <Form.Select
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(parseInt(e.target.value, 10));
                      setPage(1);
                    }}
                    size="sm"
                    style={{ width: "auto", fontSize: "0.8rem" }}
                  >
                    {PER_PAGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt} / page
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

                {/* Table */}
                <div className="table-responsive saas-table-wrap">
                  <Table hover className="mb-0 align-middle saas-table">
                    <thead>
                      <tr>
                        <th style={{ width: "48px" }}>#</th>
                        <th>Booking Date</th>
                        <th>Invoice</th>
                        {role === "admin" && <th>Agent</th>}
                        <th>Booking Details</th>
                        <th className="text-end">Total</th>
                        <th className="text-center" style={{ width: "80px" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={colCount} className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-2 text-muted mb-0">
                              Loading bookings...
                            </p>
                          </td>
                        </tr>
                      ) : bookings.length > 0 ? (
                        bookings.map((booking, idx) => (
                          <tr key={booking.id || idx}>
                            <td className="text-muted">
                              {(page - 1) * perPage + idx + 1}
                            </td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {fmtDate(booking.bookingDate || booking.createdAt)}
                            </td>
                            <td>
                              <span
                                className="font-monospace fw-semibold"
                                style={{ color: "#1d4ed8", fontSize: "0.78rem" }}
                              >
                                {booking.invoiceNumber || "-"}
                              </span>
                            </td>
                            {role === "admin" && (
                              <td>{booking.agentName || "Direct Client"}</td>
                            )}
                            <td>
                              <div className="fw-medium text-dark">
                                {booking.customerName || "-"}
                              </div>
                              <div
                                className="text-muted"
                                style={{ fontSize: "0.7rem", lineHeight: 1.5 }}
                              >
                                {fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)}
                                <br />
                                {booking.adult || 0} adult{(booking.adult || 0) === 1 ? "" : "s"}
                                {booking.child
                                  ? `, ${booking.child} child${booking.child === 1 ? "" : "ren"}`
                                  : ""}
                              </div>
                            </td>
                            <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                              <span className="fw-semibold text-dark">
                                {booking.totalAmount ||
                                  booking.grandTotal ||
                                  "0.00"}
                              </span>
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
                                    `/booking-details/offline-booking/${booking.supplierMainBasicId}`,
                                    { state: { booking } },
                                  )
                                }
                                title="View details"
                              >
                                <FaEye style={{ fontSize: "12px" }} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={colCount}
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

                {totalPages > 1 && (
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <div className="text-muted small">
                      Showing {(page - 1) * perPage + 1} to{" "}
                      {Math.min(page * perPage, totalElements)} of{" "}
                      {totalElements} entries
                    </div>
                    <Pagination size="sm" className="mb-0">
                      <Pagination.Prev
                        disabled={page === 1}
                        onClick={() => handlePageChange(page - 1)}
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
                              active={pageNum === page}
                              onClick={() => handlePageChange(pageNum)}
                            >
                              {pageNum}
                            </Pagination.Item>
                          );
                        },
                      )}
                      <Pagination.Next
                        disabled={page === totalPages}
                        onClick={() => handlePageChange(page + 1)}
                      />
                    </Pagination>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default OfflineBookingList;
