import React, { useState, useEffect } from "react";
import { Card, Button, Row, Col, Modal, Badge, Spinner, Table } from "react-bootstrap";
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
              <span className="fw-semibold" style={{ color: "#EC0B43" }}>Calendar</span>
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
          {/* Booking Details Modal */}
          <Modal
            show={showBookingModal}
            onHide={closeBookingModal}
            size="lg"
            centered
            backdrop="static"
            keyboard={false}
            className="premium-modal"
          >
            <Modal.Header closeButton className="bg-primary text-white" style={{ borderBottom: "none" }}>
              <div className="w-100 me-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <Modal.Title className="fw-bold fs-5">
                    Booking Details
                  </Modal.Title>
                  <Badge
                    bg={
                      bookingDetails?.bookingHeader?.confirmationStatus === "Confirmed"
                        ? "success"
                        : "danger"
                    }
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.4rem 0.8rem",
                    }}
                  >
                    {bookingDetails?.bookingHeader?.confirmationStatus
                      ? bookingDetails.bookingHeader.confirmationStatus.toUpperCase()
                      : "-"}
                  </Badge>
                </div>
                <div className="text-white-50 small">
                  <span className="me-3">
                    <strong>Booking ID:</strong>{" "}
                    {bookingDetails?.bookingHeader?.bookingId || "-"}
                  </span>
                  <span>
                    <strong>Reference:</strong>{" "}
                    {bookingDetails?.bookingHeader?.referenceNumber || "-"}
                  </span>
                </div>
              </div>
            </Modal.Header>
            <Modal.Body className="px-4 py-4">
              {loadingBookingDetails ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-2 text-muted">Loading booking details...</p>
                </div>
              ) : bookingDetails && bookingDetails.success ? (
                <div className="booking-details">
                  {/* Booking Header - Prominent */}
                  <div className="mb-4 p-3 bg-light rounded border">
                    <Row className="align-items-center">
                      <Col md={8}>
                        <div className="d-flex align-items-center gap-3 mb-2">
                          <h5 className="mb-0 fw-bold text-dark">
                            {bookingDetails.bookingHeader?.bookingCode || "N/A"}
                          </h5>
                          <Badge
                            bg={
                              bookingDetails.bookingHeader?.confirmationStatus === "Confirmed"
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
                            {bookingDetails.bookingHeader?.referenceNumber || "-"}
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
                              ? new Date(bookingDetails.bookingHeader.bookingDate).toLocaleDateString("en-US", {
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
                                {new Date(bookingDetails.bookingHeader.deadlineDate).toLocaleDateString("en-US", {
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
                          style={{ fontSize: "0.9rem", padding: "0.75rem 1rem" }}
                        >
                          Guest Information
                        </Card.Header>
                        <Card.Body>
                          <div className="mb-3">
                            <div className="text-muted small mb-1">Guest Name</div>
                            <div className="fw-semibold">
                              {bookingDetails.guestInformation?.guestName || "-"}
                            </div>
                          </div>
                          <Row>
                            <Col md={6}>
                              <div className="mb-3">
                                <div className="text-muted small mb-1">Email</div>
                                <div>{bookingDetails.guestInformation?.email || "-"}</div>
                              </div>
                            </Col>
                            <Col md={6}>
                              <div className="mb-3">
                                <div className="text-muted small mb-1">Mobile Number</div>
                                <div>{bookingDetails.guestInformation?.mobileNumber || "-"}</div>
                              </div>
                            </Col>
                          </Row>
                          <div>
                            <div className="text-muted small mb-1">Nationality</div>
                            <div>{bookingDetails.guestInformation?.nativeCountry || "-"}</div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>

                    {/* Right Column - Pricing Summary */}
                    <Col md={5}>
                      <Card className="border-0 shadow-sm mb-3">
                        <Card.Header
                          className="bg-light border-bottom fw-semibold"
                          style={{ fontSize: "0.9rem", padding: "0.75rem 1rem" }}
                        >
                          Pricing Summary
                        </Card.Header>
                        <Card.Body>
                          <div className="mb-3">
                            <div className="d-flex justify-content-between mb-2">
                              <span className="text-muted">Room Rate</span>
                              <span className="fw-semibold">
                                {bookingDetails.bookingDetails?.currency || ""}{" "}
                                {bookingDetails.bookingDetails?.total
                                  ? bookingDetails.bookingDetails.total.toFixed(2)
                                  : "0.00"}
                              </span>
                            </div>
                          </div>
                          <hr className="my-3" />
                          <div className="d-flex justify-content-between align-items-center p-3 bg-light rounded">
                            <span className="fw-bold fs-5">Total Amount</span>
                            <span className="text-success fw-bold fs-4">
                              {bookingDetails.bookingDetails?.currency || "AED"}{" "}
                              {bookingDetails.bookingDetails?.total?.toFixed(2) || "0.00"}
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
                        <div className="text-muted small mb-1">Hotel Name</div>
                        <div className="fw-semibold">
                          {bookingDetails.bookingDetails?.hotelName || "-"}
                        </div>
                      </div>
                      <Row>
                        <Col md={6}>
                          <div className="mb-3">
                            <div className="text-muted small mb-1">Check-In Date</div>
                            <div>{bookingDetails.bookingDetails?.checkInDate || "-"}</div>
                          </div>
                        </Col>
                        <Col md={6}>
                          <div className="mb-3">
                            <div className="text-muted small mb-1">Check-Out Date</div>
                            <div>{bookingDetails.bookingDetails?.checkOutDate || "-"}</div>
                          </div>
                        </Col>
                      </Row>
                      <Row>
                        <Col md={4}>
                          <div className="mb-3">
                            <div className="text-muted small mb-1">Duration</div>
                            <div>
                              {bookingDetails.bookingDetails?.numberOfNights || "0"} Night(s)
                            </div>
                          </div>
                        </Col>
                        <Col md={4}>
                          <div className="mb-3">
                            <div className="text-muted small mb-1">Number of Rooms</div>
                            <div>{bookingDetails.bookingDetails?.numberOfRooms || "0"}</div>
                          </div>
                        </Col>
                        <Col md={4}>
                          <div className="mb-3">
                            <div className="text-muted small mb-1">Total Guests</div>
                            <div>
                              {bookingDetails.bookingDetails?.numberOfAdults || "0"} Adults
                              {bookingDetails.bookingDetails?.numberOfChildren > 0 &&
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
                      <div className="p-4 bg-light rounded border mt-3">
                        <div className="mb-3">
                          <h6 className="fw-bold text-dark mb-3">Room Details</h6>
                        </div>
                        <div className="table-responsive">
                          <Table bordered hover className="mb-0 bg-white">
                            <thead className="table-light">
                              <tr>
                                <th style={{ fontSize: "0.85rem", padding: "0.75rem", fontWeight: "600" }}>
                                  Room No
                                </th>
                                <th style={{ fontSize: "0.85rem", padding: "0.75rem", fontWeight: "600" }}>
                                  Room Category
                                </th>
                                <th style={{ fontSize: "0.85rem", padding: "0.75rem", fontWeight: "600" }}>
                                  Meal Plan
                                </th>
                                <th style={{ fontSize: "0.85rem", padding: "0.75rem", fontWeight: "600" }}>
                                  Adults
                                </th>
                                <th style={{ fontSize: "0.85rem", padding: "0.75rem", fontWeight: "600" }}>
                                  Children
                                </th>
                                <th style={{ fontSize: "0.85rem", padding: "0.75rem", fontWeight: "600", textAlign: "right" }}>
                                  Rate
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {bookingDetails.bookingDetails.rooms.map((room, index) => (
                                <tr key={index}>
                                  <td style={{ padding: "0.75rem", verticalAlign: "middle" }}>
                                    <span className="fw-bold text-primary">
                                      Room {room.roomNo || index + 1}
                                    </span>
                                  </td>
                                  <td style={{ padding: "0.75rem", verticalAlign: "middle" }}>
                                    {room.roomCategory || "-"}
                                  </td>
                                  <td style={{ padding: "0.75rem", verticalAlign: "middle" }}>
                                    {room.mealPlan || "-"}
                                  </td>
                                  <td style={{ padding: "0.75rem", verticalAlign: "middle", textAlign: "center" }}>
                                    {room.adults || "0"}
                                  </td>
                                  <td style={{ padding: "0.75rem", verticalAlign: "middle", textAlign: "center" }}>
                                    {room.children || "0"}
                                  </td>
                                  <td style={{ padding: "0.75rem", verticalAlign: "middle", textAlign: "right" }}>
                                    {bookingDetails.bookingDetails?.currency || "AED"}{" "}
                                    {room.rate?.toFixed(2) || "0.00"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="text-center py-5">
                  <p className="text-muted">Information unavailable at this time.</p>
                  <Button variant="outline-dark" size="sm" onClick={closeBookingModal} className="mt-2 rounded-pill px-4">
                    Return to Calendar
                  </Button>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer style={{ backgroundColor: "#f8f9fa", borderTop: "1px solid #dee2e6" }}>
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
