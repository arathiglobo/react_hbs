import React, { useState } from "react";
import { Card, Button, Row, Col } from "react-bootstrap";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/TopBar";
import { FaChevronLeft, FaChevronRight, FaCalendarAlt } from "react-icons/fa";
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
        </main>
      </div>
    </div>
  );
}
