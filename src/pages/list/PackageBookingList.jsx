import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
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
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [allBookings, setAllBookings] = useState([]); // Store all bookings for client-side pagination
  // Server-side pagination metadata. `serverPaginated` is true when the
  // current endpoint returns a Spring Page (i.e. /bookings, /all) so we can
  // trust its totalElements/totalPages and avoid re-slicing client-side.
  // The /cancelled endpoint returns a plain List, so we paginate it locally.
  const [serverPaginated, setServerPaginated] = useState(false);
  const [serverTotalElements, setServerTotalElements] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(0);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2014 }, (_, i) => 2020 + i);

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

      // Time Period filter — backend matches month/year against travelDate.
      if (selectedMonth) params.month = selectedMonth;
      if (selectedYear) params.year = selectedYear;

      // Switch endpoint based on status: "all" hits the dedicated all-statuses
      // endpoint, "cancelled" the cancelled-only list, anything else (upcoming /
      // completed) falls back to the active-bookings endpoint.
      let endpoint;
      if (status === "all") {
        endpoint = "/api/v1/package-booking/all";
      } else if (status === "cancelled") {
        endpoint = "/api/v1/package-booking/cancelled";
      } else {
        endpoint = "/api/v1/package-booking/bookings";
      }

      console.log(`Package Booking API Request -> ${endpoint} with params:`, params);
      const response = await axiosInstance.get(endpoint, { params });

      const data = response.data;
      if (data && Array.isArray(data.content)) {
        // Spring Page response — backend already paginated. Trust its totals
        // and don't re-slice client-side.
        setAllBookings(data.content);
        setServerPaginated(true);
        setServerTotalElements(
          typeof data.totalElements === "number"
            ? data.totalElements
            : data.content.length,
        );
        setServerTotalPages(
          typeof data.totalPages === "number" && data.totalPages > 0
            ? data.totalPages
            : 1,
        );
      } else if (Array.isArray(data)) {
        // Plain list response (e.g. /cancelled). Paginate client-side.
        setAllBookings(data);
        setServerPaginated(false);
        setServerTotalElements(data.length);
        setServerTotalPages(Math.max(1, Math.ceil(data.length / perPage)));
      } else {
        setAllBookings([]);
        setServerPaginated(false);
        setServerTotalElements(0);
        setServerTotalPages(0);
      }
    } catch (error) {
      console.error("Error fetching package bookings:", error);
      toast.error("Failed to load bookings");
      setAllBookings([]);
      setServerPaginated(false);
      setServerTotalElements(0);
      setServerTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [status, page, perPage, role, userId, selectedMonth, selectedYear]);

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
  }, [status, perPage, selectedMonth, selectedYear]);

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

  // Paginate filtered bookings. When the backend already paginated (Page
  // response) skip the local slice — `filteredBookings` is already the
  // current page; slicing again would empty out pages 2+.
  const paginatedBookings = useMemo(() => {
    if (serverPaginated) return filteredBookings;
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return filteredBookings.slice(startIndex, endIndex);
  }, [filteredBookings, page, perPage, serverPaginated]);

  // Pagination totals: prefer server values for Page responses, fall back to
  // the local filtered count for List responses.
  const totalElements = serverPaginated
    ? serverTotalElements
    : filteredBookings.length;
  const totalPages = serverPaginated
    ? Math.max(1, serverTotalPages)
    : Math.max(1, Math.ceil(filteredBookings.length / perPage));

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
            <div className="d-flex justify-content-between align-items-end mb-4">
              <div>
                <h5 className="mb-2 text-dark fw-semibold">Package Booking</h5>
                <InputGroup
                  style={{
                    height: "44px",
                    width: "320px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(17, 19, 24, 0.04)",
                  }}
                >
                  <InputGroup.Text
                    style={{
                      backgroundColor: "#ffffff",
                      borderRight: 0,
                      border: "1.5px solid #E5E5E1",
                      padding: "0 14px",
                    }}
                  >
                    <FaSearch style={{ color: "#9A9A95", width: 14, height: 14 }} />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search here..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      borderLeft: 0,
                      border: "1.5px solid #E5E5E1",
                      backgroundColor: "#ffffff",
                      fontSize: "0.92rem",
                      letterSpacing: "-0.006em",
                      height: "44px",
                      padding: "0.55rem 0.85rem",
                      color: "#15171C",
                    }}
                  />
                </InputGroup>
              </div>
              <Card
                className="shadow-sm border-0"
                style={{ borderRadius: "8px", minWidth: "260px" }}
              >
                <Card.Body className="p-3">
                  <h6
                    className="mb-2 fw-bold text-dark"
                    style={{ fontSize: "0.85rem", letterSpacing: "0.4px" }}
                  >
                    Time Period
                  </h6>
                  <Row className="g-2">
                    <Col xs={6}>
                      <Form.Select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="form-control"
                        size="sm"
                        style={{ fontSize: "0.82rem", height: "45px" }}
                      >
                        <option value="">Month</option>
                        {months.map((month, index) => (
                          <option key={month} value={index + 1}>
                            {month.slice(0, 3)}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col xs={6}>
                      <Form.Select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="form-control"
                        size="sm"
                        style={{ fontSize: "0.82rem", height: "45px" }}
                      >
                        <option value="">Year</option>
                        {years.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </div>

            {/* Booking Type filter card — full-width row above the table. */}
            <Row className="mb-3 g-1">
              <Col xs={12}>
                <Card
                  className="shadow-sm border-0 w-100"
                  style={{ borderRadius: "8px" }}
                >
                  <Card.Body className="p-3">
                    <h6
                      className="mb-2 fw-bold"
                      style={{
                        fontSize: "0.7rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#8A8A85",
                      }}
                    >
                      Booking Type
                    </h6>
                    <Row className="g-2">
                      <Col xs={12} md={6} lg={4} xl={3}>
                        <Form.Select
                          id="package-booking-type"
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          size="sm"
                          aria-label="Booking type filter"
                          style={{ fontSize: "0.85rem", height: "46px" }}
                        >
                          <option value="all">All</option>
                          <option value="upcoming">Upcoming</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </Form.Select>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

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
                  </>
                )}
              </Card.Body>
            </Card>

            {/* Pagination — separate card mirroring the hotel-booking-list footer. */}
            {!loading && filteredBookings.length > 0 && (
              <Card
                className="shadow-sm border-0 mt-3"
                style={{ borderRadius: "8px" }}
              >
                <Card.Body className="py-3">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div
                      className="text-muted"
                      style={{ fontSize: "0.875rem" }}
                    >
                      Showing{" "}
                      <span className="fw-semibold text-dark">{displayStart}</span>{" "}
                      to{" "}
                      <span className="fw-semibold text-dark">{displayEnd}</span>{" "}
                      of{" "}
                      <span className="fw-semibold text-dark">{totalElements}</span>{" "}
                      entries
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span
                        className="text-muted"
                        style={{ fontSize: "0.8rem" }}
                      >
                        Rows per page
                      </span>
                      <Form.Select
                        size="sm"
                        value={perPage}
                        onChange={(e) => setPerPage(Number(e.target.value))}
                        style={{ width: "auto", fontSize: "0.8rem" }}
                      >
                        {PER_PAGE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 1}
                        onClick={() => page > 1 && handlePageChange(page - 1)}
                        style={{
                          cursor: page === 1 ? "not-allowed" : "pointer",
                          opacity: page === 1 ? 0.5 : 1,
                        }}
                      />
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (pageNumber) => (
                          <Pagination.Item
                            key={pageNumber}
                            active={page === pageNumber}
                            onClick={() => handlePageChange(pageNumber)}
                            style={{
                              cursor: "pointer",
                              minWidth: "38px",
                              textAlign: "center",
                            }}
                          >
                            {pageNumber}
                          </Pagination.Item>
                        ),
                      )}
                      <Pagination.Next
                        disabled={page === totalPages}
                        onClick={() =>
                          page < totalPages && handlePageChange(page + 1)
                        }
                        style={{
                          cursor: page === totalPages ? "not-allowed" : "pointer",
                          opacity: page === totalPages ? 0.5 : 1,
                        }}
                      />
                    </Pagination>
                  </div>
                </Card.Body>
              </Card>
            )}
          </Container>
        </main>
      </div>
    </div>
  );
};

export default PackageBookingList;

