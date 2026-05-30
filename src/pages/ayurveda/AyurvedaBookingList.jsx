import React, { useEffect, useState, useCallback } from "react";
import {
  Container,
  Card,
  Table,
  Badge,
  Button,
  Spinner,
  Pagination,
  Form,
  InputGroup,
  Modal,
  Row,
  Col,
} from "react-bootstrap";
import { FaLeaf, FaEye, FaTimesCircle, FaSearch, FaSpa, FaUserMd, FaBookOpen } from "react-icons/fa";
import toast from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import "../../styles/Ayurveda.css";

const AYURVEDA_API = "/api/v1/ayurveda";
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const formatDate = (d) => (d ? d : "-");
const formatAmount = (a) => (a != null ? `₹${Number(a).toFixed(2)}` : "-");

const typeIcon = (type) => {
  if (type === "PACKAGE") return <FaSpa className="me-1" />;
  if (type === "CONSULTATION") return <FaUserMd className="me-1" />;
  if (type === "COURSE") return <FaBookOpen className="me-1" />;
  return null;
};

const AyurvedaBookingList = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Modals
  const [detailsBooking, setDetailsBooking] = useState(null);
  const [cancelBooking, setCancelBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`${AYURVEDA_API}/bookings`, {
        params: { page, size },
      });
      const data = res.data || {};
      setBookings(Array.isArray(data.content) ? data.content : []);
      setTotalPages(data.totalPages || 0);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [page, size]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = bookings.filter((b) => {
    if (filterType && b.bookingType !== filterType) return false;
    if (filterStatus) {
      if (filterStatus === "ACTIVE" && b.isCancelled) return false;
      if (filterStatus === "CANCELLED" && !b.isCancelled) return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = [
        b.bookingReference,
        b.packageName,
        b.doctorName,
        b.courseName,
        b.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const submitCancel = async () => {
    if (!cancelBooking) return;
    setCancelling(true);
    try {
      await axiosInstance.post(
        `${AYURVEDA_API}/bookings/${cancelBooking.id}/cancel`,
        { reason: cancelReason || "Cancelled by user" }
      );
      toast.success("Booking cancelled");
      setCancelBooking(null);
      setCancelReason("");
      load();
    } catch (e) {
      console.error(e);
      toast.error("Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
        <div className="ayurveda-page">
          <Container fluid className="p-3">
            <div className="ayurveda-header">
              <div>
                <h2 className="ayurveda-title">
                  <FaLeaf /> Ayurveda Bookings
                </h2>
                <p className="ayurveda-subtitle">
                  All ayurveda packages, consultations & courses bookings
                </p>
              </div>
            </div>

            <div className="ayurveda-filter-bar">
              <InputGroup style={{ maxWidth: 300 }}>
                <InputGroup.Text>
                  <FaSearch />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search by ref, name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>
              <Form.Select
                style={{ maxWidth: 200 }}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="PACKAGE">Package</option>
                <option value="CONSULTATION">Consultation</option>
                <option value="COURSE">Course</option>
              </Form.Select>
              <Form.Select
                style={{ maxWidth: 180 }}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="CANCELLED">Cancelled</option>
              </Form.Select>
              <Form.Select
                style={{ maxWidth: 130 }}
                value={size}
                onChange={(e) => {
                  setSize(Number(e.target.value));
                  setPage(0);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s} / page
                  </option>
                ))}
              </Form.Select>
            </div>

            <Card className="ayurveda-card-body">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="success" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="ayurveda-empty">No bookings to show.</div>
              ) : (
                <Table responsive striped hover size="sm">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Reference</th>
                      <th>Type</th>
                      <th>Item</th>
                      <th>Booking Date</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Pax</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b, idx) => (
                      <tr key={b.id}>
                        <td>{idx + 1 + page * size}</td>
                        <td>
                          <strong>{b.bookingReference}</strong>
                        </td>
                        <td>
                          <Badge bg="info">
                            {typeIcon(b.bookingType)}
                            {b.bookingType}
                          </Badge>
                        </td>
                        <td>
                          {b.packageName || b.doctorName || b.courseName || "-"}
                        </td>
                        <td>{formatDate(b.bookingDate)}</td>
                        <td>{formatDate(b.startDate)}</td>
                        <td>{formatDate(b.endDate)}</td>
                        <td>{b.numberOfParticipants}</td>
                        <td>{formatAmount(b.totalPrice)}</td>
                        <td>
                          <span
                            className={`ayurveda-status-badge ayurveda-status-${b.status}`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td>
                          <Badge
                            bg={
                              b.paymentStatus === "PAID"
                                ? "success"
                                : b.paymentStatus === "PENDING"
                                ? "warning"
                                : "secondary"
                            }
                          >
                            {b.paymentStatus}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-1"
                            onClick={() => setDetailsBooking(b)}
                          >
                            <FaEye />
                          </Button>
                          {!b.isCancelled && (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => setCancelBooking(b)}
                            >
                              <FaTimesCircle />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>

            {totalPages > 1 && (
              <div className="d-flex justify-content-center mt-3">
                <Pagination>
                  <Pagination.First
                    onClick={() => setPage(0)}
                    disabled={page === 0}
                  />
                  <Pagination.Prev
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  />
                  {[...Array(totalPages).keys()]
                    .slice(Math.max(0, page - 2), Math.min(totalPages, page + 3))
                    .map((p) => (
                      <Pagination.Item
                        key={p}
                        active={p === page}
                        onClick={() => setPage(p)}
                      >
                        {p + 1}
                      </Pagination.Item>
                    ))}
                  <Pagination.Next
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={page >= totalPages - 1}
                  />
                  <Pagination.Last
                    onClick={() => setPage(totalPages - 1)}
                    disabled={page >= totalPages - 1}
                  />
                </Pagination>
              </div>
            )}
          </Container>
        </div>
        </main>
      </div>

      {/* Details Modal */}
      <Modal
        show={!!detailsBooking}
        onHide={() => setDetailsBooking(null)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Booking Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailsBooking && (
            <Row className="g-2">
              <Col md={6}>
                <strong>Reference:</strong> {detailsBooking.bookingReference}
              </Col>
              <Col md={6}>
                <strong>Type:</strong> {detailsBooking.bookingType}
              </Col>
              <Col md={6}>
                <strong>Status:</strong> {detailsBooking.status}
              </Col>
              <Col md={6}>
                <strong>Payment:</strong> {detailsBooking.paymentStatus}
              </Col>
              <Col md={6}>
                <strong>Booking Date:</strong>{" "}
                {formatDate(detailsBooking.bookingDate)}
              </Col>
              <Col md={6}>
                <strong>Participants:</strong>{" "}
                {detailsBooking.numberOfParticipants}
              </Col>
              <Col md={6}>
                <strong>Start Date:</strong>{" "}
                {formatDate(detailsBooking.startDate)}
              </Col>
              <Col md={6}>
                <strong>End Date:</strong> {formatDate(detailsBooking.endDate)}
              </Col>
              {detailsBooking.packageName && (
                <Col md={12}>
                  <strong>Package:</strong> {detailsBooking.packageName}
                </Col>
              )}
              {detailsBooking.doctorName && (
                <Col md={12}>
                  <strong>Doctor:</strong> {detailsBooking.doctorName}
                </Col>
              )}
              {detailsBooking.courseName && (
                <Col md={12}>
                  <strong>Course:</strong> {detailsBooking.courseName}
                </Col>
              )}
              {detailsBooking.symptoms && (
                <Col md={12}>
                  <strong>Symptoms:</strong> {detailsBooking.symptoms}
                </Col>
              )}
              {detailsBooking.previousExperience && (
                <Col md={12}>
                  <strong>Previous Experience:</strong>{" "}
                  {detailsBooking.previousExperience}
                </Col>
              )}
              {detailsBooking.specialRequests && (
                <Col md={12}>
                  <strong>Special Requests:</strong>{" "}
                  {detailsBooking.specialRequests}
                </Col>
              )}
              <Col md={12}>
                <strong>Total:</strong> {formatAmount(detailsBooking.totalPrice)}
              </Col>
              {detailsBooking.isCancelled && (
                <Col md={12}>
                  <strong>Cancelled on:</strong>{" "}
                  {formatDate(detailsBooking.cancelledDate)} —{" "}
                  {detailsBooking.cancellationReason}
                </Col>
              )}
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDetailsBooking(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        show={!!cancelBooking}
        onHide={() => setCancelBooking(null)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Cancel Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cancelBooking && (
            <>
              <p>
                Are you sure you want to cancel booking{" "}
                <strong>{cancelBooking.bookingReference}</strong>?
              </p>
              <Form.Group>
                <Form.Label>Reason</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setCancelBooking(null)} disabled={cancelling}>
            Close
          </Button>
          <Button variant="danger" onClick={submitCancel} disabled={cancelling}>
            {cancelling ? <Spinner size="sm" animation="border" /> : "Confirm Cancel"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AyurvedaBookingList;
