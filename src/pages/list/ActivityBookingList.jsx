import React, { useEffect, useState, useMemo, useCallback } from "react";
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
  Modal,
} from "react-bootstrap";
import {
  FaSearch,
  FaTrash,
  FaCar,
  FaCalendarAlt,
  FaUserAlt,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

const ActivityBookingList = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/api/activity/list");
      if (response.data) setBookings(response.data);
    } catch {
      toast.error("Failed to load activity bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleCancelClick = (booking) => {
    setSelectedBooking(booking);
    setShowCancelModal(true);
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;

    try {
      setCancelling(true);
      const response = await axiosInstance.delete(
        `/api/activity/delete/${selectedBooking.customBookingId}`
      );

      if (response.data?.status === "success") {
        toast.success("Booking cancelled");
        setShowCancelModal(false);
        fetchBookings();
      } else {
        toast.error("Cancel failed");
      }
    } catch {
      toast.error("Error cancelling booking");
    } finally {
      setCancelling(false);
    }
  };

  const filteredBookings = useMemo(() => {
    if (!search.trim()) return bookings;
    return bookings.filter(
      (b) =>
        b.packageBookCode?.toLowerCase().includes(search.toLowerCase()) ||
        b.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        b.lastName?.toLowerCase().includes(search.toLowerCase())
    );
  }, [bookings, search]);

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
    }).format(price || 0);

  const formatDate = (date) => {
    if (!date) return "-";
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return date;
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: "#f8fafc" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4">
          <Container fluid>

            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h4 className="fw-semibold text-dark mb-0">Activity Bookings</h4>

            </div>

            {/* Search */}
            <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: "12px" }}>
              <Card.Body className="p-3">
                <Row>
                  <Col md={4}>
                    <InputGroup>
                      <InputGroup.Text className="bg-white border-0">
                        <FaSearch size={13} className="text-muted" />
                      </InputGroup.Text>
                      <Form.Control
                        placeholder="Search bookings..."
                        className="border-0 shadow-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </InputGroup>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Table */}
            <Card className="border-0 shadow-sm" style={{ borderRadius: "12px" }}>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table
                    bordered
                    hover
                    className="mb-0 align-middle"
                    style={{ borderCollapse: "separate", borderSpacing: "0 10px" }}
                  >
                    <thead>
                      <tr className="text-muted small">
                        <th className="ps-4">Booking</th>
                        <th className="ps-4">Customer Name</th>
                        <th>Activity</th>
                        <th>Travel</th>
                        <th>Pax</th>
                        <th>Amount</th>
                        {/* <th>Status</th> */}
                        <th className="text-center pe-4">Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan="7" className="text-center py-5">
                            <Spinner />
                          </td>
                        </tr>
                      ) : filteredBookings.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-5 text-muted">
                            No bookings found
                          </td>
                        </tr>
                      ) : (
                        filteredBookings.map((b) => (
                          <tr
                            key={b.customBookingId}
                            style={{
                              background: "#fff",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                              borderRadius: "10px",
                            }}
                          >
                            {/* Booking */}
                            <td className="ps-4 py-3">
                              <div className="fw-semibold text-dark">
                                {b.packageBookCode}
                              </div>
                              <small className="text-muted">
                                {formatDate(b.bookingDate)}
                              </small>
                            </td>

                            {/* Customer Name */}
                            <td className="ps-4">
                              <div className="fw-medium text-dark">
                                {b.salutation || ""} {b.firstName || ""} {b.lastName || ""}
                              </div>
                              <small className="text-muted">
                                {b.emailId || "-"}
                              </small>
                            </td>

                            {/* Activity / Itinerary */}
                            <td>
                              {b.customBookingItinearyDTO && b.customBookingItinearyDTO.length > 0 ? (
                                <ul className="list-unstyled mb-0 small">
                                  {b.customBookingItinearyDTO.map((item, idx) => (
                                    <li key={idx} className="text-dark fw-medium">
                                      • {item.itinerary}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-muted small">No itinerary</span>
                              )}
                            </td>

                            {/* Travel */}
                            <td className="small text-muted">
                              <div>
                                <FaCalendarAlt size={11} className="me-1" />
                                {formatDate(b.tourDate)}
                              </div>
                            </td>

                            {/* Pax */}
                            <td className="small text-muted">
                              <FaUserAlt size={11} className="me-1" />
                              {b.noOfAdult}A / {b.noOfChild}C
                            </td>

                            {/* Amount */}
                            <td>
                              <div className="fw-semibold text-dark">
                                {formatPrice(b.totalPrice)}
                              </div>
                            </td>

                            {/* Action */}
                            <td className="text-center pe-4">
                              <Button
                                variant="light"
                                size="sm"
                                className="rounded-pill px-3 border"
                                onClick={() => handleCancelClick(b)}
                              >
                                <FaTrash size={12} className="text-danger" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>

            {/* Modal */}
            <Modal
              show={showCancelModal}
              onHide={() => !cancelling && setShowCancelModal(false)}
              centered
            >
              <Modal.Header closeButton={!cancelling}>
                <Modal.Title>Cancel Booking</Modal.Title>
              </Modal.Header>

              <Modal.Body className="text-center">
                <p className="mb-1">Cancel this booking?</p>
                <strong>{selectedBooking?.packageBookCode}</strong>
              </Modal.Body>

              <Modal.Footer className="justify-content-center">
                <Button
                  variant="light"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                >
                  No
                </Button>

                <Button
                  variant="dark"
                  onClick={handleCancelBooking}
                  disabled={cancelling}
                >
                  {cancelling ? <Spinner size="sm" /> : "Yes, Cancel"}
                </Button>
              </Modal.Footer>
            </Modal>

          </Container>
        </main>
      </div>
    </div>
  );
};

export default ActivityBookingList;