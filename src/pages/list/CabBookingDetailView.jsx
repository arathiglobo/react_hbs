/**
 * CabBookingDetailView.jsx
 *
 * Full-page detail view for a single Cab booking. Replaces the modal-based
 * "View" that used to live in CabBookingList. Per-row Voucher / Cancel
 * icons now sit at the bottom-left of this page as buttons. All endpoints
 * / behaviour are unchanged:
 *   - Voucher PDF :  GET  /api/cab/{id}/pdf?type=VOUCHER
 *   - Send voucher:  POST /api/cab/{id}/voucher/send  { email }
 *   - Cancel      :  DELETE /api/cab/delete/{id}
 *
 * Booking summary is passed via location.state when the user clicks the
 * eye icon on CabBookingList. On hard refresh we surface a "Booking not
 * found — go back" hint because the list endpoint doesn't expose a
 * per-id GET.
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
  Form,
  Modal,
  Button,
  InputGroup,
} from "react-bootstrap";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  FaCar,
  FaFileInvoice,
  FaEnvelope,
  FaExclamationCircle,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

// Red action button used by the action row + modals (matches the Hotel
// Booking detail view's BUTTON_STYLE).
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

// Alias kept so the existing action-row JSX (which references ACTION_BTN)
// continues to work — same red button as the Hotel view.
const ACTION_BTN = BUTTON_STYLE;

// Card / section styling copied from the Hotel Booking detail view.
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

const card = {
  border: "1px solid #ddd",
  borderRadius: "4px",
  marginBottom: "14px",
  overflow: "hidden",
  backgroundColor: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
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

// Per-part coloured status label, copied from the Hotel Booking detail view.
// Confirmed / ReConfirmed → green, Cancelled → red, On Request → orange.
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

// Label / value row, copied from the Hotel Booking detail view's InfoRow.
const InfoRow = ({ label, value }) => (
  <div
    style={{ marginBottom: "6px", display: "flex", alignItems: "flex-start" }}
  >
    <span style={INFO_LABEL}>{label}</span>
    <span style={{ ...INFO_VALUE, marginLeft: "8px" }}>{value ?? "-"}</span>
  </div>
);

// Hotel-style card section wrappers (replace the old Bootstrap-bordered
// SectionHeader / SectionBody so the cab cards match the Hotel view).
const SectionHeader = ({ children }) => (
  <div style={SECTION_HEADER}>{children}</div>
);

const SectionBody = ({ children }) => (
  <div style={{ padding: "12px 16px" }}>{children}</div>
);

export default function CabBookingDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const booking = location.state?.booking || null;

  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Voucher: track loading state for the PDF generation
  const [voucherLoadingId, setVoucherLoadingId] = useState(null);

  // Voucher modal — opens an in-page iframe preview of the PDF and
  // lets the operator email the voucher to an arbitrary recipient.
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherPdfUrl, setVoucherPdfUrl] = useState("");
  const [voucherEmail, setVoucherEmail] = useState("");
  const [voucherEmailError, setVoucherEmailError] = useState("");
  const [voucherSending, setVoucherSending] = useState(false);

  // ── Action-button state (mirror of LongStayBookingDetailView). The cab
  // detail view has no per-id detail fetch, so the live action state is
  // seeded from the row stub and merged from each mutation's response DTO. ──
  const [actionState, setActionState] = useState({
    confirmationStatus: booking?.confirmationStatus,
    reconfirmation: booking?.reconfirmation,
    agentLpo: booking?.agentLpo || booking?.lpo,
    confirmationNumber: booking?.confirmationNumber,
    remarks: booking?.remarks,
    cancelStatus: booking?.cancelStatus,
  });

  // Cancel (with reason)
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

  // Agent Reference
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

  // Resend Mail
  const [resendingMail, setResendingMail] = useState(false);

  // PDF generation feedback + in-page preview. Shape: { url, label, type }.
  const [generatingPdfType, setGeneratingPdfType] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);

  const bookingId = booking?.custombookingId;

  // Merge an action mutation's response DTO into the live action state so the
  // gating below re-derives without a full-page detail fetch.
  const mergeActionState = (dto) => {
    if (!dto) return;
    setActionState((prev) => ({
      ...prev,
      confirmationStatus:
        dto.confirmationStatus ?? prev.confirmationStatus,
      reconfirmation: dto.reconfirmation ?? prev.reconfirmation,
      agentLpo: dto.agentLpo ?? prev.agentLpo,
      confirmationNumber: dto.confirmationNumber ?? prev.confirmationNumber,
      remarks: dto.remarks ?? prev.remarks,
      cancelStatus: dto.cancelStatus ?? prev.cancelStatus,
    }));
  };

  // ── Status helpers (mirror LongStayBookingDetailView) ──
  const normalizedStatus = String(actionState.confirmationStatus || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const isCancelled =
    !!booking?.cancelStatus ||
    actionState.cancelStatus === true ||
    normalizedStatus === "CANCELLED";
  const showsFinalDocs =
    actionState.reconfirmation === true ||
    normalizedStatus === "RECONFIRMED" ||
    normalizedStatus === "COMPLETED";
  const isConfirmedOrLater =
    normalizedStatus === "CONFIRMED" ||
    normalizedStatus === "OK" ||
    normalizedStatus === "RECONFIRMED" ||
    normalizedStatus === "COMPLETED" ||
    actionState.reconfirmation === true;

  const handleCancelBooking = async () => {
    if (!booking) return;
    try {
      setCancelling(true);
      const params = cancellationReason.trim()
        ? { reason: cancellationReason.trim() }
        : undefined;
      const response = await axiosInstance.delete(
        `/api/cab/delete/${booking.custombookingId}`,
        { params }
      );
      if (response.data?.status === "success") {
        toast.success("Booking cancelled");
        setShowCancelModal(false);
        setCancellationReason("");
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

  const openCancelModal = () => {
    setCancellationReason("");
    setShowCancelModal(true);
  };

  // ── Reconfirm ──
  const openConfirmModal = () => setShowConfirmModal(true);

  const confirmBooking = async () => {
    if (!bookingId) return;
    try {
      setConfirmingBooking(true);
      const res = await axiosInstance.patch(
        `/api/cab/${bookingId}/confirmation-status`,
        { confirmStatus: true }
      );
      mergeActionState(res.data);
      setShowConfirmModal(false);
      toast.success("Booking reconfirmed successfully!");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to reconfirm booking. Please try again."
      );
    } finally {
      setConfirmingBooking(false);
    }
  };

  // ── Reject ──
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
      const res = await axiosInstance.patch(
        `/api/cab/${bookingId}/confirmation-status`,
        {
          action: "REJECT",
          rejectedBy: rb,
          rejectionRemarks: (rejectionRemarks || "").trim() || null,
        }
      );
      mergeActionState(res.data);
      setShowRejectModal(false);
      toast.success("Booking rejected.");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to reject booking. Please try again."
      );
    } finally {
      setRejectingBooking(false);
    }
  };

  // ── Agent Reference ──
  const openConfirmStatusModal = async () => {
    setConfirmAgentLpo("");
    setConfirmAgentLpoError("");
    setShowConfirmStatusModal(true);
    try {
      const res = await axiosInstance.get(
        `/api/cab/${bookingId}/agent-reference`
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
      const res = await axiosInstance.post(
        `/api/cab/${bookingId}/agent-reference`,
        { agentLpo: lpoTrimmed }
      );
      mergeActionState(res.data);
      setShowConfirmStatusModal(false);
      toast.success("Agent Reference updated successfully");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to update Agent Reference. Please try again."
      );
    } finally {
      setUpdatingConfirmationStatus(false);
    }
  };

  // ── Confirmation Number ──
  const openConfirmationNoModal = async () => {
    setConfirmationNoInput("");
    setConfirmationNoError("");
    setShowConfirmationNoModal(true);
    try {
      const res = await axiosInstance.get(
        `/api/cab/${bookingId}/agent-reference`
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
      const res = await axiosInstance.patch(
        `/api/cab/${bookingId}/confirmation-status`,
        { action: "CONFIRMATION_NO", confirmationNumber: value }
      );
      mergeActionState(res.data);
      setShowConfirmationNoModal(false);
      toast.success("Confirmation number saved successfully!");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to save confirmation number. Please try again."
      );
    } finally {
      setSavingConfirmationNo(false);
    }
  };

  // ── Booking Remark ──
  const openRemarkModal = () => {
    setRemarkInput(actionState.remarks || "");
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
      const res = await axiosInstance.post(`/api/cab/${bookingId}/remark`, {
        remarks: text,
      });
      mergeActionState(res.data);
      setShowRemarkModal(false);
      toast.success("Remark saved successfully");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to save remark. Please try again."
      );
    } finally {
      setSavingRemark(false);
    }
  };

  // ── Resend Mail ──
  const resendMailToAgent = async () => {
    try {
      setResendingMail(true);
      await axiosInstance.post(`/api/cab/${bookingId}/resend-mail`);
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

  // ── PDF preview gateway (Proforma / Final Voucher & Invoice) ──
  const handleDownloadPdf = async (type, label) => {
    if (!bookingId) return;
    try {
      setGeneratingPdfType(type);
      const res = await axiosInstance.get(`/api/cab/${bookingId}/pdf`, {
        params: { type: type.toUpperCase() },
      });
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

  // Voucher action → backend (CabBookingController#getCabBookingPdf) returns a
  // PdfGenerationResponseDTO with { status, message, pdfUrl }; instead of
  // opening a new tab, surface the URL inside an in-page modal with an
  // iframe preview + an email-to field.
  const handleVoucher = async () => {
    if (!booking) return;
    const bid = booking.custombookingId;
    if (!bid) return;
    try {
      setVoucherLoadingId(bid);
      const res = await axiosInstance.get(`/api/cab_booking/${bid}/pdf`, {
        params: { type: "VOUCHER" },
      });
      if (res.data && res.data.status === "SUCCESS" && res.data.pdfUrl) {
        setVoucherPdfUrl(res.data.pdfUrl);
        setVoucherEmail(booking.customer?.emailId || "");
        setVoucherEmailError("");
        setShowVoucherModal(true);
      } else {
        toast.error(res.data?.message || "Failed to generate voucher");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate voucher");
    } finally {
      setVoucherLoadingId(null);
    }
  };

  // Email the voucher PDF to the address typed into the modal.
  const sendVoucherEmail = async () => {
    if (!booking) return;
    const email = (voucherEmail || "").trim();
    if (!email) {
      setVoucherEmailError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setVoucherEmailError("Please enter a valid email address");
      return;
    }
    setVoucherEmailError("");
    try {
      setVoucherSending(true);
      await axiosInstance.post(
        `/api/cab/${booking.custombookingId}/voucher/send`,
        { email }
      );
      toast.success(`Voucher sent to ${email}`);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to send voucher email"
      );
    } finally {
      setVoucherSending(false);
    }
  };

  const closeVoucherModal = () => {
    if (voucherSending) return;
    setShowVoucherModal(false);
    setVoucherPdfUrl("");
    setVoucherEmail("");
    setVoucherEmailError("");
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
                  Booking not found. Please reopen it from the Cab Bookings list.
                </p>
                <button
                  style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                  onClick={() =>
                    navigate("/booking-details/cab-booking-list")
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

  const customerName = [
    booking.customer?.salutaion,
    booking.customer?.firstName,
    booking.customer?.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  // Display status for the StatusBadge — cancelled shows red, otherwise the
  // live confirmation status (falling back to Confirmed) coloured green.
  const displayStatus = isCancelled
    ? "Cancelled"
    : actionState.confirmationStatus || "Confirmed";

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* Header — Back + title + booking code + status (matches the
                Hotel Booking detail view). */}
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
                <FaCar className="me-2 text-secondary" />
                Booking Details
                {booking.packageBookCode && (
                  <span
                    style={{
                      marginLeft: "12px",
                      fontWeight: "700",
                      fontSize: "0.95rem",
                      color: "#c0392b",
                    }}
                  >
                    {booking.packageBookCode}
                  </span>
                )}
                <span style={{ marginLeft: "12px" }}>
                  <StatusBadge status={displayStatus} />
                </span>
              </span>
            </div>

            {/* ── Booking Information ── */}
            <div style={card}>
              <SectionHeader>Booking Information</SectionHeader>
              <SectionBody>
                <Row>
                  <Col md={6}>
                    <InfoRow
                      label="Booking Code"
                      value={booking.packageBookCode}
                    />
                    <InfoRow
                      label="Booking Date"
                      value={formatDate(booking.bookingDate)}
                    />
                    <InfoRow label="Cab" value={booking.cabName} />
                    <InfoRow label="Transporter" value={booking.transporter} />
                    <InfoRow label="Pickup Date" value={booking.pickupDate} />
                    <InfoRow
                      label="Dropoff Date"
                      value={
                        booking.dropOffDate ||
                        booking.dropoffDate ||
                        booking.pickupDate
                      }
                    />
                  </Col>
                  <Col md={6}>
                    <InfoRow label="Agent" value={booking.agentName} />
                    <InfoRow
                      label="Pickup"
                      value={
                        [booking.pickupName, booking.pickupTime]
                          .filter(Boolean)
                          .join(" @ ") || "-"
                      }
                    />
                    <InfoRow
                      label="Dropoff"
                      value={
                        [booking.dropoffName, booking.dropoffTime]
                          .filter(Boolean)
                          .join(" @ ") || "-"
                      }
                    />
                    <InfoRow
                      label="Driver"
                      value={
                        [booking.driverName, booking.driverContact]
                          .filter(Boolean)
                          .join(" · ") || "-"
                      }
                    />
                    <InfoRow
                      label="Voucher"
                      value={
                        booking.voucherIssued || booking.voucher ? "Yes" : "No"
                      }
                    />
                    <InfoRow
                      label="Status"
                      value={<StatusBadge status={displayStatus} />}
                    />
                  </Col>
                </Row>
              </SectionBody>
            </div>

            {/* ── Guest Information ── */}
            <div style={card}>
              <SectionHeader>Guest Information</SectionHeader>
              <SectionBody>
                <Row>
                  <Col md={6}>
                    <InfoRow label="Guest Name" value={customerName} />
                    <InfoRow label="Email" value={booking.customer?.emailId} />
                    <InfoRow
                      label="Phone"
                      value={booking.customer?.contactNumber}
                    />
                  </Col>
                  <Col md={6}>
                    <InfoRow
                      label="Passport No."
                      value={booking.customer?.passportNumber}
                    />
                    <InfoRow
                      label="Nationality"
                      value={
                        booking.customer?.nationality || booking.nationality
                      }
                    />
                    <InfoRow label="Agent LPO" value={booking.lpo} />
                  </Col>
                </Row>
              </SectionBody>
            </div>

            {/* ── Passenger Details ── */}
            <div style={card}>
              <SectionHeader>
                Passenger Details
                <span className="text-muted small fw-normal ms-2">
                  ({booking.noOfAdult ?? 0} Adult
                  {(booking.noOfAdult ?? 0) !== 1 ? "s" : ""}
                  {(booking.noOfChild ?? 0) > 0
                    ? `, ${booking.noOfChild} Child${
                        booking.noOfChild !== 1 ? "ren" : ""
                      }`
                    : ""}
                  )
                </span>
              </SectionHeader>
              {Array.isArray(booking.guests) && booking.guests.length > 0 ? (
                <Table size="sm" hover className="mb-0 align-middle">
                  <thead style={{ backgroundColor: "#f8f9fa" }}>
                    <tr>
                      <th style={{ width: 50 }}>#</th>
                      <th style={{ width: 90 }}>Type</th>
                      <th>Name</th>
                      <th style={{ width: 80 }}>Age</th>
                      <th>Passport</th>
                    </tr>
                  </thead>
                  <tbody>
                    {booking.guests.map((g, idx) => (
                      <tr key={g.id || idx}>
                        <td>{g.guestIndex || idx + 1}</td>
                        <td>
                          <Badge bg={g.isChild ? "secondary" : "dark"}>
                            {g.isChild ? "Child" : "Adult"}
                          </Badge>
                        </td>
                        <td>
                          {[
                            g.salutation,
                            g.firstName,
                            g.middleName,
                            g.lastName,
                          ]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </td>
                        <td>{g.age ?? "—"}</td>
                        <td>{g.passportNo || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="small text-muted px-3 py-2">
                  No per-pax manifest captured for this booking.
                  {Array.isArray(booking.childAgeArray) &&
                    booking.childAgeArray.length > 0 && (
                      <span>
                        {" "}
                        Child ages: {booking.childAgeArray.join(", ")}.
                      </span>
                    )}
                </div>
              )}
            </div>

            {/* ── Price Details ── */}
            <div style={card}>
              <SectionHeader>Price Details</SectionHeader>
              <SectionBody>
                {booking.sellingPrice != null && (
                  <InfoRow
                    label="Selling Price"
                    value={formatPrice(booking.sellingPrice)}
                  />
                )}
                {booking.totalRate != null &&
                  Number(booking.totalRate) !== Number(booking.totalPrice) && (
                    <InfoRow
                      label="Total Rate"
                      value={formatPrice(booking.totalRate)}
                    />
                  )}
                {booking.tourismDirham != null &&
                  Number(booking.tourismDirham) > 0 && (
                    <InfoRow
                      label="Tourism Dirham"
                      value={`+ ${formatPrice(booking.tourismDirham)}`}
                    />
                  )}
                <div
                  style={{
                    marginTop: "6px",
                    paddingTop: "8px",
                    borderTop: "1px solid #eee",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span style={{ ...INFO_LABEL, color: "#333" }}>
                    Total Amount
                  </span>
                  <span
                    style={{
                      marginLeft: "8px",
                      fontWeight: "700",
                      fontSize: "0.95rem",
                      color: "#16a34a",
                    }}
                  >
                    {formatPrice(booking.totalPrice)}
                  </span>
                </div>
              </SectionBody>
            </div>

            {/* Bottom action buttons — mirrors LongStayBookingDetailView's
                action row. The legacy email-voucher modal is preserved on the
                first button; the rest are the Long-Stay action set. The
                PROFORMA vs FINAL doc pair flips off `showsFinalDocs`. */}
            <div
              className="d-flex gap-2 justify-content-start flex-wrap"
              style={{ marginTop: "16px", marginBottom: "20px" }}
            >
              {!isCancelled && (
                <button style={ACTION_BTN} onClick={openCancelModal}>
                  CANCEL
                </button>
              )}

              {!showsFinalDocs && !isCancelled && (
                <button style={ACTION_BTN} onClick={openConfirmModal}>
                  RECONFIRM
                </button>
              )}

              {!showsFinalDocs ? (
                <>
                  <button
                    style={ACTION_BTN}
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
                    style={ACTION_BTN}
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
              ) : (
                <>
                  <button
                    style={ACTION_BTN}
                    disabled={generatingPdfType === "VOUCHER"}
                    onClick={() => handleDownloadPdf("VOUCHER", "Voucher")}
                  >
                    {generatingPdfType === "VOUCHER"
                      ? "GENERATING..."
                      : "VOUCHER"}
                  </button>
                  <button
                    style={ACTION_BTN}
                    disabled={generatingPdfType === "INVOICE"}
                    onClick={() => handleDownloadPdf("INVOICE", "Invoice")}
                  >
                    {generatingPdfType === "INVOICE"
                      ? "GENERATING..."
                      : "INVOICE"}
                  </button>
                </>
              )}

              <button
                style={ACTION_BTN}
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
                style={ACTION_BTN}
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
                style={ACTION_BTN}
                onClick={resendMailToAgent}
                disabled={resendingMail}
              >
                {resendingMail ? "SENDING..." : "RESEND MAIL TO AGENT"}
              </button>

              <button style={ACTION_BTN} onClick={openRemarkModal}>
                BOOKING REMARK
              </button>

              <button
                style={ACTION_BTN}
                onClick={() =>
                  navigate(`/booking-details/cab-booking/${bookingId}/notes`)
                }
              >
                NOTES
              </button>

              {/* Legacy email-voucher modal action — kept so operators can
                  still email the voucher PDF to an arbitrary recipient. */}
              <button
                style={{ ...BUTTON_STYLE, backgroundColor: "#198754" }}
                onClick={handleVoucher}
                disabled={voucherLoadingId === booking.custombookingId}
                title="Email Voucher"
              >
                {voucherLoadingId === booking.custombookingId ? (
                  <Spinner
                    size="sm"
                    style={{ width: 12, height: 12, marginRight: 6 }}
                  />
                ) : (
                  <FaEnvelope style={{ marginRight: "6px" }} />
                )}
                Email Voucher
              </button>
            </div>

            {/* ── Booking Date footer (matches the Hotel Booking detail view) ── */}
            <div
              style={{
                textAlign: "right",
                fontSize: "0.8rem",
                color: "#555",
                paddingBottom: "8px",
              }}
            >
              Booking Date : {formatDate(booking.bookingDate)}
            </div>
          </Container>
        </main>
      </div>

      {/* Cancel confirmation (with optional reason) */}
      <Modal
        show={showCancelModal}
        onHide={() => {
          if (!cancelling) {
            setShowCancelModal(false);
            setCancellationReason("");
          }
        }}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header
          closeButton={!cancelling}
          style={{ backgroundColor: "#fff", borderBottom: "2px solid #e9ecef" }}
        >
          <Modal.Title className="fw-bold d-flex align-items-center">
            <FaExclamationCircle className="me-2 text-danger" />
            Cancel Cab Booking
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          <div className="text-center">
            <p className="fs-5 mb-2">
              Are you sure you want to cancel this booking?
            </p>
            <h5 className="mb-1">{booking.packageBookCode}</h5>
            <p className="text-primary small mb-3">{booking.cabName}</p>
            <Form.Group controlId="cabCancellationReason" className="text-start">
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
                disabled={cancelling}
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
            disabled={cancelling}
          >
            No, Keep
          </Button>
          <Button
            variant="danger"
            onClick={handleCancelBooking}
            disabled={cancelling}
          >
            {cancelling ? (
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

      {/* ── Reconfirm Booking Modal ── */}
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
            Reconfirm Booking
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          <div className="text-center">
            <p className="fs-5 mb-3">
              Are you sure you want to reconfirm the booking?
            </p>
            <div className="text-muted small">
              <div>
                <strong>Booking Code:</strong>{" "}
                {booking.packageBookCode || "N/A"}
              </div>
              {booking.cabName && (
                <div>
                  <strong>Cab:</strong> {booking.cabName}
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
                <Spinner animation="border" size="sm" className="me-2" />
                Confirming...
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Reject Booking Modal ── */}
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
            Reject Booking
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

      {/* ── Agent Reference Modal ── */}
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
            Update Agent Reference
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          <Form.Group controlId="cabConfirmAgentLpoInput">
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
                <Spinner animation="border" size="sm" className="me-2" />
                Saving...
              </>
            ) : (
              "OK"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Confirmation Number Modal ── */}
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
          <Form.Group controlId="cabConfirmationNoInput">
            <Form.Label className="fw-semibold mb-1">
              Confirmation Number <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter Confirmation Number"
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
                <Spinner animation="border" size="sm" className="me-2" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Booking Remark Modal ── */}
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
          <Form.Group controlId="cabBookingRemarkInput">
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
                <Spinner animation="border" size="sm" className="me-2" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── PDF Preview Modal (Proforma/Final Voucher & Invoice) ── */}
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
            {booking.packageBookCode ? ` — ${booking.packageBookCode}` : ""}
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
                download={`CabBooking_${bookingId}_${
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

      {/* ── Voucher modal — iframe preview + email-send form ───── */}
      <Modal
        show={showVoucherModal}
        onHide={closeVoucherModal}
        size="xl"
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header
          closeButton={!voucherSending}
          className="border-bottom"
          style={{ backgroundColor: "#f1f3f5" }}
        >
          <Modal.Title className="d-flex align-items-center text-dark fw-semibold">
            <FaFileInvoice className="me-2 text-secondary" />
            Voucher
            {booking.packageBookCode && (
              <Badge
                bg="light"
                text="dark"
                className="ms-3 fw-semibold border"
              >
                {booking.packageBookCode}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 bg-white">
          {/* Email Voucher panel — sits ABOVE the PDF preview. */}
          <Card className="border shadow-none rounded-3 mb-3">
            <Card.Header
              className="py-2 fw-semibold text-dark d-flex align-items-center"
              style={{ backgroundColor: "#f1f3f5" }}
            >
              <FaEnvelope className="me-2 text-secondary" /> Email Voucher
            </Card.Header>
            <Card.Body className="p-3">
              <Row className="g-2 align-items-start">
                <Col md={8}>
                  <Form.Label className="small fw-semibold mb-1">
                    Recipient Email <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="name@example.com"
                    value={voucherEmail}
                    onChange={(e) => {
                      setVoucherEmail(e.target.value);
                      if (voucherEmailError) setVoucherEmailError("");
                    }}
                    isInvalid={!!voucherEmailError}
                    disabled={voucherSending}
                  />
                  {voucherEmailError ? (
                    <div className="invalid-feedback d-block">
                      {voucherEmailError}
                    </div>
                  ) : (
                    <Form.Text className="text-muted">
                      The voucher PDF will be attached and sent to this address.
                    </Form.Text>
                  )}
                </Col>
                <Col md={4} className="d-flex flex-column gap-2 mt-md-4">
                  <Button
                    variant="dark"
                    onClick={sendVoucherEmail}
                    disabled={voucherSending}
                  >
                    {voucherSending ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <FaEnvelope className="me-2" /> Send
                      </>
                    )}
                  </Button>
                  {voucherPdfUrl && (
                    <Button
                      variant="outline-secondary"
                      href={voucherPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      disabled={voucherSending}
                    >
                      Open in New Tab
                    </Button>
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* PDF preview below the email form. */}
          <Card className="border shadow-none rounded-3 overflow-hidden">
            <Card.Body className="p-0">
              {voucherPdfUrl ? (
                <iframe
                  title="Voucher PDF"
                  src={voucherPdfUrl}
                  style={{
                    width: "100%",
                    height: "65vh",
                    border: "none",
                    display: "block",
                  }}
                />
              ) : (
                <div className="text-center text-muted py-5">
                  No voucher loaded.
                </div>
              )}
            </Card.Body>
          </Card>
        </Modal.Body>
        <Modal.Footer
          className="border-top"
          style={{ backgroundColor: "#f8f9fa" }}
        >
          <Button
            variant="secondary"
            onClick={closeVoucherModal}
            disabled={voucherSending}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
