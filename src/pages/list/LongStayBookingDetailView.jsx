/**
 * LongStayBookingDetailView.jsx
 *
 * Full-page detail view for a single Long Stay booking. Replaces the
 * modal-based "View" that used to live in LongStayBookingList. The
 * Voucher / Cancel row icons now sit at the bottom-left of this page as
 * buttons. All endpoints / behaviour are unchanged:
 *   - Detail fetch :  GET    /api/longStayBooking/{id}
 *   - Voucher PDF  :  GET    /api/longStayBooking/{id}/pdf?type=VOUCHER
 *                     → { status: "SUCCESS", pdfUrl }
 *                     The URL opens in a new tab (matches the list's
 *                     original behaviour — browser renders the PDF
 *                     inline and the user can save / print from there).
 *   - Cancel       :  POST   /api/longStayBooking/{id}/cancel
 *
 * The list row is forwarded via location.state.booking so the page has a
 * booking-code header even before the detail fetch resolves. On hard
 * refresh the route id alone drives the fetch.
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
} from "react-bootstrap";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaTrash, FaFilePdf } from "react-icons/fa";
import axiosInstance from "../../components/AxiosInstance";
import { formatDateTime } from "../../utils/dateUtils";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";

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

function InfoRow({ label, value }) {
  return (
    <div className="mb-2">
      <small className="text-muted d-block">{label}</small>
      <span className="fw-semibold">{value || "-"}</span>
    </div>
  );
}

export default function LongStayBookingDetailView() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const rowStub = location.state?.booking || null;
  const bookingId = rowStub?.longStayBookingId || routeId;

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);

  // Voucher (PDF) request state — only the button shows a spinner; the
  // PDF still opens in a new tab on success (mirrors the list).
  const [voucherLoading, setVoucherLoading] = useState(false);

  const fetchDetail = async () => {
    if (!bookingId) {
      toast.error("Booking id missing");
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    try {
      const res = await axiosInstance.get(
        `/api/longStayBooking/${bookingId}`
      );
      setDetail(res.data);
    } catch {
      toast.error("Failed to load booking details");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // ── Cancel — SweetAlert confirm + DELETE/POST ─────────────────────
  const handleCancel = async () => {
    const target = detail || rowStub;
    if (!target || !bookingId) return;
    const r = await Swal.fire({
      title: "Cancel booking?",
      text: `Cancel ${target.bookingCode || ""} for ${
        target.primaryGuestName || ""
      }?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, cancel",
    });
    if (!r.isConfirmed) return;
    try {
      await axiosInstance.post(`/api/longStayBooking/${bookingId}/cancel`);
      toast.success("Booking cancelled");
      navigate(-1);
    } catch {
      toast.error("Cancel failed");
    }
  };

  // ── Voucher — opens PDF in a new tab (no modal) ───────────────────
  const handleVoucher = async () => {
    if (!bookingId) return;
    try {
      setVoucherLoading(true);
      const res = await axiosInstance.get(
        `/api/longStayBooking/${bookingId}/pdf`,
        { params: { type: "VOUCHER" } }
      );
      if (res.data && res.data.status === "SUCCESS" && res.data.pdfUrl) {
        window.open(res.data.pdfUrl, "_blank", "noopener,noreferrer");
        toast.success("Voucher opened in a new tab");
      } else {
        toast.error(res.data?.message || "Failed to generate voucher");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to generate voucher"
      );
    } finally {
      setVoucherLoading(false);
    }
  };

  const isCancelled =
    detail?.bookingStatus === "CANCELLED" || detail?.cancelStatus === true;

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
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
                Booking Details
                {(detail?.bookingCode || rowStub?.bookingCode) && (
                  <Badge
                    bg="light"
                    text="dark"
                    className="ms-3 fw-semibold border"
                  >
                    {detail?.bookingCode || rowStub?.bookingCode}
                  </Badge>
                )}
              </span>
            </div>

            {detailLoading || !detail ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-2 text-muted small">Loading details…</p>
              </div>
            ) : (
              <>
                {/* Booking Info */}
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Booking Information
                  </Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={6}>
                        <InfoRow label="Booking Code" value={detail.bookingCode} />
                        <InfoRow label="Status" value={detail.bookingStatus} />
                        <InfoRow
                          label="Cancel Status"
                          value={
                            detail.cancelStatus ? "Cancelled" : "Active"
                          }
                        />
                        <InfoRow
                          label="Booked On"
                          value={formatDateTime(detail.bookingDateTime)}
                        />
                      </Col>
                      <Col md={6}>
                        <InfoRow label="Hotel" value={detail.hotelName} />
                        <InfoRow
                          label="Check-In"
                          value={formatDateTime(detail.checkInDate)}
                        />
                        <InfoRow
                          label="Check-Out"
                          value={formatDateTime(detail.checkOutDate)}
                        />
                        <InfoRow
                          label="Total Nights"
                          value={detail.totalNights}
                        />
                        {/* Optional "Booking Done By Employee" — only
                            rendered when an employee was picked at
                            search time. Backend resolves the name from
                            the joined employee row. */}
                        {detail.employeeName && (
                          <InfoRow
                            label="Booked By Employee"
                            value={detail.employeeName}
                          />
                        )}
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                {/* Room & Rate Plan */}
                <Card className="mb-3">
                  <Card.Header
                    className="fw-semibold"
                    style={{ backgroundColor: "#f1f3f5" }}
                  >
                    Room &amp; Rate Plan
                  </Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={6}>
                        <InfoRow
                          label="Room Category"
                          value={detail.roomCategoryName}
                        />
                        <InfoRow
                          label="Room Type"
                          value={detail.roomTypeName}
                        />
                        <InfoRow
                          label="Occupancy"
                          value={detail.occupancyTypeName}
                        />
                      </Col>
                      <Col md={6}>
                        <InfoRow
                          label="Meal Plan"
                          value={detail.mealPlanName}
                        />
                        <InfoRow
                          label="Contract Rate Code"
                          value={detail.contractRateCode}
                        />
                        <InfoRow
                          label="Refundable"
                          value={
                            detail.refundable
                              ? "Flexible"
                              : "Non-Refundable"
                          }
                        />
                      </Col>
                    </Row>
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
                    <Row>
                      <Col md={6}>
                        <InfoRow
                          label="Monthly Rate"
                          value={detail.monthlyRate}
                        />
                        <InfoRow
                          label="Additional Rate"
                          value={detail.additionalRate}
                        />
                      </Col>
                      <Col md={6}>
                        <InfoRow
                          label="Cost Type"
                          value={detail.additionalCostType}
                        />
                        <InfoRow
                          label="Total Amount"
                          value={detail.totalAmount}
                        />
                      </Col>
                    </Row>
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
                    {detail.primaryGuestDetails ? (
                      <Row>
                        <Col md={6}>
                          <InfoRow
                            label="Name"
                            value={`${
                              detail.primaryGuestDetails.salutation || ""
                            } ${
                              detail.primaryGuestDetails.firstName || ""
                            } ${
                              detail.primaryGuestDetails.middleName || ""
                            } ${detail.primaryGuestDetails.lastName || ""}`
                              .replace(/\s+/g, " ")
                              .trim()}
                          />
                          <InfoRow
                            label="Email"
                            value={detail.primaryGuestDetails.email}
                          />
                          <InfoRow
                            label="Phone"
                            value={detail.primaryGuestDetails.phone}
                          />
                        </Col>
                        <Col md={6}>
                          <InfoRow
                            label="Passport No"
                            value={detail.primaryGuestDetails.passportNo}
                          />
                          <InfoRow
                            label="Nationality"
                            value={detail.primaryGuestDetails.nationality}
                          />
                          <InfoRow
                            label="Gender"
                            value={detail.primaryGuestDetails.gender}
                          />
                        </Col>
                      </Row>
                    ) : (
                      <Row>
                        <Col md={6}>
                          <InfoRow
                            label="Name"
                            value={detail.primaryGuestName}
                          />
                          <InfoRow
                            label="Email"
                            value={detail.primaryGuestEmail}
                          />
                        </Col>
                        <Col md={6}>
                          <InfoRow
                            label="Phone"
                            value={detail.primaryGuestPhone}
                          />
                          <InfoRow
                            label="Nationality"
                            value={detail.nationality}
                          />
                        </Col>
                      </Row>
                    )}
                  </Card.Body>
                </Card>

                {/* Passengers */}
                {detail.rooms && detail.rooms.length > 0 && (
                  <Card className="mb-3">
                    <Card.Header
                      className="fw-semibold"
                      style={{ backgroundColor: "#f1f3f5" }}
                    >
                      Passengers
                    </Card.Header>
                    <Card.Body>
                      {detail.rooms.map((room, idx) => (
                        <div key={idx} className="mb-3">
                          <strong>
                            Room {idx + 1} — {room.adults || 0} Adult
                            {(room.adults || 0) > 1 ? "s" : ""}
                            {(room.children || 0) > 0
                              ? `, ${room.children} Child${
                                  room.children > 1 ? "ren" : ""
                                }`
                              : ""}
                          </strong>
                          <Table size="sm" bordered className="mt-2 mb-0">
                            <thead className="table-light">
                              <tr>
                                <th>#</th>
                                <th>Salutation</th>
                                <th>First Name</th>
                                <th>Last Name</th>
                                <th>Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(room.guests || []).map((g, gi) => (
                                <tr key={gi}>
                                  <td>{gi + 1}</td>
                                  <td>{g.salutation || "-"}</td>
                                  <td>{g.firstName || "-"}</td>
                                  <td>{g.lastName || "-"}</td>
                                  <td>
                                    {g.isChild
                                      ? `Child${
                                          g.childAge != null
                                            ? ` (${g.childAge}y)`
                                            : ""
                                        }`
                                      : "Adult"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      ))}
                    </Card.Body>
                  </Card>
                )}

                {/* Remarks */}
                {detail.remarks && (
                  <Card className="mb-3">
                    <Card.Header
                      className="fw-semibold"
                      style={{ backgroundColor: "#f1f3f5" }}
                    >
                      Remarks
                    </Card.Header>
                    <Card.Body>
                      <InfoRow label="Remarks" value={detail.remarks} />
                    </Card.Body>
                  </Card>
                )}

                {/* Bottom action buttons (left-aligned) — mirrors the
                    Voucher / Delete row icons. Cancel hidden when the
                    booking is already in CANCELLED state. */}
                <div
                  className="d-flex gap-2 justify-content-start flex-wrap"
                  style={{ marginTop: "16px", marginBottom: "20px" }}
                >
                  <button
                    style={{ ...BUTTON_STYLE, backgroundColor: "#198754" }}
                    onClick={handleVoucher}
                    disabled={voucherLoading}
                    title="Voucher"
                  >
                    {voucherLoading ? (
                      <Spinner
                        size="sm"
                        style={{ width: 12, height: 12, marginRight: 6 }}
                      />
                    ) : (
                      <FaFilePdf style={{ marginRight: "6px" }} />
                    )}
                    Voucher
                  </button>
                  {!isCancelled && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#dc3545" }}
                      onClick={handleCancel}
                      title="Delete"
                    >
                      <FaTrash style={{ marginRight: "6px" }} />
                      Delete
                    </button>
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
