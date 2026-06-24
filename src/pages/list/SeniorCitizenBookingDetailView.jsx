/**
 * SeniorCitizenBookingDetailView.jsx
 *
 * Detail view for a senior-citizen booking. UI + functionality mirror
 * StudentBookingDetailView.jsx: same card / section-header / info-row /
 * button styling, the same two-status flow (Confirmed → Proforma docs +
 * Reconfirm; ReConfirmed → final docs), the same action set and modals,
 * and the same "Add New Item" → child sub-booking behaviour.
 *
 * Action set (all backed by /api/senior-citizen-booking):
 *   - ADD NEW ITEM        → /new-booking/senior-citizen?parentBookingCode=<code>
 *                           (creates a child booking SNCIT7/1, SNCIT7/2, …)
 *   - CANCEL              → DELETE /api/senior-citizen-booking/:id
 *   - RECONFIRM           → PATCH  /api/senior-citizen-booking/:id/reconfirm
 *   - VOUCHER / INVOICE / PROFORMA → GET /api/senior-citizen-booking/:id/document?type=
 *   - ADD AGENT REFERENCE → GET/POST /api/senior-citizen-booking/:id/agent-reference
 *   - CONFIRMATION NO.    → POST   /api/senior-citizen-booking/:id/confirmation-no
 *   - BOOKING REMARK      → POST   /api/senior-citizen-booking/:id/remark
 *   - RESEND MAIL TO AGENT→ POST   /api/senior-citizen-booking/:id/resend-mail
 */

import React, { useCallback, useEffect, useState } from "react";
import { Container, Row, Col, Spinner, Table, Modal, Button, Form } from "react-bootstrap";
import { useParams, useNavigate } from "react-router-dom";
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

const INFO_VALUE = { color: "#222", fontSize: "0.82rem" };

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

const InfoRow = ({ label, value }) => (
  <div style={{ marginBottom: 6 }}>
    <span style={INFO_LABEL}>{label}</span>
    <span style={INFO_VALUE}>{value ?? "-"}</span>
  </div>
);

export default function SeniorCitizenBookingDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cancel
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  // Reconfirm
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmingBooking, setConfirmingBooking] = useState(false);

  // Agent reference
  const [showAgentRefModal, setShowAgentRefModal] = useState(false);
  const [agentRefInput, setAgentRefInput] = useState("");
  const [agentRefError, setAgentRefError] = useState("");
  const [savingAgentRef, setSavingAgentRef] = useState(false);

  // Confirmation number
  const [showConfirmationNoModal, setShowConfirmationNoModal] = useState(false);
  const [confirmationNoInput, setConfirmationNoInput] = useState("");
  const [confirmationNoError, setConfirmationNoError] = useState("");
  const [savingConfirmationNo, setSavingConfirmationNo] = useState(false);

  // Remark
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [remarkInput, setRemarkInput] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);

  // Notes (ad-hoc, multiple) — added via the NOTES modal.
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Documents (Voucher / Proforma Voucher / Invoice / Proforma Invoice)
  const [generatingDocType, setGeneratingDocType] = useState(null);
  // Resend mail
  const [resendingMail, setResendingMail] = useState(false);

  // Related notes (added via the NOTES page) — shown under the Remarks section.
  const [relatedNotes, setRelatedNotes] = useState([]);

  const fetchBooking = useCallback(() => {
    if (!id) return;
    setLoading(true);
    return axiosInstance
      .get(`/api/senior-citizen-booking/${id}`)
      .then((res) => {
        if (res.data?.success !== false) setBooking(res.data);
        else toast.error(res.data?.message || "Failed to load booking details");
      })
      .catch(() => toast.error("Error loading booking details"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  // Load the booking's related notes so they can be previewed under Remarks.
  const fetchNotes = useCallback(() => {
    if (!id) return;
    axiosInstance
      .get(`/api/senior-citizen-booking/${id}/notes`)
      .then((res) => {
        if (res.data?.success) setRelatedNotes(res.data.notes || []);
      })
      .catch(() => {
        /* non-fatal — notes preview is optional */
      });
  }, [id]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // ── Status helpers ────────────────────────────────────────────────
  const normalizedStatus = String(booking?.confirmationStatus || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const isCancelled = !!booking?.cancelled;
  const isConfirmedOrLater =
    normalizedStatus === "CONFIRMED" ||
    normalizedStatus === "RECONFIRMED" ||
    normalizedStatus === "COMPLETED";
  // Final docs available once the booking is reconfirmed/completed.
  const showsFinalDocs = normalizedStatus === "RECONFIRMED" || normalizedStatus === "COMPLETED";

  // Composite label: a Confirmed booking that's later cancelled shows
  // "Confirmed / Cancelled".
  const statusLabel = (() => {
    const raw = String(booking?.confirmationStatus || "").trim();
    if (isCancelled) {
      if (normalizedStatus === "CONFIRMED" || normalizedStatus === "RECONFIRMED") {
        return `${raw} / Cancelled`;
      }
      return "Cancelled";
    }
    return raw || "-";
  })();
  const statusColor = (() => {
    if (isCancelled) return "#dc3545"; // cancelled → red
    if (normalizedStatus === "RECONFIRMED" || normalizedStatus === "COMPLETED")
      return "#198754"; // finalised → green
    if (normalizedStatus === "CONFIRMED") return "#e67e22"; // pending reconfirm → orange
    if (normalizedStatus === "ONREQUEST" || normalizedStatus === "NOTCONFIRMED")
      return "#e67e22"; // on request → orange
    return "#6c757d"; // default → grey
  })();
  const StatusBadge = () => {
    const raw = String(booking?.confirmationStatus || "").trim();
    const isConfirmedish =
      normalizedStatus === "CONFIRMED" ||
      normalizedStatus === "RECONFIRMED" ||
      normalizedStatus === "COMPLETED";
    const base = { fontWeight: "700", fontSize: "0.85rem" };

    // Cancelled on top of a Confirmed/Reconfirmed booking → two-tone:
    // the original status in green, "/ Cancelled" in red.
    if (isCancelled && isConfirmedish) {
      return (
        <span style={base}>
          <span style={{ color: "#198754" }}>{raw}</span>
          <span style={{ color: "#dc3545" }}> / Cancelled</span>
        </span>
      );
    }
    if (isCancelled) {
      return <span style={{ ...base, color: "#dc3545" }}>Cancelled</span>;
    }
    // Confirmed / Reconfirmed → green; everything else uses statusColor.
    const color = isConfirmedish ? "#198754" : statusColor;
    return <span style={{ ...base, color }}>{raw || "-"}</span>;
  };

  // ── Currency ──────────────────────────────────────────────────────
  const _dispCode = booking?.displayCurrencyCode;
  const _aedTotal = Number(booking?.totalRate) || 0;
  const _dispAmt = Number(booking?.displayAmount);
  const isConverted =
    !!_dispCode && _dispCode !== "AED" && Number.isFinite(_dispAmt) && _dispAmt > 0 && _aedTotal > 0;
  const currencyCode = isConverted ? _dispCode : "AED";
  const currencyFactor = isConverted ? _dispAmt / _aedTotal : 1;
  const money = (aed) =>
    aed == null ? "-" : `${currencyCode} ${((Number(aed) || 0) * currencyFactor).toFixed(2)}`;

  // ── Handlers ──────────────────────────────────────────────────────
  const cancelBooking = async () => {
    try {
      setCancellingBooking(true);
      const res = await axiosInstance.delete(`/api/senior-citizen-booking/${id}`, {
        params: cancellationReason ? { reason: cancellationReason } : {},
      });
      if (res.data?.success !== false) {
        setShowCancelModal(false);
        setCancellationReason("");
        toast.success("Booking cancelled");
        await fetchBooking();
      } else {
        toast.error(res.data?.message || "Failed to cancel booking");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to cancel booking");
    } finally {
      setCancellingBooking(false);
    }
  };

  const confirmBooking = async () => {
    try {
      setConfirmingBooking(true);
      const res = await axiosInstance.patch(`/api/senior-citizen-booking/${id}/reconfirm`);
      if (res.data?.success) {
        setShowConfirmModal(false);
        toast.success(res.data.message || "Booking reconfirmed successfully!");
        await fetchBooking();
      } else {
        toast.error(res.data?.message || "Failed to reconfirm booking");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to reconfirm booking");
    } finally {
      setConfirmingBooking(false);
    }
  };

  const openAgentRefModal = async () => {
    if (!isConfirmedOrLater) {
      toast.error("Agent Reference can only be added once the booking is Confirmed or ReConfirmed.");
      return;
    }
    setAgentRefInput(booking?.agentReference || "");
    setAgentRefError("");
    setShowAgentRefModal(true);
    try {
      const res = await axiosInstance.get(`/api/senior-citizen-booking/${id}/agent-reference`);
      if (res?.data?.agentLpo) setAgentRefInput(res.data.agentLpo);
    } catch (e) {
      /* non-fatal */
    }
  };

  const saveAgentRef = async () => {
    const v = (agentRefInput || "").trim();
    if (!v) {
      setAgentRefError("Agent Reference is required");
      return;
    }
    setAgentRefError("");
    try {
      setSavingAgentRef(true);
      const res = await axiosInstance.post(`/api/senior-citizen-booking/${id}/agent-reference`, {
        agentLpo: v,
      });
      if (res.data?.success) {
        setShowAgentRefModal(false);
        toast.success(res.data.message || "Agent Reference updated successfully");
        await fetchBooking();
      } else {
        toast.error(res.data?.message || "Failed to update Agent Reference");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update Agent Reference");
    } finally {
      setSavingAgentRef(false);
    }
  };

  const openConfirmationNoModal = async () => {
    if (!isConfirmedOrLater) {
      toast.error("Confirmation Number can only be added once the booking is Confirmed or ReConfirmed.");
      return;
    }
    setConfirmationNoInput(booking?.confirmationNumber || "");
    setConfirmationNoError("");
    setShowConfirmationNoModal(true);
    try {
      const res = await axiosInstance.get(`/api/senior-citizen-booking/${id}/agent-reference`);
      if (res?.data?.confirmationNumber) setConfirmationNoInput(res.data.confirmationNumber);
    } catch (e) {
      /* non-fatal */
    }
  };

  const saveConfirmationNo = async () => {
    const v = (confirmationNoInput || "").trim();
    if (!v) {
      setConfirmationNoError("Confirmation Number is required");
      return;
    }
    setConfirmationNoError("");
    try {
      setSavingConfirmationNo(true);
      const res = await axiosInstance.post(`/api/senior-citizen-booking/${id}/confirmation-no`, {
        confirmationNumber: v,
      });
      if (res.data?.success) {
        setShowConfirmationNoModal(false);
        toast.success(res.data.message || "Confirmation number saved successfully!");
        await fetchBooking();
      } else {
        toast.error(res.data?.message || "Failed to save confirmation number");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save confirmation number");
    } finally {
      setSavingConfirmationNo(false);
    }
  };

  const openRemarkModal = () => {
    setRemarkInput(booking?.remarks || "");
    setShowRemarkModal(true);
  };

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
        `/api/senior-citizen-booking/${id}/notes`,
        { noteText: text, createdBy },
      );
      if (res.data?.success) {
        toast.success(res.data?.message || "Note saved");
        setShowNotesModal(false);
        setNoteInput("");
        fetchNotes(); // refresh the preview under Remarks
      } else {
        toast.error(res.data?.message || "Failed to save note");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  const saveRemark = async () => {
    const text = (remarkInput || "").trim();
    if (!text) {
      toast.error("Remark cannot be empty");
      return;
    }
    try {
      setSavingRemark(true);
      const res = await axiosInstance.post(`/api/senior-citizen-booking/${id}/remark`, { remarks: text });
      if (res.data?.success !== false) {
        setShowRemarkModal(false);
        toast.success(res.data?.message || "Remark saved successfully");
        await fetchBooking();
      } else {
        toast.error(res.data?.message || "Failed to save remark");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save remark");
    } finally {
      setSavingRemark(false);
    }
  };

  // Typed document download — backs Voucher / Proforma Voucher / Invoice /
  // Proforma Invoice via GET /api/senior-citizen-booking/:id/document?type=...
  const handleDocument = async (type, label) => {
    try {
      setGeneratingDocType(type);
      const res = await axiosInstance.get(`/api/senior-citizen-booking/${id}/document`, {
        params: { type },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (e) {
      toast.error(`Failed to generate ${label || "document"}`);
    } finally {
      setGeneratingDocType(null);
    }
  };

  const resendMailToAgent = async () => {
    try {
      setResendingMail(true);
      const res = await axiosInstance.post(`/api/senior-citizen-booking/${id}/resend-mail`);
      if (res.data?.success) {
        toast.success(res.data.message || "Mail resent to agent");
      } else {
        toast.error(res.data?.message || "Failed to resend mail");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to resend mail");
    } finally {
      setResendingMail(false);
    }
  };

  const c = booking?.customer || {};
  const guestName =
    [c.salutation, c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ") || "-";
  const rooms = booking?.rooms || [];
  const totalAdults = rooms.reduce((s, r) => s + (r.adults || 0), 0);
  const totalChildren = rooms.reduce((s, r) => s + (r.children || 0), 0);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* Back button */}
            <div className="mb-3">
              <button style={{ ...BUTTON_STYLE, backgroundColor: "#555" }} onClick={() => navigate(-1)}>
                ← Back
              </button>
              <span
                style={{ marginLeft: "12px", fontWeight: "700", fontSize: "1.1rem", color: "#333" }}
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
              <div className="text-center py-5 text-muted">Booking not found.</div>
            ) : (
              <>
                {/* ── Booking Info ─────────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Booking Information</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow label="Booking Code" value={booking.bookingCode} />
                        <InfoRow label="Hotel Name" value={booking.hotelName} />
                        <InfoRow label="Address" value={booking.address} />
                        <InfoRow
                          label="Star Rating"
                          value={booking.starRating ? `${booking.starRating} Star` : "-"}
                        />
                        <InfoRow label="Check-In" value={formatDateTime(booking.checkInDate)} />
                        <InfoRow label="Check-Out" value={formatDateTime(booking.checkOutDate)} />
                        <InfoRow
                          label="No. of Nights"
                          value={booking.nights ? `${booking.nights} Nights` : "-"}
                        />
                      </Col>
                      <Col md={6}>
                        <InfoRow label="Agent" value={booking.agentId} />
                        {booking.employeeName && (
                          <InfoRow label="Booked By Employee" value={booking.employeeName} />
                        )}
                        <InfoRow
                          label="Deadline Date"
                          value={
                            booking.deadlineDate ? (
                              <span style={{ color: "#dc3545", fontWeight: 600 }}>
                                {booking.deadlineDate.replace("T", " ")}
                              </span>
                            ) : (
                              "-"
                            )
                          }
                        />
                        {booking.agentReference && (
                          <InfoRow label="Agent Reference" value={booking.agentReference} />
                        )}
                        {booking.confirmationNumber && (
                          <InfoRow label="Confirmation No." value={booking.confirmationNumber} />
                        )}
                        <InfoRow label="Refund Status" value={booking.refundStatus} />
                        <InfoRow label="Voucher" value={booking.voucherGenerated} />
                        <InfoRow label="Payment Mode" value={booking.paymentMode} />
                        <InfoRow label="Total" value={money(booking.totalRate)} />
                        <InfoRow label="Status" value={<StatusBadge />} />
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
                          <InfoRow label="Guest Name" value={guestName} />
                          <InfoRow label="Nationality" value={c.nativeCountry} />
                        </Col>
                      </Row>
                    </div>
                  </div>
                )}

                {/* ── Senior Citizen Verification (senior-specific) ────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Senior Citizen Verification</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow label="Senior Citizen Name" value={booking.seniorCitizenName} />
                        <InfoRow
                          label="Verification Method"
                          value={
                            booking.verificationMethod === "EMPLOYEE_CODE"
                              ? "Employee Code"
                              : booking.verificationMethod
                              ? "ID Document Upload"
                              : "-"
                          }
                        />
                      </Col>
                      <Col md={6}>
                        {booking.seniorCitizenCode && (
                          <InfoRow label="Citizen Code" value={booking.seniorCitizenCode} />
                        )}
                        {booking.govEmployeeDepartment && (
                          <InfoRow label="Department" value={booking.govEmployeeDepartment} />
                        )}
                      </Col>
                    </Row>
                    {booking.govtIdFileName && (
                      <InfoRow label="Uploaded Document" value={booking.govtIdFileName} />
                    )}
                  </div>
                </div>

                {/* ── Rooms Details ───────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Rooms Details</div>
                  <div style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: "0.82rem", color: "#555", marginBottom: 8 }}>
                      No of Rooms - {rooms.length} &nbsp;|&nbsp; No of Guests - {totalAdults} Adult
                      {totalAdults !== 1 ? "s" : ""}
                      {totalChildren ? `, ${totalChildren} Child${totalChildren !== 1 ? "ren" : ""}` : ""}
                    </div>
                    <Table bordered size="sm" style={{ fontSize: "0.8rem", marginBottom: 8 }}>
                      <thead style={{ backgroundColor: "#f8f9fa" }}>
                        <tr>
                          <th>#</th>
                          <th>Category</th>
                          <th>Meal Plan</th>
                          <th>Adults</th>
                          <th>Children</th>
                          <th>Refund</th>
                          <th className="text-end">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rooms.map((r, idx) => (
                          <tr key={r.roomBookingId || idx}>
                            <td>{r.roomNo || idx + 1}</td>
                            <td>{r.roomCategory || "-"}</td>
                            <td>{r.mealPlan || "-"}</td>
                            <td>{r.adults || 0}</td>
                            <td>{r.children || 0}</td>
                            <td>{r.nonRefundable ? "Non-Refundable" : "Flexible"}</td>
                            <td className="text-end">{money(r.rate)}</td>
                          </tr>
                        ))}
                        {rooms.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center text-muted">
                              No rooms.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                    {/* Per-room guests */}
                    {rooms.some((r) => Array.isArray(r.guests) && r.guests.length > 0) && (
                      <div style={{ fontSize: "0.8rem" }}>
                        {rooms.map((r, idx) =>
                          Array.isArray(r.guests) && r.guests.length > 0 ? (
                            <div key={r.roomBookingId || idx} className="mb-1">
                              <span style={INFO_LABEL}>Room {r.roomNo || idx + 1} Guests</span>
                              <span style={INFO_VALUE}>
                                {r.guests
                                  .map((g) =>
                                    [g.salutation, g.firstName, g.lastName].filter(Boolean).join(" "),
                                  )
                                  .join(", ")}
                              </span>
                            </div>
                          ) : null,
                        )}
                      </div>
                    )}
                    <div className="d-flex justify-content-between fw-bold" style={{ fontSize: "0.85rem" }}>
                      <span>Total Rate</span>
                      <span>{money(booking.totalRate)}</span>
                    </div>
                  </div>
                </div>

                {/* ── Cancellation Policy ─────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Cancellation Policy</div>
                  <div style={{ padding: "12px 16px", fontSize: "0.82rem", color: "#333" }}>
                    {String(booking.refundStatus || "").toLowerCase().includes("non")
                      ? "Non-Refundable — this booking cannot be cancelled for a refund once confirmed."
                      : "Flexible — cancellation is allowed per the hotel's refund terms."}
                    {isCancelled && booking.cancellationReason && (
                      <div className="text-danger mt-2">Cancelled — {booking.cancellationReason}</div>
                    )}
                  </div>
                </div>

                {/* ── Remarks ─────────────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Remarks</div>
                  <div style={{ padding: "10px 16px", fontSize: "0.83rem", color: "#333" }}>
                    {booking.remarks ? (
                      <p style={{ marginBottom: 0 }}>{booking.remarks}</p>
                    ) : (
                      <span className="text-muted">No remarks.</span>
                    )}

                  </div>
                </div>

                {/* ── Remarks ─────────────────────────────────────────── */}
                <div style={card}>
                  <div style={SECTION_HEADER}>Notes</div>
                  <div style={{ padding: "10px 16px", fontSize: "0.83rem", color: "#333" }}>
                  {relatedNotes.length > 0 && (
                      <div style={{ marginTop: booking.remarks ? 10 : 0 }}>
                        {relatedNotes.map((n) => (
                          <div key={n.noteId} style={{ marginBottom: 6 }}>
                            <span
                              style={{
                                color: "#1d4ed8",
                                fontWeight: 600,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {n.noteText}
                            </span>
                            {n.createdBy && (
                              <span
                                style={{
                                  color: "#9aa0a6",
                                  fontSize: "0.72rem",
                                  marginLeft: 8,
                                }}
                              >
                                — {n.createdBy}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Related Sub-Bookings (created via ADD NEW ITEM) ──── */}
                {Array.isArray(booking.subBookings) && booking.subBookings.length > 0 && (
                  <div style={card}>
                    <div style={SECTION_HEADER}>
                      Related Sub-Bookings ({booking.subBookings.length})
                    </div>
                    <div style={{ padding: "10px 16px" }}>
                      {booking.subBookings.map((sub, sIdx) => {
                        const subRooms = sub.rooms?.length ?? 0;
                        const subAdults = sub.rooms?.reduce((s, r) => s + (r.adults || 0), 0) ?? 0;
                        const subChildren = sub.rooms?.reduce((s, r) => s + (r.children || 0), 0) ?? 0;
                        return (
                          <div
                            key={sub.bookingId || sIdx}
                            style={{ borderTop: sIdx === 0 ? "none" : "1px solid #eee", padding: "10px 0" }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "6px",
                              }}
                            >
                              <span style={{ color: "#c0392b", fontWeight: "700", fontSize: "0.9rem" }}>
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
                                    (Item #{sub.childBookingIndex})
                                  </span>
                                )}
                              </span>
                              <button
                                style={{ ...BUTTON_STYLE, backgroundColor: "#555" }}
                                onClick={() =>
                                  navigate(`/booking-details/senior-citizen-booking/${sub.bookingId}`)
                                }
                              >
                                View
                              </button>
                            </div>
                            <Row>
                              <Col md={6}>
                                <InfoRow label="Reference No." value={sub.referenceNumber} />
                                <InfoRow label="Hotel" value={sub.hotelName} />
                                <InfoRow label="Check-In" value={formatDateTime(sub.checkInDate)} />
                                <InfoRow label="Check-Out" value={formatDateTime(sub.checkOutDate)} />
                              </Col>
                              <Col md={6}>
                                <InfoRow
                                  label="Rooms / Guests"
                                  value={`${subRooms} Room${subRooms !== 1 ? "s" : ""}, ${subAdults} Adult${
                                    subAdults !== 1 ? "s" : ""
                                  }${
                                    subChildren > 0
                                      ? `, ${subChildren} Child${subChildren !== 1 ? "ren" : ""}`
                                      : ""
                                  }`}
                                />
                                <InfoRow label="Total Rate" value={money(sub.totalRate)} />
                                <InfoRow label="Status" value={sub.confirmationStatus || "-"} />
                                <InfoRow label="Booking Date" value={formatDateTime(sub.bookingDate)} />
                              </Col>
                            </Row>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Action Buttons ──────────────────────────────────────
                    The two-status flow drives the document pair:
                      • Confirmed   → RECONFIRM + Proforma Voucher / Invoice
                      • ReConfirmed → Voucher / Invoice
                    A cancelled booking keeps every applicable button (only
                    CANCEL and RECONFIRM are dropped). */}
                <div style={{ marginBottom: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    style={BUTTON_STYLE}
                    onClick={() => {
                      const parent = booking.parentBookingCode || booking.bookingCode;
                      navigate(
                        `/new-booking/senior-citizen?parentBookingCode=${encodeURIComponent(parent)}`,
                      );
                    }}
                  >
                    ADD NEW ITEM
                  </button>
                  {!isCancelled && (
                    <button style={BUTTON_STYLE} onClick={() => setShowCancelModal(true)}>
                      CANCEL
                    </button>
                  )}
                  {!showsFinalDocs && !isCancelled && (
                    <button style={BUTTON_STYLE} onClick={() => setShowConfirmModal(true)}>
                      RECONFIRM
                    </button>
                  )}
                  {!showsFinalDocs ? (
                    <>
                      <button
                        style={BUTTON_STYLE}
                        disabled={generatingDocType === "PROFORMA_VOUCHER"}
                        onClick={() => handleDocument("PROFORMA_VOUCHER", "Proforma Voucher")}
                      >
                        {generatingDocType === "PROFORMA_VOUCHER" ? "GENERATING..." : "PROFORMA VOUCHER"}
                      </button>
                      <button
                        style={BUTTON_STYLE}
                        disabled={generatingDocType === "PROFORMA_INVOICE"}
                        onClick={() => handleDocument("PROFORMA_INVOICE", "Proforma Invoice")}
                      >
                        {generatingDocType === "PROFORMA_INVOICE" ? "GENERATING..." : "PROFORMA INVOICE"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        style={BUTTON_STYLE}
                        disabled={generatingDocType === "VOUCHER"}
                        onClick={() => handleDocument("VOUCHER", "Voucher")}
                      >
                        {generatingDocType === "VOUCHER" ? "GENERATING..." : "VOUCHER"}
                      </button>
                      <button
                        style={BUTTON_STYLE}
                        disabled={generatingDocType === "COMPLETED"}
                        onClick={() => handleDocument("COMPLETED", "Invoice")}
                      >
                        {generatingDocType === "COMPLETED" ? "GENERATING..." : "INVOICE"}
                      </button>
                    </>
                  )}
                  <button style={BUTTON_STYLE} onClick={openAgentRefModal}>
                    ADD AGENT REFERENCE
                  </button>
                  <button style={BUTTON_STYLE} onClick={openConfirmationNoModal}>
                    CONFIRMATION NO.
                  </button>
                  <button style={BUTTON_STYLE} onClick={resendMailToAgent} disabled={resendingMail}>
                    {resendingMail ? "SENDING..." : "RESEND MAIL TO AGENT"}
                  </button>
                  <button style={BUTTON_STYLE} onClick={openRemarkModal}>
                    BOOKING REMARK
                  </button>
                  <button style={BUTTON_STYLE} onClick={openNotesModal}>
                    NOTES
                  </button>
                </div>

                {/* ── Booking Date footer ─────────────────────────────── */}
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
              </>
            )}
          </Container>
        </main>
      </div>

      {/* Cancel Modal */}
      <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "1rem" }}>Cancel Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            Are you sure you want to cancel this booking? Refundable bookings will have their agent
            credit restored.
          </p>
          <Form.Group>
            <Form.Label>Cancellation Reason (optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Reason for cancellation"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowCancelModal(false)} disabled={cancellingBooking}>
            Close
          </Button>
          <Button variant="danger" onClick={cancelBooking} disabled={cancellingBooking}>
            {cancellingBooking ? <Spinner size="sm" /> : "Cancel Booking"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Reconfirm Modal */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "1rem" }}>Reconfirm Booking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">Are you sure you want to reconfirm the booking?</p>
          <div className="small" style={{ color: "#555" }}>
            <div>
              <strong>Booking Code:</strong> {booking?.bookingCode || "-"}
            </div>
            <div>
              <strong>Hotel:</strong> {booking?.hotelName || "-"}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowConfirmModal(false)} disabled={confirmingBooking}>
            Close
          </Button>
          <Button variant="success" onClick={confirmBooking} disabled={confirmingBooking}>
            {confirmingBooking ? <Spinner size="sm" /> : "Reconfirm"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Agent Reference Modal */}
      <Modal show={showAgentRefModal} onHide={() => setShowAgentRefModal(false)} centered backdrop="static" keyboard={false}>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "1rem" }}>Agent Reference</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">Are you sure you want to update the agent reference?</p>
          <div className="small mb-3" style={{ color: "#555" }}>
            <div>
              <strong>Booking Code:</strong> {booking?.bookingCode || "-"}
            </div>
            <div>
              <strong>Hotel:</strong> {booking?.hotelName || "-"}
            </div>
          </div>
          <Form.Group>
            <Form.Label>Agent Reference *</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter Agent Reference"
              value={agentRefInput}
              onChange={(e) => {
                setAgentRefInput(e.target.value);
                if (agentRefError) setAgentRefError("");
              }}
              isInvalid={!!agentRefError}
              disabled={savingAgentRef}
            />
            <Form.Control.Feedback type="invalid">{agentRefError}</Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowAgentRefModal(false)} disabled={savingAgentRef}>
            Close
          </Button>
          <Button variant="primary" onClick={saveAgentRef} disabled={savingAgentRef}>
            {savingAgentRef ? <Spinner size="sm" /> : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Confirmation Number Modal */}
      <Modal show={showConfirmationNoModal} onHide={() => setShowConfirmationNoModal(false)} centered backdrop="static" keyboard={false}>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "1rem" }}>Confirmation Number</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">Are you sure you want to update the confirmation no?</p>
          <div className="small mb-3" style={{ color: "#555" }}>
            <div>
              <strong>Booking Code:</strong> {booking?.bookingCode || "-"}
            </div>
            <div>
              <strong>Hotel:</strong> {booking?.hotelName || "-"}
            </div>
          </div>
          <Form.Group>
            <Form.Label>Confirmation Number *</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter Hotel Confirmation Number"
              value={confirmationNoInput}
              onChange={(e) => {
                setConfirmationNoInput(e.target.value);
                if (confirmationNoError) setConfirmationNoError("");
              }}
              isInvalid={!!confirmationNoError}
              disabled={savingConfirmationNo}
            />
            <Form.Control.Feedback type="invalid">{confirmationNoError}</Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowConfirmationNoModal(false)} disabled={savingConfirmationNo}>
            Close
          </Button>
          <Button variant="primary" onClick={saveConfirmationNo} disabled={savingConfirmationNo}>
            {savingConfirmationNo ? <Spinner size="sm" /> : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Remark Modal */}
      <Modal show={showRemarkModal} onHide={() => setShowRemarkModal(false)} centered backdrop="static" keyboard={false}>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "1rem" }}>Booking Remark</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Remark</Form.Label>
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
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowRemarkModal(false)} disabled={savingRemark}>
            Close
          </Button>
          <Button variant="primary" onClick={saveRemark} disabled={savingRemark}>
            {savingRemark ? <Spinner size="sm" /> : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Notes Modal — add an ad-hoc note (long text). On OK we POST the note,
          close, and refresh the coloured preview under the Remarks section. */}
      <Modal
        show={showNotesModal}
        onHide={() => setShowNotesModal(false)}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "1rem" }}>Add Note</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Note</Form.Label>
            <Form.Control
              as="textarea"
              rows={6}
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
          <Button variant="primary" onClick={saveNote} disabled={savingNote}>
            {savingNote ? <Spinner size="sm" /> : "OK"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
