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
  FaExclamationCircle,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];
const COLUMN_WIDTHS = {
  sn: "64px",
  agentName: "clamp(10ch, 12ch + 1vw, 18ch)",
  customerName: "clamp(14ch, 18ch + 1vw, 26ch)",
  bookingCode: "clamp(10ch, 12ch + 0.5vw, 16ch)",
  referenceCode: "clamp(18ch, 20ch + 1vw, 30ch)",
  bookDate: "clamp(11ch, 12ch + 0.5vw, 16ch)",
  bookingDetails: "clamp(20ch, 24ch + 1vw, 36ch)",
  deadlineDate: "clamp(12ch, 13ch + 0.5vw, 18ch)",
  notification: "clamp(11ch, 12ch + 0.5vw, 16ch)",
  action: "clamp(10ch, 11ch + 0.5vw, 15ch)",
};

const HotelBookingList = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [pagination, setPagination] = useState({
    upcoming: { page: 1, perPage: 10 },
    completed: { page: 1, perPage: 10 },
    cancelled: { page: 1, perPage: 10 },
  });
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [bookingToConfirm, setBookingToConfirm] = useState(null);
  const [confirmingBooking, setConfirmingBooking] = useState(false);
  const hasTimeFilter = Boolean(selectedMonth) && Boolean(selectedYear);
  const statusOptions = useMemo(
    () => [
      { value: "upcoming", label: "Upcoming" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
    ],
    []
  );

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
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2014 }, (_, i) => 2020 + i);

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

      if (selectedMonth && selectedYear) {
        params.month = Number(selectedMonth);
        params.year = Number(selectedYear);
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
  }, [pagination, selectedMonth, selectedYear]);

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

  // Handle confirm booking click
  const handleConfirmBookingClick = (booking) => {
    setBookingToConfirm(booking);
    setShowConfirmModal(true);
  };

  // Confirm booking API call
  const confirmBooking = async () => {
    if (!bookingToConfirm) return;

    try {
      setConfirmingBooking(true);
      const response = await axiosInstance.put(
        `/api/hotel-booking/confirm/${bookingToConfirm.bookingId}`
      );

      if (response.data && response.data.success) {
        // Refresh bookings list
        await fetchBookings();
        setShowConfirmModal(false);
        setBookingToConfirm(null);
        alert("Booking confirmed successfully!");
      } else {
        alert(response.data?.message || "Failed to confirm booking.");
      }
    } catch (error) {
      console.error("Error confirming booking:", error);
      alert(
        error.response?.data?.message ||
          "Failed to confirm booking. Please try again."
      );
    } finally {
      setConfirmingBooking(false);
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
        paginationMeta.totalElements =
          apiData.upcomingBookings.totalElements || 0;
        break;
      case "completed":
        currentBookings = apiData.completedBookings.content || [];
        paginationMeta.totalPages = apiData.completedBookings.totalPages || 0;
        paginationMeta.totalElements =
          apiData.completedBookings.totalElements || 0;
        break;
      case "cancelled":
        currentBookings = apiData.cancelledBookings.content || [];
        paginationMeta.totalPages = apiData.cancelledBookings.totalPages || 0;
        paginationMeta.totalElements =
          apiData.cancelledBookings.totalElements || 0;
        break;
      default:
        currentBookings = [];
    }

    setBookings(currentBookings);
    setTotalPages(paginationMeta.totalPages || 0);
    setTotalElements(paginationMeta.totalElements || 0);

    setPagination((prev) => {
      const currentState = prev[status];
      const effectiveTotalPages = paginationMeta.totalPages || 1;
      const clampedPage = Math.min(
        currentState.page,
        Math.max(effectiveTotalPages, 1)
      );
      if (clampedPage === currentState.page) {
        return prev;
      }
      return {
        ...prev,
        [status]: { ...currentState, page: clampedPage },
      };
    });
  }, [status, apiData]);

  const resetAllPages = useCallback(() => {
    setPagination((prev) => ({
      upcoming: { ...prev.upcoming, page: 1 },
      completed: { ...prev.completed, page: 1 },
      cancelled: { ...prev.cancelled, page: 1 },
    }));
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

  // Filter bookings based on search term
  const filteredBookings = useMemo(() => {
    if (!search.trim()) {
      return bookings;
    }
    return bookings.filter((booking) =>
      String(booking.bookingId).toLowerCase().includes(search.toLowerCase())
    );
  }, [bookings, search]);

  const currentPaginationState = pagination[status] || { page: 1, perPage: 10 };
  const currentPage = currentPaginationState.page;
  const currentPerPage = currentPaginationState.perPage;
  const totalEntries =
    typeof totalElements === "number" && totalElements >= 0
      ? totalElements
      : bookings.length;
  const hasResults = filteredBookings.length > 0;
  const serialNumberBase = (currentPage - 1) * currentPerPage;
  const displayStart = hasResults ? serialNumberBase + 1 : 0;
  const displayEnd = hasResults
    ? Math.min(serialNumberBase + filteredBookings.length, totalEntries)
    : 0;
  const safeTotalPages =
    totalPages > 0
      ? totalPages
      : Math.max(1, Math.ceil((totalEntries || 0) / currentPerPage));

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

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main
          className="flex-grow-1 p-4"
          style={{ width: "100%", overflow: "hidden" }}
        >
          <Container
            fluid
            style={{
              maxWidth: "100%",
              paddingLeft: "1rem",
              paddingRight: "1rem",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h3 className="fw-bold text-dark">Hotel Bookings</h3>
            </div>

            {/* Search Section */}
            <Row className="mb-3">
              <Col md={4} sm={6} xs={12}>
                <InputGroup style={{ height: "40px" }}>
                  <InputGroup.Text
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderRight: "none",
                      borderColor: "#dee2e6",
                    }}
                  >
                    <FaSearch style={{ color: "#6c757d" }} />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search by Booking Code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      borderLeft: "none",
                      fontSize: "0.85rem",
                      borderColor: "#dee2e6",
                    }}
                  />
                </InputGroup>
              </Col>
            </Row>

            {/* Filters Section */}
            <Row className="mb-3 g-3 align-items-stretch flex-column flex-lg-row">
              <Col md={5} sm={12} className="order-1 order-lg-0">
                <Card
                  className="shadow-sm border-0 h-100"
                  style={{ borderRadius: "8px" }}
                >
                  <Card.Body className="p-3">
                    <h6
                      className="mb-2 fw-bold text-dark"
                      style={{ fontSize: "0.85rem", letterSpacing: "0.4px" }}
                    >
                      Booking Types
                    </h6>
                    <div className="d-flex flex-wrap gap-3">
                      <Form.Check
                        type="radio"
                        id="upcoming"
                        name="bookingType"
                        label="Upcoming"
                        checked={status === "upcoming"}
                        onChange={() => setStatus("upcoming")}
                        className="fw-semibold"
                        style={{ fontSize: "0.82rem" }}
                      />
                      <Form.Check
                        type="radio"
                        id="completed"
                        name="bookingType"
                        label="Completed"
                        checked={status === "completed"}
                        onChange={() => setStatus("completed")}
                        className="fw-semibold"
                        style={{ fontSize: "0.82rem" }}
                      />
                      <Form.Check
                        type="radio"
                        id="cancelled"
                        name="bookingType"
                        label="Cancelled"
                        checked={status === "cancelled"}
                        onChange={() => setStatus("cancelled")}
                        className="fw-semibold"
                        style={{ fontSize: "0.82rem" }}
                      />
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4} sm={12} className="ms-lg-auto order-0 order-lg-1">
                <Card
                  className="shadow-sm border-0 h-100"
                  style={{ borderRadius: "8px" }}
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
                          onChange={(e) => handleMonthChange(e.target.value)}
                          className="form-control"
                          size="sm"
                          style={{ fontSize: "0.82rem" }}
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
                          onChange={(e) => handleYearChange(e.target.value)}
                          className="form-control"
                          size="sm"
                          style={{ fontSize: "0.82rem" }}
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
              </Col>
            </Row>

            {/* Table */}
            <Card
              className="shadow-sm border-0"
              style={{ borderRadius: "8px", overflow: "hidden", width: "100%" }}
            >
              <Card.Body className="p-0" style={{ width: "100%" }}>
                {loading ? (
                  <div className="text-center p-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">Loading bookings...</p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <Table
                      hover
                      size="sm"
                      className="mb-0 align-middle table-bordered"
                      style={{
                        tableLayout: "auto",
                        width: "100%",
                        fontSize: "0.82rem",
                        borderCollapse: "separate",
                        borderSpacing: 0,
                      }}
                    >
                      <thead
                        style={{
                          backgroundColor: "#f8f9fa",
                          borderBottom: "2px solid #dee2e6",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                          fontSize: "0.68rem",
                          letterSpacing: "0.04em",
                        }}
                      >
                        <tr>
                          <th
                            style={{
                              padding: "0.45rem 0.6rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              color: "#495057",
                              textAlign: "center",
                              border: "1px solid #dee2e6",
                              whiteSpace: "normal",
                              lineHeight: 1.2,
                              minWidth: COLUMN_WIDTHS.sn,
                            }}
                          >
                            S.N
                          </th>
                          <th
                            style={{
                              padding: "0.45rem 0.6rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              color: "#495057",
                              border: "1px solid #dee2e6",
                              whiteSpace: "normal",
                              lineHeight: 1.2,
                              minWidth: COLUMN_WIDTHS.agentName,
                            }}
                          >
                            Agent Name
                          </th>
                          <th
                            style={{
                              padding: "0.45rem 0.6rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              color: "#495057",
                              border: "1px solid #dee2e6",
                              whiteSpace: "normal",
                              lineHeight: 1.2,
                              minWidth: COLUMN_WIDTHS.customerName,
                            }}
                          >
                            Customer Name
                          </th>
                          <th
                            style={{
                              padding: "0.45rem 0.6rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              color: "#495057",
                              border: "1px solid #dee2e6",
                              whiteSpace: "normal",
                              lineHeight: 1.2,
                              minWidth: COLUMN_WIDTHS.bookingCode,
                            }}
                          >
                            Booking Code
                          </th>
                          <th
                            style={{
                              padding: "0.45rem 0.6rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              color: "#495057",
                              border: "1px solid #dee2e6",
                              whiteSpace: "normal",
                              lineHeight: 1.2,
                              minWidth: COLUMN_WIDTHS.referenceCode,
                            }}
                          >
                            Reference Code
                          </th>
                          <th
                            style={{
                              padding: "0.45rem 0.6rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              color: "#495057",
                              textAlign: "center",
                              border: "1px solid #dee2e6",
                              whiteSpace: "normal",
                              lineHeight: 1.2,
                              minWidth: COLUMN_WIDTHS.bookDate,
                            }}
                          >
                            Book Date
                          </th>
                          <th
                            style={{
                              padding: "0.45rem 0.6rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              color: "#495057",
                              border: "1px solid #dee2e6",
                              whiteSpace: "normal",
                              lineHeight: 1.2,
                              minWidth: COLUMN_WIDTHS.bookingDetails,
                            }}
                          >
                            Booking Details
                          </th>
                          <th
                            style={{
                              padding: "0.45rem 0.6rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              color: "#495057",
                              textAlign: "center",
                              border: "1px solid #dee2e6",
                              whiteSpace: "normal",
                              lineHeight: 1.2,
                              minWidth: COLUMN_WIDTHS.deadlineDate,
                            }}
                          >
                            Deadline Date
                          </th>
                          <th
                            style={{
                              padding: "0.45rem 0.6rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              color: "#495057",
                              textAlign: "center",
                              border: "1px solid #dee2e6",
                              whiteSpace: "normal",
                              lineHeight: 1.2,
                              minWidth: COLUMN_WIDTHS.notification,
                            }}
                          >
                            Notification
                          </th>
                          <th
                            style={{
                              padding: "0.45rem 0.6rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              color: "#495057",
                              textAlign: "center",
                              border: "1px solid #dee2e6",
                              whiteSpace: "normal",
                              lineHeight: 1.2,
                              minWidth: COLUMN_WIDTHS.action,
                            }}
                          >
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBookings.length === 0 ? (
                          <tr>
                            <td
                              colSpan={10}
                              className="text-center py-5 text-muted"
                              style={{
                                border: "1px solid #dee2e6",
                                backgroundColor: "#ffffff",
                              }}
                            >
                              <FaInbox
                                style={{
                                  fontSize: "2.5rem",
                                  marginBottom: "10px",
                                  color: "#adb5bd",
                                }}
                              />
                              <p className="mt-2 mb-0 fs-5">
                                No bookings found.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          filteredBookings.map((b, i) => {
                            // Format dates
                            const formatDate = (dateString) => {
                              if (!dateString) return "";
                              const date = new Date(dateString);
                              const day = String(date.getDate()).padStart(
                                2,
                                "0"
                              );
                              const month = String(
                                date.getMonth() + 1
                              ).padStart(2, "0");
                              const year = date.getFullYear();
                              return `${day}/${month}/${year}`;
                            };

                            // Format deadlineDate to show only YYYY-MM-DD
                            const formatDeadlineDate = (dateString) => {
                              if (!dateString) return "-";
                              // Extract date part from datetime string (e.g., "2025-11-04T00:00:00" -> "2025-11-04")
                              const datePart = dateString.split("T")[0];
                              return datePart || "-";
                            };

                            const baseCellStyle = {
                              padding: "0.45rem 0.6rem",
                              fontSize: "0.82rem",
                              border: "1px solid #dee2e6",
                              verticalAlign: "middle",
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                              lineHeight: 1.35,
                            };

                            return (
                              <tr
                                key={b.bookingId}
                                style={{
                                  backgroundColor:
                                    i % 2 === 0 ? "#ffffff" : "#f8f9fa",
                                  transition: "background-color 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    "#e7f3ff";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    i % 2 === 0 ? "#ffffff" : "#f8f9fa";
                                }}
                              >
                                <td
                                  className="text-muted fw-semibold"
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    color: "#6c757d",
                                    minWidth: COLUMN_WIDTHS.sn,
                                  }}
                                >
                                  {serialNumberBase + i + 1}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    minWidth: COLUMN_WIDTHS.agentName,
                                  }}
                                >
                                  <span className="fw-medium text-dark">
                                    {b.agentName || "-"}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    minWidth: COLUMN_WIDTHS.customerName,
                                  }}
                                >
                                  <span className="fw-medium text-dark">
                                    {b.primaryGuestName || "-"}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    minWidth: COLUMN_WIDTHS.bookingCode,
                                  }}
                                >
                                  <span className="fw-bold text-primary">
                                    {b.bookingCode || "-"}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    minWidth: COLUMN_WIDTHS.referenceCode,
                                  }}
                                >
                                  <span
                                    className="text-muted"
                                    style={{ fontSize: "0.78rem" }}
                                  >
                                    {b.referenceNumber || "-"}
                                  </span>
                                </td>
                                <td
                                  className="text-muted"
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    minWidth: COLUMN_WIDTHS.bookDate,
                                  }}
                                >
                                  {formatDate(b.bookingDate) || "-"}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    minWidth: COLUMN_WIDTHS.bookingDetails,
                                  }}
                                >
                                  <div
                                    className="d-flex align-items-center"
                                    style={{ gap: "0.35rem", flexWrap: "wrap" }}
                                  >
                                    <span
                                      className="fw-semibold text-dark"
                                      style={{ fontSize: "0.875rem" }}
                                    >
                                      {b.hotelName || "-"}
                                    </span>
                                    {formatDate(b.checkInDate) &&
                                      formatDate(b.checkOutDate) && (
                                        <span
                                          className="text-muted"
                                          style={{ fontSize: "0.75rem" }}
                                        >
                                          ({formatDate(b.checkInDate)} -{" "}
                                          {formatDate(b.checkOutDate)})
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
                                    minWidth: COLUMN_WIDTHS.deadlineDate,
                                  }}
                                >
                                  {formatDeadlineDate(b.deadlineDate)}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    minWidth: COLUMN_WIDTHS.notification,
                                  }}
                                >
                                  {(() => {
                                    const normalizedStatus = String(
                                      b.confirmationStatus || ""
                                    )
                                      .replace(/\s+/g, "")
                                      .toLowerCase();
                                    const isConfirmed =
                                      normalizedStatus === "confirmed";
                                    const isNotConfirmed =
                                      normalizedStatus === "notconfirmed";
                                    const showConfirmIcon = isNotConfirmed;

                                    if (isConfirmed) {
                                      return (
                                        <span
                                          style={{
                                            color: "#06a301",
                                            padding: "0.32rem 0.6rem",
                                            fontSize: "0.82rem",
                                            fontWeight: "600",
                                            borderRadius: "0.375rem",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "0.35rem",
                                          }}
                                        >
                                          Confirmed
                                        </span>
                                      );
                                    }

                                    const label = isNotConfirmed
                                      ? "Not Confirmed"
                                      : b.confirmationStatus || "-";

                                    return (
                                      <div
                                        className="d-inline-flex align-items-center justify-content-center gap-2"
                                        title="Non-refundable booking. Click to confirm."
                                        style={{
                                          padding: "0.32rem 0.6rem",
                                          borderRadius: "0.375rem",
                                          backgroundColor: "transparent",
                                          color: isNotConfirmed
                                            ? "#dc3545"
                                            : "#6c757d",
                                          fontSize: "0.72rem",
                                          fontWeight: "600",
                                          cursor: "pointer",
                                          transition: "all 0.2s ease",
                                        }}
                                        onClick={() =>
                                          handleConfirmBookingClick(b)
                                        }
                                      >
                                        <span>{label}</span>
                                        {showConfirmIcon && (
                                          <FaExclamationCircle
                                            style={{
                                              fontSize: "15px",
                                              color: "#ff9800",
                                              transition: "all 0.2s ease",
                                            }}
                                            title="Non-refundable booking. Click to confirm."
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.color =
                                                "#f57c00";
                                              e.currentTarget.style.transform =
                                                "scale(1.15)";
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.color =
                                                "#ff9800";
                                              e.currentTarget.style.transform =
                                                "scale(1)";
                                            }}
                                          />
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>

                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    minWidth: COLUMN_WIDTHS.action,
                                  }}
                                >
                                  <div className="d-flex gap-2 justify-content-center align-items-center">
                                    {loadingBookingId === b.bookingId ? (
                                      <Spinner
                                        animation="border"
                                        size="sm"
                                        style={{ color: "#2196f3" }}
                                      />
                                    ) : (
                                      <FaEye
                                        style={{
                                          fontSize: "16px",
                                          color: "#2196f3",
                                          cursor: "pointer",
                                          transition: "all 0.2s ease",
                                        }}
                                        title="View"
                                        onClick={() =>
                                          fetchBookingDetails(b.bookingId)
                                        }
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.color =
                                            "#1976d2";
                                          e.currentTarget.style.transform =
                                            "scale(1.15)";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.color =
                                            "#2196f3";
                                          e.currentTarget.style.transform =
                                            "scale(1)";
                                        }}
                                      />
                                    )}
                                    <FaEnvelope
                                      style={{
                                        fontSize: "16px",
                                        color: "#4caf50",
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
                                        e.currentTarget.style.color = "#388e3c";
                                        e.currentTarget.style.transform =
                                          "scale(1.15)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = "#4caf50";
                                        e.currentTarget.style.transform =
                                          "scale(1)";
                                      }}
                                    />
                                    <FaTrash
                                      style={{
                                        fontSize: "16px",
                                        color: "#f44336",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                      }}
                                      title="Delete"
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = "#d32f2f";
                                        e.currentTarget.style.transform =
                                          "scale(1.15)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = "#f44336";
                                        e.currentTarget.style.transform =
                                          "scale(1)";
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

            {/* Pagination */}
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
                      Showing {""}
                      <span className="fw-semibold text-dark">
                        {displayStart}
                      </span>{" "}
                      to {""}
                      <span className="fw-semibold text-dark">
                        {displayEnd}
                      </span>{" "}
                      of {""}
                      <span className="fw-semibold text-dark">
                        {totalEntries}
                      </span>{" "}
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
                        value={currentPerPage}
                        onChange={(e) =>
                          handlePageSizeChange(Number(e.target.value))
                        }
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
                        disabled={currentPage === 1}
                        onClick={() =>
                          currentPage > 1 && handlePageChange(currentPage - 1)
                        }
                        style={{
                          cursor: currentPage === 1 ? "not-allowed" : "pointer",
                          opacity: currentPage === 1 ? 0.5 : 1,
                        }}
                      />
                      {Array.from(
                        { length: safeTotalPages },
                        (_, i) => i + 1
                      ).map((pageNumber) => (
                        <Pagination.Item
                          key={pageNumber}
                          active={currentPage === pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          style={{
                            cursor: "pointer",
                            minWidth: "38px",
                            textAlign: "center",
                          }}
                        >
                          {pageNumber}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={currentPage === safeTotalPages}
                        onClick={() =>
                          currentPage < safeTotalPages &&
                          handlePageChange(currentPage + 1)
                        }
                        style={{
                          cursor:
                            currentPage === safeTotalPages
                              ? "not-allowed"
                              : "pointer",
                          opacity: currentPage === safeTotalPages ? 0.5 : 1,
                        }}
                      />
                    </Pagination>
                  </div>
                </Card.Body>
              </Card>
            )}

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
                      <Form.Check
                        type="radio"
                        id="voucher-request"
                        name="voucherType"
                        label="Request"
                        checked={selectedVoucherType === "Request"}
                        onChange={() => setSelectedVoucherType("Request")}
                        className="fw-semibold"
                      />
                      <Form.Check
                        type="radio"
                        id="voucher-confirmation"
                        name="voucherType"
                        label="Confirmation"
                        checked={selectedVoucherType === "Confirmation"}
                        onChange={() => setSelectedVoucherType("Confirmation")}
                        className="fw-semibold"
                      />
                      <Form.Check
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

            {/* Confirm Booking Modal */}
            <Modal
              show={showConfirmModal}
              onHide={() => {
                if (!confirmingBooking) {
                  setShowConfirmModal(false);
                  setBookingToConfirm(null);
                }
              }}
              centered
              backdrop="static"
              keyboard={false}
            >
              <Modal.Header
                closeButton={!confirmingBooking}
                style={{
                  backgroundColor: "#fff",
                  borderBottom: "2px solid #e9ecef",
                }}
              >
                <Modal.Title className="fw-bold d-flex align-items-center">
                  <FaExclamationCircle className="me-2 text-warning" />
                  <span>Confirm Booking</span>
                </Modal.Title>
              </Modal.Header>
              <Modal.Body style={{ padding: "1.5rem" }}>
                <div className="text-center">
                  <p className="fs-5 mb-3">
                    Are you sure you want to confirm the booking?
                  </p>
                  {bookingToConfirm && (
                    <div className="text-muted small mb-3">
                      <div>
                        <strong>Booking Code:</strong>{" "}
                        {bookingToConfirm.bookingCode || "N/A"}
                      </div>
                      <div>
                        <strong>Customer:</strong>{" "}
                        {bookingToConfirm.primaryGuestName || "N/A"}
                      </div>
                      {bookingToConfirm.hotelName && (
                        <div>
                          <strong>Hotel:</strong> {bookingToConfirm.hotelName}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Modal.Body>
              <Modal.Footer
                style={{
                  backgroundColor: "#f8f9fa",
                  borderTop: "1px solid #dee2e6",
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowConfirmModal(false);
                    setBookingToConfirm(null);
                  }}
                  disabled={confirmingBooking}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={confirmBooking}
                  disabled={confirmingBooking}
                >
                  {confirmingBooking ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Confirming...
                    </>
                  ) : (
                    "OK"
                  )}
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
