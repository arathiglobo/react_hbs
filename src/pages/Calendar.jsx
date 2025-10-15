import React, { useEffect, useMemo, useState } from "react";
import { Card, Button, Table, Modal, Form, Pagination, Row, Col } from "react-bootstrap";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/TopBar";
import axiosInstance from "../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { FaEdit, FaTrash, FaChevronLeft, FaChevronRight, FaCalendarAlt } from "react-icons/fa";
import '../styles/Calendar.css';

export default function Calendar() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState(null);
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([
    { id: 'CNFIO2107', date: new Date(2025, 9, 15), status: 'confirmed', color: 'warning' },
    { id: 'CNFDA2106', date: new Date(2025, 9, 15), status: 'pending', color: 'danger' },
    { id: 'CNFAGT2127', date: new Date(2025, 9, 30), status: 'confirmed', color: 'success' },
    { id: 'CNFAGT2143', date: new Date(), status: 'confirmed', color: 'warning' },
    { id: 'CNFDA2145', date: new Date(), status: 'pending', color: 'success' }
  ]);

  const nextId = useMemo(
    () => Math.max(0, ...items.map((i) => i.id)) + 1,
    [items]
  );

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

  const openCreate = () => {
    setEditing(null);
    setName("");
    setError("");
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setName(item.name);
    setShowModal(true);
  };

  const handleEdit = async () => {
    if (!editing) return;

    try {
      setIsLoading(true);
      const editRes = await axiosInstance.put(
        `/api/bank/${editing.bankId}`,
        {
          name: name,
        }
      );

     if (editRes.data) {
        toast.success("Bank Updated Successfully!");
        // First refresh the list
        await fetchBankList(page, search);
        // Then close modal and reset state
        closeModal();
      }
    } catch (error) {
      
      setError("Failed to update bank");
      toast.error("Failed to update bank");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setName("");
    setError("");
  };

  const fetchBankList = async (pageNum = 0, searchTerm = search) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });

      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      const res = await axiosInstance.get(
        `/api/bank?${params.toString()}`
      );
     
     // Check if response has data and pagination info
      if (res.data && Array.isArray(res.data)) {
        setItems(res.data);
        // Since backend doesn't return totalPages, we'll calculate it based on data length
        // If we get less than 10 items, it's likely the last page
        if (res.data.length < 10) {
          setTotalPages(pageNum + 1);
        } else {
          // If we get exactly 10 items, there might be more pages
          // We'll set a reasonable total or keep the current totalPages
          setTotalPages(Math.max(totalPages, pageNum + 2));
        }

        setPage(pageNum);
      } else {
        setItems([]);
        setTotalPages(0);
        setPage(0);
      }
    } catch (err) {
      toast.error("Failed to load banks");
      setItems([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };

  const saveBank = async () => {
    try {
      setIsLoading(true);
      const bankpayload = { 
                                name: `${name}` 
                          };
      const bankSaveRes = await axiosInstance.post(
        "/api/bank/save",
        bankpayload
      );
      if (bankSaveRes.data !== 0) {
        toast.success("Bank added Successfully!");
        // First refresh the list
        await fetchBankList(page, search);
        // Then close modal
        closeModal();
      }
    } catch (error) {
      setError("Sorry! Data not saved to db..");
      toast.error("Failed to save bank data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBankList();
  }, []);

  // Debounced search effect
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for search
    if (search !== "") {
      const timeout = setTimeout(() => {
        fetchBankList(0, search);
      }, 500); // 500ms delay
      setSearchTimeout(timeout);
    } else if (search === "") {
      // If search is cleared, fetch all data
      fetchBankList(0, "");
    }

    // Cleanup timeout on unmount
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const handleDelete = (item) => {

      Swal.fire({
      title: `Are you sure? You want to delete ${item.name}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      customClass: {
        popup: "swal-small",
        title: "swal-small-title",
        htmlContainer: "swal-small-text",
      },
    }).then((result) => {
      if (result.isConfirmed) {
        axiosInstance
          .delete(`/api/bank/${item.bankId}`)
          .then(() => {
            toast.success("Bank deleted successfully");
            fetchBankList(page, search);
          })
          .catch(() => {
            toast.error("Sorry!!Bank not deleted");
          });
      }
    });
  };

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

           {/* Bank Management Table */}
           <Card className="shadow-sm rounded-xl mt-4">
             <Card.Header className="d-flex justify-content-between align-items-center">
               <span className="fw-semibold">Bank Management</span>
               <Form.Group className="hotel-search-bar">
                 <Form.Control
                   type="text"
                   placeholder="Search bank by name..."
                   className="form-control-modern-sm"
                   value={searchTerm}
                   onChange={(e) => {
                     const value = e.target.value;
                     setSearchTerm(value);
                     fetchBankList(0, value);
                   }}
                 />
               </Form.Group>
               <Button className="btn-green" onClick={openCreate}>
                 + Create
               </Button>
             </Card.Header>
             <Card.Body className="p-0">
               <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Bank Name</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.bankId}>
                      <td>{index + 1 + page * 10}</td>
                      <td>{item.name}</td>
                      <td>
                        <div className="d-flex gap-2">
                          <FaEdit
                            className="text-primary"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => openEdit(item)}
                            title="Edit"
                          />
                          <FaTrash
                            className="text-danger"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleDelete(item)}
                            title="Delete"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {isLoading && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-4">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Loading available banks...
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-4">
                        No banks found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <div>
                    <small className="text-muted">
                      Showing {items.length} of {totalPages * 10} banks
                    </small>
                  </div>
                  <div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 0}
                        onClick={() => fetchBankList(page - 1, search)}
                      />
                      {[...Array(totalPages).keys()].map((num) => (
                        <Pagination.Item
                          key={num}
                          active={num === page}
                          onClick={() => fetchBankList(num, search)}
                        >
                          {num + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page === totalPages - 1}
                        onClick={() => fetchBankList(page + 1, search)}
                      />
                    </Pagination>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          <Modal show={showModal} onHide={closeModal} centered>
            <Modal.Header closeButton={!isLoading}>
              <Modal.Title>
                {editing ? "Update Bank" : "Create Bank"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Bank Name</Form.Label>
                  <Form.Control
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter bank name"
                    autoFocus
                    isInvalid={!!error}
                  />
                  {error && (
                    <Form.Control.Feedback type="invalid">
                      {error}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={closeModal}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                className="btn-indigo"
                onClick={editing ? handleEdit : saveBank}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    {editing ? "Updating..." : "Saving..."}
                  </>
                ) : editing ? (
                  "Update"
                ) : (
                  "Save"
                )}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
