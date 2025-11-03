import React, { useEffect, useState, useMemo } from "react";
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
  Dropdown,
  FormCheck,
  Spinner,
  Pagination,
} from "react-bootstrap";
import { FaSearch, FaEye, FaTrash, FaInbox, FaEnvelope } from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const HotelBookingList = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [apiData, setApiData] = useState({
    upcomingBookings: { content: [] },
    completedBookings: { content: [] },
    cancelledBookings: { content: [] },
  });

  // Generate months
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Generate years (2020 to current year + 1)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2014 }, (_, i) => 2020 + i);

  // Fetch data from API
  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/api/bookings/list");
      console.log("API Response:", response.data);

      if (response.data && response.data.success) {
        setApiData({
          upcomingBookings: response.data.upcomingBookings || { content: [] },
          completedBookings: response.data.completedBookings || { content: [] },
          cancelledBookings: response.data.cancelledBookings || { content: [] },
        });
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Get bookings based on selected status
  useEffect(() => {
    let currentBookings = [];
    let pagination = { totalPages: 0, totalElements: 0 };

    switch (status) {
      case "upcoming":
        currentBookings = apiData.upcomingBookings.content || [];
        pagination.totalPages = apiData.upcomingBookings.totalPages || 0;
        pagination.totalElements = apiData.upcomingBookings.totalElements || 0;
        break;
      case "completed":
        currentBookings = apiData.completedBookings.content || [];
        pagination.totalPages = apiData.completedBookings.totalPages || 0;
        pagination.totalElements = apiData.completedBookings.totalElements || 0;
        break;
      case "cancelled":
        currentBookings = apiData.cancelledBookings.content || [];
        pagination.totalPages = apiData.cancelledBookings.totalPages || 0;
        pagination.totalElements = apiData.cancelledBookings.totalElements || 0;
        break;
      default:
        currentBookings = [];
    }

    setBookings(currentBookings);
    setTotalPages(pagination.totalPages);
    setTotalElements(pagination.totalElements);
    setPage(1); // Reset to first page when status changes
  }, [status, apiData]);

  // Filter bookings based on search term
  const filteredBookings = useMemo(() => {
    if (!search.trim()) {
      return bookings;
    }
    return bookings.filter((booking) =>
      String(booking.bookingId).toLowerCase().includes(search.toLowerCase())
    );
  }, [bookings, search]);

  const pagedBookings = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return filteredBookings.slice(startIndex, endIndex);
  }, [filteredBookings, page, perPage]);

  const getStatusBadge = (s) => {
    switch (s?.toLowerCase()) {
      case "confirmed":
      case "completed":
        return "success";
      case "cancelled":
      case "cancelled":
        return "danger";
      case "pending":
      case "upcoming":
        return "warning";
      default:
        return "secondary";
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h3 className="fw-bold text-dark">Hotel Bookings</h3>
            </div>

            {/* Search Section */}
            <Row className="mb-3">
              <Col md={4}>
                <InputGroup>
                  <InputGroup.Text>
                    <FaSearch />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search by Booking Code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </InputGroup>
              </Col>
            </Row>

            {/* Filters Section */}
            <Row className="mb-4 g-3">
              <Col md={5}>
                <Card className="shadow-sm border-0 h-70">
                  <Card.Body className="p-3">
                    <h6 className="mb-2 fw-bold text-dark">Booking Types</h6>
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
                  </Card.Body>
                </Card>
              </Col>
              <Col md={5} className="ms-auto">
                <Card className="shadow-sm border-0 h-70">
                  <Card.Body className="p-3">
                    <h6 className="mb-2 fw-bold text-dark">Time Period</h6>
                    <Row>
                      <Col md={6}>
                        <Form.Select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="form-control"
                          size="sm"
                        >
                          <option value="">Select Month</option>
                          {months.map((month, index) => (
                            <option key={index} value={index + 1}>
                              {month}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                      <Col md={6}>
                        <Form.Select
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(e.target.value)}
                          className="form-control"
                          size="sm"
                        >
                          <option value="">Select Year</option>
                          {years.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Table */}
            <Card className="shadow-sm border-0">
              <Card.Body className="p-0">
                {loading ? (
                  <div className="text-center p-5">
                    <Spinner animation="border" />
                    <p className="mt-2 text-muted">Loading bookings...</p>
                  </div>
                ) : (
                  <div className="table-responsive" style={{ maxHeight: "none", overflow: "visible" }}>
                    <Table hover className="mb-0 align-middle table-sm table-bordered" style={{ tableLayout: "fixed", width: "100%" }}>
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: "40px", padding: "0.5rem 0.25rem", fontSize: "0.75rem", border: "1px solid #dee2e6" }}>S.N</th>
                          <th style={{ width: "100px", padding: "0.5rem 0.25rem", fontSize: "0.75rem", border: "1px solid #dee2e6" }}>Agent Name</th>
                          <th style={{ width: "140px", padding: "0.5rem 0.25rem", fontSize: "0.75rem", border: "1px solid #dee2e6" }}>Customer Name</th>
                          <th style={{ width: "100px", padding: "0.5rem 0.25rem", fontSize: "0.75rem", border: "1px solid #dee2e6" }}>Booking Code</th>
                          <th style={{ width: "80px", padding: "0.5rem 0.25rem", fontSize: "0.75rem", border: "1px solid #dee2e6" }}>Reference Code</th>
                          <th style={{ width: "100px", padding: "0.5rem 0.25rem", fontSize: "0.75rem", border: "1px solid #dee2e6" }}>Book Date</th>
                          <th style={{ width: "220px", padding: "0.5rem 0.25rem", fontSize: "0.75rem", border: "1px solid #dee2e6" }}>Booking Details</th>
                          <th style={{ width: "100px", padding: "0.5rem 0.25rem", fontSize: "0.75rem", border: "1px solid #dee2e6" }}>Deadline Date</th>
                          <th style={{ width: "80px", padding: "0.5rem 0.25rem", fontSize: "0.75rem", border: "1px solid #dee2e6" }}>Notification</th>
                          <th style={{ width: "100px", padding: "0.5rem 0.25rem", fontSize: "0.75rem", border: "1px solid #dee2e6" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedBookings.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="text-center py-5 text-muted" style={{ border: "1px solid #dee2e6" }}>
                              <FaInbox style={{ fontSize: "2rem", marginBottom: "10px" }} />
                              <p className="mt-2 mb-0">No bookings found.</p>
                            </td>
                          </tr>
                        ) : (
                          pagedBookings.map((b, i) => {
                            // Format dates
                            const formatDate = (dateString) => {
                              if (!dateString) return "";
                              const date = new Date(dateString);
                              const day = String(date.getDate()).padStart(2, "0");
                              const month = String(date.getMonth() + 1).padStart(2, "0");
                              const year = date.getFullYear();
                              return `${day}/${month}/${year}`;
                            };

                            return (
                              <tr key={b.bookingId}>
                                <td className="text-muted fw-semibold" style={{ padding: "0.5rem 0.25rem", fontSize: "0.9rem", border: "1px solid #dee2e6" }}>{i + 1}</td>
                                <td style={{ padding: "0.5rem 0.25rem", fontSize: "0.9rem", border: "1px solid #dee2e6" }}>{b.agentId || "N/A"}</td>
                                <td style={{ padding: "0.5rem 0.25rem", fontSize: "0.9rem", border: "1px solid #dee2e6" }}>{b.primaryGuestName}</td>
                                <td className="fw-bold" style={{ padding: "0.5rem 0.25rem", fontSize: "0.9rem", border: "1px solid #dee2e6" }}>{b.bookingId}</td>
                                <td className="text-muted small" style={{ padding: "0.5rem 0.25rem", fontSize: "0.9rem", border: "1px solid #dee2e6" }}>{b.bookingId}</td>
                                <td className="text-muted" style={{ padding: "0.5rem 0.25rem", fontSize: "0.9rem", border: "1px solid #dee2e6" }}>{formatDate(b.bookingDate)}</td>
                                <td style={{ padding: "0.5rem 0.25rem", fontSize: "0.9rem", border: "1px solid #dee2e6" }}>
                                  <div>
                                    <div className="fw-semibold">{b.hotelName}</div>
                                    <div className="text-muted">
                                      ({formatDate(b.checkInDate)}-{formatDate(b.checkOutDate)})
                                    </div>
                                  </div>
                                </td>
                                <td className="text-muted" style={{ padding: "0.5rem 0.25rem", fontSize: "0.9rem", border: "1px solid #dee2e6" }}>{b.checkInDate || "N/A"}</td>
                                <td style={{ padding: "0.5rem 0.25rem", fontSize: "0.9rem", border: "1px solid #dee2e6" }}>
                                  <Badge bg="success">Confirmed</Badge>
                                </td>
                                <td style={{ padding: "0.5rem 0.25rem", fontSize: "0.9rem", border: "1px solid #dee2e6" }}>
                                  <div className="d-flex gap-1">
                                    <button
                                      className="btn btn-sm p-0"
                                      style={{ width: "24px", height: "24px" }}
                                      title="View"
                                    >
                                      <FaEye style={{ fontSize: "15px", color: "blue" }} />
                                    </button>
                                    <button
                                      className="btn btn-sm p-0"
                                      style={{ width: "24px", height: "24px" }}
                                      title="Send request or confirmation"
                                    >
                                      <FaEnvelope style={{ fontSize: "15px", color: "green" }} />
                                    </button>
                                    <button
                                      className="btn btn-sm p-0"
                                      style={{ width: "24px", height: "24px" }}
                                      title="Delete"
                                    >
                                      <FaTrash style={{ fontSize: "15px", color: "red" }} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Pagination */}
            {!loading && filteredBookings.length > 0 && (
              <Card className="shadow-sm border-0 mt-3">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="text-muted">
                      Showing {((page - 1) * perPage) + 1} to{" "}
                      {Math.min(page * perPage, filteredBookings.length)} of{" "}
                      {filteredBookings.length} entries
                    </div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 1}
                        onClick={() => page > 1 && setPage(page - 1)}
                      />
                      {[...Array(Math.ceil(filteredBookings.length / perPage))].map((_, i) => (
                        <Pagination.Item
                          key={i + 1}
                          active={page === i + 1}
                          onClick={() => setPage(i + 1)}
                        >
                          {i + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page === Math.ceil(filteredBookings.length / perPage)}
                        onClick={() =>
                          page < Math.ceil(filteredBookings.length / perPage) &&
                          setPage(page + 1)
                        }
                      />
                    </Pagination>
                  </div>
                </Card.Body>
              </Card>
            )}
          </Container>
        </main>
      </div>
    </div>
  );
};

export default HotelBookingList;
