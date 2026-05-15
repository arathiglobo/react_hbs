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
  FaTrash,
  FaExclamationCircle,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const CustomBookingList = () => {
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
      const type = getTypeParam(status);
      const time = getTimeParam(timePeriod);

      const params = {
        type,
        time
      };

      // Role-based filtering
      if (role === "agent" && userId) {
        params.agentId = userId;
      } else if (role === "staff" && userId) {
        params.staffId = userId;
      }

      console.log("Custom Booking API Request -> /api/makeYourOwnPackage/getCustomBookingList with params:", params);

      const response = await axiosInstance.get(
        "/api/makeYourOwnPackage/getCustomBookingList",
        { params }
      );

      if (Array.isArray(response.data)) {
        setAllBookings(response.data || []);
      } else {
        setAllBookings([]);
      }
    } catch (error) {
      console.error("Error fetching custom bookings:", error);
      toast.error("Failed to load bookings");
      setAllBookings([]);
    } finally {
      setLoading(false);
    }
  }, [status, timePeriod, role, userId]);

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
        String(booking.packageCode || "").toLowerCase().includes(searchLower) ||
        String(booking.customerName || "").toLowerCase().includes(searchLower) ||
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
      
      // Get customBookingId from booking object
      const customBookingId = booking.customBookingId || booking.bookingId || booking.id;
      
      console.log("Booking object:", booking);
      console.log("Using customBookingId:", customBookingId);
      
      if (!customBookingId) {
        toast.error("Booking ID not found");
        setShowDetailsModal(false);
        return;
      }

      const response = await axiosInstance.get(
        `/api/makeYourOwnPackage/getCustomBookingDetails/${customBookingId}`
      );

      console.log("Booking Details API Response:", response.data);

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
      const bookingId = bookingToCancel.customBookingId || bookingToCancel.bookingId || bookingToCancel.id;
      
      const response = await axiosInstance.patch(`/api/makeYourOwnPackage/cancelCustomBooking/${bookingId}`);

      if (response.data && response.data.status === "success") {
        toast.success("cancelled successfully");
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
                <h2 className="mb-0 fw-bold">Custom Booking</h2> 
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
                {/* Filters */}
                <Row className="mb-3 g-3">
                  <Col md={6}>
                    <div>
                      <h6 className="mb-2 fw-semibold">Type Of Booking</h6>
                      <div className="d-flex gap-3">
                        <Form.Check
                          type="radio"
                          id="upcoming"
                          name="bookingType"
                          label="Upcoming"
                          checked={status === "upcoming"}
                          onChange={() => setStatus("upcoming")}
                          className="fw-semibold"
                        />
                        <Form.Check
                          type="radio"
                          id="completed"
                          name="bookingType"
                          label="Completed"
                          checked={status === "completed"}
                          onChange={() => setStatus("completed")}
                          className="fw-semibold"
                        />
                        <Form.Check
                          type="radio"
                          id="cancelled"
                          name="bookingType"
                          label="Cancelled"
                          checked={status === "cancelled"}
                          onChange={() => setStatus("cancelled")}
                          className="fw-semibold"
                        />
                      </div>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div>
                      <h6 className="mb-2 fw-semibold">Time Period</h6>
                      <div className="d-flex gap-3">
                        <Form.Check
                          type="radio"
                          id="currentMonth"
                          name="timePeriod"
                          label="Current Month"
                          checked={timePeriod === "currentMonth"}
                          onChange={() => setTimePeriod("currentMonth")}
                          className="fw-semibold"
                        />
                        <Form.Check
                          type="radio"
                          id="all"
                          name="timePeriod"
                          label="All"
                          checked={timePeriod === "all"}
                          onChange={() => setTimePeriod("all")}
                          className="fw-semibold"
                        />
                      </div>
                    </div>
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
                            {role === "admin" && <th>Agent Name</th>}
                            <th>Customer Name</th>
                            <th>Package Code</th>
                            <th>Book Date</th>
                            <th>Tour Date</th>
                            <th style={{ width: "120px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedBookings.length > 0 ? (
                            paginatedBookings.map((booking, index) => (
                              <tr key={booking.packageCode || index}>
                                <td>{(page - 1) * perPage + index + 1}</td>
                                {role === "admin" && <td>{booking.agentName || "-"}</td>}
                                <td>{booking.customerName || "-"}</td>
                                <td> {booking.packageCode || "-"} </td>
                                <td>{formatDate(booking.bookDate)}</td>
                                <td>{formatDate(booking.travelDate)}</td>
                                <td>
                                  <div className="d-flex gap-3 align-items-center">
                                    <FaEye
                                      style={{ cursor: "pointer", fontSize: "14px", color: "#007bff" }}
                                      onClick={() => handleViewDetails(booking)}
                                      title="View Details"
                                    />
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
              {/* Summary Cards */}
              <Row className="mb-3">
                <Col md={3}>
                  <div className="border p-2">
                    <div className="text-muted mb-1" style={{ fontSize: '0.6rem' }}>PACKAGE CODE</div>
                    <div className="text-break" style={{ fontSize: '0.9rem' }}>{bookingDetails.packageCode || "-"}</div>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="border p-2">
                    <div className="text-muted mb-1" style={{ fontSize: '0.6rem' }}>BOOKING DATE</div>
                    <div className="text-break" style={{ fontSize: '0.9rem' }}>{formatDate(bookingDetails.bookDate || bookingDetails.bookingDate)}</div>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="border p-2">
                    <div className="text-muted mb-1" style={{ fontSize: '0.6rem' }}>TOUR DATE</div>
                    <div className="text-break" style={{ fontSize: '0.9rem' }}>{formatDate(bookingDetails.tourDate || bookingDetails.travelDate)}</div>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="border p-2">
                    <div className="text-muted mb-1" style={{ fontSize: '0.6rem' }}>STATUS</div>
                    <div style={{ fontSize: '0.9rem' }}>{(bookingDetails.status || bookingDetails.bookingStatus || "N/A")}</div>
                  </div>
                </Col>
              </Row>

              <Row className="g-4">
                {/* Left Column: Guest & Basic Info */}
                <Col lg={4}>
                  <div className="border mb-3 p-3">
                    <h6 className="mb-3">Contact Person</h6>
                    {(() => {
                      const guest = bookingDetails.hotelBookingRequest?.[0]?.primaryGuest || bookingDetails.customerDTO || {};
                      return (
                        <div className="d-flex flex-column gap-2">
                          <div className="mb-2">
                            <label className="text-muted mb-0 d-block small">Primary Contact</label>
                            <div className="small">
                              {guest.salutation || ""} {guest.firstName || ""} {guest.lastName || ""}
                            </div>
                          </div>
                          <div className="mb-2">
                            <label className="text-muted mb-0 d-block small">Email Address</label>
                            <div className="small text-break">{guest.email || guest.emailId || "-"}</div>
                          </div>
                          <Row className="mb-2">
                              <Col xs={6}>
                                <label className="text-muted mb-0 d-block small">Phone</label>
                                <div className="small">{guest.phone || guest.mobileNumber || "-"}</div>
                              </Col>
                              <Col xs={6}>
                                <label className="text-muted mb-0 d-block small">Nationality</label>
                                <div className="small">{guest.nativeCountry || "-"}</div>
                              </Col>
                          </Row>

                          {/* All Guests Summary */}
                          <div className="mt-2 pt-2 border-top">
                            <div className="mb-1 small">Guest List ({bookingDetails.hotelBookingRequest?.reduce((acc, h) => acc + h.rooms?.reduce((rAcc, r) => rAcc + (r.guests?.length || 0), 0), 0) || 0})</div>
                            <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                              {bookingDetails.hotelBookingRequest?.map((hotel) => 
                                hotel.rooms?.map((room) => 
                                  room.guests?.map((g, idx) => (
                                    <div key={`${room.roomNo}-${idx}`} className="small py-1 border-bottom last-child-border-0 d-flex justify-content-between align-items-center">
                                      <span style={{ fontSize: '0.7rem' }}>{g.salutation} {g.firstName} {g.lastName}</span>
                                      <span className="text-muted" style={{ fontSize: '0.65rem' }}>{room.roomCategory}</span>
                                    </div>
                                  ))
                                )
                              )}
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-top">
                            <Row className="g-2">
                              <Col xs={6}>
                                <div>
                                  <label className="text-muted d-block mb-0 small">Selling</label>
                                  <span className="small">{parseFloat(bookingDetails.sellingPrice || 0).toLocaleString()} AED</span>
                                </div>
                              </Col>
                              <Col xs={6}>
                                <div>
                                  <label className="text-muted d-block mb-0 small">Cost</label>
                                  <span className="small">{parseFloat(bookingDetails.totalPrice || 0).toLocaleString()} AED</span>
                                </div>
                              </Col>
                            </Row>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </Col>

                {/* Right Column: Hotel & Activities */}
                <Col lg={8}>
                  {/* Hotel Section */}
                  {bookingDetails.hotelBookingRequest?.length > 0 && (
                    <div className="border mb-3 p-3">
                      <h6>Hotel Reservations</h6>
                      {bookingDetails.hotelBookingRequest.map((hotel, hIdx) => (
                        <div key={hIdx} className={`py-3 ${hIdx > 0 ? 'border-top' : ''}`}>
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <div>
                              <div className="small">{hotel.hotelName}</div>
                              <div className="text-muted" style={{ fontSize: '0.7rem' }}>{hotel.address}</div>
                            </div>
                            <div className="small text-muted">{hotel.roomStatus}</div>
                          </div>
                          <Row className="mb-3 g-2 border p-2">
                            <Col md={3} xs={6}>
                              <label className="text-muted d-block mb-0 small">Check-In</label>
                              <span className="small">{formatDate(hotel.checkInDate || hotel.checkIn)}</span>
                            </Col>
                            <Col md={3} xs={6}>
                              <label className="text-muted d-block mb-0 small">Check-Out</label>
                              <span className="small">{formatDate(hotel.checkOutDate || hotel.checkOut)}</span>
                            </Col>
                            <Col md={3} xs={6}>
                              <label className="text-muted d-block mb-0 small">Duration</label>
                              <span className="small">{hotel.nights} Nights</span>
                            </Col>
                            <Col md={3} xs={6}>
                              <label className="text-muted d-block mb-0 small">Rating</label>
                              <div className="small">{hotel.starRating} Stars</div>
                            </Col>
                          </Row>
                          {hotel.rooms?.length > 0 && (
                            <div className="mb-2">
                              <div className="mb-1 small">Room Details</div>
                              <Table size="sm" className="mb-0 border">
                                <thead className="bg-light">
                                  <tr className="text-muted" style={{ fontSize: '0.65rem' }}>
                                    <th>Room Category</th>
                                    <th className="text-center">Pax</th>
                                    <th>Guests</th>
                                    <th className="text-end">Rate</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {hotel.rooms.map((room, rIdx) => (
                                    <tr key={rIdx} style={{ fontSize: '0.75rem' }}>
                                      <td>
                                        <div>{room.roomCategory}</div>
                                        <div className="text-muted" style={{ fontSize: '0.65rem' }}>{room.mealPlan}</div>
                                      </td>
                                      <td className="text-center">{room.adults}A / {room.children}C</td>
                                      <td>
                                        {room.guests?.map((g, gIdx) => (
                                          <div key={gIdx} style={{ fontSize: '0.7rem' }}>
                                            • {g.salutation} {g.firstName} {g.lastName}
                                          </div>
                                        )) || "-"}
                                      </td>
                                      <td className="text-end">{parseFloat(room.rate).toLocaleString()} AED</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </div>
                          )}

                          {/* Cancellation Policy */}
                          {hotel.cancellationPolicy?.length > 0 && (
                            <div className="mt-2 p-2 border">
                              <div className="small mb-1">Cancellation Policy</div>
                              <ul className="mb-0 ps-3 text-muted" style={{ fontSize: '0.65rem' }}>
                                {hotel.cancellationPolicy.map((policy, pIdx) => (
                                  <li key={pIdx}>{policy}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Activity Section */}
                  {bookingDetails.customBookingActivityDTO?.length > 0 && (
                    <Card className="border-0 shadow-sm mb-4 rounded-4 overflow-hidden">
                      <div className="bg-white p-3 border-bottom d-flex align-items-center gap-2">
                        <FaTicketAlt className="text-primary" />
                        <h6 className="mb-0 fw-bold">Booked Activities</h6>
                      </div>
                      <Card.Body className="p-0">
                        <Table hover responsive className="mb-0 small align-middle">
                          <thead className="bg-light">
                            <tr className="text-muted">
                              <th className="ps-4">Activity Description</th>
                              <th>Tour Date</th>
                              <th>Pax</th>
                              <th className="text-end pe-4">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bookingDetails.customBookingActivityDTO.map((act, aIdx) => (
                              <tr key={aIdx}>
                                <td className="ps-4 py-3 fw-medium">{act.activityName || act.activityId || "Activity Service"}</td>
                                <td>{formatDate(act.tourDate)}</td>
                                <td>{act.noOfAdult}A / {act.noOfChild}C</td>
                                <td className="text-end pe-4 fw-bold text-success">AED {parseFloat(act.totalPrice).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                  )}

                  {/* Transfer Section */}
                  {bookingDetails.customBookingCabDTO?.length > 0 && (
                    <Card className="border-0 shadow-sm mb-4 rounded-4 overflow-hidden">
                      <div className="bg-white p-3 border-bottom d-flex align-items-center gap-2">
                        <FaCar className="text-primary" />
                        <h6 className="mb-0 fw-bold">Transfer Details</h6>
                      </div>
                      <Card.Body className="p-3">
                        <Row className="g-3">
                          {bookingDetails.customBookingCabDTO.map((cab, cIdx) => (
                            <Col md={6} key={cIdx}>
                              <div className="border rounded-3 p-3 h-100 bg-white shadow-none">
                                <div className="d-flex justify-content-between mb-2">
                                  <span className="fw-bold text-primary">{cab.cabName || "Transfer"}</span>
                                  <Badge bg="info">{cab.travelType === 1 ? "Round Trip" : "One Way"}</Badge>
                                </div>
                                <div className="small text-muted mb-2">
                                  <FaCalendarAlt size={10} className="me-1" /> {formatDate(cab.pickupDate)}
                                </div>
                                <div className="d-flex justify-content-between align-items-end pt-2 border-top">
                                  <span className="small text-muted">{cab.noOfAdult}A / {cab.noOfChild}C</span>
                                  <span className="fw-bold text-dark">AED {parseFloat(cab.totalPrice || cab.totalRate).toFixed(2)}</span>
                                </div>
                              </div>
                            </Col>
                          ))}
                        </Row>
                      </Card.Body>
                    </Card>
                  )}

                  {/* Visa & Other Info */}
                  <Row className="g-3">
                    <Col md={6}>
                       <div className="border h-100 p-3">
                         <div className="mb-2 small">Visa Details</div>
                         <Row className="g-2">
                           <Col xs={12}>
                             <div className="d-flex justify-content-between align-items-center">
                               <span className="small">Visa Status:</span>
                               <span className="small">{bookingDetails.visaStatus ? "Required" : "Not Required"}</span>
                             </div>
                           </Col>
                           {bookingDetails.visaStatus && (
                             <Col xs={12}>
                               <div className="border p-2">
                                 <div className="small mb-1 text-muted">Breakdown</div>
                                 <div className="d-flex justify-content-between small">
                                   <span>Adults:</span>
                                   <span>{bookingDetails.visaAdult} x {bookingDetails.visaAdultRate}</span>
                                 </div>
                                 <div className="d-flex justify-content-between small">
                                   <span>Children:</span>
                                   <span>{bookingDetails.visaChild} x {bookingDetails.visaChildRate}</span>
                                 </div>
                               </div>
                             </Col>
                           )}
                         </Row>
                       </div>
                    </Col>
                    <Col md={6}>
                       <div className="border h-100 p-3">
                         <div className="mb-2 small">Remarks</div>
                         <div className="small text-muted mb-2">
                           {bookingDetails.hotelBookingRequest?.[0]?.remarks || bookingDetails.remarks || "None"}
                         </div>
                       </div>
                    </Col>
                  </Row>
                </Col>
              </Row>

              {/* ── Add-On Services ─────────────────────────────────
                  Renders when the side-panel selection was saved with
                  the booking. We iterate the parsed JSON object so any
                  catalogue future-additions surface automatically. */}
              {bookingDetails.addOnServices &&
                typeof bookingDetails.addOnServices === "object" &&
                Object.keys(bookingDetails.addOnServices).length > 0 && (
                  <Row className="mt-4">
                    <Col xs={12}>
                      <div className="p-3 bg-white rounded shadow-sm">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="fw-bold mb-0">Add-On Services</h6>
                          <span className="badge bg-success-subtle text-success">
                            {Object.keys(bookingDetails.addOnServices).length} selected
                          </span>
                        </div>
                        <Row className="g-2">
                          {Object.entries(bookingDetails.addOnServices).map(
                            ([key, value]) => {
                              if (!value || typeof value !== "object") return null;
                              const label = key
                                .replace(/([A-Z])/g, " $1")
                                .replace(/^./, (c) => c.toUpperCase())
                                .trim();
                              const detailFields = Object.entries(value).filter(
                                ([k, v]) =>
                                  k !== "enabled" &&
                                  v !== "" &&
                                  v != null &&
                                  v !== false
                              );
                              return (
                                <Col md={6} key={key}>
                                  <div className="border rounded p-2 h-100 bg-light bg-opacity-50">
                                    <div className="fw-semibold text-dark small mb-1">
                                      {label}
                                    </div>
                                    {detailFields.length === 0 ? (
                                      <div className="text-muted small fst-italic">
                                        Enabled (no extra details)
                                      </div>
                                    ) : (
                                      detailFields.map(([fk, fv]) => (
                                        <div
                                          key={fk}
                                          className="d-flex justify-content-between small"
                                        >
                                          <span className="text-muted text-capitalize">
                                            {fk.replace(/([A-Z])/g, " $1")}
                                          </span>
                                          <span className="text-dark fw-medium ms-2">
                                            {String(fv)}
                                          </span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </Col>
                              );
                            }
                          )}
                        </Row>
                      </div>
                    </Col>
                  </Row>
                )}
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
              <div className="fw-bold text-dark">{bookingToCancel.packageCode}</div>
              <div>{bookingToCancel.customerName}</div>
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
    </div>
  );
};

export default CustomBookingList;

