import React, { useState } from "react";
import { Card, Button, Row, Col, Modal, Badge } from "react-bootstrap";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/TopBar";
import { FaChevronLeft, FaChevronRight, FaCalendarAlt, FaUser, FaPhone, FaEnvelope, FaMapMarkerAlt, FaClock, FaBed, FaWifi, FaCar } from "react-icons/fa";
import '../styles/Calendar.css';

export default function Calendar() {
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([
    { id: 'CNFIO2107', date: new Date(2025, 9, 15), status: 'confirmed', color: 'warning' },
    { id: 'CNFDA2106', date: new Date(2025, 9, 15), status: 'pending', color: 'danger' },
    { id: 'CNFAGT2127', date: new Date(2025, 9, 30), status: 'confirmed', color: 'success' },
    { id: 'CNFAGT2143', date: new Date(), status: 'confirmed', color: 'warning' },
    { id: 'CNFDA2145', date: new Date(), status: 'pending', color: 'success' }
  ]);

  // Booking modal state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Static booking details data
  const bookingDetails = {
    'CNFIO2107': {
      bookingId: 'CNFIO2107',
      guestName: 'John Smith',
      email: 'john.smith@email.com',
      phone: '+1 234 567 8900',
      checkIn: '2025-10-15',
      checkOut: '2025-10-18',
      roomType: 'Deluxe Suite',
      roomNumber: '205',
      adults: 2,
      children: 1,
      totalAmount: '$450.00',
      status: 'Confirmed',
      amenities: ['WiFi', 'Parking', 'Breakfast', 'Pool Access'],
      specialRequests: 'Late checkout requested',
      bookingDate: '2025-10-01',
      paymentStatus: 'Paid'
    },
    'CNFDA2106': {
      bookingId: 'CNFDA2106',
      guestName: 'Sarah Johnson',
      email: 'sarah.johnson@email.com',
      phone: '+1 345 678 9012',
      checkIn: '2025-10-15',
      checkOut: '2025-10-17',
      roomType: 'Standard Room',
      roomNumber: '102',
      adults: 1,
      children: 0,
      totalAmount: '$280.00',
      status: 'Pending',
      amenities: ['WiFi', 'Parking'],
      specialRequests: 'Ground floor room preferred',
      bookingDate: '2025-10-02',
      paymentStatus: 'Pending'
    },
    'CNFAGT2127': {
      bookingId: 'CNFAGT2127',
      guestName: 'Michael Brown',
      email: 'michael.brown@email.com',
      phone: '+1 456 789 0123',
      checkIn: '2025-10-30',
      checkOut: '2025-11-02',
      roomType: 'Executive Suite',
      roomNumber: '301',
      adults: 2,
      children: 2,
      totalAmount: '$720.00',
      status: 'Confirmed',
      amenities: ['WiFi', 'Parking', 'Breakfast', 'Pool Access', 'Spa Access'],
      specialRequests: 'Connecting rooms for family',
      bookingDate: '2025-10-05',
      paymentStatus: 'Paid'
    },
    'CNFAGT2143': {
      bookingId: 'CNFAGT2143',
      guestName: 'Emily Davis',
      email: 'emily.davis@email.com',
      phone: '+1 567 890 1234',
      checkIn: new Date().toISOString().split('T')[0],
      checkOut: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      roomType: 'Business Room',
      roomNumber: '156',
      adults: 1,
      children: 0,
      totalAmount: '$320.00',
      status: 'Confirmed',
      amenities: ['WiFi', 'Parking', 'Business Center'],
      specialRequests: 'Quiet room for business meetings',
      bookingDate: new Date().toISOString().split('T')[0],
      paymentStatus: 'Paid'
    },
    'CNFDA2145': {
      bookingId: 'CNFDA2145',
      guestName: 'David Wilson',
      email: 'david.wilson@email.com',
      phone: '+1 678 901 2345',
      checkIn: new Date().toISOString().split('T')[0],
      checkOut: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      roomType: 'Standard Room',
      roomNumber: '089',
      adults: 1,
      children: 0,
      totalAmount: '$180.00',
      status: 'Pending',
      amenities: ['WiFi'],
      specialRequests: 'Early check-in if possible',
      bookingDate: new Date().toISOString().split('T')[0],
      paymentStatus: 'Pending'
    }
  };


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
    return events.filter(event => 
      event.date.toDateString() === date.toDateString()
    );
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getEventColor = (event) => {
    const colors = {
      'warning': '#ffc107',
      'danger': '#dc3545',
      'success': '#28a745',
      'info': '#17a2b8'
    };
    return colors[event.color] || '#6c757d';
  };

  const getEventIcon = (event) => {
    return event.status === 'confirmed' ? '👍' : '👎';
  };

  // Booking modal functions
  const handleBookingClick = (eventId) => {
    const booking = bookingDetails[eventId];
    if (booking) {
      setSelectedBooking(booking);
      setShowBookingModal(true);
    }
  };

  const closeBookingModal = () => {
    setShowBookingModal(false);
    setSelectedBooking(null);
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


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
                   <Button 
                     variant="primary" 
                     size="sm"
                     onClick={goToToday}
                   >
                     Today
                   </Button>
                 </div>
                 <h5 className="text-primary mb-0">{formatDate(currentDate)}</h5>
               </div>

               {/* Calendar Grid */}
               <div className="calendar-container">
                 {/* Week day headers */}
                 <div className="d-flex">
                   {weekDays.map(day => (
                     <div key={day} className="flex-fill text-center week-day-header">
                       {day}
                     </div>
                   ))}
                 </div>

                 {/* Calendar days */}
                 <div className="calendar-grid">
                   {days.map((day, index) => {
                     const dayEvents = getEventsForDate(day);
                     const isToday = day && day.toDateString() === new Date().toDateString();
                     
                     return (
                       <div 
                         key={index} 
                         className={`calendar-day ${
                           day ? 'bg-white' : 'bg-light'
                         } ${isToday ? 'today' : ''}`}
                       >
                         {day && (
                           <>
                             <div className="day-number">
                               {day.getDate()}
                             </div>
                             <div className="events-container">
                               {dayEvents.map((event, eventIndex) => (
                                 <div 
                                   key={eventIndex}
                                   className="event-item"
                                   onClick={() => handleBookingClick(event.id)}
                                   style={{ cursor: 'pointer' }}
                                   title="Click to view booking details"
                                 >
                                   <div className="d-flex align-items-center">
                                     <span className="me-1">{getEventIcon(event)}</span>
                                     <span className="text-truncate">{event.id}</span>
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
             </Card.Body>
           </Card>

           {/* Booking Details Modal */}
           <Modal show={showBookingModal} onHide={closeBookingModal} size="lg" centered>
             <Modal.Header closeButton>
               <Modal.Title>
                 <FaCalendarAlt className="me-2" />
                 Booking Details - {selectedBooking?.bookingId}
               </Modal.Title>
             </Modal.Header>
             <Modal.Body>
               {selectedBooking && (
                 <div className="booking-details">
                   {/* Guest Information */}
                   <Row className="mb-4">
                     <Col md={6}>
                       <h6 className="text-primary mb-3">
                         <FaUser className="me-2" />
                         Guest Information
                       </h6>
                       <div className="mb-2">
                         <strong>Name:</strong> {selectedBooking.guestName}
                       </div>
                       <div className="mb-2">
                         <FaEnvelope className="me-2 text-muted" />
                         {selectedBooking.email}
                       </div>
                       <div className="mb-2">
                         <FaPhone className="me-2 text-muted" />
                         {selectedBooking.phone}
                       </div>
                     </Col>
                     <Col md={6}>
                       <h6 className="text-primary mb-3">
                         <FaBed className="me-2" />
                         Booking Status
                       </h6>
                       <div className="mb-2">
                         <strong>Status:</strong> 
                         <Badge bg={selectedBooking.status === 'Confirmed' ? 'success' : 'warning'} className="ms-2">
                           {selectedBooking.status}
                         </Badge>
                       </div>
                       <div className="mb-2">
                         <strong>Payment:</strong> 
                         <Badge bg={selectedBooking.paymentStatus === 'Paid' ? 'success' : 'warning'} className="ms-2">
                           {selectedBooking.paymentStatus}
                         </Badge>
                       </div>
                       <div className="mb-2">
                         <strong>Total Amount:</strong> 
                         <span className="text-success fw-bold">{selectedBooking.totalAmount}</span>
                       </div>
                     </Col>
                   </Row>

                   {/* Stay Details */}
                   <Row className="mb-4">
                     <Col md={6}>
                       <h6 className="text-primary mb-3">
                         <FaClock className="me-2" />
                         Stay Details
                       </h6>
                       <div className="mb-2">
                         <strong>Check-in:</strong> {selectedBooking.checkIn}
                       </div>
                       <div className="mb-2">
                         <strong>Check-out:</strong> {selectedBooking.checkOut}
                       </div>
                       <div className="mb-2">
                         <strong>Booking Date:</strong> {selectedBooking.bookingDate}
                       </div>
                     </Col>
                     <Col md={6}>
                       <h6 className="text-primary mb-3">
                         <FaMapMarkerAlt className="me-2" />
                         Room Details
                       </h6>
                       <div className="mb-2">
                         <strong>Room Type:</strong> {selectedBooking.roomType}
                       </div>
                       <div className="mb-2">
                         <strong>Room Number:</strong> {selectedBooking.roomNumber}
                       </div>
                       <div className="mb-2">
                         <strong>Guests:</strong> {selectedBooking.adults} Adult(s), {selectedBooking.children} Child(ren)
                       </div>
                     </Col>
                   </Row>

                   {/* Amenities */}
                   <Row className="mb-4">
                     <Col md={12}>
                       <h6 className="text-primary mb-3">
                         <FaWifi className="me-2" />
                         Amenities & Services
                       </h6>
                       <div className="d-flex flex-wrap gap-2">
                         {selectedBooking.amenities.map((amenity, index) => (
                           <Badge key={index} bg="info" className="me-2 mb-2">
                             {amenity}
                           </Badge>
                         ))}
                       </div>
                     </Col>
                   </Row>

                   {/* Special Requests */}
                   {selectedBooking.specialRequests && (
                     <Row className="mb-4">
                       <Col md={12}>
                         <h6 className="text-primary mb-3">
                           <FaCar className="me-2" />
                           Special Requests
                         </h6>
                         <div className="p-3 bg-light rounded">
                           {selectedBooking.specialRequests}
                         </div>
                       </Col>
                     </Row>
                   )}
                 </div>
               )}
             </Modal.Body>
             <Modal.Footer>
               <Button variant="secondary" onClick={closeBookingModal}>
                 Close
               </Button>
               {/* <Button variant="primary">
                 Edit Booking
               </Button> */}
             </Modal.Footer>
           </Modal>
        </main>
      </div>
    </div>
  );
}
