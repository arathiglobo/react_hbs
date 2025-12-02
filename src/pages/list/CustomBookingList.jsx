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
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const CustomBookingList = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
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
    try {
      setLoading(true);
      const type = getTypeParam(status);
      const time = getTimeParam(timePeriod);

      const response = await axiosInstance.get(
        `/api/makeYourOwnPackage/getCustomBookingList?type=${type}&time=${time}`
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
  }, [status, timePeriod]);

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
        String(booking.agentName || "").toLowerCase().includes(searchLower)
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
                            <th>Agent Name</th>
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
                                <td>{booking.agentName || "-"}</td>
                                <td>{booking.customerName || "-"}</td>
                                <td> {booking.packageCode || "-"} </td>
                                <td>{formatDate(booking.bookDate)}</td>
                                <td>{formatDate(booking.travelDate)}</td>
                                <td>
                                  <div className="d-flex gap-2 align-items-center">
                                    <FaEye
                                      className="text-primary"
                                      style={{ cursor: "pointer" }}
                                      onClick={() => handleViewDetails(booking)}
                                      title="View Details"
                                      size={18}
                                    />
                                    <FaExclamationTriangle
                                      className="text-warning"
                                      style={{ cursor: "pointer" }}
                                      onClick={() => handleVerificationClick(booking)}
                                      title="Verify Booking"
                                      size={18}
                                    />
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
        size="lg"
        centered
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2">
            <FaEye className="text-primary" />
            Booking Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingDetails ? (
            <div className="text-center py-3">
              <Spinner animation="border" variant="primary" size="sm" />
              <p className="mt-2 text-muted small">Loading...</p>
            </div>
          ) : bookingDetails ? (
            <div>
              {/* Basic Information */}
              <div className="mb-3">
                <h6 className="fw-bold mb-2">Basic Information</h6>
                <Row className="g-2">
                  <Col xs={6}>
                    <small className="text-muted d-block">Package Code</small>
                    <strong className="small">{bookingDetails.packageCode || "-"}</strong>
                  </Col>
                  <Col xs={6}>
                    <small className="text-muted d-block">Booking Date</small>
                    <strong className="small">{formatDate(bookingDetails.bookDate || bookingDetails.bookingDate)}</strong>
                  </Col>
                  <Col xs={6}>
                    <small className="text-muted d-block">Tour Date</small>
                    <strong className="small">{formatDate(bookingDetails.tourDate || bookingDetails.travelDate)}</strong>
                  </Col>
                  <Col xs={6}>
                    <small className="text-muted d-block">Status</small>
                    <Badge bg={getStatusBadge(bookingDetails.status || bookingDetails.bookingStatus)} className="small">
                      {bookingDetails.status || bookingDetails.bookingStatus || "-"}
                    </Badge>
                  </Col>
                  <Col xs={6}>
                    <small className="text-muted d-block">Selling Price</small>
                    <strong className="text-success small">AED {parseFloat(bookingDetails.sellingPrice || 0).toFixed(2)}</strong>
                  </Col>
                  <Col xs={6}>
                    <small className="text-muted d-block">Total Price</small>
                    <strong className="text-primary small">AED {parseFloat(bookingDetails.totalPrice || 0).toFixed(2)}</strong>
                  </Col>
                </Row>
              </div>

              {/* Guest Information - from first hotel or customerDTO */}
              {(bookingDetails.hotelBookingRequest && Array.isArray(bookingDetails.hotelBookingRequest) && bookingDetails.hotelBookingRequest.length > 0 && bookingDetails.hotelBookingRequest[0].primaryGuest) || bookingDetails.customerDTO ? (
                <div className="mb-3">
                  <h6 className="fw-bold mb-2">Primary Guest Information</h6>
                  {(() => {
                    const primaryGuest = bookingDetails.hotelBookingRequest?.[0]?.primaryGuest || bookingDetails.customerDTO || {};
                    return (
                      <Row className="g-2">
                        <Col xs={12}>
                          <small className="text-muted d-block">Name</small>
                          <strong className="small">
                            {primaryGuest.salutation || ""}{" "}
                            {primaryGuest.firstName || ""}{" "}
                            {primaryGuest.middleName || ""}{" "}
                            {primaryGuest.lastName || ""}
                          </strong>
                        </Col>
                        <Col xs={12}>
                          <small className="text-muted d-block">Email</small>
                          <strong className="small">{primaryGuest.email || primaryGuest.emailId || "-"}</strong>
                        </Col>
                        <Col xs={6}>
                          <small className="text-muted d-block">Phone</small>
                          <strong className="small">{primaryGuest.phone || primaryGuest.mobileNumber || "-"}</strong>
                        </Col>
                        <Col xs={6}>
                          <small className="text-muted d-block">Passport</small>
                          <strong className="small">{primaryGuest.passportNo || "-"}</strong>
                        </Col>
                        <Col xs={6}>
                          <small className="text-muted d-block">Nationality</small>
                          <strong className="small">{primaryGuest.nativeCountry || "-"}</strong>
                        </Col>
                        <Col xs={6}>
                          <small className="text-muted d-block">LPO</small>
                          <strong className="small">{primaryGuest.agentLpo || primaryGuest.agentlpo || "-"}</strong>
                        </Col>
                      </Row>
                    );
                  })()}
                </div>
              ) : null}

              {/* Hotel Details - Handle array of hotels */}
              {bookingDetails.hotelBookingRequest && Array.isArray(bookingDetails.hotelBookingRequest) && bookingDetails.hotelBookingRequest.length > 0 ? (
                <div className="mb-3">
                  <h6 className="fw-bold mb-2">Hotel Details ({bookingDetails.hotelBookingRequest.length})</h6>
                  {bookingDetails.hotelBookingRequest.map((hotel, hotelIdx) => (
                    <div key={hotelIdx} className="mb-3 p-2 border rounded">
                      <h6 className="fw-bold small mb-2">
                        {bookingDetails.hotelBookingRequest.length > 1 ? `Hotel ${hotelIdx + 1}: ` : ""}
                        {hotel.hotelName || "-"}
                      </h6>
                      <Row className="g-2">
                        <Col xs={12}>
                          <small className="text-muted d-block">Address</small>
                          <strong className="small">{hotel.address || "-"}</strong>
                        </Col>
                        <Col xs={6}>
                          <small className="text-muted d-block">Check-in</small>
                          <strong className="small">{formatDate(hotel.checkInDate || hotel.checkIn)}</strong>
                        </Col>
                        <Col xs={6}>
                          <small className="text-muted d-block">Check-out</small>
                          <strong className="small">{formatDate(hotel.checkOutDate || hotel.checkOut)}</strong>
                        </Col>
                        <Col xs={4}>
                          <small className="text-muted d-block">Nights</small>
                          <strong className="small">{hotel.nights || "-"}</strong>
                        </Col>
                        <Col xs={4}>
                          <small className="text-muted d-block">Star Rating</small>
                          <strong className="small">{hotel.starRating || "-"}</strong>
                        </Col>
                        <Col xs={4}>
                          <small className="text-muted d-block">Status</small>
                          <Badge bg={hotel.roomStatus === "Available" || hotel.roomStatus === "Confirmed" ? "success" : hotel.roomStatus === "Not Confirmed" ? "warning" : "secondary"} className="small">
                            {hotel.roomStatus || "-"}
                          </Badge>
                        </Col>
                        {hotel.primaryGuest && (
                          <Col xs={12}>
                            <small className="text-muted d-block">Primary Guest</small>
                            <strong className="small">
                              {hotel.primaryGuest.salutation || ""} {hotel.primaryGuest.firstName || ""} {hotel.primaryGuest.lastName || ""}
                            </strong>
                            <div className="small text-muted">
                              {hotel.primaryGuest.email && `Email: ${hotel.primaryGuest.email}`}
                              {hotel.primaryGuest.phone && ` | Phone: ${hotel.primaryGuest.phone}`}
                            </div>
                          </Col>
                        )}
                        {hotel.rooms && Array.isArray(hotel.rooms) && hotel.rooms.length > 0 && (
                          <Col xs={12}>
                            <small className="text-muted d-block mb-1">Rooms</small>
                            <Table striped bordered size="sm" className="small">
                              <thead>
                                <tr>
                                  <th>Room</th>
                                  <th>Category</th>
                                  <th>Meal Plan</th>
                                  <th>Adults</th>
                                  <th>Children</th>
                                  <th>Rate</th>
                                  <th>Non-Refundable</th>
                                </tr>
                              </thead>
                              <tbody>
                                {hotel.rooms.map((room, idx) => (
                                  <tr key={idx}>
                                    <td>{room.roomNo || idx + 1}</td>
                                    <td>{room.roomCategory || "-"}</td>
                                    <td>{room.mealPlan || "-"}</td>
                                    <td>{room.adults || 0}</td>
                                    <td>{room.children || 0}</td>
                                    <td>{room.currency || "AED"} {room.rate || room.rateWithoutMarkup || 0}</td>
                                    <td>
                                      <Badge bg={room.nonRefundable ? "danger" : "success"} className="small">
                                        {room.nonRefundable ? "Yes" : "No"}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                            {hotel.rooms.some(room => room.guests && room.guests.length > 0) && (
                              <div className="mt-2">
                                <small className="text-muted d-block mb-1">Room Guests</small>
                                {hotel.rooms.map((room, roomIdx) => (
                                  room.guests && room.guests.length > 0 && (
                                    <div key={roomIdx} className="mb-1 small">
                                      <strong>Room {room.roomNo || roomIdx + 1}:</strong>{" "}
                                      {room.guests.map((guest, guestIdx) => (
                                        <span key={guestIdx}>
                                          {guest.salutation || ""} {guest.firstName || ""} {guest.lastName || ""}
                                          {guest.isChild && " (Child)"}
                                          {guestIdx < room.guests.length - 1 && ", "}
                                        </span>
                                      ))}
                                    </div>
                                  )
                                ))}
                              </div>
                            )}
                          </Col>
                        )}
                        {hotel.remarks && (
                          <Col xs={12}>
                            <small className="text-muted d-block">Remarks</small>
                            <strong className="small">{hotel.remarks}</strong>
                          </Col>
                        )}
                        {hotel.specialRequests && (
                          <Col xs={12}>
                            <small className="text-muted d-block">Special Requests</small>
                            <strong className="small">{hotel.specialRequests}</strong>
                          </Col>
                        )}
                        {hotel.cancellationPolicy && Array.isArray(hotel.cancellationPolicy) && hotel.cancellationPolicy.length > 0 && (
                          <Col xs={12}>
                            <small className="text-muted d-block">Cancellation Policy</small>
                            <ul className="small mb-0">
                              {hotel.cancellationPolicy.map((policy, policyIdx) => (
                                <li key={policyIdx}>{typeof policy === 'string' ? policy : policy.policyText || JSON.stringify(policy)}</li>
                              ))}
                            </ul>
                          </Col>
                        )}
                        {hotel.deadlineDate && (
                          <Col xs={12}>
                            <small className="text-muted d-block">Deadline Date</small>
                            <strong className="small">{formatDate(hotel.deadlineDate)}</strong>
                          </Col>
                        )}
                      </Row>
                    </div>
                  ))}
                </div>
              ) : bookingDetails.hotelDetails ? (
                <div className="mb-3">
                  <h6 className="fw-bold mb-2">Hotel Details</h6>
                  <Row className="g-2">
                    <Col xs={12}>
                      <small className="text-muted d-block">Hotel Name</small>
                      <strong className="small">{bookingDetails.hotelDetails.hotelName || "-"}</strong>
                    </Col>
                  </Row>
                </div>
              ) : null}

              {/* Activity Details */}
              {bookingDetails.customBookingActivityDTO && Array.isArray(bookingDetails.customBookingActivityDTO) && bookingDetails.customBookingActivityDTO.length > 0 && (
                <div className="mb-3">
                  <h6 className="fw-bold mb-2">Activities ({bookingDetails.customBookingActivityDTO.length})</h6>
                  <Table striped bordered size="sm" className="small">
                    <thead>
                      <tr>
                        <th>Activity ID</th>
                        <th>Date</th>
                        <th>Adults</th>
                        <th>Children</th>
                        <th>Selling Price</th>
                        <th>Total Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookingDetails.customBookingActivityDTO.map((activity, idx) => (
                        <tr key={idx}>
                          <td>{activity.activityId || activity.activityName || `Activity ${idx + 1}`}</td>
                          <td>{formatDate(activity.tourDate)}</td>
                          <td>{activity.noOfAdult || 0}</td>
                          <td>{activity.noOfChild || 0}</td>
                          <td>AED {parseFloat(activity.sellingPrice || 0).toFixed(2)}</td>
                          <td>AED {parseFloat(activity.totalPrice || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {/* Transfer Details */}
              {bookingDetails.customBookingCabDTO && Array.isArray(bookingDetails.customBookingCabDTO) && bookingDetails.customBookingCabDTO.length > 0 && (
                <div className="mb-3">
                  <h6 className="fw-bold mb-2">Transfers ({bookingDetails.customBookingCabDTO.length})</h6>
                  {bookingDetails.customBookingCabDTO.map((cab, idx) => (
                    <div key={idx} className="mb-3 p-2 border rounded">
                      <h6 className="fw-bold small mb-2">
                        {bookingDetails.customBookingCabDTO.length > 1 ? `Transfer ${idx + 1}` : "Transfer Details"}
                      </h6>
                      <Row className="g-2">
                        <Col xs={6}>
                          <small className="text-muted d-block">Pickup Date</small>
                          <strong className="small">{formatDate(cab.pickupDate)}</strong>
                        </Col>
                        <Col xs={6}>
                          <small className="text-muted d-block">Drop-off Date</small>
                          <strong className="small">{formatDate(cab.dropOffDate)}</strong>
                        </Col>
                        <Col xs={4}>
                          <small className="text-muted d-block">Adults</small>
                          <strong className="small">{cab.noOfAdult || 0}</strong>
                        </Col>
                        <Col xs={4}>
                          <small className="text-muted d-block">Children</small>
                          <strong className="small">{cab.noOfChild || 0}</strong>
                        </Col>
                        <Col xs={4}>
                          <small className="text-muted d-block">No. of Cabs</small>
                          <strong className="small">{cab.noOfCabs || 1}</strong>
                        </Col>
                        <Col xs={6}>
                          <small className="text-muted d-block">Travel Type</small>
                          <strong className="small">
                            {cab.travelType === 1 ? "Arrival & Departure" : cab.travelType === 2 ? "Arrival" : cab.travelType === 3 ? "Departure" : cab.travelType}
                          </strong>
                        </Col>
                        <Col xs={6}>
                          <small className="text-muted d-block">Luggage</small>
                          <Badge bg={cab.luggage ? "success" : "secondary"} className="small">
                            {cab.luggage ? "Yes" : "No"}
                          </Badge>
                        </Col>
                        {cab.transporter && (
                          <Col xs={6}>
                            <small className="text-muted d-block">Transporter Name</small>
                            <strong className="small">{cab.transporter}</strong>
                          </Col>
                        )}
                        {cab.contactNumber && (
                          <Col xs={6}>
                            <small className="text-muted d-block">Contact Number</small>
                            <strong className="small">{cab.contactNumber}</strong>
                          </Col>
                        )}
                        {cab.driverName && (
                          <Col xs={6}>
                            <small className="text-muted d-block">Driver Name</small>
                            <strong className="small">{cab.driverName}</strong>
                          </Col>
                        )}
                        {cab.driverContact && (
                          <Col xs={6}>
                            <small className="text-muted d-block">Driver Contact</small>
                            <strong className="small">{cab.driverContact}</strong>
                          </Col>
                        )}
                        <Col xs={6}>
                          <small className="text-muted d-block">Total Rate</small>
                          <strong className="small">AED {parseFloat(cab.totalRate || 0).toFixed(2)}</strong>
                        </Col>
                        <Col xs={6}>
                          <small className="text-muted d-block">Rate Without Markup</small>
                          <strong className="small">AED {parseFloat(cab.totalRateWithoutmrk || 0).toFixed(2)}</strong>
                        </Col>
                      </Row>
                    </div>
                  ))}
                </div>
              )}

              {/* Visa Information */}
              <div className="mb-3">
                <h6 className="fw-bold mb-2">Visa Information</h6>
                <Row className="g-2">
                  <Col xs={6}>
                    <small className="text-muted d-block">Visa Required</small>
                    <Badge bg={bookingDetails.visaStatus ? "success" : "secondary"} className="small">
                      {bookingDetails.visaStatus ? "Yes" : "No"}
                    </Badge>
                  </Col>
                  {bookingDetails.visaStatus && (
                    <>
                      <Col xs={6}>
                        <small className="text-muted d-block">Adults</small>
                        <strong className="small">{bookingDetails.visaAdult || 0}</strong>
                      </Col>
                      <Col xs={6}>
                        <small className="text-muted d-block">Adult Rate</small>
                        <strong className="small">AED {parseFloat(bookingDetails.visaAdultRate || 0).toFixed(2)}</strong>
                      </Col>
                      <Col xs={6}>
                        <small className="text-muted d-block">Children</small>
                        <strong className="small">{bookingDetails.visaChild || 0}</strong>
                      </Col>
                      <Col xs={6}>
                        <small className="text-muted d-block">Child Rate</small>
                        <strong className="small">AED {parseFloat(bookingDetails.visaChildRate || 0).toFixed(2)}</strong>
                      </Col>
                      <Col xs={6}>
                        <small className="text-muted d-block">Infants</small>
                        <strong className="small">{bookingDetails.visaInfant || 0}</strong>
                      </Col>
                      <Col xs={6}>
                        <small className="text-muted d-block">Infant Rate</small>
                        <strong className="small">AED {parseFloat(bookingDetails.visaInfantRate || 0).toFixed(2)}</strong>
                      </Col>
                    </>
                  )}
                </Row>
              </div>

              {/* Itinerary Details */}
              {bookingDetails.customBookingItinearyDTO && Array.isArray(bookingDetails.customBookingItinearyDTO) && bookingDetails.customBookingItinearyDTO.length > 0 && (
                <div className="mb-3">
                  <h6 className="fw-bold mb-2">Itineraries ({bookingDetails.customBookingItinearyDTO.length})</h6>
                  <Table striped bordered size="sm" className="small">
                    <thead>
                      <tr>
                        <th>Itinerary ID</th>
                        <th>Day</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookingDetails.customBookingItinearyDTO.map((itinerary, idx) => (
                        <tr key={idx}>
                          <td>{itinerary.itinearyId || "-"}</td>
                          <td>Day {itinerary.days || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-3">
              <p className="text-muted small">No booking details available</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowDetailsModal(false)}>
            Close
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
    </div>
  );
};

export default CustomBookingList;

