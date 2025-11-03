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

  // Fetch data from API (static for now)
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
          agentName: "John Doe",
          customerName: "Test",
          bookingCode: "CNF123",
          referenceCode: "REF1234",
        },
      ];
      setBookings(staticBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const pagedBookings = useMemo(() => bookings.slice(0, perPage), [bookings, perPage]);

  const getStatusBadge = (s) => {
    switch (s?.toLowerCase()) {
      case "confirmed":
        return "success";
      case "cancelled":
        return "danger";
      case "pending":
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
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold text-dark">Hotel Bookings</h3>
            </div>

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
                          <th>#</th>
                          <th>Booking Code</th>
                          <th>Hotel Name</th>
                          <th>Guest</th>
                          <th>Check-In</th>
                          <th>Check-Out</th>
                          <th>Nights</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Agent</th>
                          <th>Reference</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedBookings.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="text-center py-5">
                              No bookings found.
                            </td>
                          </tr>
                        ) : (
                          pagedBookings.map((b, i) => (
                            <tr key={b.bookingId}>
                              <td>{i + 1}</td>
                              <td>{b.bookingCode}</td>
                              <td>{b.hotelName}</td>
                              <td>{b.guestName}</td>
                              <td>{b.checkInDate}</td>
                              <td>{b.checkOutDate}</td>
                              <td>{b.nights}</td>
                              <td>
                                {b.totalAmount} {b.currency}
                              </td>
                              <td>
                                <Badge bg={getStatusBadge(b.status)}>{b.status}</Badge>
                              </td>
                              <td>{b.agentName}</td>
                              <td>{b.referenceCode}</td>
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
