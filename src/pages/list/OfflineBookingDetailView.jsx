/**
 * OfflineBookingDetailView.jsx
 *
 * Full-page detail view for a single offline booking, laid out like the
 * hotel booking details page (BookingDetailedView): Booking / Guest /
 * Agent Information, Services Details (one block per line, like Rooms
 * Details), Cancellation Policy, Remarks and the action buttons.
 *   - Everything shown:          GET  /api/v1/offline-booking/{id}/details
 *     (fallback for an older backend: GET /api/v1/offline-booking/list/{invoiceNumber}/{id})
 *   - Confirm (On Request):      POST /api/v1/offline-booking/{id}/confirm
 *   - PDF (voucher/invoice/tax): GET  /api/offline_booking/{id}/pdf?type=...
 *   - Email PDF:                 POST /api/v1/offline-booking/send-pdf-email
 *
 * The list page passes its row in location.state so the header shows at
 * once; the details call then fills in every field.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Table,
  Spinner,
  Form,
  Modal,
  Button,
  InputGroup,
} from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaEnvelope, FaPaperPlane, FaDownload, FaExclamationCircle } from "react-icons/fa";
import {
  FaHistory, FaMapMarkerAlt, FaNetworkWired, FaCalendarAlt, FaClock,
  FaUserAlt, FaPlusCircle, FaCheckCircle, FaTimesCircle,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { getCurrentActiveRole, getUserRole } from "../../utils/authSession";
import { uaeNowInputValue, formatUaeDateTime } from "../../utils/dateUtils";
import useOperatorLocation from "../../hooks/useOperatorLocation";

// Who may confirm an On Request offline booking — the backend's staff roles
// (RecordAccessGuard.STAFF_ROLES); the server checks it again.
const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN", "GREAT_ADMIN", "STAFF"];
const isStaffOrAdmin = () => {
  const active = String(getCurrentActiveRole() || "").trim().toUpperCase();
  if (active) return STAFF_ROLES.includes(active);
  return String(getUserRole() || "")
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .some((r) => STAFF_ROLES.includes(r));
};

// ── Look of the hotel booking details page (BookingDetailedView) ────────
// Same section cards, grey section headers, label / value rows, status
// colours and button shapes, so the two detail pages read alike.
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
const INFO_VALUE = { color: "#222", fontSize: "0.82rem" };
const CARD = {
  border: "1px solid #ddd",
  borderRadius: "4px",
  marginBottom: "14px",
  overflow: "hidden",
  backgroundColor: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};
const BODY_TEXT = { padding: "10px 16px", fontSize: "0.83rem", color: "#333" };

// Hotel-line details already shown as columns of the Rooms Details table,
// so they are not repeated in the info rows above it.
const ROOM_TABLE_LABELS = ["Room Type", "Meal Plan", "Add On", "Nights", "Rooms"];

// Red room / block title and the small grey note under a cell — hotel page look.
const ROOM_TITLE = { color: "#c0392b", fontWeight: "700", fontSize: "0.88rem", marginBottom: "6px" };
const SMALL_NOTE = { fontSize: "0.68rem", color: "#888", marginTop: 2 };

function InfoRow({ label, value }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div style={{ marginBottom: "6px", display: "flex", alignItems: "flex-start" }}>
      <span style={INFO_LABEL}>{label}</span>
      <span style={{ ...INFO_VALUE, marginLeft: "8px" }}>{empty ? "-" : value}</span>
    </div>
  );
}

// Same badge as the hotel booking details page: each part of a combined
// label is coloured on its own — in "On Request/Confirmed/Cancelled" the
// "On Request" word is orange, "Confirmed" green and "Cancelled" red.
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

// Money: added up as whole cents (exact), shown with 2 decimals.
const centsOf = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const money = (value) =>
  Number.isFinite(parseFloat(value)) ? (centsOf(value) / 100).toFixed(2) : "-";

// ON_REQUEST / CONFIRMED / CANCELLED; older rows without statusCode fall
// back to the status label.
const statusCodeOf = (b) => {
  if (b?.statusCode) return b.statusCode;
  const label = String(b?.bookingStatus || "").replace(/[\s_-]+/g, "").toLowerCase();
  if (label === "onrequest") return "ON_REQUEST";
  if (label === "cancelled") return "CANCELLED";
  return "CONFIRMED";
};

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

// Purpose colours of the hotel page's action buttons.
const BTN_SUCCESS = { ...BUTTON_STYLE, backgroundColor: "#16a34a" }; // Confirm
const BTN_INFO = { ...BUTTON_STYLE, backgroundColor: "#0891b2" }; // Voucher / Invoice
const BTN_NEUTRAL = { ...BUTTON_STYLE, backgroundColor: "#64748b" }; // Back
const BTN_DANGER = { ...BUTTON_STYLE, backgroundColor: "#dc2626" }; // Cancel
// The hotel page's colours for its booking-action buttons (Notes uses BTN_NEUTRAL there too).
const BTN_SKY = { ...BUTTON_STYLE, backgroundColor: "#3ba2e8" }; // Add Agent Reference
const BTN_INDIGO = { ...BUTTON_STYLE, backgroundColor: "#6366f1" }; // Confirmation No.
const BTN_ORANGE = { ...BUTTON_STYLE, backgroundColor: "#f0922b" }; // Resend Mail
const BTN_ACCENT = { ...BUTTON_STYLE, backgroundColor: "#7c3aed" }; // Booking Remark
const BTN_HISTORY = { ...BUTTON_STYLE, backgroundColor: "#334155" }; // Booking History

// Booking History badges — the hotel page's, for the steps an offline
// booking can go through.
const HISTORY_ACTION_META = {
  "Booking Created": { bg: "#e6f4ea", fg: "#1e7e34", icon: FaPlusCircle },
  "Booking Confirmed": { bg: "#e7f1ff", fg: "#1d4ed8", icon: FaCheckCircle },
  "Booking Cancelled": { bg: "#fdecea", fg: "#c0392b", icon: FaTimesCircle },
};
const HISTORY_ACTION_FALLBACK = { bg: "#f1f5f9", fg: "#475569", icon: FaHistory };

// Dates for History and Notes: "2026-11-19 13:44" (details response) or an
// ISO date-time (a note's createdAt), read as local wall-clock time.
const parseDateTime = (value) => {
  if (!value) return null;
  const s = String(value).trim();
  const normalized = s.includes("T") ? s : s.includes(" ") ? s.replace(" ", "T") : `${s}T00:00:00`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
};
const historyDate = (value) => {
  const d = parseDateTime(value);
  if (!d) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
};
const historyTime = (value) => {
  const d = parseDateTime(value);
  if (!d) return "-";
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
};
const noteDateTime = (value) =>
  parseDateTime(value) ? `${historyDate(value)} ${historyTime(value)}` : "-";

export default function OfflineBookingDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Booking History "Location" for Confirm / Cancel, as the hotel page records it.
  const operatorLocation = useOperatorLocation();
  const location = useLocation();

  // booking summary (header info). Comes from location.state when the
  // user clicks the eye icon, else fetched from the all-list endpoint
  // on hard refresh so the page survives reloads.
  const [booking, setBooking] = useState(location.state?.booking || null);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingBooking, setLoadingBooking] = useState(!booking);

  // PDF modal state (Voucher / Invoice / Tax)
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sendingMail, setSendingMail] = useState(false);

  // On Request → Confirmed (staff, before the cancellation deadline).
  const [confirming, setConfirming] = useState(false);
  const statusCode = statusCodeOf(booking);
  const isOnRequest = statusCode === "ON_REQUEST";
  // "yyyy-MM-dd HH:mm" (UAE) vs UAE now — same-format strings compare in time order.
  const deadlinePassed =
    isOnRequest &&
    !!booking?.cancellationDeadline &&
    String(booking.cancellationDeadline).replace(" ", "T").slice(0, 16) <= uaeNowInputValue();
  const canConfirm = isOnRequest && !deadlinePassed && isStaffOrAdmin();

  const handleConfirm = async () => {
    if (!booking) return;
    // Confirming debits the booking's total from the agent's credit (the
    // server refuses it when the agent hasn't enough), and a cancellation
    // after that refunds nothing — say so before staff press Yes.
    const esc = (s) =>
      String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const total = money(totalsView.grandTotal);
    const agentName = booking.agentName || "the agent";
    const result = await Swal.fire({
      title: "Confirm this booking?",
      html:
        (booking.cancellationDeadline
          ? `<div>Cancellation deadline: ${esc(formatUaeDateTime(booking.cancellationDeadline))} (UAE time)</div>`
          : "") +
        (Number(totalsView.grandTotal) > 0
          ? `<div style="margin-top:8px"><b>AED ${esc(total)}</b> will be debited from ${esc(agentName)}'s credit.</div>` +
            `<div style="margin-top:6px;font-size:0.9em;color:#842029">Cancelled before the cancellation deadline, it is refunded; cancelled after the deadline, it is not.</div>`
          : ""),
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, confirm it",
    });
    if (!result.isConfirmed) return;
    setConfirming(true);
    try {
      const res = await axiosInstance.post(
        `/api/v1/offline-booking/${booking.supplierMainBasicId}/confirm`,
        // Booking History: where it was confirmed from (the server adds the IP).
        { bookingLocation: operatorLocation },
      );
      setBooking((prev) => ({ ...prev, ...res.data }));
      toast.success("Booking confirmed");
      loadDetails(); // refresh every field (status, confirmed by / at)
    } catch (error) {
      console.error("Error confirming offline booking:", error);
      toast.error(error.response?.data?.message || "Failed to confirm booking");
    } finally {
      setConfirming(false);
    }
  };

  // Cancel — same button and dialog as the hotel booking details page. The
  // reason is required. The server refuses a booking already cancelled or one
  // whose hotel check-in date has come (UAE), and says why in
  // cancelBlockedReason so the button can be greyed out with that message.
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellingBooking, setCancellingBooking] = useState(false);
  const isCancelled = statusCode === "CANCELLED";
  const cancelBlockedReason = booking?.cancelBlockedReason || "";

  // Agent credit on cancel — the hotel booking page's rule. A confirmed
  // booking's debit goes back when it is cancelled before its cancellation
  // deadline; at or after the deadline nothing is refunded, and staff must
  // tick that they accept it (the server refuses the cancel otherwise).
  // "yyyy-MM-dd HH:mm" (UAE) vs UAE now — same-format strings compare in time order.
  const debitedAmount = Number(booking?.agentCreditDebited) || 0;
  const cancelPastDeadline =
    !!booking?.cancellationDeadline &&
    String(booking.cancellationDeadline).replace(" ", "T").slice(0, 16) <= uaeNowInputValue();
  const needsChargeAcknowledgement = debitedAmount > 0 && cancelPastDeadline;
  const [acceptCancellationCharges, setAcceptCancellationCharges] = useState(false);

  const openCancelModal = () => {
    setCancellationReason("");
    setAcceptCancellationCharges(false);
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    if (cancellingBooking) return;
    setShowCancelModal(false);
    setCancellationReason("");
    setAcceptCancellationCharges(false);
  };

  const cancelBooking = async () => {
    const reason = cancellationReason.trim();
    if (!reason) {
      toast.error("Please enter a cancellation reason.");
      return;
    }
    if (!booking?.supplierMainBasicId) return;
    setCancellingBooking(true);
    try {
      const res = await axiosInstance.post(
        `/api/v1/offline-booking/${booking.supplierMainBasicId}/cancel`,
        // Booking History: where it was cancelled from (the server adds the IP).
        // Past the deadline, the operator's acceptance that nothing is refunded.
        {
          reason,
          bookingLocation: operatorLocation,
          ...(needsChargeAcknowledgement ? { acceptCancellationCharges } : {}),
        },
      );
      setShowCancelModal(false);
      setCancellationReason("");
      setAcceptCancellationCharges(false);
      setBooking((prev) => ({ ...prev, statusCode: "CANCELLED", bookingStatus: "Cancelled" }));
      toast.success(res.data?.message || "Booking cancelled");
      loadDetails(); // refresh every field (cancelled date / by / reason)
    } catch (error) {
      console.error("Error cancelling offline booking:", error);
      toast.error(error.response?.data?.message || "Failed to cancel booking.");
    } finally {
      setCancellingBooking(false);
    }
  };

  // Everything about the booking in one call — GET
  // /api/v1/offline-booking/{id}/details: the booking's own fields, every
  // line with its amounts and details, and exact totals. Works on a hard
  // refresh and for cancelled bookings (the list used before leaves those
  // out). If it fails (e.g. an older backend), the lines still load from the
  // list endpoint for the booking the list page passed in.
  const [totals, setTotals] = useState(null);
  const loadDetails = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await axiosInstance.get(`/api/v1/offline-booking/${id}/details`);
      setBooking((prev) => ({ ...(prev || {}), ...(res.data?.booking || {}) }));
      setItems(Array.isArray(res.data?.lines) ? res.data.lines : []);
      setTotals(res.data?.totals || null);
    } catch (e) {
      console.error("Failed to load offline booking details", e);
      const fromList = location.state?.booking;
      if (fromList?.invoiceNumber && fromList?.supplierMainBasicId) {
        try {
          const res = await axiosInstance.get(
            `/api/v1/offline-booking/list/${fromList.invoiceNumber}/${fromList.supplierMainBasicId}`,
          );
          setItems(Array.isArray(res.data) ? res.data : []);
        } catch (e2) {
          console.error("Failed to load offline-booking items", e2);
          toast.error("Failed to load booking details");
        }
      } else {
        toast.error(e.response?.data?.message || "Failed to load booking");
      }
    } finally {
      setLoadingItems(false);
      setLoadingBooking(false);
    }
    // location.state is read once, as a fallback only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // Cancelled while still On Request (Cancel button or the deadline job):
  // never confirmed, so nothing is charged and the totals read 0.00, as on
  // the invoice. The server says so; worked out here for an older backend.
  const cancelledWithoutConfirming =
    booking?.cancelledWithoutConfirming ??
    (statusCode === "CANCELLED" && !!booking?.cancellationDeadline && !booking?.confirmedAt);

  // Totals footer: the server's exact sums; added up here (in cents) from
  // the lines when an older backend didn't send them.
  const lineTotals =
    totals ||
    (() => {
      const sub = items.reduce((s, it) => s + centsOf(it.subTotal), 0);
      const tax = items.reduce((s, it) => s + centsOf(it.taxAmount), 0);
      const qty = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0), 0);
      return {
        quantity: qty,
        beforeTax: (sub - tax) / 100,
        taxAmount: tax / 100,
        subTotal: sub / 100,
        grandTotal: sub / 100,
      };
    })();
  // Cancelled with nothing to pay, as on the hotel booking: never confirmed,
  // or confirmed and cancelled before its cancellation deadline (the debit was
  // refunded; no deadline counts as before it). Totals read 0.00, as on the
  // invoice. At / after the deadline the full amount stays.
  const cancelledFreeOfCharge =
    booking?.cancelledFreeOfCharge ??
    (statusCode === "CANCELLED" &&
      (cancelledWithoutConfirming ||
        !booking?.cancellationDeadline ||
        (!!booking?.cancelledAt &&
          String(booking.cancelledAt).replace(" ", "T").slice(0, 16) <
            String(booking.cancellationDeadline).replace(" ", "T").slice(0, 16))));
  const totalsView = cancelledFreeOfCharge
    ? { ...lineTotals, beforeTax: 0, taxAmount: 0, subTotal: 0, grandTotal: 0 }
    : lineTotals;

  const handlePdfClick = async (type) => {
    if (!booking) return;
    setPdfTitle(type);
    setShowPdfModal(true);
    setLoadingPdf(true);
    setPdfUrl("");
    try {
      const response = await axiosInstance.get(
        `/api/offline_booking/${booking.supplierMainBasicId}/pdf`,
        { params: { type: type.toUpperCase() } },
      );
      if (response.data && response.data.status === "SUCCESS") {
        setPdfUrl(response.data.pdfUrl);
      } else {
        toast.error(response.data?.message || `Failed to generate ${type}`);
        setShowPdfModal(false);
      }
    } catch (error) {
      console.error(`Error fetching ${type} PDF:`, error);
      // e.g. "This booking is On Request. Confirm it first — …" for a voucher.
      toast.error(error.response?.data?.message || `Failed to load ${type}`);
      setShowPdfModal(false);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleSendMail = async () => {
    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Invalid email format");
      return;
    }
    setEmailError("");
    setSendingMail(true);
    try {
      const response = await axiosInstance.post(
        "/api/v1/offline-booking/send-pdf-email",
        {
          email,
          pdfUrl,
          type: pdfTitle,
          invoiceNumber: booking?.invoiceNumber,
          bookingId: booking?.supplierMainBasicId,
        },
      );
      if (response.status === 200) {
        toast.success("Email sent successfully");
        setEmail("");
      } else {
        toast.error("Failed to send email");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("An error occurred while sending email");
    } finally {
      setSendingMail(false);
    }
  };

  const closePdfModal = () => {
    setShowPdfModal(false);
    setEmail("");
    setEmailError("");
    setPdfUrl("");
  };

  // ── Values laid out like the hotel booking details page ──────────────
  // Status as the hotel booking details page shows it: every step the
  // booking has been through, joined with "/".
  //   • submitted, waiting for staff          → "On Request"
  //   • confirmed before the deadline         → "On Request/Confirmed"
  //   • cancelled while On Request (button or
  //     the deadline job)                     → "On Request/Cancelled"
  //   • cancelled after being confirmed       → "On Request/Confirmed/Cancelled"
  // Every booking submitted under the On Request rule has a cancellation
  // deadline. One submitted before the rule has none and reads "Confirmed",
  // or "Confirmed/Cancelled" once cancelled with the Cancel button; one
  // cancelled before cancellations were recorded reads just "Cancelled" —
  // the hotel page's fallbacks. Like the hotel page there is no separate
  // "Completed" step: a past booking keeps the status it ended on.
  const wentOnRequest = !!booking?.cancellationDeadline;
  const wasConfirmed = !!booking?.confirmedAt;
  const displayStatus = isCancelled
    ? wentOnRequest
      ? wasConfirmed
        ? "On Request/Confirmed/Cancelled"
        : "On Request/Cancelled"
      : booking?.cancelledAt
      ? "Confirmed/Cancelled"
      : "Cancelled"
    : isOnRequest
    ? "On Request"
    : wentOnRequest
    ? "On Request/Confirmed"
    : "Confirmed";

  // ── Booking actions copied from the hotel booking details page ────────
  // ADD AGENT REFERENCE, CONFIRMATION NO., RESEND MAIL TO AGENT, BOOKING
  // REMARK, NOTES, HISTORY — same buttons, dialogs and rules, on the
  // /api/v1/offline-booking/{id}/… endpoints.
  //
  // Agent logins see ADD AGENT REFERENCE, RESEND MAIL and HISTORY;
  // CONFIRMATION NO., BOOKING REMARK and NOTES are for our team, as on the
  // hotel page (same role test as there).
  const isAgentRole = (() => {
    const active = String(getCurrentActiveRole() || "").trim().toUpperCase();
    const stored = String(getUserRole() || "").toUpperCase();
    return active ? active === "AGENT" : stored.includes("AGENT") && !stored.includes("ADMIN");
  })();
  // Agent Reference / Confirmation No. only once the booking is confirmed —
  // not while On Request, and not on one cancelled before it was confirmed
  // (the hotel page's "Confirmed or later"). The server checks it again.
  const confirmedForReferences = isCancelled ? !cancelledWithoutConfirming : !isOnRequest;

  // Agent Reference — GET/POST /api/v1/offline-booking/{id}/agent-reference
  const [showAgentRefModal, setShowAgentRefModal] = useState(false);
  const [agentRefInput, setAgentRefInput] = useState("");
  const [agentRefError, setAgentRefError] = useState("");
  const [savingAgentRef, setSavingAgentRef] = useState(false);

  const openAgentRefModal = async () => {
    setAgentRefInput("");
    setAgentRefError("");
    setShowAgentRefModal(true);
    try {
      const res = await axiosInstance.get(`/api/v1/offline-booking/${id}/agent-reference`);
      const saved = res?.data?.agentLpo;
      if (saved) setAgentRefInput(saved);
    } catch (err) {
      // Non-fatal: the dialog still opens; the user can type a new value.
      console.warn("Could not prefill agent reference:", err?.message);
    }
  };

  const saveAgentReference = async () => {
    const value = (agentRefInput || "").trim();
    if (!value) {
      setAgentRefError("Agent Reference is required");
      return;
    }
    setAgentRefError("");
    try {
      setSavingAgentRef(true);
      const res = await axiosInstance.post(`/api/v1/offline-booking/${id}/agent-reference`, {
        agentLpo: value,
      });
      if (res.data && res.data.success) {
        setShowAgentRefModal(false);
        toast.success(res.data.message || "Agent Reference updated successfully");
        loadDetails();
      } else {
        toast.error(res.data?.message || "Failed to update Agent Reference.");
      }
    } catch (error) {
      console.error("Error updating Agent Reference:", error);
      toast.error(error.response?.data?.message || "Failed to update Agent Reference. Please try again.");
    } finally {
      setSavingAgentRef(false);
    }
  };

  // Confirmation Number — the hotel's own number; POST …/confirmation-no
  const [showConfirmationNoModal, setShowConfirmationNoModal] = useState(false);
  const [confirmationNoInput, setConfirmationNoInput] = useState("");
  const [confirmationNoError, setConfirmationNoError] = useState("");
  const [savingConfirmationNo, setSavingConfirmationNo] = useState(false);

  const openConfirmationNoModal = async () => {
    setConfirmationNoInput("");
    setConfirmationNoError("");
    setShowConfirmationNoModal(true);
    try {
      const res = await axiosInstance.get(`/api/v1/offline-booking/${id}/agent-reference`);
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
      const res = await axiosInstance.post(`/api/v1/offline-booking/${id}/confirmation-no`, {
        confirmationNumber: value,
      });
      if (res.data && res.data.success) {
        setShowConfirmationNoModal(false);
        toast.success(res.data.message || "Confirmation number saved successfully!");
        loadDetails();
      } else {
        toast.error(res.data?.message || "Failed to save confirmation number.");
      }
    } catch (error) {
      console.error("Error saving confirmation number:", error);
      toast.error(error.response?.data?.message || "Failed to save confirmation number. Please try again.");
    } finally {
      setSavingConfirmationNo(false);
    }
  };

  // Booking Remark — the booking's Remarks (its Order Notes); POST …/remark
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [remarkInput, setRemarkInput] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);

  const openRemarkModal = () => {
    setRemarkInput(booking?.orderNote || "");
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
      const res = await axiosInstance.post(`/api/v1/offline-booking/${id}/remark`, { remarks: text });
      if (res.data && res.data.success !== false) {
        setShowRemarkModal(false);
        toast.success(res.data?.message || "Remark saved successfully");
        loadDetails();
      } else {
        toast.error(res.data?.message || "Failed to save remark.");
      }
    } catch (error) {
      console.error("Error saving remark:", error);
      toast.error(error.response?.data?.message || "Failed to save remark. Please try again.");
    } finally {
      setSavingRemark(false);
    }
  };

  // Notes — listed in the Notes box; GET/POST …/notes
  const [bookingNotes, setBookingNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const fetchBookingNotes = useCallback(() => {
    if (!id) return undefined;
    setNotesLoading(true);
    return axiosInstance
      .get(`/api/v1/offline-booking/${id}/notes`)
      .then((res) => {
        setBookingNotes(
          res.data && res.data.success !== false && Array.isArray(res.data.notes) ? res.data.notes : [],
        );
      })
      .catch(() => setBookingNotes([]))
      .finally(() => setNotesLoading(false));
  }, [id]);

  useEffect(() => {
    fetchBookingNotes();
  }, [fetchBookingNotes]);

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
      // The server records who added it (the signed-in login).
      const res = await axiosInstance.post(`/api/v1/offline-booking/${id}/notes`, { noteText: text });
      if (res.data?.success) {
        toast.success(res.data?.message || "Note saved");
        setShowNotesModal(false);
        setNoteInput("");
        await fetchBookingNotes();
      } else {
        toast.error(res.data?.message || "Failed to save note");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  // Resend Mail to Agent — preview + send, as on the hotel page: the Voucher
  // once confirmed or cancelled, the Proforma Voucher while On Request.
  const resendDocType = isOnRequest ? "PROFORMA_VOUCHER" : "VOUCHER";
  const resendDocLabel = isOnRequest ? "Offline Booking Proforma Voucher" : "Voucher";
  const [showResendMailModal, setShowResendMailModal] = useState(false);
  const [resendMailPdfUrl, setResendMailPdfUrl] = useState("");
  const [resendMailEmail, setResendMailEmail] = useState("");
  const [resendMailEmailError, setResendMailEmailError] = useState("");
  const [resendMailPreparing, setResendMailPreparing] = useState(false);
  const [resendingMail, setResendingMail] = useState(false);

  const openResendMailModal = async () => {
    setResendMailPdfUrl("");
    setResendMailEmail("");
    setResendMailEmailError("");
    setShowResendMailModal(true);
    setResendMailPreparing(true);
    try {
      const agentId = booking?.agentId ? Number(String(booking.agentId).trim()) : null;
      const [docRes, agentRes] = await Promise.all([
        axiosInstance
          .get(`/api/offline_booking/${id}/pdf`, { params: { type: resendDocType } })
          .catch(() => null),
        agentId ? axiosInstance.get(`/api/agent/${agentId}`).catch(() => null) : Promise.resolve(null),
      ]);
      if (docRes?.data?.status === "SUCCESS" && docRes.data.pdfUrl) {
        setResendMailPdfUrl(docRes.data.pdfUrl);
      }
      const a = agentRes?.data || {};
      setResendMailEmail(a.personalEmail || a.financeManagerEmail || a.gmEmail || booking?.agentEmail || "");
    } finally {
      setResendMailPreparing(false);
    }
  };

  const submitResendMail = async () => {
    const email = (resendMailEmail || "").trim();
    if (!email) {
      setResendMailEmailError("Recipient email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setResendMailEmailError("Enter a valid email address");
      return;
    }
    setResendMailEmailError("");
    try {
      setResendingMail(true);
      const res = await axiosInstance.post(`/api/v1/offline-booking/${id}/resend-mail`, null, {
        params: { email },
      });
      if (res.data && res.data.success !== false) {
        toast.success(res.data?.message || "Mail resent to agent successfully!");
        setShowResendMailModal(false);
      } else {
        toast.error(res.data?.message || "Failed to resend mail.");
      }
    } catch (error) {
      console.error("Error resending mail to agent:", error);
      toast.error(error.response?.data?.message || "Failed to resend mail to agent. Please try again.");
    } finally {
      setResendingMail(false);
    }
  };

  // History — the booking's own steps, in the order they happen: created
  // (On Request, or Confirmed for one made before that rule), confirmed by
  // staff, cancelled. Every time is UAE time (the created time arrives
  // converted as bookingDateUae; confirm / cancel are stored in UAE time).
  // Location / IP were recorded at each step from 2026-11-19 on; older steps,
  // and a cancellation by the deadline job, show "-" — as on the hotel page.
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const bookingHistory = (() => {
    if (!booking) return [];
    const events = [];
    if (booking.bookingDateUae || booking.bookingDate) {
      events.push({
        action: "Booking Created",
        status: wentOnRequest ? "On Request" : "Confirmed",
        at: booking.bookingDateUae || booking.bookingDate,
        by: booking.bookedBy || booking.bookerName || "-",
        location: booking.bookingLocation,
        ip: booking.ipAddress,
      });
    }
    if (booking.confirmedAt) {
      events.push({
        action: "Booking Confirmed",
        status: "On Request/Confirmed",
        at: booking.confirmedAt,
        by: booking.confirmedBy || "-",
        location: booking.confirmedLocation,
        ip: booking.confirmedIp,
      });
    }
    if (isCancelled && booking.cancelledAt) {
      events.push({
        action: "Booking Cancelled",
        status: "Cancelled",
        at: booking.cancelledAt,
        by: booking.cancelledBy || "-",
        location: booking.cancelledLocation,
        ip: booking.cancelledIp,
      });
    }
    return events;
  })();

  const currencyCode = booking?.currency || "AED";
  const adultsCount = booking?.adults ?? booking?.adult ?? 0;
  const childrenCount = booking?.children ?? booking?.child ?? 0;
  const detailOf = (item, label) =>
    (Array.isArray(item?.details) ? item.details : []).find((d) => d.label === label)?.value;
  const hotelItems = items.filter(
    (it) => it.service === "Hotel" || String(it.supplierType || "").toUpperCase() === "HOTEL",
  );
  const hotelNames = [
    ...new Set(hotelItems.map((it) => detailOf(it, "Hotel")).filter(Boolean)),
  ];
  const singleHotel = hotelItems.length === 1 ? hotelItems[0] : null;
  // Transfers, activities, visas, miscellaneous — everything but hotels.
  const otherItems = items.filter((it) => !hotelItems.includes(it));
  // Rooms Details: rooms numbered across the hotel lines (a line holding 3
  // rooms after a 1-room line reads "Rooms 2–4").
  let nextRoomNo = 1;
  const roomBlocks = hotelItems.map((item) => {
    const count = Math.max(1, parseInt(item.quantity, 10) || 1);
    const block = { item, from: nextRoomNo, to: nextRoomNo + count - 1 };
    nextRoomNo += count;
    return block;
  });
  const totalRooms = nextRoomNo - 1;
  // "5, 8" → ["5", "8"] for the Room Guests table.
  const childAgeList = String(booking?.childAges || "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  // Children's names typed on the booking page (same order as the ages; ""
  // where none was typed).
  const childNameList = Array.isArray(booking?.childNames) ? booking.childNames : [];
  // One row per child: its name (if typed) and age (if captured).
  const childRows = Array.from({ length: Number(childrenCount) || 0 }, (_, i) => ({
    name: String(childNameList[i] ?? "").trim(),
    age: childAgeList[i],
  }));
  const childNamesText = childRows
    .filter((c) => c.name)
    .map((c) => (c.age != null ? `${c.name} (${c.age})` : c.name))
    .join(", ");
  // Room Guests table (hotel page style): the lead guest and the children —
  // no other adult names are saved offline.
  const roomGuestsTable =
    booking?.customerName || childRows.length > 0 ? (
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
            {booking?.customerName && (
              <tr>
                <td>1</td>
                <td>{booking.customerName}</td>
                <td>Adult (Lead Guest)</td>
              </tr>
            )}
            {childRows.map((child, ci) => (
              <tr key={`c${ci}`}>
                <td>{(booking?.customerName ? 2 : 1) + ci}</td>
                <td>{child.name || "-"}</td>
                <td>{child.age != null ? `Child (Age: ${child.age})` : "Child"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    ) : null;
  // Exact sums: whole cents, shown with 2 decimals.
  const sumCents = (list, field) => list.reduce((s, it) => s + centsOf(it[field]), 0);
  const centsToMoney = (cents) => (cents / 100).toFixed(2);

  // Rooms as set in the booking page's "Search Guest" picker (saved since
  // 2026-11-19): [{adults, children, childAges, childNames}]. Older bookings
  // have none and fall back to the hotel lines.
  const savedRooms = Array.isArray(booking?.rooms) ? booking.rooms : [];
  // No of Rooms: the rooms as set; else the hotel lines' rooms; else unknown
  // (an older booking without a hotel line never recorded it).
  const roomsCount = savedRooms.length > 0 ? savedRooms.length : hotelItems.length > 0 ? totalRooms : null;
  // One hotel line booked for exactly these rooms: every room is that line's
  // room — its category, meal plan and per-room rate (price × nights).
  const roomHotel =
    savedRooms.length > 0 &&
    hotelItems.length === 1 &&
    (parseInt(hotelItems[0].quantity, 10) || 0) === savedRooms.length
      ? hotelItems[0]
      : null;
  const roomHotelNights = roomHotel ? Math.max(1, parseInt(roomHotel.nights, 10) || 1) : 1;
  const roomRateCents = roomHotel ? centsOf(roomHotel.sellingPrice) * roomHotelNights : null;

  // The hotel facts the room tables don't carry (hotel, address, telephone,
  // check-in / check-out, booking code, supplier, summary) as info rows.
  const hotelFactRows = (item) => {
    const extra = (Array.isArray(item?.details) ? item.details : []).filter(
      (d) => !ROOM_TABLE_LABELS.includes(d.label),
    );
    if (!extra.length) return null;
    const half = Math.ceil(extra.length / 2);
    return (
      <Row style={{ marginBottom: "4px" }}>
        <Col md={6}>
          {extra.slice(0, half).map((d, j) => (
            <InfoRow key={j} label={d.label} value={d.value} />
          ))}
        </Col>
        <Col md={6}>
          {extra.slice(half).map((d, j) => (
            <InfoRow key={j} label={d.label} value={d.value} />
          ))}
        </Col>
      </Row>
    );
  };

  // A hotel line as its own block: its title, facts and a room table
  // (Rooms × Nights, rate per room / night, total). withGuests adds the
  // booking's Adults / Children — for older bookings, which kept no rooms.
  const renderHotelLine = (item, idx, title, withGuests) => {
    const oneLine = hotelItems.length === 1;
    return (
      <div key={item.id ?? idx} style={{ padding: "8px 16px 12px" }}>
        <div style={ROOM_TITLE}>
          {title}
          {detailOf(item, "Hotel") ? ` — ${detailOf(item, "Hotel")}` : ""} - <StatusBadge status={displayStatus} />
        </div>
        {hotelFactRows(item)}
        <Table bordered size="sm" style={{ fontSize: "0.82rem", marginBottom: "6px" }}>
          <thead style={{ backgroundColor: "#f8f8f8" }}>
            <tr>
              <th>Room Category</th>
              <th>Meal Type</th>
              <th>Rooms</th>
              <th>Nights</th>
              {withGuests && <th>Adults</th>}
              {withGuests && <th>Children</th>}
              <th>Rate</th>
              <th>Total</th>
              <th>Currency</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {detailOf(item, "Room Type") || "-"}
                {detailOf(item, "Add On") && <div style={SMALL_NOTE}>+ {detailOf(item, "Add On")}</div>}
              </td>
              <td>{detailOf(item, "Meal Plan") || "-"}</td>
              <td>{item.quantity ?? "-"}</td>
              <td>{item.nights != null ? Math.max(1, item.nights) : "-"}</td>
              {withGuests && <td>{oneLine ? adultsCount : "-"}</td>}
              {withGuests && <td>{oneLine ? childrenCount : "-"}</td>}
              <td>
                {money(item.sellingPrice)}
                <div style={SMALL_NOTE}>per room / night</div>
              </td>
              <td style={{ color: "#dc2626", fontWeight: 700 }}>
                {money(item.subTotal)}
                {item.taxAmount != null && (
                  <div style={{ ...SMALL_NOTE, fontWeight: 500 }}>
                    incl. tax {money(item.taxAmount)}
                    {item.tax != null && item.tax !== "" ? ` (${item.tax}%)` : ""}
                  </div>
                )}
              </td>
              <td>{item.currency || currencyCode}</td>
            </tr>
          </tbody>
        </Table>
        {withGuests && idx === 0 && roomGuestsTable}
      </div>
    );
  };

  // One saved room's guests: the lead guest (Room 1) and its children with
  // the names and ages typed for them.
  const renderRoomGuests = (room, ri) => {
    const names = Array.isArray(room.childNames) ? room.childNames : [];
    const ages = Array.isArray(room.childAges) ? room.childAges : [];
    const rows = [];
    if (ri === 0 && booking?.customerName) {
      rows.push({ name: booking.customerName, type: "Adult (Lead Guest)" });
    }
    for (let i = 0; i < (Number(room.children) || 0); i++) {
      rows.push({
        name: String(names[i] ?? "").trim() || "-",
        type: ages[i] != null ? `Child (Age: ${ages[i]})` : "Child",
      });
    }
    if (!rows.length) return null;
    return (
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
            {rows.map((g, gi) => (
              <tr key={gi}>
                <td>{gi + 1}</td>
                <td>{g.name}</td>
                <td>{g.type}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
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
              <button style={BTN_NEUTRAL} onClick={() => navigate(-1)}>
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

            {loadingBooking ? (
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
                {/* ── Booking Info ─────────────────────────────────────── */}
                <div style={CARD}>
                  <div style={SECTION_HEADER}>
                    Booking Information
                    <span
                      style={{
                        marginLeft: 8,
                        backgroundColor: "#475569",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: "0.65rem",
                        padding: "2px 6px",
                        borderRadius: 3,
                      }}
                    >
                      OFFLINE
                    </span>
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow label="Invoice Number" value={booking.invoiceNumber} />
                        <InfoRow
                          label="Hotel Name"
                          value={
                            hotelNames.length ? (
                              hotelNames.join(", ")
                            ) : booking.hotelName ? (
                              booking.hotelName
                            ) : loadingItems ? null : (
                              // Only transfers / activities / visas / other
                              // items — there is no hotel to name.
                              <span className="text-muted">No hotel booked</span>
                            )
                          }
                        />
                        {singleHotel && (
                          <>
                            <InfoRow label="Hotel Address" value={detailOf(singleHotel, "Hotel Address")} />
                            <InfoRow label="Tel No" value={detailOf(singleHotel, "Hotel Telephone")} />
                          </>
                        )}
                        {/* Stay dates come from the hotel lines (older bookings
                            kept their own). Without a hotel, the services'
                            dates are shown instead, when any service has one. */}
                        {hotelItems.length > 0 || booking.checkIn || booking.checkOut || loadingItems ? (
                          <>
                            <InfoRow label="Check-In" value={booking.checkIn} />
                            <InfoRow label="Check-Out" value={booking.checkOut} />
                          </>
                        ) : booking.serviceFrom ? (
                          <InfoRow
                            label={
                              !booking.serviceTo || booking.serviceTo === booking.serviceFrom
                                ? "Service Date"
                                : "Service Dates"
                            }
                            value={
                              !booking.serviceTo || booking.serviceTo === booking.serviceFrom
                                ? booking.serviceFrom
                                : `${booking.serviceFrom} – ${booking.serviceTo}`
                            }
                          />
                        ) : null}
                        {singleHotel && singleHotel.nights != null && (
                          <InfoRow
                            label="No. of Nights"
                            value={`${singleHotel.nights} Night${singleHotel.nights === 1 ? "" : "s"}`}
                          />
                        )}
                        <InfoRow
                          label="Booking Date"
                          value={formatUaeDateTime(booking.bookingDate) || booking.bookingDate}
                        />
                        {booking.confirmedAt && (
                          <InfoRow
                            label="Confirmed Date"
                            value={`${formatUaeDateTime(booking.confirmedAt)} (UAE)`}
                          />
                        )}
                        <InfoRow
                          label="Last Edited"
                          value={formatUaeDateTime(booking.lastEdited) || booking.lastEdited}
                        />
                      </Col>
                      <Col md={6}>
                        <InfoRow
                          label="Agent"
                          value={booking.agentName || booking.agentFullName || "Direct Client"}
                        />
                        <InfoRow label="Booked By Employee" value={booking.bookingDoneBy} />
                        {/* Picked in the Offline page's "Booking Done On Behalf
                            Of Agent Staff" dropdown; "-" when none was picked. */}
                        <InfoRow label="Booked On Behalf Of Agent Staff" value={booking.agentStaffName} />
                        <InfoRow label="Booked By (Login)" value={booking.bookedBy || booking.bookerName} />
                        <InfoRow label="Agent Reference" value={booking.refNo} />
                        <InfoRow label="Confirmation No." value={booking.confirmationNo} />
                        {/* The hotel's own number, saved with the CONFIRMATION NO. button. */}
                        <InfoRow label="Hotel Confirmation Number" value={booking.hotelConfirmationNo} />
                        <InfoRow
                          label="Deadline Date"
                          value={
                            booking.cancellationDeadline ? (
                              <span style={{ color: "#dc2626", fontWeight: 600 }}>
                                {formatUaeDateTime(booking.cancellationDeadline)} (UAE time)
                              </span>
                            ) : null
                          }
                        />
                        <InfoRow label="Currency" value={booking.currency} />
                        <InfoRow label="Status" value={<StatusBadge status={displayStatus} />} />
                        {/* Agent credit: debited when the booking is confirmed;
                            refunded on a cancel before the cancellation
                            deadline, not after it; nothing before confirming. */}
                        <InfoRow
                          label="Agent Credit"
                          value={
                            Number(booking.agentCreditDebited) > 0 ? (
                              Number(booking.agentCreditRefunded) > 0 ? (
                                <span style={{ color: "#16a34a", fontWeight: 600 }}>
                                  AED {money(booking.agentCreditDebited)} debited — AED{" "}
                                  {money(booking.agentCreditRefunded)} refunded (cancelled before the deadline)
                                </span>
                              ) : (
                                <span style={{ color: "#dc2626", fontWeight: 600 }}>
                                  AED {money(booking.agentCreditDebited)} debited
                                  {isCancelled ? " — not refunded (cancelled after the deadline)" : ""}
                                </span>
                              )
                            ) : isOnRequest ? (
                              "Not debited yet — debited when the booking is confirmed"
                            ) : cancelledWithoutConfirming ? (
                              "Not debited — cancelled before it was confirmed"
                            ) : (
                              "Not debited"
                            )
                          }
                        />
                        {booking.confirmedBy && (
                          <InfoRow label="Confirmed By" value={booking.confirmedBy} />
                        )}
                        {statusCode === "CANCELLED" && booking.cancelledAt && (
                          <InfoRow
                            label="Cancelled Date"
                            value={`${formatUaeDateTime(booking.cancelledAt)} (UAE)`}
                          />
                        )}
                        {statusCode === "CANCELLED" && booking.cancelledBy && (
                          <InfoRow label="Cancelled By" value={booking.cancelledBy} />
                        )}
                        {statusCode === "CANCELLED" && booking.cancellationReason && (
                          <InfoRow label="Cancellation Reason" value={booking.cancellationReason} />
                        )}
                        {booking.trnNo && <InfoRow label="TRN" value={booking.trnNo} />}
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Guest Information ───────────────────────────────── */}
                <div style={CARD}>
                  <div style={SECTION_HEADER}>Guest Information</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow label="Guest Name" value={booking.customerName} />
                        <InfoRow label="Contact No" value={booking.contactNo} />
                      </Col>
                      <Col md={6}>
                        <InfoRow label="Adults" value={adultsCount} />
                        <InfoRow
                          label="Children"
                          value={
                            childrenCount > 0 && booking.childAges
                              ? `${childrenCount} (Age: ${booking.childAges})`
                              : childrenCount
                          }
                        />
                        {childNamesText && (
                          <InfoRow label="Children's Names" value={childNamesText} />
                        )}
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Agent Information ───────────────────────────────── */}
                {(booking.agentName || booking.agentEmail || booking.agentPhone) && (
                  <div style={CARD}>
                    <div style={SECTION_HEADER}>Agent Information</div>
                    <div style={{ padding: "12px 16px" }}>
                      <Row>
                        <Col md={6}>
                          <InfoRow label="Agent" value={booking.agentName || booking.agentFullName} />
                          <InfoRow label="Contact Person" value={booking.agentContactPerson} />
                        </Col>
                        <Col md={6}>
                          <InfoRow label="Phone" value={booking.agentPhone} />
                          <InfoRow label="Email" value={booking.agentEmail} />
                        </Col>
                      </Row>
                    </div>
                  </div>
                )}

                {/* ── Rooms Details — the hotel page's box. Rooms are the ones
                     set in the booking page's "Search Guest" picker (saved
                     since 2026-11-19): one block per room with its adults,
                     children and guests. When one hotel line was booked for
                     exactly those rooms, each room also carries its category,
                     meal type and rate. Older bookings, which kept no rooms,
                     show their hotel lines instead. ── */}
                <div style={CARD}>
                  <div style={SECTION_HEADER}>Rooms Details</div>
                  <div style={{ padding: "10px 16px 4px" }}>
                    <span
                      style={{
                        color: "#c0392b",
                        fontWeight: "600",
                        fontSize: "0.85rem",
                        marginRight: "20px",
                      }}
                    >
                      No of Rooms -{" "}
                      {roomsCount != null
                        ? `${roomsCount} Room${roomsCount !== 1 ? "s" : ""}`
                        : "Not recorded"}
                    </span>
                    <span style={{ color: "#c0392b", fontWeight: "600", fontSize: "0.85rem" }}>
                      No of Guests - {adultsCount} Adult{adultsCount !== 1 ? "s" : ""}
                      {childrenCount > 0
                        ? `, ${childrenCount} Child${childrenCount !== 1 ? "ren" : ""}`
                        : ""}
                    </span>
                  </div>

                  {loadingItems && items.length === 0 ? (
                    <div style={BODY_TEXT} className="text-muted">
                      Loading rooms...
                    </div>
                  ) : savedRooms.length > 0 ? (
                    <>
                      {/* The hotel these rooms are booked at. */}
                      {roomHotel && (
                        <div style={{ padding: "8px 16px 0" }}>{hotelFactRows(roomHotel)}</div>
                      )}

                      {savedRooms.map((room, ri) => (
                        <div key={ri} style={{ padding: "8px 16px 12px" }}>
                          <div style={ROOM_TITLE}>
                            Room {ri + 1} - <StatusBadge status={displayStatus} />
                          </div>
                          <Table bordered size="sm" style={{ fontSize: "0.82rem", marginBottom: "6px" }}>
                            <thead style={{ backgroundColor: "#f8f8f8" }}>
                              <tr>
                                <th>Room Category</th>
                                <th>Meal Type</th>
                                <th>Adults</th>
                                <th>Children</th>
                                <th>Rate</th>
                                <th>Currency</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>
                                  {roomHotel ? detailOf(roomHotel, "Room Type") || "-" : "-"}
                                  {roomHotel && detailOf(roomHotel, "Add On") && (
                                    <div style={SMALL_NOTE}>+ {detailOf(roomHotel, "Add On")}</div>
                                  )}
                                </td>
                                <td>{roomHotel ? detailOf(roomHotel, "Meal Plan") || "-" : "-"}</td>
                                <td>{room.adults ?? "-"}</td>
                                <td>{room.children ?? 0}</td>
                                <td>
                                  {roomHotel ? (
                                    <>
                                      {centsToMoney(roomRateCents)}
                                      <div style={SMALL_NOTE}>
                                        {money(roomHotel.sellingPrice)} × {roomHotelNights} night
                                        {roomHotelNights !== 1 ? "s" : ""}
                                      </div>
                                    </>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td>{roomHotel ? roomHotel.currency || currencyCode : currencyCode}</td>
                              </tr>
                            </tbody>
                          </Table>
                          {renderRoomGuests(room, ri)}
                        </div>
                      ))}

                      {/* Hotel lines that aren't simply "these rooms" (several
                          hotels, or a room count that differs) — each listed
                          with its own rooms and price. */}
                      {!roomHotel && hotelItems.length > 0 && (
                        <>
                          <div
                            style={{
                              padding: "6px 16px 0",
                              fontSize: "0.85rem",
                              fontWeight: 600,
                              color: "#333",
                              borderTop: "1px solid #eee",
                            }}
                          >
                            Hotels Booked
                          </div>
                          {hotelItems.map((item, hi) => renderHotelLine(item, hi, `Hotel ${hi + 1}`, false))}
                        </>
                      )}
                      {hotelItems.length === 0 && (
                        <div style={{ ...BODY_TEXT, paddingTop: 0 }} className="text-muted">
                          No hotel was added to this booking
                          {otherItems.length > 0 ? " — its services are listed below" : ""}.
                        </div>
                      )}
                    </>
                  ) : hotelItems.length > 0 ? (
                    // Older booking: its rooms come from the hotel lines.
                    roomBlocks.map(({ item, from, to }, idx) =>
                      renderHotelLine(item, idx, from === to ? `Room ${from}` : `Rooms ${from}–${to}`, true),
                    )
                  ) : (
                    // Older booking without a hotel line: no rooms recorded.
                    <div style={{ padding: "8px 16px 12px" }}>
                      <div style={{ fontSize: "0.83rem", color: "#666", marginBottom: "8px" }}>
                        No hotel was added to this booking
                        {otherItems.length > 0 ? " — its services are listed below" : ""}.
                      </div>
                      {roomGuestsTable}
                    </div>
                  )}

                  {/* Summary row — the hotel lines' total. */}
                  {hotelItems.length > 0 && (
                    <div
                      style={{
                        padding: "8px 16px",
                        borderTop: "1px solid #eee",
                        fontSize: "0.85rem",
                        display: "flex",
                        gap: "24px",
                        flexWrap: "wrap",
                        color: "#333",
                      }}
                    >
                      <span>
                        <span style={{ fontWeight: "600" }}>Total Rate: </span>
                        {currencyCode} {centsToMoney(sumCents(hotelItems, "subTotal"))}
                      </span>
                      <span>
                        <span style={{ fontWeight: "600" }}>Tax Included: </span>
                        {currencyCode} {centsToMoney(sumCents(hotelItems, "taxAmount"))}
                      </span>
                    </div>
                  )}
                </div>

                {/* ── Other Services Details — transfers, activities, visas
                     and miscellaneous lines, in the same block style. ──── */}
                {(otherItems.length > 0 || (hotelItems.length === 0 && !loadingItems)) && (
                  <div style={CARD}>
                    <div style={SECTION_HEADER}>
                      {hotelItems.length > 0 ? "Other Services Details" : "Services Details"}
                    </div>
                    {otherItems.length === 0 ? (
                      <div style={BODY_TEXT} className="text-muted">
                        No services added.
                      </div>
                    ) : (
                      otherItems.map((item, idx) => {
                        const details = Array.isArray(item.details) ? item.details : [];
                        const rows = details.length
                          ? details
                          : item.description
                          ? [{ label: "Description", value: item.description }]
                          : [];
                        const half = Math.ceil(rows.length / 2);
                        const service = item.service || item.supplierType || "Service";
                        const headline =
                          detailOf(item, "Activity") || detailOf(item, "Transfer") || detailOf(item, "Visa");
                        return (
                          <div key={item.id ?? idx} style={{ padding: "8px 16px 12px" }}>
                            <div
                              style={{
                                color: "#c0392b",
                                fontWeight: "700",
                                fontSize: "0.88rem",
                                marginBottom: "6px",
                              }}
                            >
                              {idx + 1}. {service}
                              {headline ? ` — ${headline}` : ""} -{" "}
                              <StatusBadge status={displayStatus} />
                            </div>
                            {rows.length > 0 && (
                              <Row style={{ marginBottom: "4px" }}>
                                <Col md={6}>
                                  {rows.slice(0, half).map((d, j) => (
                                    <InfoRow key={j} label={d.label} value={d.value} />
                                  ))}
                                </Col>
                                <Col md={6}>
                                  {rows.slice(half).map((d, j) => (
                                    <InfoRow key={j} label={d.label} value={d.value} />
                                  ))}
                                </Col>
                              </Row>
                            )}
                            <Table bordered size="sm" style={{ fontSize: "0.82rem", marginBottom: "6px" }}>
                              <thead style={{ backgroundColor: "#f8f8f8" }}>
                                <tr>
                                  <th>Supplier</th>
                                  <th>Qty</th>
                                  <th>Unit Price</th>
                                  <th>Tax (%)</th>
                                  <th>Tax Amount</th>
                                  <th>Selling Price</th>
                                  <th>Sub Total</th>
                                  <th>Currency</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>{item.supplierName || "-"}</td>
                                  <td>{item.quantity ?? "-"}</td>
                                  <td>{money(item.unitPrice)}</td>
                                  <td>{item.tax != null && item.tax !== "" ? `${item.tax}%` : "-"}</td>
                                  <td>{money(item.taxAmount)}</td>
                                  <td>{money(item.sellingPrice)}</td>
                                  <td style={{ color: "#dc2626", fontWeight: 700 }}>{money(item.subTotal)}</td>
                                  <td>{item.currency || currencyCode}</td>
                                </tr>
                              </tbody>
                            </Table>
                          </div>
                        );
                      })
                    )}
                    {otherItems.length > 0 && (
                      <div
                        style={{
                          padding: "8px 16px",
                          borderTop: "1px solid #eee",
                          fontSize: "0.85rem",
                          display: "flex",
                          gap: "24px",
                          flexWrap: "wrap",
                          color: "#333",
                        }}
                      >
                        <span>
                          <span style={{ fontWeight: "600" }}>Total Rate: </span>
                          {currencyCode} {centsToMoney(sumCents(otherItems, "subTotal"))}
                        </span>
                        <span>
                          <span style={{ fontWeight: "600" }}>Tax Included: </span>
                          {currencyCode} {centsToMoney(sumCents(otherItems, "taxAmount"))}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {loadingItems && items.length === 0 && (
                  <div className="text-center py-4">
                    <Spinner animation="border" size="sm" style={{ color: "#c0392b" }} />
                    <p className="mt-2 text-muted small mb-0">Loading services...</p>
                  </div>
                )}

                {/* ── Booking Total — rooms and other services together ── */}
                {items.length > 0 && (
                  <div style={CARD}>
                    <div style={SECTION_HEADER}>Booking Total</div>
                    <div
                      style={{
                        padding: "8px 16px",
                        fontSize: "0.85rem",
                        display: "flex",
                        gap: "24px",
                        flexWrap: "wrap",
                        color: "#333",
                      }}
                    >
                      <span>
                        <span style={{ fontWeight: "600" }}>Total Rate: </span>
                        <span style={{ color: "#dc2626", fontWeight: 700 }}>
                          {currencyCode} {money(totalsView.grandTotal)}
                        </span>
                      </span>
                      <span>
                        <span style={{ fontWeight: "600" }}>Before Tax: </span>
                        {currencyCode} {money(totalsView.beforeTax)}
                      </span>
                      <span>
                        <span style={{ fontWeight: "600" }}>Total Tax: </span>
                        {currencyCode} {money(totalsView.taxAmount)}
                      </span>
                      <span>
                        <span style={{ fontWeight: "600" }}>Total Quantity: </span>
                        {totalsView.quantity}
                      </span>
                    </div>
                    {cancelledFreeOfCharge && (
                      <div style={{ padding: "0 16px 10px", ...SMALL_NOTE, fontSize: "0.78rem", color: "#dc2626" }}>
                        {cancelledWithoutConfirming
                          ? "Cancelled before it was confirmed — nothing is charged."
                          : `Cancelled before its cancellation deadline — nothing is charged.${
                              Number(booking.agentCreditRefunded) > 0
                                ? ` AED ${money(booking.agentCreditRefunded)} was refunded to the agent's credit.`
                                : ""
                            }`}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Cancellation Policy ─────────────────────────────── */}
                <div style={CARD}>
                  <div style={SECTION_HEADER}>
                    Cancellation Policy{" "}
                    <span style={{ fontSize: "1rem", color: "#555" }}>⊟</span>
                  </div>
                  <div style={BODY_TEXT}>
                    {statusCode === "CANCELLED" ? (
                      <p style={{ marginBottom: 0 }}>
                        This booking was cancelled
                        {booking.cancellationReason ? ` — ${booking.cancellationReason}` : ""}.
                      </p>
                    ) : !booking.cancellationDeadline ? (
                      <span className="text-muted">No cancellation deadline was recorded for this booking.</span>
                    ) : isOnRequest ? (
                      <>
                        <p style={{ marginBottom: "4px" }}>
                          On Request — confirm before{" "}
                          <strong>{formatUaeDateTime(booking.cancellationDeadline)} (UAE time)</strong>, otherwise the
                          booking is cancelled automatically.
                        </p>
                        {deadlinePassed && (
                          <p style={{ marginBottom: 0, color: "#dc2626" }}>
                            Deadline passed — this booking is being cancelled automatically.
                          </p>
                        )}
                      </>
                    ) : (
                      <p style={{ marginBottom: 0 }}>
                        Cancellation deadline {formatUaeDateTime(booking.cancellationDeadline)} (UAE time)
                        {booking.confirmedAt
                          ? ` — confirmed on ${formatUaeDateTime(booking.confirmedAt)} (UAE)${
                              booking.confirmedBy ? ` by ${booking.confirmedBy}` : ""
                            }.`
                          : "."}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Remarks (the booking's Order Notes) ─────────────── */}
                <div style={CARD}>
                  <div style={SECTION_HEADER}>
                    Remarks{" "}
                    <span style={{ fontSize: "1rem", color: "#555" }}>⊟</span>
                  </div>
                  <div style={BODY_TEXT}>
                    {booking.orderNote ? (
                      <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{booking.orderNote}</p>
                    ) : (
                      <span className="text-muted">No remarks.</span>
                    )}
                  </div>
                </div>

                {/* ── Notes — added with the NOTES button, as on the hotel page ── */}
                <div style={CARD}>
                  <div style={SECTION_HEADER}>
                    Notes{" "}
                    {bookingNotes.length > 0 && (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          color: "#F75E00",
                          background: "#FDECD6",
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
                  <div style={{ padding: "10px 16px", fontSize: "0.83rem", color: "#333" }}>
                    {notesLoading ? (
                      <span className="text-muted">Loading notes…</span>
                    ) : bookingNotes.length === 0 ? (
                      <span className="text-muted">No notes yet.</span>
                    ) : (
                      bookingNotes.map((n) => (
                        <div
                          key={n.noteId}
                          style={{
                            borderLeft: "3px solid #F75E00",
                            background: "#FAFAF8",
                            padding: "10px 12px",
                            marginBottom: 8,
                            borderRadius: 4,
                          }}
                        >
                          <div style={{ fontSize: "0.72rem", color: "#777", marginBottom: 4, letterSpacing: ".01em" }}>
                            {n.createdBy ? `${n.createdBy} • ` : ""}
                            {n.createdAt ? noteDateTime(n.createdAt) : ""}
                          </div>
                          <div style={{ fontSize: "0.85rem", whiteSpace: "pre-wrap", color: "#222" }}>
                            {n.noteText}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* ── Action Buttons ──────────────────────────────────── */}
                <div
                  style={{
                    marginBottom: "10px",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Cancel — like the hotel page: greyed out from the hotel
                      check-in date on, gone once cancelled. */}
                  {!isCancelled && (
                    <button
                      style={{
                        ...BTN_DANGER,
                        opacity: cancelBlockedReason ? 0.55 : 1,
                        cursor: cancelBlockedReason ? "not-allowed" : "pointer",
                      }}
                      onClick={openCancelModal}
                      disabled={!!cancelBlockedReason}
                      title={cancelBlockedReason || undefined}
                    >
                      CANCEL
                    </button>
                  )}
                  {/* Staff / admins confirm an On Request booking before its deadline. */}
                  {canConfirm && (
                    <button
                      style={{ ...BTN_SUCCESS, opacity: confirming ? 0.7 : 1 }}
                      onClick={handleConfirm}
                      disabled={confirming}
                      title="Confirm this On Request booking"
                    >
                      {confirming ? "CONFIRMING..." : "CONFIRM"}
                    </button>
                  )}
                  {/* No voucher until the booking is confirmed (the server refuses it too),
                      and none once cancelled — the hotel page keeps only the invoice then. */}
                  {!isCancelled && (
                    <button
                      style={{
                        ...BTN_INFO,
                        opacity: isOnRequest ? 0.5 : 1,
                        cursor: isOnRequest ? "not-allowed" : "pointer",
                      }}
                      onClick={() => handlePdfClick("VOUCHER")}
                      disabled={isOnRequest}
                      title={isOnRequest ? "Available once the booking is confirmed" : "Voucher"}
                    >
                      VOUCHER
                    </button>
                  )}
                  <button style={BTN_INFO} onClick={() => handlePdfClick("INVOICE")} title="Invoice">
                    INVOICE
                  </button>

                  {/* The hotel booking details page's booking actions. */}
                  <button
                    style={BTN_SKY}
                    onClick={() => {
                      if (!confirmedForReferences) {
                        toast.error("Agent Reference can only be added once the booking is Confirmed.");
                        return;
                      }
                      openAgentRefModal();
                    }}
                  >
                    ADD AGENT REFERENCE
                  </button>

                  {!isAgentRole && (
                    <button
                      style={BTN_INDIGO}
                      onClick={() => {
                        if (!confirmedForReferences) {
                          toast.error("Confirmation Number can only be added once the booking is Confirmed.");
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
                    onClick={openResendMailModal}
                    disabled={resendingMail || resendMailPreparing}
                  >
                    {resendingMail ? "SENDING..." : resendMailPreparing ? "LOADING..." : "RESEND MAIL TO AGENT"}
                  </button>

                  {!isAgentRole && (
                    <button style={BTN_ACCENT} onClick={openRemarkModal}>
                      BOOKING REMARK
                    </button>
                  )}

                  {!isAgentRole && (
                    <button style={BTN_NEUTRAL} onClick={openNotesModal}>
                      NOTES
                    </button>
                  )}

                  <button style={BTN_HISTORY} onClick={() => setShowHistoryModal(true)}>
                    HISTORY
                  </button>
                </div>
              </>
            )}
          </Container>
        </main>
      </div>

      {/* PDF Modal — iframe preview + email-send form (unchanged) */}
      <Modal
        show={showPdfModal}
        onHide={closePdfModal}
        size="xl"
        centered
        scrollable
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header className="bg-light">
          <Modal.Title className="fw-bold">
            {pdfTitle} - {booking?.invoiceNumber}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0" style={{ height: "70vh" }}>
          {loadingPdf ? (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Generating {pdfTitle}...</p>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0`}
              width="100%"
              height="100%"
              title="PDF Viewer"
              style={{ border: "none" }}
            />
          ) : (
            <div className="h-100 d-flex align-items-center justify-content-center">
              <p className="text-danger">Failed to load PDF.</p>
            </div>
          )}
        </Modal.Body>
        <div className="p-3 border-top bg-light">
          <Row className="align-items-center">
            <Col md={8}>
              <Form.Group>
                <InputGroup className={emailError ? "is-invalid" : ""}>
                  <InputGroup.Text className="bg-white">
                    <FaEnvelope className="text-muted" />
                  </InputGroup.Text>
                  <Form.Control
                    type="email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    className={emailError ? "is-invalid" : ""}
                  />
                  <Button
                    variant="primary"
                    onClick={handleSendMail}
                    disabled={sendingMail || !pdfUrl}
                  >
                    {sendingMail ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <>
                        <FaPaperPlane className="me-2" />
                        Send Mail
                      </>
                    )}
                  </Button>
                </InputGroup>
                {emailError && (
                  <div className="invalid-feedback d-block">{emailError}</div>
                )}
              </Form.Group>
            </Col>
            <Col md={4} className="text-end">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => window.open(pdfUrl, "_blank")}
                disabled={!pdfUrl}
              >
                <FaDownload className="me-1" /> Download
              </Button>
            </Col>
          </Row>
        </div>
        <Modal.Footer>
          <Button variant="secondary" onClick={closePdfModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancel Booking Modal — same dialog as the hotel booking details page */}
      <Modal show={showCancelModal} onHide={closeCancelModal} centered backdrop="static" keyboard={false}>
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
            <p className="fs-5 mb-3">Are you sure you want to cancel this booking?</p>
            <div className="text-muted small mb-3">
              <div>
                <strong>Invoice Number:</strong> {booking?.invoiceNumber || "N/A"}
              </div>
              {hotelNames.length > 0 && (
                <div>
                  <strong>Hotel:</strong> {hotelNames.join(", ")}
                </div>
              )}
            </div>
            {/* Booking value warning — the Grand Total shown on the page. */}
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
                {currencyCode} {money(totalsView.grandTotal)}
              </strong>
              .
              <div className="fw-semibold mt-1">Do you still want to cancel it?</div>
            </div>
            {/* Agent credit on cancel, as on the hotel booking page: past the
                cancellation deadline the debit is not refunded and the
                operator must accept that; before it the debit goes back; an
                On Request booking was never debited. */}
            {needsChargeAcknowledgement ? (
              <div
                className="mb-3 text-start"
                style={{
                  border: "1px solid #f5c2c7",
                  backgroundColor: "#fff5f5",
                  color: "#842029",
                  borderRadius: "4px",
                  padding: "10px 12px",
                  fontSize: "0.9rem",
                }}
              >
                <div className="fw-semibold mb-1">
                  <FaExclamationCircle className="me-2" />
                  The free-cancellation deadline has passed
                </div>
                <div className="mb-2">
                  You can still cancel this booking, but the AED {money(debitedAmount)} debited when it was
                  confirmed will not be refunded to the agent's credit.
                </div>
                <Form.Check
                  type="checkbox"
                  id="offlineAcceptCancellationCharges"
                  checked={acceptCancellationCharges}
                  disabled={cancellingBooking}
                  onChange={(e) => setAcceptCancellationCharges(e.target.checked)}
                  label={
                    <span className="fw-semibold">I understand that the booking amount will not be refunded.</span>
                  }
                />
              </div>
            ) : debitedAmount > 0 ? (
              <div
                className="mb-3 text-start"
                style={{
                  border: "1px solid #badbcc",
                  backgroundColor: "#d1e7dd",
                  color: "#0f5132",
                  borderRadius: "4px",
                  padding: "10px 12px",
                  fontSize: "0.9rem",
                }}
              >
                Cancelled before its cancellation deadline
                {booking?.cancellationDeadline ? ` (${formatUaeDateTime(booking.cancellationDeadline)} UAE time)` : ""}
                : the <b>AED {money(debitedAmount)}</b> debited when it was confirmed is refunded to the agent's
                credit, and the booking is charged nothing.
              </div>
            ) : isOnRequest ? (
              <div className="mb-3 text-start small text-muted">
                Nothing has been debited from the agent's credit yet (the booking is not confirmed), so
                nothing needs to be refunded.
              </div>
            ) : null}

            <Form.Group controlId="offlineCancellationReason" className="text-start">
              <Form.Label className="fw-semibold">
                Cancellation Reason <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                maxLength={500}
                placeholder="Add a reason for cancellation"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                disabled={cancellingBooking}
                isInvalid={!cancellationReason.trim()}
                required
              />
              <Form.Control.Feedback type="invalid">
                Cancellation reason is required.
              </Form.Control.Feedback>
            </Form.Group>
          </div>
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: "#f8f9fa", borderTop: "1px solid #dee2e6" }}>
          <Button variant="secondary" onClick={closeCancelModal} disabled={cancellingBooking}>
            No
          </Button>
          <Button
            variant="danger"
            onClick={cancelBooking}
            disabled={
              cancellingBooking ||
              !cancellationReason.trim() ||
              (needsChargeAcknowledgement && !acceptCancellationCharges)
            }
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

      {/* ── Update Agent Reference Modal — as on the hotel page ── */}
      <Modal
        show={showAgentRefModal}
        onHide={() => {
          if (!savingAgentRef) {
            setShowAgentRefModal(false);
            setAgentRefInput("");
            setAgentRefError("");
          }
        }}
        centered
        backdrop="static"
        keyboard={false}
        size="md"
      >
        <Modal.Header
          closeButton={!savingAgentRef}
          style={{ backgroundColor: "#fff", borderBottom: "2px solid #e9ecef" }}
        >
          <Modal.Title className="fw-bold d-flex align-items-center">
            <FaExclamationCircle className="me-2 text-warning" />
            <span>Update Agent Reference</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          <div className="text-center">
            <p className="fs-6 mb-3">Are you sure you want to update the agent reference?</p>
            <div className="text-muted small mb-3">
              <div>
                <strong>Invoice Number:</strong> {booking?.invoiceNumber || "N/A"}
              </div>
              {hotelNames.length > 0 && (
                <div>
                  <strong>Hotel:</strong> {hotelNames.join(", ")}
                </div>
              )}
            </div>
          </div>
          <Form.Group controlId="offlineAgentRefInput" className="text-start">
            <Form.Label className="fw-semibold mb-1">
              Agent Reference <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter Agent Reference"
              maxLength={255}
              value={agentRefInput}
              onChange={(e) => {
                setAgentRefInput(e.target.value);
                if (agentRefError && e.target.value.trim()) setAgentRefError("");
              }}
              isInvalid={!!agentRefError}
              disabled={savingAgentRef}
            />
            <Form.Control.Feedback type="invalid">{agentRefError}</Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: "#f8f9fa", borderTop: "1px solid #dee2e6" }}>
          <Button
            variant="secondary"
            onClick={() => {
              setShowAgentRefModal(false);
              setAgentRefInput("");
              setAgentRefError("");
            }}
            disabled={savingAgentRef}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={saveAgentReference} disabled={savingAgentRef}>
            {savingAgentRef ? (
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

      {/* ── Confirmation Number Modal — as on the hotel page ── */}
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
              <strong>Invoice Number:</strong> {booking?.invoiceNumber || "N/A"}
            </div>
            {hotelNames.length > 0 && (
              <div>
                <strong>Hotel:</strong> {hotelNames.join(", ")}
              </div>
            )}
          </div>
          <Form.Group controlId="offlineConfirmationNoInput">
            <Form.Label className="fw-semibold mb-1">
              Confirmation Number <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter Hotel Confirmation Number"
              maxLength={100}
              value={confirmationNoInput}
              onChange={(e) => {
                setConfirmationNoInput(e.target.value);
                if (confirmationNoError && e.target.value.trim()) setConfirmationNoError("");
              }}
              isInvalid={!!confirmationNoError}
              disabled={savingConfirmationNo}
            />
            <Form.Control.Feedback type="invalid">{confirmationNoError}</Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: "#f8f9fa", borderTop: "1px solid #dee2e6" }}>
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
          <Button variant="primary" onClick={saveConfirmationNo} disabled={savingConfirmationNo}>
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

      {/* ── Booking Remark Modal — as on the hotel page ── */}
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
          <Form.Group controlId="offlineBookingRemarkInput">
            <Form.Label className="fw-semibold mb-1">Remark</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              maxLength={1000}
              placeholder="Enter remark for this booking"
              value={remarkInput}
              onChange={(e) => setRemarkInput(e.target.value)}
              disabled={savingRemark}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: "#f8f9fa", borderTop: "1px solid #dee2e6" }}>
          <Button variant="secondary" onClick={() => setShowRemarkModal(false)} disabled={savingRemark}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveRemark} disabled={savingRemark}>
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

      {/* ── Notes Modal — add a note; the Notes box lists them ── */}
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
          <Modal.Title style={{ fontSize: "1rem" }}>Add Note</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label className="fw-semibold">Note</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              maxLength={4000}
              placeholder="Type your note here. You can enter long paragraphs."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              disabled={savingNote}
              style={{ resize: "vertical" }}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowNotesModal(false)} disabled={savingNote}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveNote} disabled={savingNote}>
            {savingNote ? (
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

      {/* ── Booking History Modal — as on the hotel page ── */}
      <Modal
        show={showHistoryModal}
        onHide={() => setShowHistoryModal(false)}
        centered
        size="xl"
        scrollable
        contentClassName="hbs-history-modal-content"
      >
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 10 }}>
            <FaHistory size={16} />
            <span>
              Booking History
              {booking?.invoiceNumber && (
                <span style={{ opacity: 0.85, fontWeight: 500 }}>{` — ${booking.invoiceNumber}`}</span>
              )}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: "#f8fafc", padding: "1.25rem 1.5rem" }}>
          {bookingHistory.length === 0 ? (
            <div className="text-muted text-center py-4">
              <FaHistory size={26} style={{ opacity: 0.25, marginBottom: 8 }} />
              <div>No history available for this booking.</div>
            </div>
          ) : (
            <div
              style={{
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                backgroundColor: "#fff",
              }}
            >
              <table
                style={{
                  width: "100%",
                  tableLayout: "fixed",
                  borderCollapse: "collapse",
                  fontSize: "0.82rem",
                  marginBottom: 0,
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#f1f5f9" }}>
                    {[
                      { label: "S/N", width: "5%" },
                      { label: "Action", width: "15%" },
                      { label: "Status", width: "12%" },
                      { label: "Performed By", icon: FaUserAlt, width: "11%" },
                      { label: "Location", icon: FaMapMarkerAlt, width: "24%" },
                      { label: "IP Address", icon: FaNetworkWired, width: "13%" },
                      { label: "Date", icon: FaCalendarAlt, width: "11%" },
                      { label: "Time", icon: FaClock, width: "9%" },
                    ].map((col) => (
                      <th
                        key={col.label}
                        style={{
                          width: col.width,
                          padding: "10px 14px",
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "#475569",
                          borderBottom: "1px solid #e2e8f0",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col.icon ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <col.icon size={11} style={{ opacity: 0.7 }} />
                            {col.label}
                          </span>
                        ) : (
                          col.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookingHistory.map((ev, idx) => {
                    const meta = HISTORY_ACTION_META[ev.action] || HISTORY_ACTION_FALLBACK;
                    const ActionIcon = meta.icon;
                    const rawStatus = String(ev.status || "").trim();
                    const lowerStatus = rawStatus.toLowerCase();
                    const statusColor = lowerStatus.includes("cancel")
                      ? "#dc2626"
                      : lowerStatus === "on request"
                        ? "#d97706"
                        : "#16a34a";
                    return (
                      <tr key={`${ev.action}-${idx}`} style={{ backgroundColor: idx % 2 === 1 ? "#f8fafc" : "#fff" }}>
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #eef2f6", color: "#64748b" }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #eef2f6" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "3px 10px",
                              borderRadius: 999,
                              backgroundColor: meta.bg,
                              color: meta.fg,
                              fontWeight: 600,
                              fontSize: "0.76rem",
                            }}
                          >
                            <ActionIcon size={10} style={{ flexShrink: 0 }} />
                            {ev.action}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #eef2f6" }}>
                          {rawStatus ? (
                            <span
                              style={{
                                color: statusColor,
                                fontWeight: 600,
                                fontSize: "0.78rem",
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                              }}
                            >
                              {rawStatus}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #eef2f6" }}>{ev.by || "-"}</td>
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #eef2f6", wordBreak: "break-word" }}>
                          {ev.location ? (
                            <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 6 }}>
                              <FaMapMarkerAlt size={11} style={{ color: "#c0392b", marginTop: 2, flexShrink: 0 }} />
                              <span>{ev.location}</span>
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #eef2f6" }}>
                          {ev.ip ? (
                            <span
                              style={{
                                fontFamily: "'Consolas', 'Courier New', monospace",
                                backgroundColor: "#f1f5f9",
                                color: "#334155",
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: "0.76rem",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {ev.ip}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #eef2f6" }}>
                          {historyDate(ev.at)}
                        </td>
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #eef2f6" }}>
                          {historyTime(ev.at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: "#fff" }}>
          <Button
            variant="secondary"
            onClick={() => setShowHistoryModal(false)}
            style={{ borderRadius: 6, padding: "6px 20px", fontWeight: 600, fontSize: "0.85rem" }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Resend Mail to Agent — preview + send, as on the hotel page ── */}
      <Modal
        show={showResendMailModal}
        onHide={() => (resendingMail ? null : setShowResendMailModal(false))}
        size="xl"
        centered
        backdrop="static"
        keyboard={!resendingMail}
      >
        <Modal.Header closeButton={!resendingMail}>
          <Modal.Title style={{ fontSize: "1rem", fontWeight: 700 }}>
            Resend {resendDocLabel} to Agent
            {booking?.invoiceNumber ? ` — ${booking.invoiceNumber}` : ""}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0, height: "80vh" }}>
          {resendMailPreparing ? (
            <div className="d-flex align-items-center justify-content-center h-100">
              <Spinner animation="border" variant="primary" />
              <span className="ms-2 text-muted">Preparing {resendDocLabel.toLowerCase()} attachment…</span>
            </div>
          ) : resendMailPdfUrl ? (
            <iframe
              key={resendMailPdfUrl}
              src={resendMailPdfUrl}
              title={`${resendDocLabel} preview`}
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            />
          ) : (
            <div className="d-flex align-items-center justify-content-center h-100 text-muted small px-4 text-center">
              Voucher preview unavailable. You can still send the mail — the backend will regenerate the
              attachment on dispatch.
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="d-flex align-items-center gap-2 flex-wrap">
          <Form.Group className="flex-grow-1 me-2" style={{ minWidth: 260, maxWidth: 420 }}>
            <Form.Label className="fw-semibold mb-1" style={{ fontSize: "0.8rem" }}>
              Agent Email <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="email"
              size="sm"
              placeholder="name@example.com"
              value={resendMailEmail}
              onChange={(e) => {
                setResendMailEmail(e.target.value);
                if (resendMailEmailError) setResendMailEmailError("");
              }}
              isInvalid={!!resendMailEmailError}
              disabled={resendingMail || resendMailPreparing}
            />
            <Form.Control.Feedback type="invalid">{resendMailEmailError}</Form.Control.Feedback>
          </Form.Group>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setShowResendMailModal(false)}
            disabled={resendingMail}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submitResendMail}
            disabled={resendingMail || resendMailPreparing}
          >
            {resendingMail ? (
              <>
                <Spinner size="sm" className="me-2" />
                Sending…
              </>
            ) : (
              "Send"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
