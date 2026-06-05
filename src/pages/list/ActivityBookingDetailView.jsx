/**
 * ActivityBookingDetailView.jsx
 *
 * Full-page detail view for a single Activity booking. Replaces the
 * modal-based "View" that used to live in ActivityBookingList. The Cancel
 * action icon from the row now sits at the bottom-left of this page as a
 * button. All endpoints / behaviour are unchanged:
 *   - Cancel: DELETE /api/activity/delete/{customBookingId}
 *
 * Booking summary is passed via location.state when the user clicks the
 * eye icon. On hard refresh we surface a "Booking not found — go back"
 * hint because the list endpoint doesn't expose a per-id GET.
 */
import React, { useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Badge,
  Spinner,
  Modal,
  Button,
} from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaTicketAlt,
  FaTrash,
  FaCalendarAlt,
  FaUserAlt,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaEnvelope,
  FaIdCard,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

const BUTTON_STYLE = {
  color: "#fff",
  border: "none",
  borderRadius: "3px",
  padding: "6px 14px",
  fontSize: "0.78rem",
  fontWeight: "600",
  cursor: "pointer",
  letterSpacing: "0.4px",
  whiteSpace: "nowrap",
};

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

export default function ActivityBookingDetailView() {
  const navigate = useNavigate();
  const location = useLocation();
  const booking = location.state?.booking || null;
  // Status flag determines whether the Cancel button shows. We carry the
  // list-level `status` value forward in state so a "completed" or
  // "cancelled" view doesn't surface a Cancel action (matches the row
  // icon visibility rule on the list page).
  const status = location.state?.status || "upcoming";

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancelBooking = async () => {
    if (!booking) return;
    try {
      setCancelling(true);
      const response = await axiosInstance.delete(
        `/api/activity/delete/${booking.customBookingId}`
      );
      if (response.data?.status === "success") {
        toast.success("Booking cancelled");
        setShowCancelModal(false);
        navigate(-1);
      } else {
        toast.error("Cancel failed");
      }
    } catch {
      toast.error("Error cancelling booking");
    } finally {
      setCancelling(false);
    }
  };

  if (!booking) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4">
            <Container fluid style={{ maxWidth: "1100px" }}>
              <div className="text-center py-5">
                <p className="text-muted mb-3">
                  Booking not found. Please reopen it from the Activity
                  Bookings list.
                </p>
                <button
                  style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                  onClick={() =>
                    navigate("/booking-details/activity-booking-list")
                  }
                >
                  ← Back to list
                </button>
              </div>
            </Container>
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
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* Header */}
            <div className="mb-3 d-flex align-items-center flex-wrap gap-2">
              <button
                style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                onClick={() => navigate(-1)}
              >
                ← Back
              </button>
              <span
                className="d-flex align-items-center"
                style={{
                  marginLeft: "12px",
                  fontWeight: "700",
                  fontSize: "1.1rem",
                  color: "#333",
                }}
              >
                <FaTicketAlt className="me-2 text-primary" />
                Booking Details
                {booking.packageBookCode && (
                  <Badge bg="primary-subtle" text="primary" className="ms-3">
                    {booking.packageBookCode}
                  </Badge>
                )}
              </span>
            </div>

            {/* Top meta strip — code · booked · status · agent · source · ref# */}
            <Card className="mb-3">
              <Card.Body className="py-2">
                <Table size="sm" borderless className="mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted small" style={{ width: 110 }}>Code</td>
                      <td className="fw-semibold">
                        {booking.packageBookCode || "—"}
                      </td>
                      <td className="text-muted small" style={{ width: 90 }}>Booked</td>
                      <td className="fw-semibold">
                        {formatDate(booking.bookingDate)}
                      </td>
                      <td className="text-muted small" style={{ width: 70 }}>Status</td>
                      <td>
                        <Badge
                          bg={
                            booking.cancelStatus
                              ? "danger-subtle"
                              : "success-subtle"
                          }
                          text={
                            booking.cancelStatus ? "danger" : "success"
                          }
                        >
                          {booking.cancelStatus ? "Cancelled" : "Confirmed"}
                        </Badge>
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted small">Agent</td>
                      <td className="fw-semibold">{booking.agentName || "—"}</td>
                      <td className="text-muted small">Source</td>
                      <td className="fw-semibold">{booking.source || "—"}</td>
                      <td className="text-muted small">Ref. #</td>
                      <td className="fw-semibold">
                        {booking.referenceNumber || "—"}
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

            {/* Activity */}
            <Card className="mb-3">
              <Card.Header
                className="fw-semibold d-flex align-items-center"
                style={{ backgroundColor: "#f1f3f5" }}
              >
                <FaTicketAlt className="me-2 text-primary" />
                Activity
              </Card.Header>
              <Card.Body>
                <Table size="sm" borderless className="mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted small" style={{ width: 110 }}>Name</td>
                      <td className="fw-semibold">
                        {booking.activityName || "—"}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted small">
                        <FaCalendarAlt className="me-1" />Tour Date
                      </td>
                      <td className="fw-semibold">
                        {formatDate(booking.tourDate)}
                      </td>
                    </tr>
                    {(booking.activityType || booking.reportingPoint) && (
                      <tr>
                        <td className="text-muted small">Reporting</td>
                        <td className="fw-semibold">
                          {booking.reportingPoint || "—"}
                          {booking.activityType ? (
                            <Badge
                              className="ms-2"
                              bg={
                                String(booking.activityType) === "2"
                                  ? "info-subtle"
                                  : "success-subtle"
                              }
                              text={
                                String(booking.activityType) === "2"
                                  ? "info"
                                  : "success"
                              }
                            >
                              {String(booking.activityType) === "2"
                                ? "SIC"
                                : "Private"}
                            </Badge>
                          ) : null}
                        </td>
                      </tr>
                    )}
                    {(booking.cityName || booking.destination) && (
                      <tr>
                        <td className="text-muted small">
                          <FaMapMarkerAlt className="me-1" />
                          City
                        </td>
                        <td className="fw-semibold">
                          {booking.cityName || booking.destination}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

            {/* Itinerary, if any */}
            {Array.isArray(booking.customBookingItinearyDTO) &&
              booking.customBookingItinearyDTO.length > 0 && (
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Itinerary
                  </Card.Header>
                  <Card.Body>
                    <ol className="ps-3 mb-0 small text-secondary">
                      {booking.customBookingItinearyDTO.map((it, idx) => (
                        <li key={idx} className="mb-1">
                          {it.itinerary}
                        </li>
                      ))}
                    </ol>
                  </Card.Body>
                </Card>
              )}

            {/* Passengers */}
            <Card className="mb-3">
              <Card.Header
                className="fw-semibold d-flex align-items-center"
                style={{ backgroundColor: "#f1f3f5" }}
              >
                <FaUserAlt className="me-2 text-primary" />
                Passengers
              </Card.Header>
              <Card.Body>
                <Table size="sm" borderless className="mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted small" style={{ width: 110 }}>Adults</td>
                      <td className="fw-semibold">{booking.noOfAdult ?? 0}</td>
                      <td className="text-muted small" style={{ width: 90 }}>Children</td>
                      <td className="fw-semibold">{booking.noOfChild ?? 0}</td>
                      {Array.isArray(booking.childAgeArray) &&
                        booking.childAgeArray.length > 0 && (
                          <>
                            <td className="text-muted small">Child ages</td>
                            <td className="fw-semibold">
                              {booking.childAgeArray.join(", ")}
                            </td>
                          </>
                        )}
                    </tr>
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

            {/* Primary Guest */}
            <Card className="mb-3">
              <Card.Header
                className="fw-semibold"
                style={{ backgroundColor: "#f1f3f5" }}
              >
                Primary Guest
              </Card.Header>
              <Card.Body>
                <Table size="sm" borderless className="mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted small" style={{ width: 80 }}>Name</td>
                      <td className="fw-semibold">
                        {[
                          booking.salutation,
                          booking.firstName,
                          booking.lastName,
                        ]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </td>
                      <td className="text-muted small" style={{ width: 70 }}>
                        <FaPhoneAlt className="me-1" />
                        Phone
                      </td>
                      <td className="fw-semibold">
                        {booking.contactNumber ||
                          booking.mobileNumber ||
                          booking.phone ||
                          "—"}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted small">
                        <FaEnvelope className="me-1" />Email
                      </td>
                      <td className="fw-semibold">
                        {booking.emailId || "—"}
                      </td>
                      <td className="text-muted small">
                        <FaIdCard className="me-1" />Passport
                      </td>
                      <td className="fw-semibold">
                        {booking.passportNo ||
                          booking.passportNumber ||
                          "—"}
                      </td>
                    </tr>
                    {booking.agentLpo && (
                      <tr>
                        <td className="text-muted small">LPO</td>
                        <td className="fw-semibold" colSpan={3}>
                          {booking.agentLpo}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

            {/* Pricing */}
            <Card className="mb-3">
              <Card.Header
                className="fw-semibold"
                style={{ backgroundColor: "#f1f3f5" }}
              >
                Pricing
              </Card.Header>
              <Card.Body>
                <div className="p-2 px-3 bg-light rounded">
                  {booking.sellingPrice != null && (
                    <div className="d-flex justify-content-between text-muted small">
                      <span>Selling Price</span>
                      <span className="fw-medium">
                        {formatPrice(booking.sellingPrice)}
                      </span>
                    </div>
                  )}
                  {booking.totalRate != null &&
                    Number(booking.totalRate) !==
                      Number(booking.totalPrice) && (
                      <div className="d-flex justify-content-between text-muted small">
                        <span>Total Rate</span>
                        <span className="fw-medium">
                          {formatPrice(booking.totalRate)}
                        </span>
                      </div>
                    )}
                  {booking.totalRateWithoutmrk != null &&
                    Number(booking.totalRateWithoutmrk) !==
                      Number(booking.totalPrice) && (
                      <div className="d-flex justify-content-between text-muted small">
                        <span>Total (without markup)</span>
                        <span className="fw-medium">
                          {formatPrice(booking.totalRateWithoutmrk)}
                        </span>
                      </div>
                    )}
                  <div className="d-flex justify-content-between align-items-center border-top pt-1 mt-1">
                    <span className="fw-semibold">Total Amount</span>
                    <span className="fs-6 fw-bold text-success">
                      {formatPrice(booking.totalPrice)}
                    </span>
                  </div>
                </div>
              </Card.Body>
            </Card>

            {/* Bottom action buttons (left-aligned) — mirrors the row icons
                that used to sit in the list's Action column. */}
            <div
              className="d-flex gap-2 justify-content-start flex-wrap"
              style={{ marginTop: "16px", marginBottom: "20px" }}
            >
              {status === "upcoming" && !booking.cancelStatus && (
                <button
                  style={{ ...BUTTON_STYLE, backgroundColor: "#dc3545" }}
                  onClick={() => setShowCancelModal(true)}
                  title="Cancel booking"
                >
                  <FaTrash style={{ marginRight: "6px" }} />
                  Cancel
                </button>
              )}
            </div>
          </Container>
        </main>
      </div>

      {/* Cancel confirmation */}
      <Modal
        show={showCancelModal}
        onHide={() => !cancelling && setShowCancelModal(false)}
        centered
      >
        <Modal.Header closeButton={!cancelling}>
          <Modal.Title>Cancel Activity Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          <p className="mb-1 text-muted">
            Are you sure you want to cancel this booking?
          </p>
          <h5 className="mb-0">{booking.packageBookCode}</h5>
          <p className="text-primary small mt-2">{booking.activityName}</p>
        </Modal.Body>
        <Modal.Footer className="justify-content-center border-0 pb-4">
          <Button
            variant="light"
            className="px-4"
            onClick={() => setShowCancelModal(false)}
            disabled={cancelling}
          >
            No, Keep
          </Button>
          <Button
            variant="dark"
            className="px-4"
            onClick={handleCancelBooking}
            disabled={cancelling}
          >
            {cancelling ? <Spinner size="sm" className="me-2" /> : "Yes, Cancel"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
