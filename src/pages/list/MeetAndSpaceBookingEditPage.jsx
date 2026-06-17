/**
 * MeetAndSpaceBookingEditPage.jsx
 *
 * Lightweight read-only edit-entry page for Meet & Space bookings.
 * Loaded at /booking-details/meet-and-space-booking-list/:id/edit.
 *
 * Shows:
 *  - The booking number with the slashed-version reminder (MS-2026-000003/1)
 *  - All the data captured at booking time (criteria, customer, payment,
 *    amenities, addons)
 *  - An "Edit" button which navigates into
 *      /new-booking/meet-and-space/book?editBookingId={id}
 *    The booking page (already supports `editBookingId`) loads the booking,
 *    prefills every field and PUTs to /{id}/edit on save — at which point
 *    the backend appends `/N` to the bookingNumber.
 *
 * Mirrors the hotel BookingEditPage entry flow (see src/pages/list/BookingEditPage.jsx).
 */
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Row,
  Col,
  Spinner,
  Badge,
  Table,
  Button,
  Alert,
} from "react-bootstrap";
import { FaEdit, FaArrowLeft } from "react-icons/fa";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

export default function MeetAndSpaceBookingEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    axiosInstance
      .get(`/api/meet-and-space/booking/${id}`)
      .then((r) => setBooking(r.data))
      .catch((e) => {
        console.error("Load booking failed", e);
        setError(e?.response?.data?.message || "Failed to load booking");
        toast.error("Failed to load booking");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const goEdit = () =>
    navigate(`/new-booking/meet-and-space/book?editBookingId=${id}`);

  const statusBadge = (s) => {
    const v = (s || "").toLowerCase();
    if (v === "cancelled") return <Badge bg="danger">Cancelled</Badge>;
    if (v === "completed") return <Badge bg="info">Completed</Badge>;
    return <Badge bg="success">Confirmed</Badge>;
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
        <Container fluid className="p-4">
          <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
            <h4 className="mb-0">
              <FaEdit className="me-2 text-warning" />
              Edit Booking
            </h4>
            <div className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft className="me-1" /> Back
              </Button>
              {booking && booking.bookingStatus !== "Cancelled" && (
                <Button variant="warning" onClick={goEdit}>
                  <FaEdit className="me-1" /> Edit Booking
                </Button>
              )}
            </div>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          {!booking ? (
            <div className="text-muted text-center py-5">
              Booking not found.
            </div>
          ) : (
            <>
              {/* Booking reference + versioning notice */}
              <Card className="shadow-sm mb-3">
                <Card.Body>
                  <Row>
                    <Col md={5}>
                      <div className="text-muted small">Booking Number</div>
                      <h5 className="mb-0">
                        {booking.bookingNumber}{" "}
                        {statusBadge(booking.bookingStatus)}
                      </h5>
                    </Col>
                    <Col md={4}>
                      <div className="text-muted small">Edits so far</div>
                      <div>
                        <strong>{booking.editCount ?? 0}</strong>{" "}
                        <span className="text-danger">
                          — next edit will append /
                          {(booking.editCount ?? 0) + 1}
                        </span>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="text-muted small">Total</div>
                      <div className="fw-bold">
                        {booking.currency || "INR"}{" "}
                        {Number(booking.totalAmount || 0).toFixed(2)}
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              <Row className="g-3">
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <strong>Space & Event</strong>
                    </Card.Header>
                    <Card.Body className="small">
                      <div>
                        <strong>Space:</strong> {booking.meetingSpaceName}
                      </div>
                      <div>
                        <strong>Hotel:</strong> {booking.hotelName}
                      </div>
                      <div>
                        <strong>Date:</strong> {booking.bookingDate}
                      </div>
                      <div>
                        <strong>Time:</strong> {booking.startTime} —{" "}
                        {booking.endTime} ({booking.durationHours}h)
                      </div>
                      <div>
                        <strong>Event Type:</strong>{" "}
                        {booking.eventType || "—"}
                      </div>
                      <div>
                        <strong>Layout:</strong> {booking.layout || "—"}
                      </div>
                      <div>
                        <strong>Attendees:</strong> {booking.attendees}
                      </div>
                      <div>
                        <strong>Rate Plan:</strong> {booking.ratePlan} (
                        {booking.rateType})
                      </div>
                      <div>
                        <strong>Unit Rate:</strong> {booking.currency}{" "}
                        {Number(booking.unitRate || 0).toFixed(2)}
                      </div>
                      <div>
                        <strong>Requested Amenities:</strong>{" "}
                        {booking.requestedAmenities || "—"}
                      </div>
                      <div>
                        <strong>Notes:</strong>{" "}
                        {booking.additionalRequirements || "—"}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <strong>Customer</strong>
                    </Card.Header>
                    <Card.Body className="small">
                      {booking.customer ? (
                        <>
                          <div>
                            <strong>Name:</strong>{" "}
                            {booking.customer.salutation}{" "}
                            {booking.customer.firstName}{" "}
                            {booking.customer.lastName}
                          </div>
                          <div>
                            <strong>Mobile:</strong>{" "}
                            {booking.customer.mobile}
                          </div>
                          <div>
                            <strong>Email:</strong>{" "}
                            {booking.customer.email || "—"}
                          </div>
                          <div>
                            <strong>Company:</strong>{" "}
                            {booking.customer.companyName || "—"}{" "}
                            {booking.customer.designation
                              ? `(${booking.customer.designation})`
                              : ""}
                          </div>
                          <div>
                            <strong>Address:</strong>{" "}
                            {booking.customer.address || "—"},{" "}
                            {booking.customer.city || ""}{" "}
                            {booking.customer.state || ""}{" "}
                            {booking.customer.country || ""}{" "}
                            {booking.customer.pincode || ""}
                          </div>
                          <div>
                            <strong>ID:</strong>{" "}
                            {booking.customer.idType || "—"}{" "}
                            {booking.customer.idNumber || ""}
                          </div>
                        </>
                      ) : (
                        <em>No customer record.</em>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <strong>Payment</strong>
                    </Card.Header>
                    <Card.Body className="small">
                      {booking.payment ? (
                        <>
                          <div>
                            <strong>Mode:</strong>{" "}
                            {booking.payment.paymentMode}
                          </div>
                          <div>
                            <strong>Status:</strong>{" "}
                            {booking.payment.paymentStatus}
                          </div>
                          <div>
                            <strong>Paid:</strong> {booking.currency}{" "}
                            {Number(booking.payment.amountPaid || 0).toFixed(
                              2
                            )}
                          </div>
                          <div>
                            <strong>Balance:</strong> {booking.currency}{" "}
                            {Number(booking.payment.balanceDue || 0).toFixed(
                              2
                            )}
                          </div>
                          <div>
                            <strong>Ref:</strong>{" "}
                            {booking.payment.transactionReference || "—"}
                          </div>
                        </>
                      ) : (
                        <em>No payment record.</em>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <strong>Price Summary</strong>
                    </Card.Header>
                    <Card.Body className="small">
                      <Table size="sm" borderless className="mb-0">
                        <tbody>
                          <tr>
                            <td>Sub Total</td>
                            <td className="text-end">
                              {Number(booking.subTotal || 0).toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td>Add-ons</td>
                            <td className="text-end">
                              {Number(booking.addonTotal || 0).toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td>Tax ({booking.taxPercent || 0}%)</td>
                            <td className="text-end">
                              {Number(booking.taxAmount || 0).toFixed(2)}
                            </td>
                          </tr>
                          <tr className="fw-bold border-top">
                            <td>Total</td>
                            <td className="text-end text-primary">
                              {booking.currency || "INR"}{" "}
                              {Number(booking.totalAmount || 0).toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={12}>
                  <Card>
                    <Card.Header>
                      <strong>Add-ons</strong>
                    </Card.Header>
                    <Card.Body>
                      {booking.addons?.length ? (
                        <Table size="sm" bordered className="mb-0">
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Qty</th>
                              <th>Unit</th>
                              <th>Total</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {booking.addons.map((a) => (
                              <tr key={a.id}>
                                <td>{a.addonName}</td>
                                <td>{a.quantity}</td>
                                <td>
                                  {Number(a.unitPrice || 0).toFixed(2)}
                                </td>
                                <td>
                                  {Number(a.totalPrice || 0).toFixed(2)}
                                </td>
                                <td>{a.remarks}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      ) : (
                        <em className="small text-muted">No add-ons.</em>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <div className="mt-3 d-flex justify-content-end gap-2">
                <Button
                  variant="outline-secondary"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
                {booking.bookingStatus !== "Cancelled" && (
                  <Button variant="warning" size="lg" onClick={goEdit}>
                    <FaEdit className="me-1" /> Edit Booking
                  </Button>
                )}
              </div>
            </>
          )}
        </Container>
        </main>
      </div>
    </div>
  );
}
