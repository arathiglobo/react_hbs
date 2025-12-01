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
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3 text-muted">Loading booking details...</p>
            </div>
          ) : bookingDetails ? (
            <div className="booking-details-content">
              {/* Basic Information */}
              <Card className="mb-3">
                <Card.Header className="bg-primary text-white">
                  <h6 className="mb-0 fw-bold">Basic Information</h6>
                </Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={6}>
                      <div>
                        <small className="text-muted d-block mb-1">Package Code</small>
                        <strong>{bookingDetails.packageCode || "-"}</strong>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div>
                        <small className="text-muted d-block mb-1">Booking Date</small>
                        <strong>{formatDate(bookingDetails.bookDate || bookingDetails.bookingDate)}</strong>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div>
                        <small className="text-muted d-block mb-1">Tour Date</small>
                        <strong>{formatDate(bookingDetails.tourDate || bookingDetails.travelDate)}</strong>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div>
                        <small className="text-muted d-block mb-1">Status</small>
                        <Badge bg={getStatusBadge(bookingDetails.status || bookingDetails.bookingStatus)}>
                          {bookingDetails.status || bookingDetails.bookingStatus || "-"}
                        </Badge>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div>
                        <small className="text-muted d-block mb-1">Selling Price</small>
                        <strong className="text-success">AED {parseFloat(bookingDetails.sellingPrice || 0).toFixed(2)}</strong>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div>
                        <small className="text-muted d-block mb-1">Total Price</small>
                        <strong className="text-primary">AED {parseFloat(bookingDetails.totalPrice || 0).toFixed(2)}</strong>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Guest Information */}
              {bookingDetails.primaryGuest || bookingDetails.customerDTO ? (
                <Card className="mb-3">
                  <Card.Header className="bg-info text-white">
                    <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                      <FaUsers />
                      Guest Information
                    </h6>
                  </Card.Header>
                  <Card.Body>
                    <Row className="g-3">
                      <Col md={6}>
                        <div>
                          <small className="text-muted d-block mb-1">Name</small>
                          <strong>
                            {bookingDetails.primaryGuest?.salutation || bookingDetails.customerDTO?.salutaion || ""}{" "}
                            {bookingDetails.primaryGuest?.firstName || bookingDetails.customerDTO?.firstName || ""}{" "}
                            {bookingDetails.primaryGuest?.lastName || bookingDetails.customerDTO?.lastName || ""}
                          </strong>
                        </div>
                      </Col>
                      <Col md={6}>
                        <div>
                          <small className="text-muted d-block mb-1">Email</small>
                          <strong>{bookingDetails.primaryGuest?.email || bookingDetails.customerDTO?.emailId || "-"}</strong>
                        </div>
                      </Col>
                      <Col md={6}>
                        <div>
                          <small className="text-muted d-block mb-1">Phone</small>
                          <strong>{bookingDetails.primaryGuest?.phone || bookingDetails.customerDTO?.mobileNumber || "-"}</strong>
                        </div>
                      </Col>
                      <Col md={6}>
                        <div>
                          <small className="text-muted d-block mb-1">Passport Number</small>
                          <strong>{bookingDetails.primaryGuest?.passportNo || bookingDetails.customerDTO?.passportNo || "-"}</strong>
                        </div>
                      </Col>
                      <Col md={6}>
                        <div>
                          <small className="text-muted d-block mb-1">LPO</small>
                          <strong>{bookingDetails.primaryGuest?.agentlpo || bookingDetails.customerDTO?.agentlpo || "-"}</strong>
                        </div>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              ) : null}

              {/* Hotel Details */}
              {bookingDetails.hotelBookingRequest || bookingDetails.hotelDetails ? (
                <Card className="mb-3">
                  <Card.Header className="bg-warning text-dark">
                    <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                      <FaHotel />
                      Hotel Details
                    </h6>
                  </Card.Header>
                  <Card.Body>
                    {(() => {
                      const hotel = bookingDetails.hotelBookingRequest || bookingDetails.hotelDetails || {};
                      return (
                        <Row className="g-3">
                          <Col md={12}>
                            <div>
                              <small className="text-muted d-block mb-1">Hotel Name</small>
                              <strong>{hotel.hotelName || "-"}</strong>
                            </div>
                          </Col>
                          <Col md={6}>
                            <div>
                              <small className="text-muted d-block mb-1">Check-in Date</small>
                              <strong>{formatDate(hotel.checkInDate || hotel.checkIn)}</strong>
                            </div>
                          </Col>
                          <Col md={6}>
                            <div>
                              <small className="text-muted d-block mb-1">Check-out Date</small>
                              <strong>{formatDate(hotel.checkOutDate || hotel.checkOut)}</strong>
                            </div>
                          </Col>
                          <Col md={6}>
                            <div>
                              <small className="text-muted d-block mb-1">Nights</small>
                              <strong>{hotel.nights || "-"}</strong>
                            </div>
                          </Col>
                          <Col md={6}>
                            <div>
                              <small className="text-muted d-block mb-1">Room Status</small>
                              <Badge bg={hotel.roomStatus === "Available" ? "success" : "warning"}>
                                {hotel.roomStatus || "-"}
                              </Badge>
                            </div>
                          </Col>
                          {hotel.rooms && Array.isArray(hotel.rooms) && hotel.rooms.length > 0 && (
                            <Col md={12}>
                              <div>
                                <small className="text-muted d-block mb-2">Rooms</small>
                                <Table striped bordered size="sm">
                                  <thead>
                                    <tr>
                                      <th>Room No</th>
                                      <th>Category</th>
                                      <th>Meal Plan</th>
                                      <th>Adults</th>
                                      <th>Children</th>
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
                                      </tr>
                                    ))}
                                  </tbody>
                                </Table>
                              </div>
                            </Col>
                          )}
                        </Row>
                      );
                    })()}
                  </Card.Body>
                </Card>
              ) : null}

              {/* Activity Details */}
              {bookingDetails.customBookingActivityDTO && Array.isArray(bookingDetails.customBookingActivityDTO) && bookingDetails.customBookingActivityDTO.length > 0 && (
                <Card className="mb-3">
                  <Card.Header className="bg-success text-white">
                    <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                      <FaTicketAlt />
                      Activity Details
                    </h6>
                  </Card.Header>
                  <Card.Body>
                    <Table striped bordered size="sm">
                      <thead>
                        <tr>
                          <th>Activity</th>
                          <th>Tour Date</th>
                          <th>Adults</th>
                          <th>Children</th>
                          <th>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookingDetails.customBookingActivityDTO.map((activity, idx) => (
                          <tr key={idx}>
                            <td>{activity.activityName || `Activity ${idx + 1}`}</td>
                            <td>{formatDate(activity.tourDate)}</td>
                            <td>{activity.noOfAdult || 0}</td>
                            <td>{activity.noOfChild || 0}</td>
                            <td>AED {parseFloat(activity.sellingPrice || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              )}

              {/* Transfer Details */}
              {bookingDetails.customBookingCabDTO && Array.isArray(bookingDetails.customBookingCabDTO) && bookingDetails.customBookingCabDTO.length > 0 && (
                <Card className="mb-3">
                  <Card.Header className="bg-secondary text-white">
                    <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                      <FaCar />
                      Transfer Details
                    </h6>
                  </Card.Header>
                  <Card.Body>
                    <Table striped bordered size="sm">
                      <thead>
                        <tr>
                          <th>Pickup Date</th>
                          <th>Drop Date</th>
                          <th>Adults</th>
                          <th>Children</th>
                          <th>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookingDetails.customBookingCabDTO.map((cab, idx) => (
                          <tr key={idx}>
                            <td>{formatDate(cab.pickupDate)}</td>
                            <td>{formatDate(cab.dropOffDate)}</td>
                            <td>{cab.noOfAdult || 0}</td>
                            <td>{cab.noOfChild || 0}</td>
                            <td>AED {parseFloat(cab.totalRate || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              )}

              {/* Visa Information */}
              {bookingDetails.visaStatus && (
                <Card className="mb-3">
                  <Card.Header className="bg-danger text-white">
                    <h6 className="mb-0 fw-bold">Visa Information</h6>
                  </Card.Header>
                  <Card.Body>
                    <Row className="g-3">
                      <Col md={6}>
                        <div>
                          <small className="text-muted d-block mb-1">Visa Required</small>
                          <Badge bg={bookingDetails.visaStatus ? "success" : "secondary"}>
                            {bookingDetails.visaStatus ? "Yes" : "No"}
                          </Badge>
                        </div>
                      </Col>
                      {bookingDetails.visaStatus && (
                        <>
                          <Col md={6}>
                            <div>
                              <small className="text-muted d-block mb-1">Visa Adults</small>
                              <strong>{bookingDetails.visaAdult || 0}</strong>
                            </div>
                          </Col>
                          <Col md={6}>
                            <div>
                              <small className="text-muted d-block mb-1">Visa Children</small>
                              <strong>{bookingDetails.visaChild || 0}</strong>
                            </div>
                          </Col>
                          <Col md={6}>
                            <div>
                              <small className="text-muted d-block mb-1">Visa Infants</small>
                              <strong>{bookingDetails.visaInfant || 0}</strong>
                            </div>
                          </Col>
                        </>
                      )}
                    </Row>
                  </Card.Body>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted">No booking details available</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
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

