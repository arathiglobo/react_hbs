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
  FaCalendarAlt,
  FaEye,
  FaTicketAlt,
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

const ActivityBookingList = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState(() => {
    return localStorage.getItem("currentActiveRole")?.toLowerCase() || null;
  });
  const [userId, setUserId] = useState(() => {
    const stored = localStorage.getItem("userId");
    return (stored && stored !== "null") ? stored : null;
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("upcoming");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [apiData, setApiData] = useState({
    upcomingBookings: { content: [] },
    completedBookings: { content: [] },
    cancelledBookings: { content: [] },
  });
  const [pagination, setPagination] = useState({
    upcoming: { page: 1, perPage: 10 },
    completed: { page: 1, perPage: 10 },
    cancelled: { page: 1, perPage: 10 },
  });

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2014 }, (_, i) => 2020 + i);
  
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
        upcomingPage: Math.max(pagination.upcoming.page - 1, 0),
        upcomingSize: pagination.upcoming.perPage,
        completedPage: Math.max(pagination.completed.page - 1, 0),
        completedSize: pagination.completed.perPage,
        cancelledPage: Math.max(pagination.cancelled.page - 1, 0),
        cancelledSize: pagination.cancelled.perPage,
      };

      if (selectedMonth && selectedYear) {
        params.month = Number(selectedMonth);
        params.year = Number(selectedYear);
      }

      // Role-based filtering
      if (role === "agent" && userId) {
        params.agentId = userId;
      } else if (role === "staff" && userId) {
        params.staffId = userId;
      }

      const response = await axiosInstance.get("/api/activity/grouped-list", { params });
      if (response.data && response.data.success) {
        setApiData({
          upcomingBookings: response.data.upcomingBookings || { content: [] },
          completedBookings: response.data.completedBookings || { content: [] },
          cancelledBookings: response.data.cancelledBookings || { content: [] },
        });
      }
    } catch {
      toast.error("Failed to load activity bookings");
    } finally {
      setLoading(false);
    }
  }, [pagination, selectedMonth, selectedYear, role, userId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleMonthChange = (value) => {
    setSelectedMonth(value);
    resetAllPages();
  };

  const handleYearChange = (value) => {
    setSelectedYear(value);
    resetAllPages();
  };

  const resetAllPages = () => {
    setPagination((prev) => ({
      upcoming: { ...prev.upcoming, page: 1 },
      completed: { ...prev.completed, page: 1 },
      cancelled: { ...prev.cancelled, page: 1 },
    }));
  };

  const handlePageChange = (nextPage) => {
    setPagination((prev) => ({
      ...prev,
      [status]: { ...prev[status], page: nextPage },
    }));
  };

  const handlePageSizeChange = (nextSize) => {
    setPagination((prev) => ({
      ...prev,
      [status]: { ...prev[status], perPage: nextSize, page: 1 },
    }));
  };

  const getCurrentList = () => {
    if (status === "upcoming") return apiData.upcomingBookings.content || [];
    if (status === "completed") return apiData.completedBookings.content || [];
    if (status === "cancelled") return apiData.cancelledBookings.content || [];
    return [];
  };

  const filteredBookings = useMemo(() => {
    const list = getCurrentList();
    if (!search.trim()) return list;
    return list.filter(
      (b) =>
        b.packageBookCode?.toLowerCase().includes(search.toLowerCase()) ||
        b.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        b.lastName?.toLowerCase().includes(search.toLowerCase()) ||
        b.activityName?.toLowerCase().includes(search.toLowerCase())
    );
  }, [apiData, status, search]);

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
    }).format(price || 0);

  const formatDate = (date) => {
    if (!date) return "-";
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return date;
    }
  };

  const currentTabPagination = apiData[`${status}Bookings`] || {};
  const totalPages = currentTabPagination.totalPages || 0;
  const totalElements = currentTabPagination.totalElements || 0;
  const currentPage = pagination[status].page;
  const currentPerPage = pagination[status].perPage;

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
                <FaTicketAlt className="me-2 text-muted" />
                Activity Bookings
              </h5>
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
                {/* Toolbar row 1: pills with counts + Time Period */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <div className="d-inline-flex p-1 rounded" style={{ backgroundColor: "#f3f4f6" }}>
                    {[
                      { value: "upcoming",  label: "Upcoming",  count: apiData.upcomingBookings?.totalElements ?? 0 },
                      { value: "completed", label: "Completed", count: apiData.completedBookings?.totalElements ?? 0 },
                      { value: "cancelled", label: "Cancelled", count: apiData.cancelledBookings?.totalElements ?? 0 },
                    ].map((opt) => {
                      const active = status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStatus(opt.value)}
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
                          {opt.label}
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
                            {opt.count}
                          </span>
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
                      onChange={(e) => handleMonthChange(e.target.value)}
                      style={{ width: "auto", fontSize: "0.8rem", minWidth: "100px" }}
                    >
                      <option value="">Month</option>
                      {months.map((m, idx) => (
                        <option key={m} value={idx + 1}>
                          {m.slice(0, 3)}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Select
                      size="sm"
                      value={selectedYear}
                      onChange={(e) => handleYearChange(e.target.value)}
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
                        onClick={() => {
                          setSelectedMonth("");
                          setSelectedYear("");
                          resetAllPages();
                        }}
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
                    value={currentPerPage}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    size="sm"
                    style={{ width: "auto", fontSize: "0.8rem" }}
                  >
                    {PER_PAGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt} / page</option>
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
                      placeholder="Search by booking code or name..."
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
                        {role === "admin" && <th>Agent</th>}
                        <th>Booking</th>
                        <th>Customer</th>
                        <th>Activity</th>
                        <th>Tour Date</th>
                        <th className="text-center">Pax</th>
                        <th className="text-end">Amount</th>
                        <th className="text-center" style={{ width: "70px" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={role === "admin" ? 8 : 7} className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-2 text-muted mb-0">Loading bookings...</p>
                          </td>
                        </tr>
                      ) : filteredBookings.length === 0 ? (
                        <tr>
                          <td colSpan={role === "admin" ? 8 : 7} className="text-center py-5 text-muted">
                            No bookings found
                          </td>
                        </tr>
                      ) : (
                        filteredBookings.map((b) => (
                          <tr key={b.customBookingId}>
                            {role === "admin" && (
                              <td>
                                <span className="fw-medium text-dark">
                                  {b.agentName || "-"}
                                </span>
                              </td>
                            )}
                            <td>
                              <div className="fw-semibold text-dark">{b.packageBookCode || "-"}</div>
                              <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                {fmtDateLong(b.bookingDate)}
                              </div>
                            </td>
                            <td>
                              <div className="fw-medium text-dark">
                                {[b.salutation, b.firstName, b.lastName].filter(Boolean).join(" ") || "-"}
                              </div>
                              <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                {b.emailId || ""}
                              </div>
                            </td>
                            <td>
                              <div className="fw-medium text-dark">{b.activityName || "-"}</div>
                              {b.customBookingItinearyDTO?.length > 0 && (
                                <ul
                                  className="list-unstyled mb-0 mt-1"
                                  style={{ fontSize: "0.7rem", color: "#667085" }}
                                >
                                  {b.customBookingItinearyDTO.map((it, idx) => (
                                    <li key={idx}>• {it.itinerary}</li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              <div className="d-flex align-items-center gap-1">
                                <FaCalendarAlt style={{ fontSize: "0.7rem", color: "#98a2b3" }} />
                                <span>{fmtDateLong(b.tourDate)}</span>
                              </div>
                            </td>
                            <td className="text-center">
                              <span
                                className="px-2 py-1 rounded"
                                style={{
                                  backgroundColor: "#eff8ff",
                                  color: "#175cd3",
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                }}
                              >
                                {b.noOfAdult || 0}A / {b.noOfChild || 0}C
                              </span>
                            </td>
                            <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                              <span className="fw-semibold text-dark">
                                {formatPrice(b.totalPrice)}
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
                                    `/booking-details/activity-booking/${b.customBookingId}`,
                                    { state: { booking: b, status } },
                                  )
                                }
                                title="View details"
                              >
                                <FaEye style={{ fontSize: "12px" }} />
                              </button>
                            </td>
                          </tr>
                        ))
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
                {!loading && totalElements > 0 && (
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <span className="small text-muted">
                      Showing {filteredBookings.length} of {totalElements} entries
                    </span>
                    <Pagination size="sm" className="mb-0">
                      <Pagination.Prev
                        disabled={currentPage === 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                      />
                      {[...Array(totalPages)].map((_, idx) => (
                        <Pagination.Item
                          key={idx + 1}
                          active={idx + 1 === currentPage}
                          onClick={() => handlePageChange(idx + 1)}
                        >
                          {idx + 1}
                        </Pagination.Item>
                      )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
                      <Pagination.Next
                        disabled={currentPage === totalPages}
                        onClick={() => handlePageChange(currentPage + 1)}
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

export default ActivityBookingList;