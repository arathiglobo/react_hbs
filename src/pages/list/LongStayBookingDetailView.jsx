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
import React, { useEffect, useState, useCallback } from "react";
import {
  Container,
  Row,
  Col,
  Table,
  Spinner,
  Modal,
  Button,
  Form,
} from "react-bootstrap";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaExclamationCircle } from "react-icons/fa";
import axiosInstance from "../../components/AxiosInstance";
import { formatDateTime } from "../../utils/dateUtils";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import { toast } from "react-hot-toast";

// ── Visual tokens copied from the Hotel Booking detail view so this
//    page shares the same look (red action buttons, grey section
//    headers, inline label/value rows and bordered cards). ──────────
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

// Purpose-based colour variants (same scheme as the hotel detail page). They
// reuse the BUTTON_STYLE shape — only the background colour changes — purely
// to improve visual distinction. No behaviour/handler/guard is affected.
const BTN_TEAL = { ...BUTTON_STYLE, backgroundColor: "#0d9488" }; // Reconfirm
const BTN_DANGER = { ...BUTTON_STYLE, backgroundColor: "#dc2626" }; // Cancel
const BTN_SKY = { ...BUTTON_STYLE, backgroundColor: "#3ba2e8" }; // Add Agent Reference
const BTN_INDIGO = { ...BUTTON_STYLE, backgroundColor: "#6366f1" }; // Confirmation No.
const BTN_INFO = { ...BUTTON_STYLE, backgroundColor: "#0891b2" }; // Voucher / Invoice
const BTN_ORANGE = { ...BUTTON_STYLE, backgroundColor: "#f0922b" }; // Resend Mail
const BTN_ACCENT = { ...BUTTON_STYLE, backgroundColor: "#7c3aed" }; // Booking Remark
const BTN_NEUTRAL = { ...BUTTON_STYLE, backgroundColor: "#64748b" }; // View / Back / Notes

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

// Per-part coloured status pill — copied from the hotel view. A combined
// label like "Confirmed/Cancelled" colours each word on its own:
// Confirmed / ReConfirmed → green, Cancelled → red, On Request → orange.
const StatusBadge = ({ status }) => {
  const colorFor = (part) => {
    const p = (part || "").trim().toUpperCase();
    if (p.startsWith("CONFIRMED") || p.startsWith("RECONFIRMED")) return "#16a34a";
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

// Inline label/value row matching the hotel view's InfoRow.
function InfoRow({ label, value }) {
  return (
    <div
      style={{ marginBottom: "6px", display: "flex", alignItems: "flex-start" }}
    >
      <span style={INFO_LABEL}>{label}</span>
      <span style={{ ...INFO_VALUE, marginLeft: "8px" }}>
        {value !== undefined && value !== null && value !== "" ? value : "-"}
      </span>
    </div>
  );
}

export default function LongStayBookingDetailView() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  // Agent-role gate (UI visibility only) — hides internal/admin-facing actions
  // (Booking Remark, Notes, Confirmation No.) for Agent logins.
  // currentActiveRole isn't set for single-role logins, so fall back to
  // userRole (same convention as HotelSearch.jsx). Visibility only — no
  // API/flow/permission change.
  const activeRole = String(localStorage.getItem("currentActiveRole") || "")
    .trim()
    .toUpperCase();
  const storedRoles = String(
    localStorage.getItem("userRole") || "",
  ).toUpperCase();
  const isAgentRole = activeRole
    ? activeRole === "AGENT"
    : storedRoles.includes("AGENT") && !storedRoles.includes("ADMIN");
  const location = useLocation();
  const rowStub = location.state?.booking || null;
  const bookingId = rowStub?.longStayBookingId || routeId;

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);

  // ── Action-button modal / handler state (ported from BookingDetailedView) ──
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

  // Agent Reference (PATCH confirmation-status / POST agent-reference)
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

  // Notes — viewed and added in a modal on this page (replaces the separate
  // /notes navigation). Uses the existing GET/POST endpoints unchanged.
  // Backend shape for this booking type: GET returns a bare array of rows
  // ({ id, note, createdBy, createdDate }); POST body is { note, createdBy }.
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [bookingNotes, setBookingNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);

  // Resend Mail to Agent
  const [resendingMail, setResendingMail] = useState(false);

  // PDF generation feedback + in-page preview (iframe modal).
  // Shape: { url, label, type }.
  const [generatingPdfType, setGeneratingPdfType] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);

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

  // ── Status helpers (mirror BookingDetailedView) ────────────────────
  const normalizedStatus = String(detail?.confirmationStatus || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const isCancelled =
    detail?.bookingStatus === "CANCELLED" ||
    detail?.cancelStatus === true ||
    normalizedStatus === "CANCELLED";
  // Final docs (real Voucher / Invoice) once reconfirmed or completed;
  // otherwise the Proforma equivalents. `reconfirmation` is the explicit
  // boolean the backend sets alongside confirmationStatus = "ReConfirmed".
  const showsFinalDocs =
    detail?.reconfirmation === true ||
    normalizedStatus === "RECONFIRMED" ||
    normalizedStatus === "COMPLETED";
  // Agent Reference / Confirmation No. can only be saved once the booking
  // is Confirmed-or-better.
  const isConfirmedOrLater =
    normalizedStatus === "CONFIRMED" ||
    normalizedStatus === "RECONFIRMED" ||
    normalizedStatus === "COMPLETED" ||
    detail?.reconfirmation === true;

  // Status label fed to the hotel-style StatusBadge. When cancelled,
  // surface the prior status (e.g. "ReConfirmed/Cancelled") if known.
  const displayStatus =
    isCancelled && detail?.cancelledFromStatus
      ? `${detail.cancelledFromStatus}/Cancelled`
      : isCancelled
      ? "Cancelled"
      : detail?.confirmationStatus || detail?.bookingStatus;

  // ── Cancel ─────────────────────────────────────────────────────────
  const openCancelModal = () => {
    setCancellationReason("");
    setShowCancelModal(true);
  };

  const cancelBooking = async () => {
    if (!bookingId) return;
    try {
      setCancellingBooking(true);
      const params = cancellationReason.trim()
        ? { reason: cancellationReason.trim() }
        : undefined;
      await axiosInstance.post(
        `/api/longStayBooking/${bookingId}/cancel`,
        null,
        { params }
      );
      setShowCancelModal(false);
      setCancellationReason("");
      toast.success("Booking cancelled");
      await fetchDetail();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to cancel booking.");
    } finally {
      setCancellingBooking(false);
    }
  };

  // ── Reconfirm ──────────────────────────────────────────────────────
  const openConfirmModal = () => setShowConfirmModal(true);

  const confirmBooking = async () => {
    if (!bookingId) return;
    try {
      setConfirmingBooking(true);
      await axiosInstance.patch(
        `/api/longStayBooking/${bookingId}/confirmation-status`,
        { confirmStatus: true }
      );
      setShowConfirmModal(false);
      toast.success("Booking reconfirmed successfully!");
      await fetchDetail();
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
        `/api/longStayBooking/${bookingId}/confirmation-status`,
        {
          action: "REJECT",
          rejectedBy: rb,
          rejectionRemarks: (rejectionRemarks || "").trim() || null,
        }
      );
      setShowRejectModal(false);
      toast.success("Booking rejected.");
      await fetchDetail();
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
        `/api/longStayBooking/${bookingId}/agent-reference`
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
        `/api/longStayBooking/${bookingId}/agent-reference`,
        { agentLpo: lpoTrimmed }
      );
      setShowConfirmStatusModal(false);
      toast.success("Agent Reference updated successfully");
      await fetchDetail();
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
        `/api/longStayBooking/${bookingId}/agent-reference`
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
        `/api/longStayBooking/${bookingId}/confirmation-status`,
        { action: "CONFIRMATION_NO", confirmationNumber: value }
      );
      setShowConfirmationNoModal(false);
      toast.success("Confirmation number saved successfully!");
      await fetchDetail();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to save confirmation number. Please try again."
      );
    } finally {
      setSavingConfirmationNo(false);
    }
  };

  // ── Notes (modal-based; replaces the standalone /notes page link) ──
  const fetchNotes = useCallback(() => {
    if (!bookingId) return undefined;
    setNotesLoading(true);
    return axiosInstance
      .get(`/api/longStayBooking/${bookingId}/notes`)
      .then((res) => {
        // Endpoint returns a bare array of note rows.
        setBookingNotes(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setBookingNotes([]))
      .finally(() => setNotesLoading(false));
  }, [bookingId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const openNotesModal = () => {
    setNoteInput("");
    setShowNotesModal(true);
  };

  const saveNote = async () => {
    const text = (noteInput || "").trim();
    if (!text) {
      toast.error("Note cannot be empty");
      return;
    }
    try {
      setSavingNote(true);
      // SAME endpoint + payload shape the standalone /notes page uses
      // (body field is `note`, not `noteText`). Nothing about how notes are
      // stored is changed.
      const createdBy =
        localStorage.getItem("UserName") ||
        sessionStorage.getItem("UserName") ||
        "unknown";
      const res = await axiosInstance.post(
        `/api/longStayBooking/${bookingId}/notes`,
        { note: text, createdBy },
      );
      if (res.data && res.data.success !== false) {
        toast.success("Note saved");
        setShowNotesModal(false);
        setNoteInput("");
        await fetchNotes();
      } else {
        toast.error(res.data?.message || "Failed to save note");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  // ── Booking Remark ─────────────────────────────────────────────────
  const openRemarkModal = () => {
    setRemarkInput(detail?.remarks || "");
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
      await axiosInstance.post(`/api/longStayBooking/${bookingId}/remark`, {
        remarks: text,
      });
      setShowRemarkModal(false);
      toast.success("Remark saved successfully");
      await fetchDetail();
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
        `/api/longStayBooking/${bookingId}/resend-mail`
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

  // ── PDF preview — shared gateway (Proforma / Final Voucher & Invoice) ──
  // `type` matches the backend enum: VOUCHER | PROFORMA_VOUCHER |
  // INVOICE | PROFORMA_INVOICE. Renders the PDF inside an iframe modal.
  const handleDownloadPdf = async (type, label) => {
    if (!bookingId) return;
    try {
      setGeneratingPdfType(type);
      const res = await axiosInstance.get(
        `/api/longStayBooking/${bookingId}/pdf`,
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
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* Header — Back + title + booking code + status badge,
                matching the hotel detail view. */}
            <div className="mb-3 d-flex align-items-center flex-wrap gap-2">
              <button
                style={BTN_NEUTRAL}
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
              {(detail?.bookingCode || rowStub?.bookingCode) && (
                <span
                  style={{
                    marginLeft: "10px",
                    fontWeight: "700",
                    fontSize: "0.95rem",
                    color: "#c0392b",
                  }}
                >
                  {detail?.bookingCode || rowStub?.bookingCode}
                </span>
              )}
              {detail && (
                <span style={{ marginLeft: "10px" }}>
                  <StatusBadge status={displayStatus} />
                </span>
              )}
            </div>

            {detailLoading || !detail ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-2 text-muted small">Loading details…</p>
              </div>
            ) : (
              <>
                {/* Booking Info */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Booking Information</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow label="Booking Code" value={detail.bookingCode} />
                        <InfoRow
                          label="Status"
                          value={<StatusBadge status={displayStatus} />}
                        />
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
                  </div>
                </div>

                {/* Room & Rate Plan */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Room &amp; Rate Plan</div>
                  <div style={{ padding: "12px 16px" }}>
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
                  </div>
                </div>

                {/* Pricing */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Pricing</div>
                  <div style={{ padding: "12px 16px" }}>
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
                          value={
                            detail.displayCurrencyCode &&
                            detail.displayCurrencyCode !== "AED" &&
                            Number(detail.displayAmount) > 0
                              ? `${detail.displayCurrencyCode} ${Number(detail.displayAmount).toFixed(2)}`
                              : detail.totalAmount
                          }
                        />
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* Primary Guest */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Primary Guest</div>
                  <div style={{ padding: "12px 16px" }}>
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
                  </div>
                </div>

                {/* Passengers */}
                {detail.rooms && detail.rooms.length > 0 && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>Passengers</div>
                    <div style={{ padding: "12px 16px" }}>
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
                    </div>
                  </div>
                )}

                {/* Remarks */}
                {detail.remarks && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>Remarks</div>
                    <div
                      style={{
                        padding: "10px 16px",
                        fontSize: "0.83rem",
                        color: "#333",
                      }}
                    >
                      {detail.remarks}
                    </div>
                  </div>
                )}

                {/* ── Related Notes (ad-hoc notes added via the NOTES modal) ──
                    Same data shown in the modal, surfaced here on the page so
                    notes are visible without opening the modal. Read-only;
                    saves still happen through the existing modal flow. */}
                <div style={card}>
                  <div style={SECTION_HEADER}>
                    Related Notes{" "}
                    {bookingNotes.length > 0 && (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          color: "#EC0B43",
                          background: "#FDE7ED",
                          borderRadius: "99px",
                          padding: "2px 9px",
                          marginLeft: 6,
                          letterSpacing: ".02em",
                        }}
                      >
                        {bookingNotes.length}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      padding: "10px 16px",
                      fontSize: "0.83rem",
                      color: "#333",
                    }}
                  >
                    {notesLoading ? (
                      <span className="text-muted">Loading notes…</span>
                    ) : bookingNotes.length === 0 ? (
                      <span className="text-muted">No notes yet.</span>
                    ) : (
                      bookingNotes.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            borderLeft: "3px solid #EC0B43",
                            background: "#FAFAF8",
                            padding: "10px 12px",
                            marginBottom: 8,
                            borderRadius: 4,
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.72rem",
                              color: "#777",
                              marginBottom: 4,
                              letterSpacing: ".01em",
                            }}
                          >
                            {n.createdBy ? `${n.createdBy} • ` : ""}
                            {n.createdDate ? formatDateTime(n.createdDate) : ""}
                          </div>
                          <div
                            style={{
                              fontSize: "0.85rem",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {n.note}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* ── Action Buttons ──────────────────────────────────
                    Ported from the hotel detail view. The PROFORMA vs
                    FINAL doc pair flips off `showsFinalDocs`. Live-booking
                    actions (Cancel / Reconfirm) are hidden once the
                    booking is cancelled, while the doc + reference actions
                    remain available. */}
                <div
                  style={{
                    marginBottom: "10px",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  {!isCancelled && (
                    <button style={BTN_DANGER} onClick={openCancelModal}>
                      CANCEL
                    </button>
                  )}

                  {!showsFinalDocs && !isCancelled && (
                    <button style={BTN_TEAL} onClick={openConfirmModal}>
                      RECONFIRM
                    </button>
                  )}

                  {!showsFinalDocs ? (
                    <>
                      <button
                        style={BTN_INFO}
                        disabled={generatingPdfType === "PROFORMA_VOUCHER"}
                        onClick={() =>
                          handleDownloadPdf(
                            "PROFORMA_VOUCHER",
                            "Proforma Voucher"
                          )
                        }
                      >
                        {generatingPdfType === "PROFORMA_VOUCHER"
                          ? "GENERATING..."
                          : "PROFORMA VOUCHER"}
                      </button>
                      <button
                        style={BTN_INFO}
                        disabled={generatingPdfType === "PROFORMA_INVOICE"}
                        onClick={() =>
                          handleDownloadPdf(
                            "PROFORMA_INVOICE",
                            "Proforma Invoice"
                          )
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
                        style={BTN_INFO}
                        disabled={generatingPdfType === "VOUCHER"}
                        onClick={() => handleDownloadPdf("VOUCHER", "Voucher")}
                      >
                        {generatingPdfType === "VOUCHER"
                          ? "GENERATING..."
                          : "VOUCHER"}
                      </button>
                      <button
                        style={BTN_INFO}
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
                    style={BTN_SKY}
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

                  {!isAgentRole && (
                    <button
                      style={BTN_INDIGO}
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

                  <button
                    style={BTN_ORANGE}
                    onClick={resendMailToAgent}
                    disabled={resendingMail}
                  >
                    {resendingMail ? "SENDING..." : "RESEND MAIL TO AGENT"}
                  </button>

                  {!isAgentRole && (
                    <button style={BTN_ACCENT} onClick={openRemarkModal}>
                      BOOKING REMARK
                    </button>
                  )}

                  {!isAgentRole && (
                    <button
                      style={BTN_NEUTRAL}
                      onClick={openNotesModal}
                    >
                      NOTES
                    </button>
                  )}
                </div>

                {/* ── Booking Date footer (matches the hotel view) ──── */}
                <div
                  style={{
                    textAlign: "right",
                    fontSize: "0.8rem",
                    color: "#555",
                    paddingBottom: "8px",
                  }}
                >
                  Booking Date : {formatDateTime(detail.bookingDateTime)}
                </div>

                {/* ── Cancel Booking Modal ──────────────────────────── */}
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
                          {detail.bookingCode || "N/A"}
                        </div>
                        {detail.hotelName && (
                          <div>
                            <strong>Hotel:</strong> {detail.hotelName}
                          </div>
                        )}
                      </div>
                      {/* Informational only — booking value warning. Mirrors
                          the Total Amount shown on the page (converted display
                          currency when available, else AED). Does not alter
                          any cancellation logic. */}
                      {detail.totalAmount != null && (
                        <div
                          className="mb-3"
                          style={{
                            border: "1px solid #ffe69c",
                            backgroundColor: "#fff3cd",
                            color: "#664d03",
                            borderRadius: "4px",
                            padding: "10px 12px",
                            fontSize: "0.9rem",
                          }}
                        >
                          <FaExclamationCircle className="me-2 text-warning" />
                          Total value of this booking is{" "}
                          <strong>
                            {detail.displayCurrencyCode &&
                            detail.displayCurrencyCode !== "AED" &&
                            Number(detail.displayAmount) > 0
                              ? `${detail.displayCurrencyCode} ${Number(
                                  detail.displayAmount,
                                ).toFixed(2)}`
                              : `AED ${Number(detail.totalAmount).toFixed(2)}`}
                          </strong>
                          .
                          <div className="fw-semibold mt-1">
                            Do you still want to cancel it?
                          </div>
                        </div>
                      )}
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

                {/* ── Reconfirm Booking Modal ───────────────────────── */}
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
                          {detail.bookingCode || "N/A"}
                        </div>
                        {detail.hotelName && (
                          <div>
                            <strong>Hotel:</strong> {detail.hotelName}
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

                {/* ── Reject Booking Modal ──────────────────────────── */}
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
                        Remarks{" "}
                        <span className="text-muted small">(optional)</span>
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
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Rejecting...
                        </>
                      ) : (
                        "Reject Booking"
                      )}
                    </Button>
                  </Modal.Footer>
                </Modal>

                {/* ── Agent Reference Modal ─────────────────────────── */}
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
                          {detail.bookingCode || "N/A"}
                        </div>
                        {detail.hotelName && (
                          <div>
                            <strong>Hotel:</strong> {detail.hotelName}
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

                {/* ── Confirmation Number Modal ─────────────────────── */}
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
                        {detail.bookingCode || "N/A"}
                      </div>
                      {detail.hotelName && (
                        <div>
                          <strong>Hotel:</strong> {detail.hotelName}
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

                {/* ── Booking Remark Modal ──────────────────────────── */}
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

                {/* ── Notes Modal — list existing notes (read-only) and add a
                    new one inline. POSTs to the SAME endpoint and payload
                    shape the standalone /notes page uses; no flow change. */}
                <Modal
                  show={showNotesModal}
                  onHide={() => {
                    if (!savingNote) setShowNotesModal(false);
                  }}
                  centered
                  backdrop="static"
                  keyboard={false}
                >
                  <Modal.Header closeButton={!savingNote}>
                    <Modal.Title style={{ fontSize: "1rem" }}>
                      Add Note
                    </Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                    <Form.Group>
                      <Form.Label className="fw-semibold">Note</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={5}
                        placeholder="Type your note here. You can enter long paragraphs."
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        disabled={savingNote}
                        style={{ resize: "vertical" }}
                      />
                    </Form.Group>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowNotesModal(false)}
                      disabled={savingNote}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={saveNote}
                      disabled={savingNote}
                    >
                      {savingNote ? (
                        <>
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Saving...
                        </>
                      ) : (
                        "OK"
                      )}
                    </Button>
                  </Modal.Footer>
                </Modal>
              </>
            )}

          </Container>
        </main>
      </div>

      {/* ── PDF Preview Modal ───────────────────────────────────────
          Renders the Proforma/Final Voucher & Invoice PDF in an iframe
          on this page (instead of a new tab). Rendered outside <main>
          so it overlays the full viewport and survives a background
          refetch. */}
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
            {detail?.bookingCode ? ` — ${detail.bookingCode}` : ""}
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
                download={`LongStayBooking_${bookingId}_${
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
