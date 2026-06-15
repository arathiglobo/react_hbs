/**
 * StudentBookingPage.jsx
 *
 * Booking page for the student flow. Layout mirrors
 * /hotel-booking-page (HotelBookingPage.jsx) — same Booking Summary
 * card at top, per-room guest accordion, primary guest section,
 * remarks + special requests block, Confirm Booking button +
 * confirmation modal.
 *
 * Extra Student Verification block (above guest details):
 *   - Student ID Card Upload (required, jpg/png/pdf)
 *     → POST /api/student-id-upload
 *   - Institution Name (required)
 *   - Student ID Number (required)
 *   - Expiry / Validity Date (required, must be ≥ check-in date)
 *   - Optional Institutional Email (Method 3) + simulated OTP verify
 *
 * After successful submit the booking lands in
 * PENDING_STUDENT_VERIFICATION until an admin Approves/Rejects on
 * the Student Verification screen.
 *
 * Endpoint: POST /api/student-booking/create
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHotel, FaCalendarAlt, FaUsers, FaUtensils,
  FaGraduationCap, FaFileUpload, FaEnvelope, FaCheckCircle, FaArrowLeft,
} from "react-icons/fa";
import {
  Row, Col, Card, Form, Button, Accordion, Badge,
  Modal, Spinner, Alert,
} from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import toast from "react-hot-toast";
import "../../../styles/HotelBookingPage.css";

const SPECIAL_REQUEST_OPTIONS = [
  "Early Check-In", "Non-Smoking Rooms", "High Floor", "VIP Client",
  "Late Check-In", "Inter-connecting rooms", "Low Floor",
  "Room with Bathtub", "Late check-Out", "Smoking Room",
];

// Verification-method enum values (mirror the backend column).
const METHOD_UPLOAD = "STUDENT_ID_UPLOAD";
const METHOD_MANUAL = "MANUAL_ADMIN_APPROVAL";
const METHOD_EMAIL  = "INSTITUTIONAL_EMAIL";

// Compact date label used by the right-column Booking Summary —
// mirrors the helper /gov-employee-booking-page uses so the two
// dedicated-flow booking pages render dates identically.
const formatDateTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

export default function StudentBookingPage() {
  const navigate = useNavigate();
  const activeUserRole = localStorage.getItem("currentActiveRole");

  const [bookingData, setBookingData] = useState(null);
  const [agentAvailableBalance, setAgentAvailableBalance] = useState(null);

  // Rooms (guest details per adult/child)
  const [rooms, setRooms] = useState([]);

  // ── Lead passenger marker — { roomIdx, guestIdx } pointing at the
  //    single guest the user has flagged as Lead. Mirrors the
  //    gov-employee booking page UX. Defaults to the very first guest
  //    (room 0, guest 0) so the column always has one selection on
  //    first render. Children can't be Lead. Each guest's `isLead`
  //    flag is added to the submitted `rooms[].guests` payload — the
  //    backend ignores unknown fields, so single-room / legacy flows
  //    are unaffected.
  const [leadIndex, setLeadIndex] = useState({ roomIdx: 0, guestIdx: 0 });

  const handleLeadSelect = (roomIdx, guestIdx) => {
    // Skip selection if the target is a child — the radio is already
    // disabled in the UI, this is a defensive guard.
    const g = rooms?.[roomIdx]?.guests?.[guestIdx];
    if (g?.isChild) return;
    setLeadIndex({ roomIdx, guestIdx });
  };

  // Primary guest
  const [primaryGuest, setPrimaryGuest] = useState({
    salutation: "", firstName: "", middleName: "", lastName: "",
    email: "", phone: "", passportNo: "", agentLpo: "",
  });

  const [remarks, setRemarks] = useState("");
  const [specialRequests, setSpecialRequests] = useState([]);
  // "Booking Done By Employee" was moved to StudentSearch — the chosen
  // employeeId arrives on bookingData.payload.employeeId.

  // ── Student verification state ─────────────────────────────────
  // Default to Method 1 (Student ID Upload) — Primary Method.
  const [verificationMethod, setVerificationMethod] = useState(METHOD_UPLOAD);
  const [studentName, setStudentName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [studentIdNumber, setStudentIdNumber] = useState("");
  const [studentIdExpiry, setStudentIdExpiry] = useState("");
  const [idFile, setIdFile] = useState(null);
  const [uploadedFilePath, setUploadedFilePath] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploading, setUploading] = useState(false);

  // ── Method 3 — optional institutional email + OTP ──────────────
  const [institutionalEmail, setInstitutionalEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);

  // ── Submission state ───────────────────────────────────────────
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("studentBookingData");
    if (!stored) return;
    const parsed = JSON.parse(stored);
    setBookingData(parsed);
    const payloadRooms = parsed?.payload?.rooms || [];
    setRooms(payloadRooms.map((room) => ({
      ...room,
      guests: Array.from(
        { length: (room.adults || 0) + (room.children || 0) },
        (_, i) => ({
          salutation: "", firstName: "", middleName: "", lastName: "",
          gender: "", isChild: i >= (room.adults || 0),
        })
      ),
    })));
  }, []);

  // Employee fetch removed — "Booking Done By Employee" is selected in
  // StudentSearch and arrives on bookingData.payload.employeeId.

  useEffect(() => {
    const aId = bookingData?.payload?.agentId;
    if (!aId) { setAgentAvailableBalance(null); return; }
    let cancelled = false;
    axiosInstance.get(`/api/agent-credit-limit/agent/${aId}`)
      .then((res) => { if (!cancelled) setAgentAvailableBalance(res?.data?.availableCreditLimit ?? null); })
      .catch(() => { if (!cancelled) setAgentAvailableBalance(null); });
    return () => { cancelled = true; };
  }, [bookingData]);

  // ── Handlers ───────────────────────────────────────────────────
  const handleGuestChange = (ri, gi, field, value) => {
    setRooms((prev) => {
      const next = [...prev];
      next[ri].guests[gi][field] = value;
      return next;
    });
    if (ri === 0 && gi === 0 && ["salutation", "firstName", "lastName"].includes(field)) {
      setPrimaryGuest((p) => ({ ...p, [field]: value }));
    }
  };
  const handlePrimaryGuestChange = (field, value) => {
    setPrimaryGuest((p) => ({ ...p, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((e) => { const n = { ...e }; delete n[field]; return n; });
    }
  };
  const toggleSpecialRequest = (req) => {
    setSpecialRequests((prev) =>
      prev.includes(req) ? prev.filter((r) => r !== req) : [...prev, req]
    );
  };

  // ── Student ID upload ──────────────────────────────────────────
  const onFileChange = (e) => {
    setIdFile(e.target.files?.[0] || null);
    setUploadedFilePath("");
    setUploadedFileName("");
  };
  const handleUpload = async () => {
    if (!idFile) { toast.error("Please choose a file first"); return; }
    // Quick client-side size guard (5 MB) so we don't waste a round-trip
    if (idFile.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5 MB)");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", idFile);
      const { data } = await axiosInstance.post("/api/student-id-upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data?.success) {
        setUploadedFilePath(data.filePath);
        setUploadedFileName(data.fileName);
        toast.success("Student ID uploaded");
      } else {
        toast.error(data?.message || "Upload failed");
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Upload failed");
    } finally { setUploading(false); }
  };

  // ── Method 3 — simulated institutional email OTP ───────────────
  // (No real mail server is wired up — this is a UI-only stub that
  // accepts any 6-digit code so the team can demo the flow.)
  const handleSendOtp = () => {
    if (!institutionalEmail.trim() || !/.+@.+\..+/.test(institutionalEmail)) {
      toast.error("Enter a valid institutional email");
      return;
    }
    setOtpSent(true);
    toast.success("OTP sent (demo: enter any 6-digit code)");
  };
  const handleVerifyOtp = () => {
    if ((otpInput || "").length === 6) {
      setEmailVerified(true);
      toast.success("Email verified");
    } else {
      toast.error("OTP must be 6 digits");
    }
  };

  // ── Validation specific to the student step ────────────────────
  // Common fields the admin always needs to see (institution + ID
  // number + expiry); the file / email requirement is method-specific.
  const isCommonStudentInfoReady = () =>
    institutionName.trim().length > 0 &&
    studentIdNumber.trim().length > 0 &&
    !!studentIdExpiry &&
    !isExpiryBeforeCheckIn();

  const isStudentInfoReady = () => {
    if (!isCommonStudentInfoReady()) return false;
    if (verificationMethod === METHOD_UPLOAD) return !!uploadedFilePath;
    if (verificationMethod === METHOD_MANUAL) return true;       // admin verifies offline
    if (verificationMethod === METHOD_EMAIL)  return emailVerified;
    return false;
  };

  const isExpiryBeforeCheckIn = () => {
    if (!studentIdExpiry || !bookingData?.payload?.checkInDate) return false;
    return new Date(studentIdExpiry) < new Date(bookingData.payload.checkInDate);
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" })
      .format(Number(price) || 0);

  // ── Form validation (mirrors HotelBookingPage) ────────────────
  const validateForm = () => {
    const errors = {};
    // Primary-guest validation removed — the Primary Guest Details
    // card has been hidden (the Guest Details grid above is the
    // single source of customer details, with the Lead radio marking
    // the head guest). The submit payload derives primaryGuest from
    // the lead row at build time.
    rooms.forEach((room, ri) => {
      room.guests.forEach((g, gi) => {
        const k = `room_${ri}_guest_${gi}`;
        if (!g.salutation) errors[`${k}_salutation`] = "Required";
        if (!g.firstName) errors[`${k}_firstName`] = "Required";
        if (!g.lastName) errors[`${k}_lastName`] = "Required";
       
      });
    });
    return { errors, hasErrors: Object.keys(errors).length > 0 };
  };

  // ── Build payload + show confirmation ─────────────────────────
  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!isStudentInfoReady()) {
      toast.error("Complete the student verification fields first");
      return;
    }
    const { errors, hasErrors } = validateForm();
    if (hasErrors) {
      setValidationErrors(errors);
      toast.error("Please complete the highlighted fields");
      return;
    }
    setValidationErrors({});

    const { selectedRate, hotelStaticData, payload, activePromotion, searchCtx } = bookingData;

    // Nights
    const ci = new Date(payload.checkInDate);
    const co = new Date(payload.checkOutDate);
    const nights = Math.max(1, Math.round((co - ci) / 86400000));

    // Multi-room aware: when StudentRoomList sent a per-room
    // `roomBreakdown` array (one entry per booked room), each room
    // pulls its OWN roomCategory / mealPlan / rate / etc. from that
    // slot. Without `roomBreakdown` (every legacy single-room flow),
    // `slot` falls back to the combined `selectedRate` and behaves
    // exactly as before — so no other flow is affected.
    const allRooms = (rooms || []).map((room, idx) => {
      const slot = bookingData.roomBreakdown?.[idx] || selectedRate;
      return {
        roomNo: idx + 1,
        roomCategory: slot.roomCategory,
        mealPlan: slot.mealPlan,
        nonRefundable: !!slot.nonRefundable,
        rate: Number(slot.rate || 0),
        rateBeforeDiscount: Number(slot.rateBeforeDiscount || slot.rate || 0),
        rateWithoutMarkup: Number(slot.rate || 0),
        adults: room.adults,
        children: room.children,
        childAges: room.childAges || [],
        currency: slot.currency || "AED",
        guests: (room.guests || []).map((g, gi) => ({
          salutation: g.salutation, firstName: g.firstName, lastName: g.lastName,
          gender: g.gender, isChild: !!g.isChild,
          // Lead flag mirrors /gov-employee-booking-page. Backend
          // ignores unknown fields, so adding this stays backward-
          // compatible with the existing /api/student-booking/create
          // contract.
          isLead: idx === leadIndex.roomIdx && gi === leadIndex.guestIdx,
        })),
      };
    });

    // Primary guest is now derived from the Lead-marked passenger in
    // the Guest Details grid (the Primary Guest Details card is
    // hidden). The contact fields the old card collected
    // (email / phone / passportNo / agentLpo) aren't captured on the
    // form any more, so they're left empty — the backend ignores
    // missing optional values, and the existing
    // /api/student-booking/create contract is preserved.
    const leadGuest =
      rooms[leadIndex.roomIdx]?.guests[leadIndex.guestIdx] || {};
    const derivedPrimaryGuest = {
      salutation: leadGuest.salutation || "",
      firstName: leadGuest.firstName || "",
      middleName: leadGuest.middleName || "",
      lastName: leadGuest.lastName || "",
      email: "",
      phone: "",
      passportNo: "",
      agentLpo: "",
      nativeCountry: "",
    };

    const built = {
      agentId: String(payload.agentId || searchCtx?.agentId || ""),
      apiId: String(payload.apiId || searchCtx?.apiId || 1),
      hotelId: String(selectedRate.hotelId || searchCtx?.hotelCode || ""),
      hotelName: hotelStaticData.hotelName,
      address: hotelStaticData.address,
      starRating: hotelStaticData.starRating,
      checkInDate: payload.checkInDate,
      checkOutDate: payload.checkOutDate,
      nights,
      primaryGuest: derivedPrimaryGuest,
      rooms: allRooms,
      remarks,
      specialRequests,
      source: "WEB",
      createdByRole: activeUserRole || "agent",
      // Student verification — the method drives which extra
      // fields are sent to the backend.
      verificationMethod,
      studentName:
        studentName.trim()
        || `${derivedPrimaryGuest.firstName} ${derivedPrimaryGuest.lastName}`.trim(),
      institutionName: institutionName.trim(),
      studentIdNumber: studentIdNumber.trim(),
      studentIdExpiry,
      // Only carry the upload path when Method 1 is chosen.
      studentIdFilePath: verificationMethod === METHOD_UPLOAD ? uploadedFilePath : null,
      studentIdFileName: verificationMethod === METHOD_UPLOAD ? uploadedFileName : null,
      // Only carry the email + OTP-verified flag when Method 3 is chosen.
      institutionalEmail: verificationMethod === METHOD_EMAIL ? (institutionalEmail.trim() || null) : null,
      emailVerified: verificationMethod === METHOD_EMAIL ? emailVerified : false,
      // Discount snapshot (server re-applies)
      discountPercent: activePromotion?.discountPercent ?? null,
      discountAmount: activePromotion?.discountAmount ?? null,
      totalRateBeforeDiscount: allRooms.reduce((s, r) => s + Number(r.rateBeforeDiscount || 0), 0),
      // employeeId is picked in StudentSearch and rides on bookingData.payload.
      employeeId: bookingData?.payload?.employeeId || null,
    };
    setPendingPayload(built);
    setShowConfirmModal(true);
  };

  const confirmBooking = async () => {
    if (!pendingPayload) return;
    setIsSubmitting(true);
    try {
      const { data } = await axiosInstance.post("/api/student-booking/create", pendingPayload);
      if (data?.success) {
        setShowConfirmModal(false);
        toast.success(`Booking ${data.bookingCode} created — Pending student verification`);
        navigate("/booking-details/student-booking-list");
      } else {
        toast.error(data?.message || "Booking failed");
      }
    } catch (e) {
      console.error("[student] booking failed:", e);
      toast.error(e?.response?.data?.message || "Booking failed");
    } finally { setIsSubmitting(false); }
  };

  if (!bookingData) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <div className="text-muted">Loading booking data…</div>
          </main>
        </div>
      </div>
    );
  }

  const { hotelStaticData, payload, selectedRate, activePromotion } = bookingData;
  // Multi-room aware: when `roomBreakdown` is present the combined
  // `selectedRate.rate` is ALREADY the sum across rooms; multiplying
  // again by `rooms.length` would double-count. Sum per-room values
  // directly instead. Legacy single-room flows keep
  // `selectedRate.X × rooms.length`, which equals `selectedRate.X`
  // when there is one room.
  const totalBefore = bookingData.roomBreakdown?.length
    ? bookingData.roomBreakdown.reduce(
        (s, r) => s + Number(r.rateBeforeDiscount || r.rate || 0),
        0,
      )
    : Number(selectedRate.rateBeforeDiscount || 0) * (rooms.length || 1);
  const totalAfter = bookingData.roomBreakdown?.length
    ? bookingData.roomBreakdown.reduce((s, r) => s + Number(r.rate || 0), 0)
    : Number(selectedRate.rate || 0) * (rooms.length || 1);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column hotel-booking-container">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-3" style={{ minWidth: 0, overflowX: "hidden" }}>
          {/* Layout unified with /gov-employee-booking-page:
                - top bar with Back + Available Balance
                - left main column (lg=8): verification + guest details
                  + special requests + booking done by
                - right sticky column (lg=4): Booking Summary +
                  Price Details + Action bar
              Behavior (verification flow, validation, submit handler,
              modal, payload) is preserved bit-for-bit. */}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => navigate(-1)}
              className="d-flex align-items-center"
            >
              <FaArrowLeft className="me-2" />
              Back to Room List
            </Button>
            {agentAvailableBalance != null && (
              <span
                className="fw-bold"
                style={{ color: "#dc3545", fontSize: "0.95rem" }}
              >
                Available Balance:{" "}
                {Number(agentAvailableBalance).toFixed(2)}
              </span>
            )}
          </div>

          <Form onSubmit={handleSubmit}>
            <Row>
              {/* ─────────── Left main column ─────────── */}
              <Col lg={8}>
              {/* ── Student Verification block ─────────────────────
                  The user must pick ONE of three verification methods.
                  Institution + ID number + expiry are common to all
                  three (admin always needs to identify the student).
                  The method picked here is saved on the booking row. */}
              <Card className="mb-2 shadow-sm border-0">
                <Card.Header className="bg-primary text-white py-2">
                  <h6 className="mb-0 fw-bold d-flex align-items-center">
                    <FaGraduationCap className="me-2" /> Student Verification
                  </h6>
                </Card.Header>
                <Card.Body className="p-3">
                  <Alert variant="info" className="small mb-3">
                    Choose a verification method. The booking will be saved with status{" "}
                    <strong>PENDING_STUDENT_VERIFICATION</strong> until an admin Approves / Rejects
                    on the Student Verification screen.
                  </Alert>

                  {/* ── Method selector (3 radio buttons) ─────────── */}
                  <Row className="g-3 mb-3">
                    <Col md={4}>
                      <Card className={`p-3 h-100 ${verificationMethod === METHOD_UPLOAD ? "border-primary" : ""}`}>
                        <Form.Check
                          type="radio"
                          id="vm-upload"
                          name="verificationMethod"
                          label={<strong>1. Student ID Upload <Badge bg="primary" className="ms-1">Primary</Badge></strong>}
                          checked={verificationMethod === METHOD_UPLOAD}
                          onChange={() => setVerificationMethod(METHOD_UPLOAD)}
                        />
                        <div className="text-muted small mt-2">
                          Upload the Student ID Card (JPG/PNG/PDF). Most-used method.
                        </div>
                      </Card>
                    </Col>
                    <Col md={4}>
                      <Card className={`p-3 h-100 ${verificationMethod === METHOD_MANUAL ? "border-primary" : ""}`}>
                        <Form.Check
                          type="radio"
                          id="vm-manual"
                          name="verificationMethod"
                          label={<strong>2. Manual Admin Approval <Badge bg="success" className="ms-1">Recommended</Badge></strong>}
                          checked={verificationMethod === METHOD_MANUAL}
                          onChange={() => setVerificationMethod(METHOD_MANUAL)}
                        />
                        <div className="text-muted small mt-2">
                          No upload now — admin verifies offline before approving the booking.
                        </div>
                      </Card>
                    </Col>
                    <Col md={4}>
                      <Card className={`p-3 h-100 ${verificationMethod === METHOD_EMAIL ? "border-primary" : ""}`}>
                        <Form.Check
                          type="radio"
                          id="vm-email"
                          name="verificationMethod"
                          label={<strong>3. Institutional Email <Badge bg="info" className="ms-1">Optional</Badge></strong>}
                          checked={verificationMethod === METHOD_EMAIL}
                          onChange={() => setVerificationMethod(METHOD_EMAIL)}
                        />
                        <div className="text-muted small mt-2">
                          Verify via OTP sent to e.g. <code>name@university.edu</code>.
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  {/* ── Common fields (always shown) ──────────────── */}
                  <Row className="g-3">
                    <Col md={4}>
                      <Form.Label>Institution Name *</Form.Label>
                      <Form.Control value={institutionName}
                                    onChange={(e) => setInstitutionName(e.target.value)}
                                    placeholder="e.g. ABC University" />
                    </Col>
                    <Col md={4}>
                      <Form.Label>Student ID Number *</Form.Label>
                      <Form.Control value={studentIdNumber}
                                    onChange={(e) => setStudentIdNumber(e.target.value)}
                                    placeholder="e.g. STU-2026-0042" />
                    </Col>
                    <Col md={4}>
                      <Form.Label>Expiry / Validity Date *</Form.Label>
                      <Form.Control type="date" value={studentIdExpiry}
                                    onChange={(e) => setStudentIdExpiry(e.target.value)} />
                      {isExpiryBeforeCheckIn() && (
                        <small className="text-danger">
                          ID expires before check-in — booking cannot proceed.
                        </small>
                      )}
                    </Col>
                    <Col md={6}>
                      <Form.Label>Student Full Name</Form.Label>
                      <Form.Control value={studentName}
                                    onChange={(e) => setStudentName(e.target.value)}
                                    placeholder="(defaults to primary guest name)" />
                    </Col>
                  </Row>

                  {/* ── Method 1: Student ID Upload ─────────────── */}
                  {verificationMethod === METHOD_UPLOAD && (
                    <div className="mt-3 p-3 bg-light rounded">
                      <h6 className="mb-3">Student ID Card Upload</h6>
                      <Row className="g-3 align-items-end">
                        <Col md={6}>
                          <Form.Label className="fw-semibold">Document *</Form.Label>
                          <Form.Control type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={onFileChange} />
                          <Form.Text className="text-muted">PDF, PNG or JPG. Max ~5 MB.</Form.Text>
                        </Col>
                        <Col md={3}>
                          <Button variant="outline-primary" className="d-block"
                                  onClick={handleUpload} disabled={!idFile || uploading}>
                            {uploading ? <Spinner size="sm" /> : <><FaFileUpload className="me-1" /> Upload</>}
                          </Button>
                        </Col>
                        <Col md={3}>
                          {uploadedFilePath
                            ? <Badge bg="success" className="p-2">✓ {uploadedFileName}</Badge>
                            : idFile
                              ? <span className="text-muted small">Click Upload to save</span>
                              : <span className="text-muted small">No file selected</span>}
                        </Col>
                      </Row>
                    </div>
                  )}

                  {/* ── Method 2: Manual Admin Approval ─────────── */}
                  {verificationMethod === METHOD_MANUAL && (
                    <Alert variant="success" className="mt-3 mb-0">
                      <strong>Manual Admin Approval selected.</strong> No document upload is required
                      at booking time. The booking will appear in the
                      <em> Student Verification</em> screen as{" "}
                      <Badge bg="warning" text="dark">PENDING_STUDENT_VERIFICATION</Badge>. The admin can
                      <em> Approve</em>, <em>Reject</em> (refunds credit), or
                      <em> Request Re-upload</em>.
                    </Alert>
                  )}

                  {/* ── Method 3: Institutional Email Verification ── */}
                  {verificationMethod === METHOD_EMAIL && (
                    <div className="mt-3 p-3 bg-light rounded">
                      <h6 className="mb-3 d-flex align-items-center">
                        <FaEnvelope className="me-2 text-muted" /> Institutional Email Verification
                      </h6>
                      <Row className="g-3 align-items-end">
                        <Col md={6}>
                          <Form.Label>Email *</Form.Label>
                          <Form.Control type="email" placeholder="name@university.edu"
                                        value={institutionalEmail}
                                        onChange={(e) => { setInstitutionalEmail(e.target.value); setOtpSent(false); setEmailVerified(false); }}
                                        disabled={emailVerified} />
                        </Col>
                        <Col md={3}>
                          {!emailVerified && !otpSent && (
                            <Button variant="outline-secondary" onClick={handleSendOtp}>Send OTP</Button>
                          )}
                          {emailVerified && (
                            <Badge bg="success" className="p-2 d-flex align-items-center">
                              <FaCheckCircle className="me-1" /> Verified
                            </Badge>
                          )}
                        </Col>
                        {otpSent && !emailVerified && (
                          <Col md={12}>
                            <div className="d-flex gap-1">
                              <Form.Control placeholder="6-digit OTP" value={otpInput}
                                            onChange={(e) => setOtpInput(e.target.value)} maxLength={6} />
                              <Button variant="primary" size="sm" onClick={handleVerifyOtp}>Verify</Button>
                            </div>
                          </Col>
                        )}
                      </Row>
                      {!emailVerified && (
                        <div className="text-muted small mt-2">
                          Booking submit is disabled until the email is verified.
                        </div>
                      )}
                    </div>
                  )}
                </Card.Body>
              </Card>

              {/* Guest details — single consolidated card that mirrors
                  /gov-employee-booking-page:
                    - compact left-aligned header (bg-light py-2 + h6)
                    - alwaysOpen accordion so every room stays expanded
                      together instead of one-at-a-time
                    - column headers row (Passenger | Title | First Name
                      | Surname | Gender) above the per-guest rows
                  Field bindings + onChange handlers + validation keys
                  are untouched, so behavior is identical. */}
              <Card className="mb-2 shadow-sm border-0">
                <Card.Header className="bg-light py-2">
                  <h6 className="mb-0 fw-bold text-dark">Guest Details</h6>
                </Card.Header>
                <Card.Body className="p-0">
                  <Accordion defaultActiveKey="0" alwaysOpen>
                    {rooms.map((room, roomIndex) => (
                      <Accordion.Item key={roomIndex} eventKey={String(roomIndex)}>
                        <Accordion.Header>
                          <span className="fw-bold">
                            {/* Per-room label from roomBreakdown when
                                present (multi-room flow); else the
                                combined selectedRate.roomCategory
                                (legacy single-room). */}
                            Room {roomIndex + 1} —{" "}
                            {bookingData.roomBreakdown?.[roomIndex]?.roomCategory
                              || selectedRate.roomCategory}
                          </span>
                        </Accordion.Header>
                        <Accordion.Body className="p-3">
                          {/* Column headers — mirrors the
                              gov-employee booking page so the two
                              dedicated-flow forms look identical. */}
                          <Row className="fw-semibold small text-muted px-2 mb-1 d-none d-md-flex">
                            <Col md={2}>Passenger</Col>
                            <Col md={2}>Title *</Col>
                            <Col md={3}>First Name *</Col>
                            <Col md={3}>Surname *</Col>
                            <Col md={2} className="text-center">Lead</Col>
                          </Row>
                          {room.guests.map((guest, gi) => {
                            const k = `room_${roomIndex}_guest_${gi}`;
                            const isLead =
                              leadIndex.roomIdx === roomIndex &&
                              leadIndex.guestIdx === gi;
                            return (
                              <Row key={gi} className="align-items-center g-2 mb-2">
                                <Col md={2}>
                                  <span className="fw-semibold text-muted">
                                    {guest.isChild
                                      ? `Child ${gi - room.adults + 1}`
                                      : `Adult ${gi + 1}`}
                                  </span>
                                </Col>
                                <Col md={2}>
                                  <Form.Select isInvalid={!!validationErrors[`${k}_salutation`]}
                                               value={guest.salutation}
                                               onChange={(e) => handleGuestChange(roomIndex, gi, "salutation", e.target.value)}>
                                    <option value="">Title</option>
                                    <option>Mr</option><option>Mrs</option>
                                    <option>Ms</option><option>Dr</option>
                                  </Form.Select>
                                </Col>
                                <Col md={3}>
                                  <Form.Control placeholder="First Name"
                                                isInvalid={!!validationErrors[`${k}_firstName`]}
                                                value={guest.firstName}
                                                onChange={(e) => handleGuestChange(roomIndex, gi, "firstName", e.target.value)} />
                                </Col>
                                <Col md={3}>
                                  <Form.Control placeholder="Surname"
                                                isInvalid={!!validationErrors[`${k}_lastName`]}
                                                value={guest.lastName}
                                                onChange={(e) => handleGuestChange(roomIndex, gi, "lastName", e.target.value)} />
                                </Col>
                                {/* Gender column hidden by request.
                                    State `guest.gender` keeps its
                                    default empty string. */}
                                <Col md={2} className="text-center">
                                  {/* Lead radio — only adults can be
                                      lead. Disabled+greyed for children
                                      so the row still aligns. */}
                                  <Form.Check
                                    type="radio"
                                    name="student-lead-guest"
                                    id={`student-lead-${roomIndex}-${gi}`}
                                    checked={isLead}
                                    disabled={guest.isChild}
                                    onChange={() => handleLeadSelect(roomIndex, gi)}
                                    title={
                                      guest.isChild
                                        ? "Children cannot be the lead"
                                        : "Mark as Lead passenger"
                                    }
                                  />
                                </Col>
                              </Row>
                            );
                          })}
                        </Accordion.Body>
                      </Accordion.Item>
                    ))}
                  </Accordion>
                </Card.Body>
              </Card>

              {/* Primary Guest Details card hidden per spec — the
                  Guest Details grid above is the single source of
                  customer details, with the Lead radio marking the
                  head guest. The submit payload still carries a
                  `primaryGuest` object: it's derived from the lead
                  guest's name fields in buildPayloadAndShowOrderSummary
                  so the backend contract stays intact. */}

              {/* Special requests (Remarks textarea hidden by
                  request — state `remarks` keeps its default empty
                  string). */}
              <Card className="p-2 mb-2 shadow-sm border-0">
                <h6 className="mb-2 fw-bold text-primary">Special Requests</h6>
                <div className="mb-3 d-flex flex-wrap gap-2">
                  {SPECIAL_REQUEST_OPTIONS.map((req) => (
                    <Form.Check key={req} type="checkbox" id={`sr-${req}`} label={req}
                                checked={specialRequests.includes(req)}
                                onChange={() => toggleSpecialRequest(req)} />
                  ))}
                </div>
              </Card>

              {/* "Booking Done By Employee" was moved into the
                  StudentSearch criteria (optional). employeeId rides on
                  bookingData.payload and is sent to
                  /api/student-booking/create from there. */}
              </Col>

              {/* ─────────── Right sticky summary column ─────────── */}
              <Col lg={4} className="hbp-right-col">
                <div className="hbp-sticky-summary">
                  <Card className="shadow-sm rounded-3 mb-2 booking-summary-card border-0 overflow-hidden">
                    <Card.Header className="bg-primary text-white py-2 rounded-top">
                      <h6 className="mb-0 d-flex align-items-center">
                        <FaHotel className="me-2" /> Booking Summary
                      </h6>
                    </Card.Header>
                    <Card.Body className="p-2">
                      <div className="mb-2">
                        <div className="fw-bold text-primary mb-1">
                          {hotelStaticData.hotelName}
                        </div>
                        <div className="text-muted small mb-2">
                          {hotelStaticData.address}
                        </div>
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <span className="badge bg-warning text-dark">
                            ⭐ {hotelStaticData.starRating} Star
                          </span>
                          {selectedRate?.nonRefundable !== undefined && (
                            <Badge
                              bg={
                                selectedRate.nonRefundable === true ||
                                selectedRate.nonRefundable === "true"
                                  ? "danger"
                                  : "success"
                              }
                            >
                              {selectedRate.nonRefundable === true ||
                              selectedRate.nonRefundable === "true"
                                ? "Non-Refundable"
                                : "Flexible"}
                            </Badge>
                          )}
                          {activePromotion && (
                            <Badge
                              bg="success"
                              className="d-inline-flex align-items-center"
                            >
                              <FaGraduationCap className="me-1" /> Student
                              Discount
                              {activePromotion.discountPercent
                                ? ` ${activePromotion.discountPercent}%`
                                : ""}
                              {activePromotion.discountAmount
                                ? ` + ${activePromotion.discountAmount}`
                                : ""}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="hbp-summary-row">
                        <div className="hbp-summary-label">
                          <FaCalendarAlt className="me-2 text-primary" />
                          Check-in
                        </div>
                        <div className="hbp-summary-value">
                          {formatDateTime(payload.checkInDate)}
                        </div>
                      </div>
                      <div className="hbp-summary-row">
                        <div className="hbp-summary-label">
                          <FaCalendarAlt className="me-2 text-primary" />
                          Check-out
                        </div>
                        <div className="hbp-summary-value">
                          {formatDateTime(payload.checkOutDate)}
                        </div>
                      </div>
                      <div className="hbp-summary-row align-items-start">
                        <div className="hbp-summary-label">
                          <FaUsers className="me-2 text-primary" />
                          Guests
                        </div>
                        <div className="hbp-summary-value text-end">
                          {payload.rooms.map((room, i) => (
                            <div key={i} className="small">
                              Room {i + 1}: {room.adults} Adult
                              {room.adults > 1 ? "s" : ""}
                              {room.children
                                ? `, ${room.children} Child${
                                    room.children > 1 ? "ren" : ""
                                  }`
                                : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="hbp-summary-row">
                        <div className="hbp-summary-label">
                          <FaUtensils className="me-2 text-primary" />
                          Meal Plan
                        </div>
                        <div className="hbp-summary-value">
                          {selectedRate.mealPlan}
                        </div>
                      </div>
                    </Card.Body>
                  </Card>

                  <Card className="shadow-sm rounded-3 border-0 hbp-price-card">
                    <Card.Header className="bg-light py-2">
                      <h6 className="mb-0 fw-bold">Price Details</h6>
                    </Card.Header>
                    <Card.Body className="p-2">
                      {activePromotion && totalBefore !== totalAfter && (
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            Standard Total
                          </div>
                          <div className="hbp-summary-value text-decoration-line-through text-muted">
                            {formatPrice(totalBefore)}
                          </div>
                        </div>
                      )}
                      <div className="hbp-summary-row">
                        <div className="hbp-summary-label">Rate</div>
                        <div className="hbp-summary-value">
                          {formatPrice(selectedRate.rate || 0)} ×{" "}
                          {rooms.length || 1}
                        </div>
                      </div>
                      <hr className="my-2" />
                      <div className="hbp-summary-row fw-bold">
                        <div className="hbp-summary-label text-danger">
                          New Total
                          {activePromotion ? " (after Student discount)" : ""}
                        </div>
                        <div className="hbp-summary-value text-danger">
                          {formatPrice(totalAfter)}
                        </div>
                      </div>
                    </Card.Body>
                  </Card>

                  <div className="hbp-action-bar mt-2 d-flex gap-2">
                    <Button
                      variant="outline-secondary"
                      onClick={() => navigate(-1)}
                      className="flex-grow-1"
                    >
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={!isStudentInfoReady()}
                      title={
                        !isStudentInfoReady()
                          ? "Complete student verification first"
                          : ""
                      }
                      className="flex-grow-1"
                    >
                      Confirm Booking
                    </Button>
                  </div>
                </div>
              </Col>
            </Row>

            {/* Confirmation modal */}
              <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)}
                     centered backdrop="static" size="md">
                <Modal.Header closeButton className="bg-primary text-white py-2">
                  <Modal.Title className="fw-semibold d-flex align-items-center">
                    <FaHotel className="me-2" /> Confirm Your Booking
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body className="px-4 py-3 bg-light">
                  {pendingPayload && (
                    <div className="border rounded-3 bg-white shadow-sm p-3">
                      <h5 className="fw-bold text-primary mb-2">{pendingPayload.hotelName}</h5>
                      <p className="text-muted mb-0">{pendingPayload.address}</p>
                      <hr />
                      <Row className="gy-2">
                        <Col xs={6}><strong>Check-In:</strong><br />{pendingPayload.checkInDate}</Col>
                        <Col xs={6}><strong>Check-Out:</strong><br />{pendingPayload.checkOutDate}</Col>
                        <Col xs={6}><strong>Rooms:</strong> {pendingPayload.rooms.length}</Col>
                        <Col xs={6}><strong>Nights:</strong> {pendingPayload.nights}</Col>
                        <Col xs={12}>
                          <strong>Student Verification:</strong>
                          <ul className="mb-0 ps-3 small">
                            <li>
                              <strong>Method:</strong>{" "}
                              <Badge bg={
                                pendingPayload.verificationMethod === METHOD_UPLOAD ? "primary" :
                                pendingPayload.verificationMethod === METHOD_MANUAL ? "success" : "info"}>
                                {pendingPayload.verificationMethod === METHOD_UPLOAD ? "Student ID Upload" :
                                 pendingPayload.verificationMethod === METHOD_MANUAL ? "Manual Admin Approval" :
                                 "Institutional Email"}
                              </Badge>
                            </li>
                            <li>Institution: {pendingPayload.institutionName}</li>
                            <li>ID Number: {pendingPayload.studentIdNumber}</li>
                            <li>ID Expiry: {pendingPayload.studentIdExpiry}</li>
                            {pendingPayload.verificationMethod === METHOD_UPLOAD && (
                              <li>Document: {pendingPayload.studentIdFileName}</li>
                            )}
                            {pendingPayload.verificationMethod === METHOD_EMAIL && pendingPayload.institutionalEmail && (
                              <li>Email: {pendingPayload.institutionalEmail}{" "}
                                {pendingPayload.emailVerified ? "(verified)" : ""}</li>
                            )}
                          </ul>
                        </Col>
                      </Row>
                      <div className="mt-3 p-3 bg-white border rounded">
                        <h6 className="fw-bold mb-2">Rate Split</h6>
                        {pendingPayload.totalRateBeforeDiscount > pendingPayload.rooms.reduce((s, r) => s + r.rate, 0) && (
                          <div className="d-flex justify-content-between">
                            <span>Standard total</span>
                            <span className="text-decoration-line-through text-muted">
                              {formatPrice(pendingPayload.totalRateBeforeDiscount)}
                            </span>
                          </div>
                        )}
                        {(pendingPayload.discountPercent || pendingPayload.discountAmount) && (
                          <div className="d-flex justify-content-between text-success">
                            <span>Student Discount</span>
                            <span>
                              {pendingPayload.discountPercent ? `${pendingPayload.discountPercent}%` : ""}
                              {pendingPayload.discountAmount ? ` + ${pendingPayload.discountAmount}` : ""}
                            </span>
                          </div>
                        )}
                        <hr className="my-2" />
                        <div className="d-flex justify-content-between fw-bold text-success">
                          <span>Total Payable</span>
                          <span>{formatPrice(pendingPayload.rooms.reduce((s, r) => s + r.rate, 0))}</span>
                        </div>
                      </div>
                      <div className="mt-3 text-center">
                        <p className="text-muted small mb-0">
                          The booking will be saved as <strong>PENDING_STUDENT_VERIFICATION</strong> until
                          an admin approves the uploaded Student ID.
                        </p>
                      </div>
                    </div>
                  )}
                </Modal.Body>
                <Modal.Footer className="bg-light border-0 d-flex justify-content-between">
                  <Button variant="outline-secondary" onClick={() => setShowConfirmModal(false)}
                          disabled={isSubmitting}>Cancel</Button>
                  <Button variant="primary" onClick={confirmBooking} disabled={isSubmitting}
                          className="px-4 fw-semibold">
                    {isSubmitting ? <><Spinner size="sm" className="me-2" /> Processing…</> : "Confirm"}
                  </Button>
                </Modal.Footer>
              </Modal>
            </Form>
        </main>
      </div>
    </div>
  );
}
