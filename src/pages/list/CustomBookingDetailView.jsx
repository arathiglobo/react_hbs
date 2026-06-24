/**
 * CustomBookingDetailView.jsx
 *
 * Full-page detail view for a single Custom (Make Your Own Package)
 * booking. The booking-detail action-button row + modals mirror the
 * Long Stay module (CANCEL / RECONFIRM / VOUCHER / ADD AGENT REFERENCE /
 * CONFIRMATION NO. / RESEND MAIL / BOOKING REMARK / NOTES), wired to the
 * custom-booking backend (base path /api/makeYourOwnPackage):
 *   - Detail fetch        : GET   /api/makeYourOwnPackage/getCustomBookingDetails/{id}
 *   - Cancel (opt reason) : PATCH /api/makeYourOwnPackage/cancelCustomBooking/{id}?reason=
 *   - Confirmation status : PATCH /api/makeYourOwnPackage/{id}/confirmation-status
 *   - Agent reference     : GET/POST /api/makeYourOwnPackage/{id}/agent-reference
 *   - Remark              : POST  /api/makeYourOwnPackage/{id}/remark
 *   - Resend mail         : POST  /api/makeYourOwnPackage/{id}/resend-mail
 *   - Voucher PDF         : GET   /api/makeYourOwnPackage/bookings/{id}/pdf?type=VOUCHER
 *                           → { status: "SUCCESS", pdfUrl }
 *   - Notes               : navigate /booking-details/custom-booking/{id}/notes
 *
 * NOTE: the custom-booking PDF endpoint only supports a VOUCHER document
 * (no Proforma / Invoice variants), so only the VOUCHER button is shown.
 *
 * The list row is forwarded via location.state.booking so the page has a
 * package-code header even before the detail fetch resolves. The list
 * bucket key is forwarded as `status`.
 */
import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Table,
  Badge,
  Spinner,
  Modal,
  Button,
  Form,
} from "react-bootstrap";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaExclamationTriangle, FaExclamationCircle } from "react-icons/fa";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

// ── Shared visual styling (matches the Hotel Booking detail view) ──────
const BUTTON_STYLE = {
  backgroundColor: "#c0392b",
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

const SECTION_HEADER = {
  backgroundColor: "#f0f0f0",
  padding: "7px 12px",
  fontWeight: "600",
  fontSize: "0.9rem",
  borderBottom: "1px solid #ddd",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const INFO_LABEL = {
  fontWeight: "600",
  color: "#555",
  fontSize: "0.82rem",
  minWidth: "160px",
  display: "inline-block",
};

const INFO_VALUE = {
  color: "#222",
  fontSize: "0.82rem",
};

const CARD = {
  border: "1px solid #ddd",
  borderRadius: "4px",
  marginBottom: "14px",
  overflow: "hidden",
  backgroundColor: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const parseLocal = (str) => {
  if (!str) return null;
  const normalized = str.includes("T") ? str : `${str}T00:00:00`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
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

const formatDateTime = (dateStr) => {
  const d = parseLocal(dateStr);
  if (!d) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const hrs = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  const mon = d.toLocaleString("default", { month: "short" });
  return `${day} ${mon} ${d.getFullYear()} ${hrs}:${min}:${sec}`;
};

// Status pill matching the Hotel Booking detail view: each "/"-separated
// part is coloured on its own (Confirmed/ReConfirmed green, Cancelled red,
// On Request orange).
const StatusBadge = ({ status }) => {
  const colorFor = (part) => {
    const p = (part || "").trim().toUpperCase();
    if (p.startsWith("CONFIRMED") || p.startsWith("RECONFIRMED"))
      return "#16a34a";
    if (p.startsWith("CANCELLED")) return "#dc2626";
    if (p === "ON REQUEST") return "#e67e22";
    return "#888";
  };
  const parts = String(status || "-").split("/");
  return (
    <span style={{ fontWeight: "700", fontSize: "0.85rem" }}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ color: "#888" }}>/</span>}
          <span style={{ color: colorFor(part) }}>{part}</span>
        </React.Fragment>
      ))}
    </span>
  );
};

function InfoRow({ label, value }) {
  return (
    <div
      style={{ marginBottom: "6px", display: "flex", alignItems: "flex-start" }}
    >
      <span style={INFO_LABEL}>{label}</span>
      <span style={{ ...INFO_VALUE, marginLeft: "8px" }}>{value ?? "-"}</span>
    </div>
  );
}

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

  // ── Action-button modal / handler state (mirror LongStayBookingDetailView) ──
  // Cancel
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  // Reconfirm (Confirm / Reject popup)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmingBooking, setConfirmingBooking] = useState(false);

  // Reject (follow-up modal from Reconfirm → Reject)
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectedBy, setRejectedBy] = useState("");
  const [rejectedByError, setRejectedByError] = useState("");
  const [rejectionRemarks, setRejectionRemarks] = useState("");
  const [rejectingBooking, setRejectingBooking] = useState(false);

  // Agent Reference (GET prefill / POST save)
  const [showConfirmStatusModal, setShowConfirmStatusModal] = useState(false);
  const [confirmAgentLpo, setConfirmAgentLpo] = useState("");
  const [confirmAgentLpoError, setConfirmAgentLpoError] = useState("");
  const [updatingConfirmationStatus, setUpdatingConfirmationStatus] =
    useState(false);

  // Confirmation Number
  const [showConfirmationNoModal, setShowConfirmationNoModal] = useState(false);
  const [confirmationNoInput, setConfirmationNoInput] = useState("");
  const [confirmationNoError, setConfirmationNoError] = useState("");
  const [savingConfirmationNo, setSavingConfirmationNo] = useState(false);

  // Booking Remark
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [remarkInput, setRemarkInput] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);

  // Resend Mail to Agent
  const [resendingMail, setResendingMail] = useState(false);

  // PDF generation feedback + in-page preview (iframe modal).
  const [generatingPdfType, setGeneratingPdfType] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);

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

  // ── Status helpers (mirror LongStayBookingDetailView) ───────────────
  const normalizedStatus = String(bookingDetails?.confirmationStatus || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const isCancelled =
    bookingDetails?.bookingStatus === "CANCELLED" ||
    bookingDetails?.cancelStatus === true ||
    normalizedStatus === "CANCELLED" ||
    listStatus === "cancelled";
  const showsFinalDocs =
    bookingDetails?.reconfirmation === true ||
    normalizedStatus === "RECONFIRMED" ||
    normalizedStatus === "COMPLETED";
  const isConfirmedOrLater =
    normalizedStatus === "CONFIRMED" ||
    normalizedStatus === "RECONFIRMED" ||
    normalizedStatus === "COMPLETED" ||
    bookingDetails?.reconfirmation === true;

  // Status shown in the header / status card. Surfaces "Cancelled" for a
  // cancelled booking even when confirmationStatus lags behind.
  const displayStatus = isCancelled
    ? bookingDetails?.confirmationStatus &&
      normalizedStatus !== "CANCELLED"
      ? `${bookingDetails.confirmationStatus}/Cancelled`
      : "Cancelled"
    : bookingDetails?.confirmationStatus ||
      bookingDetails?.status ||
      bookingDetails?.bookingStatus ||
      "N/A";

  // ── Cancel ───────────────────────────────────────────────────────────
  const openCancelModal = () => {
    setCancellationReason("");
    setShowCancelModal(true);
  };

  const cancelBooking = async () => {
    if (!customBookingId) return;
    try {
      setCancellingBooking(true);
      const params = cancellationReason.trim()
        ? { reason: cancellationReason.trim() }
        : undefined;
      const response = await axiosInstance.patch(
        `/api/makeYourOwnPackage/cancelCustomBooking/${customBookingId}`,
        null,
        { params }
      );
      if (response.data && response.data.status === "success") {
        setShowCancelModal(false);
        setCancellationReason("");
        toast.success("Booking cancelled");
        await fetchDetails();
      } else {
        toast.error(response.data?.message || "Failed to cancel booking");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to cancel booking.");
    } finally {
      setCancellingBooking(false);
    }
  };

  // ── Reconfirm ──────────────────────────────────────────────────────
  const openConfirmModal = () => setShowConfirmModal(true);

  const confirmBooking = async () => {
    if (!customBookingId) return;
    try {
      setConfirmingBooking(true);
      await axiosInstance.patch(
        `/api/makeYourOwnPackage/${customBookingId}/confirmation-status`,
        { confirmStatus: true }
      );
      setShowConfirmModal(false);
      toast.success("Booking reconfirmed successfully!");
      await fetchDetails();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to reconfirm booking. Please try again."
      );
    } finally {
      setConfirmingBooking(false);
    }
  };

  // ── Reject (Reconfirm popup → "Reject") ────────────────────────────
  const openRejectModal = () => {
    setShowConfirmModal(false);
    setRejectedBy("");
    setRejectedByError("");
    setRejectionRemarks("");
    setShowRejectModal(true);
  };

  const rejectBooking = async () => {
    const rb = (rejectedBy || "").trim();
    if (!rb) {
      setRejectedByError("Rejected By is required");
      return;
    }
    setRejectedByError("");
    try {
      setRejectingBooking(true);
      await axiosInstance.patch(
        `/api/makeYourOwnPackage/${customBookingId}/confirmation-status`,
        {
          action: "REJECT",
          rejectedBy: rb,
          rejectionRemarks: (rejectionRemarks || "").trim() || null,
        }
      );
      setShowRejectModal(false);
      toast.success("Booking rejected.");
      await fetchDetails();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to reject booking. Please try again."
      );
    } finally {
      setRejectingBooking(false);
    }
  };

  // ── Agent Reference (prefill via GET, save via POST) ───────────────
  const openConfirmStatusModal = async () => {
    setConfirmAgentLpo("");
    setConfirmAgentLpoError("");
    setShowConfirmStatusModal(true);
    try {
      const res = await axiosInstance.get(
        `/api/makeYourOwnPackage/${customBookingId}/agent-reference`
      );
      const saved = res?.data?.agentLpo;
      if (saved) setConfirmAgentLpo(saved);
    } catch (err) {
      console.warn("Could not prefill agent reference:", err?.message);
    }
  };

  const updateConfirmationStatus = async () => {
    const lpoTrimmed = (confirmAgentLpo || "").trim();
    if (!lpoTrimmed) {
      setConfirmAgentLpoError("Agent Reference is required");
      return;
    }
    setConfirmAgentLpoError("");
    try {
      setUpdatingConfirmationStatus(true);
      await axiosInstance.post(
        `/api/makeYourOwnPackage/${customBookingId}/agent-reference`,
        { agentLpo: lpoTrimmed }
      );
      setShowConfirmStatusModal(false);
      toast.success("Agent Reference updated successfully");
      await fetchDetails();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to update Agent Reference. Please try again."
      );
    } finally {
      setUpdatingConfirmationStatus(false);
    }
  };

  // ── Confirmation Number (prefill from agent-reference, save via PATCH) ──
  const openConfirmationNoModal = async () => {
    setConfirmationNoInput("");
    setConfirmationNoError("");
    setShowConfirmationNoModal(true);
    try {
      const res = await axiosInstance.get(
        `/api/makeYourOwnPackage/${customBookingId}/agent-reference`
      );
      const saved = res?.data?.confirmationNumber;
      if (saved) setConfirmationNoInput(saved);
    } catch (err) {
      console.warn("Could not prefill confirmation number:", err?.message);
    }
  };

  const saveConfirmationNo = async () => {
    const value = (confirmationNoInput || "").trim();
    if (!value) {
      setConfirmationNoError("Confirmation Number is required");
      return;
    }
    setConfirmationNoError("");
    try {
      setSavingConfirmationNo(true);
      await axiosInstance.patch(
        `/api/makeYourOwnPackage/${customBookingId}/confirmation-status`,
        { action: "CONFIRMATION_NO", confirmationNumber: value }
      );
      setShowConfirmationNoModal(false);
      toast.success("Confirmation number saved successfully!");
      await fetchDetails();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to save confirmation number. Please try again."
      );
    } finally {
      setSavingConfirmationNo(false);
    }
  };

  // ── Booking Remark ─────────────────────────────────────────────────
  const openRemarkModal = () => {
    setRemarkInput(bookingDetails?.remarks || "");
    setShowRemarkModal(true);
  };

  const saveRemark = async () => {
    const text = (remarkInput || "").trim();
    if (!text) {
      toast.error("Remark cannot be empty");
      return;
    }
    try {
      setSavingRemark(true);
      await axiosInstance.post(
        `/api/makeYourOwnPackage/${customBookingId}/remark`,
        { remarks: text }
      );
      setShowRemarkModal(false);
      toast.success("Remark saved successfully");
      await fetchDetails();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to save remark. Please try again."
      );
    } finally {
      setSavingRemark(false);
    }
  };

  // ── Resend Mail to Agent ───────────────────────────────────────────
  const resendMailToAgent = async () => {
    try {
      setResendingMail(true);
      await axiosInstance.post(
        `/api/makeYourOwnPackage/${customBookingId}/resend-mail`
      );
      toast.success("Mail resent to agent successfully!");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to resend mail to agent. Please try again."
      );
    } finally {
      setResendingMail(false);
    }
  };

  // ── PDF preview — Voucher only (custom-booking backend has no Proforma/
  //    Invoice variants). Renders the PDF inside an iframe modal. ──
  const handleDownloadPdf = async (type, label) => {
    if (!customBookingId) return;
    try {
      setGeneratingPdfType(type);
      const res = await axiosInstance.get(
        `/api/makeYourOwnPackage/bookings/${customBookingId}/pdf`,
        { params: { type: type.toUpperCase() } }
      );
      if (res.data && res.data.status === "SUCCESS" && res.data.pdfUrl) {
        setPdfPreview({
          url: res.data.pdfUrl,
          label: label || type,
          type: type.toUpperCase(),
        });
      } else {
        toast.error(
          res.data?.message || `Failed to generate ${label || type}.`
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || `Error generating ${label || type}.`
      );
    } finally {
      setGeneratingPdfType(null);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* Header — Back + title + package code + status (hotel-view style) */}
            <div className="mb-3 d-flex align-items-center flex-wrap gap-2">
              <button
                style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                onClick={() => navigate(-1)}
              >
                ← Back
              </button>
              <span
                style={{
                  marginLeft: "12px",
                  fontWeight: "700",
                  fontSize: "1.1rem",
                  color: "#333",
                }}
              >
                Booking Details
              </span>
              {(bookingDetails?.packageCode || rowStub?.packageCode) && (
                <span
                  style={{
                    color: "#c0392b",
                    fontWeight: "700",
                    fontSize: "0.95rem",
                  }}
                >
                  {bookingDetails?.packageCode || rowStub?.packageCode}
                </span>
              )}
              {bookingDetails && (
                <span style={{ marginLeft: "auto" }}>
                  <StatusBadge status={displayStatus} />
                </span>
              )}
            </div>

            {loadingDetails && !bookingDetails ? (
              <div className="text-center py-5">
                <Spinner animation="border" style={{ color: "#c0392b" }} />
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
                {/* ── Booking Information ─────────────────────────────── */}
                <div style={CARD}>
                  <div style={SECTION_HEADER}>Booking Information</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow
                          label="Package Code"
                          value={bookingDetails.packageCode}
                        />
                        <InfoRow
                          label="Booking Date"
                          value={formatDate(
                            bookingDetails.bookDate ||
                              bookingDetails.bookingDate
                          )}
                        />
                        <InfoRow
                          label="Tour Date"
                          value={formatDate(
                            bookingDetails.tourDate ||
                              bookingDetails.travelDate
                          )}
                        />
                      </Col>
                      <Col md={6}>
                        <InfoRow
                          label="Status"
                          value={<StatusBadge status={displayStatus} />}
                        />
                        <InfoRow
                          label="Selling Price"
                          value={`${parseFloat(
                            bookingDetails.sellingPrice || 0
                          ).toLocaleString()} AED`}
                        />
                        <InfoRow
                          label="Cost"
                          value={`${parseFloat(
                            bookingDetails.totalPrice || 0
                          ).toLocaleString()} AED`}
                        />
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Contact Person ──────────────────────────────────── */}
                {(() => {
                  const guest =
                    bookingDetails.hotelBookingRequest?.[0]?.primaryGuest ||
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
                  const allGuests = [];
                  bookingDetails.hotelBookingRequest?.forEach((hotel) =>
                    hotel.rooms?.forEach((room) =>
                      room.guests?.forEach((g, idx) =>
                        allGuests.push({
                          key: `${room.roomNo}-${idx}`,
                          name: [g.salutation, g.firstName, g.lastName]
                            .filter(Boolean)
                            .join(" "),
                          roomCategory: room.roomCategory,
                        })
                      )
                    )
                  );
                  return (
                    <div style={CARD}>
                      <div style={SECTION_HEADER}>Contact Person</div>
                      <div style={{ padding: "12px 16px" }}>
                        <Row>
                          <Col md={6}>
                            <InfoRow
                              label="Primary Contact"
                              value={
                                [
                                  guest.salutation,
                                  guest.firstName,
                                  guest.lastName,
                                ]
                                  .filter(Boolean)
                                  .join(" ") || "-"
                              }
                            />
                            <InfoRow
                              label="Email Address"
                              value={guest.email || guest.emailId}
                            />
                          </Col>
                          <Col md={6}>
                            <InfoRow
                              label="Phone"
                              value={guest.phone || guest.mobileNumber}
                            />
                            <InfoRow
                              label="Nationality"
                              value={guest.nativeCountry}
                            />
                          </Col>
                        </Row>

                        {/* All Guests Summary */}
                        <div
                          style={{
                            marginTop: "10px",
                            paddingTop: "8px",
                            borderTop: "1px solid #eee",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: "600",
                              color: "#555",
                              marginBottom: "6px",
                            }}
                          >
                            Guest List ({guestCount})
                          </div>
                          {allGuests.length > 0 ? (
                            <Table
                              bordered
                              size="sm"
                              style={{ fontSize: "0.78rem", marginBottom: 0 }}
                            >
                              <thead style={{ backgroundColor: "#f8f8f8" }}>
                                <tr>
                                  <th>#</th>
                                  <th>Name</th>
                                  <th>Room Category</th>
                                </tr>
                              </thead>
                              <tbody>
                                {allGuests.map((g, gi) => (
                                  <tr key={g.key}>
                                    <td>{gi + 1}</td>
                                    <td>{g.name || "-"}</td>
                                    <td>{g.roomCategory || "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          ) : (
                            <span className="text-muted small">
                              No guests listed.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Hotel Reservations ──────────────────────────────── */}
                {bookingDetails.hotelBookingRequest?.length > 0 && (
                  <div style={CARD}>
                    <div style={SECTION_HEADER}>Hotel Reservations</div>
                    <div style={{ padding: "10px 16px" }}>
                      {bookingDetails.hotelBookingRequest.map((hotel, hIdx) => (
                        <div
                          key={hIdx}
                          style={{
                            padding: "10px 0",
                            borderTop: hIdx > 0 ? "1px solid #eee" : "none",
                          }}
                        >
                          <div
                            style={{
                              color: "#c0392b",
                              fontWeight: "700",
                              fontSize: "0.88rem",
                              marginBottom: "6px",
                            }}
                          >
                            {hotel.hotelName || "-"}
                            {hotel.roomStatus && (
                              <span
                                style={{
                                  marginLeft: "8px",
                                  color: "#888",
                                  fontWeight: "500",
                                  fontSize: "0.78rem",
                                }}
                              >
                                ({hotel.roomStatus})
                              </span>
                            )}
                          </div>
                          <Row>
                            <Col md={6}>
                              <InfoRow
                                label="Hotel Address"
                                value={hotel.address}
                              />
                              <InfoRow
                                label="Check-In"
                                value={formatDate(
                                  hotel.checkInDate || hotel.checkIn
                                )}
                              />
                              <InfoRow
                                label="Check-Out"
                                value={formatDate(
                                  hotel.checkOutDate || hotel.checkOut
                                )}
                              />
                            </Col>
                            <Col md={6}>
                              <InfoRow
                                label="No. of Nights"
                                value={
                                  hotel.nights
                                    ? `${hotel.nights} Nights`
                                    : "-"
                                }
                              />
                              <InfoRow
                                label="Star Rating"
                                value={
                                  hotel.starRating
                                    ? `${hotel.starRating} Stars`
                                    : "-"
                                }
                              />
                            </Col>
                          </Row>

                          {hotel.rooms?.length > 0 && (
                            <div style={{ marginTop: "6px" }}>
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  fontWeight: "600",
                                  color: "#555",
                                  marginBottom: "4px",
                                }}
                              >
                                Room Details
                              </div>
                              <Table
                                bordered
                                size="sm"
                                style={{
                                  fontSize: "0.78rem",
                                  marginBottom: "6px",
                                }}
                              >
                                <thead style={{ backgroundColor: "#f8f8f8" }}>
                                  <tr>
                                    <th>Room Category</th>
                                    <th>Meal Plan</th>
                                    <th className="text-center">Pax</th>
                                    <th>Guests</th>
                                    <th className="text-end">Rate</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {hotel.rooms.map((room, rIdx) => (
                                    <tr key={rIdx}>
                                      <td>{room.roomCategory || "-"}</td>
                                      <td>{room.mealPlan || "-"}</td>
                                      <td className="text-center">
                                        {room.adults}A / {room.children}C
                                      </td>
                                      <td>
                                        {room.guests?.map((g, gIdx) => (
                                          <div key={gIdx}>
                                            •{" "}
                                            {[
                                              g.salutation,
                                              g.firstName,
                                              g.lastName,
                                            ]
                                              .filter(Boolean)
                                              .join(" ")}
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
                            <div
                              style={{
                                marginTop: "4px",
                                fontSize: "0.8rem",
                                color: "#333",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  fontWeight: "600",
                                  color: "#555",
                                  marginBottom: "2px",
                                }}
                              >
                                Cancellation Policy
                              </div>
                              <ul
                                style={{
                                  marginBottom: 0,
                                  paddingLeft: "18px",
                                  fontSize: "0.78rem",
                                  color: "#555",
                                }}
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
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Booked Activities ───────────────────────────────── */}
                {bookingDetails.customBookingActivityDTO?.length > 0 && (
                  <div style={CARD}>
                    <div style={SECTION_HEADER}>Booked Activities</div>
                    <div style={{ padding: "10px 16px" }}>
                      <Table
                        bordered
                        size="sm"
                        style={{ fontSize: "0.82rem", marginBottom: 0 }}
                      >
                        <thead style={{ backgroundColor: "#f8f8f8" }}>
                          <tr>
                            <th>Activity Description</th>
                            <th>Tour Date</th>
                            <th>Pax</th>
                            <th className="text-end">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookingDetails.customBookingActivityDTO.map(
                            (act, aIdx) => (
                              <tr key={aIdx}>
                                <td>
                                  {act.activityName ||
                                    act.activityId ||
                                    "Activity Service"}
                                </td>
                                <td>{formatDate(act.tourDate)}</td>
                                <td>
                                  {act.noOfAdult}A / {act.noOfChild}C
                                </td>
                                <td className="text-end">
                                  AED {parseFloat(act.totalPrice).toFixed(2)}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* ── Transfer Details ────────────────────────────────── */}
                {bookingDetails.customBookingCabDTO?.length > 0 && (
                  <div style={CARD}>
                    <div style={SECTION_HEADER}>Transfer Details</div>
                    <div style={{ padding: "10px 16px" }}>
                      <Table
                        bordered
                        size="sm"
                        style={{ fontSize: "0.82rem", marginBottom: 0 }}
                      >
                        <thead style={{ backgroundColor: "#f8f8f8" }}>
                          <tr>
                            <th>Transfer</th>
                            <th>Trip Type</th>
                            <th>Pickup Date</th>
                            <th>Pax</th>
                            <th className="text-end">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookingDetails.customBookingCabDTO.map(
                            (cab, cIdx) => (
                              <tr key={cIdx}>
                                <td>{cab.cabName || "Transfer"}</td>
                                <td>
                                  {cab.travelType === 1
                                    ? "Round Trip"
                                    : "One Way"}
                                </td>
                                <td>{formatDate(cab.pickupDate)}</td>
                                <td>
                                  {cab.noOfAdult}A / {cab.noOfChild}C
                                </td>
                                <td className="text-end">
                                  AED{" "}
                                  {parseFloat(
                                    cab.totalPrice || cab.totalRate
                                  ).toFixed(2)}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* ── Visa Details ────────────────────────────────────── */}
                <div style={CARD}>
                  <div style={SECTION_HEADER}>Visa Details</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow
                          label="Visa Status"
                          value={
                            bookingDetails.visaStatus
                              ? "Required"
                              : "Not Required"
                          }
                        />
                      </Col>
                      {bookingDetails.visaStatus && (
                        <Col md={6}>
                          <InfoRow
                            label="Adults"
                            value={`${bookingDetails.visaAdult} x ${bookingDetails.visaAdultRate}`}
                          />
                          <InfoRow
                            label="Children"
                            value={`${bookingDetails.visaChild} x ${bookingDetails.visaChildRate}`}
                          />
                        </Col>
                      )}
                    </Row>
                  </div>
                </div>

                {/* ── Remarks ─────────────────────────────────────────── */}
                <div style={CARD}>
                  <div style={SECTION_HEADER}>Remarks</div>
                  <div
                    style={{
                      padding: "10px 16px",
                      fontSize: "0.83rem",
                      color: "#333",
                    }}
                  >
                    {bookingDetails.remarks ||
                    bookingDetails.hotelBookingRequest?.[0]?.remarks ? (
                      <p style={{ marginBottom: 0 }}>
                        {bookingDetails.remarks ||
                          bookingDetails.hotelBookingRequest?.[0]?.remarks}
                      </p>
                    ) : (
                      <span className="text-muted">No remarks.</span>
                    )}
                  </div>
                </div>

                {/* ── Action Buttons (mirror LongStayBookingDetailView) ──
                    Live-booking actions (Cancel / Reconfirm) are hidden once
                    the booking is cancelled, while doc + reference actions
                    remain available. Only the VOUCHER doc is shown — the
                    custom-booking backend has no Proforma / Invoice PDF. */}
                <div
                  style={{
                    marginBottom: "10px",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  {!isCancelled && (
                    <button style={BUTTON_STYLE} onClick={openCancelModal}>
                      CANCEL
                    </button>
                  )}

                  {!showsFinalDocs && !isCancelled && (
                    <button style={BUTTON_STYLE} onClick={openConfirmModal}>
                      RECONFIRM
                    </button>
                  )}

                  <button
                    style={BUTTON_STYLE}
                    disabled={generatingPdfType === "VOUCHER"}
                    onClick={() => handleDownloadPdf("VOUCHER", "Voucher")}
                  >
                    {generatingPdfType === "VOUCHER"
                      ? "GENERATING..."
                      : "VOUCHER"}
                  </button>

                  <button
                    style={BUTTON_STYLE}
                    onClick={() => {
                      if (!isConfirmedOrLater) {
                        toast.error(
                          "Agent Reference can only be added once the booking is Confirmed or ReConfirmed."
                        );
                        return;
                      }
                      openConfirmStatusModal();
                    }}
                  >
                    ADD AGENT REFERENCE
                  </button>

                  <button
                    style={BUTTON_STYLE}
                    onClick={() => {
                      if (!isConfirmedOrLater) {
                        toast.error(
                          "Confirmation Number can only be added once the booking is Confirmed or ReConfirmed."
                        );
                        return;
                      }
                      openConfirmationNoModal();
                    }}
                  >
                    CONFIRMATION NO.
                  </button>

                  <button
                    style={BUTTON_STYLE}
                    onClick={resendMailToAgent}
                    disabled={resendingMail}
                  >
                    {resendingMail ? "SENDING..." : "RESEND MAIL TO AGENT"}
                  </button>

                  <button style={BUTTON_STYLE} onClick={openRemarkModal}>
                    BOOKING REMARK
                  </button>

                  <button
                    style={BUTTON_STYLE}
                    onClick={() =>
                      navigate(
                        `/booking-details/custom-booking/${customBookingId}/notes`
                      )
                    }
                  >
                    NOTES
                  </button>

                  <button
                    style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                    onClick={() => window.print()}
                  >
                    PRINT PREVIEW
                  </button>
                </div>

                {/* ── Booking Date footer ───────────────────────────── */}
                <div
                  style={{
                    textAlign: "right",
                    fontSize: "0.8rem",
                    color: "#555",
                    paddingBottom: "8px",
                  }}
                >
                  Booking Date :{" "}
                  {formatDateTime(
                    bookingDetails.bookDate || bookingDetails.bookingDate
                  )}
                </div>
              </>
            )}
          </Container>
        </main>
      </div>

      {/* ── Cancel Booking Modal ──────────────────────────────────────── */}
      <Modal
        show={showCancelModal}
        onHide={() => {
          if (!cancellingBooking) {
            setShowCancelModal(false);
            setCancellationReason("");
          }
        }}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header
          closeButton={!cancellingBooking}
          style={{ backgroundColor: "#fff", borderBottom: "2px solid #e9ecef" }}
        >
          <Modal.Title className="fw-bold d-flex align-items-center">
            <FaExclamationCircle className="me-2 text-danger" />
            <span>Cancel Booking</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          <div className="text-center">
            <p className="fs-5 mb-3">
              Are you sure you want to cancel this booking?
            </p>
            <div className="text-muted small mb-3">
              <div className="fw-bold text-dark">
                {bookingDetails?.packageCode || rowStub?.packageCode || "N/A"}
              </div>
              <div>
                {bookingDetails?.customerName || rowStub?.customerName}
              </div>
            </div>
            <Form.Group controlId="cancellationReason">
              <Form.Label className="fw-semibold">
                Cancellation Reason{" "}
                <span className="text-muted">(optional)</span>
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Add a reason for cancellation (optional)"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                disabled={cancellingBooking}
              />
            </Form.Group>
          </div>
        </Modal.Body>
        <Modal.Footer
          style={{ backgroundColor: "#f8f9fa", borderTop: "1px solid #dee2e6" }}
        >
          <Button
            variant="secondary"
            onClick={() => {
              setShowCancelModal(false);
              setCancellationReason("");
            }}
            disabled={cancellingBooking}
          >
            No
          </Button>
          <Button
            variant="danger"
            onClick={cancelBooking}
            disabled={cancellingBooking}
          >
            {cancellingBooking ? (
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

      {/* ── Reconfirm Booking Modal ───────────────────────────────────── */}
      <Modal
        show={showConfirmModal}
        onHide={() => {
          if (!confirmingBooking) setShowConfirmModal(false);
        }}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header
          closeButton={!confirmingBooking}
          style={{ backgroundColor: "#fff", borderBottom: "2px solid #e9ecef" }}
        >
          <Modal.Title className="fw-bold d-flex align-items-center">
            <FaExclamationCircle className="me-2 text-warning" />
            <span>Reconfirm Booking</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          <div className="text-center">
            <p className="fs-5 mb-3">
              Are you sure you want to reconfirm the booking?
            </p>
            <div className="text-muted small mb-3">
              <div>
                <strong>Package Code:</strong>{" "}
                {bookingDetails?.packageCode || "N/A"}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer
          style={{ backgroundColor: "#f8f9fa", borderTop: "1px solid #dee2e6" }}
        >
          <Button
            variant="danger"
            onClick={openRejectModal}
            disabled={confirmingBooking}
          >
            Reject
          </Button>
          <Button
            variant="success"
            onClick={confirmBooking}
            disabled={confirmingBooking}
          >
            {confirmingBooking ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Confirming...
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Reject Booking Modal ──────────────────────────────────────── */}
      <Modal
        show={showRejectModal}
        onHide={() => {
          if (!rejectingBooking) setShowRejectModal(false);
        }}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header
          closeButton={!rejectingBooking}
          style={{ backgroundColor: "#fff", borderBottom: "2px solid #e9ecef" }}
        >
          <Modal.Title className="fw-bold d-flex align-items-center">
            <FaExclamationCircle className="me-2 text-danger" />
            <span>Reject Booking</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">
              Rejected By <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              value={rejectedBy}
              onChange={(e) => {
                setRejectedBy(e.target.value);
                if (rejectedByError) setRejectedByError("");
              }}
              isInvalid={!!rejectedByError}
              placeholder="Enter name"
              disabled={rejectingBooking}
              autoFocus
            />
            <Form.Control.Feedback type="invalid">
              {rejectedByError}
            </Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="fw-semibold">
              Remarks <span className="text-muted small">(optional)</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={rejectionRemarks}
              onChange={(e) => setRejectionRemarks(e.target.value)}
              placeholder="Reason for rejection"
              disabled={rejectingBooking}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer
          style={{ backgroundColor: "#f8f9fa", borderTop: "1px solid #dee2e6" }}
        >
          <Button
            variant="secondary"
            onClick={() => setShowRejectModal(false)}
            disabled={rejectingBooking}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={rejectBooking}
            disabled={rejectingBooking}
          >
            {rejectingBooking ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Rejecting...
              </>
            ) : (
              "Reject Booking"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Agent Reference Modal ─────────────────────────────────────── */}
      <Modal
        show={showConfirmStatusModal}
        onHide={() => {
          if (!updatingConfirmationStatus) {
            setShowConfirmStatusModal(false);
            setConfirmAgentLpo("");
            setConfirmAgentLpoError("");
          }
        }}
        centered
        backdrop="static"
        keyboard={false}
        size="md"
      >
        <Modal.Header
          closeButton={!updatingConfirmationStatus}
          style={{ backgroundColor: "#fff", borderBottom: "2px solid #e9ecef" }}
        >
          <Modal.Title className="fw-bold d-flex align-items-center">
            <FaExclamationCircle className="me-2 text-warning" />
            <span>Update Agent Reference</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          <div className="text-center">
            <p className="fs-6 mb-3">
              Are you sure you want to update the agent reference?
            </p>
            <div className="text-muted small mb-3">
              <div>
                <strong>Package Code:</strong>{" "}
                {bookingDetails?.packageCode || "N/A"}
              </div>
            </div>
          </div>
          <Form.Group controlId="confirmAgentLpoInput" className="text-start">
            <Form.Label className="fw-semibold mb-1">
              Agent Reference <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter Agent Reference"
              value={confirmAgentLpo}
              onChange={(e) => {
                setConfirmAgentLpo(e.target.value);
                if (confirmAgentLpoError && e.target.value.trim()) {
                  setConfirmAgentLpoError("");
                }
              }}
              isInvalid={!!confirmAgentLpoError}
              disabled={!!updatingConfirmationStatus}
            />
            <Form.Control.Feedback type="invalid">
              {confirmAgentLpoError}
            </Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer
          style={{ backgroundColor: "#f8f9fa", borderTop: "1px solid #dee2e6" }}
        >
          <Button
            variant="secondary"
            onClick={() => {
              setShowConfirmStatusModal(false);
              setConfirmAgentLpo("");
              setConfirmAgentLpoError("");
            }}
            disabled={updatingConfirmationStatus}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={updateConfirmationStatus}
            disabled={updatingConfirmationStatus}
          >
            {updatingConfirmationStatus ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Confirming...
              </>
            ) : (
              "OK"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Confirmation Number Modal ─────────────────────────────────── */}
      <Modal
        show={showConfirmationNoModal}
        onHide={() => {
          if (!savingConfirmationNo) {
            setShowConfirmationNoModal(false);
            setConfirmationNoError("");
          }
        }}
        centered
        backdrop="static"
        keyboard={false}
        size="md"
      >
        <Modal.Header
          closeButton={!savingConfirmationNo}
          style={{ backgroundColor: "#fff", borderBottom: "2px solid #e9ecef" }}
        >
          <Modal.Title className="fw-bold">Confirmation Number</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          <div className="text-muted small mb-3">
            <div>
              <strong>Package Code:</strong>{" "}
              {bookingDetails?.packageCode || "N/A"}
            </div>
          </div>
          <Form.Group controlId="confirmationNoInput">
            <Form.Label className="fw-semibold mb-1">
              Confirmation Number <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter Hotel Confirmation Number"
              value={confirmationNoInput}
              onChange={(e) => {
                setConfirmationNoInput(e.target.value);
                if (confirmationNoError && e.target.value.trim()) {
                  setConfirmationNoError("");
                }
              }}
              isInvalid={!!confirmationNoError}
              disabled={savingConfirmationNo}
            />
            <Form.Control.Feedback type="invalid">
              {confirmationNoError}
            </Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer
          style={{ backgroundColor: "#f8f9fa", borderTop: "1px solid #dee2e6" }}
        >
          <Button
            variant="secondary"
            onClick={() => {
              setShowConfirmationNoModal(false);
              setConfirmationNoError("");
            }}
            disabled={savingConfirmationNo}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={saveConfirmationNo}
            disabled={savingConfirmationNo}
          >
            {savingConfirmationNo ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Booking Remark Modal ──────────────────────────────────────── */}
      <Modal
        show={showRemarkModal}
        onHide={() => {
          if (!savingRemark) setShowRemarkModal(false);
        }}
        centered
        backdrop="static"
        keyboard={false}
        size="md"
      >
        <Modal.Header
          closeButton={!savingRemark}
          style={{ backgroundColor: "#fff", borderBottom: "2px solid #e9ecef" }}
        >
          <Modal.Title className="fw-bold">Booking Remark</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          <Form.Group controlId="bookingRemarkInput">
            <Form.Label className="fw-semibold mb-1">Remark</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              placeholder="Enter remark for this booking"
              value={remarkInput}
              onChange={(e) => setRemarkInput(e.target.value)}
              disabled={savingRemark}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer
          style={{ backgroundColor: "#f8f9fa", borderTop: "1px solid #dee2e6" }}
        >
          <Button
            variant="secondary"
            onClick={() => setShowRemarkModal(false)}
            disabled={savingRemark}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={saveRemark}
            disabled={savingRemark}
          >
            {savingRemark ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── PDF Preview Modal ───────────────────────────────────────── */}
      <Modal
        show={!!pdfPreview}
        onHide={() => setPdfPreview(null)}
        size="xl"
        centered
        backdrop="static"
        keyboard
      >
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "1rem", fontWeight: 700 }}>
            {pdfPreview?.label || "Document"}
            {bookingDetails?.packageCode
              ? ` — ${bookingDetails.packageCode}`
              : ""}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0, height: "80vh" }}>
          {pdfPreview?.url ? (
            <iframe
              key={pdfPreview.url}
              src={pdfPreview.url}
              title={pdfPreview.label || "PDF preview"}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
              }}
            />
          ) : (
            <div className="text-center text-muted py-5">No PDF loaded.</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {pdfPreview?.url && (
            <>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() =>
                  window.open(pdfPreview.url, "_blank", "noopener,noreferrer")
                }
              >
                Open in new tab
              </Button>
              <Button
                variant="outline-primary"
                size="sm"
                as="a"
                href={pdfPreview.url}
                download={`CustomBooking_${customBookingId}_${
                  pdfPreview.type || "document"
                }.pdf`}
              >
                Download
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPdfPreview(null)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
