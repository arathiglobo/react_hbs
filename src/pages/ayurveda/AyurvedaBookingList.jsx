import React, { useEffect, useState, useCallback } from "react";
import {
  Container,
  Card,
  Table,
  Button,
  Spinner,
  Pagination,
  Form,
  InputGroup,
  Modal,
  Row,
  Col,
} from "react-bootstrap";
import { FaEye, FaTimesCircle, FaSearch, FaSpa, FaUserMd, FaBookOpen, FaTrashAlt } from "react-icons/fa";
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
  // Booking-type filter: upcoming / completed / cancelled. Filtered
  // client-side against isCancelled + endDate so we don't need a new
  // backend endpoint (mirrors SeniorCitizenBookingList).
  const [bookingType, setBookingType] = useState("upcoming");

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
    // Booking-type filter (Upcoming / Completed / Cancelled).
    if (bookingType === "cancelled") {
      if (!b.isCancelled) return false;
    } else {
      if (b.isCancelled) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ref = b.endDate || b.startDate;
      const refDate = ref ? new Date(ref) : null;
      if (refDate && !isNaN(refDate.getTime())) {
        refDate.setHours(0, 0, 0, 0);
        if (bookingType === "completed" && refDate >= today) return false;
        if (bookingType === "upcoming" && refDate < today) return false;
      }
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

  const totalElements =
    bookings.length === 0
      ? 0
      : totalPages > 1
        ? totalPages * size
        : filtered.length;
  const displayStart = filtered.length === 0 ? 0 : page * size + 1;
  const displayEnd = page * size + filtered.length;

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
                <h4 className="mb-0 text-dark">Ayurveda Booking</h4>
              </div>
            </div>

            {/* List of Bookings Section */}
            <Card className="border mb-3" style={{ borderRadius: "8px" }}>
              <Card.Header
                className="d-flex justify-content-between align-items-center text-dark border-bottom"
                style={{
                  borderRadius: "8px 8px 0 0",
                  backgroundColor: "#f1f3f5",
                }}
              >
                <span>List of Bookings</span>
              </Card.Header>
              <Card.Body>
                {/* Booking Types radio filter (Upcoming / Completed /
                    Cancelled). Filters rows client-side. */}
                <Row className="mb-4">
                  <Col md={6}>
                    <Card
                      className="border"
                      style={{
                        backgroundColor: "#f8f9fa",
                        borderRadius: "8px",
                      }}
                    >
                      <Card.Body className="p-3">
                        <h6
                          className="mb-3 text-dark"
                          style={{ fontSize: "0.85rem" }}
                        >
                          Booking Types
                        </h6>
                        <div className="d-flex flex-wrap gap-4">
                          {[
                            { value: "upcoming", label: "Upcoming" },
                            { value: "completed", label: "Completed" },
                            { value: "cancelled", label: "Cancelled" },
                          ].map((opt) => (
                            <Form.Check
                              key={opt.value}
                              type="radio"
                              id={`bookingType-${opt.value}`}
                              name="bookingType"
                              label={opt.label}
                              checked={bookingType === opt.value}
                              onChange={() => {
                                setBookingType(opt.value);
                                setPage(0);
                              }}
                              style={{
                                fontSize: "0.85rem",
                                cursor: "pointer",
                              }}
                            />
                          ))}
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {/* Display + Type + Search */}
                <Row className="mb-3 align-items-center g-2">
                  <Col md="auto">
                    <div className="d-flex align-items-center gap-2">
                      <span className="small text-muted">Display</span>
                      <Form.Select
                        value={size}
                        onChange={(e) => {
                          setSize(Number(e.target.value));
                          setPage(0);
                        }}
                        size="sm"
                        style={{ width: "auto" }}
                      >
                        {PAGE_SIZE_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s} records
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                  </Col>
                  <Col md="auto">
                    <Form.Select
                      size="sm"
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      style={{ width: "auto" }}
                    >
                      <option value="">All Types</option>
                      <option value="PACKAGE">Package</option>
                      <option value="CONSULTATION">Consultation</option>
                      <option value="COURSE">Course</option>
                    </Form.Select>
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
                            <th>Reference</th>
                            <th>Type</th>
                            <th>Item</th>
                            <th>Booking Date</th>
                            <th>Start</th>
                            <th>End</th>
                            <th>Pax</th>
                            <th className="text-end">Total</th>
                            <th>Status</th>
                            <th>Payment</th>
                            <th style={{ width: "120px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length > 0 ? (
                            filtered.map((b, idx) => (
                              <tr key={b.id}>
                                <td>{idx + 1 + page * size}</td>
                                <td className="text-dark">
                                  {b.bookingReference || "-"}
                                </td>
                                <td>
                                  <span className="text-dark">
                                    {typeIcon(b.bookingType)}
                                    {b.bookingType || "-"}
                                  </span>
                                </td>
                                <td>
                                  {b.packageName ||
                                    b.doctorName ||
                                    b.courseName ||
                                    "-"}
                                </td>
                                <td>{formatDate(b.bookingDate)}</td>
                                <td>{formatDate(b.startDate)}</td>
                                <td>{formatDate(b.endDate)}</td>
                                <td>{b.numberOfParticipants ?? "-"}</td>
                                <td className="text-end text-dark">
                                  {formatAmount(b.totalPrice)}
                                </td>
                                <td>{b.status || "-"}</td>
                                <td>{b.paymentStatus || "-"}</td>
                                <td>
                                  <div className="d-flex gap-3 align-items-center flex-wrap">
                                    <FaEye
                                      style={{
                                        cursor: "pointer",
                                        fontSize: "14px",
                                        color: "#007bff",
                                      }}
                                      onClick={() => setDetailsBooking(b)}
                                      title="View Details"
                                    />
                                    {!b.isCancelled && (
                                      <FaTrashAlt
                                        style={{
                                          cursor: "pointer",
                                          fontSize: "14px",
                                          color: "#dc3545",
                                        }}
                                        onClick={() => setCancelBooking(b)}
                                        title="Cancel Booking"
                                      />
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={12}
                                className="text-center py-4 text-muted"
                              >
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
                        Showing {displayStart} to {displayEnd} of {totalElements}{" "}
                        entries
                      </div>
                      {totalPages > 1 && (
                        <Pagination className="mb-0">
                          <Pagination.Prev
                            disabled={page === 0}
                            onClick={() =>
                              setPage((p) => Math.max(0, p - 1))
                            }
                          />
                          {Array.from(
                            { length: Math.min(5, totalPages) },
                            (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i;
                              } else if (page <= 2) {
                                pageNum = i;
                              } else if (page >= totalPages - 3) {
                                pageNum = totalPages - 5 + i;
                              } else {
                                pageNum = page - 2 + i;
                              }
                              return (
                                <Pagination.Item
                                  key={pageNum}
                                  active={pageNum === page}
                                  onClick={() => setPage(pageNum)}
                                >
                                  {pageNum + 1}
                                </Pagination.Item>
                              );
                            },
                          )}
                          <Pagination.Next
                            disabled={page + 1 >= totalPages}
                            onClick={() => setPage((p) => p + 1)}
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
