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
  FaDownload,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

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

const normalizeBoolean = (value, truthyMatchers = [], falsyMatchers = []) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (truthyMatchers.includes(normalized)) return true;
    if (falsyMatchers.includes(normalized)) return false;
  }
  return false;
};

const isCancellationAllowed = (booking) => {
  const refundStatus = booking?.refundStatus?.toLowerCase();
  const isNonRefundable = refundStatus === "non-refundable";

  console.log("isNonRefundable::", isNonRefundable);
  //  Returns false when it's “Non-Refundable”.
  // Returns true for “Flexi” or any other refundable type.
  return !isNonRefundable;
};

const HotelBookingList = () => {
  const [role, setRole] = useState(() => {
    return localStorage.getItem("currentActiveRole")?.toLowerCase() || null;
  });
  const [userId, setUserId] = useState(() => {
    const stored = localStorage.getItem("userId");
    return (stored && stored !== "null") ? stored : null;
  });

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("upcoming");
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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [cancellingBooking, setCancellingBooking] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [voucherDetails, setVoucherDetails] = useState(null);
  const [loadingVoucherDetails, setLoadingVoucherDetails] = useState(false);
  const [updatingConfirmationStatus, setUpdatingConfirmationStatus] = useState(null);
  const [showConfirmStatusModal, setShowConfirmStatusModal] = useState(false);
  const [bookingToUpdateStatus, setBookingToUpdateStatus] = useState(null);
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
      if (!userName) {
        console.warn("No UserName found in storage, cannot fetch profile ID");
        return;
      }

      try {
        console.log(`Fetching profile for user: ${userName} to get ID`);
        const response = await axiosInstance.get(`/api/personalProfile/${userName}`);
        if (response.data && response.data.id) {
          const id = String(response.data.id);
          console.log(`Successfully retrieved ID: ${id} for user: ${userName}`);
          setUserId(id);
          localStorage.setItem("userId", id);
        } else {
          console.warn("Profile fetch successful but no ID found in response", response.data);
        }
      } catch (error) {
        console.error("Error fetching user profile for ID:", error);
      }
    };

    if (role === "agent" || role === "staff") {
      fetchUserId();
    }
  }, [role, userId]);

  // Fetch data from API
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
        upcomingPage: pagination.upcoming.page - 1,
        upcomingSize: pagination.upcoming.perPage,
        completedPage: pagination.completed.page - 1,
        completedSize: pagination.completed.perPage,
        cancelledPage: pagination.cancelled.page - 1,
        cancelledSize: pagination.cancelled.perPage,
      };

      if (search) params.search = search;
      if (selectedMonth) params.month = selectedMonth;
      if (selectedYear) params.year = selectedYear;

      // Role-based filtering
      if (role === "agent" && userId) {
        params.agentId = userId;
      } else if (role === "staff" && userId) {
        params.staffId = userId;
      }
      
      console.log("API Request -> /api/bookings/list with params:", params);

      const response = await axiosInstance.get("/api/bookings/list", { params });
      
      setApiData({
        upcomingBookings: response.data?.upcomingBookings || { content: [], totalElements: 0, totalPages: 0 },
        completedBookings: response.data?.completedBookings || { content: [], totalElements: 0, totalPages: 0 },
        cancelledBookings: response.data?.cancelledBookings || { content: [], totalElements: 0, totalPages: 0 },
      });

    } catch (err) {
      console.error("Error fetching bookings:", err);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [pagination, search, selectedMonth, selectedYear, role, userId]);

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

  // Handle confirm status click - open modal
  const handleConfirmStatusClick = (booking) => {
    setBookingToUpdateStatus(booking);
    setShowConfirmStatusModal(true);
  };

  // Update confirmation status
  const updateConfirmationStatus = async () => {
    if (!bookingToUpdateStatus) return;

    try {
      setUpdatingConfirmationStatus(bookingToUpdateStatus.bookingId);
      const response = await axiosInstance.patch(
        `/api/booking-confirmation/${bookingToUpdateStatus.bookingId}/confirmation-status`,
        {
          confirmStatus: true
        }
      );

      console.log("Confirmation Status Response:", response.data);
      if (response.data && response.data.success) {
        // Refresh bookings list to show updated status
        await fetchBookings();
        setShowConfirmStatusModal(false);
        setBookingToUpdateStatus(null);
        toast.success(
          response.data.message || "Confirmation status updated successfully!"
        );
      } else {
        toast.error(
          response.data?.message || "Failed to update confirmation status."
        );
      }
    } catch (error) {
      console.error("Error updating confirmation status:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to update confirmation status. Please try again."
      );
    } finally {
      setUpdatingConfirmationStatus(null);
    }
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

  // Fetch voucher details
  const fetchVoucherDetails = async (bookingId) => {
    try {
      setLoadingVoucherDetails(true);
      setVoucherDetails(null);
      const response = await axiosInstance.get(
        `/api/hotel-booking/confirmation-voucher/${bookingId}`
      );

      if (response.data && response.data.success) {
        setVoucherDetails(response.data.voucherDetails);
      
      } else {
        toast.error(
          response.data?.message || "Failed to load voucher details."
        );
      }
    } catch (error) {
      console.error("Error fetching voucher details:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to load voucher details. Please try again."
      );
    } finally {
      setLoadingVoucherDetails(false);
    }
  };

  // Generate PDF (Request, Confirmation, or Voucher)
  const handleGeneratePdf = async (type) => {
    if (!selectedBooking) return;

    try {
      setGeneratingPdf(true);
      setPdfUrl(null);
      const response = await axiosInstance.get(
        `/api/bookings/${selectedBooking.bookingId}/pdf`,
        {
          params: { type: type.toUpperCase() },
        }
      );

      if (response.data && response.data.status === "SUCCESS") {
        setPdfUrl(response.data.pdfUrl);
        toast.success(response.data.message || `${type} Generated successfully!`);
      } else {
        toast.error(response.data?.message || `Failed to generate ${type}.`);
      }
    } catch (error) {
      console.error(`Error generating ${type}:`, error);
      toast.error(
        error.response?.data?.message ||
          `Failed to generate ${type}. Please try again.`
      );
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Download PDF directly
  const handleDownloadPdf = async (bookingId, type) => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/api/bookings/${bookingId}/pdf`, {
        params: { type: type.toUpperCase() },
      });

      if (response.data && response.data.status === "SUCCESS" && response.data.pdfUrl) {
        // Trigger browser download
        const link = document.createElement("a");
        link.href = response.data.pdfUrl;
        link.download = `Booking_${bookingId}_${type}.pdf`;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`${type} PDF download started!`);
      } else {
        toast.error(response.data?.message || `Failed to generate ${type} PDF.`);
      }
    } catch (error) {
      console.error(`Error downloading ${type} PDF:`, error);
      toast.error(`Error downloading ${type} PDF.`);
    } finally {
      setLoading(false);
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
  if (!search.trim()) return bookings;
  const query = search.trim().toLowerCase();

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDeadlineDate = (dateString) => {
    if (!dateString) return "";
    return dateString.split("T")[0];
  };

  return bookings.filter((booking) =>
    [
      booking.bookingCode,                          // GLBIN11
      booking.agentName,                            // Agent Name
      booking.primaryGuestName,                     // Customer Name
      booking.referenceNumber,                      // Reference Code
      booking.hotelName,                            // Hotel Name
      formatDate(booking.bookingDate),              // 24/04/2025
      formatDeadlineDate(booking.deadlineDate),     // 2025-11-04
      booking.confirmationStatus,                   // Confirmed / Not Confirmed
    ]
      .map((val) => String(val ?? "").toLowerCase())
      .some((val) => val.includes(query))
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

  const handleDeleteBooking = (booking) => {
    setBookingToCancel(booking);
    setCancellationReason("");
    setShowCancelModal(true);
  };

  const cancelBooking = async () => {
    if (!bookingToCancel) return;

    try {
      setCancellingBooking(true);
      const params = cancellationReason.trim()
        ? { reason: cancellationReason.trim() }
        : undefined;

      const response = await axiosInstance.delete(
        `/api/hotel-booking/${bookingToCancel.bookingId}/cancel`,
        { params }
      );

      if (
        response.data &&
        response.data.success &&
        response.data.confirmationStatus === "Cancelled"
      ) {
        await fetchBookings();
        setShowCancelModal(false);
        setBookingToCancel(null);
        setCancellationReason("");
        // console.log("Booking cancelled successfully!");
        toast.success(response.data.message);
      } else {
        // alert(response.data?.message || "Failed to cancel booking.");
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
    } finally {
      setCancellingBooking(false);
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
                  className="shadow-sm border-0 h-60 mt-1"
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
                  className="shadow-sm border-0 h-60"
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
                          style={{ fontSize: "0.82rem" ,height:"46px"}}
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
                          style={{ fontSize: "0.82rem" ,height:"46px"}}
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
                  <div
                    className="thin-scrollbar"
                    style={{
                      overflowX: "auto",
                      // custom scrollbar via className below
                    }}
                  >
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
                          {role === "admin" && (
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
                          )}
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
                                {role === "admin" && (
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
                                )}
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
                                    const isUpdating = updatingConfirmationStatus === b.bookingId;

                                    return (
                                      <div
                                        className="d-inline-flex align-items-center justify-content-center gap-2 setConfirmed "
                                        title="Click to confirm the booking."
                                        style={{
                                          padding: "0.32rem 0.6rem",
                                          borderRadius: "0.375rem",
                                          backgroundColor: "transparent",
                                          color: isNotConfirmed
                                            ? "#dc3545"
                                            : "#6c757d",
                                          fontSize: "0.72rem",
                                          fontWeight: "600",
                                          cursor: isUpdating ? "not-allowed" : "pointer",
                                          transition: "all 0.2s ease",
                                          opacity: isUpdating ? 0.6 : 1,
                                        }}
                                        onClick={() => {
                                          if (isNotConfirmed && !isUpdating) {
                                            handleConfirmStatusClick(b);
                                          } else if (!isUpdating) {
                                            handleConfirmBookingClick(b);
                                          }
                                        }}
                                      >
                                        {isUpdating ? (
                                          <Spinner
                                            animation="border"
                                            size="sm"
                                            style={{
                                              width: "12px",
                                              height: "12px",
                                              borderWidth: "2px",
                                            }}
                                          />
                                        ) : (
                                          <>
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
                                          </>
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
                                  <div className="d-flex gap-3 justify-content-center align-items-center">
                                    {/* View Icon - SHOWN FOR ALL */}
                                    {loadingBookingId === b.bookingId ? (
                                      <Spinner
                                        animation="border"
                                        size="sm"
                                        style={{ color: "#007bff" }}
                                      />
                                    ) : (
                                      <FaEye
                                        style={{
                                          fontSize: "14px",
                                          color: "#007bff",
                                          cursor: "pointer",
                                        }}
                                        title="View"
                                        onClick={() =>
                                          fetchBookingDetails(b.bookingId)
                                        }
                                      />
                                    )}

                                    {/* Message Icon (Voucher Modal) - SHOWN FOR UPCOMING & COMPLETED */}
                                    {(status === "upcoming" || status === "completed") && (
                                      <FaEnvelope
                                        style={{
                                          fontSize: "14px",
                                          color: "#28a745",
                                          cursor: "pointer",
                                        }}
                                        title="Send request or confirmation"
                                        onClick={async () => {
                                          setSelectedBooking(b);
                                          setShowVoucherModal(true);
                                          setSelectedVoucherType("Request");
                                          await fetchVoucherDetails(b.bookingId);
                                        }}
                                      />
                                    )}

                                    {/* Download Icon - SHOWN FOR COMPLETED ONLY */}
                                    {status === "completed" && (
                                      <FaDownload
                                        style={{
                                          fontSize: "14px",
                                          color: "#333",
                                          cursor: "pointer",
                                        }}
                                        title="Download Completed PDF"
                                        onClick={() => handleDownloadPdf(b.bookingId, "COMPLETED")}
                                      />
                                    )}

                                    {/* Delete/Cancel Icon - SHOWN FOR UPCOMING ONLY */}
                                    {status === "upcoming" && isCancellationAllowed(b) && (
                                      <FaTrash
                                        style={{
                                          fontSize: "14px",
                                          color: "#dc3545",
                                          cursor: "pointer",
                                        }}
                                        title="Delete"
                                        onClick={() => handleDeleteBooking(b)}
                                      />
                                    )}
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
              backdrop="static"
              keyboard={false}
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
                              // bg={
                              //   bookingDetails.bookingHeader?.bookingStatus ===
                              //   "UPCOMING"
                              //     ? "warning"
                              //     : bookingDetails.bookingHeader
                              //         ?.bookingStatus === "COMPLETED"
                              //     ? "success"
                              //     : "danger"
                              // }
                              bg={
                                bookingDetails.bookingHeader
                                  ?.confirmationStatus === "Confirmed"
                                  ? "success"
                                  : "danger"
                              }
                              style={{
                                fontSize: "0.75rem",
                                padding: "0.4rem 0.8rem",
                              }}
                            >
                              {bookingDetails.bookingHeader?.confirmationStatus
                                ? bookingDetails.bookingHeader.confirmationStatus.toUpperCase()
                                : "-"}
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
                                  {console.log(
                                    "bookingDetails:::###::",
                                    bookingDetails
                                  )}
                                  {bookingDetails?.bookingDetails?.currency ||
                                    ""}{" "}
                                  {bookingDetails?.bookingDetails?.total
                                    ? bookingDetails.bookingDetails.total.toFixed(
                                        2
                                      )
                                    : "0.00"}
                                </span>
                              </div>

                              {/* {bookingDetails.bookingDetails?.taxDiscount !==
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
                              )} */}
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
                setPdfUrl(null);
                setVoucherDetails(null);
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
                        onChange={() => {
                          setSelectedVoucherType("Request");
                          setPdfUrl(null);
                        }}
                        className="fw-semibold"
                      />
                      <Form.Check
                        type="radio"
                        id="voucher-confirmation"
                        name="voucherType"
                        label="Confirmation"
                        checked={selectedVoucherType === "Confirmation"}
                        onChange={() => {
                          setSelectedVoucherType("Confirmation");
                          setPdfUrl(null);
                        }}
                        className="fw-semibold"
                      />
                      <Form.Check
                        type="radio"
                        id="voucher-voucher"
                        name="voucherType"
                        label="Voucher"
                        checked={selectedVoucherType === "Voucher"}
                        onChange={() => {
                          setSelectedVoucherType("Voucher");
                          setPdfUrl(null);
                        }}
                        className="fw-semibold"
                      />
                    </div>

                    {/* PDF URL Display */}
                    {/* {pdfUrl && selectedVoucherType === "Confirmation" && (
                      <div
                        className="mb-3 p-3"
                        style={{
                          backgroundColor: "#e7f3ff",
                          borderRadius: "8px",
                          border: "1px solid #b3d9ff",
                        }}
                      >
                        <div className="d-flex align-items-center justify-content-between">
                          <div>
                            <strong style={{ color: "#0066cc" }}>
                              PDF Generated Successfully:
                            </strong>
                            <div className="mt-2">
                              <a
                                href={pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: "#0066cc",
                                  textDecoration: "underline",
                                  wordBreak: "break-all",
                                }}
                              >
                                {pdfUrl}
                              </a>
                            </div>
                          </div>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => window.open(pdfUrl, "_blank")}
                          >
                            Open PDF
                          </Button>
                        </div>
                      </div>
                    )} */}

                    {pdfUrl && (
                      <div
                        className="mb-3"
                        style={{
                          border: "1px solid #dee2e6",
                          borderRadius: "8px",
                          overflow: "hidden",
                          background: "#fff",
                        }}
                      >
                        <div
                          style={{
                            padding: "8px 12px",
                            background: "#f8f9fa",
                            borderBottom: "1px solid #dee2e6",
                            fontWeight: "600",
                            fontSize: "14px",
                          }}
                        >
                          {selectedVoucherType} PDF Preview
                        </div>

                        <iframe
                          src={pdfUrl}
                          title={`${selectedVoucherType} PDF`}
                          width="100%"
                          height="500px"
                          style={{
                            border: "none",
                          }}
                        />
                      </div>
                    )}

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
                          {loadingVoucherDetails ? (
                            <tr>
                              <td
                                colSpan={
                                  selectedVoucherType === "Request"
                                    ? 8
                                    : selectedVoucherType === "Confirmation"
                                    ? 7
                                    : 7
                                }
                                style={{
                                  padding: "2rem",
                                  textAlign: "center",
                                }}
                              >
                                <Spinner animation="border" size="sm" /> Loading
                                voucher details...
                              </td>
                            </tr>
                          ) : (
                            <tr>
                              <td
                                style={{
                                  padding: "0.75rem",
                                  verticalAlign: "middle",
                                }}
                              >
                                {voucherDetails?.hotelName ||
                                  selectedBooking?.hotelName ||
                                  "-"}
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
                                      voucherDetails?.confirmationStatus ===
                                      "Confirmed"
                                        ? "#28a745" // success green
                                        : "#dc3545", // danger red
                                    backgroundColor:
                                      voucherDetails?.confirmationStatus ===
                                      "Confirmed"
                                        ? "#d4edda" // Light green
                                        : "#f8d7da", // Light red
                                    borderRadius: "0.375rem",
                                    display: "inline-block",
                                  }}
                                >
                                  {voucherDetails?.confirmationStatus ===
                                  "Confirmed"
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
                                    {voucherDetails?.bookingCode ||
                                      selectedBooking?.bookingCode ||
                                      "-"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.75rem",
                                      verticalAlign: "middle",
                                    }}
                                  >
                                    {voucherDetails?.confirmationReference ||
                                      selectedBooking?.referenceNumber ||
                                      "null"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.75rem",
                                      verticalAlign: "middle",
                                    }}
                                  >
                                    {voucherDetails?.priceReference || "null"}
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
                                    {voucherDetails?.confirmationReference ||
                                      selectedBooking?.referenceNumber ||
                                      "null"}
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
                                    {voucherDetails?.confirmationReference ||
                                      selectedBooking?.referenceNumber ||
                                      "null"}
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
                                {voucherDetails?.checkIn
                                  ? new Date(
                                      voucherDetails.checkIn
                                    ).toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : selectedBooking?.checkInDate
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
                                {voucherDetails?.checkout
                                  ? new Date(
                                      voucherDetails.checkout
                                    ).toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : selectedBooking?.checkOutDate
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
                                  onClick={() => {
                                    // Check if booking is confirmed for Confirmation and Voucher
                                    const isConfirmed = voucherDetails?.confirmationStatus === "Confirmed";
                                    
                                    if (selectedVoucherType !== "Request" && !isConfirmed) {
                                      toast.error(`Confirm the booking then only ${selectedVoucherType} can be generated`);
                                      return;
                                    }
                                    
                                    handleGeneratePdf(selectedVoucherType);
                                  }}
                                  disabled={generatingPdf}
                                >
                                  {generatingPdf ? (
                                    <Spinner
                                      animation="border"
                                      size="sm"
                                      style={{ width: "14px", height: "14px" }}
                                    />
                                  ) : (
                                    <FaPaperPlane
                                      style={{ fontSize: "14px" }}
                                    />
                                  )}
                                </Button>
                              </td>
                            </tr>
                          )}
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
                    setPdfUrl(null);
                    setVoucherDetails(null);
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

            {/* Confirm Status Modal */}
            <Modal
              show={showConfirmStatusModal}
              onHide={() => {
                if (!updatingConfirmationStatus) {
                  setShowConfirmStatusModal(false);
                  setBookingToUpdateStatus(null);
                }
              }}
              centered
              backdrop="static"
              keyboard={false}
              size="sm"
            >
              <Modal.Header
                closeButton={!updatingConfirmationStatus}
                style={{
                  backgroundColor: "#fff",
                  borderBottom: "2px solid #e9ecef",
                }}
              >
                <Modal.Title className="fw-bold d-flex align-items-center">
                  <FaExclamationCircle className="me-2 text-warning" />
                  <span>Confirm Booking Status</span>
                </Modal.Title>
              </Modal.Header>
              <Modal.Body style={{ padding: "1.5rem" }}>
                <div className="text-center">
                  <p className="fs-6 mb-3">
                    Are you sure you want to confirm this booking?
                  </p>
                  {bookingToUpdateStatus && (
                    <div className="text-muted small mb-3">
                      <div>
                        <strong>Booking Code:</strong>{" "}
                        {bookingToUpdateStatus.bookingCode || "N/A"}
                      </div>
                      <div>
                        <strong>Customer:</strong>{" "}
                        {bookingToUpdateStatus.primaryGuestName || "N/A"}
                      </div>
                      {bookingToUpdateStatus.hotelName && (
                        <div>
                          <strong>Hotel:</strong> {bookingToUpdateStatus.hotelName}
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
                    setShowConfirmStatusModal(false);
                    setBookingToUpdateStatus(null);
                  }}
                  disabled={updatingConfirmationStatus}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={updateConfirmationStatus}
                  disabled={updatingConfirmationStatus}
                >
                  {updatingConfirmationStatus ? (
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

            {/* Cancel Booking Modal */}
            <Modal
              show={showCancelModal}
              onHide={() => {
                if (!cancellingBooking) {
                  setShowCancelModal(false);
                  setBookingToCancel(null);
                  setCancellationReason("");
                }
              }}
              centered
              backdrop="static"
              keyboard={false}
            >
              <Modal.Header
                closeButton={!cancellingBooking}
                style={{
                  backgroundColor: "#fff",
                  borderBottom: "2px solid #e9ecef",
                }}
              >
                <Modal.Title className="fw-bold d-flex align-items-center">
                  <FaExclamationCircle className="me-2 text-danger" />
                  <span>Cancel Booking</span>
                </Modal.Title>
              </Modal.Header>
              <Modal.Body style={{ padding: "1.5rem" }}>
                <div className="text-center">
                  <p className="fs-5 mb-3">
                    Are you sure you want to cancel this booking?
                  </p>
                  {bookingToCancel && (
                    <div className="text-muted small mb-3">
                      <div>
                        <strong>Booking Code:</strong>{" "}
                        {bookingToCancel.bookingCode || "N/A"}
                      </div>
                      <div>
                        <strong>Customer:</strong>{" "}
                        {bookingToCancel.primaryGuestName || "N/A"}
                      </div>
                      {bookingToCancel.hotelName && (
                        <div>
                          <strong>Hotel:</strong> {bookingToCancel.hotelName}
                        </div>
                      )}
                    </div>
                  )}
                  <Form.Group controlId="cancellationReason">
                    <Form.Label className="fw-semibold">
                      Cancellation Reason{" "}
                      <span className="text-muted">(optional)</span>
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      placeholder="Add a reason for cancellation (optional)"
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      disabled={cancellingBooking}
                    />
                  </Form.Group>
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
                    setShowCancelModal(false);
                    setBookingToCancel(null);
                    setCancellationReason("");
                  }}
                  disabled={cancellingBooking}
                >
                  No
                </Button>
                <Button
                  variant="danger"
                  onClick={cancelBooking}
                  disabled={cancellingBooking}
                >
                  {cancellingBooking ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Cancelling...
                    </>
                  ) : (
                    "Yes, Cancel"
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
