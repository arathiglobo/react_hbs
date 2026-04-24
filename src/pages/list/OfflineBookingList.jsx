import React, { useEffect, useState, useCallback } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Table,
  InputGroup,
  Spinner,
  Pagination,
} from "react-bootstrap";
import {
  FaSearch,
  FaEye,
  FaFileAlt,
  FaFileInvoice,
  FaPercent,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const OfflineBookingList = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/api/v1/offline-booking/bookings", {
        params: {
          page: page - 1,
          size: perPage,
          search: search,
        },
      });

      if (response.data) {
        // Handle both paginated and non-paginated responses
        if (response.data.content) {
          setBookings(response.data.content);
          setTotalElements(response.data.totalElements || 0);
          setTotalPages(response.data.totalPages || 0);
        } else if (Array.isArray(response.data)) {
          setBookings(response.data);
          setTotalElements(response.data.length);
          setTotalPages(Math.ceil(response.data.length / perPage));
        }
      }
    } catch (error) {
      console.error("Error fetching offline bookings:", error);
      toast.error("Failed to load offline bookings");
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handlePageChange = (newPage) => setPage(newPage);
  const handlePerPageChange = (e) => {
    setPerPage(parseInt(e.target.value, 10));
    setPage(1);
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflowX: "hidden" }}>
          <Container fluid>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold text-dark">List of Suppliers</h3>
            </div>

            <Card className="shadow-sm border-0 mb-4" style={{ borderRadius: "12px" }}>
              <Card.Body className="p-3">
                <Row className="align-items-center g-3">
                  <Col md={3}>
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted small">Display</span>
                      <Form.Select
                        size="sm"
                        value={perPage}
                        onChange={handlePerPageChange}
                        style={{ width: "80px" }}
                      >
                        {PER_PAGE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </Form.Select>
                      <span className="text-muted small">records</span>
                    </div>
                  </Col>
                  <Col md={{ span: 4, offset: 5 }}>
                    <InputGroup size="sm">
                      <InputGroup.Text className="bg-white border-end-0">
                        <FaSearch className="text-muted" />
                      </InputGroup.Text>
                      <Form.Control
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                        className="border-start-0"
                      />
                    </InputGroup>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            <Card className="shadow-sm border-0" style={{ borderRadius: "12px", overflow: "hidden" }}>
              <div className="table-responsive">
                <Table hover className="mb-0 align-middle">
                  <thead className="bg-primary text-white">
                    <tr>
                      <th className="py-3 px-4 text-center" style={{ width: "60px" }}>S.N</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Invoice Number</th>
                      <th className="py-3 px-4">Agent Name</th>
                      <th className="py-3 px-4">Booking Details</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="text-center py-5">
                          <Spinner animation="border" variant="primary" />
                          <p className="mt-2 text-muted mb-0">Loading bookings...</p>
                        </td>
                      </tr>
                    ) : bookings.length > 0 ? (
                      bookings.map((booking, idx) => (
                        <tr key={booking.id || idx}>
                          <td className="px-4 text-center">{(page - 1) * perPage + idx + 1}</td>
                          <td className="px-4">{booking.bookingDate || booking.createdAt || "N/A"}</td>
                          <td className="px-4 font-monospace fw-bold text-primary">{booking.invoiceNumber}</td>
                          <td className="px-4">{booking.agentName || "Direct Client"}</td>
                          <td className="px-4">
                            <div className="small">
                              <div className="fw-bold text-dark">{booking.customerName}</div>
                              <div className="text-muted">
                                Check-In: {booking.checkIn}<br />
                                Check-Out: {booking.checkOut}<br />
                                Total Pax: {booking.adult || 0} adult(s) and {booking.child || 0} child(ren)
                              </div>
                            </div>
                          </td>
                          <td className="px-4 fw-bold">{booking.totalAmount || booking.grandTotal || "0.00"}</td>
                          <td className="px-4 text-center">
                            <div className="d-flex justify-content-center gap-2">
                              <Button variant="outline-primary" size="sm" className="btn-icon-custom" title="View">
                                <FaEye />
                              </Button>
                              <Button variant="outline-success" size="sm" className="btn-icon-custom" title="Voucher">
                                <FaFileAlt />
                              </Button>
                              <Button variant="outline-info" size="sm" className="btn-icon-custom" title="Invoice">
                                <FaFileInvoice />
                              </Button>
                              <Button variant="outline-secondary" size="sm" className="btn-icon-custom" title="Tax">
                                <FaPercent />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center py-5 text-muted">
                          No offline bookings found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>

              {totalPages > 1 && (
                <Card.Footer className="bg-white border-0 py-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="small text-muted">
                      Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, totalElements)} of {totalElements} entries
                    </span>
                    <Pagination size="sm" className="mb-0">
                      <Pagination.Prev disabled={page === 1} onClick={() => handlePageChange(page - 1)} />
                      {[...Array(totalPages)].map((_, i) => (
                        <Pagination.Item
                          key={i + 1}
                          active={i + 1 === page}
                          onClick={() => handlePageChange(i + 1)}
                        >
                          {i + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next disabled={page === totalPages} onClick={() => handlePageChange(page + 1)} />
                    </Pagination>
                  </div>
                </Card.Footer>
              )}
            </Card>
          </Container>
        </main>
      </div>
      
      <style>{`
        .bg-primary {
          background-color: #3f51b5 !important;
        }
        .btn-icon-custom {
          width: 32px;
          height: 32px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .btn-icon-custom:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .table hover tbody tr:hover {
          background-color: rgba(63, 81, 181, 0.05) !important;
        }
      `}</style>
    </div>
  );
};

export default OfflineBookingList;