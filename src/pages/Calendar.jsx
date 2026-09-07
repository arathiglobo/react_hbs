import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Row, Col, Modal, Badge, Spinner, Table, Form } from "react-bootstrap";
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
  FaBolt,
  FaBuilding,
  FaBriefcase,
  FaUsers,
  FaGraduationCap,
} from "react-icons/fa";
import "../styles/Calendar.css";

/* Booking types offered on the date-range picker. Each entry names the
 * route the picker navigates to; the checkIn/checkOut are passed as URL
 * query params (?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD) so the target
 * search page can prefill them without any router state coupling. */
const BOOKING_TYPES = [
  { key: "hotel",          label: "Hotel",          route: "/new-booking/hotel",                    Icon: FaHotel },
  { key: "long-stay",      label: "Long Stay",      route: "/new-booking/long-stay",                Icon: FaBed },
  { key: "last-minute",    label: "Last Minute",    route: "/new-booking/last-minute-booking",      Icon: FaBolt },
  { key: "day-stay",       label: "Day Stay",       route: "/new-booking/day-stay",                 Icon: FaClock },
  { key: "package",        label: "Package",        route: "/new-booking/make-your-own-package-v3", Icon: FaMapMarkerAlt },
  { key: "meet-and-space", label: "Meet and Space", route: "/new-booking/meet-and-space",           Icon: FaBuilding },
  { key: "gov-employee",   label: "Government",     route: "/new-booking/gov-employee",             Icon: FaBriefcase },
  { key: "senior-citizen", label: "Senior Citizen", route: "/new-booking/senior-citizen",           Icon: FaUsers },
  { key: "student",        label: "Student",        route: "/new-booking/student",                  Icon: FaGraduationCap },
];

const formatYmd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDisplayDate = (d) =>
  d ? d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "";

export default function Calendar() {
  const navigate = useNavigate();

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

  // Date-range selection state (additive — does not affect existing
  // booking-click behaviour). rangeStart is set on the first click of an
  // empty future date; rangeEnd on the second click; both null = idle.
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  // Which booking type radio is currently selected in the picker modal.
  // Defaults to "hotel" so the Continue button is enabled on first open;
  // reset every time the picker closes so a subsequent selection starts
  // fresh rather than remembering the last choice.
  const [selectedBookingType, setSelectedBookingType] = useState("hotel");

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

  // ---------- Date-range selection helpers ----------
  const sameDay = (a, b) =>
    a && b && a.toDateString() === b.toDateString();

  const isRangeStartDay = (day) => sameDay(day, rangeStart);
  const isRangeEndDay = (day) => sameDay(day, rangeEnd);
  const startOfDay = (d) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  };
  const isInRange = (day) => {
    if (!day || !rangeStart) return false;
    if (!rangeEnd) return sameDay(day, rangeStart);
    const d = startOfDay(day);
    return d >= startOfDay(rangeStart) && d <= startOfDay(rangeEnd);
  };

  const isPastDay = (day) => {
    if (!day) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  const clearRange = () => {
    setRangeStart(null);
    setRangeEnd(null);
  };

  const closePicker = () => {
    setShowPicker(false);
    setSelectedBookingType("hotel");
    clearRange();
  };

  // Called when the user clicks Continue on the picker modal.
  // Looks up the selected radio value in BOOKING_TYPES and delegates to
  // the existing handlePickBookingType (which already handles the
  // URL-param navigation + range-cleanup exactly as before).
  const handleConfirmBookingType = () => {
    const bt = BOOKING_TYPES.find((b) => b.key === selectedBookingType);
    if (bt) handlePickBookingType(bt);
  };

  /* Click handler for the empty area of a day cell. Ignores past days
   * and days that carry booking events (those keep their existing
   * click-to-open-details behaviour via the pill's own handler). */
  const handleDayCellClick = (day, hasEvents) => {
    if (!day || isPastDay(day) || hasEvents) return;

    if (!rangeStart) {
      setRangeStart(new Date(day));
      setRangeEnd(null);
      return;
    }
    if (!rangeEnd) {
      const start = new Date(rangeStart);
      start.setHours(0, 0, 0, 0);
      const clicked = new Date(day);
      clicked.setHours(0, 0, 0, 0);
      if (clicked < start) {
        // clicked an earlier date — restart with this as new start
        setRangeStart(new Date(day));
        return;
      }
      if (sameDay(clicked, start)) {
        // same day clicked twice — treat as 1-night default
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        setRangeEnd(next);
        setShowPicker(true);
        return;
      }
      setRangeEnd(new Date(day));
      setShowPicker(true);
      return;
    }
    // Both already set — restart selection with this as new start
    setRangeStart(new Date(day));
    setRangeEnd(null);
  };

  const nightsBetween = (a, b) => {
    if (!a || !b) return 0;
    const ms = new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0);
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  };

  const handlePickBookingType = (bt) => {
    if (!rangeStart || !rangeEnd) return;
    setShowPicker(false);
    // Dates are handed to the target search page via React Router's
    // navigation state (location.state) instead of a URL query string —
    // keeps the URL clean while still prefilling the form.
    navigate(bt.route, {
      state: {
        checkIn: formatYmd(rangeStart),
        checkOut: formatYmd(rangeEnd),
      },
    });
    clearRange();
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
              <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center p-3 border-bottom">
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
                <h5 className="text-primary mb-0 text-nowrap">{formatDate(currentDate)}</h5>
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
                      const hasEvents = dayEvents.length > 0;
                      const past = isPastDay(day);
                      const selectable = day && !past && !hasEvents;
                      const inRange = isInRange(day);
                      const rangeStartCell = isRangeStartDay(day);
                      const rangeEndCell = isRangeEndDay(day);

                      return (
                        <div
                          key={index}
                          className={`calendar-day ${
                            day ? "bg-white" : "bg-light"
                          } ${isToday ? "today" : ""} ${
                            selectable ? "selectable" : ""
                          } ${inRange ? "in-range" : ""} ${
                            rangeStartCell ? "range-start" : ""
                          } ${rangeEndCell ? "range-end" : ""} ${
                            past ? "past-day" : ""
                          }`}
                          onClick={() => handleDayCellClick(day, hasEvents)}
                          title={
                            selectable
                              ? !rangeStart
                                ? "Click to start a new booking on this date"
                                : !rangeEnd
                                ? "Click check-out date"
                                : ""
                              : ""
                          }
                        >
                          {day && (
                            <>
                              <div className="day-number">{day.getDate()}</div>
                              <div className="events-container">
                                {dayEvents.map((event, eventIndex) => (
                                  <div
                                    key={eventIndex}
                                    className="event-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleBookingClick(event.id);
                                    }}
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

                  {/* Range hint bar — appears only when a range is being selected.
                      Non-modal so the user can keep clicking the calendar. */}
                  {rangeStart && (
                    <div className="range-hint-bar d-flex align-items-center justify-content-between px-3 py-2">
                      <div>
                        <FaCalendarAlt className="me-2 text-primary" />
                        <strong className="me-2">Check-in:</strong>
                        {formatDisplayDate(rangeStart)}
                        {rangeEnd && (
                          <>
                            <span className="mx-2">→</span>
                            <strong className="me-2">Check-out:</strong>
                            {formatDisplayDate(rangeEnd)}
                            <span className="ms-2 text-muted">
                              ({nightsBetween(rangeStart, rangeEnd)} night
                              {nightsBetween(rangeStart, rangeEnd) === 1 ? "" : "s"})
                            </span>
                          </>
                        )}
                        {!rangeEnd && (
                          <span className="ms-2 text-muted">
                            Click a later date to pick check-out
                          </span>
                        )}
                      </div>
                      <div>
                        {rangeEnd && (
                          <Button
                            size="sm"
                            variant="primary"
                            className="me-2"
                            onClick={() => setShowPicker(true)}
                          >
                            Choose booking type
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={clearRange}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  )}
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

          {/* Booking-type picker — opens when a check-in / check-out range
              is selected. Navigates to the chosen search page with the
              dates as URL query params (?checkIn=YYYY-MM-DD&checkOut=...) */}
          <Modal
            show={showPicker}
            onHide={closePicker}
            centered
            size="md"
            className="premium-modal booking-picker-modal"
          >
            <Modal.Header closeButton className="bg-primary text-white py-2" style={{ borderBottom: "none" }}>
              <Modal.Title className="fw-bold" style={{ fontSize: "1rem" }}>
                What would you like to book?
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-4 py-3">
              <div className="mb-3 p-2 bg-light rounded border" style={{ fontSize: "0.82rem", lineHeight: 1.35 }}>
                <div>
                  <strong>Check-in:</strong> {formatDisplayDate(rangeStart)}
                </div>
                <div>
                  <strong>Check-out:</strong> {formatDisplayDate(rangeEnd)}
                </div>
                <div className="text-muted">
                  {nightsBetween(rangeStart, rangeEnd)} night
                  {nightsBetween(rangeStart, rangeEnd) === 1 ? "" : "s"}
                </div>
              </div>
              <Form className="booking-type-radio-list">
                {BOOKING_TYPES.map((bt) => (
                  <Form.Check
                    key={bt.key}
                    type="radio"
                    name="calendarBookingType"
                    id={`calendar-bt-${bt.key}`}
                    className="booking-type-radio"
                    checked={selectedBookingType === bt.key}
                    onChange={() => setSelectedBookingType(bt.key)}
                    label={bt.label}
                  />
                ))}
              </Form>
              <p className="text-muted mb-0 mt-2" style={{ fontSize: "0.75rem" }}>
                The chosen dates will be pre-filled on the booking page.
              </p>
            </Modal.Body>
            <Modal.Footer className="py-2 px-3" style={{ backgroundColor: "#f8f9fa", borderTop: "1px solid #dee2e6" }}>
              <Button size="sm" variant="secondary" onClick={closePicker}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleConfirmBookingType}
                disabled={!selectedBookingType}
              >
                Continue
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
