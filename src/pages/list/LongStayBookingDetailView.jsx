/**
 * LongStayBookingDetailView.jsx
 *
 * Full-page detail view for a single Long Stay booking. Visual + behavioural
 * parity with BookingDetailedView (hotel) so an operator gets the same
 * action set / layout / modals on either booking type.
 *
 * Backend endpoints (long-stay scoped) — unchanged:
 *   - Detail               : GET    /api/longStayBooking/{id}
 *   - PDF (proforma/final) : GET    /api/longStayBooking/{id}/pdf?type=...
 *   - Cancel               : POST   /api/longStayBooking/{id}/cancel
 *   - Reconfirm / Confirmation No.
 *                          : PATCH  /api/longStayBooking/{id}/confirmation-status
 *   - Agent Reference      : GET/POST /api/longStayBooking/{id}/agent-reference
 *   - Remark               : POST   /api/longStayBooking/{id}/remark
 *   - Resend mail          : POST   /api/longStayBooking/{id}/resend-mail
 *   - Notes                : GET/POST /api/longStayBooking/{id}/notes
 *   - Amendment links      : GET    /api/booking-amendment-link/parent/{code}
 *
 * Long-stay has no "On Request" flow, so the Reconfirm modal never shows
 * Reject (Reject is hotel-side On-Request-Pending only).
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

// ── Visual tokens copied from the Hotel Booking detail view ────────
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

const BTN_TEAL = { ...BUTTON_STYLE, backgroundColor: "#0d9488" }; // Reconfirm
const BTN_DANGER = { ...BUTTON_STYLE, backgroundColor: "#dc2626" }; // Cancel
const BTN_PRIMARY = { ...BUTTON_STYLE, backgroundColor: "#2563eb" }; // Add New Item
const BTN_SKY = { ...BUTTON_STYLE, backgroundColor: "#3ba2e8" }; // Add Agent Reference
const BTN_INDIGO = { ...BUTTON_STYLE, backgroundColor: "#6366f1" }; // Confirmation No.
const BTN_INFO = { ...BUTTON_STYLE, backgroundColor: "#0891b2" }; // Voucher / Invoice
const BTN_ORANGE = { ...BUTTON_STYLE, backgroundColor: "#f0922b" }; // Resend Mail
const BTN_ACCENT = { ...BUTTON_STYLE, backgroundColor: "#7c3aed" }; // Booking Remark
const BTN_NEUTRAL = { ...BUTTON_STYLE, backgroundColor: "#64748b" }; // View / Back / Notes
const BTN_HISTORY = { ...BUTTON_STYLE, backgroundColor: "#334155" }; // Booking History

// Same booking-type catalogue as the hotel view's ADD NEW ITEM modal so an
// operator can attach cross-type sub-bookings under a long-stay parent too.
// Each child is created via its OWN existing create flow with
// ?parentBookingCode set, then surfaced via /api/booking-amendment-link.
const ADD_NEW_ITEM_TYPES = [
  { key: "HOTEL", label: "Hotel Booking", route: "/new-booking/hotel" },
  { key: "HOTEL_24HR", label: "24 Hour Check-In", route: "/new-booking/hotel-24hr" },
  { key: "LONG_STAY", label: "Long Stay Booking", route: "/new-booking/long-stay" },
  { key: "DAY_STAY", label: "Day Stay Check-In", route: "/new-booking/day-stay" },
  { key: "GOV_EMPLOYEE", label: "Government Employee", route: "/new-booking/gov-employee" },
  { key: "STUDENT", label: "Student Booking", route: "/new-booking/student" },
  { key: "SENIOR_CITIZEN", label: "Senior Citizen Booking", route: "/new-booking/senior-citizen" },
];

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

// Per-part coloured status pill — copied from the hotel view.
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

// Date/time helpers used by the History modal columns.
const parseLocal = (str) => {
  if (!str) return null;
  const normalized = String(str).includes("T") ? str : `${str}T00:00:00`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
};
const formatDateOnly = (dateStr) => {
  const d = parseLocal(dateStr);
  if (!d) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
};
const formatTimeOnly = (dateStr) => {
  const d = parseLocal(dateStr);
  if (!d) return "-";
  const hrs = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${hrs}:${min}:${sec}`;
};

export default function LongStayBookingDetailView() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  // Agent-role gate (UI visibility only).
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

  // Reconfirm — long stay has no On Request flow, so no Reject branch.
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmingBooking, setConfirmingBooking] = useState(false);

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

  // Notes
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [bookingNotes, setBookingNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);

  // Resend Mail to Agent
  const [resendingMail, setResendingMail] = useState(false);

  // PDF generation feedback + in-page preview (iframe modal).
  const [generatingPdfType, setGeneratingPdfType] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);

  // Booking History modal (read-only timeline).
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // ADD NEW ITEM (cross-type amendment) — picker + linked children list.
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedAddItemType, setSelectedAddItemType] = useState(
    ADD_NEW_ITEM_TYPES[0].key,
  );
  const [amendmentLinks, setAmendmentLinks] = useState([]);

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

  // Cross-type amendment children, keyed off this long-stay's bookingCode as
  // the parent. Read-only; failures leave the list empty so nothing else on
  // the page is affected.
  const amendmentParentCode = detail?.bookingCode;
  useEffect(() => {
    let alive = true;
    if (!amendmentParentCode) {
      setAmendmentLinks([]);
      return undefined;
    }
    axiosInstance
      .get(
        `/api/booking-amendment-link/parent/${encodeURIComponent(
          amendmentParentCode,
        )}`,
      )
      .then((res) => {
        if (!alive) return;
        setAmendmentLinks(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => alive && setAmendmentLinks([]));
    return () => { alive = false; };
  }, [amendmentParentCode]);

  // ── Status helpers (mirror BookingDetailedView) ────────────────────
  // confirmationStatus drives the explicit lifecycle ("ReConfirmed" /
  // "Rejected"), but a freshly created long-stay booking leaves it null and
  // only sets bookingStatus = "CONFIRMED". So derive an effective status that
  // falls back to bookingStatus — otherwise the Confirmed state would be
  // treated as "no status" and Agent Reference / Confirmation No. would stay
  // locked even though the booking is already Confirmed.
  const rawConfStatus = String(detail?.confirmationStatus || "").trim();
  const normalizedConf = rawConfStatus.replace(/\s+/g, "").toUpperCase();
  const isCancelled =
    detail?.bookingStatus === "CANCELLED" ||
    detail?.cancelStatus === true ||
    normalizedConf === "CANCELLED";
  const isReconfirmed =
    detail?.reconfirmation === true || normalizedConf === "RECONFIRMED";

  // Non-cancel status label. Long-stay bookings are always created CONFIRMED,
  // so an unset confirmationStatus is treated as "Confirmed".
  const baseStatusLabel = isReconfirmed
    ? "ReConfirmed"
    : rawConfStatus && normalizedConf !== "CANCELLED"
    ? rawConfStatus // e.g. "Rejected"
    : "Confirmed";

  const showsFinalDocs =
    isReconfirmed || normalizedConf === "COMPLETED";
  // Confirmed-or-better unlocks Agent Reference / Confirmation No.
  const isConfirmedOrLater =
    isReconfirmed ||
    baseStatusLabel.toUpperCase() === "CONFIRMED" ||
    normalizedConf === "COMPLETED";

  // Pre-cancellation doc / reference gating — read the persisted
  // cancelledFromStatus when present, else the live flags.
  const priorStatus = String(detail?.cancelledFromStatus || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const cancelledShowsFinalDocs =
    priorStatus === "RECONFIRMED" || priorStatus === "COMPLETED" || isReconfirmed;
  const cancelledFromConfirmedOrLater =
    priorStatus === "CONFIRMED" ||
    priorStatus === "RECONFIRMED" ||
    priorStatus === "COMPLETED" ||
    isConfirmedOrLater;

  // Status label fed to the badge. When cancelled, surface the prior status so
  // e.g. a confirmed booking shows "Confirmed/Cancelled" (not just
  // "Cancelled"). cancelledFromStatus is persisted by the cancel flow; for
  // older rows we reconstruct it (every long-stay starts Confirmed).
  const displayStatus = isCancelled
    ? detail?.cancelledFromStatus
      ? `${detail.cancelledFromStatus}/Cancelled`
      : `${baseStatusLabel}/Cancelled`
    : baseStatusLabel;

  // Cancel button gate: cancellation isn't allowed once the stay has started.
  const isPastCheckIn = (() => {
    const raw = detail?.checkInDate;
    if (!raw) return false;
    const checkIn = new Date(
      String(raw).includes("T") ? raw : `${raw}T00:00:00`,
    );
    if (isNaN(checkIn.getTime())) return false;
    return new Date().getTime() > checkIn.getTime();
  })();

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

  // ── Reconfirm (no Reject — long stay has no On Request flow) ───────
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

  // ── Confirmation Number ────────────────────────────────────────────
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

  // ── Notes ─────────────────────────────────────────────────────────
  const fetchNotes = useCallback(() => {
    if (!bookingId) return undefined;
    setNotesLoading(true);
    return axiosInstance
      .get(`/api/longStayBooking/${bookingId}/notes`)
      .then((res) => {
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

  // ── PDF preview ────────────────────────────────────────────────────
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

  // Booking lifecycle events for the History modal. Each row is gated on its
  // backend timestamp being present and shows the per-action "Performed By"
  // the backend now records (createdBy / confirmedBy / reconfirmedBy /
  // cancelledBy). Created falls back to the employee/creator label; sorted
  // chronologically — mirrors the hotel detail view.
  const creatorLabel =
    detail?.confirmedBy || detail?.employeeName || "-";
  const bookingHistory = (() => {
    if (!detail) return [];
    const events = [];
    if (detail.bookingDateTime) {
      events.push({
        action: "Booking Created",
        at: detail.bookingDateTime,
        by: creatorLabel,
      });
    }
    if (detail.confirmedDate) {
      events.push({
        action: "Booking Confirmed",
        at: detail.confirmedDate,
        by: detail.confirmedBy || "-",
      });
    }
    if (detail.reconfirmedDate) {
      events.push({
        action: "Booking Reconfirmed",
        at: detail.reconfirmedDate,
        by: detail.reconfirmedBy || "-",
      });
    }
    if (detail.cancelledAt) {
      events.push({
        action: "Booking Cancelled",
        at: detail.cancelledAt,
        by: detail.cancelledBy || "-",
      });
    }
    return events.sort((a, b) => {
      const da = parseLocal(a.at)?.getTime() ?? 0;
      const db = parseLocal(b.at)?.getTime() ?? 0;
      return da - db;
    });
  })();

  // Currency formatting helper used by the Cancel-modal warning + summary.
  const currencyLabel = (amountAed) => {
    if (amountAed == null) return "-";
    if (
      detail?.displayCurrencyCode &&
      detail.displayCurrencyCode !== "AED" &&
      Number(detail.displayAmount) > 0
    ) {
      return `${detail.displayCurrencyCode} ${Number(detail.displayAmount).toFixed(2)}`;
    }
    return `AED ${Number(amountAed).toFixed(2)}`;
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* Back button — header layout matches the hotel view. */}
            <div className="mb-3">
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
            </div>

            {detailLoading ? (
              <div className="text-center py-5">
                <Spinner animation="border" style={{ color: "#c0392b" }} />
                <p className="mt-3 text-muted">Loading booking details...</p>
              </div>
            ) : !detail ? (
              <div className="text-center py-5 text-muted">
                Booking not found.
              </div>
            ) : (
              <>
                {/* ── Booking Info ──────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Booking Information</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow
                          label="Booking Code"
                          value={detail.bookingCode}
                        />
                        <InfoRow label="Hotel Name" value={detail.hotelName} />
                        <InfoRow
                          label="Check-In"
                          value={formatDateTime(detail.checkInDate)}
                        />
                        <InfoRow
                          label="Check-Out"
                          value={formatDateTime(detail.checkOutDate)}
                        />
                        <InfoRow
                          label="No. of Nights"
                          value={
                            detail.totalNights
                              ? `${detail.totalNights} Night${detail.totalNights !== 1 ? "s" : ""}`
                              : "-"
                          }
                        />
                        {detail.bookingDateTime && (
                          <InfoRow
                            label="Booking Date"
                            value={formatDateTime(detail.bookingDateTime)}
                          />
                        )}
                      </Col>
                      <Col md={6}>
                        {detail.employeeName && (
                          <InfoRow
                            label="Booked By Employee"
                            value={detail.employeeName}
                          />
                        )}
                        <InfoRow
                          label="Agent Reference"
                          value={detail.agentLpo}
                        />
                        <InfoRow
                          label="Confirmation No."
                          value={detail.confirmationNumber}
                        />
                        <InfoRow
                          label="Cancel Status"
                          value={detail.cancelStatus ? "Cancelled" : "Active"}
                        />
                        <InfoRow
                          label="Status"
                          value={<StatusBadge status={displayStatus} />}
                        />
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Room & Rate Plan ──────────────────────────────── */}
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

                {/* ── Pricing ──────────────────────────────────────── */}
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
                          value={currencyLabel(detail.totalAmount)}
                        />
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Primary Guest ─────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Primary Guest</div>
                  <div style={{ padding: "12px 16px" }}>
                    {detail.primaryGuestDetails ? (
                      <Row>
                        <Col md={6}>
                          <InfoRow
                            label="Name"
                            value={[
                              detail.primaryGuestDetails.salutation,
                              detail.primaryGuestDetails.firstName,
                              detail.primaryGuestDetails.middleName,
                              detail.primaryGuestDetails.lastName,
                            ]
                              .filter(Boolean)
                              .join(" ")
                              .trim() || "-"}
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

                {/* ── Passengers ────────────────────────────────────── */}
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

                {/* ── Related Sub-Bookings of OTHER types (amendment links) ──
                    Hotel / 24Hr / Day Stay / Gov / Student / Senior Citizen
                    children attached to this long-stay parent via
                    /api/booking-amendment-link. */}
                {amendmentLinks && amendmentLinks.length > 0 && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>
                      Related Sub-Bookings — Other Types ({amendmentLinks.length})
                    </div>
                    <div style={{ padding: "10px 16px" }}>
                      {amendmentLinks.map((lnk) => (
                        <div
                          key={lnk.id}
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
                              {lnk.childBookingCode || "-"}
                              <span
                                style={{
                                  marginLeft: "8px",
                                  color: "#888",
                                  fontWeight: "500",
                                  fontSize: "0.8rem",
                                }}
                              >
                                ({lnk.childTypeLabel || lnk.childType})
                              </span>
                            </span>
                            {lnk.childDetailRoutePrefix && lnk.childBookingId != null && (
                              <button
                                style={BTN_NEUTRAL}
                                onClick={() =>
                                  navigate(
                                    `${lnk.childDetailRoutePrefix}${lnk.childBookingId}`,
                                  )
                                }
                              >
                                View
                              </button>
                            )}
                          </div>
                          <Row>
                            <Col md={6}>
                              <InfoRow
                                label="Booking Type"
                                value={lnk.childTypeLabel || lnk.childType}
                              />
                              <InfoRow
                                label="Reference No."
                                value={lnk.childReferenceNumber}
                              />
                              <InfoRow label="Hotel" value={lnk.childHotelName} />
                            </Col>
                            <Col md={6}>
                              <InfoRow
                                label="Check-In"
                                value={lnk.childCheckInDate}
                              />
                              <InfoRow
                                label="Check-Out"
                                value={lnk.childCheckOutDate}
                              />
                              <InfoRow
                                label="Total Rate"
                                value={
                                  lnk.childTotalRate != null
                                    ? Number(lnk.childTotalRate).toFixed(2)
                                    : "-"
                                }
                              />
                              <InfoRow
                                label="Status"
                                value={<StatusBadge status={lnk.childStatus} />}
                              />
                            </Col>
                          </Row>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Remarks ───────────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>
                    Remarks{" "}
                    <span style={{ fontSize: "1rem", color: "#555" }}>⊟</span>
                  </div>
                  <div
                    style={{
                      padding: "10px 16px",
                      fontSize: "0.83rem",
                      color: "#333",
                    }}
                  >
                    {detail.remarks ? (
                      <p style={{ marginBottom: 0 }}>{detail.remarks}</p>
                    ) : (
                      <span className="text-muted">No remarks.</span>
                    )}
                  </div>
                </div>

                {/* ── Related Notes ─────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>
                    Notes{" "}
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
                    Cancelled and live bookings render different rows, same as
                    the hotel detail view. Cancelled keeps the doc / agent-ref /
                    confirmation-no. / resend / remark / notes / history set,
                    but drops Add New Item / Cancel / Reconfirm. */}
                {isCancelled && (
                  <div
                    style={{
                      marginBottom: "10px",
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    {cancelledShowsFinalDocs ? (
                      <button
                        style={BTN_INFO}
                        disabled={generatingPdfType === "INVOICE"}
                        onClick={() =>
                          handleDownloadPdf("INVOICE", "Invoice")
                        }
                      >
                        {generatingPdfType === "INVOICE"
                          ? "GENERATING..."
                          : "INVOICE"}
                      </button>
                    ) : (
                      <>
                        <button
                          style={BTN_INFO}
                          disabled={generatingPdfType === "PROFORMA_VOUCHER"}
                          onClick={() =>
                            handleDownloadPdf(
                              "PROFORMA_VOUCHER",
                              "Proforma Voucher",
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
                              "Proforma Invoice",
                            )
                          }
                        >
                          {generatingPdfType === "PROFORMA_INVOICE"
                            ? "GENERATING..."
                            : "PROFORMA INVOICE"}
                        </button>
                      </>
                    )}

                    <button
                      style={BTN_SKY}
                      onClick={() => {
                        if (!cancelledFromConfirmedOrLater) {
                          toast.error(
                            "Agent Reference can only be added once the booking is Confirmed or ReConfirmed.",
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
                          if (!cancelledFromConfirmedOrLater) {
                            toast.error(
                              "Confirmation Number can only be added once the booking is Confirmed or ReConfirmed.",
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

                    <button
                      style={BTN_HISTORY}
                      onClick={() => setShowHistoryModal(true)}
                    >
                      HISTORY
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
                      style={BTN_PRIMARY}
                      onClick={() => {
                        setSelectedAddItemType(ADD_NEW_ITEM_TYPES[0].key);
                        setShowAddItemModal(true);
                      }}
                    >
                      ADD NEW ITEM
                    </button>

                    <button
                      style={{
                        ...BTN_DANGER,
                        opacity: isPastCheckIn ? 0.55 : 1,
                        cursor: isPastCheckIn ? "not-allowed" : "pointer",
                      }}
                      onClick={openCancelModal}
                      disabled={isPastCheckIn}
                      title={
                        isPastCheckIn
                          ? "Cancellation is not allowed after the check-in date."
                          : undefined
                      }
                    >
                      CANCEL
                    </button>

                    {!showsFinalDocs && (
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
                              "Proforma Voucher",
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
                              "Proforma Invoice",
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
                            "Agent Reference can only be added once the booking is Confirmed or ReConfirmed.",
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
                              "Confirmation Number can only be added once the booking is Confirmed or ReConfirmed.",
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

                    <button
                      style={BTN_HISTORY}
                      onClick={() => setShowHistoryModal(true)}
                    >
                      HISTORY
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
                  Booking Date : {formatDateTime(detail.bookingDateTime)}
                </div>

                {/* ── Add New Item (Amendment) booking-type picker ──────── */}
                <Modal
                  show={showAddItemModal}
                  onHide={() => setShowAddItemModal(false)}
                  centered
                >
                  <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: "1.05rem" }}>
                      Add New Item
                    </Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                    <div style={{ marginBottom: "10px", color: "#555" }}>
                      Select a booking type to add as a sub-booking of{" "}
                      <strong>{detail?.bookingCode}</strong>.
                    </div>
                    <Form>
                      {ADD_NEW_ITEM_TYPES.map((t) => (
                        <Form.Check
                          key={t.key}
                          type="radio"
                          name="addNewItemType"
                          id={`add-item-${t.key}`}
                          label={t.label}
                          value={t.key}
                          checked={selectedAddItemType === t.key}
                          onChange={() => setSelectedAddItemType(t.key)}
                          style={{ marginBottom: "6px" }}
                        />
                      ))}
                    </Form>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button
                      variant="secondary"
                      onClick={() => setShowAddItemModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        const chosen = ADD_NEW_ITEM_TYPES.find(
                          (t) => t.key === selectedAddItemType,
                        );
                        if (!chosen) return;
                        const parent = detail?.bookingCode;
                        if (!parent) return;
                        setShowAddItemModal(false);
                        navigate(
                          `${chosen.route}?parentBookingCode=${encodeURIComponent(
                            parent,
                          )}`,
                        );
                      }}
                    >
                      Continue
                    </Button>
                  </Modal.Footer>
                </Modal>

                {/* ── Booking History Modal ─────────────────────────── */}
                <Modal
                  show={showHistoryModal}
                  onHide={() => setShowHistoryModal(false)}
                  centered
                  size="lg"
                  scrollable
                >
                  <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: "1.05rem" }}>
                      Booking History
                      {detail?.bookingCode ? ` — ${detail.bookingCode}` : ""}
                    </Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                    {bookingHistory.length === 0 ? (
                      <div className="text-muted text-center py-3">
                        No history available for this booking.
                      </div>
                    ) : (
                      <Table
                        responsive
                        bordered
                        hover
                        size="sm"
                        className="mb-0"
                        style={{ fontSize: "0.85rem" }}
                      >
                        <thead style={{ backgroundColor: "#f0f0f0" }}>
                          <tr>
                            <th style={{ width: "60px" }}>S/N</th>
                            <th>Action</th>
                            <th>Performed By</th>
                            <th>Date</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookingHistory.map((ev, idx) => (
                            <tr key={`${ev.action}-${idx}`}>
                              <td>{idx + 1}</td>
                              <td>{ev.action}</td>
                              <td>{ev.by || "-"}</td>
                              <td>{formatDateOnly(ev.at)}</td>
                              <td>{formatTimeOnly(ev.at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </Modal.Body>
                  <Modal.Footer>
                    <Button
                      variant="secondary"
                      onClick={() => setShowHistoryModal(false)}
                    >
                      Close
                    </Button>
                  </Modal.Footer>
                </Modal>

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
                      {(detail.bookingCode || detail.hotelName) && (
                        <div className="text-muted small mb-3">
                          {detail.bookingCode && (
                            <div>
                              <strong>Booking Code:</strong>{" "}
                              {detail.bookingCode}
                            </div>
                          )}
                          {detail.hotelName && (
                            <div>
                              <strong>Hotel:</strong> {detail.hotelName}
                            </div>
                          )}
                        </div>
                      )}
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
                          <strong>{currencyLabel(detail.totalAmount)}</strong>.
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

                {/* ── Reconfirm Booking Modal ─────────────────────────
                    No Reject branch — long-stay has no "On Request" flow.
                    Reject is the hotel-side on-request-pending action only. */}
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
                      {(detail.bookingCode || detail.hotelName) && (
                        <div className="text-muted small mb-3">
                          {detail.bookingCode && (
                            <div>
                              <strong>Booking Code:</strong>{" "}
                              {detail.bookingCode}
                            </div>
                          )}
                          {detail.hotelName && (
                            <div>
                              <strong>Hotel:</strong> {detail.hotelName}
                            </div>
                          )}
                        </div>
                      )}
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
                      onClick={() => setShowConfirmModal(false)}
                      disabled={confirmingBooking}
                    >
                      Cancel
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
                        "Reconfirm"
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
                      {(detail.bookingCode || detail.hotelName) && (
                        <div className="text-muted small mb-3">
                          {detail.bookingCode && (
                            <div>
                              <strong>Booking Code:</strong>{" "}
                              {detail.bookingCode}
                            </div>
                          )}
                          {detail.hotelName && (
                            <div>
                              <strong>Hotel:</strong> {detail.hotelName}
                            </div>
                          )}
                        </div>
                      )}
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
                    {(detail.bookingCode || detail.hotelName) && (
                      <div className="text-muted small mb-3">
                        {detail.bookingCode && (
                          <div>
                            <strong>Booking Code:</strong>{" "}
                            {detail.bookingCode}
                          </div>
                        )}
                        {detail.hotelName && (
                          <div>
                            <strong>Hotel:</strong> {detail.hotelName}
                          </div>
                        )}
                      </div>
                    )}
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

                {/* ── Notes Modal ───────────────────────────────────── */}
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

      {/* ── PDF Preview Modal ─────────────────────────────────────── */}
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
