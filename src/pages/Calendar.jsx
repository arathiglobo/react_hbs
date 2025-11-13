import React, { useState, useEffect } from "react";
import { Card, Button, Row, Col, Modal, Badge, Spinner } from "react-bootstrap";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/TopBar";
import axiosInstance from "../components/AxiosInstance";
import { toast } from "react-hot-toast";
import {
  FaChevronLeft,
  FaChevronRight,
  FaCalendarAlt,
  FaUser,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaClock,
  FaBed,
  FaWifi,
  FaCar,
  FaHotel,
  FaStar,
} from "react-icons/fa";
import "../styles/Calendar.css";

export default function Calendar() {
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Booking modal state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingDetails, setBookingDetails] = useState(null);
  const [loadingBookingDetails, setLoadingBookingDetails] = useState(false);

  // Fetch bookings from API
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get("/api/bookings/list");

        if (response.data && response.data.success) {
          const { upcomingBookings, completedBookings, cancelledBookings } =
            response.data;

          // Combine all bookings
          const allBookingsData = [
            ...(upcomingBookings?.content || []),
            ...(completedBookings?.content || []),
            ...(cancelledBookings?.content || []),
          ];

          setAllBookings(allBookingsData);

          // Transform bookings into calendar events
          const calendarEvents = allBookingsData.map((booking) => {
            const checkInDate = new Date(booking.checkInDate);
            const status = (booking.bookingStatus || "").toUpperCase();

            // Determine color based on booking status
            let color = "info";
            if (status === "UPCOMING") {
              color =
                booking.confirmationStatus === "Confirmed"
                  ? "success"
                  : "warning";
            } else if (status === "COMPLETED") {
              color = "primary";
            } else if (status === "CANCELLED") {
              color = "danger";
            }

            return {
              id: booking.bookingCode,
              bookingId: booking.bookingId,
              date: checkInDate,
              status: status.toLowerCase() || "upcoming",
              color: color,
              bookingData: booking,
            };
          });

          setEvents(calendarEvents);
        }
      } catch (error) {
        console.error("Error fetching bookings:", error);
        toast.error("Failed to load bookings. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  // Calendar functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    return events.filter(
      (event) => event.date.toDateString() === date.toDateString()
    );
  };

  const navigateMonth = (direction) => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const getEventColor = (event) => {
    const colors = {
      warning: "#ffc107",
      danger: "#dc3545",
      success: "#28a745",
      info: "#17a2b8",
    };
    return colors[event.color] || "#6c757d";
  };

  const getEventIcon = (event) => {
    if (event.status === "cancelled") return "❌";
    if (event.status === "completed") return "✅";
    return event.status === "confirmed" ||
      event.bookingData?.confirmationStatus === "Confirmed"
      ? "👍"
      : "⏳";
  };

  // Booking modal functions
  const handleBookingClick = async (eventId) => {
    const event = events.find((e) => e.id === eventId);
    if (event && event.bookingData) {
      setSelectedBooking(event.bookingData);
      setShowBookingModal(true);
      setLoadingBookingDetails(true);
      setBookingDetails(null);

      try {
        const bookingId = event.bookingData.bookingId || event.bookingId;
        if (bookingId) {
          const response = await axiosInstance.get(
            `/api/hotel-booking/details/${bookingId}`
          );

          if (response.data && response.data.success) {
            setBookingDetails(response.data);
          } else {
            toast.error("Failed to load booking details");
          }
        }
      } catch (error) {
        console.error("Error fetching booking details:", error);
        toast.error("Failed to load booking details. Please try again.");
      } finally {
        setLoadingBookingDetails(false);
      }
    }
  };

  const closeBookingModal = () => {
    setShowBookingModal(false);
    setSelectedBooking(null);
    setBookingDetails(null);
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header>
              <span className="fw-semibold">Calendar</span>
            </Card.Header>

            {/* Calendar Display */}
            <Card.Body className="p-0">
              {/* Calendar Header */}
              <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                <div className="d-flex align-items-center">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    className="me-2"
                    onClick={() => navigateMonth(-1)}
                  >
                    <FaChevronLeft />
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    className="me-2"
                    onClick={() => navigateMonth(1)}
                  >
                    <FaChevronRight />
                  </Button>
                  <Button variant="primary" size="sm" onClick={goToToday}>
                    Today
                  </Button>
                </div>
                <h5 className="text-primary mb-0">{formatDate(currentDate)}</h5>
              </div>

              {/* Calendar Grid */}
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-3 text-muted">Loading bookings...</p>
                </div>
              ) : (
                <div className="calendar-container">
                  {/* Week day headers */}
                  <div className="d-flex">
                    {weekDays.map((day) => (
                      <div
                        key={day}
                        className="flex-fill text-center week-day-header"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar days */}
                  <div className="calendar-grid">
                    {days.map((day, index) => {
                      const dayEvents = getEventsForDate(day);
                      const isToday =
                        day && day.toDateString() === new Date().toDateString();

                      return (
                        <div
                          key={index}
                          className={`calendar-day ${
                            day ? "bg-white" : "bg-light"
                          } ${isToday ? "today" : ""}`}
                        >
                          {day && (
                            <>
                              <div className="day-number">{day.getDate()}</div>
                              <div className="events-container">
                                {dayEvents.map((event, eventIndex) => (
                                  <div
                                    key={eventIndex}
                                    className="event-item"
                                    onClick={() => handleBookingClick(event.id)}
                                    style={{ cursor: "pointer" }}
                                    title="Click to view booking details"
                                  >
                                    <div className="d-flex align-items-center">
                                      <span className="me-1">
                                        {getEventIcon(event)}
                                      </span>
                                      <span className="text-truncate">
                                        {event.id}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Booking Details Modal */}
          <Modal
            show={showBookingModal}
            onHide={closeBookingModal}
            size="lg"
            centered
          >
            <Modal.Header
              closeButton
              className="border-bottom-0 pb-0"
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
              }}
            >
              <div className="w-100">
                <Modal.Title className="text-white mb-2">
                  <FaCalendarAlt className="me-0" />
                  Booking Details{" "}
                  <h4 className="text-white mb-0 fw-bold">
                    {bookingDetails?.bookingHeader?.bookingCode || selectedBooking?.bookingCode || "N/A"}
                  </h4>
                </Modal.Title>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  {/* <Badge 
                     bg={
                       selectedBooking?.bookingStatus === 'UPCOMING' ? 'warning' :
                       selectedBooking?.bookingStatus === 'COMPLETED' ? 'success' :
                       selectedBooking?.bookingStatus === 'CANCELLED' ? 'danger' : 'info'
                     } 
                     className="px-3 py-2"
                     style={{ fontSize: '0.9rem' }}
                   >
                     {selectedBooking?.bookingStatus}
                   </Badge> */}
                  {/* {selectedBooking?.confirmationStatus && (
                     <Badge 
                       bg={selectedBooking.confirmationStatus === 'Confirmed' ? 'success' : 'warning'} 
                       className="px-3 py-2"
                       style={{ fontSize: '0.9rem' }}
                     >
                       {selectedBooking.confirmationStatus}
                     </Badge>
                   )} */}
                </div>
              </div>
            </Modal.Header>
            <Modal.Body className="p-4">
              {loadingBookingDetails ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-3 text-muted">Loading booking details...</p>
                </div>
              ) : bookingDetails && bookingDetails.success ? (
                <div className="booking-details">
                  {/* Summary Card */}
                  <Card
                    className="mb-4 border-0 shadow-sm"
                    style={{
                      background:
                        "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
                    }}
                  >
                    <Card.Body className="p-4">
                      <Row className="align-items-center">
                        <Col md={8}>
                          <div className="d-flex align-items-center mb-2">
                            <div className="bg-white rounded-circle p-3 me-3 shadow-sm">
                              <FaHotel className="text-primary" size={24} />
                            </div>
                            <div>
                              <h5 className="mb-1 fw-bold">
                                {bookingDetails.bookingDetails?.hotelName || "Hotel"}
                              </h5>
                            </div>
                          </div>
                        </Col>
                        <Col md={4} className="text-end">
                          <div className="mb-2">
                            <small className="text-muted d-block">
                              Total Amount
                            </small>
                            <h3 className="mb-0 text-success fw-bold total-rate">
                              {bookingDetails.bookingDetails?.currency || "AED"}{" "}
                              {bookingDetails.bookingDetails?.total?.toLocaleString() || "0"}
                            </h3>
                          </div>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>

                  {/* Guest & Stay Information */}
                  <Row className="g-3 mb-4">
                    <Col md={6}>
                      <Card className="h-100 border-0 shadow-sm">
                        <Card.Header className="bg-secondary text-white">
                          <h6 className="mb-0">
                            <FaUser className="me-2" />
                            Guest Information
                          </h6>
                        </Card.Header>
                        <Card.Body className="p-3">
                          <div className="mb-3">
                            <small className="text-muted d-block mb-1">
                              Primary Guest
                            </small>
                            <h6 className="mb-0 fw-bold">
                              {bookingDetails.guestInformation?.guestName || "N/A"}
                            </h6>
                          </div>
                          <div className="mb-3 pb-3 border-bottom">
                            <FaEnvelope
                              className="me-2 text-primary"
                              size={14}
                            />
                            <small className="text-muted">
                              {bookingDetails.guestInformation?.email || "N/A"}
                            </small>
                          </div>
                          <div className="mb-3 pb-3 border-bottom">
                            <FaPhone className="me-2 text-primary" size={14} />
                            <small className="text-muted">
                              {bookingDetails.guestInformation?.mobileNumber || "N/A"}
                            </small>
                          </div>
                          {bookingDetails.guestInformation?.nativeCountry && (
                            <div>
                              <small className="text-muted d-block mb-1">
                                Country Code
                              </small>
                              <Badge bg="info">
                                {bookingDetails.guestInformation.nativeCountry}
                              </Badge>
                            </div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={6}>
                      <Card className="h-100 border-0 shadow-sm">
                        <Card.Header className="bg-secondary text-white">
                          <h6 className="mb-0">
                            <FaClock className="me-2" />
                            Stay Details
                          </h6>
                        </Card.Header>
                        <Card.Body className="p-3">
                          <Row className="g-2">
                            <Col xs={6}>
                              <small className="text-muted d-block mb-1">
                                Check-in
                              </small>
                              <div className="fw-bold">
                                {bookingDetails.bookingDetails?.checkInDate
                                  ? new Date(
                                      bookingDetails.bookingDetails.checkInDate
                                    ).toLocaleDateString("en-US", {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "N/A"}
                              </div>
                            </Col>
                            <Col xs={6}>
                              <small className="text-muted d-block mb-1">
                                Check-out
                              </small>
                              <div className="fw-bold">
                                {bookingDetails.bookingDetails?.checkOutDate
                                  ? new Date(
                                      bookingDetails.bookingDetails.checkOutDate
                                    ).toLocaleDateString("en-US", {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "N/A"}
                              </div>
                            </Col>
                            <Col xs={6}>
                              <small className="text-muted d-block mb-1">
                                Duration
                              </small>
                              <div className="fw-bold">
                                {bookingDetails.bookingDetails?.numberOfNights || 0} Night
                                {bookingDetails.bookingDetails?.numberOfNights !== 1 ? "s" : ""}
                              </div>
                            </Col>
                            <Col xs={6}>
                              <small className="text-muted d-block mb-1">
                                Rooms
                              </small>
                              <div className="fw-bold">
                                {bookingDetails.bookingDetails?.numberOfRooms || 0} Room
                                {bookingDetails.bookingDetails?.numberOfRooms !== 1 ? "s" : ""}
                              </div>
                            </Col>
                            <Col xs={6}>
                              <small className="text-muted d-block mb-1">
                                Adults
                              </small>
                              <div className="fw-bold">
                                {bookingDetails.bookingDetails?.numberOfAdults || 0}
                              </div>
                            </Col>
                            <Col xs={6}>
                              <small className="text-muted d-block mb-1">
                                Children
                              </small>
                              <div className="fw-bold">
                                {bookingDetails.bookingDetails?.numberOfChildren || 0}
                              </div>
                            </Col>
                            {bookingDetails.bookingHeader?.deadlineDate && (
                              <Col xs={12} className="mt-2 pt-2 border-top">
                                <small className="text-muted d-block mb-1">
                                  Cancellation Deadline
                                </small>
                                <div className="fw-bold text-danger">
                                  {new Date(
                                    bookingDetails.bookingHeader.deadlineDate
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </div>
                              </Col>
                            )}
                          </Row>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  {/* Room Details */}
                  {bookingDetails.bookingDetails?.rooms && bookingDetails.bookingDetails.rooms.length > 0 && (
                    <Card className="mb-4 border-0 shadow-sm">
                      <Card.Header className="bg-secondary text-white">
                        <h6 className="mb-0">
                          <FaBed className="me-2" />
                          Room Details
                        </h6>
                      </Card.Header>
                      <Card.Body className="p-3">
                        <Row className="g-3">
                          {bookingDetails.bookingDetails.rooms.map((room, index) => (
                            <Col md={6} key={index}>
                              <Card className="h-100 border">
                                <Card.Body className="p-3">
                                  <div className="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                      <h6 className="mb-1 fw-bold">
                                        Room {room.roomNo || index + 1}
                                      </h6>
                                      <Badge bg="primary" className="mb-2">
                                        {room.roomCategory || "Standard Room"}
                                      </Badge>
                                    </div>
                                    <div className="text-end">
                                      <small className="text-muted d-block">Rate</small>
                                      <strong className="text-success">
                                        {bookingDetails.bookingDetails?.currency || "AED"} {room.rate?.toLocaleString() || "0"}
                                      </strong>
                                    </div>
                                  </div>
                                  <div className="mb-2">
                                    <small className="text-muted d-block mb-1">Meal Plan</small>
                                    <div className="fw-semibold">{room.mealPlan || "N/A"}</div>
                                  </div>
                                  <div className="d-flex gap-3">
                                    <div>
                                      <small className="text-muted d-block mb-1">Adults</small>
                                      <div className="fw-bold">{room.adults || 0}</div>
                                    </div>
                                    <div>
                                      <small className="text-muted d-block mb-1">Children</small>
                                      <div className="fw-bold">{room.children || 0}</div>
                                    </div>
                                  </div>
                                </Card.Body>
                              </Card>
                            </Col>
                          ))}
                        </Row>
                      </Card.Body>
                    </Card>
                  )}

                  {/* Booking Information */}
                  <Row className="g-3">
                    <Col md={6}>
                      <Card className="border-0 shadow-sm">
                        <Card.Header className="bg-secondary text-white">
                          <h6 className="mb-0">
                            <FaCalendarAlt className="me-2" />
                            Booking Information
                          </h6>
                        </Card.Header>
                        <Card.Body className="p-3">
                          <div className="mb-3">
                            <small className="text-muted d-block mb-1">
                              Reference Number
                            </small>
                            <div className="fw-bold font-monospace">
                              {bookingDetails.bookingHeader?.referenceNumber || "N/A"}
                            </div>
                          </div>
                          <div className="mb-3 pb-3 border-bottom">
                            <small className="text-muted d-block mb-1">
                              Booking Date
                            </small>
                            <div className="fw-bold">
                              {bookingDetails.bookingHeader?.bookingDate
                                ? new Date(
                                    bookingDetails.bookingHeader.bookingDate
                                  ).toLocaleDateString("en-US", {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "N/A"}
                            </div>
                          </div>
                          <div>
                            <small className="text-muted d-block mb-1">
                              Booking Code
                            </small>
                            <div className="fw-bold font-monospace">
                              {bookingDetails.bookingHeader?.bookingCode || "N/A"}
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={6}>
                      <Card className="border-0 shadow-sm">
                        <Card.Header className="bg-secondary text-white">
                          <h6 className="mb-0">
                            <FaBed className="me-2" />
                            Booking Summary
                          </h6>
                        </Card.Header>
                        <Card.Body className="p-3">
                          <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                            <span className="text-muted">Booking Status</span>
                            <span
                              className={`px-3 py-2 rounded fw-semibold ${
                                bookingDetails.bookingHeader?.bookingStatus === "UPCOMING"
                                  ? "text-warning"
                                  : bookingDetails.bookingHeader?.bookingStatus ===
                                    "COMPLETED"
                                  ? "text-success"
                                  : bookingDetails.bookingHeader?.bookingStatus ===
                                    "CANCELLED"
                                  ? "text-danger"
                                  : "text-info"
                              }`}
                            >
                              {bookingDetails.bookingHeader?.bookingStatus || "N/A"}
                            </span>
                          </div>

                          <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                            <span className="text-muted">Confirmation</span>
                            <Badge
                              bg={
                                bookingDetails.bookingHeader?.confirmationStatus ===
                                "Confirmed"
                                  ? "success"
                                  : "warning"
                              }
                              className="px-3 py-2"
                            >
                              {bookingDetails.bookingHeader?.confirmationStatus || "N/A"}
                            </Badge>
                          </div>
                          <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                            <span className="text-muted">Base Rate</span>
                            <div className="fw-bold">
                              {bookingDetails.bookingDetails?.currency || "AED"}{" "}
                              {bookingDetails.bookingDetails?.rate?.toLocaleString() || "0"}
                            </div>
                          </div>
                          <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                            <span className="text-muted">Tax/Discount</span>
                            <div className={`fw-bold ${(bookingDetails.bookingDetails?.taxDiscount || 0) < 0 ? "text-danger" : "text-success"}`}>
                              {bookingDetails.bookingDetails?.currency || "AED"}{" "}
                              {bookingDetails.bookingDetails?.taxDiscount?.toLocaleString() || "0"}
                            </div>
                          </div>
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="text-muted fw-bold">Total Amount</span>
                            <div className="fw-bold text-success fs-5">
                              {bookingDetails.bookingDetails?.currency || "AED"}{" "}
                              {bookingDetails.bookingDetails?.total?.toLocaleString() || "0"}
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </div>
              ) : (
                <div className="text-center py-5">
                  <p className="text-muted">Failed to load booking details. Please try again.</p>
                  <Button variant="primary" size="sm" onClick={closeBookingModal} className="mt-2">
                    Close
                  </Button>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="border-top-0 pt-0">
              <Button variant="secondary" onClick={closeBookingModal}>
                Close
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
