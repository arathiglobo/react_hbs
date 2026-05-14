/**
 * MeetAndSpaceBookingList.jsx
 *
 * Booking-list page for the new Meet & Space feature. Lists all bookings
 * (with status filter) and offers:
 *  - View — opens a modal showing every detail of the booking (space,
 *    customer, payment, add-ons).
 *  - Cancel — collects an optional reason and PUTs to /cancel.
 *
 * Mirrors the restaurant booking list page in look-and-feel
 * (referenced by the user as the pattern to follow).
 */
import React, { useEffect, useState } from "react";
import {
  Container,
  Card,
  Table,
  Button,
  Spinner,
  Badge,
  Form,
  Modal,
  Row,
  Col,
} from "react-bootstrap";
import {
  FaEye,
  FaTimesCircle,
  FaSyncAlt,
  FaUsers,
  FaCalendarAlt,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

export default function MeetAndSpaceBookingList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [viewing, setViewing] = useState(null);
  const [showCancel, setShowCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const url = statusFilter
        ? `/api/meet-and-space/booking/list?status=${encodeURIComponent(statusFilter)}`
        : "/api/meet-and-space/booking/list";
      const res = await axiosInstance.get(url);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Load bookings failed", e);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [statusFilter]);

  const openView = async (row) => {
    // Refresh detail for the latest customer/payment/addons snapshot.
    try {
      const res = await axiosInstance.get(
        `/api/meet-and-space/booking/${row.id}`
      );
      setViewing(res.data);
    } catch (e) {
      console.error("Load booking detail failed", e);
      toast.error("Failed to load booking");
    }
  };

  const handleCancelSubmit = async () => {
    if (!showCancel) return;
    setCancelSaving(true);
    try {
      await axiosInstance.put(
        `/api/meet-and-space/booking/${showCancel.id}/cancel`,
        { reason: cancelReason || "Cancelled by user" }
      );
      toast.success("Booking cancelled");
      setShowCancel(null);
      setCancelReason("");
      fetchList();
    } catch (e) {
      console.error("Cancel failed", e);
      toast.error("Failed to cancel booking");
    } finally {
      setCancelSaving(false);
    }
  };

  const statusBadge = (s) => {
    const v = (s || "").toLowerCase();
    if (v === "cancelled") return <Badge bg="danger">Cancelled</Badge>;
    if (v === "completed") return <Badge bg="info">Completed</Badge>;
    return <Badge bg="success">Confirmed</Badge>;
  };

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1">
        <TopBar />
        <Container fluid className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className="mb-0">
              <FaUsers className="me-2 text-primary" />
              Meet &amp; Space — Bookings
            </h4>
            <div className="d-flex gap-2">
              <Form.Select
                style={{ width: 200 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Completed">Completed</option>
              </Form.Select>
              <Button
                variant="outline-secondary"
                onClick={fetchList}
                disabled={loading}
              >
                <FaSyncAlt /> Refresh
              </Button>
            </div>
          </div>

          <Card>
            <Card.Body>
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                </div>
              ) : rows.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  No bookings yet.
                </div>
              ) : (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Booking #</th>
                      <th>Space / Hotel</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Attendees</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>
                          <strong>{r.bookingNumber}</strong>
                        </td>
                        <td>
                          <div>{r.meetingSpaceName}</div>
                          <small className="text-muted">{r.hotelName}</small>
                        </td>
                        <td>
                          {r.customer
                            ? `${r.customer.firstName || ""} ${r.customer.lastName || ""}`.trim()
                            : "—"}
                          <div className="small text-muted">
                            {r.customer?.mobile || ""}
                          </div>
                        </td>
                        <td>
                          <FaCalendarAlt className="me-1 text-muted" />
                          {r.bookingDate}
                        </td>
                        <td>
                          {r.startTime} - {r.endTime}
                          <div className="small text-muted">
                            {r.durationHours}h
                          </div>
                        </td>
                        <td>{r.attendees ?? "—"}</td>
                        <td>
                          {r.currency || "INR"}{" "}
                          {Number(r.totalAmount || 0).toFixed(2)}
                        </td>
                        <td>{statusBadge(r.bookingStatus)}</td>
                        <td className="text-end">
                          <Button
                            size="sm"
                            variant="outline-info"
                            className="me-2"
                            onClick={() => openView(r)}
                          >
                            <FaEye /> View
                          </Button>
                          {r.bookingStatus !== "Cancelled" && (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => {
                                setShowCancel(r);
                                setCancelReason("");
                              }}
                            >
                              <FaTimesCircle /> Cancel
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Container>
      </div>

      {/* View Modal — shows every saved detail across the 4 entities */}
      <Modal
        show={!!viewing}
        onHide={() => setViewing(null)}
        size="xl"
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Booking Details — {viewing?.bookingNumber}{" "}
            {viewing && statusBadge(viewing.bookingStatus)}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewing && (
            <>
              <Row className="g-3">
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <strong>Space & Event</strong>
                    </Card.Header>
                    <Card.Body className="small">
                      <div>
                        <strong>Space:</strong> {viewing.meetingSpaceName}
                      </div>
                      <div>
                        <strong>Hotel:</strong> {viewing.hotelName}
                      </div>
                      <div>
                        <strong>Date:</strong> {viewing.bookingDate}
                      </div>
                      <div>
                        <strong>Time:</strong> {viewing.startTime} –{" "}
                        {viewing.endTime} ({viewing.durationHours}h)
                      </div>
                      <div>
                        <strong>Event Type:</strong> {viewing.eventType || "—"}
                      </div>
                      <div>
                        <strong>Layout:</strong> {viewing.layout || "—"}
                      </div>
                      <div>
                        <strong>Attendees:</strong> {viewing.attendees}
                      </div>
                      <div>
                        <strong>Rate Plan:</strong> {viewing.ratePlan} (
                        {viewing.rateType})
                      </div>
                      <div>
                        <strong>Unit Rate:</strong>{" "}
                        {viewing.currency} {Number(viewing.unitRate || 0).toFixed(2)}
                      </div>
                      <div>
                        <strong>Requested Amenities:</strong>{" "}
                        {viewing.requestedAmenities || "—"}
                      </div>
                      <div>
                        <strong>Notes:</strong>{" "}
                        {viewing.additionalRequirements || "—"}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <strong>Customer</strong>{" "}
                      <small className="text-muted">
                        (table: meet_and_space_booking_customer)
                      </small>
                    </Card.Header>
                    <Card.Body className="small">
                      {viewing.customer ? (
                        <>
                          <div>
                            <strong>Name:</strong> {viewing.customer.salutation}{" "}
                            {viewing.customer.firstName}{" "}
                            {viewing.customer.lastName}
                          </div>
                          <div>
                            <strong>Mobile:</strong> {viewing.customer.mobile}
                          </div>
                          <div>
                            <strong>Email:</strong>{" "}
                            {viewing.customer.email || "—"}
                          </div>
                          <div>
                            <strong>Company:</strong>{" "}
                            {viewing.customer.companyName || "—"}{" "}
                            {viewing.customer.designation
                              ? `(${viewing.customer.designation})`
                              : ""}
                          </div>
                          <div>
                            <strong>GSTIN:</strong>{" "}
                            {viewing.customer.gstNumber || "—"}
                          </div>
                          <div>
                            <strong>Address:</strong>{" "}
                            {viewing.customer.address || "—"},{" "}
                            {viewing.customer.city || ""}{" "}
                            {viewing.customer.state || ""}{" "}
                            {viewing.customer.country || ""}{" "}
                            {viewing.customer.pincode || ""}
                          </div>
                          <div>
                            <strong>ID:</strong> {viewing.customer.idType || "—"}{" "}
                            {viewing.customer.idNumber || ""}
                          </div>
                          <div>
                            <strong>Remarks:</strong>{" "}
                            {viewing.customer.remarks || "—"}
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
                      <strong>Payment</strong>{" "}
                      <small className="text-muted">
                        (table: meet_and_space_booking_payment)
                      </small>
                    </Card.Header>
                    <Card.Body className="small">
                      {viewing.payment ? (
                        <>
                          <div>
                            <strong>Mode:</strong> {viewing.payment.paymentMode}
                          </div>
                          <div>
                            <strong>Status:</strong>{" "}
                            {viewing.payment.paymentStatus}
                          </div>
                          <div>
                            <strong>Paid:</strong> {viewing.currency}{" "}
                            {Number(viewing.payment.amountPaid || 0).toFixed(2)}
                          </div>
                          <div>
                            <strong>Balance:</strong> {viewing.currency}{" "}
                            {Number(viewing.payment.balanceDue || 0).toFixed(2)}
                          </div>
                          <div>
                            <strong>Ref:</strong>{" "}
                            {viewing.payment.transactionReference || "—"}
                          </div>
                          <div>
                            <strong>Notes:</strong>{" "}
                            {viewing.payment.notes || "—"}
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
                              {Number(viewing.subTotal || 0).toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td>Add-ons</td>
                            <td className="text-end">
                              {Number(viewing.addonTotal || 0).toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td>Tax ({viewing.taxPercent || 0}%)</td>
                            <td className="text-end">
                              {Number(viewing.taxAmount || 0).toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td>Discount</td>
                            <td className="text-end">
                              {Number(viewing.discountAmount || 0).toFixed(2)}
                            </td>
                          </tr>
                          <tr className="fw-bold border-top">
                            <td>Total</td>
                            <td className="text-end text-primary">
                              {viewing.currency}{" "}
                              {Number(viewing.totalAmount || 0).toFixed(2)}
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
                      <strong>Add-ons</strong>{" "}
                      <small className="text-muted">
                        (table: meet_and_space_booking_addon)
                      </small>
                    </Card.Header>
                    <Card.Body>
                      {viewing.addons?.length ? (
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
                            {viewing.addons.map((a) => (
                              <tr key={a.id}>
                                <td>{a.addonName}</td>
                                <td>{a.quantity}</td>
                                <td>{Number(a.unitPrice || 0).toFixed(2)}</td>
                                <td>{Number(a.totalPrice || 0).toFixed(2)}</td>
                                <td>{a.remarks}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      ) : (
                        <em className="small">No add-ons.</em>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
                {viewing.bookingStatus === "Cancelled" && (
                  <Col md={12}>
                    <Card border="danger">
                      <Card.Header className="bg-danger text-white">
                        Cancellation
                      </Card.Header>
                      <Card.Body className="small">
                        <div>
                          <strong>Reason:</strong>{" "}
                          {viewing.cancellationReason || "—"}
                        </div>
                        <div>
                          <strong>Cancelled at:</strong> {viewing.cancelledAt}
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                )}
              </Row>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setViewing(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancel modal */}
      <Modal show={!!showCancel} onHide={() => setShowCancel(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Cancel Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Cancel booking <strong>{showCancel?.bookingNumber}</strong>?
          </p>
          <Form.Label>Reason</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Optional reason for cancellation"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowCancel(null)}
            disabled={cancelSaving}
          >
            Keep Booking
          </Button>
          <Button
            variant="danger"
            onClick={handleCancelSubmit}
            disabled={cancelSaving}
          >
            {cancelSaving ? (
              <>
                <Spinner size="sm" animation="border" /> Cancelling...
              </>
            ) : (
              "Confirm Cancellation"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
