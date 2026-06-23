/**
 * CustomBookingDetailView.jsx
 *
 * Full-page detail view for a single Custom (Make Your Own Package)
 * booking. Replaces the modal-based "View" that used to live in
 * CustomBookingList. The Cancel row icon now sits at the bottom-left of
 * this page as a button. All endpoints / behaviour are unchanged:
 *   - Detail fetch :  GET    /api/makeYourOwnPackage/getCustomBookingDetails/{id}
 *   - Cancel       :  PATCH  /api/makeYourOwnPackage/cancelCustomBooking/{id}
 *
 * The list row is forwarded via location.state.booking so the page has a
 * package-code header even before the detail fetch resolves. The list
 * bucket key is forwarded as `status` so the Cancel button mirrors the
 * "only on non-cancelled" gate from the original row icon.
 */
import React, { useEffect, useState } from "react";
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
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  FaEye,
  FaTrash,
  FaTicketAlt,
  FaCar,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaExclamationCircle,
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

const formatDate = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
};

export default function CustomBookingDetailView() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // The list row carries packageCode / agentName / customerName / dates;
  // listStatus tells the page whether to surface the Cancel button.
  const rowStub = location.state?.booking || null;
  const listStatus = location.state?.status || "upcoming";
  const customBookingId =
    rowStub?.customBookingId ||
    rowStub?.bookingId ||
    rowStub?.id ||
    routeId;

  const [bookingDetails, setBookingDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(true);

  // Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchDetails = async () => {
    if (!customBookingId) {
      toast.error("Booking ID not found");
      setLoadingDetails(false);
      return;
    }
    try {
      setLoadingDetails(true);
      const response = await axiosInstance.get(
        `/api/makeYourOwnPackage/getCustomBookingDetails/${customBookingId}`
      );
      if (response.data) {
        setBookingDetails(response.data);
      } else {
        toast.error("Failed to load booking details");
      }
    } catch (error) {
      console.error("Error fetching booking details:", error);
      toast.error(
        error.response?.data?.message || "Failed to load booking details"
      );
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customBookingId]);

  const confirmCancelBooking = async () => {
    if (!customBookingId) return;
    try {
      setIsCancelling(true);
      const response = await axiosInstance.patch(
        `/api/makeYourOwnPackage/cancelCustomBooking/${customBookingId}`
      );
      if (response.data && response.data.status === "success") {
        toast.success("cancelled successfully");
        setShowCancelModal(false);
        navigate(-1);
      } else {
        toast.error(response.data?.message || "Failed to cancel booking");
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error(
        error.response?.data?.message ||
          "Error cancelling booking. Please try again."
      );
    } finally {
      setIsCancelling(false);
    }
  };

  // Cancel button mirrors the row icon visibility — hidden when the
  // booking arrived from the "cancelled" bucket.
  const isCancellable = listStatus !== "cancelled";

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
                <FaEye className="me-2 text-info" />
                Booking Details
                {(bookingDetails?.packageCode || rowStub?.packageCode) && (
                  <Badge
                    bg="primary-subtle"
                    text="primary"
                    className="ms-3"
                  >
                    {bookingDetails?.packageCode || rowStub?.packageCode}
                  </Badge>
                )}
              </span>
            </div>

            {loadingDetails && !bookingDetails ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3 text-muted fw-medium">
                  Fetching details...
                </p>
              </div>
            ) : !bookingDetails ? (
              <div className="text-center py-5">
                <FaExclamationTriangle
                  size={40}
                  className="text-muted mb-3"
                />
                <p className="text-muted">
                  Booking data is unavailable at this moment.
                </p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <Row className="mb-3">
                  <Col md={3}>
                    <div className="border p-2 bg-white">
                      <div
                        className="text-muted mb-1"
                        style={{ fontSize: "0.6rem" }}
                      >
                        PACKAGE CODE
                      </div>
                      <div
                        className="text-break"
                        style={{ fontSize: "0.9rem" }}
                      >
                        {bookingDetails.packageCode || "-"}
                      </div>
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="border p-2 bg-white">
                      <div
                        className="text-muted mb-1"
                        style={{ fontSize: "0.6rem" }}
                      >
                        BOOKING DATE
                      </div>
                      <div
                        className="text-break"
                        style={{ fontSize: "0.9rem" }}
                      >
                        {formatDate(
                          bookingDetails.bookDate || bookingDetails.bookingDate
                        )}
                      </div>
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="border p-2 bg-white">
                      <div
                        className="text-muted mb-1"
                        style={{ fontSize: "0.6rem" }}
                      >
                        TOUR DATE
                      </div>
                      <div
                        className="text-break"
                        style={{ fontSize: "0.9rem" }}
                      >
                        {formatDate(
                          bookingDetails.tourDate || bookingDetails.travelDate
                        )}
                      </div>
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="border p-2 bg-white">
                      <div
                        className="text-muted mb-1"
                        style={{ fontSize: "0.6rem" }}
                      >
                        STATUS
                      </div>
                      <div style={{ fontSize: "0.9rem" }}>
                        {bookingDetails.status ||
                          bookingDetails.bookingStatus ||
                          "N/A"}
                      </div>
                    </div>
                  </Col>
                </Row>

                <Row className="g-4">
                  {/* Left Column: Guest & Basic Info */}
                  <Col lg={4}>
                    <div className="border mb-3 p-3 bg-white">
                      <h6 className="mb-3">Contact Person</h6>
                      {(() => {
                        const guest =
                          bookingDetails.hotelBookingRequest?.[0]
                            ?.primaryGuest ||
                          bookingDetails.customerDTO ||
                          {};
                        const guestCount =
                          bookingDetails.hotelBookingRequest?.reduce(
                            (acc, h) =>
                              acc +
                              (h.rooms?.reduce(
                                (rAcc, r) => rAcc + (r.guests?.length || 0),
                                0
                              ) || 0),
                            0
                          ) || 0;
                        return (
                          <div className="d-flex flex-column gap-2">
                            <div className="mb-2">
                              <label className="text-muted mb-0 d-block small">
                                Primary Contact
                              </label>
                              <div className="small">
                                {guest.salutation || ""}{" "}
                                {guest.firstName || ""}{" "}
                                {guest.lastName || ""}
                              </div>
                            </div>
                            <div className="mb-2">
                              <label className="text-muted mb-0 d-block small">
                                Email Address
                              </label>
                              <div className="small text-break">
                                {guest.email || guest.emailId || "-"}
                              </div>
                            </div>
                            <Row className="mb-2">
                              <Col xs={6}>
                                <label className="text-muted mb-0 d-block small">
                                  Phone
                                </label>
                                <div className="small">
                                  {guest.phone || guest.mobileNumber || "-"}
                                </div>
                              </Col>
                              <Col xs={6}>
                                <label className="text-muted mb-0 d-block small">
                                  Nationality
                                </label>
                                <div className="small">
                                  {guest.nativeCountry || "-"}
                                </div>
                              </Col>
                            </Row>

                            {/* All Guests Summary */}
                            <div className="mt-2 pt-2 border-top">
                              <div className="mb-1 small">
                                Guest List ({guestCount})
                              </div>
                              <div
                                style={{
                                  maxHeight: "120px",
                                  overflowY: "auto",
                                }}
                              >
                                {bookingDetails.hotelBookingRequest?.map(
                                  (hotel) =>
                                    hotel.rooms?.map((room) =>
                                      room.guests?.map((g, idx) => (
                                        <div
                                          key={`${room.roomNo}-${idx}`}
                                          className="small py-1 border-bottom last-child-border-0 d-flex justify-content-between align-items-center"
                                        >
                                          <span
                                            style={{ fontSize: "0.7rem" }}
                                          >
                                            {g.salutation} {g.firstName}{" "}
                                            {g.lastName}
                                          </span>
                                          <span
                                            className="text-muted"
                                            style={{ fontSize: "0.65rem" }}
                                          >
                                            {room.roomCategory}
                                          </span>
                                        </div>
                                      ))
                                    )
                                )}
                              </div>
                            </div>

                            <div className="mt-2 pt-2 border-top">
                              <Row className="g-2">
                                <Col xs={6}>
                                  <div>
                                    <label className="text-muted d-block mb-0 small">
                                      Selling
                                    </label>
                                    <span className="small">
                                      {parseFloat(
                                        bookingDetails.sellingPrice || 0
                                      ).toLocaleString()}{" "}
                                      AED
                                    </span>
                                  </div>
                                </Col>
                                <Col xs={6}>
                                  <div>
                                    <label className="text-muted d-block mb-0 small">
                                      Cost
                                    </label>
                                    <span className="small">
                                      {parseFloat(
                                        bookingDetails.totalPrice || 0
                                      ).toLocaleString()}{" "}
                                      AED
                                    </span>
                                  </div>
                                </Col>
                              </Row>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </Col>

                  {/* Right Column: Hotel & Activities */}
                  <Col lg={8}>
                    {/* Hotel Section */}
                    {bookingDetails.hotelBookingRequest?.length > 0 && (
                      <div className="border mb-3 p-3 bg-white">
                        <h6>Hotel Reservations</h6>
                        {bookingDetails.hotelBookingRequest.map(
                          (hotel, hIdx) => (
                            <div
                              key={hIdx}
                              className={`py-3 ${hIdx > 0 ? "border-top" : ""}`}
                            >
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                  <div className="small">{hotel.hotelName}</div>
                                  <div
                                    className="text-muted"
                                    style={{ fontSize: "0.7rem" }}
                                  >
                                    {hotel.address}
                                  </div>
                                </div>
                                <div className="small text-muted">
                                  {hotel.roomStatus}
                                </div>
                              </div>
                              <Row className="mb-3 g-2 border p-2">
                                <Col md={3} xs={6}>
                                  <label className="text-muted d-block mb-0 small">
                                    Check-In
                                  </label>
                                  <span className="small">
                                    {formatDate(
                                      hotel.checkInDate || hotel.checkIn
                                    )}
                                  </span>
                                </Col>
                                <Col md={3} xs={6}>
                                  <label className="text-muted d-block mb-0 small">
                                    Check-Out
                                  </label>
                                  <span className="small">
                                    {formatDate(
                                      hotel.checkOutDate || hotel.checkOut
                                    )}
                                  </span>
                                </Col>
                                <Col md={3} xs={6}>
                                  <label className="text-muted d-block mb-0 small">
                                    Duration
                                  </label>
                                  <span className="small">
                                    {hotel.nights} Nights
                                  </span>
                                </Col>
                                <Col md={3} xs={6}>
                                  <label className="text-muted d-block mb-0 small">
                                    Rating
                                  </label>
                                  <div className="small">
                                    {hotel.starRating} Stars
                                  </div>
                                </Col>
                              </Row>
                              {hotel.rooms?.length > 0 && (
                                <div className="mb-2">
                                  <div className="mb-1 small">
                                    Room Details
                                  </div>
                                  <Table responsive size="sm" className="mb-0 border">
                                    <thead className="bg-light">
                                      <tr
                                        className="text-muted"
                                        style={{ fontSize: "0.65rem" }}
                                      >
                                        <th>Room Category</th>
                                        <th className="text-center">Pax</th>
                                        <th>Guests</th>
                                        <th className="text-end">Rate</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {hotel.rooms.map((room, rIdx) => (
                                        <tr
                                          key={rIdx}
                                          style={{ fontSize: "0.75rem" }}
                                        >
                                          <td>
                                            <div>{room.roomCategory}</div>
                                            <div
                                              className="text-muted"
                                              style={{ fontSize: "0.65rem" }}
                                            >
                                              {room.mealPlan}
                                            </div>
                                          </td>
                                          <td className="text-center">
                                            {room.adults}A / {room.children}C
                                          </td>
                                          <td>
                                            {room.guests?.map((g, gIdx) => (
                                              <div
                                                key={gIdx}
                                                style={{ fontSize: "0.7rem" }}
                                              >
                                                • {g.salutation} {g.firstName}{" "}
                                                {g.lastName}
                                              </div>
                                            )) || "-"}
                                          </td>
                                          <td className="text-end">
                                            {parseFloat(
                                              room.rate
                                            ).toLocaleString()}{" "}
                                            AED
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </Table>
                                </div>
                              )}

                              {/* Cancellation Policy */}
                              {hotel.cancellationPolicy?.length > 0 && (
                                <div className="mt-2 p-2 border">
                                  <div className="small mb-1">
                                    Cancellation Policy
                                  </div>
                                  <ul
                                    className="mb-0 ps-3 text-muted"
                                    style={{ fontSize: "0.65rem" }}
                                  >
                                    {hotel.cancellationPolicy.map(
                                      (policy, pIdx) => (
                                        <li key={pIdx}>{policy}</li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {/* Activity Section */}
                    {bookingDetails.customBookingActivityDTO?.length > 0 && (
                      <Card className="border-0 shadow-sm mb-4 rounded-4 overflow-hidden">
                        <div className="bg-white p-3 border-bottom d-flex align-items-center gap-2">
                          <FaTicketAlt className="text-primary" />
                          <h6 className="mb-0 fw-bold">Booked Activities</h6>
                        </div>
                        <Card.Body className="p-0">
                          <Table
                            hover
                            responsive
                            className="mb-0 small align-middle"
                          >
                            <thead className="bg-light">
                              <tr className="text-muted">
                                <th className="ps-4">
                                  Activity Description
                                </th>
                                <th>Tour Date</th>
                                <th>Pax</th>
                                <th className="text-end pe-4">Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bookingDetails.customBookingActivityDTO.map(
                                (act, aIdx) => (
                                  <tr key={aIdx}>
                                    <td className="ps-4 py-3 fw-medium">
                                      {act.activityName ||
                                        act.activityId ||
                                        "Activity Service"}
                                    </td>
                                    <td>{formatDate(act.tourDate)}</td>
                                    <td>
                                      {act.noOfAdult}A / {act.noOfChild}C
                                    </td>
                                    <td className="text-end pe-4 fw-bold text-success">
                                      AED {parseFloat(act.totalPrice).toFixed(2)}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </Table>
                        </Card.Body>
                      </Card>
                    )}

                    {/* Transfer Section */}
                    {bookingDetails.customBookingCabDTO?.length > 0 && (
                      <Card className="border-0 shadow-sm mb-4 rounded-4 overflow-hidden">
                        <div className="bg-white p-3 border-bottom d-flex align-items-center gap-2">
                          <FaCar className="text-primary" />
                          <h6 className="mb-0 fw-bold">Transfer Details</h6>
                        </div>
                        <Card.Body className="p-3">
                          <Row className="g-3">
                            {bookingDetails.customBookingCabDTO.map(
                              (cab, cIdx) => (
                                <Col md={6} key={cIdx}>
                                  <div className="border rounded-3 p-3 h-100 bg-white shadow-none">
                                    <div className="d-flex justify-content-between mb-2">
                                      <span className="fw-bold text-primary">
                                        {cab.cabName || "Transfer"}
                                      </span>
                                      <Badge bg="info">
                                        {cab.travelType === 1
                                          ? "Round Trip"
                                          : "One Way"}
                                      </Badge>
                                    </div>
                                    <div className="small text-muted mb-2">
                                      <FaCalendarAlt
                                        size={10}
                                        className="me-1"
                                      />{" "}
                                      {formatDate(cab.pickupDate)}
                                    </div>
                                    <div className="d-flex justify-content-between align-items-end pt-2 border-top">
                                      <span className="small text-muted">
                                        {cab.noOfAdult}A / {cab.noOfChild}C
                                      </span>
                                      <span className="fw-bold text-dark">
                                        AED{" "}
                                        {parseFloat(
                                          cab.totalPrice || cab.totalRate
                                        ).toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                </Col>
                              )
                            )}
                          </Row>
                        </Card.Body>
                      </Card>
                    )}

                    {/* Visa & Other Info */}
                    <Row className="g-3">
                      <Col md={6}>
                        <div className="border h-100 p-3 bg-white">
                          <div className="mb-2 small">Visa Details</div>
                          <Row className="g-2">
                            <Col xs={12}>
                              <div className="d-flex justify-content-between align-items-center">
                                <span className="small">Visa Status:</span>
                                <span className="small">
                                  {bookingDetails.visaStatus
                                    ? "Required"
                                    : "Not Required"}
                                </span>
                              </div>
                            </Col>
                            {bookingDetails.visaStatus && (
                              <Col xs={12}>
                                <div className="border p-2">
                                  <div className="small mb-1 text-muted">
                                    Breakdown
                                  </div>
                                  <div className="d-flex justify-content-between small">
                                    <span>Adults:</span>
                                    <span>
                                      {bookingDetails.visaAdult} x{" "}
                                      {bookingDetails.visaAdultRate}
                                    </span>
                                  </div>
                                  <div className="d-flex justify-content-between small">
                                    <span>Children:</span>
                                    <span>
                                      {bookingDetails.visaChild} x{" "}
                                      {bookingDetails.visaChildRate}
                                    </span>
                                  </div>
                                </div>
                              </Col>
                            )}
                          </Row>
                        </div>
                      </Col>
                      <Col md={6}>
                        <div className="border h-100 p-3 bg-white">
                          <div className="mb-2 small">Remarks</div>
                          <div className="small text-muted mb-2">
                            {bookingDetails.hotelBookingRequest?.[0]
                              ?.remarks ||
                              bookingDetails.remarks ||
                              "None"}
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </Col>
                </Row>

                {/* Bottom action buttons (left-aligned) — mirrors the
                    Cancel row icon. Same status gate (hidden when the
                    booking is in the "cancelled" bucket). Print button
                    preserves the modal footer's "Print Preview" action. */}
                <div
                  className="d-flex gap-2 justify-content-start flex-wrap"
                  style={{ marginTop: "16px", marginBottom: "20px" }}
                >
                  <button
                    style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                    onClick={() => window.print()}
                  >
                    Print Preview
                  </button>
                  {isCancellable && (
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
              </>
            )}
          </Container>
        </main>
      </div>

      {/* ── Cancellation Modal ──────────────────────────────────────── */}
      <Modal
        show={showCancelModal}
        onHide={() => !isCancelling && setShowCancelModal(false)}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton={!isCancelling} className="border-0">
          <Modal.Title className="fw-bold d-flex align-items-center">
            <FaExclamationCircle className="me-2 text-danger" />
            <span>Cancel Booking</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-4 text-center">
          <p className="fs-5 mb-0">
            Are you sure you want to cancel this booking?
          </p>
          {(bookingDetails || rowStub) && (
            <div className="mt-3 text-muted small">
              <div className="fw-bold text-dark">
                {bookingDetails?.packageCode || rowStub?.packageCode}
              </div>
              <div>
                {bookingDetails?.customerName || rowStub?.customerName}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 justify-content-center pb-4">
          <Button
            variant="secondary"
            className="px-4 fw-bold"
            onClick={() => setShowCancelModal(false)}
            disabled={isCancelling}
          >
            No
          </Button>
          <Button
            variant="danger"
            className="px-4 fw-bold shadow-sm"
            onClick={confirmCancelBooking}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Cancelling...
              </>
            ) : (
              "Yes, Cancel"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
