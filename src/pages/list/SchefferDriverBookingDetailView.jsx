/**
 * SchefferDriverBookingDetailView.jsx
 *
 * Full-page detail view for a single Scheffer Driver booking. Replaces
 * the modal-based "View" that used to live in SchefferDriverBookingList.
 * Per-row Cancel / Voucher / Record-actual-usage icons sit at the bottom
 * of this page as buttons, alongside the booking-action row (mirrors the
 * Long Stay detail view). All existing endpoints / behavior are unchanged:
 *   - Booking detail:  GET    /api/scheffer/booking/{id}
 *   - Voucher PDF:     GET    /api/scheffer/{id}/voucher          (blob)
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
 * NOTE: the Scheffer module exposes only a single blob Voucher endpoint —
 * there is no proforma/invoice PDF generator — so the Proforma / Final
 * Voucher & Invoice buttons from Long Stay are intentionally omitted here.
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
  FaFileAlt,
  FaRoad,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaEnvelope,
  FaIdCard,
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

  // Voucher (PDF) modal
  const [showPdf, setShowPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Actual-usage modal
  const [showUsage, setShowUsage] = useState(false);
  const [savingUsage, setSavingUsage] = useState(false);
  const [usageForm, setUsageForm] = useState({
    actualHoursUsed: "",
    actualKmUsed: "",
    intercityFromCityId: "",
    intercityToCityId: "",
  });
  const [cityList, setCityList] = useState([]);

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

  const fetchBooking = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`${API_BASE}/booking/${id}`);
      setDetails(res.data);
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

  // Cities used by the Record-Actual-Usage modal's intercity selects.
  useEffect(() => {
    (async () => {
      try {
        const r = await axiosInstance.get("/api/province", {
          params: { limit: 500 },
        });
        const items = Array.isArray(r.data) ? r.data : r.data?.content || [];
        setCityList(
          items.map((it) => ({
            id: it.id ?? it.stateId ?? it.placeid ?? it.provinceId,
            name: it.name ?? it.stateName ?? it.placeName ?? it.provinceName,
          })),
        );
      } catch (e) {
        console.error("Error loading cities:", e);
      }
    })();
  }, []);

  const cityName = (cid) => {
    const c = cityList.find((x) => String(x.id) === String(cid));
    return c ? c.name : "";
  };

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

  // Combined status label for the header / Trip Info StatusBadge. Surfaces
  // the cancelled-from state when available (e.g. "ReConfirmed/Cancelled").
  const displayStatus = isCancelled
    ? details?.confirmationStatus
      ? `${details.confirmationStatus}/Cancelled`
      : "Cancelled"
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

  // ── Voucher PDF ─────────────────────────────────────────────────
  const onVoucher = async () => {
    if (!bookingId) return;
    setShowPdf(true);
    setLoadingPdf(true);
    setPdfUrl(null);
    try {
      const res = await axiosInstance.get(`${API_BASE}/${bookingId}/voucher`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error("Voucher error:", e);
      toast.error("Failed to generate voucher");
    } finally {
      setLoadingPdf(false);
    }
  };

  const closePdf = () => {
    setShowPdf(false);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  };

  // ── Record Actual Usage ─────────────────────────────────────────
  const openUsage = () => {
    if (!details) return;
    setUsageForm({
      actualHoursUsed:
        details.actualHoursUsed != null ? details.actualHoursUsed : "",
      actualKmUsed: details.actualKmUsed != null ? details.actualKmUsed : "",
      intercityFromCityId: "",
      intercityToCityId: "",
    });
    setShowUsage(true);
  };

  const saveUsage = async () => {
    if (!bookingId) return;
    setSavingUsage(true);
    try {
      const payload = {
        actualHoursUsed:
          usageForm.actualHoursUsed === ""
            ? null
            : Number(usageForm.actualHoursUsed),
        actualKmUsed:
          usageForm.actualKmUsed === ""
            ? null
            : Number(usageForm.actualKmUsed),
        intercityFromCityId: usageForm.intercityFromCityId
          ? Number(usageForm.intercityFromCityId)
          : null,
        intercityFromCity: usageForm.intercityFromCityId
          ? cityName(usageForm.intercityFromCityId)
          : null,
        intercityToCityId: usageForm.intercityToCityId
          ? Number(usageForm.intercityToCityId)
          : null,
        intercityToCity: usageForm.intercityToCityId
          ? cityName(usageForm.intercityToCityId)
          : null,
      };
      await axiosInstance.put(`${API_BASE}/${bookingId}/usage`, payload);
      toast.success("Usage updated — final amount recalculated");
      setShowUsage(false);
      fetchBooking();
    } catch (e) {
      console.error("Usage update error:", e);
      toast.error("Failed to update usage");
    } finally {
      setSavingUsage(false);
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
                          value={details.luggage ? "Yes" : "No"}
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
                            <th>Age</th>
                            <th>Passport</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.guests.map((g, idx) => (
                            <tr key={g.id || idx}>
                              <td>{idx + 1}</td>
                              <td>{g.isChild ? "Child" : "Adult"}</td>
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
                              <td>{g.age ?? "-"}</td>
                              <td>{g.passportNo || "-"}</td>
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
                        <InfoRow
                          label={
                            <>
                              <FaIdCard /> Passport
                            </>
                          }
                          value={details.custPassport || "-"}
                        />
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
                            label="Extra Rates"
                            value={`Hour: AED ${
                              details.extraHourRate ?? "-"
                            } · KM: AED ${details.extraKmRate ?? "-"}`}
                          />
                          <InfoRow
                            label="Actual Used"
                            value={`${
                              details.actualHoursUsed != null
                                ? `${details.actualHoursUsed} hrs`
                                : "—"
                            }${
                              details.actualKmUsed != null
                                ? ` · ${details.actualKmUsed} km`
                                : ""
                            }`}
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
                  <button
                    style={BUTTON_STYLE}
                    onClick={onVoucher}
                    title="Voucher"
                  >
                    <FaFileAlt style={{ marginRight: "6px" }} />
                    VOUCHER
                  </button>

                  {details.packageName && !isCancelled && (
                    <button
                      style={BUTTON_STYLE}
                      onClick={openUsage}
                      title="Record actual usage"
                    >
                      <FaRoad style={{ marginRight: "6px" }} />
                      RECORD USAGE
                    </button>
                  )}

                  {!isCancelled && (
                    <button
                      style={BUTTON_STYLE}
                      onClick={openCancelModal}
                      title="Cancel"
                    >
                      <FaTrash style={{ marginRight: "6px" }} />
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
                    style={BUTTON_STYLE}
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

      {/* Voucher PDF modal */}
      <Modal
        show={showPdf}
        onHide={closePdf}
        size="xl"
        centered
        scrollable
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header
          closeButton
          style={{
            backgroundColor: "#fff",
            borderBottom: "2px solid #e9ecef",
          }}
        >
          <Modal.Title style={{ fontSize: "1rem", fontWeight: 700 }}>
            Voucher{" "}
            {details?.bookingCode ? "— " + details.bookingCode : ""}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0, height: "80vh" }}>
          {loadingPdf ? (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center">
              <Spinner animation="border" style={{ color: "#c0392b" }} />
              <p className="mt-2 text-muted">Generating Voucher...</p>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0`}
              width="100%"
              height="100%"
              title="scheffer-driver-voucher"
              style={{ border: "none", display: "block" }}
            />
          ) : (
            <div className="h-100 d-flex align-items-center justify-content-center">
              <p className="text-danger">Failed to load PDF.</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer
          style={{
            backgroundColor: "#f8f9fa",
            borderTop: "1px solid #dee2e6",
          }}
        >
          {pdfUrl && (
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => window.open(pdfUrl, "_blank")}
            >
              Download
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={closePdf}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Actual usage modal */}
      <Modal show={showUsage} onHide={() => setShowUsage(false)} centered>
        <Modal.Header
          closeButton
          style={{
            backgroundColor: "#fff",
            borderBottom: "2px solid #e9ecef",
          }}
        >
          <Modal.Title className="fw-bold d-flex align-items-center">
            <FaRoad className="me-2 text-warning" />
            <span>Record Actual Usage</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          {details && (
            <>
              <p className="text-muted small mb-3">
                Package <strong>{details.packageName}</strong> —{" "}
                {details.includedHours ?? "-"} hrs /{" "}
                {details.includedKm ?? "-"} km included. Extra hour: AED{" "}
                {details.extraHourRate ?? "-"}, Extra km: AED{" "}
                {details.extraKmRate ?? "-"}.
              </p>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Label>Actual Hours Used</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    value={usageForm.actualHoursUsed}
                    onChange={(e) =>
                      setUsageForm((p) => ({
                        ...p,
                        actualHoursUsed: e.target.value,
                      }))
                    }
                  />
                </Col>
                <Col md={6}>
                  <Form.Label>Actual KM Used</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    value={usageForm.actualKmUsed}
                    onChange={(e) =>
                      setUsageForm((p) => ({
                        ...p,
                        actualKmUsed: e.target.value,
                      }))
                    }
                  />
                </Col>
                <Col md={12}>
                  <hr className="my-2" />
                  <small className="text-muted">
                    Intercity leg (optional — adds surcharge)
                  </small>
                </Col>
                <Col md={6}>
                  <Form.Label>From City</Form.Label>
                  <Form.Select
                    value={usageForm.intercityFromCityId}
                    onChange={(e) =>
                      setUsageForm((p) => ({
                        ...p,
                        intercityFromCityId: e.target.value,
                      }))
                    }
                  >
                    <option value="">None</option>
                    {cityList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={6}>
                  <Form.Label>To City</Form.Label>
                  <Form.Select
                    value={usageForm.intercityToCityId}
                    onChange={(e) =>
                      setUsageForm((p) => ({
                        ...p,
                        intercityToCityId: e.target.value,
                      }))
                    }
                  >
                    <option value="">None</option>
                    {cityList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>
            </>
          )}
        </Modal.Body>
        <Modal.Footer
          style={{
            backgroundColor: "#f8f9fa",
            borderTop: "1px solid #dee2e6",
          }}
        >
          <Button
            variant="secondary"
            onClick={() => setShowUsage(false)}
            disabled={savingUsage}
          >
            Cancel
          </Button>
          <Button variant="success" onClick={saveUsage} disabled={savingUsage}>
            {savingUsage ? "Saving..." : "Save & Recalculate"}
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
