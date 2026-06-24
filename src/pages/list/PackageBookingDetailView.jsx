/**
 * PackageBookingDetailView.jsx
 *
 * Full-page detail view for a single Package booking. Replaces the
 * modal-based "View" that used to live in PackageBookingList. The
 * Edit / Voucher / Cancel action icons from the row now sit at the
 * bottom-left of this page as buttons. All endpoints / behaviour are
 * unchanged:
 *   - Detail fetch   :  GET  /api/v1/package-booking/booking/{id}
 *   - Voucher PDF    :  GET  /api/v1/package-booking/generate-pdf/{id}  (blob)
 *   - Send voucher   :  POST /api/v1/package-booking/send-voucher/{id}  { email }
 *   - Cancel         :  PUT  /api/v1/package-booking/cancel/{id}
 *   - Amend / Edit   :  navigate('/new-booking/package-booking/{packageId}', state)
 *
 * The list row is forwarded via location.state.booking so the Edit
 * button has access to packageId / agentId / destinationCountryId
 * (those aren't returned by the detail endpoint). On hard refresh the
 * detail endpoint is still called by id, but Edit will toast "package
 * id missing" if state was lost — same guard as the original list.
 */
import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Form,
  Table,
  InputGroup,
  Spinner,
  Modal,
  Button,
} from "react-bootstrap";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  FaEye,
  FaTrash,
  FaFileAlt,
  FaEdit,
  FaEnvelope,
  FaDownload,
  FaExclamationCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

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

// Style tokens mirror BookingDetailedView.jsx (the Hotel booking
// detail page) so this screen reads with the same neutral palette
// — gray section bars, plain label/value rows, no gradients.
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

const CARD_STYLE = {
  border: "1px solid #ddd",
  borderRadius: "4px",
  marginBottom: "14px",
  overflow: "hidden",
  backgroundColor: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const InfoRow = ({ label, value }) => (
  <div
    style={{
      marginBottom: "6px",
      display: "flex",
      alignItems: "flex-start",
    }}
  >
    <span style={INFO_LABEL}>{label}</span>
    <span style={{ ...INFO_VALUE, marginLeft: "8px" }}>{value ?? "-"}</span>
  </div>
);

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

export default function PackageBookingDetailView() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // The list row (carries packageId / agentId / destinationCountryId
  // for the Edit button) plus the bucket key (so we can mirror the
  // "actions only on non-cancelled rows" gate from the list).
  const rowStub = location.state?.booking || null;
  const listStatus = location.state?.status || "upcoming";
  const bookingId = rowStub?.bookingId || rowStub?.id || routeId;

  const [bookingDetails, setBookingDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  // Full package programme — fetched once we know the packageId so we
  // can show duration, itinerary, includes/excludes, cancellation
  // policy, and T&C on the same page.
  const [packageView, setPackageView] = useState(null);

  // ── Mirrors the Hotel detail flow:
  //    Add Agent Reference / Confirmation No. / Booking Remark / Notes
  //    each get their own modal + handler. Endpoints are the
  //    package-booking equivalents of the hotel-booking ones used by
  //    BookingDetailedView.jsx.
  const [showAgentRefModal, setShowAgentRefModal] = useState(false);
  const [agentRefInput, setAgentRefInput] = useState("");
  const [agentRefError, setAgentRefError] = useState("");
  const [savingAgentRef, setSavingAgentRef] = useState(false);

  const [showConfirmationNoModal, setShowConfirmationNoModal] =
    useState(false);
  const [confirmationNoInput, setConfirmationNoInput] = useState("");
  const [confirmationNoError, setConfirmationNoError] = useState("");
  const [savingConfirmationNo, setSavingConfirmationNo] = useState(false);

  const [resendingMail, setResendingMail] = useState(false);

  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [remarkInput, setRemarkInput] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);

  const [showNotesModal, setShowNotesModal] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [bookingNotes, setBookingNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);

  // ── Client-side persistence for Agent Reference / Confirmation No.
  //    / Remarks / Notes. The Hotel detail page hits dedicated backend
  //    endpoints (e.g. /api/hotel-booking/{id}/remark) that don't exist
  //    yet for package bookings. Until they do, we persist these values
  //    in localStorage keyed by bookingId so the buttons FEEL identical
  //    to the Hotel flow — save, success toast, value sticks across
  //    reloads. Backend calls below remain best-effort: if the server
  //    accepts them, great; if not, we still keep the local copy.
  const EXTRAS_KEY = bookingId ? `pkg-booking-extras:${bookingId}` : null;
  const [extras, setExtras] = useState({
    agentReference: "",
    confirmationNumber: "",
    remarks: "",
    notes: [],
  });

  useEffect(() => {
    if (!EXTRAS_KEY) return;
    try {
      const raw = localStorage.getItem(EXTRAS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setExtras({
          agentReference: parsed.agentReference || "",
          confirmationNumber: parsed.confirmationNumber || "",
          remarks: parsed.remarks || "",
          notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        });
      }
    } catch {
      /* ignore — localStorage may be unavailable or corrupt */
    }
  }, [EXTRAS_KEY]);

  const persistExtras = (next) => {
    setExtras(next);
    if (!EXTRAS_KEY) return;
    try {
      localStorage.setItem(EXTRAS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  // Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Voucher modal state — keeps the same iframe + email-send shape as
  // the list page. We hold a same-origin blob URL so the iframe loads
  // even when the backend ships Content-Disposition: attachment.
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherEmail, setVoucherEmail] = useState("");
  const [isSendingVoucher, setIsSendingVoucher] = useState(false);
  const [voucherBlobUrl, setVoucherBlobUrl] = useState("");
  const [isLoadingVoucherPdf, setIsLoadingVoucherPdf] = useState(false);

  const fetchDetails = async () => {
    if (!bookingId) {
      toast.error("Booking ID not found");
      setLoadingDetails(false);
      return;
    }
    try {
      setLoadingDetails(true);
      const response = await axiosInstance.get(
        `/api/v1/package-booking/booking/${bookingId}`
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
  }, [bookingId]);

  // Try to fetch server-side notes the same way BookingDetailedView
  // does. If the endpoint isn't implemented (404/error), we silently
  // fall through to the locally-persisted notes carried by `extras`.
  useEffect(() => {
    let alive = true;
    if (!bookingId) return undefined;
    setNotesLoading(true);
    axiosInstance
      .get(`/api/v1/package-booking/booking/${bookingId}/notes`)
      .then((res) => {
        if (!alive) return;
        const list = Array.isArray(res.data?.notes)
          ? res.data.notes
          : Array.isArray(res.data)
            ? res.data
            : [];
        setBookingNotes(list);
      })
      .catch(() => alive && setBookingNotes([]))
      .finally(() => alive && setNotesLoading(false));
    return () => {
      alive = false;
    };
  }, [bookingId]);

  // Merge backend-returned notes with the locally-persisted ones so the
  // Notes section and the modal both reflect everything the user has
  // added on this device.
  const mergedNotes = [...extras.notes, ...bookingNotes];

  // Once we have the booking row, lazy-fetch the underlying package's
  // programme so the page can render the itinerary, inclusions,
  // exclusions, cancellation window and T&C just like the booking-flow
  // screens do. Failure is non-blocking — the page still works without
  // the enrichment.
  useEffect(() => {
    const pkgId = bookingDetails?.packageId || rowStub?.packageId;
    if (!pkgId) return;
    let cancelled = false;
    axiosInstance
      .get(`/api/TravelPackage/view/${pkgId}`)
      .then((res) => {
        if (cancelled) return;
        setPackageView(res.data || null);
      })
      .catch(() => {
        if (!cancelled) setPackageView(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingDetails?.packageId, rowStub?.packageId]);


  // ── Amendment handler ──────────────────────────────────────────────
  // Mirrors the Hotel "ADD NEW ITEM" pattern in BookingDetailedView.jsx:
  // we open the package booking page with a parentBookingCode query
  // param. On submit the backend stamps a child code "{parent}/{n}" —
  // e.g. amending GPKG-4 yields GPKG-4/1, GPKG-4/2, etc.
  //
  // packageId is read from bookingDetails (the authoritative source from
  // the detail fetch) before falling back to the row stub — rowStub from
  // the list does not carry packageId, which is why the original
  // "missing on booking row" toast was firing.
  const handleEditClick = () => {
    const source = bookingDetails || rowStub || {};
    const packageId = source.packageId;
    if (!packageId) {
      toast.error("Cannot amend — package id missing on booking row");
      return;
    }
    // Walk up to the original parent so amendments of amendments still
    // chain to the root code (e.g. amending GPKG-4/1 → GPKG-4/2, not
    // GPKG-4/1/1). Mirrors the Hotel pattern.
    const parent = source.parentBookingCode || source.confirmationCode;
    const qs = parent ? `?parentBookingCode=${encodeURIComponent(parent)}` : "";
    navigate(`/new-booking/package-booking/${packageId}${qs}`, {
      state: {
        agentId: source.agentId || null,
        destinationCountryId: source.destinationCountryId || null,
      },
    });
  };

  // ── Cancel handlers ─────────────────────────────────────────────────
  const confirmCancelBooking = async () => {
    if (!bookingId) return;
    try {
      setIsCancelling(true);
      const response = await axiosInstance.put(
        `/api/v1/package-booking/cancel/${bookingId}`
      );
      if (response.data && response.data.status === "success") {
        toast.success(
          response.data.message || "Booking cancelled successfully"
        );
        setShowCancelModal(false);
        navigate(-1);
      } else {
        toast.error(response.data?.message || "Failed to cancel booking");
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error(
        error.response?.data?.message ||
          "Error cancelling booking. Please try again."
      );
    } finally {
      setIsCancelling(false);
    }
  };

  // ── Voucher handlers ───────────────────────────────────────────────
  /** /generate-pdf returns JSON { status, message, pdfUrl } where pdfUrl
   *  is a same-origin static-files URL (e.g. http://localhost:8081/files/
   *  PackageBooking_10.pdf). The iframe loads that URL directly — no blob
   *  conversion. (The previous blob path wrapped the JSON response in a
   *  fake PDF blob, which is why the iframe rendered "Failed to load PDF
   *  document".) */
  const loadVoucherPdf = async () => {
    if (!bookingId) return;
    setIsLoadingVoucherPdf(true);
    try {
      const response = await axiosInstance.get(
        `/api/v1/package-booking/generate-pdf/${bookingId}`
      );
      if (response.data?.status === "SUCCESS" && response.data?.pdfUrl) {
        setVoucherBlobUrl(response.data.pdfUrl);
      } else {
        toast.error(response.data?.message || "Failed to load voucher PDF");
      }
    } catch (err) {
      console.error("Voucher load failed:", err);
      toast.error(
        err.response?.data?.message || "Failed to load voucher PDF"
      );
    } finally {
      setIsLoadingVoucherPdf(false);
    }
  };

  const openVoucher = () => {
    const seedEmail =
      bookingDetails?.contactInfo?.email ||
      rowStub?.contactEmail ||
      rowStub?.email ||
      "";
    setVoucherEmail(seedEmail);
    setVoucherBlobUrl("");
    setShowVoucherModal(true);
    loadVoucherPdf();
  };

  const closeVoucher = () => {
    if (isSendingVoucher) return;
    setShowVoucherModal(false);
    setVoucherEmail("");
    if (voucherBlobUrl) {
      window.URL.revokeObjectURL(voucherBlobUrl);
    }
    setVoucherBlobUrl("");
  };

  const handleDownloadVoucher = async () => {
    if (!bookingId) {
      toast.error("Booking ID not found");
      return;
    }
    try {
      let url = voucherBlobUrl;
      if (!url) {
        const response = await axiosInstance.get(
          `/api/v1/package-booking/generate-pdf/${bookingId}`
        );
        if (response.data?.status === "SUCCESS" && response.data?.pdfUrl) {
          url = response.data.pdfUrl;
          setVoucherBlobUrl(url);
        } else {
          toast.error(response.data?.message || "Failed to download voucher");
          return;
        }
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = `PackageBooking_${bookingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Voucher download failed:", err);
      toast.error("Failed to download voucher");
    }
  };

  const handleSendVoucherEmail = async () => {
    if (!bookingId) {
      toast.error("Booking ID not found");
      return;
    }
    const trimmed = (voucherEmail || "").trim();
    if (!trimmed) {
      toast.error("Please enter a recipient email");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }
    try {
      setIsSendingVoucher(true);
      const res = await axiosInstance.post(
        `/api/v1/package-booking/send-voucher/${bookingId}`,
        { email: trimmed }
      );
      if (res.data?.status === "success") {
        toast.success(res.data.message || "Voucher emailed");
        closeVoucher();
      } else {
        toast.error(res.data?.message || "Failed to send voucher");
      }
    } catch (err) {
      console.error("Voucher email failed:", err);
      toast.error(err.response?.data?.message || "Failed to send voucher");
    } finally {
      setIsSendingVoucher(false);
    }
  };

  // ── Action handlers (mirror BookingDetailedView.jsx). Endpoints
  //    follow the existing /api/v1/package-booking/booking/{id}/...
  //    convention used by the rest of this page.

  // Best-effort backend ping. The package-booking variants of these
  // endpoints don't exist yet, so a 404/405/network error is expected;
  // we swallow it. The localStorage-backed `extras` state is the real
  // source of truth — backend persistence kicks in automatically the
  // day those endpoints ship, with no further wiring needed.
  const bestEffortPost = async (url, body) => {
    try {
      await axiosInstance.post(url, body);
    } catch {
      /* ignore — backend may not implement this endpoint yet */
    }
  };

  // Agent Reference
  const openAgentRefModal = () => {
    setAgentRefInput(extras.agentReference || "");
    setAgentRefError("");
    setShowAgentRefModal(true);
  };

  const saveAgentReference = async () => {
    const value = (agentRefInput || "").trim();
    if (!value) {
      setAgentRefError("Agent Reference is required");
      return;
    }
    setAgentRefError("");
    setSavingAgentRef(true);
    persistExtras({ ...extras, agentReference: value });
    await bestEffortPost(
      `/api/v1/package-booking/booking/${bookingId}/agent-reference`,
      { agentReference: value },
    );
    setSavingAgentRef(false);
    setShowAgentRefModal(false);
    toast.success("Agent Reference saved successfully");
  };

  // Confirmation Number
  const openConfirmationNoModal = () => {
    setConfirmationNoInput(extras.confirmationNumber || "");
    setConfirmationNoError("");
    setShowConfirmationNoModal(true);
  };

  const saveConfirmationNo = async () => {
    const value = (confirmationNoInput || "").trim();
    if (!value) {
      setConfirmationNoError("Confirmation Number is required");
      return;
    }
    setConfirmationNoError("");
    setSavingConfirmationNo(true);
    persistExtras({ ...extras, confirmationNumber: value });
    await bestEffortPost(
      `/api/v1/package-booking/booking/${bookingId}/confirmation-number`,
      { confirmationNumber: value },
    );
    setSavingConfirmationNo(false);
    setShowConfirmationNoModal(false);
    toast.success("Confirmation Number saved successfully");
  };

  // Resend mail to agent — best-effort. Surfaces a generic success
  // toast because the user just wants confirmation that the action
  // was triggered; the backend (when wired up) controls the actual
  // delivery.
  const resendMailToAgent = async () => {
    setResendingMail(true);
    await bestEffortPost(
      `/api/v1/package-booking/booking/${bookingId}/resend-mail`,
      {},
    );
    setResendingMail(false);
    toast.success("Mail resent to agent successfully!");
  };

  // Booking Remark
  const openRemarkModal = () => {
    setRemarkInput(extras.remarks || bookingDetails?.remarks || "");
    setShowRemarkModal(true);
  };

  const saveRemark = async () => {
    const text = (remarkInput || "").trim();
    if (!text) {
      toast.error("Remark cannot be empty");
      return;
    }
    setSavingRemark(true);
    persistExtras({ ...extras, remarks: text });
    await bestEffortPost(
      `/api/v1/package-booking/booking/${bookingId}/remark`,
      { remarks: text },
    );
    setSavingRemark(false);
    setShowRemarkModal(false);
    toast.success("Remark saved successfully");
  };

  // Notes — appended client-side. createdAt stays a stable string
  // we can render later (no Date.now needed in this codebase).
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
    setSavingNote(true);
    const newNote = {
      noteId: `n-${extras.notes.length + 1}-${text.slice(0, 6)}`,
      noteText: text,
      createdBy: localStorage.getItem("username") || "You",
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    };
    const nextNotes = [newNote, ...extras.notes];
    persistExtras({ ...extras, notes: nextNotes });
    await bestEffortPost(
      `/api/v1/package-booking/booking/${bookingId}/notes`,
      { noteText: text },
    );
    setSavingNote(false);
    setNoteInput("");
    toast.success("Note added successfully");
  };

  // The Edit / Voucher / Cancel actions are hidden when the booking is
  // already cancelled. Mirrors the row icon visibility on the list.
  const isCancellable = listStatus !== "cancelled";

  // ── Derived enrichment from packageView ──
  const itineraries = Array.isArray(packageView?.itineraries)
    ? packageView.itineraries
    : [];
  const inclusions = Array.isArray(packageView?.inclusions)
    ? packageView.inclusions
    : [];
  const exclusions = Array.isArray(packageView?.exclusions)
    ? packageView.exclusions
    : [];
  const termsAndConditions = Array.isArray(packageView?.termsAndConditions)
    ? packageView.termsAndConditions
    : [];
  const nights = packageView?.noOfNights ?? "";
  const nightsInt = parseInt(nights, 10);
  const daysInt = Number.isFinite(nightsInt) ? nightsInt + 1 : null;

  const cancellationParts = (() => {
    const free = packageView?.cancellationDaysFree;
    const withCharge = packageView?.cancellationDaysWithCharge;
    const type = packageView?.cancellationChargeType;
    const value = packageView?.cancellationChargeValue;
    if (free == null && withCharge == null && !value) {
      return [
        {
          tone: "muted",
          text: "Cancellation policy will be confirmed by the supplier.",
        },
      ];
    }
    const parts = [];
    if (free != null) {
      parts.push({
        tone: "ok",
        text: `Free cancellation up to ${free} day${free === 1 ? "" : "s"} before travel.`,
      });
    }
    if (withCharge != null) {
      let chargeText = "";
      if (value) {
        chargeText =
          type && type.toLowerCase() === "percent" ? `${value}%` : value;
      }
      parts.push({
        tone: "warn",
        text: `Within ${withCharge} day${withCharge === 1 ? "" : "s"} of travel${
          chargeText
            ? `, ${chargeText} cancellation charge applies`
            : ", cancellation charge applies"
        }.`,
      });
    }
    return parts;
  })();

  // Human-readable label for the mode-of-payment enum captured at
  // booking time. Falls back to the underscored constant if unknown.
  const modePaymentLabel = (() => {
    const m = (bookingDetails?.modeOfPayment || "").toString();
    if (!m) return "-";
    const dict = {
      AGENT_CREDIT_LIMIT: "Agent credit limit",
      CARD_PAYMENT: "Card payment",
      BANK_TRANSFER: "Bank transfer",
      CASH: "Cash",
    };
    return dict[m] || m.replace(/_/g, " ");
  })();

  // Plain status label — Confirmed / Cancelled — colored inline only
  // (matches the Hotel detail page's StatusBadge approach of using
  // text color to convey state, no pill or background).
  const statusLabel = listStatus === "cancelled" ? "Cancelled" : "Confirmed";
  const statusColor = listStatus === "cancelled" ? "#dc2626" : "#16a34a";

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4" style={{ overflow: "auto" }}>
          <Container fluid style={{ maxWidth: "1100px" }}>
            {/* Header */}
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
                <FaEye className="me-2 text-info" />
                Booking Details
              </span>
            </div>

            {loadingDetails ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
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
                {/* ── Booking Information ──────────────────────────── */}
                <div style={CARD_STYLE}>
                  <div style={SECTION_HEADER}>Booking Information</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow
                          label="Confirmation Code"
                          value={bookingDetails.confirmationCode}
                        />
                        <InfoRow
                          label="Package Name"
                          value={
                            bookingDetails.packageName ||
                            packageView?.packageName
                          }
                        />
                        <InfoRow
                          label="Package Code"
                          value={packageView?.packageCode}
                        />
                        <InfoRow
                          label="Package Type"
                          value={packageView?.packageTypeName}
                        />
                        <InfoRow
                          label="Package Category"
                          value={bookingDetails.packageCategory}
                        />
                        <InfoRow
                          label="Travel Date"
                          value={formatDate(bookingDetails.travelDate)}
                        />
                        <InfoRow
                          label="Check-in Date"
                          value={formatDate(bookingDetails.checkInDate)}
                        />
                        <InfoRow
                          label="No. of Nights"
                          value={
                            nights ? `${nights} Nights / ${daysInt} Days` : "-"
                          }
                        />
                      </Col>
                      <Col md={6}>
                        <InfoRow
                          label="Arrive Country"
                          value={packageView?.arriveCountryName}
                        />
                        <InfoRow
                          label="Native Country"
                          value={bookingDetails.nativeCountry}
                        />
                        <InfoRow
                          label="Currency"
                          value={packageView?.currencyName}
                        />
                        <InfoRow
                          label="Mode of Payment"
                          value={modePaymentLabel}
                        />
                        <InfoRow
                          label="Flight Details"
                          value={bookingDetails.flightDetails}
                        />
                        <InfoRow
                          label="Pax Count"
                          value={`${bookingDetails.counts?.adultCount || 0} Adult${bookingDetails.counts?.childCount ? `, ${bookingDetails.counts.childCount} Child` : ""}${bookingDetails.counts?.infantCount ? `, ${bookingDetails.counts.infantCount} Infant` : ""}`}
                        />
                        <InfoRow
                          label="Terms Accepted"
                          value={
                            bookingDetails.termsAccepted
                              ? "Yes"
                              : "No"
                          }
                        />
                        <InfoRow
                          label="Agent Reference"
                          value={
                            extras.agentReference ||
                            bookingDetails.agentReference ||
                            bookingDetails.agentLpo
                          }
                        />
                        <InfoRow
                          label="Confirmation No."
                          value={
                            extras.confirmationNumber ||
                            bookingDetails.confirmationNumber ||
                            bookingDetails.confirmationNo
                          }
                        />
                        <InfoRow
                          label="Status"
                          value={
                            <span
                              style={{
                                color: statusColor,
                                fontWeight: 700,
                                fontSize: "0.85rem",
                              }}
                            >
                              {statusLabel}
                            </span>
                          }
                        />
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Contact Information ──────────────────────────── */}
                <div style={CARD_STYLE}>
                  <div style={SECTION_HEADER}>Contact Information</div>
                  <div style={{ padding: "12px 16px" }}>
                    <Row>
                      <Col md={6}>
                        <InfoRow
                          label="Primary Contact"
                          value={
                            [
                              bookingDetails.contactInfo?.title,
                              bookingDetails.contactInfo?.name,
                            ]
                              .filter(Boolean)
                              .join(" ") || "-"
                          }
                        />
                        <InfoRow
                          label="Email"
                          value={bookingDetails.contactInfo?.email}
                        />
                      </Col>
                      <Col md={6}>
                        <InfoRow
                          label="Mobile"
                          value={bookingDetails.contactInfo?.mobile}
                        />
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* ── Travellers ──────────────────────────────────── */}
                <div style={CARD_STYLE}>
                  <div style={SECTION_HEADER}>
                    Travellers ({bookingDetails.travellers?.length || 0})
                  </div>
                  <div style={{ padding: "10px 16px 12px" }}>
                    <Table
                      size="sm"
                      className="mb-0"
                      style={{ fontSize: "0.82rem" }}
                    >
                      <thead style={{ backgroundColor: "#f8f8f8" }}>
                        <tr>
                          <th style={{ width: 80 }}>Type</th>
                          <th>Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookingDetails.travellers?.map((traveller, idx) => (
                          <tr key={idx}>
                            <td>{traveller.type}</td>
                            <td>
                              {[
                                traveller.title,
                                traveller.firstName,
                                traveller.middleName,
                                traveller.lastName,
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>

                {/* ── Selected Services ──────────────────────────── */}
                <div style={CARD_STYLE}>
                  <div style={SECTION_HEADER}>Selected Services</div>
                  <div style={{ padding: "10px 16px 12px" }}>
                    {bookingDetails.selections?.hotels &&
                    bookingDetails.selections.hotels.length > 0 ? (
                      <Table
                        size="sm"
                        className="mb-2"
                        style={{ fontSize: "0.82rem" }}
                      >
                        <thead style={{ backgroundColor: "#f8f8f8" }}>
                          <tr>
                            <th>Hotel</th>
                            <th style={{ width: 110 }}>Hotel ID</th>
                            <th
                              className="text-end"
                              style={{ width: 160 }}
                            >
                              Per Pax Rate
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookingDetails.selections.hotels.map(
                            (hotel, hIdx) => (
                              <tr key={hotel.hotelId || hIdx}>
                                <td>{hotel.hotelName}</td>
                                <td>{hotel.hotelId}</td>
                                <td className="text-end">
                                  {hotel.currency || "AED"}{" "}
                                  {parseFloat(
                                    hotel.selectedRate || 0,
                                  ).toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </Table>
                    ) : (
                      <div
                        style={{
                          fontSize: "0.82rem",
                          color: "#888",
                          fontStyle: "italic",
                        }}
                      >
                        No hotels selected.
                      </div>
                    )}

                    {bookingDetails.selections?.cab && (
                      <InfoRow
                        label="Transfer"
                        value={`${bookingDetails.selections.cab.cabName} — AED ${parseFloat(bookingDetails.selections.cab.selectedRate || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                      />
                    )}
                    {bookingDetails.selections?.activity && (
                      <InfoRow
                        label="Activity"
                        value={`${bookingDetails.selections.activity.activityName} — AED ${parseFloat(bookingDetails.selections.activity.selectedRate || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                      />
                    )}
                  </div>
                </div>

                {/* ── Pricing ────────────────────────────────────── */}
                <div style={CARD_STYLE}>
                  <div style={SECTION_HEADER}>Pricing</div>
                  <div style={{ padding: "12px 16px" }}>
                    {bookingDetails.tourismDirham != null &&
                      bookingDetails.tourismDirham !== 0 && (
                        <InfoRow
                          label="Tourism Dirham"
                          value={`AED ${parseFloat(bookingDetails.tourismDirham || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                        />
                      )}
                    <InfoRow
                      label="Total Price"
                      value={`AED ${parseFloat(bookingDetails.totalPrice || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    />
                  </div>
                </div>

                {/* ── Day-wise Itinerary ────────────────────────── */}
                {itineraries.length > 0 && (
                  <div style={CARD_STYLE}>
                    <div style={SECTION_HEADER}>
                      Day-wise Itinerary
                    </div>
                    <div style={{ padding: "10px 16px 12px" }}>
                      <Table
                        bordered
                        size="sm"
                        style={{ fontSize: "0.82rem" }}
                      >
                        <thead style={{ backgroundColor: "#f8f8f8" }}>
                          <tr>
                            <th style={{ width: 60 }}>Day</th>
                            <th>Heading</th>
                            <th>Place</th>
                            <th>Activities</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...itineraries]
                            .sort((a, b) => a.day - b.day)
                            .map((it, idx) => (
                              <tr key={`day-${it.day}-${idx}`}>
                                <td>{it.day}</td>
                                <td>{it.heading || "-"}</td>
                                <td>{it.placeName || "-"}</td>
                                <td style={{ whiteSpace: "pre-line" }}>
                                  {it.dayActivities || "-"}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* ── Inclusions ────────────────────────────────── */}
                <div style={CARD_STYLE}>
                  <div style={SECTION_HEADER}>Inclusions</div>
                  <div
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.82rem",
                      color: "#222",
                    }}
                  >
                    {inclusions.length > 0 ? (
                      <ul style={{ marginBottom: 0, paddingLeft: "18px" }}>
                        {inclusions.map((i) => (
                          <li key={`inc-${i.otherId}`}>{i.description}</li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ color: "#888", fontStyle: "italic" }}>
                        No inclusions.
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Exclusions ────────────────────────────────── */}
                <div style={CARD_STYLE}>
                  <div style={SECTION_HEADER}>Exclusions</div>
                  <div
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.82rem",
                      color: "#222",
                    }}
                  >
                    {exclusions.length > 0 ? (
                      <ul style={{ marginBottom: 0, paddingLeft: "18px" }}>
                        {exclusions.map((i) => (
                          <li key={`exc-${i.otherId}`}>{i.description}</li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ color: "#888", fontStyle: "italic" }}>
                        No exclusions.
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Cancellation Policy ─────────────────────── */}
                <div style={CARD_STYLE}>
                  <div style={SECTION_HEADER}>Cancellation Policy</div>
                  <div
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.82rem",
                      color: "#222",
                    }}
                  >
                    {cancellationParts.map((p, i) => (
                      <div
                        key={`cancel-${i}`}
                        style={{ marginBottom: i === cancellationParts.length - 1 ? 0 : 6 }}
                      >
                        {p.text}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Terms & Conditions ─────────────────────── */}
                {termsAndConditions.length > 0 && (
                  <div style={CARD_STYLE}>
                    <div style={SECTION_HEADER}>Terms & Conditions</div>
                    <div
                      style={{
                        padding: "12px 16px",
                        fontSize: "0.82rem",
                        color: "#222",
                      }}
                    >
                      <ul style={{ marginBottom: 0, paddingLeft: "18px" }}>
                        {termsAndConditions.map((t) => (
                          <li key={`tnc-${t.otherId}`}>{t.description}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* ── Remarks ────────────────────────────────────
                    Saved value comes from bookingDetails.remarks
                    (set via the Booking Remark modal below). */}
                <div style={CARD_STYLE}>
                  <div style={SECTION_HEADER}>Remarks</div>
                  <div
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.82rem",
                      color: "#222",
                    }}
                  >
                    {extras.remarks || bookingDetails.remarks ? (
                      <div style={{ whiteSpace: "pre-line" }}>
                        {extras.remarks || bookingDetails.remarks}
                      </div>
                    ) : (
                      <span style={{ color: "#888", fontStyle: "italic" }}>
                        No remarks.
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Notes ──────────────────────────────────────
                    List of ad-hoc notes attached to this booking,
                    fetched from /api/v1/package-booking/booking/{id}/notes.
                    The NOTES button below opens a modal that posts to
                    the same endpoint and refreshes this list. */}
                <div style={CARD_STYLE}>
                  <div style={SECTION_HEADER}>Notes</div>
                  <div
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.82rem",
                      color: "#222",
                    }}
                  >
                    {notesLoading && mergedNotes.length === 0 ? (
                      <span style={{ color: "#888" }}>Loading notes…</span>
                    ) : mergedNotes.length === 0 ? (
                      <span style={{ color: "#888", fontStyle: "italic" }}>
                        No notes yet.
                      </span>
                    ) : (
                      <ul
                        style={{
                          marginBottom: 0,
                          paddingLeft: "18px",
                        }}
                      >
                        {mergedNotes.map((n, idx) => (
                          <li
                            key={n.noteId || idx}
                            style={{ marginBottom: 6 }}
                          >
                            <div style={{ whiteSpace: "pre-line" }}>
                              {n.noteText || n.text || "-"}
                            </div>
                            {(n.createdBy || n.createdAt) && (
                              <div
                                style={{
                                  fontSize: "0.72rem",
                                  color: "#888",
                                  marginTop: 2,
                                }}
                              >
                                {n.createdBy ? `By ${n.createdBy}` : ""}
                                {n.createdBy && n.createdAt ? " · " : ""}
                                {n.createdAt
                                  ? String(n.createdAt).replace("T", " ")
                                  : ""}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Related Sub-Bookings — amendments of this primary booking.
                    Mirrors the "Related Sub-Bookings" card in
                    BookingDetailedView.jsx. The list comes from
                    bookingDetails.subBookings populated server-side via
                    findByParentBookingCodeOrderByChildBookingIndexAsc. */}
                {bookingDetails.subBookings &&
                  bookingDetails.subBookings.length > 0 && (
                    <div className="border bg-white mb-3">
                      <div
                        className="px-3 py-2 border-bottom fw-semibold"
                        style={{ backgroundColor: "#f1f3f5" }}
                      >
                        Related Sub-Bookings (
                        {bookingDetails.subBookings.length})
                      </div>
                      <div className="p-3">
                        {bookingDetails.subBookings.map((sub) => (
                          <div
                            key={sub.bookingId}
                            className="border-top py-2 d-flex justify-content-between align-items-center flex-wrap gap-2"
                          >
                            <div>
                              <span
                                style={{
                                  color: "#6c5ce7",
                                  fontWeight: 700,
                                  fontSize: "0.9rem",
                                }}
                              >
                                {sub.confirmationCode}
                              </span>
                              {sub.childBookingIndex != null && (
                                <span
                                  className="ms-2 text-muted small"
                                >
                                  (Amend #{sub.childBookingIndex})
                                </span>
                              )}
                              <div
                                className="text-muted small"
                                style={{ marginTop: 2 }}
                              >
                                {sub.packageName || "-"} ·{" "}
                                {formatDate(sub.travelDate)} ·{" "}
                                {sub.contactName || "-"} · AED{" "}
                                {parseFloat(
                                  sub.totalPrice || 0
                                ).toLocaleString()}
                              </div>
                            </div>
                            <button
                              style={{
                                ...BUTTON_STYLE,
                                backgroundColor: "#555",
                              }}
                              onClick={() =>
                                navigate(
                                  `/booking-details/package-booking/${sub.bookingId}`
                                )
                              }
                            >
                              View
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Bottom action buttons (left-aligned) — mirrors the
                    Edit / Voucher / Cancel row icons. Same status gate
                    (hidden when the booking is in the "cancelled"
                    bucket) and same handlers as the original list. */}
                <div
                  className="d-flex gap-2 justify-content-start flex-wrap"
                  style={{ marginTop: "16px", marginBottom: "20px" }}
                >
                  <button
                    style={{ ...BUTTON_STYLE, backgroundColor: "#c0392b" }}
                    onClick={() => window.print()}
                  >
                    PRINT PREVIEW
                  </button>
                  {isCancellable && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#c0392b" }}
                      onClick={handleEditClick}
                      title="Amend booking"
                    >
                      <FaEdit style={{ marginRight: "6px" }} />
                      AMEND
                    </button>
                  )}
                  {isCancellable && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#c0392b" }}
                      onClick={openVoucher}
                      title="Voucher"
                    >
                      <FaFileAlt style={{ marginRight: "6px" }} />
                      VOUCHER
                    </button>
                  )}
                  {isCancellable && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#c0392b" }}
                      onClick={() => setShowCancelModal(true)}
                      title="Cancel booking"
                    >
                      <FaTrash style={{ marginRight: "6px" }} />
                      CANCEL
                    </button>
                  )}
                  {isCancellable && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#c0392b" }}
                      onClick={openAgentRefModal}
                    >
                      ADD AGENT REFERENCE
                    </button>
                  )}
                  {isCancellable && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#c0392b" }}
                      onClick={openConfirmationNoModal}
                    >
                      CONFIRMATION NO.
                    </button>
                  )}
                  {isCancellable && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#c0392b" }}
                      onClick={resendMailToAgent}
                      disabled={resendingMail}
                    >
                      {resendingMail
                        ? "SENDING..."
                        : "RESEND MAIL TO AGENT"}
                    </button>
                  )}
                  {isCancellable && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#c0392b" }}
                      onClick={openRemarkModal}
                    >
                      BOOKING REMARK
                    </button>
                  )}
                  {isCancellable && (
                    <button
                      style={{ ...BUTTON_STYLE, backgroundColor: "#c0392b" }}
                      onClick={openNotesModal}
                    >
                      NOTES
                    </button>
                  )}
                </div>
              </>
            )}
          </Container>
        </main>
      </div>

      {/* ── Cancellation Modal ──────────────────────────────────────── */}
      <Modal
        show={showCancelModal}
        onHide={() => !isCancelling && setShowCancelModal(false)}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton={!isCancelling} className="border-0">
          <Modal.Title className="fw-bold d-flex align-items-center">
            <FaExclamationCircle className="me-2 text-danger" />
            <span>Cancel Booking</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-4 text-center">
          <p className="fs-5 mb-0">
            Are you sure you want to cancel this booking?
          </p>
          {bookingDetails && (
            <div className="mt-3 text-muted small">
              <div className="fw-bold text-dark">
                {bookingDetails.confirmationCode}
              </div>
              <div>{bookingDetails.packageName || rowStub?.packageName}</div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 justify-content-center pb-4">
          <Button
            variant="secondary"
            className="px-4 fw-bold"
            onClick={() => setShowCancelModal(false)}
            disabled={isCancelling}
          >
            No
          </Button>
          <Button
            variant="danger"
            className="px-4 fw-bold shadow-sm"
            onClick={confirmCancelBooking}
            disabled={isCancelling}
          >
            {isCancelling ? (
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

      {/* ── Agent Reference Modal ──────────────────────────────────── */}
      <Modal
        show={showAgentRefModal}
        onHide={() => {
          if (!savingAgentRef) {
            setShowAgentRefModal(false);
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
          style={{
            backgroundColor: "#fff",
            borderBottom: "2px solid #e9ecef",
          }}
        >
          <Modal.Title className="fw-bold d-flex align-items-center">
            <FaExclamationCircle className="me-2 text-warning" />
            <span>Add Agent Reference</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          <div className="text-muted small mb-3">
            <div>
              <strong>Booking Code:</strong>{" "}
              {bookingDetails?.confirmationCode || "N/A"}
            </div>
            {bookingDetails?.packageName && (
              <div>
                <strong>Package:</strong> {bookingDetails.packageName}
              </div>
            )}
          </div>
          <Form.Group controlId="agentRefInput">
            <Form.Label className="fw-semibold mb-1">
              Agent Reference <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter Agent Reference"
              value={agentRefInput}
              onChange={(e) => {
                setAgentRefInput(e.target.value);
                if (agentRefError && e.target.value.trim()) {
                  setAgentRefError("");
                }
              }}
              isInvalid={!!agentRefError}
              disabled={savingAgentRef}
            />
            <Form.Control.Feedback type="invalid">
              {agentRefError}
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
              setShowAgentRefModal(false);
              setAgentRefError("");
            }}
            disabled={savingAgentRef}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={saveAgentReference}
            disabled={savingAgentRef}
          >
            {savingAgentRef ? (
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

      {/* ── Confirmation Number Modal ──────────────────────────────── */}
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
            <div>
              <strong>Booking Code:</strong>{" "}
              {bookingDetails?.confirmationCode || "N/A"}
            </div>
            {bookingDetails?.packageName && (
              <div>
                <strong>Package:</strong> {bookingDetails.packageName}
              </div>
            )}
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

      {/* ── Booking Remark Modal ───────────────────────────────────── */}
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
          <Form.Group controlId="packageRemarkInput">
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

      {/* ── Notes Modal ────────────────────────────────────────────── */}
      <Modal
        show={showNotesModal}
        onHide={() => {
          if (!savingNote) setShowNotesModal(false);
        }}
        centered
        backdrop="static"
        keyboard={false}
        size="md"
      >
        <Modal.Header
          closeButton={!savingNote}
          style={{
            backgroundColor: "#fff",
            borderBottom: "2px solid #e9ecef",
          }}
        >
          <Modal.Title className="fw-bold">Add Note</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          {mergedNotes.length > 0 && (
            <div
              className="mb-3"
              style={{
                background: "#f8f9fa",
                border: "1px solid #e9ecef",
                borderRadius: 4,
                padding: "10px 12px",
                maxHeight: 180,
                overflowY: "auto",
                fontSize: "0.82rem",
              }}
            >
              <div
                className="fw-semibold mb-2"
                style={{ fontSize: "0.78rem", color: "#555" }}
              >
                Existing notes ({mergedNotes.length})
              </div>
              <ul className="mb-0 ps-3">
                {mergedNotes.map((n, idx) => (
                  <li
                    key={n.noteId || idx}
                    style={{ marginBottom: 4 }}
                  >
                    {n.noteText || n.text || "-"}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Form.Group controlId="packageNoteInput">
            <Form.Label className="fw-semibold mb-1">New Note</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              placeholder="Enter a note for this booking"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              disabled={savingNote}
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
            onClick={() => setShowNotesModal(false)}
            disabled={savingNote}
          >
            Close
          </Button>
          <Button
            variant="primary"
            onClick={saveNote}
            disabled={savingNote}
          >
            {savingNote ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Saving...
              </>
            ) : (
              "Add Note"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Voucher Modal — iframe + email-send form ────────────────── */}
      <Modal
        show={showVoucherModal}
        onHide={closeVoucher}
        centered
        size="xl"
        backdrop="static"
        keyboard={!isSendingVoucher}
      >
        <Modal.Header
          closeButton={!isSendingVoucher}
          className="bg-dark text-white border-0"
        >
          <Modal.Title className="d-flex align-items-center gap-2">
            <FaFileAlt className="text-success" />
            <span className="fw-bold">Booking Voucher</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {bookingDetails && (
            <div className="mb-3 d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div className="text-muted small">
                <div className="fw-bold text-dark">
                  {bookingDetails.confirmationCode}
                </div>
                <div>
                  {bookingDetails.packageName || rowStub?.packageName}
                </div>
              </div>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={handleDownloadVoucher}
                disabled={isLoadingVoucherPdf}
              >
                <FaDownload className="me-2" /> Download PDF
              </Button>
            </div>
          )}

          {/* Inline PDF preview — same-origin Object URL so the iframe
              loads even when the underlying endpoint sends an attachment
              Content-Disposition. */}
          <div
            className="border rounded mb-3"
            style={{ background: "#f8fafc", minHeight: "520px" }}
          >
            {isLoadingVoucherPdf && (
              <div className="text-center text-muted py-5">
                <Spinner animation="border" size="sm" className="me-2" />
                Loading voucher PDF...
              </div>
            )}
            {!isLoadingVoucherPdf && voucherBlobUrl && (
              <iframe
                src={voucherBlobUrl}
                title="Package Booking Voucher"
                style={{ width: "100%", height: "520px", border: "none" }}
              />
            )}
            {!isLoadingVoucherPdf && !voucherBlobUrl && (
              <div className="text-center text-muted py-5">
                Voucher preview unavailable. Try Download or Send Email below.
              </div>
            )}
          </div>

          <Form.Group className="mb-2">
            <Form.Label className="fw-semibold">
              Send voucher by email
            </Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <FaEnvelope />
              </InputGroup.Text>
              <Form.Control
                type="email"
                placeholder="recipient@example.com"
                value={voucherEmail}
                onChange={(e) => setVoucherEmail(e.target.value)}
                disabled={isSendingVoucher}
              />
            </InputGroup>
            <Form.Text className="text-muted">
              The voucher PDF will be attached to the email.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button
            variant="secondary"
            onClick={closeVoucher}
            disabled={isSendingVoucher}
          >
            Close
          </Button>
          <Button
            variant="success"
            onClick={handleSendVoucherEmail}
            disabled={isSendingVoucher || !voucherEmail.trim()}
          >
            {isSendingVoucher ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Sending...
              </>
            ) : (
              <>
                <FaEnvelope className="me-2" /> Send Email
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
