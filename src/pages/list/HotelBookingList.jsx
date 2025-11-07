import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Table,
  Badge,
  InputGroup,
  FormCheck,
  Spinner,
  Pagination,
  Modal,
} from "react-bootstrap";
import {
  FaSearch,
  FaEye,
  FaTrash,
  FaInbox,
  FaEnvelope,
  FaPaperPlane,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];
const dashboardTheme = {
  pageWrapper: {
    background: "linear-gradient(180deg, #f5f7fb 0%, #eef2f9 100%)",
    minHeight: "100vh",
  },
  main: {
    width: "100%",
    overflow: "hidden",
    background: "transparent",
  },
  container: {
    maxWidth: "1260px",
  },
  glassCard: {
    background: "rgba(255, 255, 255, 0.92)",
    backdropFilter: "blur(18px)",
    borderRadius: "18px",
    border: "1px solid rgba(255, 255, 255, 0.6)",
  },
  accentPill: {
    background: "#0d6efd",
    color: "#fff",
    borderRadius: "999px",
    padding: "0.5rem 0.95rem",
    fontSize: "0.85rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  badgeChip: {
    background: "rgba(13, 110, 253, 0.08)",
    color: "#0d6efd",
    borderRadius: "12px",
    padding: "0.35rem 0.75rem",
    fontWeight: 600,
    fontSize: "0.75rem",
  },
};

const HotelBookingList = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [pagination, setPagination] = useState({
    upcoming: { page: 1, perPage: 10 },
    completed: { page: 1, perPage: 10 },
    cancelled: { page: 1, perPage: 10 },
  });
  const hasTimeFilter = selectedMonth !== null && selectedYear !== null;
  const statusOptions = useMemo(
    () => [
      { value: "upcoming", label: "Upcoming" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
    ],
    []
  );
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [apiData, setApiData] = useState({
    upcomingBookings: { content: [] },
    completedBookings: { content: [] },
    cancelledBookings: { content: [] },
  });
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null);
  const [loadingBookingId, setLoadingBookingId] = useState(null);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [selectedVoucherType, setSelectedVoucherType] = useState("Request");
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Generate months
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Generate years (2020 to current year + 1)
  const years = useMemo(() => {
    const startYear = 2020;
    const currentYear = new Date().getFullYear();
    const span = currentYear - startYear + 2; // up to current year + 1
    return Array.from({ length: Math.max(span, 1) }, (_, i) => startYear + i);
  }, []);

  // Fetch data from API
  const fetchBookings = useCallback(async () => {
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

      if (hasTimeFilter) {
        params.month = selectedMonth;
        params.year = selectedYear;
      }

      const response = await axiosInstance.get("/api/bookings/list", {
        params,
      });
      console.log("API Response:", response.data);

      if (response.data && response.data.success) {
        setApiData({
          upcomingBookings: response.data.upcomingBookings || { content: [] },
          completedBookings: response.data.completedBookings || { content: [] },
          cancelledBookings: response.data.cancelledBookings || { content: [] },
        });
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination, selectedMonth, selectedYear, hasTimeFilter]);

  const resetAllPages = useCallback(() => {
    setPagination((prev) => {
      if (
        prev.upcoming.page === 1 &&
        prev.completed.page === 1 &&
        prev.cancelled.page === 1
      ) {
        return prev;
      }

      return {
        upcoming: { ...prev.upcoming, page: 1 },
        completed: { ...prev.completed, page: 1 },
        cancelled: { ...prev.cancelled, page: 1 },
      };
    });
  }, []);

  const handlePageChange = useCallback(
    (nextPage) => {
      setPagination((prev) => {
        if (prev[status].page === nextPage) {
          return prev;
        }

        return {
          ...prev,
          [status]: { ...prev[status], page: nextPage },
        };
      });
    },
    [status]
  );

  const handlePageSizeChange = useCallback(
    (nextSize) => {
      setPagination((prev) => {
        if (prev[status].perPage === nextSize && prev[status].page === 1) {
          return prev;
        }

        return {
          ...prev,
          [status]: { ...prev[status], perPage: nextSize, page: 1 },
        };
      });
    },
    [status]
  );

  const handleMonthChange = useCallback(
    (value) => {
      setSelectedMonth(value);
      resetAllPages();
    },
    [resetAllPages]
  );

  const handleYearChange = useCallback(
    (value) => {
      setSelectedYear(value);
      resetAllPages();
    },
    [resetAllPages]
  );

  // Fetch booking details
  const fetchBookingDetails = async (bookingId) => {
    try {
      setLoadingBookingId(bookingId);
      const response = await axiosInstance.get(
        `/api/hotel-booking/details/${bookingId}`
      );
      console.log("Booking Details Response:", response.data);

      if (response.data && response.data.success) {
        setBookingDetails(response.data);
        setShowDetailsModal(true);
      }
    } catch (error) {
      console.error("Error fetching booking details:", error);
      alert("Failed to fetch booking details. Please try again.");
    } finally {
      setLoadingBookingId(null);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Get bookings based on selected status
  useEffect(() => {
    let currentBookings = [];
    let paginationMeta = { totalPages: 0, totalElements: 0 };

    switch (status) {
      case "upcoming":
        currentBookings = apiData.upcomingBookings.content || [];
        paginationMeta.totalPages = apiData.upcomingBookings.totalPages || 0;
        paginationMeta.totalElements = apiData.upcomingBookings.totalElements || 0;
        break;
      case "completed":
        currentBookings = apiData.completedBookings.content || [];
        paginationMeta.totalPages = apiData.completedBookings.totalPages || 0;
        paginationMeta.totalElements = apiData.completedBookings.totalElements || 0;
        break;
      case "cancelled":
        currentBookings = apiData.cancelledBookings.content || [];
        paginationMeta.totalPages = apiData.cancelledBookings.totalPages || 0;
        paginationMeta.totalElements = apiData.cancelledBookings.totalElements || 0;
        break;
      default:
        currentBookings = [];
    }

    setBookings(currentBookings);
    setTotalPages(paginationMeta.totalPages);
    setTotalElements(paginationMeta.totalElements);
  }, [status, apiData]);

  // Filter bookings based on search term
  const filteredBookings = useMemo(() => {
    if (!search.trim()) {
      return bookings;
    }
    return bookings.filter((booking) =>
      String(booking.bookingId).toLowerCase().includes(search.toLowerCase())
    );
  }, [bookings, search]);

  const getStatusBadge = (s) => {
    switch (s?.toLowerCase()) {
      case "confirmed":
      case "completed":
        return "success";
      case "cancelled":
      case "cancelled":
        return "danger";
      case "pending":
      case "upcoming":
        return "warning";
      default:
        return "secondary";
    }
  };

  const currentPaginationState = pagination[status] || { page: 1, perPage: 10 };
  const currentPage = currentPaginationState.page;
  const currentPerPage = currentPaginationState.perPage;
  const totalEntries =
    typeof totalElements === "number" && totalElements >= 0
      ? totalElements
      : bookings.length;
  const serialNumberBase = (currentPage - 1) * currentPerPage;
  const hasResults = filteredBookings.length > 0;
  const computedEnd = serialNumberBase + filteredBookings.length;
  const displayStart = hasResults ? serialNumberBase + 1 : 0;
  const displayEnd = hasResults
    ? totalEntries > 0
      ? Math.min(computedEnd, totalEntries)
      : computedEnd
    : 0;
  const safeTotalPages =
    totalPages && totalPages > 0
      ? totalPages
      : hasResults
      ? Math.max(1, Math.ceil((totalEntries || filteredBookings.length) / currentPerPage))
      : 0;

  const getStatusChipStyle = useCallback(
    (value) => {
      const isActive = status === value;
      return {
        position: "relative",
        borderRadius: "14px",
        padding: "0.65rem 1.2rem",
        border: isActive ? "1px solid #0d6efd" : "1px solid rgba(13,110,253,0.25)",
        background: isActive ? "rgba(13,110,253,0.12)" : "rgba(255,255,255,0.85)",
        color: isActive ? "#0d6efd" : "#4f586a",
        fontWeight: 600,
        fontSize: "0.9rem",
        boxShadow: isActive ? "0 12px 30px rgba(13,110,253,0.18)" : "0 4px 16px rgba(15,23,42,0.08)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.45rem",
      };
    },
    [status]
  );

  const tableHeaderStyle = {
    padding: "0.75rem 1rem",
    fontSize: "0.78rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#49526a",
    borderBottom: "1px solid rgba(15, 30, 60, 0.12)",
    background: "linear-gradient(90deg, rgba(241,244,252,1) 0%, rgba(233,238,250,1) 100%)",
    whiteSpace: "nowrap",
  };

  return (
    <div className="d-flex flex-column" style={dashboardTheme.pageWrapper}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1" style={dashboardTheme.main}>
          <Container
            fluid
            style={dashboardTheme.container}
            className="py-4 py-xl-5 px-3 px-lg-4"
          >
            <Row className="g-4">
            
              <Col xs={12}>
                <Card
                  style={dashboardTheme.glassCard}
                  className="shadow-lg border-0 rounded-4"
                >
                  <Card.Body className="p-3 p-lg-4">
                    <Row className="g-3 align-items-stretch">
                      <Col lg={5} className="d-flex">
                        <div className="w-100 d-flex flex-column gap-2">
                          <span
                            className="text-uppercase text-muted fw-semibold"
                            style={{ letterSpacing: "0.08em", fontSize: "0.75rem" }}
                          >
                            Quick Search
                          </span>
                          <InputGroup className="rounded-4 overflow-hidden shadow-sm">
                            <InputGroup.Text className="bg-white border-0 px-3">
                              <FaSearch style={{ color: "#6c82a3", fontSize: "1rem" }} />
                            </InputGroup.Text>
                            <Form.Control
                              type="text"
                              placeholder="Search by Booking Code..."
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              className="border-0 py-3"
                              style={{ fontSize: "0.95rem", background: "#ffffff" }}
                            />
                          </InputGroup>
                         
                        </div>
                      </Col>
                      <Col lg={7} className="d-flex">
                        <div className="w-100 d-flex flex-column gap-3">
                          <div className="d-flex align-items-center justify-content-between">
                            <span
                              className="text-uppercase text-muted fw-semibold"
                              style={{ letterSpacing: "0.08em", fontSize: "0.75rem" }}
                            >
                              Booking Status
                            </span>
                           
                          </div>
                          <div className="d-flex flex-wrap gap-3">
                            {statusOptions.map((option) => (
                              <label
                                key={option.value}
                                style={getStatusChipStyle(option.value)}
                                className="user-select-none"
                              >
                                <Form.Check
                                  type="radio"
                                  id={`status-${option.value}`}
                                  name="bookingStatus"
                                  value={option.value}
                                  checked={status === option.value}
                                  onChange={() => setStatus(option.value)}
                                  className="d-none"
                                />
                                <span>{option.label}</span>
                                {status === option.value && (
                                  <span
                                    className="badge rounded-pill bg-primary-subtle text-primary fw-semibold"
                                    style={{ fontSize: "0.7rem", letterSpacing: "0.05em" }}
                                  >
                                    Active
                                  </span>
                                )}
                              </label>
                            ))}
                          </div>
                        </div>
                      </Col>
                    </Row>

                    <div className="pt-3 mt-3 border-top">
                      <Row className="g-3 align-items-end">
                        <Col md={4}>
                          <Form.Label className="text-muted fw-semibold" style={{ fontSize: "0.8rem" }}>
                            Month
                          </Form.Label>
                          <Form.Select
                            value={selectedMonth ?? ""}
                            onChange={(e) =>
                              handleMonthChange(
                                e.target.value ? Number(e.target.value) : null
                              )
                            }
                            className="py-3 border-0 shadow-sm rounded-3"
                            style={{ fontSize: "0.9rem", background: "rgba(246,248,252,0.8)" }}
                          >
                            <option value="">Select Month</option>
                            {months.map((month, index) => (
                              <option key={month} value={index + 1}>
                                {month}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>
                        <Col md={4}>
                          <Form.Label className="text-muted fw-semibold" style={{ fontSize: "0.8rem" }}>
                            Year
                          </Form.Label>
                          <Form.Select
                            value={selectedYear ?? ""}
                            onChange={(e) =>
                              handleYearChange(
                                e.target.value ? Number(e.target.value) : null
                              )
                            }
                            className="py-3 border-0 shadow-sm rounded-3"
                            style={{ fontSize: "0.9rem", background: "rgba(246,248,252,0.8)" }}
                          >
                            <option value="">Select Year</option>
                            {years.map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>
                      
                      </Row>
                      {((selectedMonth !== null && selectedYear === null) ||
                        (selectedMonth === null && selectedYear !== null)) && (
                        <div
                          className="mt-3 px-3 py-2 rounded-3"
                          style={{
                            background: "rgba(220,53,69,0.08)",
                            border: "1px solid rgba(220,53,69,0.2)",
                            color: "#b02a37",
                            fontSize: "0.85rem",
                          }}
                        >
                          Select both month and year to apply the time-period filter.
                        </div>
                      )}
                      {hasTimeFilter && (
                        <div
                          className="mt-3 d-inline-flex align-items-center gap-2 px-3 py-2 rounded-pill shadow-sm"
                          style={{
                            background: "rgba(25,135,84,0.12)",
                            color: "#198754",
                            fontWeight: 600,
                            fontSize: "0.8rem",
                          }}
                        >
                          <span>Active Time Filter:</span>
                          <span>
                            {selectedMonth !== null ? months[selectedMonth - 1] : ""} {selectedYear}
                          </span>
                        </div>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              <Col xs={12}>
                <Card
                  style={dashboardTheme.glassCard}
                  className="shadow-lg border-0 rounded-4"
                >
                  <Card.Header className="bg-transparent border-0 px-4 px-lg-5 py-4">
                 
                  </Card.Header>
                  <Card.Body className="p-0" style={{ width: "100%" }}>
                    {loading ? (
                      <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-3 text-muted mb-0">Loading bookings...</p>
                      </div>
                    ) : (
                      <div
                        className="table-responsive"
                        style={{
                          maxHeight: "620px",
                          overflowY: "auto",
                          overflowX: "auto",
                          position: "relative",
                          width: "100%",
                        }}
                      >
                        <Table
                          hover
                          className="mb-0 align-middle"
                          style={{
                            tableLayout: "fixed",
                            width: "100%",
                            minWidth: "1200px",
                            fontSize: "0.9rem",
                            borderCollapse: "separate",
                            borderSpacing: 0,
                          }}
                        >
                          <thead
                            style={{
                              position: "sticky",
                              top: 0,
                              zIndex: 10,
                              boxShadow: "0 6px 18px rgba(15, 23, 42, 0.08)",
                            }}
                          >
                            <tr>
                              <th style={{ ...tableHeaderStyle, textAlign: "center" }}>S.N</th>
                              <th style={tableHeaderStyle}>Agent Name</th>
                              <th style={tableHeaderStyle}>Customer Name</th>
                              <th style={tableHeaderStyle}>Booking Code</th>
                              <th style={tableHeaderStyle}>Reference Code</th>
                              <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Book Date</th>
                              <th style={tableHeaderStyle}>Booking Details</th>
                              <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Deadline Date</th>
                              <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Notification</th>
                              <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredBookings.length === 0 ? (
                              <tr>
                                <td colSpan={10} className="text-center py-5">
                                  <div className="d-flex flex-column align-items-center gap-3 text-muted">
                                    <div
                                      className="d-inline-flex align-items-center justify-content-center rounded-circle"
                                      style={{
                                        width: "68px",
                                        height: "68px",
                                        background: "rgba(148, 163, 184, 0.12)",
                                      }}
                                    >
                                      <FaInbox style={{ fontSize: "1.75rem", color: "#94a3b8" }} />
                                    </div>
                                    <div>
                                      <h5 className="fw-semibold mb-1 text-dark">No bookings found</h5>
                                      <p className="text-muted mb-0">
                                        Adjust filters or broaden your search to locate reservations.
                                      </p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              filteredBookings.map((b, i) => {
                                const formatDate = (dateString) => {
                                  if (!dateString) return "";
                                  const date = new Date(dateString);
                                  const day = String(date.getDate()).padStart(2, "0");
                                  const month = String(date.getMonth() + 1).padStart(2, "0");
                                  const year = date.getFullYear();
                                  return `${day}/${month}/${year}`;
                                };

                                const formatDeadlineDate = (dateString) => {
                                  if (!dateString) return "-";
                                  const datePart = dateString.split("T")[0];
                                  return datePart || "-";
                                };

                                const baseCellStyle = {
                                  padding: "0.9rem 1rem",
                                  fontSize: "0.9rem",
                                  borderBottom: "1px solid rgba(226,232,240,0.6)",
                                  verticalAlign: "middle",
                                  background: "transparent",
                                };

                                return (
                                  <tr
                                    key={b.bookingId}
                                    style={{
                                      backgroundColor:
                                        i % 2 === 0
                                          ? "rgba(255, 255, 255, 0.96)"
                                          : "rgba(243, 246, 255, 0.96)",
                                      transition: "all 0.2s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = "translateY(-1px)";
                                      e.currentTarget.style.boxShadow = "0 14px 28px rgba(15, 23, 42, 0.08)";
                                      e.currentTarget.style.backgroundColor = "rgba(226, 238, 255, 0.95)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = "translateY(0)";
                                      e.currentTarget.style.boxShadow = "none";
                                      e.currentTarget.style.backgroundColor =
                                        i % 2 === 0
                                          ? "rgba(255, 255, 255, 0.96)"
                                          : "rgba(243, 246, 255, 0.96)";
                                    }}
                                  >
                                    <td
                                      className="text-muted fw-semibold"
                                      style={{
                                        ...baseCellStyle,
                                        textAlign: "center",
                                        color: "#6c82a3",
                                      }}
                                    >
                                      {serialNumberBase + i + 1}
                                    </td>
                                    <td style={baseCellStyle}>
                                      <div className="fw-semibold text-dark">{b.agentName}</div>
                                    </td>
                                    <td style={baseCellStyle}>
                                      <div className="fw-semibold text-dark">{b.primaryGuestName || "-"}</div>
                                    </td>
                                    <td style={baseCellStyle}>
                                      <span className="fw-bold text-primary">{b.bookingCode || "-"}</span>
                                    </td>
                                    <td style={baseCellStyle}>
                                      <span className="text-muted small" style={{ fontSize: "0.8rem" }}>
                                        {b.referenceNumber || "-"}
                                      </span>
                                    </td>
                                    <td
                                      className="text-muted"
                                      style={{
                                        ...baseCellStyle,
                                        textAlign: "center",
                                      }}
                                    >
                                      {formatDate(b.bookingDate) || "-"}
                                    </td>
                                    <td style={baseCellStyle}>
                                      <div className="d-flex flex-column gap-1">
                                        <span className="fw-semibold text-dark" style={{ fontSize: "0.95rem" }}>
                                          {b.hotelName || "-"}
                                        </span>
                                        {formatDate(b.checkInDate) && formatDate(b.checkOutDate) && (
                                          <span className="text-muted small">
                                            {formatDate(b.checkInDate)} - {formatDate(b.checkOutDate)}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td
                                      className="text-muted"
                                      style={{
                                        ...baseCellStyle,
                                        textAlign: "center",
                                        fontFamily: "monospace",
                                      }}
                                    >
                                      {formatDeadlineDate(b.deadlineDate)}
                                    </td>
                                    <td
                                      style={{
                                        ...baseCellStyle,
                                        textAlign: "center",
                                      }}
                                    >
                                      {b.confirmationStatus === "Confirmed" ? (
                                        <span
                                          className="px-3 py-2 rounded-pill"
                                          style={{
                                            background: "rgba(25,135,84,0.12)",
                                            color: "#198754",
                                            fontWeight: 600,
                                            fontSize: "0.9rem",
                                          }}
                                        >
                                          Confirmed
                                        </span>
                                      ) : b.confirmationStatus === "Not Confirmed" ? (
                                        <span
                                          className="px-3 py-2 rounded-pill"
                                          style={{
                                            background: "rgba(220,53,69,0.12)",
                                            color: "#dc3545",
                                            fontWeight: 600,
                                            fontSize: "0.9rem",
                                          }}
                                        >
                                          Not Confirmed
                                        </span>
                                      ) : (
                                        <span className="text-muted fw-semibold" style={{ fontSize: "0.9rem" }}>
                                          -
                                        </span>
                                      )}
                                    </td>
                                    <td
                                      style={{
                                        ...baseCellStyle,
                                        textAlign: "center",
                                      }}
                                    >
                                      <div className="d-flex gap-3 justify-content-center align-items-center">
                                        {loadingBookingId === b.bookingId ? (
                                          <Spinner animation="border" size="sm" style={{ color: "#0d6efd" }} />
                                        ) : (
                                          <FaEye
                                            style={{
                                              fontSize: "18px",
                                              color: "#0d6efd",
                                              cursor: "pointer",
                                              transition: "all 0.2s ease",
                                            }}
                                            title="View"
                                            onClick={() => fetchBookingDetails(b.bookingId)}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.color = "#0948c9";
                                              e.currentTarget.style.transform = "scale(1.15)";
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.color = "#0d6efd";
                                              e.currentTarget.style.transform = "scale(1)";
                                            }}
                                          />
                                        )}
                                        <FaEnvelope
                                          style={{
                                            fontSize: "18px",
                                            color: "#198754",
                                            cursor: "pointer",
                                            transition: "all 0.2s ease",
                                          }}
                                          title="Send request or confirmation"
                                          onClick={() => {
                                            setSelectedBooking(b);
                                            setShowVoucherModal(true);
                                            setSelectedVoucherType("Request");
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.color = "#0f5132";
                                            e.currentTarget.style.transform = "scale(1.15)";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.color = "#198754";
                                            e.currentTarget.style.transform = "scale(1)";
                                          }}
                                        />
                                        <FaTrash
                                          style={{
                                            fontSize: "18px",
                                            color: "#dc3545",
                                            cursor: "pointer",
                                            transition: "all 0.2s ease",
                                          }}
                                          title="Delete"
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.color = "#a71d2a";
                                            e.currentTarget.style.transform = "scale(1.15)";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.color = "#dc3545";
                                            e.currentTarget.style.transform = "scale(1)";
                                          }}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                    </Table>
                  </div>
                )}
                  </Card.Body>
                </Card>
              </Col>

          {/* Pagination */}
          {!loading && filteredBookings.length > 0 && (
            <Col xs={12}>
              <Card
                style={dashboardTheme.glassCard}
                className="shadow-lg border-0 rounded-4 mt-3"
              >
                <Card.Body className="py-4 px-4 px-lg-5">
                  <div className="d-flex flex-column flex-xl-row align-items-start align-items-xl-center justify-content-between gap-3">
                    <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                      Showing
                      <span className="fw-bold text-dark ms-2">{displayStart}</span>
                      <span className="ms-1 me-1">to</span>
                      <span className="fw-bold text-dark">{displayEnd}</span>
                      <span className="ms-1">of</span>
                      <span className="fw-bold text-dark ms-1">{totalEntries}</span>
                      <span className="ms-1">entries</span>
                    </div>
                    <div className="d-flex align-items-center gap-3">
                      <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                        Rows per page
                      </span>
                      <Form.Select
                        size="sm"
                        value={currentPerPage}
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                        className="shadow-sm border-0 rounded-pill px-3"
                        style={{ width: "auto", background: "rgba(246,248,252,0.95)" }}
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
                        disabled={currentPage === 1}
                        onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                        style={{
                          cursor: currentPage === 1 ? "not-allowed" : "pointer",
                          opacity: currentPage === 1 ? 0.5 : 1,
                        }}
                      />
                      {Array.from({ length: safeTotalPages }, (_, i) => i + 1).map((pageNumber) => (
                        <Pagination.Item
                          key={pageNumber}
                          active={currentPage === pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          className="rounded-pill"
                          style={{
                            cursor: "pointer",
                            minWidth: "40px",
                            textAlign: "center",
                          }}
                        >
                          {pageNumber}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={currentPage === safeTotalPages || safeTotalPages === 0}
                        onClick={() => currentPage < safeTotalPages && handlePageChange(currentPage + 1)}
                        style={{
                          cursor:
                            currentPage === safeTotalPages || safeTotalPages === 0
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            currentPage === safeTotalPages || safeTotalPages === 0
                              ? 0.5
                              : 1,
                        }}
                      />
                    </Pagination>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          )}

            </Row>

            {/* Booking Details Modal */}
            <Modal
              show={showDetailsModal}
              onHide={() => setShowDetailsModal(false)}
              size="lg"
              centered
            >
              <Modal.Header
                closeButton
                style={{
                  backgroundColor: "#fff",
                  borderBottom: "2px solid #e9ecef",
                }}
              >
                <Modal.Title className="fw-bold d-flex align-items-center">
                  <FaEye className="me-2 text-primary" />
                  <span>Booking Details</span>
                </Modal.Title>
              </Modal.Header>
              <Modal.Body style={{ padding: "1.5rem" }}>
                {loadingBookingId !== null ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">
                      Loading booking details...
                    </p>
                  </div>
                ) : bookingDetails ? (
                  <div>
                    {/* Booking Header - Prominent */}
                    <div className="mb-4 p-3 bg-light rounded border">
                      <Row className="align-items-center">
                        <Col md={8}>
                          <div className="d-flex align-items-center gap-3 mb-2">
                            <h5 className="mb-0 fw-bold text-dark">
                              {bookingDetails.bookingHeader?.bookingCode ||
                                "N/A"}
                            </h5>
                            <Badge
                              bg={
                                bookingDetails.bookingHeader?.bookingStatus ===
                                "UPCOMING"
                                  ? "warning"
                                  : bookingDetails.bookingHeader
                                      ?.bookingStatus === "COMPLETED"
                                  ? "success"
                                  : "danger"
                              }
                              style={{
                                fontSize: "0.75rem",
                                padding: "0.4rem 0.8rem",
                              }}
                            >
                              {bookingDetails.bookingHeader?.bookingStatus ||
                                "-"}
                            </Badge>
                          </div>
                          <div className="text-muted small">
                            <span className="me-3">
                              <strong>Booking ID:</strong>{" "}
                              {bookingDetails.bookingHeader?.bookingId || "-"}
                            </span>
                            <span>
                              <strong>Reference:</strong>{" "}
                              {bookingDetails.bookingHeader?.referenceNumber ||
                                "-"}
                            </span>
                          </div>
                        </Col>
                        <Col md={4} className="text-end">
                          <div className="text-muted small">
                            <div>
                              <strong>Booking Date:</strong>
                            </div>
                            <div>
                              {bookingDetails.bookingHeader?.bookingDate
                                ? new Date(
                                    bookingDetails.bookingHeader.bookingDate
                                  ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "-"}
                            </div>
                            {bookingDetails.bookingHeader?.deadlineDate && (
                              <>
                                <div className="mt-2">
                                  <strong>Deadline:</strong>
                                </div>
                                <div>
                                  {new Date(
                                    bookingDetails.bookingHeader.deadlineDate
                                  ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        </Col>
                      </Row>
                    </div>

                    <Row>
                      {/* Left Column */}
                      <Col md={7}>
                        {/* Guest Information */}
                        <Card className="mb-3 border-0 shadow-sm">
                          <Card.Header
                            className="bg-light border-bottom fw-semibold"
                            style={{
                              fontSize: "0.9rem",
                              padding: "0.75rem 1rem",
                            }}
                          >
                            Guest Information
                          </Card.Header>
                          <Card.Body>
                            <div className="mb-3">
                              <div className="text-muted small mb-1">
                                Guest Name
                              </div>
                              <div className="fw-semibold">
                                {bookingDetails.guestInformation?.guestName ||
                                  "-"}
                              </div>
                            </div>
                            <Row>
                              <Col md={6}>
                                <div className="mb-3">
                                  <div className="text-muted small mb-1">
                                    Email
                                  </div>
                                  <div>
                                    {bookingDetails.guestInformation?.email ||
                                      "-"}
                                  </div>
                                </div>
                              </Col>
                              <Col md={6}>
                                <div className="mb-3">
                                  <div className="text-muted small mb-1">
                                    Mobile Number
                                  </div>
                                  <div>
                                    {bookingDetails.guestInformation
                                      ?.mobileNumber || "-"}
                                  </div>
                                </div>
                              </Col>
                            </Row>
                            <div>
                              <div className="text-muted small mb-1">
                                Nationality
                              </div>
                              <div>
                                {bookingDetails.guestInformation
                                  ?.nativeCountry || "-"}
                              </div>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>

                      {/* Right Column - Pricing Summary */}
                      <Col md={5}>
                        <Card
                          className="border-0 shadow-sm"
                          style={{ position: "sticky", top: "1rem" }}
                        >
                          <Card.Header
                            className="bg-light border-bottom fw-semibold"
                            style={{
                              fontSize: "0.9rem",
                              padding: "0.75rem 1rem",
                            }}
                          >
                            Pricing Summary
                          </Card.Header>
                          <Card.Body>
                            <div className="mb-3">
                              <div className="d-flex justify-content-between mb-2">
                                <span className="text-muted">Room Rate</span>
                                <span className="fw-semibold">
                                  {bookingDetails.bookingDetails?.currency ||
                                    "AED"}{" "}
                                  {bookingDetails.bookingDetails?.rate?.toFixed(
                                    2
                                  ) || "0.00"}
                                </span>
                              </div>
                              {bookingDetails.bookingDetails?.taxDiscount !==
                                0 && (
                                <div className="d-flex justify-content-between mb-2">
                                  <span className="text-muted">
                                    {bookingDetails.bookingDetails.taxDiscount >
                                    0
                                      ? "Tax"
                                      : "Discount"}
                                  </span>
                                  <span
                                    className={
                                      bookingDetails.bookingDetails
                                        .taxDiscount > 0
                                        ? "text-danger"
                                        : "text-success"
                                    }
                                  >
                                    {bookingDetails.bookingDetails.taxDiscount >
                                    0
                                      ? "+"
                                      : "-"}{" "}
                                    {bookingDetails.bookingDetails?.currency ||
                                      "AED"}{" "}
                                    {Math.abs(
                                      bookingDetails.bookingDetails.taxDiscount
                                    ).toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>
                            <hr className="my-3" />
                            <div className="d-flex justify-content-between align-items-center p-3 bg-light rounded">
                              <span className="fw-bold fs-5">Total Amount</span>
                              <span className="text-success fw-bold fs-4">
                                {bookingDetails.bookingDetails?.currency ||
                                  "AED"}{" "}
                                {bookingDetails.bookingDetails?.total?.toFixed(
                                  2
                                ) || "0.00"}
                              </span>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>

                    {/* Reservation Details - Full Width */}
                    <Card className="mb-3 border-0 shadow-sm">
                      <Card.Header
                        className="bg-light border-bottom fw-semibold"
                        style={{ fontSize: "0.9rem", padding: "0.75rem 1rem" }}
                      >
                        Reservation Details
                      </Card.Header>
                      <Card.Body>
                        <div className="mb-3">
                          <div className="text-muted small mb-1">
                            Hotel Name
                          </div>
                          <div className="fw-semibold">
                            {bookingDetails.bookingDetails?.hotelName || "-"}
                          </div>
                        </div>
                        <Row>
                          <Col md={6}>
                            <div className="mb-3">
                              <div className="text-muted small mb-1">
                                Check-In Date
                              </div>
                              <div>
                                {bookingDetails.bookingDetails?.checkInDate ||
                                  "-"}
                              </div>
                            </div>
                          </Col>
                          <Col md={6}>
                            <div className="mb-3">
                              <div className="text-muted small mb-1">
                                Check-Out Date
                              </div>
                              <div>
                                {bookingDetails.bookingDetails?.checkOutDate ||
                                  "-"}
                              </div>
                            </div>
                          </Col>
                        </Row>
                        <Row>
                          <Col md={4}>
                            <div className="mb-3">
                              <div className="text-muted small mb-1">
                                Duration
                              </div>
                              <div>
                                {bookingDetails.bookingDetails
                                  ?.numberOfNights || "0"}{" "}
                                Night(s)
                              </div>
                            </div>
                          </Col>
                          <Col md={4}>
                            <div className="mb-3">
                              <div className="text-muted small mb-1">
                                Number of Rooms
                              </div>
                              <div>
                                {bookingDetails.bookingDetails?.numberOfRooms ||
                                  "0"}
                              </div>
                            </div>
                          </Col>
                          <Col md={4}>
                            <div className="mb-3">
                              <div className="text-muted small mb-1">
                                Total Guests
                              </div>
                              <div>
                                {bookingDetails.bookingDetails
                                  ?.numberOfAdults || "0"}{" "}
                                Adults
                                {bookingDetails.bookingDetails
                                  ?.numberOfChildren > 0 &&
                                  `, ${bookingDetails.bookingDetails.numberOfChildren} Children`}
                              </div>
                            </div>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>

                    {/* Rooms Information - Full Width */}
                    {bookingDetails.bookingDetails?.rooms &&
                      bookingDetails.bookingDetails.rooms.length > 0 && (
                        <div className="p-4 bg-light rounded border">
                          <div className="mb-3">
                            <h6 className="fw-bold text-dark mb-3">
                              Room Details
                            </h6>
                          </div>
                          <div className="table-responsive">
                            <Table bordered hover className="mb-0 bg-white">
                              <thead className="table-light">
                                <tr>
                                  <th
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "0.75rem",
                                      fontWeight: "600",
                                    }}
                                  >
                                    Room No
                                  </th>
                                  <th
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "0.75rem",
                                      fontWeight: "600",
                                    }}
                                  >
                                    Room Category
                                  </th>
                                  <th
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "0.75rem",
                                      fontWeight: "600",
                                    }}
                                  >
                                    Meal Plan
                                  </th>
                                  <th
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "0.75rem",
                                      fontWeight: "600",
                                    }}
                                  >
                                    Adults
                                  </th>
                                  <th
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "0.75rem",
                                      fontWeight: "600",
                                    }}
                                  >
                                    Children
                                  </th>
                                  <th
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "0.75rem",
                                      fontWeight: "600",
                                      textAlign: "right",
                                    }}
                                  >
                                    Rate
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {bookingDetails.bookingDetails.rooms.map(
                                  (room, index) => (
                                    <tr key={index}>
                                      <td
                                        style={{
                                          padding: "0.75rem",
                                          verticalAlign: "middle",
                                        }}
                                      >
                                        <span className="fw-bold text-primary">
                                          Room {room.roomNo || index + 1}
                                        </span>
                                      </td>
                                      <td
                                        style={{
                                          padding: "0.75rem",
                                          verticalAlign: "middle",
                                        }}
                                      >
                                        {room.roomCategory || "-"}
                                      </td>
                                      <td
                                        style={{
                                          padding: "0.75rem",
                                          verticalAlign: "middle",
                                        }}
                                      >
                                        {room.mealPlan || "-"}
                                      </td>
                                      <td
                                        style={{
                                          padding: "0.75rem",
                                          verticalAlign: "middle",
                                          textAlign: "center",
                                        }}
                                      >
                                        {room.adults || "0"}
                                      </td>
                                      <td
                                        style={{
                                          padding: "0.75rem",
                                          verticalAlign: "middle",
                                          textAlign: "center",
                                        }}
                                      >
                                        {room.children || "0"}
                                      </td>
                                      <td
                                        style={{
                                          padding: "0.75rem",
                                          verticalAlign: "middle",
                                          textAlign: "right",
                                        }}
                                      >
                                        {bookingDetails.bookingDetails
                                          ?.currency || "AED"}{" "}
                                        {room.rate?.toFixed(2) || "0.00"}
                                      </td>
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </Table>
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted">No booking details available.</p>
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer
                style={{
                  backgroundColor: "#f8f9fa",
                  borderTop: "1px solid #dee2e6",
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => setShowDetailsModal(false)}
                >
                  Close
                </Button>
              </Modal.Footer>
            </Modal>

            {/* Request Confirmation Voucher Modal */}
            <Modal
              show={showVoucherModal}
              onHide={() => {
                setShowVoucherModal(false);
                setSelectedBooking(null);
                setSelectedVoucherType("Request");
              }}
              size="xl"
              centered
              backdrop="static"
              keyboard={false}
            >
              <Modal.Header
                closeButton
                style={{ backgroundColor: "#0d6efd", color: "#fff" }}
              >
                <Modal.Title className="fw-bold">
                  Request Confirmation Voucher
                </Modal.Title>
              </Modal.Header>
              <Modal.Body style={{ padding: "1.5rem" }}>
                {selectedBooking && (
                  <>
                    {/* Radio Buttons */}
                    <div className="mb-4 d-flex gap-4">
                      <FormCheck
                        type="radio"
                        id="voucher-request"
                        name="voucherType"
                        label="Request"
                        checked={selectedVoucherType === "Request"}
                        onChange={() => setSelectedVoucherType("Request")}
                        className="fw-semibold"
                      />
                      <FormCheck
                        type="radio"
                        id="voucher-confirmation"
                        name="voucherType"
                        label="Confirmation"
                        checked={selectedVoucherType === "Confirmation"}
                        onChange={() => setSelectedVoucherType("Confirmation")}
                        className="fw-semibold"
                      />
                      <FormCheck
                        type="radio"
                        id="voucher-voucher"
                        name="voucherType"
                        label="Voucher"
                        checked={selectedVoucherType === "Voucher"}
                        onChange={() => setSelectedVoucherType("Voucher")}
                        className="fw-semibold"
                      />
                    </div>

                    {/* Table */}
                    <div className="table-responsive">
                      <Table bordered hover className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th
                              style={{
                                fontSize: "0.85rem",
                                padding: "0.75rem",
                                fontWeight: "600",
                              }}
                            >
                              Hotel
                            </th>
                            <th
                              style={{
                                fontSize: "0.85rem",
                                padding: "0.75rem",
                                fontWeight: "600",
                              }}
                            >
                              Confirmation Status
                            </th>
                            {selectedVoucherType === "Request" && (
                              <>
                                <th
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "0.75rem",
                                    fontWeight: "600",
                                  }}
                                >
                                  Booking code
                                </th>
                                <th
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "0.75rem",
                                    fontWeight: "600",
                                  }}
                                >
                                  Confirmation Reference
                                </th>
                                <th
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "0.75rem",
                                    fontWeight: "600",
                                  }}
                                >
                                  Price Reference
                                </th>
                              </>
                            )}
                            {selectedVoucherType === "Confirmation" && (
                              <>
                                <th
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "0.75rem",
                                    fontWeight: "600",
                                  }}
                                >
                                  Confirmation Reference
                                </th>
                                <th
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "0.75rem",
                                    fontWeight: "600",
                                  }}
                                >
                                  Supplier Reference
                                </th>
                              </>
                            )}
                            {selectedVoucherType === "Voucher" && (
                              <>
                                <th
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "0.75rem",
                                    fontWeight: "600",
                                  }}
                                >
                                  Confirmation Reference
                                </th>
                                <th
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "0.75rem",
                                    fontWeight: "600",
                                  }}
                                >
                                  Supplier Reference
                                </th>
                              </>
                            )}
                            <th
                              style={{
                                fontSize: "0.85rem",
                                padding: "0.75rem",
                                fontWeight: "600",
                              }}
                            >
                              Check In
                            </th>
                            <th
                              style={{
                                fontSize: "0.85rem",
                                padding: "0.75rem",
                                fontWeight: "600",
                              }}
                            >
                              Check Out
                            </th>
                            <th
                              style={{
                                fontSize: "0.85rem",
                                padding: "0.75rem",
                                fontWeight: "600",
                              }}
                            >
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td
                              style={{
                                padding: "0.75rem",
                                verticalAlign: "middle",
                              }}
                            >
                              {selectedBooking.hotelName || "-"}
                            </td>
                            <td
                              style={{
                                padding: "0.75rem",
                                verticalAlign: "middle",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "0.4rem 0.6rem",
                                  fontWeight: "500",
                                  color:
                                    selectedBooking.bookingId !== 0 &&
                                    selectedBooking.bookingCode != null
                                      ? "#28a745" // Bootstrap success green
                                      : "#dc3545", // Bootstrap danger red
                                  backgroundColor:
                                    selectedBooking.bookingId !== 0 &&
                                    selectedBooking.bookingCode != null
                                      ? "#d4edda" // Light green background
                                      : "#f8d7da", // Light red background
                                  borderRadius: "0.375rem",
                                  display: "inline-block",
                                }}
                              >
                                {selectedBooking.bookingId !== 0 &&
                                selectedBooking.bookingCode != null
                                  ? "CONFIRMED"
                                  : "NOT CONFIRMED"}
                              </span>
                            </td>
                            {selectedVoucherType === "Request" && (
                              <>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  {selectedBooking.bookingCode || "-"}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  {selectedBooking.referenceNumber || "null"}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  null
                                </td>
                              </>
                            )}
                            {selectedVoucherType === "Confirmation" && (
                              <>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  {selectedBooking.referenceNumber || "null"}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  0
                                </td>
                              </>
                            )}
                            {selectedVoucherType === "Voucher" && (
                              <>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  {selectedBooking.referenceNumber || "null"}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  0
                                </td>
                              </>
                            )}
                            <td
                              style={{
                                padding: "0.75rem",
                                verticalAlign: "middle",
                              }}
                            >
                              {selectedBooking.checkInDate
                                ? new Date(
                                    selectedBooking.checkInDate
                                  ).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "-"}
                            </td>
                            <td
                              style={{
                                padding: "0.75rem",
                                verticalAlign: "middle",
                              }}
                            >
                              {selectedBooking.checkOutDate
                                ? new Date(
                                    selectedBooking.checkOutDate
                                  ).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "-"}
                            </td>
                            <td
                              style={{
                                padding: "0.75rem",
                                verticalAlign: "middle",
                                textAlign: "center",
                              }}
                            >
                              <Button
                                variant="primary"
                                size="sm"
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  padding: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                                title="Send"
                              >
                                <FaPaperPlane style={{ fontSize: "14px" }} />
                              </Button>
                            </td>
                          </tr>
                        </tbody>
                      </Table>
                    </div>
                  </>
                )}
              </Modal.Body>
              <Modal.Footer
                style={{
                  backgroundColor: "#f8f9fa",
                  borderTop: "1px solid #dee2e6",
                }}
              >
                <Button
                  variant="primary"
                  onClick={() => {
                    setShowVoucherModal(false);
                    setSelectedBooking(null);
                    setSelectedVoucherType("Request");
                  }}
                >
                  <i className="bi bi-check-circle me-1"></i> Close
                </Button>
              </Modal.Footer>
            </Modal>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default HotelBookingList;
