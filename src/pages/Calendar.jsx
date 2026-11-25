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
  FaCheckCircle,
  FaHourglassHalf,
  FaCheckDouble,
  FaTimesCircle,
  FaReceipt,
} from "react-icons/fa";
import "../styles/Calendar.css";
import "../styles/CalendarModern.css";

// Booking chip status → label + monochrome icon (replaces the old emoji).
// Same four states the emoji showed: confirmed 👍, awaiting ⏳, completed ✅,
// cancelled ❌.
const EVENT_STATUS = {
  confirmed: { label: "Confirmed", Icon: FaCheckCircle },
  pending: { label: "Awaiting confirmation", Icon: FaHourglassHalf },
  completed: { label: "Completed", Icon: FaCheckDouble },
  cancelled: { label: "Cancelled", Icon: FaTimesCircle },
};

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

  // Same decision order the emoji icon used.
  const getEventStatus = (event) => {
    if (event.status === "cancelled") return "cancelled";
    if (event.status === "completed") return "completed";
    return event.status === "confirmed" ||
      event.bookingData?.confirmationStatus === "Confirmed"
      ? "confirmed"
      : "pending";
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

  // Pad the last week with blank cells so the grid always ends on a full row.
  const gridDays = [
    ...days,
    ...Array((7 - (days.length % 7)) % 7).fill(null),
  ];

  // Bookings whose check-in falls in the month being viewed (toolbar pill).
  const monthBookingCount = events.filter(
    (event) =>
      event.date.getMonth() === currentDate.getMonth() &&
      event.date.getFullYear() === currentDate.getFullYear()
  ).length;

  const formatShortDate = (value) =>
    new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="min-vh-100 d-flex flex-column cal-modern">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          {/* Page heading */}
          <div className="cal-head">
            <h1 className="cal-title">Calendar</h1>
            <p className="cal-sub">
              Bookings are shown on their check-in date. Click a booking to see
              its details.
            </p>
          </div>

          <Card className="cal-card">
            {/* Toolbar: month + booking count, navigation */}
            <div className="cal-toolbar">
              <div className="cal-toolbar-left">
                <h2 className="cal-month">{formatDate(currentDate)}</h2>
                {!loading && (
                  <span className="cal-count">
                    {monthBookingCount}{" "}
                    {monthBookingCount === 1 ? "booking" : "bookings"}
                  </span>
                )}
              </div>
              <div className="cal-nav">
                <div className="cal-nav-group">
                  <button
                    type="button"
                    className="cal-nav-btn"
                    onClick={() => navigateMonth(-1)}
                    aria-label="Previous month"
                    title="Previous month"
                  >
                    <FaChevronLeft />
                  </button>
                  <button
                    type="button"
                    className="cal-nav-btn"
                    onClick={() => navigateMonth(1)}
                    aria-label="Next month"
                    title="Next month"
                  >
                    <FaChevronRight />
                  </button>
                </div>
                <Button variant="primary" size="sm" onClick={goToToday}>
                  Today
                </Button>
              </div>
            </div>

            {/* Calendar Grid */}
            {loading ? (
              <div className="cal-loading">
                <Spinner animation="border" variant="primary" />
                <p>Loading bookings...</p>
              </div>
            ) : (
              <>
                {/* Week day headers */}
                <div className="cal-weekdays">
                  {weekDays.map((day) => (
                    <div key={day} className="cal-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="cal-grid">
                  {gridDays.map((day, index) => {
                    const dayEvents = getEventsForDate(day);
                    const isToday =
                      day && day.toDateString() === new Date().toDateString();

                    return (
                      <div
                        key={index}
                        className={`cal-day${day ? "" : " is-empty"}${
                          isToday ? " is-today" : ""
                        }`}
                      >
                        {day && (
                          <>
                            <span className="cal-day-num">{day.getDate()}</span>
                            <div className="cal-day-events">
                              {dayEvents.map((event, eventIndex) => {
                                const statusKey = getEventStatus(event);
                                const { label, Icon } = EVENT_STATUS[statusKey];
                                return (
                                  <button
                                    key={eventIndex}
                                    type="button"
                                    className={`cal-event is-${statusKey}`}
                                    onClick={() => handleBookingClick(event.id)}
                                    title={`${event.id} · ${label} — click to view booking details`}
                                  >
                                    <span className="cal-event-ic" aria-hidden="true">
                                      <Icon />
                                    </span>
                                    <span className="cal-event-code">{event.id}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend for the chip icons */}
                <div className="cal-legend">
                  {Object.entries(EVENT_STATUS).map(([key, { label, Icon }]) => (
                    <span key={key} className="cal-legend-item">
                      <Icon aria-hidden="true" />
                      {label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* Booking Details Modal */}
          <Modal
            show={showBookingModal}
            onHide={closeBookingModal}
            size="lg"
            centered
            backdrop="static"
            keyboard={false}
            className="cal-modern-modal"
          >
            <Modal.Header closeButton>
              <Modal.Title>Booking Details</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {loadingBookingDetails ? (
                <div className="cal-loading">
                  <Spinner animation="border" variant="primary" />
                  <p>Loading booking details...</p>
                </div>
              ) : bookingDetails && bookingDetails.success ? (
                <div className="booking-details">
                  {/* Booking summary */}
                  <div className="cal-summary">
                    <div className="cal-summary-main">
                      <div className="d-flex align-items-center flex-wrap gap-2">
                        <h5 className="cal-summary-code">
                          {bookingDetails.bookingHeader?.bookingCode || "N/A"}
                        </h5>
                        <Badge
                          bg={
                            bookingDetails.bookingHeader?.confirmationStatus === "Confirmed"
                              ? "success"
                              : "danger"
                          }
                        >
                          {bookingDetails.bookingHeader?.confirmationStatus
                            ? bookingDetails.bookingHeader.confirmationStatus.toUpperCase()
                            : "-"}
                        </Badge>
                      </div>
                      <div className="cal-summary-meta">
                        <span>
                          <strong>Booking ID:</strong>{" "}
                          {bookingDetails.bookingHeader?.bookingId || "-"}
                        </span>
                        <span>
                          <strong>Reference:</strong>{" "}
                          {bookingDetails.bookingHeader?.referenceNumber || "-"}
                        </span>
                      </div>
                    </div>
                    <div className="cal-summary-dates">
                      <div>
                        <div className="cal-label">Booking Date</div>
                        <div className="cal-value">
                          {bookingDetails.bookingHeader?.bookingDate
                            ? formatShortDate(bookingDetails.bookingHeader.bookingDate)
                            : "-"}
                        </div>
                      </div>
                      {bookingDetails.bookingHeader?.deadlineDate && (
                        <div>
                          <div className="cal-label">Deadline</div>
                          <div className="cal-value">
                            {formatShortDate(bookingDetails.bookingHeader.deadlineDate)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Row className="g-3 mb-3">
                    {/* Guest Information */}
                    <Col md={7}>
                      <Card className="cal-panel h-100 mb-0">
                        <Card.Header>
                          <FaUser aria-hidden="true" />
                          Guest Information
                        </Card.Header>
                        <Card.Body>
                          <div className="cal-field">
                            <div className="cal-label">Guest Name</div>
                            <div className="cal-value is-strong">
                              {bookingDetails.guestInformation?.guestName || "-"}
                            </div>
                          </div>
                          <Row>
                            <Col md={6}>
                              <div className="cal-field">
                                <div className="cal-label">Email</div>
                                <div className="cal-value">
                                  {bookingDetails.guestInformation?.email || "-"}
                                </div>
                              </div>
                            </Col>
                            <Col md={6}>
                              <div className="cal-field">
                                <div className="cal-label">Mobile Number</div>
                                <div className="cal-value">
                                  {bookingDetails.guestInformation?.mobileNumber || "-"}
                                </div>
                              </div>
                            </Col>
                          </Row>
                          <div className="cal-field">
                            <div className="cal-label">Nationality</div>
                            <div className="cal-value">
                              {bookingDetails.guestInformation?.nativeCountry || "-"}
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>

                    {/* Pricing Summary */}
                    <Col md={5}>
                      <Card className="cal-panel h-100 mb-0">
                        <Card.Header>
                          <FaReceipt aria-hidden="true" />
                          Pricing Summary
                        </Card.Header>
                        <Card.Body>
                          <div className="cal-price-row">
                            <span>Room Rate</span>
                            <span>
                              {bookingDetails.bookingDetails?.currency || ""}{" "}
                              {bookingDetails.bookingDetails?.total
                                ? bookingDetails.bookingDetails.total.toFixed(2)
                                : "0.00"}
                            </span>
                          </div>
                          <div className="cal-total">
                            <span className="cal-total-label">Total Amount</span>
                            <span className="cal-total-value text-success">
                              {bookingDetails.bookingDetails?.currency || "AED"}{" "}
                              {bookingDetails.bookingDetails?.total?.toFixed(2) || "0.00"}
                            </span>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  {/* Reservation Details */}
                  <Card className="cal-panel">
                    <Card.Header>
                      <FaHotel aria-hidden="true" />
                      Reservation Details
                    </Card.Header>
                    <Card.Body>
                      <div className="cal-field">
                        <div className="cal-label">Hotel Name</div>
                        <div className="cal-value is-strong">
                          {bookingDetails.bookingDetails?.hotelName || "-"}
                        </div>
                      </div>
                      <Row>
                        <Col xs={6}>
                          <div className="cal-field">
                            <div className="cal-label">Check-In Date</div>
                            <div className="cal-value">
                              {bookingDetails.bookingDetails?.checkInDate || "-"}
                            </div>
                          </div>
                        </Col>
                        <Col xs={6}>
                          <div className="cal-field">
                            <div className="cal-label">Check-Out Date</div>
                            <div className="cal-value">
                              {bookingDetails.bookingDetails?.checkOutDate || "-"}
                            </div>
                          </div>
                        </Col>
                      </Row>
                      <Row>
                        <Col xs={6} md={4}>
                          <div className="cal-field">
                            <div className="cal-label">Duration</div>
                            <div className="cal-value">
                              {bookingDetails.bookingDetails?.numberOfNights || "0"} Night(s)
                            </div>
                          </div>
                        </Col>
                        <Col xs={6} md={4}>
                          <div className="cal-field">
                            <div className="cal-label">Number of Rooms</div>
                            <div className="cal-value">
                              {bookingDetails.bookingDetails?.numberOfRooms || "0"}
                            </div>
                          </div>
                        </Col>
                        <Col xs={12} md={4}>
                          <div className="cal-field">
                            <div className="cal-label">Total Guests</div>
                            <div className="cal-value">
                              {bookingDetails.bookingDetails?.numberOfAdults || "0"} Adults
                              {bookingDetails.bookingDetails?.numberOfChildren > 0 &&
                                `, ${bookingDetails.bookingDetails.numberOfChildren} Children`}
                            </div>
                          </div>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>

                  {/* Room Details */}
                  {bookingDetails.bookingDetails?.rooms &&
                    bookingDetails.bookingDetails.rooms.length > 0 && (
                      <Card className="cal-panel">
                        <Card.Header>
                          <FaBed aria-hidden="true" />
                          Room Details
                        </Card.Header>
                        <div className="table-responsive">
                          <Table className="cal-rooms-table">
                            <thead>
                              <tr>
                                <th>Room No</th>
                                <th>Room Category</th>
                                <th>Meal Plan</th>
                                <th className="text-center">Adults</th>
                                <th className="text-center">Children</th>
                                <th className="text-end">Rate</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bookingDetails.bookingDetails.rooms.map((room, index) => (
                                <tr key={index}>
                                  <td>
                                    <span className="fw-bold text-primary">
                                      Room {room.roomNo || index + 1}
                                    </span>
                                  </td>
                                  <td>{room.roomCategory || "-"}</td>
                                  <td>{room.mealPlan || "-"}</td>
                                  <td className="text-center">{room.adults || "0"}</td>
                                  <td className="text-center">{room.children || "0"}</td>
                                  <td className="text-end text-nowrap">
                                    {bookingDetails.bookingDetails?.currency || "AED"}{" "}
                                    {room.rate?.toFixed(2) || "0.00"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </Card>
                    )}
                </div>
              ) : (
                <div className="cal-empty">
                  <p>Information unavailable at this time.</p>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={closeBookingModal}
                    className="px-4"
                  >
                    Return to Calendar
                  </Button>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline-secondary" onClick={closeBookingModal}>
                Close
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
