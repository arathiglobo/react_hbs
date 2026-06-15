import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Spinner,
  Table,
  Modal,
  Button,
  Form,
} from "react-bootstrap";
import { FaExclamationCircle } from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import toast from "react-hot-toast";

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

const parseLocal = (str) => {
  if (!str) return null;
  const normalized = str.includes("T") ? str : `${str}T00:00:00`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
};

const formatDate = (dateStr) => {
  const d = parseLocal(dateStr);
  if (!d) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day} ${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
};

const formatDateTime = (dateStr) => {
  const d = parseLocal(dateStr);
  if (!d) return "-";
  const hrs = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${formatDate(dateStr)} ${hrs}:${min}:${sec}`;
};

const StatusBadge = ({ status }) => {
  const s = (status || "").toUpperCase();
  let color = "#888";
  if (s === "CONFIRMED" || s === "RECONFIRMED") color = "#c0392b";
  else if (s === "CANCELLED") color = "#888";
  else if (s === "ON REQUEST") color = "#e67e22";
  return (
    <span style={{ color, fontWeight: "700", fontSize: "0.85rem" }}>
      {status || "-"}
    </span>
  );
};

export default function BookingDetailedView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  // Role gate for admin-only actions (currently: "Send Email" on the
  // PDF preview modal). Matches the convention used on HotelBookingPage.
  const activeUserRole = localStorage.getItem("currentActiveRole");
  const isAdmin = String(activeUserRole || "").toUpperCase() === "ADMIN";

  // ── Action-button modal / handler state (ported from HotelBookingList) ──
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

  // Update Book Status (PATCH confirmation-status with Agent LPO)
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

  // Send Document Email — generic modal used by Voucher / Invoice
  // / Proforma buttons to email the document to a custom address.
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [sendEmailDocType, setSendEmailDocType] = useState(null); // VOUCHER | PROFORMA_VOUCHER | INVOICE | PROFORMA_INVOICE
  const [sendEmailDocLabel, setSendEmailDocLabel] = useState("");
  const [sendEmailRecipient, setSendEmailRecipient] = useState("");
  const [sendEmailNote, setSendEmailNote] = useState("");
  const [sendEmailError, setSendEmailError] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // PDF generation feedback
  const [generatingPdfType, setGeneratingPdfType] = useState(null);
  // In-page PDF preview state. When non-null, the modal at the bottom of
  // the page renders the PDF in an iframe instead of triggering a
  // download. Shape: { url: string, label: string, type: string }.
  const [pdfPreview, setPdfPreview] = useState(null);

  const fetchBooking = useCallback(() => {
    if (!id) return;
    setLoading(true);
    return axiosInstance
      .get(`/api/hotel-booking/${id}`)
      .then((res) => {
        if (res.data?.success) {
          setBooking(res.data);
        } else {
          toast.error(res.data?.message || "Failed to load booking details");
        }
      })
      .catch(() => toast.error("Error loading booking details"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  // ── Status helpers ─────────────────────────────────────────────────
  const normalizedStatus = String(booking?.confirmationStatus || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const isReconfirmed = normalizedStatus === "RECONFIRMED";
  const isCancelled = normalizedStatus === "CANCELLED";
  // Agent Reference and Confirmation Number can only be SAVED once the
  // booking is confirmed-or-better; before that the booking is still
  // tentative and these fields don't apply yet.
  const isConfirmedOrLater =
    normalizedStatus === "CONFIRMED" ||
    normalizedStatus === "RECONFIRMED" ||
    normalizedStatus === "COMPLETED";
  // Voucher / Invoice (vs Proforma equivalents) become available the
  // moment the supplier confirms the booking — Confirmed is the same UX
  // as ReConfirmed here. Cancelled bookings also keep the final-doc
  // buttons (handled separately by the isCancelled branch).
  const showsFinalDocs = isReconfirmed || normalizedStatus === "CONFIRMED";
  // const isCancellationAllowed =
  //   String(booking?.refundStatus || "").toLowerCase() !== "non-refundable";

  // ── Action handlers (ported from HotelBookingList.jsx) ─────────────
  // Cancel
  const openCancelModal = () => {
    setCancellationReason("");
    setShowCancelModal(true);
  };

  const cancelBooking = async () => {
    try {
      setCancellingBooking(true);
      const params = cancellationReason.trim()
        ? { reason: cancellationReason.trim() }
        : undefined;
      const response = await axiosInstance.delete(
        `/api/hotel-booking/${id}/cancel`,
        { params }
      );
      if (
        response.data &&
        response.data.success &&
        response.data.confirmationStatus === "Cancelled"
      ) {
        setShowCancelModal(false);
        setCancellationReason("");
        toast.success(response.data.message || "Booking cancelled");
        await fetchBooking();
      } else {
        toast.error(response.data?.message || "Failed to cancel booking.");
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error(
        error.response?.data?.message || "Failed to cancel booking."
      );
    } finally {
      setCancellingBooking(false);
    }
  };

  // Reconfirm
  const openConfirmModal = () => setShowConfirmModal(true);

  const confirmBooking = async () => {
    try {
      setConfirmingBooking(true);
      // RECONFIRM calls the same backend mutation that the existing
      // "Confirm Booking Status" flow uses on the list page —
      // PATCH /api/booking-confirmation/{id}/confirmation-status with
      // { confirmStatus: true }. The backend's
      // BookingConfirmationServiceImpl.updateConfirmationStatus sets
      // confirmationStatus = "ReConfirmed" and reconfirmation = true.
      // AgentLPO is optional there ("skip customer update" branch), so
      // we don't need to collect it for plain RECONFIRM — only the
      // UPDATE BOOK STATUS modal asks for an LPO.
      //
      // The previous PUT /api/hotel-booking/confirm/{id} path has no
      // controller binding and 404s, hence this switch.
      const response = await axiosInstance.patch(
        `/api/booking-confirmation/${id}/confirmation-status`,
        { action: "CONFIRM", confirmStatus: true }
      );
      if (response.data && response.data.success === true) {
        setShowConfirmModal(false);
        toast.success(
          response.data.message || "Booking reconfirmed successfully!"
        );
        await fetchBooking();
      } else {
        toast.error(response.data?.message || "Failed to reconfirm booking.");
      }
    } catch (error) {
      console.error("Error reconfirming booking:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to reconfirm booking. Please try again."
      );
    } finally {
      setConfirmingBooking(false);
    }
  };

  // Reject flow: Reconfirm popup → "Reject" → opens this modal
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
      const response = await axiosInstance.patch(
        `/api/booking-confirmation/${id}/confirmation-status`,
        {
          action: "REJECT",
          rejectedBy: rb,
          rejectionRemarks: (rejectionRemarks || "").trim() || null,
        }
      );
      if (response.data && response.data.success === true) {
        setShowRejectModal(false);
        toast.success(response.data.message || "Booking rejected.");
        await fetchBooking();
      } else {
        toast.error(response.data?.message || "Failed to reject booking.");
      }
    } catch (error) {
      console.error("Error rejecting booking:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to reject booking. Please try again."
      );
    } finally {
      setRejectingBooking(false);
    }
  };

  // Agent Reference modal — uses dedicated endpoint POST
  // /api/booking-customer/{id}/agent-reference. On open, fetches the
  // currently saved value so the user can see and edit it.
  const openConfirmStatusModal = async () => {
    setConfirmAgentLpo("");
    setConfirmAgentLpoError("");
    setShowConfirmStatusModal(true);
    try {
      const res = await axiosInstance.get(
        `/api/booking-customer/${id}/agent-reference`
      );
      const saved = res?.data?.agentLpo;
      if (saved) setConfirmAgentLpo(saved);
    } catch (err) {
      // Non-fatal: modal still opens; user can type a new value.
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
      const response = await axiosInstance.post(
        `/api/booking-customer/${id}/agent-reference`,
        { agentLpo: lpoTrimmed }
      );
      if (response.data && response.data.success) {
        setShowConfirmStatusModal(false);
        toast.success(
          response.data.message || "Agent Reference updated successfully"
        );
        await fetchBooking();
      } else {
        toast.error(
          response.data?.message || "Failed to update Agent Reference."
        );
      }
    } catch (error) {
      console.error("Error updating Agent Reference:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to update Agent Reference. Please try again."
      );
    } finally {
      setUpdatingConfirmationStatus(false);
    }
  };

  // Confirmation Number (reuses the same PATCH endpoint with a confirmationNumber field)
  const openConfirmationNoModal = async () => {
    setConfirmationNoInput("");
    setConfirmationNoError("");
    setShowConfirmationNoModal(true);
    // Pre-fill with the value already saved against this booking. The
    // backend booking-detail response carries the latest confirmationNumber
    // (also exposed via /api/booking-customer/{id}/agent-reference), so we
    // hit that endpoint to stay consistent with the Agent Reference flow.
    try {
      const res = await axiosInstance.get(
        `/api/booking-customer/${id}/agent-reference`
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
      const response = await axiosInstance.patch(
        `/api/booking-confirmation/${id}/confirmation-status`,
        { action: "CONFIRMATION_NO", confirmationNumber: value }
      );
      if (response.data && response.data.success) {
        setShowConfirmationNoModal(false);
        toast.success(
          response.data.message || "Confirmation number saved successfully!"
        );
        await fetchBooking();
      } else {
        toast.error(
          response.data?.message || "Failed to save confirmation number."
        );
      }
    } catch (error) {
      console.error("Error saving confirmation number:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to save confirmation number. Please try again."
      );
    } finally {
      setSavingConfirmationNo(false);
    }
  };

  // Booking Remark (persisted as a booking note)
  const openRemarkModal = () => {
    setRemarkInput(booking?.remarks || "");
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
      // Save to HotelBooking.remarks (what the detail page's Remarks
      // section reads, and what the voucher template renders). The
      // separate /notes endpoint persists ad-hoc Related Notes which
      // are different from the Booking Remark.
      const response = await axiosInstance.post(
        `/api/hotel-booking/${id}/remark`,
        { remarks: text }
      );
      if (response.data && response.data.success !== false) {
        setShowRemarkModal(false);
        toast.success(response.data?.message || "Remark saved successfully");
        await fetchBooking();
      } else {
        toast.error(response.data?.message || "Failed to save remark.");
      }
    } catch (error) {
      console.error("Error saving remark:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to save remark. Please try again."
      );
    } finally {
      setSavingRemark(false);
    }
  };

  // Resend Mail to Agent
  const resendMailToAgent = async () => {
    try {
      setResendingMail(true);
      const response = await axiosInstance.post(
        `/api/hotel-booking/${id}/resend-mail`
      );
      if (response.data && response.data.success !== false) {
        toast.success(
          response.data?.message || "Mail resent to agent successfully!"
        );
      } else {
        toast.error(response.data?.message || "Failed to resend mail.");
      }
    } catch (error) {
      console.error("Error resending mail to agent:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to resend mail to agent. Please try again."
      );
    } finally {
      setResendingMail(false);
    }
  };

  // Send Document Email handlers
  const openSendEmailModal = (docType, label) => {
    setSendEmailDocType(docType);
    setSendEmailDocLabel(label);
    setSendEmailRecipient("");
    setSendEmailNote("");
    setSendEmailError("");
    setShowSendEmailModal(true);
  };

  const sendDocumentEmail = async () => {
    const email = (sendEmailRecipient || "").trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setSendEmailError("Email is required");
      return;
    }
    if (!emailRegex.test(email)) {
      setSendEmailError("Enter a valid email address");
      return;
    }
    setSendEmailError("");
    try {
      setSendingEmail(true);
      const response = await axiosInstance.post(
        `/api/booking-document-email/${id}`,
        {
          email,
          docType: sendEmailDocType,
          note: (sendEmailNote || "").trim() || null,
        }
      );
      if (response.data && response.data.success === true) {
        toast.success(
          response.data.message || `${sendEmailDocLabel} sent to ${email}`
        );
        setShowSendEmailModal(false);
      } else {
        toast.error(response.data?.message || "Failed to send document.");
      }
    } catch (error) {
      console.error("Error sending document email:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to send document. Please try again."
      );
    } finally {
      setSendingEmail(false);
    }
  };

  // PDF preview — shared gateway. Used for Proforma Voucher / Proforma
  // Invoice / Voucher / Invoice. `type` matches the backend enum.
  // Per spec the PDF must render INSIDE this page (iframe modal) — not
  // as a download and not in a new tab. We pop a Bootstrap Modal with
  // a full-height <iframe src={pdfUrl}>, and offer an explicit
  // "Open in new tab" / "Download" affordance inside the modal for
  // users who still need it.
  const handleDownloadPdf = async (type, label) => {
    try {
      setGeneratingPdfType(type);
      const response = await axiosInstance.get(`/api/bookings/${id}/pdf`, {
        params: { type: type.toUpperCase() },
      });
      if (
        response.data &&
        response.data.status === "SUCCESS" &&
        response.data.pdfUrl
      ) {
        setPdfPreview({
          url: response.data.pdfUrl,
          label: label || type,
          type: type.toUpperCase(),
        });
      } else {
        toast.error(
          response.data?.message || `Failed to generate ${label || type}.`
        );
      }
    } catch (error) {
      console.error(`Error generating ${type} PDF:`, error);
      toast.error(
        error.response?.data?.message ||
          `Error generating ${label || type}.`
      );
    } finally {
      setGeneratingPdfType(null);
    }
  };

  const totalRooms = booking?.rooms?.length ?? 0;
  const totalAdults = booking?.rooms?.reduce((s, r) => s + (r.adults || 0), 0) ?? 0;
  const totalChildren = booking?.rooms?.reduce((s, r) => s + (r.children || 0), 0) ?? 0;
  const totalGuests = totalAdults + totalChildren;

  const card = {
    border: "1px solid #ddd",
    borderRadius: "4px",
    marginBottom: "14px",
    overflow: "hidden",
    backgroundColor: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* Back button */}
            <div className="mb-3">
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
            </div>

            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" style={{ color: "#c0392b" }} />
                <p className="mt-3 text-muted">Loading booking details...</p>
              </div>
            ) : !booking ? (
              <div className="text-center py-5 text-muted">
                Booking not found.
              </div>
            ) : (
              <>
                {/* ── 24-Hour Check-In highlight banner ────────────────
                     Surfaced above Booking Information so the operator
                     spots the special-flow status at a glance, with the
                     chosen times when present. Hidden entirely when the
                     booking is a normal stay. */}
                {booking.is24HourCheckin && (
                  <div
                    style={{
                      backgroundColor: "#fff8e1",
                      border: "1px solid #f5c518",
                      borderLeft: "6px solid #f5c518",
                      borderRadius: 4,
                      padding: "8px 12px",
                      marginBottom: 10,
                      fontSize: "0.85rem",
                      color: "#5b4500",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: "#f5c518",
                        color: "#000",
                        fontWeight: 700,
                        fontSize: "0.7rem",
                        padding: "2px 8px",
                        borderRadius: 3,
                        letterSpacing: 0.5,
                      }}
                    >
                      24-HOUR CHECK-IN
                    </span>
                    <span>
                      This booking was made via the 24-hour check-in flow.
                      {booking.checkInTime && (
                        <> Check-In: <strong>{booking.checkInTime}</strong></>
                      )}
                      {booking.checkOutTime && (
                        <> · Check-Out: <strong>{booking.checkOutTime}</strong></>
                      )}
                    </span>
                  </div>
                )}

                {/* ── Booking Info ─────────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>
                    Booking Information
                    {booking.is24HourCheckin && (
                      <span
                        style={{
                          marginLeft: 8,
                          backgroundColor: "#f5c518",
                          color: "#000",
                          fontWeight: 700,
                          fontSize: "0.65rem",
                          padding: "2px 6px",
                          borderRadius: 3,
                        }}
                      >
                        24H
                      </span>
                    )}
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow label="Booking Code" value={booking.bookingCode} />
                        <InfoRow label="Reference No." value={booking.referenceNumber} />
                        <InfoRow label="Hotel Name" value={booking.hotelName} />
                        <InfoRow label="Address" value={booking.address} />
                        <InfoRow label="Star Rating" value={booking.starRating ? `${booking.starRating} Star` : "-"} />
                        <InfoRow label="Check-In" value={formatDateTime(booking.checkInDate)} />
                        <InfoRow label="Check-Out" value={formatDateTime(booking.checkOutDate)} />
                        <InfoRow label="No. of Nights" value={booking.nights ? `${booking.nights} Nights` : "-"} />
                      </Col>
                      <Col md={6}>
                        <InfoRow label="Agent" value={booking.agentName} />
                        {/* <InfoRow label="Source" value={booking.source} />
                        <InfoRow label="Created By" value={booking.createdByRole} /> */}
                        {/* "Booking Done By Employee" picked in
                            HotelSearch — only rendered when an employee
                            was actually selected so unrelated bookings
                            don't show a stray dash row. */}
                        {booking.employeeName && (
                          <InfoRow
                            label="Booked By Employee"
                            value={booking.employeeName}
                          />
                        )}
                        <InfoRow label="Supplier Ref." value={booking.supplierReference} />
                        <InfoRow label="Deadline Date"   value={booking.deadlineDate? booking.deadlineDate.replace("T", " "): "-"} />
                        <InfoRow label="Refund Status" value={booking.refundStatus} />
                        <InfoRow label="Voucher" value={booking.voucherGenerated} />
                        <InfoRow
                          label="Status"
                          value={<StatusBadge status={booking.confirmationStatus} />}
                        />
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Guest / Customer Info ─────────────────────────── */}
                {booking.customer && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>Guest Information</div>
                    <div style={{ padding: "12px 16px" }}>
                      <Row>
                        <Col md={6}>
                          <InfoRow
                            label="Guest Name"
                            value={[
                              booking.customer.salutation,
                              booking.customer.firstName,
                              booking.customer.middleName,
                              booking.customer.lastName,
                            ]
                              .filter(Boolean)
                              .join(" ") || "-"}
                          />
                          {/* <InfoRow label="Email" value={booking.customer.email} />
                          <InfoRow label="Phone" value={booking.customer.phone} /> */}
                        </Col>
                        <Col md={6}>
                          {/* <InfoRow label="Passport No." value={booking.customer.passportNo} /> */}
                          <InfoRow label="Nationality" value={booking.customer.customerNationality} />
                          {/* <InfoRow label="Agent LPO" value={booking.customer.agentLpo} /> */}
                        </Col>
                      </Row>
                    </div>
                  </div>
                )}

                {/* ── Rooms Details ─────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Rooms Details</div>
                  <div style={{ padding: "10px 16px 4px" }}>
                    <span style={{ color: "#c0392b", fontWeight: "600", fontSize: "0.85rem", marginRight: "20px" }}>
                      No of Rooms - {totalRooms} Room{totalRooms !== 1 ? "s" : ""}
                    </span>
                    <span style={{ color: "#c0392b", fontWeight: "600", fontSize: "0.85rem" }}>
                      No of Guests - {totalAdults} Adult{totalAdults !== 1 ? "s" : ""}
                      {totalChildren > 0 ? `, ${totalChildren} Child${totalChildren !== 1 ? "ren" : ""}` : ""}
                    </span>
                  </div>

                  {(booking.rooms || []).map((room, idx) => (
                    <div key={room.roomBookingId || idx} style={{ padding: "8px 16px 12px" }}>
                      <div
                        style={{
                          color: "#c0392b",
                          fontWeight: "700",
                          fontSize: "0.88rem",
                          marginBottom: "6px",
                        }}
                      >
                        Room {room.roomNo ?? idx + 1} -{" "}
                        <StatusBadge status={booking.confirmationStatus} />
                      </div>
                      {/* Per-room Rate cell already shows the room's
                          billable rate. Per spec the Tourism Dirham
                          captured on the booking now flows into Rate and
                          Total Rate so the operator sees the FULL amount
                          the customer pays. TD is shared across the
                          booking, so we distribute it evenly across
                          rooms (rounded to 2 dp) for the per-row Rate
                          column — the totals row below still uses the
                          single, untouched booking-level TD value. */}
                      {(() => {
                        const roomCount = Array.isArray(booking.rooms)
                          ? booking.rooms.length
                          : 1;
                        const td = Number(booking.tourismDirham) || 0;
                        const tdShare = roomCount > 0 ? td / roomCount : 0;
                        const baseRate = Number(room.rate) || 0;
                        const rateWithTd = baseRate + tdShare;
                        return (
                          <Table
                            bordered
                            size="sm"
                            style={{ fontSize: "0.82rem", marginBottom: "6px" }}
                          >
                            <thead style={{ backgroundColor: "#f8f8f8" }}>
                              <tr>
                                <th>Room Category</th>
                                <th>Meal Type</th>
                                <th>Supplier Ref.</th>
                                <th>Hotel Conf No.</th>
                                <th>Adults</th>
                                <th>Children</th>
                                <th>Rate</th>
                                <th>Currency</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>{room.roomCategory || "-"}</td>
                                <td>{room.mealPlan || "-"}</td>
                                <td>{booking.supplierReference || "-"}</td>
                                <td>{booking.referenceNumber || "-"}</td>
                                <td>{room.adults ?? "-"}</td>
                                <td>{room.children ?? "0"}</td>
                                <td>
                                  {room.rate != null
                                    ? rateWithTd.toFixed(2)
                                    : "-"}
                                  {td > 0 && room.rate != null && (
                                    <div
                                      style={{
                                        fontSize: "0.68rem",
                                        color: "#888",
                                        fontWeight: 500,
                                        marginTop: 2,
                                      }}
                                    >
                                      ({baseRate.toFixed(2)} + TD{" "}
                                      {tdShare.toFixed(2)})
                                    </div>
                                  )}
                                </td>
                                <td>{room.currency || "-"}</td>
                              </tr>
                            </tbody>
                          </Table>
                        );
                      })()}

                      {/* Room guests */}
                      {room.guests && room.guests.length > 0 && (
                        <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                          <div style={{ fontSize: "0.78rem", fontWeight: "600", color: "#555", marginBottom: "4px" }}>
                            Room Guests:
                          </div>
                          <Table bordered size="sm" style={{ fontSize: "0.78rem" }}>
                            <thead style={{ backgroundColor: "#f8f8f8" }}>
                              <tr>
                                <th>#</th>
                                <th>Name</th>
                                <th>Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {room.guests.map((g, gi) => (
                                <tr key={g.guestId || gi}>
                                  <td>{gi + 1}</td>
                                  <td>
                                    {[g.salutation, g.firstName, g.lastName]
                                      .filter(Boolean)
                                      .join(" ") || "-"}
                                  </td>
                                  <td>{g.isChild ? `Child (Age: ${g.childAge ?? "-"})` : "Adult"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Summary row */}
                  <div
                    style={{
                      padding: "8px 16px",
                      borderTop: "1px solid #eee",
                      fontSize: "0.85rem",
                      display: "flex",
                      gap: "24px",
                      color: "#333",
                    }}
                  >
                    {/* Total Rate now includes Tourism Dirham so the
                        amount shown here matches what's billed. The
                        original (pre-TD) total is retained as a small
                        hint underneath whenever TD > 0. */}
                    {(() => {
                      const baseTotal = Number(booking.totalRate) || 0;
                      const td = Number(booking.tourismDirham) || 0;
                      const grand = baseTotal + td;
                      return (
                        <span>
                          <span style={{ fontWeight: "600" }}>Total Rate: </span>
                          {booking.totalRate != null
                            ? grand.toFixed(2)
                            : "-"}
                          {td > 0 && booking.totalRate != null && (
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: "0.72rem",
                                color: "#888",
                              }}
                            >
                              ({baseTotal.toFixed(2)} + TD {td.toFixed(2)})
                            </span>
                          )}
                        </span>
                      );
                    })()}
                    <span>
                      <span style={{ fontWeight: "600" }}>Refund Type: </span>
                      {booking.refundStatus || "-"}
                    </span>
                  </div>
                </div>

                {/* ── Sub-Bookings (created via Edit) ────────────────── */}
                {booking.subBookings && booking.subBookings.length > 0 && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>
                      Related Sub-Bookings ({booking.subBookings.length})
                    </div>
                    <div style={{ padding: "10px 16px" }}>
                      {booking.subBookings.map((sub) => {
                        const subRooms = sub.rooms?.length ?? 0;
                        const subAdults =
                          sub.rooms?.reduce((s, r) => s + (r.adults || 0), 0) ?? 0;
                        const subChildren =
                          sub.rooms?.reduce((s, r) => s + (r.children || 0), 0) ?? 0;
                        return (
                          <div
                            key={sub.bookingId}
                            style={{
                              borderTop: "1px solid #eee",
                              padding: "10px 0",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "6px",
                              }}
                            >
                              <span
                                style={{
                                  color: "#c0392b",
                                  fontWeight: "700",
                                  fontSize: "0.9rem",
                                }}
                              >
                                {sub.bookingCode || "-"}
                                {sub.childBookingIndex != null && (
                                  <span
                                    style={{
                                      marginLeft: "8px",
                                      color: "#888",
                                      fontWeight: "500",
                                      fontSize: "0.8rem",
                                    }}
                                  >
                                    (Edit #{sub.childBookingIndex})
                                  </span>
                                )}
                              </span>
                              <button
                                style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                                onClick={() =>
                                  navigate(
                                    `/booking-details/hotel-booking/${sub.bookingId}`
                                  )
                                }
                              >
                                View
                              </button>
                            </div>
                            <Row>
                              <Col md={6}>
                                <InfoRow label="Reference No." value={sub.referenceNumber} />
                                <InfoRow label="Hotel" value={sub.hotelName} />
                                <InfoRow
                                  label="Check-In"
                                  value={formatDateTime(sub.checkInDate)}
                                />
                                <InfoRow
                                  label="Check-Out"
                                  value={formatDateTime(sub.checkOutDate)}
                                />
                              </Col>
                              <Col md={6}>
                                <InfoRow
                                  label="Rooms / Guests"
                                  value={`${subRooms} Room${
                                    subRooms !== 1 ? "s" : ""
                                  }, ${subAdults} Adult${
                                    subAdults !== 1 ? "s" : ""
                                  }${
                                    subChildren > 0
                                      ? `, ${subChildren} Child${
                                          subChildren !== 1 ? "ren" : ""
                                        }`
                                      : ""
                                  }`}
                                />
                                <InfoRow
                                  label="Total Rate"
                                  value={
                                    sub.totalRate != null
                                      ? Number(sub.totalRate).toFixed(2)
                                      : "-"
                                  }
                                />
                                <InfoRow
                                  label="Status"
                                  value={
                                    <StatusBadge status={sub.confirmationStatus} />
                                  }
                                />
                                <InfoRow
                                  label="Booking Date"
                                  value={formatDateTime(sub.bookingDate)}
                                />
                              </Col>
                            </Row>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Cancellation Policy ───────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>
                    Cancellation Policy{" "}
                    <span style={{ fontSize: "1rem", color: "#555" }}>⊟</span>
                  </div>
                  <div style={{ padding: "10px 16px", fontSize: "0.83rem", color: "#333" }}>
                    {booking.cancellationPolicies && booking.cancellationPolicies.length > 0 ? (
                      booking.cancellationPolicies.map((p, i) => (
                        <p key={i} style={{ marginBottom: "4px" }}>
                          {p}
                        </p>
                      ))
                    ) : (
                      <span className="text-muted">No cancellation policy available.</span>
                    )}
                  </div>
                </div>

                {/* ── Remarks ───────────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>
                    Remarks{" "}
                    <span style={{ fontSize: "1rem", color: "#555" }}>⊟</span>
                  </div>
                  <div style={{ padding: "10px 16px", fontSize: "0.83rem", color: "#333" }}>
                    {booking.remarks ? (
                      <p style={{ marginBottom: 0 }}>{booking.remarks}</p>
                    ) : (
                      <span className="text-muted">No remarks.</span>
                    )}
                  </div>
                </div>

                {/* ── Special Requests ──────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>
                    Special Request{" "}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: "1.5px solid #555",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        color: "#555",
                      }}
                    >
                      +
                    </span>
                  </div>
                  <div style={{ padding: "10px 16px", fontSize: "0.83rem", color: "#333" }}>
                    {booking.specialRequests && booking.specialRequests.length > 0 ? (
                      <ul style={{ marginBottom: 0, paddingLeft: "18px" }}>
                        {booking.specialRequests.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">No special requests.</span>
                    )}
                  </div>
                </div>

                {/* ── Action Buttons ──────────────────────────────────
                    All booking-level actions live here. Buttons reflow on
                    smaller screens via flex-wrap. The PROFORMA vs FINAL
                    pair flips off `isReconfirmed` so the operator only
                    sees the relevant pair for the current booking
                    lifecycle stage.
                    Whole row hidden when the booking is already
                    cancelled — no action makes sense on a CANCELLED
                    record (ADD NEW ITEM / NOTES / etc. all assume a
                    live booking). Per-button !isCancelled checks below
                    are now redundant but left in place for safety in
                    case this wrapper is ever removed. */}
                {isCancelled && (
                  <div
                    style={{
                      marginBottom: "10px",
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      style={BUTTON_STYLE}
                      disabled={generatingPdfType === "VOUCHER"}
                      onClick={() => handleDownloadPdf("VOUCHER", "Voucher")}
                    >
                      {generatingPdfType === "VOUCHER" ? "GENERATING..." : "VOUCHER"}
                    </button>
                    <button
                      style={BUTTON_STYLE}
                      disabled={generatingPdfType === "COMPLETED"}
                      onClick={() => handleDownloadPdf("COMPLETED", "Invoice")}
                    >
                      {generatingPdfType === "COMPLETED" ? "GENERATING..." : "INVOICE"}
                    </button>
                    <button
                      style={BUTTON_STYLE}
                      onClick={resendMailToAgent}
                      disabled={resendingMail}
                    >
                      {resendingMail ? "SENDING..." : "RESEND MAIL TO AGENT"}
                    </button>
                  </div>
                )}
                {!isCancelled && (
                <div
                  style={{
                    marginBottom: "10px",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    style={BUTTON_STYLE}
                    onClick={() => {
                      const parent =
                        booking.parentBookingCode || booking.bookingCode;
                      navigate(
                        `/new-booking/hotel?parentBookingCode=${encodeURIComponent(
                          parent
                        )}`
                      );
                    }}
                  >
                    ADD NEW ITEM
                  </button>

                  {/* {!isCancelled && isCancellationAllowed && ( */}
                  {!isCancelled &&  (
                    <button style={BUTTON_STYLE} onClick={openCancelModal}>
                      CANCEL
                    </button>
                  )}

                  {!showsFinalDocs && !isCancelled && (
                    <button style={BUTTON_STYLE} onClick={openConfirmModal}>
                      RECONFIRM
                    </button>
                  )}

                  {!showsFinalDocs && !isCancelled && (
                    <>
                      <button
                        style={BUTTON_STYLE}
                        disabled={generatingPdfType === "PROFORMA_VOUCHER"}
                        onClick={() =>
                          handleDownloadPdf("PROFORMA_VOUCHER", "Proforma Voucher")
                        }
                      >
                        {generatingPdfType === "PROFORMA_VOUCHER"
                          ? "GENERATING..."
                          : "PROFORMA VOUCHER"}
                      </button>
                      <button
                        style={BUTTON_STYLE}
                        disabled={generatingPdfType === "PROFORMA_INVOICE"}
                        onClick={() =>
                          handleDownloadPdf("PROFORMA_INVOICE", "Proforma Invoice")
                        }
                      >
                        {generatingPdfType === "PROFORMA_INVOICE"
                          ? "GENERATING..."
                          : "PROFORMA INVOICE"}
                      </button>
                    </>
                  )}

                  {showsFinalDocs && !isCancelled && (
                    <>
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
                        disabled={generatingPdfType === "COMPLETED"}
                        onClick={() =>
                          handleDownloadPdf("COMPLETED", "Invoice")
                        }
                      >
                        {generatingPdfType === "COMPLETED"
                          ? "GENERATING..."
                          : "INVOICE"}
                      </button>
                    </>
                  )}

                  {!isCancelled && (
                    <button
                      style={BUTTON_STYLE}
                      onClick={() => {
                        // Show the button for every live booking so the
                        // operator can see the action exists, but block the
                        // modal from opening until the booking is at least
                        // Confirmed (mirrors the backend J1 guard).
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
                  )}

                  {!isCancelled && (
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
                  )}

                  {!isCancelled && (
                    <button
                      style={BUTTON_STYLE}
                      onClick={resendMailToAgent}
                      disabled={resendingMail}
                    >
                      {resendingMail
                        ? "SENDING..."
                        : "RESEND MAIL TO AGENT"}
                    </button>
                  )}

                  {!isCancelled && (
                    <button style={BUTTON_STYLE} onClick={openRemarkModal}>
                      BOOKING REMARK
                    </button>
                  )}

                  <button
                    style={BUTTON_STYLE}
                    onClick={() =>
                      navigate(`/booking-details/hotel-booking/${id}/notes`)
                    }
                  >
                    NOTES
                  </button>
                </div>
                )}

                {/* ── Booking Date footer ───────────────────────────── */}
                <div
                  style={{
                    textAlign: "right",
                    fontSize: "0.8rem",
                    color: "#555",
                    paddingBottom: "8px",
                  }}
                >
                  Booking Date : {formatDateTime(booking.bookingDate)}
                </div>

                {/* ── Cancel Booking Modal (ported from HotelBookingList) ── */}
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
                    style={{
                      backgroundColor: "#fff",
                      borderBottom: "2px solid #e9ecef",
                    }}
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
                        <div>
                          <strong>Booking Code:</strong>{" "}
                          {booking.bookingCode || "N/A"}
                        </div>
                        {booking.hotelName && (
                          <div>
                            <strong>Hotel:</strong> {booking.hotelName}
                          </div>
                        )}
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
                          onChange={(e) =>
                            setCancellationReason(e.target.value)
                          }
                          disabled={cancellingBooking}
                        />
                      </Form.Group>
                    </div>
                  </Modal.Body>
                  <Modal.Footer
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderTop: "1px solid #dee2e6",
                    }}
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
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Cancelling...
                        </>
                      ) : (
                        "Yes, Cancel"
                      )}
                    </Button>
                  </Modal.Footer>
                </Modal>

                {/* ── Reconfirm Booking Modal ─────────────────────────── */}
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
                    style={{
                      backgroundColor: "#fff",
                      borderBottom: "2px solid #e9ecef",
                    }}
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
                          <strong>Booking Code:</strong>{" "}
                          {booking.bookingCode || "N/A"}
                        </div>
                        {booking.hotelName && (
                          <div>
                            <strong>Hotel:</strong> {booking.hotelName}
                          </div>
                        )}
                      </div>
                    </div>
                  </Modal.Body>
                  <Modal.Footer
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderTop: "1px solid #dee2e6",
                    }}
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
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Confirming...
                        </>
                      ) : (
                        "Confirm"
                      )}
                    </Button>
                  </Modal.Footer>
                </Modal>

                {/* ── Reject Booking Modal (follow-up from Reconfirm → Reject) ── */}
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
                    style={{
                      backgroundColor: "#fff",
                      borderBottom: "2px solid #e9ecef",
                    }}
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
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderTop: "1px solid #dee2e6",
                    }}
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

                {/* ── Send Document Email Modal ─────────────────────── */}
                <Modal
                  show={showSendEmailModal}
                  onHide={() => {
                    if (!sendingEmail) setShowSendEmailModal(false);
                  }}
                  centered
                  backdrop="static"
                  keyboard={false}
                >
                  <Modal.Header
                    closeButton={!sendingEmail}
                    style={{
                      backgroundColor: "#fff",
                      borderBottom: "2px solid #e9ecef",
                    }}
                  >
                    <Modal.Title className="fw-bold">
                      Send {sendEmailDocLabel} via Email
                    </Modal.Title>
                  </Modal.Header>
                  <Modal.Body style={{ padding: "1.5rem" }}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">
                        Recipient Email <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="email"
                        value={sendEmailRecipient}
                        onChange={(e) => {
                          setSendEmailRecipient(e.target.value);
                          if (sendEmailError) setSendEmailError("");
                        }}
                        isInvalid={!!sendEmailError}
                        placeholder="recipient@example.com"
                        disabled={sendingEmail}
                        autoFocus
                      />
                      <Form.Control.Feedback type="invalid">
                        {sendEmailError}
                      </Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group className="mb-2">
                      <Form.Label className="fw-semibold">
                        Note <span className="text-muted small">(optional)</span>
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={sendEmailNote}
                        onChange={(e) => setSendEmailNote(e.target.value)}
                        placeholder="Add a message for the recipient"
                        disabled={sendingEmail}
                      />
                    </Form.Group>
                    <div className="text-muted small">
                      A fresh PDF will be generated and attached automatically.
                    </div>
                  </Modal.Body>
                  <Modal.Footer
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderTop: "1px solid #dee2e6",
                    }}
                  >
                    <Button
                      variant="secondary"
                      onClick={() => setShowSendEmailModal(false)}
                      disabled={sendingEmail}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={sendDocumentEmail}
                      disabled={sendingEmail}
                    >
                      {sendingEmail ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-2" />
                          Sending...
                        </>
                      ) : (
                        "Send Email"
                      )}
                    </Button>
                  </Modal.Footer>
                </Modal>

                {/* ── Update Book Status Modal (PATCH confirmation-status + Agent LPO) ── */}
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
                    style={{
                      backgroundColor: "#fff",
                      borderBottom: "2px solid #e9ecef",
                    }}
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
                          <strong>Booking Code:</strong>{" "}
                          {booking.bookingCode || "N/A"}
                        </div>
                        {booking.hotelName && (
                          <div>
                            <strong>Hotel:</strong> {booking.hotelName}
                          </div>
                        )}
                      </div>
                    </div>
                    <Form.Group
                      controlId="confirmAgentLpoInput"
                      className="text-start"
                    >
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
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderTop: "1px solid #dee2e6",
                    }}
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
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Confirming...
                        </>
                      ) : (
                        "OK"
                      )}
                    </Button>
                  </Modal.Footer>
                </Modal>

                {/* ── Confirmation Number Modal ──────────────────────── */}
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
                    style={{
                      backgroundColor: "#fff",
                      borderBottom: "2px solid #e9ecef",
                    }}
                  >
                    <Modal.Title className="fw-bold">
                      Confirmation Number
                    </Modal.Title>
                  </Modal.Header>
                  <Modal.Body style={{ padding: "1.5rem" }}>
                    <div className="text-muted small mb-3">
                      <div>
                        <strong>Booking Code:</strong>{" "}
                        {booking.bookingCode || "N/A"}
                      </div>
                      {booking.hotelName && (
                        <div>
                          <strong>Hotel:</strong> {booking.hotelName}
                        </div>
                      )}
                    </div>
                    <Form.Group controlId="confirmationNoInput">
                      <Form.Label className="fw-semibold mb-1">
                        Confirmation Number{" "}
                        <span className="text-danger">*</span>
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
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderTop: "1px solid #dee2e6",
                    }}
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
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Saving...
                        </>
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </Modal.Footer>
                </Modal>

                {/* ── Booking Remark Modal ───────────────────────────── */}
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
                    style={{
                      backgroundColor: "#fff",
                      borderBottom: "2px solid #e9ecef",
                    }}
                  >
                    <Modal.Title className="fw-bold">
                      Booking Remark
                    </Modal.Title>
                  </Modal.Header>
                  <Modal.Body style={{ padding: "1.5rem" }}>
                    <Form.Group controlId="bookingRemarkInput">
                      <Form.Label className="fw-semibold mb-1">
                        Remark
                      </Form.Label>
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
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderTop: "1px solid #dee2e6",
                    }}
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
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Saving...
                        </>
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </Modal.Footer>
                </Modal>
              </>
            )}
          </Container>
        </main>
      </div>

      {/*
        PDF Preview Modal — opens the Proforma Voucher / Proforma Invoice /
        Voucher / Invoice PDF inside an <iframe> on this page rather than
        sending the user to a new tab or triggering a download. The modal
        is rendered outside the main <main> column so it overlays the
        full viewport; placing it outside the {loading/!booking} ternary
        means it survives a background refetch.
      */}
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
            {booking?.bookingCode ? ` — ${booking.bookingCode}` : ""}
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
                onClick={() => window.open(pdfPreview.url, "_blank", "noopener,noreferrer")}
              >
                Open in new tab
              </Button>
              <Button
                variant="outline-primary"
                size="sm"
                as="a"
                href={pdfPreview.url}
                download={`Booking_${id}_${pdfPreview.type || "document"}.pdf`}
              >
                Download
              </Button>
              {/* Send Email — admin-only. Agents see the
                  download + new-tab buttons but cannot dispatch
                  documents by email from this UI. */}
              {isAdmin && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const labelToDocType = {
                      "Voucher": "VOUCHER",
                      "Proforma Voucher": "PROFORMA_VOUCHER",
                      "Invoice": "INVOICE",
                      "Proforma Invoice": "PROFORMA_INVOICE",
                    };
                    const dt =
                      labelToDocType[pdfPreview.label] ||
                      (pdfPreview.type === "PROFORMA_VOUCHER"
                        ? "PROFORMA_VOUCHER"
                        : pdfPreview.type === "PROFORMA_INVOICE"
                        ? "PROFORMA_INVOICE"
                        : pdfPreview.type === "COMPLETED"
                        ? "INVOICE"
                        : "VOUCHER");
                    openSendEmailModal(dt, pdfPreview.label || "Document");
                  }}
                >
                  ✉ Send Email
                </Button>
              )}
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

function InfoRow({ label, value }) {
  return (
    <div style={{ marginBottom: "6px", display: "flex", alignItems: "flex-start" }}>
      <span style={INFO_LABEL}>{label}</span>
      <span style={{ ...INFO_VALUE, marginLeft: "8px" }}>
        {value ?? "-"}
      </span>
    </div>
  );
}
