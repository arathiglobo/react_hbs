import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  FaArrowLeft,
  FaHotel,
  FaTicketAlt,
  FaCar,
  FaUsers,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClipboardList,
  FaTrash,
  FaExclamationCircle,
  FaFileAlt,
  FaEnvelope,
  FaDownload,
  FaEdit,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

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
  
  // Modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Verification modal state
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState(null);
  const [loadingVerification, setLoadingVerification] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Voucher modal state — opens on the voucher icon. Renders the PDF inline
  // in an iframe (popup-blocker-proof, attachment-disposition-proof) and
  // also exposes a Download button + an Email-to-recipient form.
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherBooking, setVoucherBooking] = useState(null);
  const [voucherEmail, setVoucherEmail] = useState("");
  const [isSendingVoucher, setIsSendingVoucher] = useState(false);
  const [voucherBlobUrl, setVoucherBlobUrl] = useState("");
  const [isLoadingVoucherPdf, setIsLoadingVoucherPdf] = useState(false);

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

  // Fetch booking details and open modal
  const handleViewDetails = async (booking) => {
    try {
      setLoadingDetails(true);
      setShowDetailsModal(true);
      setBookingDetails(null);
      
      const bookingId = booking.bookingId || booking.id;
      
      if (!bookingId) {
        toast.error("Booking ID not found");
        setShowDetailsModal(false);
        return;
      }

      const response = await axiosInstance.get(
        `/api/v1/package-booking/booking/${bookingId}`
      );

      if (response.data) {
        setBookingDetails(response.data);
      } else {
        toast.error("Failed to load booking details");
        setShowDetailsModal(false);
      }
    } catch (error) {
      console.error("Error fetching booking details:", error);
      toast.error(error.response?.data?.message || "Failed to load booking details");
      setShowDetailsModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Handle verification icon click
  const handleVerificationClick = async (booking) => {
    try {
      setLoadingVerification(true);
      setShowVerificationModal(true);
      setVerificationDetails(null);
      
      // Get customBookingId from booking object
      const customBookingId = booking.customBookingId || booking.bookingId || booking.id;
      
      if (!customBookingId) {
        toast.error("Booking ID not found");
        setShowVerificationModal(false);
        return;
      }

      const response = await axiosInstance.get(
        `/api/makeYourOwnPackage/getCustomBookingDetails/${customBookingId}`
      );

      if (response.data) {
        setVerificationDetails(response.data);
      } else {
        toast.error("Failed to load booking details");
        setShowVerificationModal(false);
      }
    } catch (error) {
      console.error("Error fetching booking details for verification:", error);
      toast.error(error.response?.data?.message || "Failed to load booking details");
      setShowVerificationModal(false);
    } finally {
      setLoadingVerification(false);
    }
  };

  // Handle set verified
  const handleSetVerified = async () => {
    if (!verificationDetails) return;

    try {
      setIsVerifying(true);
      const customBookingId = verificationDetails.customBookingId || 
                               verificationDetails.bookingId || 
                               verificationDetails.id;

      if (!customBookingId) {
        toast.error("Booking ID not found");
        return;
      }

      // Call verification endpoint
      const response = await axiosInstance.put(
        `/api/makeYourOwnPackage/setVerified/${customBookingId}`
      );

      if (response.data && (response.data.success || response.data.message)) {
        toast.success(response.data.message || "Booking verified successfully!");
        setShowVerificationModal(false);
        setVerificationDetails(null);
        // Refresh bookings list
        fetchBookings();
      } else {
        toast.error(response.data?.message || "Failed to verify booking");
      }
    } catch (error) {
      console.error("Error verifying booking:", error);
      toast.error(error.response?.data?.message || "Failed to verify booking. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Cancel Click
  const handleCancelClick = (booking) => {
    setBookingToCancel(booking);
    setShowCancelModal(true);
  };

  // Confirm Cancellation
  const confirmCancelBooking = async () => {
    if (!bookingToCancel) return;

    try {
      setIsCancelling(true);
      const bookingId = bookingToCancel.bookingId;
      const response = await axiosInstance.put(`/api/v1/package-booking/cancel/${bookingId}`);

      if (response.data && response.data.status === "success") {
        toast.success(response.data.message || "Booking cancelled successfully");
        setShowCancelModal(false);
        setBookingToCancel(null);
        fetchBookings();
      } else {
        toast.error(response.data?.message || "Failed to cancel booking");
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error(error.response?.data?.message || "Error cancelling booking. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  // ── Amendment / Edit handler ───────────────────────────────────────
  // Navigate to the booking page in edit mode. The page detects the
  // bookingId in location.state and pre-loads the existing booking.
  const handleEditClick = (booking) => {
    if (!booking) return;
    const bookingId = booking.bookingId || booking.id;
    const packageId = booking.packageId;
    if (!packageId) {
      toast.error("Cannot amend — package id missing on booking row");
      return;
    }
    navigate(`/new-booking/package-booking/${packageId}`, {
      state: {
        mode: "edit",
        bookingId,
        agentId: booking.agentId || null,
        destinationCountryId: booking.destinationCountryId || null,
      },
    });
  };

  // ── Voucher handlers ───────────────────────────────────────────────

  /** Fetch the PDF as a blob and build a same-origin Object URL the iframe
   *  can render. Keeps us safe from popup blockers and from the backend's
   *  `Content-Disposition: attachment` header (which would otherwise force a
   *  download instead of an inline preview). */
  const loadVoucherPdf = async (booking) => {
    const bookingId = booking?.bookingId || booking?.id;
    if (!bookingId) return;
    setIsLoadingVoucherPdf(true);
    try {
      const response = await axiosInstance.get(
        `/api/v1/package-booking/generate-pdf/${bookingId}`,
        { responseType: "blob" }
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      setVoucherBlobUrl(url);
    } catch (err) {
      console.error("Voucher load failed:", err);
      toast.error("Failed to load voucher PDF");
    } finally {
      setIsLoadingVoucherPdf(false);
    }
  };

  const openVoucher = (booking) => {
    setVoucherBooking(booking);
    // Pre-fill the recipient with the booking's contact email when present.
    setVoucherEmail(booking.contactEmail || booking.email || "");
    setVoucherBlobUrl("");
    setShowVoucherModal(true);
    loadVoucherPdf(booking);
  };

  const closeVoucher = () => {
    if (isSendingVoucher) return;
    setShowVoucherModal(false);
    setVoucherBooking(null);
    setVoucherEmail("");
    if (voucherBlobUrl) {
      window.URL.revokeObjectURL(voucherBlobUrl);
    }
    setVoucherBlobUrl("");
  };

  /** Force a save-to-disk of the current voucher PDF. Reuses the cached
   *  blob URL when available so we don't hit the backend twice. */
  const handleDownloadVoucher = async () => {
    if (!voucherBooking) return;
    const bookingId = voucherBooking.bookingId || voucherBooking.id;
    if (!bookingId) {
      toast.error("Booking ID not found");
      return;
    }
    try {
      let url = voucherBlobUrl;
      if (!url) {
        const response = await axiosInstance.get(
          `/api/v1/package-booking/generate-pdf/${bookingId}`,
          { responseType: "blob" }
        );
        const blob = new Blob([response.data], { type: "application/pdf" });
        url = window.URL.createObjectURL(blob);
        setVoucherBlobUrl(url);
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = `PackageBooking_${bookingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Voucher download failed:", err);
      toast.error("Failed to download voucher");
    }
  };

  const handleSendVoucherEmail = async () => {
    if (!voucherBooking) return;
    const bookingId = voucherBooking.bookingId || voucherBooking.id;
    if (!bookingId) {
      toast.error("Booking ID not found");
      return;
    }
    const trimmed = (voucherEmail || "").trim();
    if (!trimmed) {
      toast.error("Please enter a recipient email");
      return;
    }
    // Basic email shape check.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }
    try {
      setIsSendingVoucher(true);
      const res = await axiosInstance.post(
        `/api/v1/package-booking/send-voucher/${bookingId}`,
        { email: trimmed }
      );
      if (res.data?.status === "success") {
        toast.success(res.data.message || "Voucher emailed");
        closeVoucher();
      } else {
        toast.error(res.data?.message || "Failed to send voucher");
      }
    } catch (err) {
      console.error("Voucher email failed:", err);
      toast.error(err.response?.data?.message || "Failed to send voucher");
    } finally {
      setIsSendingVoucher(false);
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
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="d-flex align-items-center gap-3">
                {/* <Button
                  variant="link"
                  className="p-0 text-dark"
                  onClick={() => navigate(-1)}
                >
                  <FaArrowLeft size={20} />
                </Button> */}
                <h2 className="mb-0 fw-bold">Package Booking</h2> 
              </div>
            </div>

            {/* List of Bookings Section */}
            <Card className="shadow-sm border-0 mb-3" style={{ borderRadius: "8px" }}>
              <Card.Header
                className="bg-primary text-white d-flex justify-content-between align-items-center"
                style={{ borderRadius: "8px 8px 0 0" }}
              >
                <h5 className="mb-0 fw-bold">List of Bookings</h5>
                {/* <Button variant="light" size="sm">
                  New +
                </Button> */}
              </Card.Header>
              <Card.Body>
                {/* Booking Types Radio Section */}
                <Row className="mb-4">
                  <Col md={6}>
                    <Card className="shadow-sm border-0" style={{ backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
                      <Card.Body className="p-3">
                        <h6 className="mb-3 fw-bold text-dark" style={{ fontSize: "0.85rem" }}>Booking Types</h6>
                        <div className="d-flex flex-wrap gap-4">
                          <Form.Check
                            type="radio"
                            id="upcoming"
                            name="bookingType"
                            label="Upcoming"
                            checked={status === "upcoming"}
                            onChange={() => setStatus("upcoming")}
                            className="fw-semibold"
                            style={{ fontSize: "0.85rem", cursor: "pointer" }}
                          />
                          <Form.Check
                            type="radio"
                            id="completed"
                            name="bookingType"
                            label="Completed"
                            checked={status === "completed"}
                            onChange={() => setStatus("completed")}
                            className="fw-semibold"
                            style={{ fontSize: "0.85rem", cursor: "pointer" }}
                          />
                          <Form.Check
                            type="radio"
                            id="cancelled"
                            name="bookingType"
                            label="Cancelled"
                            checked={status === "cancelled"}
                            onChange={() => setStatus("cancelled")}
                            className="fw-semibold"
                            style={{ fontSize: "0.85rem", cursor: "pointer" }}
                          />
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {/* Display and Search */}
                <Row className="mb-3 align-items-center">
                  <Col md={3}>
                    <div className="d-flex align-items-center gap-2">
                      <span className="small text-muted">Display</span>
                      <Form.Select
                        value={perPage}
                        onChange={(e) => setPerPage(Number(e.target.value))}
                        size="sm"
                        style={{ width: "auto" }}
                      >
                        {PER_PAGE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option} records
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                  </Col>
                  <Col md={4} className="ms-auto">
                    <InputGroup>
                      <InputGroup.Text>
                        <FaSearch />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        placeholder="Search:"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </InputGroup>
                  </Col>
                </Row>

                {/* Table */}
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3 text-muted">Loading bookings...</p>
                  </div>
                ) : (
                  <>
                    <div className="table-responsive">
                      <Table striped bordered hover className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: "60px" }}>S.N</th>
                            <th>Conf Code</th>
                            <th>Package Name</th>
                            {role === "admin" && <th>Agent Name</th>}
                            <th>Contact Name</th>
                            <th>Travel Date</th>
                            <th className="text-end">Total Price</th>
                            <th style={{ width: "120px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedBookings.length > 0 ? (
                            paginatedBookings.map((booking, index) => (
                              <tr key={booking.bookingId || index}>
                                <td>{(page - 1) * perPage + index + 1}</td>
                                <td className="fw-bold text-primary">{booking.confirmationCode || "-"}</td>
                                <td>{booking.packageName || "-"}</td>
                                {role === "admin" && <td>{booking.agentName || "-"}</td>}
                                <td>{booking.contactName || "-"}</td>
                                <td>{formatDate(booking.travelDate)}</td>
                                <td className="text-end fw-bold text-success">
                                  AED {parseFloat(booking.totalPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td>
                                  <div className="d-flex gap-3 align-items-center">
                                    <FaEye
                                      style={{ cursor: "pointer", fontSize: "14px", color: "#007bff" }}
                                      onClick={() => handleViewDetails(booking)}
                                      title="View Details"
                                    />
                                    {/* Amend / edit — only for active bookings. */}
                                    {status !== "cancelled" && (
                                      <FaEdit
                                        style={{ cursor: "pointer", fontSize: "14px", color: "#6c5ce7" }}
                                        onClick={() => handleEditClick(booking)}
                                        title="Amend Booking"
                                      />
                                    )}
                                    {/* Voucher action — opens a modal with
                                        inline PDF preview + Download + Email PDF. */}
                                    {status !== "cancelled" && (
                                      <FaFileAlt
                                        style={{ cursor: "pointer", fontSize: "14px", color: "#198754" }}
                                        onClick={() => openVoucher(booking)}
                                        title="Voucher"
                                      />
                                    )}
                                    {status !== "cancelled" && (
                                      <FaTrash
                                        style={{ cursor: "pointer", fontSize: "14px", color: "#dc3545" }}
                                        onClick={() => handleCancelClick(booking)}
                                        title="Cancel Booking"
                                      />
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="7" className="text-center py-4 text-muted">
                                No data available in table
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </div>

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

      {/* Booking Details Modal */}
      <Modal
        show={showDetailsModal}
        onHide={() => setShowDetailsModal(false)}
        centered
        scrollable
        size="lg"
      >
        <Modal.Header closeButton className="bg-dark text-white border-0">
          <Modal.Title className="d-flex align-items-center gap-2">
            <FaEye className="text-info" />
            <span className="fw-bold">Booking Details</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-light p-4">
          {loadingDetails ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3 text-muted fw-medium">Fetching details...</p>
            </div>
          ) : bookingDetails ? (
            <div className="animate__animated animate__fadeIn">
              <Row className="mb-3">
                <Col md={3}>
                  <div className="border p-2">
                    <div className="text-muted mb-1" style={{ fontSize: '0.6rem' }}>CONF CODE</div>
                    <div className="text-break" style={{ fontSize: '0.9rem' }}>{bookingDetails.confirmationCode || "-"}</div>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="border p-2">
                    <div className="text-muted mb-1" style={{ fontSize: '0.6rem' }}>TRAVEL DATE</div>
                    <div style={{ fontSize: '0.9rem' }}>{formatDate(bookingDetails.travelDate)}</div>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="border p-2">
                    <div className="text-muted mb-1" style={{ fontSize: '0.6rem' }}>TOTAL PRICE</div>
                    <div style={{ fontSize: '0.9rem' }}>AED {parseFloat(bookingDetails.totalPrice || 0).toLocaleString()}</div>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="border p-2">
                    <div className="text-muted mb-1" style={{ fontSize: '0.6rem' }}>PAX COUNT</div>
                    <div style={{ fontSize: '0.9rem' }}>
                      {bookingDetails.counts?.adultCount}A / {bookingDetails.counts?.childCount}C
                    </div>
                  </div>
                </Col>
              </Row>

              <Row className="g-4">
                {/* Left Column: Contact & Travellers */}
                <Col lg={5}>
                  <div className="border mb-3 p-3">
                    <h6 className="mb-3">Contact Information</h6>
                    <div className="mb-2">
                      <label className="text-muted mb-0 d-block small">Primary Contact</label>
                      <div className="small">
                        {bookingDetails.contactInfo?.title} {bookingDetails.contactInfo?.name}
                      </div>
                    </div>
                    <Row className="g-2">
                      <Col sm={6}>
                        <label className="text-muted mb-0 d-block small">Email</label>
                        <div className="small text-break">{bookingDetails.contactInfo?.email}</div>
                      </Col>
                      <Col sm={6}>
                        <label className="text-muted mb-0 d-block small">Mobile</label>
                        <div className="small">{bookingDetails.contactInfo?.mobile}</div>
                      </Col>
                    </Row>
                  </div>

                  <div className="border mb-3">
                    <div className="p-2 border-bottom">
                       <h6 className="mb-0 small">Travellers List</h6>
                    </div>
                    <div>
                      <Table size="sm" className="mb-0">
                        <thead>
                          <tr className="bg-light small text-muted">
                            <th className="ps-3">Type</th>
                            <th>Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookingDetails.travellers?.map((traveller, idx) => (
                            <tr key={idx} style={{ fontSize: '0.75rem' }}>
                              <td className="ps-3">{traveller.type}</td>
                              <td>{traveller.title} {traveller.firstName} {traveller.lastName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                </Col>

                {/* Right Column: Selections */}
                <Col lg={7}>
                  <div className="border p-3">
                    <h6 className="mb-3">Selected Services</h6>
                    {/* Hotel Selection - Updated to handle multiple hotels */}
                    {bookingDetails.selections?.hotels && bookingDetails.selections.hotels.length > 0 ? (
                      <div className="mb-3">
                        <div className="small mb-2 text-muted fw-bold">Hotel Selections</div>
                        {bookingDetails.selections.hotels.map((hotel, hIdx) => (
                          <div key={hotel.hotelId || hIdx} className="p-2 border mb-2 bg-white shadow-sm rounded">
                            <div className="d-flex justify-content-between align-items-center">
                              <div>
                                <div className="fw-bold small">{hotel.hotelName}</div>
                                <div className="text-muted" style={{ fontSize: '0.7rem' }}>Hotel ID: {hotel.hotelId}</div>
                              </div>
                              <div className="text-end">
                                <div className="fw-bold small text-primary">{hotel.selectedRate} {hotel.currency || 'AED'}</div>
                                <div className="text-muted" style={{ fontSize: '0.7rem' }}>Per Pax Rate</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
 
                    {/* Cab Selection */}
                    {bookingDetails.selections?.cab && (
                      <div className="p-2 border mb-2 bg-white shadow-sm rounded">
                        <div className="small mb-1 text-muted fw-bold">Transfer Selection</div>
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="small">{bookingDetails.selections.cab.cabName}</div>
                          <div className="small fw-bold text-primary">{bookingDetails.selections.cab.selectedRate} AED</div>
                        </div>
                      </div>
                    )}
 
                    {/* Activity Selection */}
                    {bookingDetails.selections?.activity && (
                      <div className="p-2 border bg-white shadow-sm rounded">
                        <div className="small mb-1 text-muted fw-bold">Activity Selection</div>
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="small">{bookingDetails.selections.activity.activityName}</div>
                          <div className="small fw-bold text-primary">{bookingDetails.selections.activity.selectedRate} AED</div>
                        </div>
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            </div>
          ) : (
            <div className="text-center py-5">
              <FaExclamationTriangle size={40} className="text-muted mb-3" />
              <p className="text-muted">Booking data is unavailable at this moment.</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-white border-0 px-4 py-3">
          <Button variant="light" className="px-5 fw-bold" onClick={() => setShowDetailsModal(false)}>
            Dismiss
          </Button>
          <Button variant="dark" className="px-5 fw-bold shadow-sm" onClick={() => window.print()}>
            Print Preview
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Verification Modal */}
      <Modal
        show={showVerificationModal}
        onHide={() => setShowVerificationModal(false)}
        size="xl"
        centered
        scrollable
      >
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title className="fw-bold">Package</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {loadingVerification ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3 text-muted">Loading booking details...</p>
            </div>
          ) : verificationDetails ? (
            <div>
              {/* Hotel Section */}
              {verificationDetails.hotelBookingRequest || verificationDetails.hotelDetails ? (
                <div className="mb-4">
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <Badge bg="success" className="px-3 py-2">
                      <FaHotel className="me-1" />
                      Hotel
                    </Badge>
                  </div>
                  {(() => {
                    const hotel = verificationDetails.hotelBookingRequest || verificationDetails.hotelDetails || {};
                    const checkIn = formatDate(hotel.checkInDate || hotel.checkIn);
                    const checkOut = formatDate(hotel.checkOutDate || hotel.checkOut);
                    return (
                      <div className="border rounded p-3 mb-3 bg-light">
                        <div className="fw-bold mb-2">
                          {hotel.hotelName || "Hotel"} ({checkIn} - {checkOut})
                        </div>
                        <Table bordered size="sm" className="mb-0">
                          <tbody>
                            <tr>
                              <td className="fw-semibold" style={{ width: "200px" }}>Booking Code:</td>
                              <td>{hotel.bookingCode || "-"}</td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Booking Status:</td>
                              <td>
                                <Badge bg={hotel.bookingStatus === "CONFIRMED" ? "success" : "warning"}>
                                  {hotel.bookingStatus || "-"}
                                </Badge>
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Confirmation Reference:</td>
                              <td>{hotel.confirmationReference || "-"}</td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Price Reference:</td>
                              <td>{hotel.priceReference || "-"}</td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Supplier Reference:</td>
                              <td>{hotel.supplierReference || "-"}</td>
                            </tr>
                          </tbody>
                        </Table>
                      </div>
                    );
                  })()}
                </div>
              ) : null}

              {/* Activities organized by Day */}
              {verificationDetails.customBookingActivityDTO && 
               Array.isArray(verificationDetails.customBookingActivityDTO) && 
               verificationDetails.customBookingActivityDTO.length > 0 && (
                <div className="mb-4">
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <Badge bg="success" className="px-3 py-2">
                      <FaTicketAlt className="me-1" />
                      Activity
                    </Badge>
                  </div>
                  {(() => {
                    // Group activities by day based on itinerary
                    const activities = verificationDetails.customBookingActivityDTO || [];
                    const itinerary = verificationDetails.customBookingItinearyDTO || [];
                    
                    // Create a map of activities by day
                    const activitiesByDay = {};
                    
                    // First, try to map activities to days using itinerary
                    activities.forEach((activity, idx) => {
                      // Find which day this activity belongs to based on itinerary
                      // Check if itinerary has activityId or itinearyId matching
                      const activityItinerary = itinerary.find(
                        item => item.activityId === activity.activityId || 
                                item.itinearyId === activity.activityId
                      );
                      const day = activityItinerary?.days || (idx === 0 ? 1 : (idx === 1 ? 2 : 3));
                      
                      if (!activitiesByDay[day]) {
                        activitiesByDay[day] = [];
                      }
                      activitiesByDay[day].push(activity);
                    });

                    // If no activities were mapped, distribute them sequentially
                    if (Object.keys(activitiesByDay).length === 0) {
                      activities.forEach((activity, idx) => {
                        const day = idx + 1; // Day 1, 2, 3, etc.
                        if (!activitiesByDay[day]) {
                          activitiesByDay[day] = [];
                        }
                        activitiesByDay[day].push(activity);
                      });
                    }

                    return Object.keys(activitiesByDay)
                      .sort((a, b) => {
                        // Sort days numerically if possible
                        const dayA = parseInt(a);
                        const dayB = parseInt(b);
                        if (!isNaN(dayA) && !isNaN(dayB)) {
                          return dayA - dayB;
                        }
                        return a.localeCompare(b);
                      })
                      .map((dayKey, dayIdx) => {
                        const dayActivities = activitiesByDay[dayKey];
                        const dayNumber = parseInt(dayKey) || dayIdx + 1;
                        
                        return (
                          <div key={dayKey} className="mb-4">
                            <h6 className="text-danger fw-bold mb-3">Day {dayNumber}:</h6>
                            {dayActivities.map((activity, actIdx) => (
                              <div key={actIdx} className="border rounded p-3 mb-3 bg-light">
                                <div className="d-flex align-items-center gap-2 mb-2">
                                  <FaCheckCircle className="text-success" />
                                  <span className="fw-bold">
                                    {activity.activityName || `Activity ${actIdx + 1}`} - {formatDate(activity.tourDate)}
                                  </span>
                                </div>
                                <Table bordered size="sm" className="mb-2">
                                  <tbody>
                                    <tr>
                                      <td className="fw-semibold" style={{ width: "200px" }}>Confirmation Reference:</td>
                                      <td>{activity.confirmationReference || "-"}</td>
                                    </tr>
                                    <tr>
                                      <td className="fw-semibold">Booking Code:</td>
                                      <td>{activity.bookingCode || "-"}</td>
                                    </tr>
                                    <tr>
                                      <td className="fw-semibold">Supplier Reference:</td>
                                      <td>{activity.supplierReference || "-"}</td>
                                    </tr>
                                  </tbody>
                                </Table>
                                {activity.description && (
                                  <div className="mt-2">
                                    <small className="text-muted">{activity.description}</small>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      });
                  })()}
                </div>
              )}

              {/* Transfer Section */}
              {verificationDetails.customBookingCabDTO && 
               Array.isArray(verificationDetails.customBookingCabDTO) && 
               verificationDetails.customBookingCabDTO.length > 0 && (
                <div className="mb-4">
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <Badge bg="success" className="px-3 py-2">
                      <FaCar className="me-1" />
                      Transfer
                    </Badge>
                  </div>
                  {verificationDetails.customBookingCabDTO.map((cab, idx) => {
                    const pickupDate = formatDate(cab.pickupDate);
                    const dropDate = formatDate(cab.dropOffDate);
                    return (
                      <div key={idx} className="border rounded p-3 mb-3 bg-light">
                        <div className="fw-bold mb-2">
                          {cab.cabName || `${cab.noOfCabs || 1} Seater`} ({pickupDate} - {dropDate})
                        </div>
                        <Table bordered size="sm" className="mb-0">
                          <tbody>
                            <tr>
                              <td className="fw-semibold" style={{ width: "200px" }}>Confirmation Reference:</td>
                              <td>{cab.confirmationReference || "-"}</td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Booking Code:</td>
                              <td>{cab.bookingCode || "-"}</td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Supplier Reference:</td>
                              <td>{cab.supplierReference || "-"}</td>
                            </tr>
                          </tbody>
                        </Table>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted">No booking details available</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="danger" 
            onClick={() => setShowVerificationModal(false)}
            disabled={isVerifying}
          >
            Cancel
          </Button>
          <Button 
            variant="success" 
            onClick={handleSetVerified}
            disabled={isVerifying || !verificationDetails}
          >
            {isVerifying ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Verifying...
              </>
            ) : (
              <>
                Set Verified <FaCheckCircle className="ms-2" />
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancellation Modal */}
      <Modal
        show={showCancelModal}
        onHide={() => !isCancelling && setShowCancelModal(false)}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton={!isCancelling} className="border-0">
          <Modal.Title className="fw-bold d-flex align-items-center">
            <FaExclamationCircle className="me-2 text-danger" />
            <span>Cancel Booking</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-4 text-center">
          <p className="fs-5 mb-0">Are you sure you want to cancel this booking?</p>
          {bookingToCancel && (
            <div className="mt-3 text-muted small">
              <div className="fw-bold text-dark">{bookingToCancel.confirmationCode}</div>
              <div>{bookingToCancel.packageName}</div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 justify-content-center pb-4">
          <Button
            variant="secondary"
            className="px-4 fw-bold"
            onClick={() => setShowCancelModal(false)}
            disabled={isCancelling}
          >
            No
          </Button>
          <Button
            variant="danger"
            className="px-4 fw-bold shadow-sm"
            onClick={confirmCancelBooking}
            disabled={isCancelling}
          >
            {isCancelling ? (
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

      {/* Voucher Modal */}
      <Modal
        show={showVoucherModal}
        onHide={closeVoucher}
        centered
        size="xl"
        backdrop="static"
        keyboard={!isSendingVoucher}
      >
        <Modal.Header closeButton={!isSendingVoucher} className="bg-dark text-white border-0">
          <Modal.Title className="d-flex align-items-center gap-2">
            <FaFileAlt className="text-success" />
            <span className="fw-bold">Booking Voucher</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {voucherBooking && (
            <div className="mb-3 d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div className="text-muted small">
                <div className="fw-bold text-dark">{voucherBooking.confirmationCode}</div>
                <div>{voucherBooking.packageName}</div>
              </div>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={handleDownloadVoucher}
                disabled={isLoadingVoucherPdf}
              >
                <FaDownload className="me-2" /> Download PDF
              </Button>
            </div>
          )}

          {/* Inline PDF preview — uses an Object URL so the iframe loads
              same-origin even though the underlying endpoint sends an
              attachment Content-Disposition. */}
          <div
            className="border rounded mb-3"
            style={{ background: "#f8fafc", minHeight: "520px" }}
          >
            {isLoadingVoucherPdf && (
              <div className="text-center text-muted py-5">
                <Spinner animation="border" size="sm" className="me-2" />
                Loading voucher PDF...
              </div>
            )}
            {!isLoadingVoucherPdf && voucherBlobUrl && (
              <iframe
                src={voucherBlobUrl}
                title="Package Booking Voucher"
                style={{ width: "100%", height: "520px", border: "none" }}
              />
            )}
            {!isLoadingVoucherPdf && !voucherBlobUrl && (
              <div className="text-center text-muted py-5">
                Voucher preview unavailable. Try Download or Send Email below.
              </div>
            )}
          </div>

          <Form.Group className="mb-2">
            <Form.Label className="fw-semibold">Send voucher by email</Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <FaEnvelope />
              </InputGroup.Text>
              <Form.Control
                type="email"
                placeholder="recipient@example.com"
                value={voucherEmail}
                onChange={(e) => setVoucherEmail(e.target.value)}
                disabled={isSendingVoucher}
              />
            </InputGroup>
            <Form.Text className="text-muted">
              The voucher PDF will be attached to the email.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button variant="secondary" onClick={closeVoucher} disabled={isSendingVoucher}>
            Close
          </Button>
          <Button
            variant="success"
            onClick={handleSendVoucherEmail}
            disabled={isSendingVoucher || !voucherEmail.trim()}
          >
            {isSendingVoucher ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Sending...
              </>
            ) : (
              <>
                <FaEnvelope className="me-2" /> Send Email
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PackageBookingList;

