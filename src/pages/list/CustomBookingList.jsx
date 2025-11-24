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
} from "react-bootstrap";
import {
  FaSearch,
  FaEye,
  FaArrowLeft,
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
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Fetch bookings from API
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: page - 1,
        size: perPage,
        status: status,
      };

      // Add time period filter
      if (timePeriod === "currentMonth") {
        const now = new Date();
        params.month = now.getMonth() + 1;
        params.year = now.getFullYear();
      }

      const response = await axiosInstance.get(
        "/api/makeYourOwnPackage/getCustomBookingList",
        { params }
      );

      if (response.data) {
        setBookings(response.data.content || []);
        setTotalPages(response.data.totalPages || 0);
        setTotalElements(response.data.totalElements || 0);
      }
    } catch (error) {
      console.error("Error fetching custom bookings:", error);
      toast.error("Failed to load bookings");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, status, timePeriod]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [status, timePeriod, perPage]);

  // Filter bookings based on search term
  const filteredBookings = useMemo(() => {
    if (!search.trim()) {
      return bookings;
    }
    const searchLower = search.toLowerCase();
    return bookings.filter((booking) =>
      String(booking.packageCode || "").toLowerCase().includes(searchLower) ||
      String(booking.customerName || "").toLowerCase().includes(searchLower) ||
      String(booking.agentName || "").toLowerCase().includes(searchLower)
    );
  }, [bookings, search]);

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
      return date.toLocaleDateString("en-GB");
    } catch {
      return dateString;
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handleViewDetails = (bookingId) => {
    navigate(`/booking-details/custom-booking/${bookingId}`);
  };

  const displayStart = filteredBookings.length > 0 ? (page - 1) * perPage + 1 : 0;
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
                <Button
                  variant="link"
                  className="p-0 text-dark"
                  onClick={() => navigate(-1)}
                >
                  <FaArrowLeft size={20} />
                </Button>
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
                            <th style={{ width: "100px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBookings.length > 0 ? (
                            filteredBookings.map((booking, index) => (
                              <tr key={booking.bookingId || index}>
                                <td>{(page - 1) * perPage + index + 1}</td>
                                <td>{booking.agentName || "-"}</td>
                                <td>{booking.customerName || "-"}</td>
                                <td>
                                  <Badge bg="info">
                                    {booking.packageCode || booking.bookingId || "-"}
                                  </Badge>
                                </td>
                                <td>{formatDate(booking.bookDate || booking.bookingDate)}</td>
                                <td>{formatDate(booking.tourDate)}</td>
                                <td>
                                  <Button
                                    variant="info"
                                    size="sm"
                                    onClick={() => handleViewDetails(booking.bookingId)}
                                    title="View Details"
                                  >
                                    <FaEye />
                                  </Button>
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
    </div>
  );
};

export default CustomBookingList;

