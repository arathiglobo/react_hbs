/**
 * SchefferDriverBookingDetailView.jsx
 *
 * Full-page detail view for a single Scheffer Driver booking. Replaces
 * the modal-based "View" that used to live in SchefferDriverBookingList.
 * Per-row Cancel / Voucher / Record-actual-usage icons sit at the bottom
 * of this page as buttons, alongside the booking-action row (mirrors the
 * Long Stay detail view). All existing endpoints / behavior are unchanged:
 *   - Booking detail:  GET    /api/scheffer/booking/{id}
 *   - Document PDFs:   GET    /api/scheffer_booking/{id}/pdf?type=...
 *                        type ∈ { PROFORMA_VOUCHER, PROFORMA_INVOICE,
 *                                 VOUCHER, INVOICE } → PdfGenerationResponseDTO
 *   - Cancel:          DELETE /api/scheffer/delete/{id}?reason=
 *   - Record usage:    PUT    /api/scheffer/{id}/usage
 *
 * Booking-action endpoints (mirror Long Stay, Scheffer-scoped):
 *   - PATCH /api/scheffer/{id}/confirmation-status
 *   - GET   /api/scheffer/{id}/agent-reference
 *   - POST  /api/scheffer/{id}/agent-reference  { agentLpo }
 *   - POST  /api/scheffer/{id}/remark           { remarks }
 *   - POST  /api/scheffer/{id}/resend-mail
 *   - GET / POST /api/scheffer/{id}/notes
 *
 * DOCUMENTS: mirrors /booking-details/hotel-booking/{id} — while the booking
 * is Confirmed (not yet reconfirmed) the Proforma Voucher / Proforma Invoice
 * buttons show; after Reconfirm (or Completed) they switch to the final
 * Voucher / Invoice. The backend returns a ready pdfUrl which is rendered
 * inline in the preview modal (no blob).
 *
 * Booking summary is passed via location.state when the user clicks the
 * eye icon; on hard refresh we re-fetch from /booking/{id}.
 *
 * VISUAL: this view is reskinned to match the Hotel Booking detail view
 * (BookingDetailedView.jsx) — shared style constants (card / SECTION_HEADER /
 * InfoRow / StatusBadge), header layout, action-button bar and modal chrome.
 * Only the presentation changed; every data field, endpoint and handler is
 * preserved exactly.
 */
import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Table,
  Spinner,
  Form,
  Modal,
  Button,
} from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  FaCar,
  FaTrash,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaEnvelope,
  FaExclamationCircle,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

const API_BASE = "/api/scheffer";

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

// Purpose-based colour variants for the action buttons — identical palette to
// the Hotel Booking detail view (BookingDetailedView.jsx) so the two flows
// look uniform. Each reuses the exact BUTTON_STYLE shape (size / padding /
// radius / white text); only the background colour changes. No behaviour,
// handler, or guard is affected.
const BTN_TEAL = { ...BUTTON_STYLE, backgroundColor: "#0d9488" }; // Reconfirm
const BTN_DANGER = { ...BUTTON_STYLE, backgroundColor: "#dc2626" }; // Cancel
const BTN_SKY = { ...BUTTON_STYLE, backgroundColor: "#3ba2e8" }; // Add Agent Reference
const BTN_INDIGO = { ...BUTTON_STYLE, backgroundColor: "#6366f1" }; // Confirmation No.
const BTN_INFO = { ...BUTTON_STYLE, backgroundColor: "#0891b2" }; // Voucher / Invoice docs
const BTN_ORANGE = { ...BUTTON_STYLE, backgroundColor: "#f0922b" }; // Resend Mail
const BTN_ACCENT = { ...BUTTON_STYLE, backgroundColor: "#7c3aed" }; // Booking Remark
const BTN_NEUTRAL = { ...BUTTON_STYLE, backgroundColor: "#64748b" }; // Back / Notes

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

const parseLocal = (str) => {
  if (!str) return null;
  const normalized = String(str).includes("T") ? str : `${str}T00:00:00`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
};

const formatDate = (dateStr) => {
  const d = parseLocal(dateStr);
  if (!d) return "-";
  const day = String(d.getDate()).padStart(2, "0");
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

// Kept the original short date helper for the Scheffer-specific Pickup /
// Dropoff rows (date-only display, no time component).
const fmtDate = (d) => (d ? String(d).split("T")[0] : "-");

const StatusBadge = ({ status }) => {
  // Each part of the status is coloured on its own. Confirmed / ReConfirmed
  // → green, Cancelled → red, On Request → orange.
  const colorFor = (part) => {
    const p = (part || "").trim().toUpperCase();
    if (p.startsWith("CONFIRMED") || p.startsWith("RECONFIRMED"))
      return "#16a34a";
    if (p.startsWith("CANCELLED")) return "#dc2626";
    if (p === "ON REQUEST") return "#e67e22";
    return "#888";
  };

  const formatTitleCase = (part) => {
    if (!part) return "";
    const p = part.trim();
    if (!p) return "";
    const upper = p.toUpperCase();
    if (upper === "CONFIRMED") return "Confirmed";
    if (upper === "RECONFIRMED") return "Reconfirmed";
    if (upper === "CANCELLED") return "Cancelled";
    if (upper === "ON REQUEST") return "On Request";
    return p
      .toLowerCase()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const parts = String(status || "-").split("/");
  return (
    <span style={{ fontWeight: "700", fontSize: "0.85rem" }}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ color: "#888" }}>/</span>}
          <span style={{ color: colorFor(part) }}>{formatTitleCase(part)}</span>
        </React.Fragment>
      ))}
    </span>
  );
};

export default function SchefferDriverBookingDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Booking summary — location.state.booking when navigating from list,
  // re-fetched from /booking/{id} on hard refresh.
  const [details, setDetails] = useState(location.state?.booking || null);
  const [loading, setLoading] = useState(!details);

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  // Document preview modal (Proforma/Final Voucher & Invoice). Mirrors the
  // Hotel Booking detail view: the backend returns a JSON DTO carrying a
  // ready pdfUrl, which we render directly in an iframe (no blob). `pdfPreview`
  // holds { url, label, type }; `generatingPdfType` gates the button spinner.
  const [pdfPreview, setPdfPreview] = useState(null);
  const [generatingPdfType, setGeneratingPdfType] = useState(null);



  // Reconfirm (Confirm / Reject popup)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmingBooking, setConfirmingBooking] = useState(false);

  // Reject (follow-up modal from Reconfirm → Reject)
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectedBy, setRejectedBy] = useState("");
  const [rejectedByError, setRejectedByError] = useState("");
  const [rejectionRemarks, setRejectionRemarks] = useState("");
  const [rejectingBooking, setRejectingBooking] = useState(false);

  // Agent Reference (GET prefill / POST agent-reference)
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

  // Fallback luggage capacity fetched from cab registration when the booking
  // record doesn't carry maxLuggageCapacity (old bookings created before the
  // field was added to the payload). Only populated when needed; never
  // overwrites the booking-level value if it's already present.
  const [cabMaxLuggageCapacity, setCabMaxLuggageCapacity] = useState(null);

const getPickupLandmarkAddress = (b) => {
  if (!b) return "";
  return (
    b.pickupLandmarkAddress ||
    b.pickupLandmark ||
    b.landmark ||
    b.landMark ||
    b.pickupAddress ||
    b.pickUpLandmark ||
    b.pickUpLandmarkAddress ||
    b.pickUpAddress ||
    b.pickupLocation ||
    b.pickupDetails ||
    b.pickupRemark ||
    b.pickupLandmarkDetails ||
    b.custPickupLandmark ||
    b.custPickupAddress ||
    b.customerDTO?.pickupLandmark ||
    b.customerDTO?.pickupLandmarkAddress ||
    b.customerDTO?.landmark ||
    b.customerDTO?.pickupAddress ||
    b.customer?.pickupLandmark ||
    b.customer?.pickupLandmarkAddress ||
    b.customer?.landmark ||
    b.customer?.pickupAddress ||
    ""
  );
};

  const fetchBooking = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`${API_BASE}/booking/${id}`);
      setDetails((prev) => ({ ...(prev || {}), ...(res.data || {}) }));
    } catch (e) {
      console.error("Failed to load booking", e);
      toast.error("Failed to load booking");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Always re-fetch on mount so the detail reflects the latest persisted
    // state (and so the action buttons gate off fresh confirmation fields).
    fetchBooking();
    // eslint-disable-next-line
  }, [id]);

  // When booking details load and maxLuggageCapacity is not stored in the
  // booking record (pre-fix old bookings), try to fetch it from the cab
  // registration using the cabId / cabProviderId that the booking carries.
  // This is a read-only, best-effort fetch — any failure is silently ignored.
  useEffect(() => {
    if (!details) return;
    // If the booking already has the value, nothing to do.
    const bookingLuggage =
      details.maxLuggageCapacity ??
      details.cabMaxLuggageCapacity ??
      details.maxLuggage;
    if (bookingLuggage != null) {
      setCabMaxLuggageCapacity(null); // clear any stale fallback
      return;
    }

    // Try to look up the cab's maxLuggageCapacity from the registration using
    // the cabProviderId (returned by the booking API) + cabId.
    const providerId =
      details.cabProviderId ??
      details.cabProvider ??
      details.providerId;
    const cabId = details.cabId;

    if (!providerId || !cabId) return;

    let cancelled = false;
    axiosInstance
      .get(`/api/SchefferDriver/cabs/${providerId}`)
      .then((res) => {
        if (cancelled) return;
        const cabs = Array.isArray(res.data) ? res.data : [];
        const cab = cabs.find((c) => String(c.cabId) === String(cabId));
        if (cab && cab.maxLuggageCapacity != null) {
          setCabMaxLuggageCapacity(cab.maxLuggageCapacity);
        }
      })
      .catch(() => {
        // Silently ignore — the Luggage field will just show the legacy
        // boolean fallback for very old bookings.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details?.id, details?.cabId, details?.cabProviderId]);



  const bookingId = details?.id || details?.custombookingId || id;

  // ── Status helpers (mirror Long Stay) ───────────────────────────────
  const normalizedStatus = String(details?.confirmationStatus || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const isCancelled =
    details?.status === "CANCELLED" || normalizedStatus === "CANCELLED";
  const showsFinalDocs =
    details?.reconfirmation === true ||
    normalizedStatus === "RECONFIRMED" ||
    normalizedStatus === "COMPLETED";
  const isConfirmedOrLater =
    normalizedStatus === "CONFIRMED" ||
    normalizedStatus === "RECONFIRMED" ||
    normalizedStatus === "COMPLETED" ||
    details?.reconfirmation === true;

  // Combined status label for the header / Trip Info StatusBadge.
  // Shows status progression: Confirmed → Reconfirmed → Cancelled
  // Mirrors the hotel booking detail page pattern.
  const displayStatus = isCancelled
    ? normalizedStatus === "RECONFIRMED"
      ? "Confirmed/Reconfirmed/Cancelled"
      : normalizedStatus === "CONFIRMED"
      ? "Confirmed/Cancelled"
      : "Cancelled"
    : normalizedStatus === "RECONFIRMED"
    ? "Confirmed/Reconfirmed"
    : details?.confirmationStatus || details?.status || "Confirmed";

  // ── Cancel ──────────────────────────────────────────────────────
  const openCancelModal = () => {
    setCancellationReason("");
    setShowCancel(true);
  };

  const doCancel = async () => {
    if (!bookingId) return;
    setCancelling(true);
    try {
      const params = cancellationReason.trim()
        ? { reason: cancellationReason.trim() }
        : undefined;
      await axiosInstance.delete(`${API_BASE}/delete/${bookingId}`, { params });
      toast.success("Booking cancelled");
      setShowCancel(false);
      setCancellationReason("");
      fetchBooking();
    } catch (e) {
      console.error("Cancel error:", e);
      toast.error(e.response?.data?.message || "Failed to cancel booking");
    } finally {
      setCancelling(false);
    }
  };

  // ── Document PDF gateway ─────────────────────────────────────────
  // Shared by Proforma Voucher / Proforma Invoice / Voucher / Invoice.
  // `type` matches the backend enum (PROFORMA_VOUCHER | PROFORMA_INVOICE |
  // VOUCHER | INVOICE). The controller returns a PdfGenerationResponseDTO
  // { status, message, pdfUrl }; we render pdfUrl directly in the preview
  // modal. Mirrors BookingDetailedView.jsx's handleDownloadPdf so the two
  // flows behave identically. Note: the Scheffer final-invoice type is
  // INVOICE (the Hotel flow uses COMPLETED) — see SchefferBookingPdfController.
  const handleDownloadPdf = async (type, label) => {
    if (!bookingId) return;
    try {
      setGeneratingPdfType(type);
      const response = await axiosInstance.get(
        `/api/scheffer_booking/${bookingId}/pdf`,
        { params: { type: type.toUpperCase() } },
      );
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
          response.data?.message || `Failed to generate ${label || type}.`,
        );
      }
    } catch (e) {
      console.error(`Error generating ${type} PDF:`, e);
      toast.error(
        e.response?.data?.message || `Error generating ${label || type}.`,
      );
    } finally {
      setGeneratingPdfType(null);
    }
  };



  // ── Reconfirm ──────────────────────────────────────────────────────
  const openConfirmModal = () => setShowConfirmModal(true);

  const confirmBooking = async () => {
    if (!bookingId) return;
    try {
      setConfirmingBooking(true);
      await axiosInstance.patch(
        `${API_BASE}/${bookingId}/confirmation-status`,
        { confirmStatus: true },
      );
      setShowConfirmModal(false);
      toast.success("Booking reconfirmed successfully!");
      await fetchBooking();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to reconfirm booking. Please try again.",
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
        `${API_BASE}/${bookingId}/confirmation-status`,
        {
          action: "REJECT",
          rejectedBy: rb,
          rejectionRemarks: (rejectionRemarks || "").trim() || null,
        },
      );
      setShowRejectModal(false);
      toast.success("Booking rejected.");
      await fetchBooking();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to reject booking. Please try again.",
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
        `${API_BASE}/${bookingId}/agent-reference`,
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
      await axiosInstance.post(`${API_BASE}/${bookingId}/agent-reference`, {
        agentLpo: lpoTrimmed,
      });
      setShowConfirmStatusModal(false);
      toast.success("Agent Reference updated successfully");
      await fetchBooking();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to update Agent Reference. Please try again.",
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
        `${API_BASE}/${bookingId}/agent-reference`,
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
        `${API_BASE}/${bookingId}/confirmation-status`,
        { action: "CONFIRMATION_NO", confirmationNumber: value },
      );
      setShowConfirmationNoModal(false);
      toast.success("Confirmation number saved successfully!");
      await fetchBooking();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to save confirmation number. Please try again.",
      );
    } finally {
      setSavingConfirmationNo(false);
    }
  };

  // ── Booking Remark ─────────────────────────────────────────────────
  const openRemarkModal = () => {
    setRemarkInput(details?.remarks || "");
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
      await axiosInstance.post(`${API_BASE}/${bookingId}/remark`, {
        remarks: text,
      });
      setShowRemarkModal(false);
      toast.success("Remark saved successfully");
      await fetchBooking();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to save remark. Please try again.",
      );
    } finally {
      setSavingRemark(false);
    }
  };

  // ── Resend Mail to Agent ───────────────────────────────────────────
  const resendMailToAgent = async () => {
    try {
      setResendingMail(true);
      await axiosInstance.post(`${API_BASE}/${bookingId}/resend-mail`);
      toast.success("Mail resent to agent successfully!");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to resend mail to agent. Please try again.",
      );
    } finally {
      setResendingMail(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* Back button + title + booking code */}
            <div className="mb-3 d-flex align-items-center flex-wrap gap-2">
              <button
                style={BTN_NEUTRAL}
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
                <FaCar className="me-2" style={{ color: "#c0392b" }} />
                Booking Details
                {details?.bookingCode && (
                  <span
                    style={{
                      marginLeft: "12px",
                      fontWeight: "700",
                      fontSize: "0.95rem",
                      color: "#c0392b",
                    }}
                  >
                    {details.bookingCode}
                  </span>
                )}
              </span>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" style={{ color: "#c0392b" }} />
                <p className="mt-3 text-muted">Loading booking details...</p>
              </div>
            ) : !details ? (
              <div className="text-center py-5 text-muted">
                Booking not found.
              </div>
            ) : (
              <>
                {/* ── Trip Information ──────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Trip Information</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow
                          label="Booking Code"
                          value={
                            details.bookingCode ||
                            details.packageBookCode ||
                            "-"
                          }
                        />
                        <InfoRow
                          label="Status"
                          value={<StatusBadge status={displayStatus} />}
                        />
                        <InfoRow
                          label="Cab"
                          value={`${details.cabName || "-"} (${
                            details.cabProviderName || "-"
                          })`}
                        />
                        <InfoRow
                          label={
                            <>
                              <FaMapMarkerAlt
                                className="me-1"
                                style={{ color: "#16a34a" }}
                              />
                              Pickup
                            </>
                          }
                          value={`${fmtDate(details.pickupDate)} — ${
                            details.pickupName || "-"
                          }${
                            details.pickupTime ? ` @ ${details.pickupTime}` : ""
                          }`}
                        />
                        <InfoRow
                          label={
                            <>
                              <FaMapMarkerAlt
                                className="me-1"
                                style={{ color: "#16a34a" }}
                              />
                              Pickup Landmark Address
                            </>
                          }
                          value={getPickupLandmarkAddress(details) || "-"}
                        />
                        <InfoRow
                          label={
                            <>
                              <FaMapMarkerAlt
                                className="me-1"
                                style={{ color: "#dc2626" }}
                              />
                              Dropoff
                            </>
                          }
                          value={`${fmtDate(details.dropOffDate)} — ${
                            details.dropoffName || "-"
                          }${
                            details.dropoffTime
                              ? ` @ ${details.dropoffTime}`
                              : ""
                          }`}
                        />
                        <InfoRow
                          label="Deadline Date"
                          value={
                            details.deadlineDate ? (
                              <span style={{ color: "#dc2626", fontWeight: 600 }}>
                                {`${String(details.deadlineDate).slice(0, 10)} 02:00 PM (UAE)`}
                              </span>
                            ) : (
                              "-"
                            )
                          }
                        />
                      </Col>
                      <Col md={6}>
                        <InfoRow
                          label="Hours"
                          value={details.hourDetails ?? "-"}
                        />
                        <InfoRow
                          label="Pax"
                          value={`${details.noOfAdult || 0} ADT / ${
                            details.noOfChild || 0
                          } CHD`}
                        />
                        <InfoRow
                          label="Luggage"
                          value={(() => {
                            // Check multiple possible field names in order of
                            // preference: booking-level snapshot → fallback
                            // fetched from cab registration → legacy boolean.
                            const capacity =
                              details.maxLuggageCapacity ??
                              details.cabMaxLuggageCapacity ??
                              details.maxLuggage ??
                              cabMaxLuggageCapacity;
                            if (capacity != null) {
                              return `${capacity} pieces`;
                            }
                            return details.luggage ? "Yes" : "No";
                          })()}
                        />
                        {(details.transporter || details.driverName) && (
                          <InfoRow
                            label="Transporter / Driver"
                            value={
                              <>
                                {details.transporter || "-"}
                                {details.contactNumber && (
                                  <>
                                    {" "}
                                    · <FaPhoneAlt size={10} />{" "}
                                    {details.contactNumber}
                                  </>
                                )}
                                {details.driverName && (
                                  <> · {details.driverName}</>
                                )}
                                {details.driverContact && (
                                  <>
                                    {" "}
                                    · <FaPhoneAlt size={10} />{" "}
                                    {details.driverContact}
                                  </>
                                )}
                              </>
                            }
                          />
                        )}
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Passengers ───────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>
                    Passengers (
                    {(details.noOfAdult || 0) + (details.noOfChild || 0)})
                  </div>
                  <div style={{ padding: "10px 16px" }}>
                    {details.guests && details.guests.length > 0 ? (
                      <Table
                        bordered
                        size="sm"
                        style={{ fontSize: "0.82rem", marginBottom: 0 }}
                      >
                        <thead style={{ backgroundColor: "#f8f8f8" }}>
                          <tr>
                            <th>#</th>
                            <th>Type</th>
                            <th>Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.guests.map((g, idx) => (
                            <tr key={g.id || idx}>
                              <td>{idx + 1}</td>
                              <td>
                                {g.isChild ? "Child" : "Adult"}
                                {g.isLead && !g.isChild && (
                                  <span
                                    style={{
                                      marginLeft: 6,
                                      padding: "1px 6px",
                                      background: "#0d6efd",
                                      color: "#fff",
                                      borderRadius: 4,
                                      fontSize: "0.7rem",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Lead
                                  </span>
                                )}
                              </td>
                              <td>
                                {[
                                  g.salutation,
                                  g.firstName,
                                  g.middleName,
                                  g.lastName,
                                ]
                                  .filter(Boolean)
                                  .join(" ") || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    ) : (
                      <span className="text-muted">
                        No passenger manifest recorded.
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Primary Contact ──────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Primary Contact</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow
                          label={
                            <>
                              <i
                                className="fas fa-user"
                                style={{ marginRight: 4 }}
                              />{" "}
                              Name
                            </>
                          }
                          value={
                            [
                              details.custSalutation,
                              details.custFirstName,
                              details.custMiddleName,
                              details.custLastName,
                            ]
                              .filter(Boolean)
                              .join(" ") || "-"
                          }
                        />
                        <InfoRow
                          label={
                            <>
                              <FaPhoneAlt /> Phone
                            </>
                          }
                          value={details.custPhone || "-"}
                        />
                        <InfoRow
                          label={
                            <>
                              <FaEnvelope /> Email
                            </>
                          }
                          value={details.custEmail || "-"}
                        />
                      </Col>
                      <Col md={6}>
                        {details.custAgentLpo && (
                          <InfoRow
                            label="Agent LPO"
                            value={details.custAgentLpo}
                          />
                        )}
                        {details.agentLpo && (
                          <InfoRow
                            label="Agent Reference"
                            value={details.agentLpo}
                          />
                        )}
                        {details.confirmationNumber && (
                          <InfoRow
                            label="Confirmation No."
                            value={details.confirmationNumber}
                          />
                        )}
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Rental Package (only when present) ────────────── */}
                {details.packageName && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>Rental Package</div>
                    <div style={{ padding: "12px 16px" }}>
                      <Row>
                        <Col md={6}>
                          <InfoRow
                            label="City / Cab Type"
                            value={`${details.cityName || "-"} · ${
                              details.cabType || "-"
                            }`}
                          />
                          <InfoRow
                            label="Package"
                            value={details.packageName}
                          />
                          <InfoRow
                            label="Included"
                            value={`${details.includedHours ?? "-"} hrs · ${
                              details.includedKm ?? "-"
                            } km`}
                          />
                        </Col>
                        <Col md={6}>
                          <InfoRow
                            label="No. of Kilometers Used"
                            value={(() => {
                              const km =
                                details.includedKm ?? details.kmIncluded;
                              if (km == null || km === "") return "-";
                              return String(km).toLowerCase().includes("km")
                                ? km
                                : `${km} km`;
                            })()}
                          />
                          {(details.extraHoursCharge > 0 ||
                            details.extraKmCharge > 0 ||
                            details.intercityCharge > 0) && (
                            <InfoRow
                              label="Extra Charges"
                              value={
                                <>
                                  {details.extraHoursCharge > 0 && (
                                    <span className="me-2">
                                      Hours: AED {details.extraHoursCharge}
                                    </span>
                                  )}
                                  {details.extraKmCharge > 0 && (
                                    <span className="me-2">
                                      KM: AED {details.extraKmCharge}
                                    </span>
                                  )}
                                  {details.intercityCharge > 0 && (
                                    <span>
                                      Intercity: AED {details.intercityCharge}
                                      {details.intercityFromCity &&
                                      details.intercityToCity
                                        ? ` (${details.intercityFromCity} → ${details.intercityToCity})`
                                        : ""}
                                    </span>
                                  )}
                                </>
                              }
                            />
                          )}
                        </Col>
                      </Row>
                    </div>
                  </div>
                )}

                {/* ── Pricing ──────────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Pricing</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        {details.sellingPrice && (
                          <InfoRow
                            label="Selling Price"
                            value={`AED ${details.sellingPrice}`}
                          />
                        )}
                        {details.totalRate != null &&
                          details.totalRate !== details.totalPrice && (
                            <InfoRow
                              label="Total Rate"
                              value={`AED ${details.totalRate}`}
                            />
                          )}
                        {details.tourismDirham &&
                          Number(details.tourismDirham) > 0 && (
                            <InfoRow
                              label="Tourism Dirham"
                              value={`AED ${details.tourismDirham}`}
                            />
                          )}
                      </Col>
                      <Col md={6}>
                        <InfoRow
                          label="Total Price"
                          value={
                            <strong>
                              AED{" "}
                              {details.totalPrice ||
                                details.totalRate ||
                                "-"}
                            </strong>
                          }
                        />
                        {details.finalAmount != null && (
                          <InfoRow
                            label="Final Amount"
                            value={
                              <strong style={{ color: "#16a34a" }}>
                                AED {details.finalAmount}
                              </strong>
                            }
                          />
                        )}
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Remarks ──────────────────────────────────────── */}
                {details.remarks && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>Remarks</div>
                    <div
                      style={{
                        padding: "10px 16px",
                        fontSize: "0.83rem",
                        color: "#333",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {details.remarks}
                    </div>
                  </div>
                )}

                {/* ── Action Buttons ───────────────────────────────── */}
                <div
                  style={{
                    marginBottom: "10px",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Documents — mirrors /booking-details/hotel-booking/{id}:
                       while the booking is still Confirmed (not reconfirmed)
                       show the PROFORMA Voucher / Invoice; once it has been
                       reconfirmed (or completed) show the final Voucher /
                       Invoice. The backend's proforma endpoints skip the
                       confirmed-status guard, and the final ones require
                       Confirmed/ReConfirmed/Completed/Cancelled, so this stays
                       consistent with the button that's shown. */}
                  {!showsFinalDocs ? (
                    <>
                      <button
                        style={BTN_INFO}
                        disabled={generatingPdfType === "PROFORMA_VOUCHER"}
                        onClick={() =>
                          handleDownloadPdf("PROFORMA_VOUCHER", "Proforma Voucher")
                        }
                        title="Proforma Voucher"
                      >
                        {generatingPdfType === "PROFORMA_VOUCHER"
                          ? "GENERATING..."
                          : "PROFORMA VOUCHER"}
                      </button>
                      <button
                        style={BTN_INFO}
                        disabled={generatingPdfType === "PROFORMA_INVOICE"}
                        onClick={() =>
                          handleDownloadPdf("PROFORMA_INVOICE", "Proforma Invoice")
                        }
                        title="Proforma Invoice"
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
                        title="Voucher"
                      >
                        {generatingPdfType === "VOUCHER"
                          ? "GENERATING..."
                          : "VOUCHER"}
                      </button>
                      <button
                        style={BTN_INFO}
                        disabled={generatingPdfType === "INVOICE"}
                        onClick={() => handleDownloadPdf("INVOICE", "Invoice")}
                        title="Invoice"
                      >
                        {generatingPdfType === "INVOICE"
                          ? "GENERATING..."
                          : "INVOICE"}
                      </button>
                    </>
                  )}



                  {!isCancelled && (
                    <button
                      style={BTN_DANGER}
                      onClick={openCancelModal}
                      title="Cancel"
                    >
                      <FaTrash style={{ marginRight: "6px" }} />
                      CANCEL
                    </button>
                  )}

                  {!showsFinalDocs && !isCancelled && (
                    <button style={BTN_TEAL} onClick={openConfirmModal}>
                      RECONFIRM
                    </button>
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

                  <button
                    style={BTN_ORANGE}
                    onClick={resendMailToAgent}
                    disabled={resendingMail}
                  >
                    {resendingMail ? "SENDING..." : "RESEND MAIL TO AGENT"}
                  </button>

                  <button style={BTN_ACCENT} onClick={openRemarkModal}>
                    BOOKING REMARK
                  </button>

                  <button
                    style={BTN_NEUTRAL}
                    onClick={() =>
                      navigate(
                        `/booking-details/scheffer-driver-booking/${bookingId}/notes`,
                      )
                    }
                  >
                    NOTES
                  </button>
                </div>

                {/* ── Booking Date footer ──────────────────────────── */}
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
                    details.bookingDate ||
                      details.createdAt ||
                      details.bookingDateTime,
                  )}
                </div>
              </>
            )}
          </Container>
        </main>
      </div>

      {/* Cancel confirmation */}
      <Modal
        show={showCancel}
        onHide={() => {
          if (!cancelling) {
            setShowCancel(false);
            setCancellationReason("");
          }
        }}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header
          closeButton={!cancelling}
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
                {details?.bookingCode || details?.packageBookCode || "N/A"}
              </div>
            </div>
            <Form.Group controlId="cancellationReason" className="text-start">
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
              setShowCancel(false);
              setCancellationReason("");
            }}
            disabled={cancelling}
          >
            No
          </Button>
          <Button variant="danger" onClick={doCancel} disabled={cancelling}>
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

      {/* Document preview modal — Proforma/Final Voucher & Invoice.
          Mirrors the Hotel Booking detail view: renders the ready pdfUrl
          returned by the backend directly in an iframe (no blob), with
          Open-in-new-tab / Download / Close affordances. */}
      <Modal
        show={!!pdfPreview}
        onHide={() => setPdfPreview(null)}
        size="xl"
        centered
        scrollable
        backdrop="static"
        keyboard
      >
        <Modal.Header
          closeButton
          style={{
            backgroundColor: "#fff",
            borderBottom: "2px solid #e9ecef",
          }}
        >
          <Modal.Title style={{ fontSize: "1rem", fontWeight: 700 }}>
            {pdfPreview?.label || "Document"}
            {details?.bookingCode ? " — " + details.bookingCode : ""}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0, height: "80vh" }}>
          {pdfPreview?.url ? (
            <iframe
              key={pdfPreview.url}
              src={pdfPreview.url}
              width="100%"
              height="100%"
              title={pdfPreview.label || "PDF preview"}
              style={{ border: "none", display: "block" }}
            />
          ) : (
            <div className="h-100 d-flex align-items-center justify-content-center">
              <p className="text-muted mb-0">No PDF loaded.</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer
          style={{
            backgroundColor: "#f8f9fa",
            borderTop: "1px solid #dee2e6",
          }}
        >
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
                download={`Scheffer_${bookingId}_${
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
                {details?.bookingCode || "N/A"}
              </div>
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
          <div className="text-muted small mb-3">
            <strong>Booking Code:</strong> {details?.bookingCode || "N/A"}
          </div>
          <Form.Group controlId="confirmAgentLpoInput">
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
          <Modal.Title className="fw-bold">Confirmation Number</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          <div className="text-muted small mb-3">
            <strong>Booking Code:</strong> {details?.bookingCode || "N/A"}
          </div>
          <Form.Group controlId="confirmationNoInput">
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
    </div>
  );
}

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
