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
  Modal,
} from "react-bootstrap";
import {
  FaSearch,
  FaEye,
  FaTrash,
  FaInbox,
  FaEnvelope,
  FaPaperPlane,
} from "react-icons/fa";
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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null);
  const [loadingBookingId, setLoadingBookingId] = useState(null);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [selectedVoucherType, setSelectedVoucherType] = useState("Request");
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Generate months
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
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

  // Fetch booking details
  const fetchBookingDetails = async (bookingId) => {
    try {
      setLoadingBookingId(bookingId);
      const response = await axiosInstance.get(
        `/api/hotel-booking/details/${bookingId}`
      );
      console.log("Booking Details Response:", response.data);

      if (response.data && response.data.success) {
        setBookingDetails(response.data);
        setShowDetailsModal(true);
      }
    } catch (error) {
      console.error("Error fetching booking details:", error);
      alert("Failed to fetch booking details. Please try again.");
    } finally {
      setLoadingBookingId(null);
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
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h3 className="fw-bold text-dark">Hotel Bookings</h3>
            </div>

            {/* Search Section */}
            <Row className="mb-3">
              <Col md={3}>
                <InputGroup style={{ height: "42px" }}>
                  <InputGroup.Text
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderRight: "none",
                      borderColor: "#dee2e6",
                    }}
                  >
                    <FaSearch style={{ color: "#6c757d" }} />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search by Booking Code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      borderLeft: "none",
                      fontSize: "0.9rem",
                      borderColor: "#dee2e6",
                    }}
                  />
                </InputGroup>
              </Col>
            </Row>

            {/* Filters Section */}
            <Row className="mb-3 g-2">
              <Col md={5}>
                <Card
                  className="shadow-sm border-0"
                  style={{ borderRadius: "8px" }}
                >
                  <Card.Body className="p-3">
                    <h6
                      className="mb-2 fw-bold text-dark"
                      style={{ fontSize: "0.9rem", letterSpacing: "0.5px" }}
                    >
                      Booking Types
                    </h6>
                    <div className="d-flex gap-4">
                      <Form.Check
                        type="radio"
                        id="upcoming"
                        name="bookingType"
                        label="Upcoming"
                        checked={status === "upcoming"}
                        onChange={() => setStatus("upcoming")}
                        className="fw-semibold"
                        style={{ fontSize: "0.875rem" }}
                      />
                      <Form.Check
                        type="radio"
                        id="completed"
                        name="bookingType"
                        label="Completed"
                        checked={status === "completed"}
                        onChange={() => setStatus("completed")}
                        className="fw-semibold"
                        style={{ fontSize: "0.875rem" }}
                      />
                      <Form.Check
                        type="radio"
                        id="cancelled"
                        name="bookingType"
                        label="Cancelled"
                        checked={status === "cancelled"}
                        onChange={() => setStatus("cancelled")}
                        className="fw-semibold"
                        style={{ fontSize: "0.875rem" }}
                      />
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card
                  className="shadow-sm border-0"
                  style={{ borderRadius: "8px" }}
                >
                  <Card.Body className="p-3">
                    <h6
                      className="mb-2 fw-bold text-dark"
                      style={{ fontSize: "0.9rem", letterSpacing: "0.5px" }}
                    >
                      Time Period
                    </h6>
                    <Row>
                      <Col md={6}>
                        <Form.Select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="form-control"
                          size="sm"
                          style={{ fontSize: "0.875rem" }}
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
                          style={{ fontSize: "0.875rem" }}
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
            <Card
              className="shadow-sm border-0"
              style={{ borderRadius: "8px", overflow: "hidden", width: "100%" }}
            >
              <Card.Body className="p-0" style={{ width: "100%" }}>
                {loading ? (
                  <div className="text-center p-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">Loading bookings...</p>
                  </div>
                ) : (
                  <div
                    className="table-responsive"
                    style={{
                      maxHeight: "600px",
                      overflowY: "auto",
                      overflowX: "auto",
                      position: "relative",
                      width: "100%",
                    }}
                  >
                    <Table
                      hover
                      className="mb-0 align-middle table-bordered"
                      style={{
                        tableLayout: "auto",
                        width: "100%",
                        minWidth: "1200px",
                        fontSize: "0.875rem",
                        marginBottom: 0,
                        borderCollapse: "separate",
                        borderSpacing: 0,
                      }}
                    >
                      <thead
                        style={{
                          backgroundColor: "#f8f9fa",
                          borderBottom: "2px solid #dee2e6",
                          position: "sticky",
                          top: 0,
                          zIndex: 10,
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        }}
                      >
                        <tr>
                          <th
                            style={{
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.8rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "#495057",
                              textAlign: "center",
                              border: "1px solid #dee2e6",
                              whiteSpace: "nowrap",
                            }}
                          >
                            S.N
                          </th>
                          <th
                            style={{
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.8rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "#495057",
                              border: "1px solid #dee2e6",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Agent Name
                          </th>
                          <th
                            style={{
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.8rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "#495057",
                              border: "1px solid #dee2e6",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Customer Name
                          </th>
                          <th
                            style={{
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.8rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "#495057",
                              border: "1px solid #dee2e6",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Booking Code
                          </th>
                          <th
                            style={{
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.8rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "#495057",
                              border: "1px solid #dee2e6",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Reference Code
                          </th>
                          <th
                            style={{
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.8rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "#495057",
                              textAlign: "center",
                              border: "1px solid #dee2e6",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Book Date
                          </th>
                          <th
                            style={{
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.8rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "#495057",
                              border: "1px solid #dee2e6",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Booking Details
                          </th>
                          <th
                            style={{
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.8rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "#495057",
                              textAlign: "center",
                              border: "1px solid #dee2e6",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Deadline Date
                          </th>
                          <th
                            style={{
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.8rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "#495057",
                              textAlign: "center",
                              border: "1px solid #dee2e6",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Notification
                          </th>
                          <th
                            style={{
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.8rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "#495057",
                              textAlign: "center",
                              border: "1px solid #dee2e6",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedBookings.length === 0 ? (
                          <tr>
                            <td
                              colSpan={10}
                              className="text-center py-5 text-muted"
                              style={{
                                border: "1px solid #dee2e6",
                                backgroundColor: "#ffffff",
                              }}
                            >
                              <FaInbox
                                style={{
                                  fontSize: "2.5rem",
                                  marginBottom: "10px",
                                  color: "#adb5bd",
                                }}
                              />
                              <p className="mt-2 mb-0 fs-5">
                                No bookings found.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          pagedBookings.map((b, i) => {
                            // Format dates
                            const formatDate = (dateString) => {
                              if (!dateString) return "";
                              const date = new Date(dateString);
                              const day = String(date.getDate()).padStart(
                                2,
                                "0"
                              );
                              const month = String(
                                date.getMonth() + 1
                              ).padStart(2, "0");
                              const year = date.getFullYear();
                              return `${day}/${month}/${year}`;
                            };

                            // Format deadlineDate to show only YYYY-MM-DD
                            const formatDeadlineDate = (dateString) => {
                              if (!dateString) return "-";
                              // Extract date part from datetime string (e.g., "2025-11-04T00:00:00" -> "2025-11-04")
                              const datePart = dateString.split("T")[0];
                              return datePart || "-";
                            };

                            const baseCellStyle = {
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.875rem",
                              border: "1px solid #dee2e6",
                              verticalAlign: "middle",
                            };

                            return (
                              <tr
                                key={b.bookingId}
                                style={{
                                  backgroundColor:
                                    i % 2 === 0 ? "#ffffff" : "#f8f9fa",
                                  transition: "background-color 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    "#e7f3ff";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    i % 2 === 0 ? "#ffffff" : "#f8f9fa";
                                }}
                              >
                                <td
                                  className="text-muted fw-semibold"
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    color: "#6c757d",
                                  }}
                                >
                                  {i + 1}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                  }}
                                >
                                  <span className="fw-medium">
                                    {b.agentId || "N/A"}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                  }}
                                >
                                  <span className="fw-medium text-dark">
                                    {b.primaryGuestName || "-"}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                  }}
                                >
                                  <span className="fw-bold text-primary">
                                    {b.bookingCode || "-"}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                  }}
                                >
                                  <span
                                    className="text-muted small"
                                    style={{ fontSize: "0.8rem" }}
                                  >
                                    {b.referenceNumber || "-"}
                                  </span>
                                </td>
                                <td
                                  className="text-muted"
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                  }}
                                >
                                  {formatDate(b.bookingDate) || "-"}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                  }}
                                >
                                  <div
                                    className="d-flex align-items-center gap-2"
                                    style={{ whiteSpace: "nowrap" }}
                                  >
                                    <span
                                      className="fw-semibold text-dark"
                                      style={{ fontSize: "0.875rem" }}
                                    >
                                      {b.hotelName || "-"}
                                    </span>
                                    {formatDate(b.checkInDate) &&
                                      formatDate(b.checkOutDate) && (
                                        <>
                                          <span
                                            className="text-muted"
                                            style={{ fontSize: "0.75rem" }}
                                          >
                                            •
                                          </span>
                                          <span
                                            className="text-muted"
                                            style={{ fontSize: "0.75rem" }}
                                          >
                                            ({formatDate(b.checkInDate)} -{" "}
                                            {formatDate(b.checkOutDate)})
                                          </span>
                                        </>
                                      )}
                                  </div>
                                </td>
                                <td
                                  className="text-muted"
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                    fontFamily: "monospace",
                                  }}
                                >
                                  {formatDeadlineDate(b.deadlineDate)}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                  }}
                                >
                                  {b.bookingId !== 0 &&
                                  b.bookingCode != null ? (
                                    // <Badge bg="success" style={{
                                    //   padding: "0.4rem 0.6rem",
                                    //   fontSize: "0.75rem",
                                    //   fontWeight: "500"
                                    // }}>
                                    //   Confirmed
                                    // </Badge>
                                    <span
                                      style={{
                                        color: "#06a301ff",
                                        // backgroundColor: "#f8d7da",
                                        padding: "0.4rem 0.6rem",
                                        fontSize: "0.90rem",
                                        fontWeight: "500",
                                        borderRadius: "0.375rem",
                                        display: "inline-block",
                                      }}
                                    >
                                      Confirmed
                                    </span>
                                  ) : (
                                    // <Badge bg="danger" style={{
                                    //   padding: "0.4rem 0.6rem",
                                    //   fontSize: "0.75rem",
                                    //   fontWeight: "500"
                                    // }}>
                                    //   Not Confirmed
                                    // </Badge>
                                    <span
                                      style={{
                                        color: "#721c24",
                                        // backgroundColor: "#f8d7da",
                                        padding: "0.4rem 0.6rem",
                                        fontSize: "0.90rem",
                                        fontWeight: "500",
                                        borderRadius: "0.375rem",
                                        display: "inline-block",
                                      }}
                                    >
                                      Not Confirmed
                                    </span>
                                  )}
                                </td>
                                <td
                                  style={{
                                    ...baseCellStyle,
                                    textAlign: "center",
                                  }}
                                >
                                  <div className="d-flex gap-3 justify-content-center align-items-center">
                                    {loadingBookingId === b.bookingId ? (
                                      <Spinner
                                        animation="border"
                                        size="sm"
                                        style={{ color: "#2196f3" }}
                                      />
                                    ) : (
                                      <FaEye
                                        style={{
                                          fontSize: "18px",
                                          color: "#2196f3",
                                          cursor: "pointer",
                                          transition: "all 0.2s ease",
                                        }}
                                        title="View"
                                        onClick={() =>
                                          fetchBookingDetails(b.bookingId)
                                        }
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.color =
                                            "#1976d2";
                                          e.currentTarget.style.transform =
                                            "scale(1.2)";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.color =
                                            "#2196f3";
                                          e.currentTarget.style.transform =
                                            "scale(1)";
                                        }}
                                      />
                                    )}
                                    <FaEnvelope
                                      style={{
                                        fontSize: "18px",
                                        color: "#4caf50",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                      }}
                                      title="Send request or confirmation"
                                      onClick={() => {
                                        setSelectedBooking(b);
                                        setShowVoucherModal(true);
                                        setSelectedVoucherType("Request");
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = "#388e3c";
                                        e.currentTarget.style.transform =
                                          "scale(1.2)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = "#4caf50";
                                        e.currentTarget.style.transform =
                                          "scale(1)";
                                      }}
                                    />
                                    <FaTrash
                                      style={{
                                        fontSize: "18px",
                                        color: "#f44336",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                      }}
                                      title="Delete"
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = "#d32f2f";
                                        e.currentTarget.style.transform =
                                          "scale(1.2)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = "#f44336";
                                        e.currentTarget.style.transform =
                                          "scale(1)";
                                      }}
                                    />
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
              <Card
                className="shadow-sm border-0 mt-3"
                style={{ borderRadius: "8px" }}
              >
                <Card.Body className="py-3">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div
                      className="text-muted"
                      style={{ fontSize: "0.875rem" }}
                    >
                      Showing{" "}
                      <span className="fw-semibold text-dark">
                        {(page - 1) * perPage + 1}
                      </span>{" "}
                      to{" "}
                      <span className="fw-semibold text-dark">
                        {Math.min(page * perPage, filteredBookings.length)}
                      </span>{" "}
                      of{" "}
                      <span className="fw-semibold text-dark">
                        {filteredBookings.length}
                      </span>{" "}
                      entries
                    </div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 1}
                        onClick={() => page > 1 && setPage(page - 1)}
                        style={{
                          cursor: page === 1 ? "not-allowed" : "pointer",
                          opacity: page === 1 ? 0.5 : 1,
                        }}
                      />
                      {[
                        ...Array(Math.ceil(filteredBookings.length / perPage)),
                      ].map((_, i) => (
                        <Pagination.Item
                          key={i + 1}
                          active={page === i + 1}
                          onClick={() => setPage(i + 1)}
                          style={{
                            cursor: "pointer",
                            minWidth: "38px",
                            textAlign: "center",
                          }}
                        >
                          {i + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={
                          page === Math.ceil(filteredBookings.length / perPage)
                        }
                        onClick={() =>
                          page < Math.ceil(filteredBookings.length / perPage) &&
                          setPage(page + 1)
                        }
                        style={{
                          cursor:
                            page ===
                            Math.ceil(filteredBookings.length / perPage)
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            page ===
                            Math.ceil(filteredBookings.length / perPage)
                              ? 0.5
                              : 1,
                        }}
                      />
                    </Pagination>
                  </div>
                </Card.Body>
              </Card>
            )}

            {/* Booking Details Modal */}
            <Modal
              show={showDetailsModal}
              onHide={() => setShowDetailsModal(false)}
              size="lg"
              centered
            >
              <Modal.Header
                closeButton
                style={{
                  backgroundColor: "#fff",
                  borderBottom: "2px solid #e9ecef",
                }}
              >
                <Modal.Title className="fw-bold d-flex align-items-center">
                  <FaEye className="me-2 text-primary" />
                  <span>Booking Details</span>
                </Modal.Title>
              </Modal.Header>
              <Modal.Body style={{ padding: "1.5rem" }}>
                {loadingBookingId !== null ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">
                      Loading booking details...
                    </p>
                  </div>
                ) : bookingDetails ? (
                  <div>
                    {/* Booking Header - Prominent */}
                    <div className="mb-4 p-3 bg-light rounded border">
                      <Row className="align-items-center">
                        <Col md={8}>
                          <div className="d-flex align-items-center gap-3 mb-2">
                            <h5 className="mb-0 fw-bold text-dark">
                              {bookingDetails.bookingHeader?.bookingCode ||
                                "N/A"}
                            </h5>
                            <Badge
                              bg={
                                bookingDetails.bookingHeader?.bookingStatus ===
                                "UPCOMING"
                                  ? "warning"
                                  : bookingDetails.bookingHeader
                                      ?.bookingStatus === "COMPLETED"
                                  ? "success"
                                  : "danger"
                              }
                              style={{
                                fontSize: "0.75rem",
                                padding: "0.4rem 0.8rem",
                              }}
                            >
                              {bookingDetails.bookingHeader?.bookingStatus ||
                                "-"}
                            </Badge>
                          </div>
                          <div className="text-muted small">
                            <span className="me-3">
                              <strong>Booking ID:</strong>{" "}
                              {bookingDetails.bookingHeader?.bookingId || "-"}
                            </span>
                            <span>
                              <strong>Reference:</strong>{" "}
                              {bookingDetails.bookingHeader?.referenceNumber ||
                                "-"}
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
                                ? new Date(
                                    bookingDetails.bookingHeader.bookingDate
                                  ).toLocaleDateString("en-US", {
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
                                  {new Date(
                                    bookingDetails.bookingHeader.deadlineDate
                                  ).toLocaleDateString("en-US", {
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
                            style={{
                              fontSize: "0.9rem",
                              padding: "0.75rem 1rem",
                            }}
                          >
                            Guest Information
                          </Card.Header>
                          <Card.Body>
                            <div className="mb-3">
                              <div className="text-muted small mb-1">
                                Guest Name
                              </div>
                              <div className="fw-semibold">
                                {bookingDetails.guestInformation?.guestName ||
                                  "-"}
                              </div>
                            </div>
                            <Row>
                              <Col md={6}>
                                <div className="mb-3">
                                  <div className="text-muted small mb-1">
                                    Email
                                  </div>
                                  <div>
                                    {bookingDetails.guestInformation?.email ||
                                      "-"}
                                  </div>
                                </div>
                              </Col>
                              <Col md={6}>
                                <div className="mb-3">
                                  <div className="text-muted small mb-1">
                                    Mobile Number
                                  </div>
                                  <div>
                                    {bookingDetails.guestInformation
                                      ?.mobileNumber || "-"}
                                  </div>
                                </div>
                              </Col>
                            </Row>
                            <div>
                              <div className="text-muted small mb-1">
                                Nationality
                              </div>
                              <div>
                                {bookingDetails.guestInformation
                                  ?.nativeCountry || "-"}
                              </div>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>

                      {/* Right Column - Pricing Summary */}
                      <Col md={5}>
                        <Card
                          className="border-0 shadow-sm"
                          style={{ position: "sticky", top: "1rem" }}
                        >
                          <Card.Header
                            className="bg-light border-bottom fw-semibold"
                            style={{
                              fontSize: "0.9rem",
                              padding: "0.75rem 1rem",
                            }}
                          >
                            Pricing Summary
                          </Card.Header>
                          <Card.Body>
                            <div className="mb-3">
                              <div className="d-flex justify-content-between mb-2">
                                <span className="text-muted">Room Rate</span>
                                <span className="fw-semibold">
                                  {bookingDetails.bookingDetails?.currency ||
                                    "AED"}{" "}
                                  {bookingDetails.bookingDetails?.rate?.toFixed(
                                    2
                                  ) || "0.00"}
                                </span>
                              </div>
                              {bookingDetails.bookingDetails?.taxDiscount !==
                                0 && (
                                <div className="d-flex justify-content-between mb-2">
                                  <span className="text-muted">
                                    {bookingDetails.bookingDetails.taxDiscount >
                                    0
                                      ? "Tax"
                                      : "Discount"}
                                  </span>
                                  <span
                                    className={
                                      bookingDetails.bookingDetails
                                        .taxDiscount > 0
                                        ? "text-danger"
                                        : "text-success"
                                    }
                                  >
                                    {bookingDetails.bookingDetails.taxDiscount >
                                    0
                                      ? "+"
                                      : "-"}{" "}
                                    {bookingDetails.bookingDetails?.currency ||
                                      "AED"}{" "}
                                    {Math.abs(
                                      bookingDetails.bookingDetails.taxDiscount
                                    ).toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>
                            <hr className="my-3" />
                            <div className="d-flex justify-content-between align-items-center p-3 bg-light rounded">
                              <span className="fw-bold fs-5">Total Amount</span>
                              <span className="text-success fw-bold fs-4">
                                {bookingDetails.bookingDetails?.currency ||
                                  "AED"}{" "}
                                {bookingDetails.bookingDetails?.total?.toFixed(
                                  2
                                ) || "0.00"}
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
                          <div className="text-muted small mb-1">
                            Hotel Name
                          </div>
                          <div className="fw-semibold">
                            {bookingDetails.bookingDetails?.hotelName || "-"}
                          </div>
                        </div>
                        <Row>
                          <Col md={6}>
                            <div className="mb-3">
                              <div className="text-muted small mb-1">
                                Check-In Date
                              </div>
                              <div>
                                {bookingDetails.bookingDetails?.checkInDate ||
                                  "-"}
                              </div>
                            </div>
                          </Col>
                          <Col md={6}>
                            <div className="mb-3">
                              <div className="text-muted small mb-1">
                                Check-Out Date
                              </div>
                              <div>
                                {bookingDetails.bookingDetails?.checkOutDate ||
                                  "-"}
                              </div>
                            </div>
                          </Col>
                        </Row>
                        <Row>
                          <Col md={4}>
                            <div className="mb-3">
                              <div className="text-muted small mb-1">
                                Duration
                              </div>
                              <div>
                                {bookingDetails.bookingDetails
                                  ?.numberOfNights || "0"}{" "}
                                Night(s)
                              </div>
                            </div>
                          </Col>
                          <Col md={4}>
                            <div className="mb-3">
                              <div className="text-muted small mb-1">
                                Number of Rooms
                              </div>
                              <div>
                                {bookingDetails.bookingDetails?.numberOfRooms ||
                                  "0"}
                              </div>
                            </div>
                          </Col>
                          <Col md={4}>
                            <div className="mb-3">
                              <div className="text-muted small mb-1">
                                Total Guests
                              </div>
                              <div>
                                {bookingDetails.bookingDetails
                                  ?.numberOfAdults || "0"}{" "}
                                Adults
                                {bookingDetails.bookingDetails
                                  ?.numberOfChildren > 0 &&
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
                        <div className="p-4 bg-light rounded border">
                          <div className="mb-3">
                            <h6 className="fw-bold text-dark mb-3">
                              Room Details
                            </h6>
                          </div>
                          <div className="table-responsive">
                            <Table bordered hover className="mb-0 bg-white">
                              <thead className="table-light">
                                <tr>
                                  <th
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "0.75rem",
                                      fontWeight: "600",
                                    }}
                                  >
                                    Room No
                                  </th>
                                  <th
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "0.75rem",
                                      fontWeight: "600",
                                    }}
                                  >
                                    Room Category
                                  </th>
                                  <th
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "0.75rem",
                                      fontWeight: "600",
                                    }}
                                  >
                                    Meal Plan
                                  </th>
                                  <th
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "0.75rem",
                                      fontWeight: "600",
                                    }}
                                  >
                                    Adults
                                  </th>
                                  <th
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "0.75rem",
                                      fontWeight: "600",
                                    }}
                                  >
                                    Children
                                  </th>
                                  <th
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "0.75rem",
                                      fontWeight: "600",
                                      textAlign: "right",
                                    }}
                                  >
                                    Rate
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {bookingDetails.bookingDetails.rooms.map(
                                  (room, index) => (
                                    <tr key={index}>
                                      <td
                                        style={{
                                          padding: "0.75rem",
                                          verticalAlign: "middle",
                                        }}
                                      >
                                        <span className="fw-bold text-primary">
                                          Room {room.roomNo || index + 1}
                                        </span>
                                      </td>
                                      <td
                                        style={{
                                          padding: "0.75rem",
                                          verticalAlign: "middle",
                                        }}
                                      >
                                        {room.roomCategory || "-"}
                                      </td>
                                      <td
                                        style={{
                                          padding: "0.75rem",
                                          verticalAlign: "middle",
                                        }}
                                      >
                                        {room.mealPlan || "-"}
                                      </td>
                                      <td
                                        style={{
                                          padding: "0.75rem",
                                          verticalAlign: "middle",
                                          textAlign: "center",
                                        }}
                                      >
                                        {room.adults || "0"}
                                      </td>
                                      <td
                                        style={{
                                          padding: "0.75rem",
                                          verticalAlign: "middle",
                                          textAlign: "center",
                                        }}
                                      >
                                        {room.children || "0"}
                                      </td>
                                      <td
                                        style={{
                                          padding: "0.75rem",
                                          verticalAlign: "middle",
                                          textAlign: "right",
                                        }}
                                      >
                                        {bookingDetails.bookingDetails
                                          ?.currency || "AED"}{" "}
                                        {room.rate?.toFixed(2) || "0.00"}
                                      </td>
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </Table>
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted">No booking details available.</p>
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer
                style={{
                  backgroundColor: "#f8f9fa",
                  borderTop: "1px solid #dee2e6",
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => setShowDetailsModal(false)}
                >
                  Close
                </Button>
              </Modal.Footer>
            </Modal>

            {/* Request Confirmation Voucher Modal */}
            <Modal
              show={showVoucherModal}
              onHide={() => {
                setShowVoucherModal(false);
                setSelectedBooking(null);
                setSelectedVoucherType("Request");
              }}
              size="xl"
              centered
              backdrop="static"
              keyboard={false}
            >
              <Modal.Header
                closeButton
                style={{ backgroundColor: "#0d6efd", color: "#fff" }}
              >
                <Modal.Title className="fw-bold">
                  Request Confirmation Voucher
                </Modal.Title>
              </Modal.Header>
              <Modal.Body style={{ padding: "1.5rem" }}>
                {selectedBooking && (
                  <>
                    {/* Radio Buttons */}
                    <div className="mb-4 d-flex gap-4">
                      <FormCheck
                        type="radio"
                        id="voucher-request"
                        name="voucherType"
                        label="Request"
                        checked={selectedVoucherType === "Request"}
                        onChange={() => setSelectedVoucherType("Request")}
                        className="fw-semibold"
                      />
                      <FormCheck
                        type="radio"
                        id="voucher-confirmation"
                        name="voucherType"
                        label="Confirmation"
                        checked={selectedVoucherType === "Confirmation"}
                        onChange={() => setSelectedVoucherType("Confirmation")}
                        className="fw-semibold"
                      />
                      <FormCheck
                        type="radio"
                        id="voucher-voucher"
                        name="voucherType"
                        label="Voucher"
                        checked={selectedVoucherType === "Voucher"}
                        onChange={() => setSelectedVoucherType("Voucher")}
                        className="fw-semibold"
                      />
                    </div>

                    {/* Table */}
                    <div className="table-responsive">
                      <Table bordered hover className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th
                              style={{
                                fontSize: "0.85rem",
                                padding: "0.75rem",
                                fontWeight: "600",
                              }}
                            >
                              Hotel
                            </th>
                            <th
                              style={{
                                fontSize: "0.85rem",
                                padding: "0.75rem",
                                fontWeight: "600",
                              }}
                            >
                              Confirmation Status
                            </th>
                            {selectedVoucherType === "Request" && (
                              <>
                                <th
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "0.75rem",
                                    fontWeight: "600",
                                  }}
                                >
                                  Booking code
                                </th>
                                <th
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "0.75rem",
                                    fontWeight: "600",
                                  }}
                                >
                                  Confirmation Reference
                                </th>
                                <th
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "0.75rem",
                                    fontWeight: "600",
                                  }}
                                >
                                  Price Reference
                                </th>
                              </>
                            )}
                            {selectedVoucherType === "Confirmation" && (
                              <>
                                <th
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "0.75rem",
                                    fontWeight: "600",
                                  }}
                                >
                                  Confirmation Reference
                                </th>
                                <th
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "0.75rem",
                                    fontWeight: "600",
                                  }}
                                >
                                  Supplier Reference
                                </th>
                              </>
                            )}
                            {selectedVoucherType === "Voucher" && (
                              <>
                                <th
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "0.75rem",
                                    fontWeight: "600",
                                  }}
                                >
                                  Confirmation Reference
                                </th>
                                <th
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "0.75rem",
                                    fontWeight: "600",
                                  }}
                                >
                                  Supplier Reference
                                </th>
                              </>
                            )}
                            <th
                              style={{
                                fontSize: "0.85rem",
                                padding: "0.75rem",
                                fontWeight: "600",
                              }}
                            >
                              Check In
                            </th>
                            <th
                              style={{
                                fontSize: "0.85rem",
                                padding: "0.75rem",
                                fontWeight: "600",
                              }}
                            >
                              Check Out
                            </th>
                            <th
                              style={{
                                fontSize: "0.85rem",
                                padding: "0.75rem",
                                fontWeight: "600",
                              }}
                            >
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td
                              style={{
                                padding: "0.75rem",
                                verticalAlign: "middle",
                              }}
                            >
                              {selectedBooking.hotelName || "-"}
                            </td>
                            <td
                              style={{
                                padding: "0.75rem",
                                verticalAlign: "middle",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "0.4rem 0.6rem",
                                  fontWeight: "500",
                                  color:
                                    selectedBooking.bookingId !== 0 &&
                                    selectedBooking.bookingCode != null
                                      ? "#28a745" // Bootstrap success green
                                      : "#dc3545", // Bootstrap danger red
                                  backgroundColor:
                                    selectedBooking.bookingId !== 0 &&
                                    selectedBooking.bookingCode != null
                                      ? "#d4edda" // Light green background
                                      : "#f8d7da", // Light red background
                                  borderRadius: "0.375rem",
                                  display: "inline-block",
                                }}
                              >
                                {selectedBooking.bookingId !== 0 &&
                                selectedBooking.bookingCode != null
                                  ? "CONFIRMED"
                                  : "NOT CONFIRMED"}
                              </span>
                            </td>
                            {selectedVoucherType === "Request" && (
                              <>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  {selectedBooking.bookingCode || "-"}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  {selectedBooking.referenceNumber || "null"}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  null
                                </td>
                              </>
                            )}
                            {selectedVoucherType === "Confirmation" && (
                              <>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  {selectedBooking.referenceNumber || "null"}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  0
                                </td>
                              </>
                            )}
                            {selectedVoucherType === "Voucher" && (
                              <>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  {selectedBooking.referenceNumber || "null"}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  0
                                </td>
                              </>
                            )}
                            <td
                              style={{
                                padding: "0.75rem",
                                verticalAlign: "middle",
                              }}
                            >
                              {selectedBooking.checkInDate
                                ? new Date(
                                    selectedBooking.checkInDate
                                  ).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "-"}
                            </td>
                            <td
                              style={{
                                padding: "0.75rem",
                                verticalAlign: "middle",
                              }}
                            >
                              {selectedBooking.checkOutDate
                                ? new Date(
                                    selectedBooking.checkOutDate
                                  ).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "-"}
                            </td>
                            <td
                              style={{
                                padding: "0.75rem",
                                verticalAlign: "middle",
                                textAlign: "center",
                              }}
                            >
                              <Button
                                variant="primary"
                                size="sm"
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  padding: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                                title="Send"
                              >
                                <FaPaperPlane style={{ fontSize: "14px" }} />
                              </Button>
                            </td>
                          </tr>
                        </tbody>
                      </Table>
                    </div>
                  </>
                )}
              </Modal.Body>
              <Modal.Footer
                style={{
                  backgroundColor: "#f8f9fa",
                  borderTop: "1px solid #dee2e6",
                }}
              >
                <Button
                  variant="primary"
                  onClick={() => {
                    setShowVoucherModal(false);
                    setSelectedBooking(null);
                    setSelectedVoucherType("Request");
                  }}
                >
                  <i className="bi bi-check-circle me-1"></i> Close
                </Button>
              </Modal.Footer>
            </Modal>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default HotelBookingList;
