/**
 * DayStayBookingDetailView.jsx
 *
 * Full-page detail view for a single Day Stay booking. Replaces the
 * modal-based "View" that used to live in DayStayBookingList. The
 * Voucher / Cancel row icons now sit at the bottom-left of this page as
 * buttons. Endpoints:
 *   - Detail fetch :  GET    /api/day-stay-booking/{id}
 *   - Voucher PDF  :  GET    /api/day-stay-booking/{id}/voucher
 *                     → { status: "SUCCESS", pdfUrl }
 *   - Send by mail :  POST   /api/day-stay-booking/send-pdf-email
 *                     { email, pdfUrl, bookingId }
 *   - Cancel       :  POST   /api/day-stay-booking/{id}/cancel  { reason }
 *
 * The voucher click now opens a modal with an in-page iframe preview
 * of the returned PDF (same pattern as
 * MakeYourOwnPackageV2BookingDetailView).
 *
 * The list row is forwarded via location.state.booking so the page has a
 * booking-code header even before the detail fetch resolves. On hard
 * refresh the route id alone drives the fetch.
 *
 * VISUAL NOTE: the presentation here mirrors the Hotel Booking detail
 * view (BookingDetailedView.jsx) — same card / SECTION_HEADER / InfoRow
 * tokens, StatusBadge colour logic, action-button bar and modal chrome.
 * Only the presentation was reskinned; every Day Stay data field,
 * endpoint, handler and modal is preserved unchanged.
 */
import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Table,
  Spinner,
  Form,
  InputGroup,
  Modal,
  Button,
} from "react-bootstrap";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  FaFileAlt,
  FaTrashAlt,
  FaEnvelope,
  FaPaperPlane,
  FaDownload,
} from "react-icons/fa";
import { FaExclamationCircle } from "react-icons/fa";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

// ── Visual tokens (copied from the Hotel Booking detail view) ──────────
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

// StatusBadge — colour each status word on its own (Confirmed/ReConfirmed
// green, Cancelled red, On Request orange). Copied from the Hotel view.
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

export default function DayStayBookingDetailView() {
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
  const bookingId = rowStub?.id || routeId;

  // Details (modal body content, fetched via the same endpoint the list
  // used). Seeded with the row stub so the header renders immediately.
  const [selected, setSelected] = useState(rowStub);
  const [detailsLoading, setDetailsLoading] = useState(true);

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Voucher modal — iframe preview of the returned PDF + send-email form.
  // Same shape as MakeYourOwnPackageV2BookingDetailView.
  const [showVoucher, setShowVoucher] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sendingMail, setSendingMail] = useState(false);

  // ── Action-button modal / handler state (mirror LongStayBookingDetailView) ──
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

  const fetchDetail = async () => {
    if (!bookingId) {
      toast.error("Booking id missing");
      setDetailsLoading(false);
      return;
    }
    setDetailsLoading(true);
    try {
      const res = await axiosInstance.get(`/api/day-stay-booking/${bookingId}`);
      setSelected(res.data);
    } catch {
      // Fall back to the row stub — preserves the original "if /id fails,
      // render what we have" behaviour the list modal used.
      if (!rowStub) toast.error("Failed to load booking details");
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // ── Cancel ─────────────────────────────────────────────────────────
  const openCancel = () => {
    setCancelReason("");
    setShowCancel(true);
  };

  const submitCancel = async () => {
    if (!bookingId) return;
    setCancelling(true);
    try {
      const trimmed = (cancelReason || "").trim();
      await axiosInstance.post(
        `/api/day-stay-booking/${bookingId}/cancel`,
        null,
        { params: trimmed ? { reason: trimmed } : undefined }
      );
      toast.success("Booking cancelled");
      setShowCancel(false);
      setCancelReason("");
      await fetchDetail();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Cancellation failed");
    } finally {
      setCancelling(false);
    }
  };

  // ── Status helpers (mirror LongStayBookingDetailView). Day Stay uses
  //    `status`/`isCancelled` where Long Stay uses bookingStatus/cancelStatus. ──
  const normalizedStatus = String(selected?.confirmationStatus || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const isCancelledStatus =
    selected?.isCancelled === true ||
    String(selected?.status || "").toUpperCase() === "CANCELLED" ||
    normalizedStatus === "CANCELLED";
  const showsFinalDocs =
    selected?.reconfirmation === true ||
    normalizedStatus === "RECONFIRMED" ||
    normalizedStatus === "COMPLETED";
  const isConfirmedOrLater =
    normalizedStatus === "CONFIRMED" ||
    normalizedStatus === "RECONFIRMED" ||
    normalizedStatus === "COMPLETED" ||
    selected?.reconfirmation === true ||
    String(selected?.status || "").toUpperCase() === "CONFIRMED";

  // Display status for the StatusBadge — surface the raw confirmation/
  // status the booking carries; "Cancelled" wins when the booking is in
  // a cancelled state.
  const displayStatus = isCancelledStatus
    ? "Cancelled"
    : selected?.confirmationStatus ||
      selected?.status ||
      (selected?.reconfirmation ? "ReConfirmed" : "-");

  // ── Reconfirm ──────────────────────────────────────────────────────
  const openConfirmModal = () => setShowConfirmModal(true);

  const confirmBooking = async () => {
    if (!bookingId) return;
    try {
      setConfirmingBooking(true);
      await axiosInstance.patch(
        `/api/day-stay-booking/${bookingId}/confirmation-status`,
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
        `/api/day-stay-booking/${bookingId}/confirmation-status`,
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
        `/api/day-stay-booking/${bookingId}/agent-reference`
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
        `/api/day-stay-booking/${bookingId}/agent-reference`,
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
        `/api/day-stay-booking/${bookingId}/agent-reference`
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
        `/api/day-stay-booking/${bookingId}/confirmation-status`,
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

  // ── Booking Remark ─────────────────────────────────────────────────
  const openRemarkModal = () => {
    setRemarkInput(selected?.remarks || "");
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
      await axiosInstance.post(`/api/day-stay-booking/${bookingId}/remark`, {
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
        `/api/day-stay-booking/${bookingId}/resend-mail`
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

  // ── Voucher ────────────────────────────────────────────────────────
  // Click → backend returns { status, message, pdfUrl }. We open the
  // modal with the iframe loading the returned URL, plus a recipient
  // email field that posts to /send-pdf-email (mirrors the MYOP v2
  // pattern). Errors surface as toasts and the modal stays closed.
  const handleVoucher = async () => {
    if (!bookingId) return;
    setEmail("");
    setEmailError("");
    setPdfUrl("");
    setShowVoucher(true);
    setLoadingPdf(true);
    try {
      const res = await axiosInstance.get(
        `/api/day-stay-bookings/${bookingId}/pdf?type=VOUCHER`
      );
      if (res.data?.status === "SUCCESS" && res.data?.pdfUrl) {
        setPdfUrl(res.data.pdfUrl);
      } else {
        toast.error(res.data?.message || "Failed to generate voucher");
        setShowVoucher(false);
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to generate voucher"
      );
      setShowVoucher(false);
    } finally {
      setLoadingPdf(false);
    }
  };

  const closeVoucher = () => {
    setShowVoucher(false);
    setPdfUrl("");
    setEmail("");
    setEmailError("");
  };

  const handleSendMail = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError("");
    setSendingMail(true);
    try {
      const res = await axiosInstance.post(
        "/api/day-stay-booking/send-pdf-email",
        {
          email,
          pdfUrl,
          bookingId,
        }
      );
      if (res.data?.status === "SUCCESS") {
        toast.success("Voucher emailed to " + email);
        setEmail("");
      } else {
        toast.error(res.data?.message || "Failed to send email");
      }
    } catch (e) {
      console.error("send mail error", e);
      toast.error("Failed to send email");
    } finally {
      setSendingMail(false);
    }
  };

  const isCancelled = !!selected?.isCancelled || isCancelledStatus;

  // Derived totals / display helpers for the cards.
  const totalRooms = selected?.rooms?.length ?? 0;
  const totalAdults =
    selected?.rooms?.reduce((s, r) => s + (Number(r.adults) || 0), 0) ?? 0;
  const totalChildren =
    selected?.rooms?.reduce((s, r) => s + (Number(r.children) || 0), 0) ?? 0;

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* ── Header: Back + title + booking code + status ────────── */}
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
                Day Stay Booking Details
              </span>
              {selected?.bookingCode && (
                <span
                  style={{
                    marginLeft: "10px",
                    fontWeight: "700",
                    fontSize: "0.9rem",
                    color: "#c0392b",
                  }}
                >
                  {selected.bookingCode}
                </span>
              )}
              {selected && (
                <span style={{ marginLeft: "10px" }}>
                  <StatusBadge status={displayStatus} />
                </span>
              )}
            </div>

            {detailsLoading && !selected ? (
              <div className="text-center py-5">
                <Spinner animation="border" style={{ color: "#c0392b" }} />
                <p className="mt-3 text-muted">Loading booking details...</p>
              </div>
            ) : !selected ? (
              <div className="text-center py-5 text-muted">
                Booking not found.
              </div>
            ) : (
              <>
                {/* ── Booking Information ─────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Booking Information</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow
                          label="Booking Code"
                          value={selected.bookingCode}
                        />
                        <InfoRow label="Hotel Name" value={selected.hotelName} />
                        <InfoRow label="Address" value={selected.address} />
                        <InfoRow
                          label="Date"
                          value={
                            selected.checkInDate
                              ? formatDate(selected.checkInDate)
                              : "-"
                          }
                        />
                        <InfoRow
                          label="Window"
                          value={`${(selected.checkInTime || "").slice(0, 5) || "-"} – ${
                            (selected.checkOutTime || "").slice(0, 5) || "-"
                          }`}
                        />
                      </Col>
                      <Col md={6}>
                        <InfoRow label="Agent" value={selected.agentId} />
                        {/* Optional "Booking Done By Employee" — rendered
                            only when an employee was selected at search
                            time. Backend resolves the name from the
                            joined employee row. */}
                        {selected.employeeName && (
                          <InfoRow
                            label="Booked By Employee"
                            value={selected.employeeName}
                          />
                        )}
                        <InfoRow
                          label="Total"
                          value={
                            selected.totalAmount != null
                              ? `AED ${Number(selected.totalAmount).toFixed(2)}`
                              : "-"
                          }
                        />
                        <InfoRow
                          label="Status"
                          value={<StatusBadge status={displayStatus} />}
                        />
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Primary Guest ──────────────────────────────────── */}
                {selected.primaryGuest && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>Primary Guest</div>
                    <div style={{ padding: "12px 16px" }}>
                      <Row>
                        <Col md={6}>
                          <InfoRow
                            label="Guest Name"
                            value={
                              [
                                selected.primaryGuest.salutation,
                                selected.primaryGuest.firstName,
                                selected.primaryGuest.lastName,
                              ]
                                .filter(Boolean)
                                .join(" ") || "-"
                            }
                          />
                          <InfoRow
                            label="Email"
                            value={selected.primaryGuest.email}
                          />
                        </Col>
                        <Col md={6}>
                          <InfoRow
                            label="Phone"
                            value={selected.primaryGuest.phone}
                          />
                          <InfoRow
                            label="LPO"
                            value={selected.primaryGuest.agentLpo}
                          />
                        </Col>
                      </Row>
                    </div>
                  </div>
                )}

                {/* ── Rooms Details ──────────────────────────────────── */}
                <div style={card}>
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
                      No of Rooms - {totalRooms} Room
                      {totalRooms !== 1 ? "s" : ""}
                    </span>
                    <span
                      style={{
                        color: "#c0392b",
                        fontWeight: "600",
                        fontSize: "0.85rem",
                      }}
                    >
                      No of Guests - {totalAdults} Adult
                      {totalAdults !== 1 ? "s" : ""}
                      {totalChildren > 0
                        ? `, ${totalChildren} Child${totalChildren !== 1 ? "ren" : ""}`
                        : ""}
                    </span>
                  </div>
                  <div style={{ padding: "8px 16px 12px" }}>
                    <Table
                      bordered
                      size="sm"
                      style={{ fontSize: "0.82rem", marginBottom: 0 }}
                    >
                      <thead style={{ backgroundColor: "#f8f8f8" }}>
                        <tr>
                          <th>#</th>
                          <th>Category</th>
                          <th>Meal Plan</th>
                          <th>Adults</th>
                          <th>Children</th>
                          <th className="text-end">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selected.rooms || []).map((r, i) => (
                          <tr key={i}>
                            <td>{r.roomNo}</td>
                            <td>{r.roomCategory}</td>
                            <td>{r.mealPlan}</td>
                            <td>{r.adults}</td>
                            <td>{r.children}</td>
                            <td className="text-end">
                              AED {Number(r.rate || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>

                {/* ── Notes (Special Requests / Policy / Cancellation) ─── */}
                {(selected.specialRequests?.length > 0 ||
                  selected.cancellationPolicy?.length > 0 ||
                  selected.isCancelled) && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>Notes</div>
                    <div
                      style={{
                        padding: "10px 16px",
                        fontSize: "0.83rem",
                        color: "#333",
                      }}
                    >
                      {selected.specialRequests?.length > 0 && (
                        <p className="mb-1">
                          <strong>Special Requests:</strong>{" "}
                          {selected.specialRequests.join(", ")}
                        </p>
                      )}
                      {selected.cancellationPolicy?.length > 0 && (
                        <p className="mb-1">
                          <strong>Cancellation Policy:</strong>{" "}
                          {selected.cancellationPolicy.join(" / ")}
                        </p>
                      )}
                      {selected.isCancelled && (
                        <div className="alert alert-danger mt-2 mb-0 py-2 small">
                          <strong>Cancelled at:</strong> {selected.cancelledAt}
                          <br />
                          <strong>Reason:</strong>{" "}
                          {selected.cancellationReason || "—"}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Action Buttons ──────────────────────────────────
                    All booking-level actions live here, reflowing on
                    small screens via flex-wrap. Day Stay's only PDF
                    endpoint is the single /voucher route handled by the
                    green Voucher button — there is no PROFORMA/INVOICE
                    multi-type PDF endpoint, so those four buttons are
                    intentionally omitted. */}
                <div
                  style={{
                    marginBottom: "10px",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                {!isCancelled && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#dc3545" }}
                      onClick={openCancel}
                      title="Cancel Booking"
                    >
                      <FaTrashAlt style={{ marginRight: "6px" }} />
                      Cancel
                    </button>
                  )}

                  <button
                    style={{
                      ...BUTTON_STYLE,
                      backgroundColor: isCancelled ? "#6c757d" : "#dc3545",
                      cursor: isCancelled ? "not-allowed" : "pointer",
                      opacity: isCancelled ? 0.7 : 1,
                    }}
                    onClick={isCancelled ? undefined : handleVoucher}
                    disabled={isCancelled}
                    title={
                      isCancelled
                        ? "Cancelled bookings have no voucher"
                        : "Voucher"
                    }
                  >
                    <FaFileAlt style={{ marginRight: "6px" }} />
                    Voucher
                  </button>

                  {!showsFinalDocs && !isCancelledStatus && (
                    <button style={BUTTON_STYLE} onClick={openConfirmModal}>
                      RECONFIRM
                    </button>
                  )}

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

                  {!isAgentRole && (
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

                  <button
                    style={BUTTON_STYLE}
                    onClick={resendMailToAgent}
                    disabled={resendingMail}
                  >
                    {resendingMail ? "SENDING..." : "RESEND MAIL TO AGENT"}
                  </button>

                  {!isAgentRole && (
                    <button style={BUTTON_STYLE} onClick={openRemarkModal}>
                      BOOKING REMARK
                    </button>
                  )}

                  {!isAgentRole && (
                    <button
                      style={BUTTON_STYLE}
                      onClick={() =>
                        navigate(
                          `/booking-details/day-stay-booking/${bookingId}/notes`
                        )
                      }
                    >
                      NOTES
                    </button>
                  )}
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
                  {selected.bookingDate
                    ? formatDateTime(selected.bookingDate)
                    : "-"}
                </div>

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
                          {selected.bookingCode || "N/A"}
                        </div>
                        {selected.hotelName && (
                          <div>
                            <strong>Hotel:</strong> {selected.hotelName}
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
                    <Modal.Title className="fw-bold">
                      Confirmation Number
                    </Modal.Title>
                  </Modal.Header>
                  <Modal.Body style={{ padding: "1.5rem" }}>
                    <div className="text-muted small mb-3">
                      <div>
                        <strong>Booking Code:</strong>{" "}
                        {selected.bookingCode || "N/A"}
                      </div>
                      {selected.hotelName && (
                        <div>
                          <strong>Hotel:</strong> {selected.hotelName}
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

      {/* ── Cancel modal ──────────────────────────────────────────────── */}
      <Modal
        show={showCancel}
        onHide={() => !cancelling && setShowCancel(false)}
        centered
        backdrop="static"
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
          <p>Are you sure you want to cancel this Day Stay booking?</p>
          <Form.Group controlId="dayStayCancellationReason">
            <Form.Label className="fw-semibold">
              Reason <span className="text-muted">(optional)</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              disabled={cancelling}
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
            disabled={cancelling}
            onClick={() => setShowCancel(false)}
          >
            Back
          </Button>
          <Button variant="danger" disabled={cancelling} onClick={submitCancel}>
            {cancelling ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Cancelling...
              </>
            ) : (
              "Confirm Cancellation"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Voucher / PDF modal — iframe + send-email
          (same shape as MakeYourOwnPackageV2BookingDetailView) ───────── */}
      <Modal
        show={showVoucher}
        onHide={closeVoucher}
        size="xl"
        centered
        scrollable
        backdrop="static"
      >
        <Modal.Header closeButton style={{ fontSize: "1rem" }}>
          <Modal.Title style={{ fontSize: "1rem", fontWeight: 700 }}>
            Voucher{selected?.bookingCode ? ` — ${selected.bookingCode}` : ""}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0" style={{ height: "80vh" }}>
          {loadingPdf ? (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center">
              <Spinner animation="border" style={{ color: "#c0392b" }} />
              <p className="mt-2 text-muted">Generating Voucher…</p>
            </div>
          ) : pdfUrl ? (
            <iframe
              key={pdfUrl}
              src={`${pdfUrl}#toolbar=0`}
              width="100%"
              height="100%"
              title="Voucher PDF"
              style={{ border: "none", display: "block" }}
            />
          ) : (
            <div className="h-100 d-flex align-items-center justify-content-center">
              <p className="text-danger">Failed to load PDF.</p>
            </div>
          )}
        </Modal.Body>
        <div className="p-3 border-top bg-light">
          <Row className="g-2 align-items-center">
            <Col md={8}>
              <InputGroup>
                <InputGroup.Text>
                  <FaEnvelope />
                </InputGroup.Text>
                <Form.Control
                  type="email"
                  placeholder="recipient@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  isInvalid={!!emailError}
                />
                <Button
                  variant="primary"
                  onClick={handleSendMail}
                  disabled={sendingMail || !pdfUrl}
                >
                  {sendingMail ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-1" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <FaPaperPlane className="me-1" /> Send Mail
                    </>
                  )}
                </Button>
              </InputGroup>
              {emailError && (
                <div className="text-danger small mt-1">{emailError}</div>
              )}
            </Col>
            <Col md={4} className="text-end">
              {pdfUrl && (
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => window.open(pdfUrl, "_blank")}
                >
                  <FaDownload className="me-1" /> Download
                </Button>
              )}
            </Col>
          </Row>
        </div>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeVoucher}>
            Close
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
