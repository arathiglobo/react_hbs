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
  Pagination,
  Dropdown,
  FormCheck,
  Spinner,
} from "react-bootstrap";
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
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [sortColumn, setSortColumn] = useState("id");
  const [sortDirection, setSortDirection] = useState("asc");

  // Time filters
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Fetch data from API
  const fetchBookings = async () => {
    try {
      setLoading(true);
      const staticBookings = [
        {
          bookingId: 101,
          hotelName: "The Palm Resort",
          guestName: "Arjun Kumar",
          checkInDate: "2025-12-12",
          checkOutDate: "2025-12-13",
          nights: 1,
          totalAmount: 500,
          currency: "AED",
          status: "CONFIRMED",
          agentName : "John Doe",
          customerName: "Test",
          bookingCode:"CNF123",
          referenceCode:"REF1234",
        },
      ];
      // const response = await axiosInstance.get("/api/bookings");
      // const finalData = response.data?.length ? response.data : staticBookings;
      // setBookings(finalData || []);
      setBookings(staticBookings || []);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Filter by status, search, and time period
  console.log("Bookings:", bookings);
  const filteredBookings = useMemo(() => {
    const query = search.toLowerCase().trim();

    return bookings.filter((b) => {
      const matchStatus = b.status === status;
      const matchSearch = [
        b.agentName,
        b.customerName,
        b.bookingCode,
        b.referenceCode,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

      const bookingDate = new Date(b.bookDate);
      const matchYear = selectedYear
        ? bookingDate.getFullYear().toString() === selectedYear
        : true;
      const matchMonth = selectedMonth
        ? bookingDate.getMonth() + 1 === Number(selectedMonth)
        : true;

      let matchRange = true;
      if (fromDate && toDate) {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        matchRange = bookingDate >= from && bookingDate <= to;
      }

      return (
        matchStatus && matchSearch && matchYear && matchMonth && matchRange
      );
    });
  }, [bookings, search, status, selectedYear, selectedMonth, fromDate, toDate]);

  // Sorting
  const sortedBookings = useMemo(() => {
    return [...filteredBookings].sort((a, b) => {
      const aVal = a[sortColumn]?.toString().toLowerCase() || "";
      const bVal = b[sortColumn]?.toString().toLowerCase() || "";
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredBookings, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedBookings.length / perPage) || 1;
  const currentPage = Math.min(page, totalPages);
  const pagedBookings = sortedBookings.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  const toggleSort = (column) => {
    if (column === sortColumn)
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const toggleSelectAll = (checked) => {
    const ids = checked ? pagedBookings.map((b) => b.id) : [];
    setSelectedRows(new Set(ids));
  };

  const toggleSelect = (id, checked) => {
    const newSet = new Set(selectedRows);
    checked ? newSet.add(id) : newSet.delete(id);
    setSelectedRows(newSet);
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case "upcoming":
        return "primary";
      case "completed":
        return "success";
      case "cancelled":
        return "danger";
      default:
        return "secondary";
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold text-dark">Hotel Bookings</h3>
            </div>

            {/* Filters */}
            <Card className="shadow-sm border-0 mb-4">
              <Card.Body>
                <Row className="align-items-center mb-3">
                  <Col md={6}>
                    <div className="d-flex align-items-center">
                      <Form.Label className="me-3 mb-0 fw-semibold">
                        Booking Types:
                      </Form.Label>
                      <div className="d-flex gap-3 flex-wrap">
                        {["upcoming", "completed", "cancelled"].map((s) => (
                          <Form.Check
                            key={s}
                            type="radio"
                            name="bookingStatus"
                            id={`status-${s}`}
                            label={s.charAt(0).toUpperCase() + s.slice(1)}
                            value={s}
                            checked={status === s}
                            onChange={(e) => setStatus(e.target.value)}
                            inline
                          />
                        ))}
                      </div>
                    </div>
                  </Col>

                  <Col md={6} className="d-flex justify-content-end">
                    <div>
                      <Form.Label className="fw-semibold">
                        Time Period
                      </Form.Label>
                      <InputGroup>
                        <Form.Select
                          value={selectedMonth || new Date().getMonth() + 1}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                        >
                          {Array.from({ length: 12 }, (_, i) => {
                            const monthValue = i + 1;
                            const monthName = new Date(0, i).toLocaleString(
                              "default",
                              {
                                month: "long",
                              }
                            );
                            return (
                              <option key={monthValue} value={monthValue}>
                                {monthName}
                              </option>
                            );
                          })}
                        </Form.Select>

                        <Form.Select
                          value={selectedYear || new Date().getFullYear()}
                          onChange={(e) => setSelectedYear(e.target.value)}
                        >
                          {Array.from({ length: 21 }, (_, i) => {
                            const year = 2020 + i;
                            return (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            );
                          })}
                        </Form.Select>
                      </InputGroup>
                    </div>
                  </Col>
                </Row>

                {/* <Row className="mt-3 g-3">
                  <Col md={3}>
                    <Form.Label>From Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>To Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </Col>
                  <Col md={3} className="d-flex align-items-end">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelectedYear("");
                        setSelectedMonth("");
                        setFromDate("");
                        setToDate("");
                      }}
                    >
                      Clear Filters
                    </Button>
                  </Col>
                </Row> */}
              </Card.Body>
            </Card>

            {/* Table */}
            <Card className="shadow-sm border-0">
              <Card.Body className="p-0">
                {loading ? (
                  <div className="text-center p-5">
                    <Spinner animation="border" />
                    <p className="mt-2 text-muted">Loading bookings...</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <Table hover className="mb-0 align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>
                            <FormCheck
                              checked={
                                selectedRows.size === pagedBookings.length &&
                                pagedBookings.length > 0
                              }
                              onChange={(e) =>
                                toggleSelectAll(e.target.checked)
                              }
                            />
                          </th>
                          <th>#</th>
                          <th>Agent</th>
                          <th>Customer</th>
                          <th>Booking Code</th>
                          <th>Reference</th>
                          <th>Book Date</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedBookings.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-5">
                              No bookings found.
                            </td>
                          </tr>
                        ) : (
                          pagedBookings.map((b, i) => (
                            <tr key={b.id}>
                              <td>
                                <FormCheck
                                  checked={selectedRows.has(b.id)}
                                  onChange={(e) =>
                                    toggleSelect(b.id, e.target.checked)
                                  }
                                />
                              </td>
                              <td>{(currentPage - 1) * perPage + i + 1}</td>
                              <td>{b.agentName}</td>
                              <td>{b.customerName}</td>
                              <td>{b.bookingCode}</td>
                              <td>{b.referenceCode}</td>
                              <td>{b.bookDate}</td>
                              <td>
                                <Badge bg={getStatusBadge(b.status)}>
                                  {b.status}
                                </Badge>
                              </td>
                              <td>
                                <Dropdown>
                                  <Dropdown.Toggle
                                    size="sm"
                                    variant="outline-secondary"
                                  >
                                    Actions
                                  </Dropdown.Toggle>
                                  <Dropdown.Menu>
                                    <Dropdown.Item>View</Dropdown.Item>
                                    <Dropdown.Item>Edit</Dropdown.Item>
                                    <Dropdown.Divider />
                                    <Dropdown.Item className="text-danger">
                                      Delete
                                    </Dropdown.Item>
                                  </Dropdown.Menu>
                                </Dropdown>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default HotelBookingList;
