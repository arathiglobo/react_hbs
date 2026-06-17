import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Form,
  Table,
  InputGroup,
  Spinner,
  Pagination,
} from "react-bootstrap";
import {
  FaSearch,
  FaEye,
  FaCalendarAlt,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const fmtDateLong = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return typeof iso === "string" ? iso.slice(0, 10) : "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const PackageBookingList = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [role, setRole] = useState(() => {
    return localStorage.getItem("currentActiveRole")?.toLowerCase() || null;
  });
  const [userId, setUserId] = useState(() => {
    const stored = localStorage.getItem("userId");
    return (stored && stored !== "null") ? stored : null;
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [timePeriod, setTimePeriod] = useState("currentMonth");
  const [allBookings, setAllBookings] = useState([]); // Store all bookings for client-side pagination

  // Map status to type parameter
  const getTypeParam = (status) => {
    switch (status) {
      case "upcoming":
        return 1;
      case "completed":
        return 2;
      case "cancelled":
        return 3;
      default:
        return 1;
    }
  };

  // Map time period to time parameter
  const getTimeParam = (timePeriod) => {
    switch (timePeriod) {
      case "currentMonth":
        return 1;
      case "all":
        return 2;
      default:
        return 1;
    }
  };

  // Fetch bookings from API
  const fetchBookings = useCallback(async () => {
    // SECURITY BLOCK:
    // 1. If role is missing, we don't know what to fetch.
    if (!role) {
      console.log("Blocking fetchBookings: role is missing.");
      return;
    }

    // 2. If we are an agent or staff but don't have the ID yet, do NOT call.
    if ((role === "agent" || role === "staff") && (!userId || userId === "null")) {
      console.log("Blocking fetchBookings: role is " + role + " but userId is missing.");
      return;
    }

    try {
      setLoading(true);
      
      const params = {
        page: page - 1,
        limit: perPage
      };

      // Role-based filtering
      if (role === "agent" && userId) {
        params.agentId = userId;
      } else if (role === "staff" && userId) {
        params.staffId = userId;
      }

      // Switch endpoint based on status
      const endpoint = status === "cancelled" 
        ? "/api/v1/package-booking/cancelled" 
        : "/api/v1/package-booking/bookings";
        
      console.log(`Package Booking API Request -> ${endpoint} with params:`, params);
      const response = await axiosInstance.get(endpoint, { params });

      const bookingData = response.data?.content || response.data;
      if (Array.isArray(bookingData)) {
        setAllBookings(bookingData);
      } else {
        setAllBookings([]);
      }
    } catch (error) {
      console.error("Error fetching package bookings:", error);
      toast.error("Failed to load bookings");
      setAllBookings([]);
    } finally {
      setLoading(false);
    }
  }, [status, page, perPage, role, userId]);

  // Handle role sync if it's missing from localStorage initially
  useEffect(() => {
    const storedRole = localStorage.getItem("currentActiveRole")?.toLowerCase();
    if (storedRole && storedRole !== role) {
      setRole(storedRole);
    } else if (!storedRole) {
      // Fallback to userRole if currentActiveRole is missing
      const userRoles = (localStorage.getItem("userRole") || "").toLowerCase().split(",");
      if (userRoles.includes("agent")) setRole("agent");
      else if (userRoles.includes("staff")) setRole("staff");
      else if (userRoles.includes("admin")) setRole("admin");
    }
  }, [role]);

  // Fetch userId if missing
  useEffect(() => {
    const fetchUserId = async () => {
      // Don't fetch if we already have a valid userId
      if (userId && userId !== "null") return;
      
      const userName = localStorage.getItem("UserName") || sessionStorage.getItem("UserName");
      if (!userName) return;

      try {
        const response = await axiosInstance.get(`/api/personalProfile/${userName}`);
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

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Reset to page 1 when filters or perPage change
  useEffect(() => {
    setPage(1);
  }, [status, timePeriod, perPage]);

  // Filter and paginate bookings client-side
  const filteredBookings = useMemo(() => {
    let filtered = allBookings;

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((booking) =>
        String(booking.confirmationCode || "").toLowerCase().includes(searchLower) ||
        String(booking.packageName || "").toLowerCase().includes(searchLower) ||
        String(booking.contactName || "").toLowerCase().includes(searchLower) ||
        (role === "admin" && String(booking.agentName || "").toLowerCase().includes(searchLower))
      );
    }

    return filtered;
  }, [allBookings, search]);

  // Paginate filtered bookings
  const paginatedBookings = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return filteredBookings.slice(startIndex, endIndex);
  }, [filteredBookings, page, perPage]);

  // Calculate pagination totals
  const totalElements = filteredBookings.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / perPage));

  const getStatusBadge = (s) => {
    switch (s?.toLowerCase()) {
      case "confirmed":
      case "completed":
        return "success";
      case "cancelled":
        return "danger";
      case "pending":
      case "upcoming":
        return "warning";
      default:
        return "secondary";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    } catch {
      return dateString;
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const displayStart = paginatedBookings.length > 0 ? (page - 1) * perPage + 1 : 0;
  const displayEnd = Math.min(page * perPage, totalElements);

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
              <h5 className="mb-0 text-dark fw-semibold">Package Booking</h5>
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
                {/* Toolbar row 1: pills + page size + search */}
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
                      const active = status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStatus(opt.value)}
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
                      value={perPage}
                      onChange={(e) => setPerPage(Number(e.target.value))}
                      size="sm"
                      style={{ width: "auto", fontSize: "0.8rem" }}
                    >
                      {PER_PAGE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option} / page
                        </option>
                      ))}
                    </Form.Select>
                    <InputGroup size="sm" style={{ width: "280px" }}>
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
                            <th>Conf Code</th>
                            <th>Package</th>
                            {role === "admin" && <th>Agent</th>}
                            <th>Contact</th>
                            <th>Travel Date</th>
                            <th className="text-end">Total Price</th>
                            <th className="text-center" style={{ width: "70px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedBookings.length > 0 ? (
                            paginatedBookings.map((booking, index) => (
                              <tr key={booking.bookingId || index}>
                                <td className="text-muted">{(page - 1) * perPage + index + 1}</td>
                                <td>
                                  <span
                                    className="fw-semibold"
                                    style={{ color: "#1d4ed8" }}
                                  >
                                    {booking.confirmationCode || "-"}
                                  </span>
                                </td>
                                <td>
                                  <span className="fw-medium text-dark">
                                    {booking.packageName || "-"}
                                  </span>
                                </td>
                                {role === "admin" && (
                                  <td>{booking.agentName || "-"}</td>
                                )}
                                <td>{booking.contactName || "-"}</td>
                                <td style={{ whiteSpace: "nowrap" }}>
                                  <div className="d-flex align-items-center gap-1">
                                    <FaCalendarAlt
                                      style={{ fontSize: "0.7rem", color: "#98a2b3" }}
                                    />
                                    <span>{fmtDateLong(booking.travelDate)}</span>
                                  </div>
                                </td>
                                <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                                  <span className="fw-semibold text-dark">
                                    AED{" "}
                                    {parseFloat(booking.totalPrice || 0).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                    })}
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
                                        `/booking-details/package-booking/${booking.bookingId || booking.id}`,
                                        { state: { booking, status } },
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
                                colSpan={role === "admin" ? 8 : 7}
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
                        Showing {displayStart} to {displayEnd} of {totalElements} entries
                      </div>
                      {totalPages > 1 && (
                        <Pagination className="mb-0">
                          <Pagination.Prev
                            disabled={page === 1}
                            onClick={() => handlePageChange(page - 1)}
                          />
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (page <= 3) {
                              pageNum = i + 1;
                            } else if (page >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = page - 2 + i;
                            }
                            return (
                              <Pagination.Item
                                key={pageNum}
                                active={pageNum === page}
                                onClick={() => handlePageChange(pageNum)}
                              >
                                {pageNum}
                              </Pagination.Item>
                            );
                          })}
                          <Pagination.Next
                            disabled={page === totalPages}
                            onClick={() => handlePageChange(page + 1)}
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

export default PackageBookingList;

