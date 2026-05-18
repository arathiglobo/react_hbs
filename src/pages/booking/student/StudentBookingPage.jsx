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
  FaHotel, FaCalendarAlt, FaUsers, FaUtensils, FaUserTie,
  FaGraduationCap, FaFileUpload, FaEnvelope, FaCheckCircle,
} from "react-icons/fa";
import {
  Container, Row, Col, Card, Form, Button, Accordion, Badge,
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

export default function StudentBookingPage() {
  const navigate = useNavigate();
  const activeUserRole = localStorage.getItem("currentActiveRole");

  const [bookingData, setBookingData] = useState(null);
  const [agentAvailableBalance, setAgentAvailableBalance] = useState(null);

  // Rooms (guest details per adult/child)
  const [rooms, setRooms] = useState([]);

  // Primary guest
  const [primaryGuest, setPrimaryGuest] = useState({
    salutation: "", firstName: "", middleName: "", lastName: "",
    email: "", phone: "", passportNo: "", agentLpo: "",
  });

  const [remarks, setRemarks] = useState("");
  const [specialRequests, setSpecialRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [bookingDoneByEmployeeId, setBookingDoneByEmployeeId] = useState("");

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

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get("/api/employee?page=0&limit=1000");
        if (Array.isArray(res.data)) setEmployees(res.data);
      } catch (e) { /* silent */ }
    })();
  }, []);

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
    if (!primaryGuest.salutation) errors.salutation = "Salutation is required";
    if (!primaryGuest.firstName) errors.firstName = "First Name is required";
    if (!primaryGuest.lastName) errors.lastName = "Last Name is required";
    if (!primaryGuest.email) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryGuest.email))
      errors.email = "Please enter a valid email address";
    if (!primaryGuest.phone) errors.phone = "Phone is required";
    if (!primaryGuest.agentLpo) errors.agentLpo = "Agent LPO is required";
    rooms.forEach((room, ri) => {
      room.guests.forEach((g, gi) => {
        const k = `room_${ri}_guest_${gi}`;
        if (!g.salutation) errors[`${k}_salutation`] = "Required";
        if (!g.firstName) errors[`${k}_firstName`] = "Required";
        if (!g.lastName) errors[`${k}_lastName`] = "Required";
        if (!g.gender) errors[`${k}_gender`] = "Required";
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

    const allRooms = (rooms || []).map((room, idx) => ({
      roomNo: idx + 1,
      roomCategory: selectedRate.roomCategory,
      mealPlan: selectedRate.mealPlan,
      nonRefundable: !!selectedRate.nonRefundable,
      rate: Number(selectedRate.rate || 0),
      rateBeforeDiscount: Number(selectedRate.rateBeforeDiscount || selectedRate.rate || 0),
      rateWithoutMarkup: Number(selectedRate.rate || 0),
      adults: room.adults,
      children: room.children,
      childAges: room.childAges || [],
      currency: selectedRate.currency || "AED",
      guests: (room.guests || []).map((g) => ({
        salutation: g.salutation, firstName: g.firstName, lastName: g.lastName,
        gender: g.gender, isChild: !!g.isChild,
      })),
    }));

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
      primaryGuest: { ...primaryGuest, nativeCountry: "" },
      rooms: allRooms,
      remarks,
      specialRequests,
      source: "WEB",
      createdByRole: activeUserRole || "agent",
      // Student verification — the method drives which extra
      // fields are sent to the backend.
      verificationMethod,
      studentName: studentName.trim() || `${primaryGuest.firstName} ${primaryGuest.lastName}`.trim(),
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
      employeeId: bookingDoneByEmployeeId || null,
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
  const totalBefore = Number(selectedRate.rateBeforeDiscount || 0) * (rooms.length || 1);
  const totalAfter = Number(selectedRate.rate || 0) * (rooms.length || 1);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column hotel-booking-container">
      <TopBar />
      <div className="main-content">
        <Sidebar />
        <main className="content-wrapper py-4">
          <Container fluid="xl">
            {/* Booking Summary card */}
            <Row>
              <Col>
                <Card className="shadow-lg rounded-xl mb-3 booking-summary-card border-0 overflow-hidden">
                  <Card.Header className="bg-gradient-secondary text-black py-2 rounded-top">
                    <div className="d-flex justify-content-between align-items-center">
                      <h4 className="mb-0 d-flex align-items-center">
                        <FaHotel className="me-1 fs-4" /> Booking Summary
                      </h4>
                      <div className="d-flex align-items-center gap-3">
                        {activePromotion && (
                          <Badge bg="success" className="d-inline-flex align-items-center">
                            <FaGraduationCap className="me-1" />
                            Student Discount:
                            {activePromotion.discountPercent ? ` ${activePromotion.discountPercent}%` : ""}
                            {activePromotion.discountAmount ? ` + ${activePromotion.discountAmount}` : ""}
                          </Badge>
                        )}
                        {agentAvailableBalance != null && (
                          <span className="fw-bold" style={{ color: "#dc3545", fontSize: "0.95rem" }}>
                            Available Balance: {Number(agentAvailableBalance).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card.Header>
                  <Card.Body className="p-4 bg-light">
                    <Row className="gy-4">
                      <Col md={6} lg={4}>
                        <div className="hotel-info-card p-3 bg-white rounded shadow-sm h-100">
                          <h5 className="fw-bold text-primary mb-3">{hotelStaticData.hotelName}</h5>
                          <p className="text-muted mb-2">{hotelStaticData.address}</p>
                          <span className="badge bg-warning text-dark me-2">⭐ {hotelStaticData.starRating} Star</span>
                        </div>
                      </Col>
                      <Col md={6} lg={2}>
                        <div className="info-card p-3 bg-white rounded shadow-sm h-100 text-center">
                          <FaCalendarAlt className="me-2 text-primary fs-5 mb-2" />
                          <h6 className="fw-bold text-primary mb-2">Check-in</h6>
                          <p className="mb-0 fw-semibold text-dark">{payload.checkInDate}</p>
                        </div>
                      </Col>
                      <Col md={6} lg={2}>
                        <div className="info-card p-3 bg-white rounded shadow-sm h-100 text-center">
                          <FaCalendarAlt className="me-2 text-primary fs-5 mb-2" />
                          <h6 className="fw-bold text-primary mb-2">Check-out</h6>
                          <p className="mb-0 fw-semibold text-dark">{payload.checkOutDate}</p>
                        </div>
                      </Col>
                      <Col md={6} lg={2}>
                        <div className="info-card p-3 bg-white rounded shadow-sm h-100 text-center">
                          <FaUsers className="me-2 text-primary fs-5 mb-2" />
                          <h6 className="fw-bold text-primary mb-2">Guests</h6>
                          <div className="text-start">
                            {payload.rooms.map((room, i) => (
                              <small key={i} className="d-block fw-semibold text-dark">
                                Room {i + 1}: {room.adults} Adults
                                {room.children ? `, ${room.children} Children` : ""}
                              </small>
                            ))}
                          </div>
                        </div>
                      </Col>
                      <Col md={6} lg={2}>
                        <div className="info-card p-3 bg-white rounded shadow-sm h-100 text-center">
                          <FaUtensils className="me-2 text-primary fs-5 mb-2" />
                          <h6 className="fw-bold text-primary mb-2">Meal Plan</h6>
                          <p className="mb-0 fw-semibold text-dark">{selectedRate.mealPlan}</p>
                        </div>
                      </Col>
                    </Row>
                    <hr className="my-4" />
                    {activePromotion && totalBefore !== totalAfter && (
                      <div className="pricing-section p-3 bg-white rounded shadow-sm mb-2">
                        <div className="d-flex justify-content-between">
                          <h6 className="mb-0 text-muted">Standard Total</h6>
                          <h5 className="mb-0 text-decoration-line-through text-muted">{formatPrice(totalBefore)}</h5>
                        </div>
                      </div>
                    )}
                    <div className="pricing-section p-3 bg-gradient-success text-white rounded shadow-sm">
                      <div className="d-flex justify-content-between">
                        <h5 className="mb-0">Total Payable {activePromotion ? "(after Student discount)" : ""}</h5>
                        <h4 className="mb-0 fw-bold">{formatPrice(totalAfter)}</h4>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <Form onSubmit={handleSubmit}>
              {/* ── Student Verification block ─────────────────────
                  The user must pick ONE of three verification methods.
                  Institution + ID number + expiry are common to all
                  three (admin always needs to identify the student).
                  The method picked here is saved on the booking row. */}
              <Card className="mb-3 shadow-sm border-0">
                <Card.Header className="bg-primary text-white py-3">
                  <h5 className="mb-0 fw-bold d-flex align-items-center">
                    <FaGraduationCap className="me-2" /> Student Verification
                  </h5>
                </Card.Header>
                <Card.Body className="p-4">
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

              {/* Guest details */}
              <Card className="mb-3 shadow-sm border-0">
                <Card.Header className="bg-light text-center py-3">
                  <h5 className="mb-0 fw-bold text-dark">Guest Details</h5>
                </Card.Header>
                <Card.Body className="p-0">
                  <Accordion defaultActiveKey="0">
                    {rooms.map((room, roomIndex) => (
                      <Accordion.Item key={roomIndex} eventKey={String(roomIndex)} className="mb-3">
                        <Accordion.Header>
                          <h6 className="mb-0 fw-bold">Room {roomIndex + 1} — {selectedRate.roomCategory}</h6>
                        </Accordion.Header>
                        <Accordion.Body className="p-4">
                          {room.guests.map((guest, gi) => {
                            const k = `room_${roomIndex}_guest_${gi}`;
                            return (
                              <Row key={gi} className="align-items-center g-2 mb-2">
                                <Col md={2}>
                                  <span className="fw-semibold text-muted">
                                    {guest.isChild
                                      ? `Child ${gi - room.adults + 1}`
                                      : `Adult ${gi + 1}`} *
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
                                  <Form.Control placeholder="Last Name"
                                                isInvalid={!!validationErrors[`${k}_lastName`]}
                                                value={guest.lastName}
                                                onChange={(e) => handleGuestChange(roomIndex, gi, "lastName", e.target.value)} />
                                </Col>
                                <Col md={2}>
                                  <Form.Select isInvalid={!!validationErrors[`${k}_gender`]}
                                               value={guest.gender}
                                               onChange={(e) => handleGuestChange(roomIndex, gi, "gender", e.target.value)}>
                                    <option value="">Gender</option>
                                    <option value="MALE">Male</option>
                                    <option value="FEMALE">Female</option>
                                  </Form.Select>
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

              {/* Primary Guest */}
              <Card className="p-4 mb-3 shadow-sm border-0">
                <h6 className="mb-3 fw-bold text-primary">Primary Guest Details</h6>
                <Row className="g-2">
                  <Col md={2}>
                    <Form.Label>Salutation *</Form.Label>
                    <Form.Select isInvalid={!!validationErrors.salutation}
                                 value={primaryGuest.salutation}
                                 onChange={(e) => handlePrimaryGuestChange("salutation", e.target.value)}>
                      <option value="">Select</option>
                      <option>Mr</option><option>Mrs</option><option>Ms</option><option>Dr</option>
                    </Form.Select>
                  </Col>
                  <Col md={3}>
                    <Form.Label>First Name *</Form.Label>
                    <Form.Control isInvalid={!!validationErrors.firstName}
                                  value={primaryGuest.firstName}
                                  onChange={(e) => handlePrimaryGuestChange("firstName", e.target.value)} />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Last Name *</Form.Label>
                    <Form.Control isInvalid={!!validationErrors.lastName}
                                  value={primaryGuest.lastName}
                                  onChange={(e) => handlePrimaryGuestChange("lastName", e.target.value)} />
                  </Col>
                  <Col md={4}>
                    <Form.Label>Email *</Form.Label>
                    <Form.Control type="email" isInvalid={!!validationErrors.email}
                                  value={primaryGuest.email}
                                  onChange={(e) => handlePrimaryGuestChange("email", e.target.value)} />
                    {validationErrors.email && <small className="text-danger">{validationErrors.email}</small>}
                  </Col>
                  <Col md={3}>
                    <Form.Label>Phone *</Form.Label>
                    <Form.Control isInvalid={!!validationErrors.phone}
                                  value={primaryGuest.phone}
                                  onChange={(e) => handlePrimaryGuestChange("phone", e.target.value)} />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Passport No</Form.Label>
                    <Form.Control value={primaryGuest.passportNo}
                                  onChange={(e) => handlePrimaryGuestChange("passportNo", e.target.value)} />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Agent LPO *</Form.Label>
                    <Form.Control isInvalid={!!validationErrors.agentLpo}
                                  value={primaryGuest.agentLpo}
                                  onChange={(e) => handlePrimaryGuestChange("agentLpo", e.target.value)} />
                  </Col>
                </Row>
              </Card>

              {/* Special requests + remarks */}
              <Card className="p-4 mb-3 shadow-sm border-0">
                <h6 className="mb-3 fw-bold text-primary">Special Requests & Remarks</h6>
                <div className="mb-3 d-flex flex-wrap gap-2">
                  {SPECIAL_REQUEST_OPTIONS.map((req) => (
                    <Form.Check key={req} type="checkbox" id={`sr-${req}`} label={req}
                                checked={specialRequests.includes(req)}
                                onChange={() => toggleSpecialRequest(req)} />
                  ))}
                </div>
                <Form.Label>Remarks</Form.Label>
                <Form.Control as="textarea" rows={2} value={remarks}
                              onChange={(e) => setRemarks(e.target.value)} />
              </Card>

              {/* Booking Done By */}
              <Card className="p-4 mb-4 shadow-sm border-0 bg-light">
                <h6 className="mb-3 fw-bold text-primary d-flex align-items-center">
                  <FaUserTie className="me-2" /> Booking Done By
                </h6>
                <Row>
                  <Col md={4}>
                    <Form.Label>Employee</Form.Label>
                    <Form.Select value={bookingDoneByEmployeeId}
                                 onChange={(e) => setBookingDoneByEmployeeId(e.target.value)}>
                      <option value="">Select Employee</option>
                      {employees.map((emp) => (
                        <option key={emp.employeeId} value={emp.employeeId}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                </Row>
              </Card>

              {/* Action bar */}
              <div className="d-flex justify-content-end gap-2 mt-4">
                <div className="d-flex align-items-center me-2 fw-bold text-danger">
                  New Total: {formatPrice(totalAfter)}
                </div>
                <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
                <Button variant="primary" type="submit"
                        disabled={!isStudentInfoReady()}
                        title={!isStudentInfoReady() ? "Complete student verification first" : ""}>
                  Confirm Booking
                </Button>
              </div>

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
          </Container>
        </main>
      </div>
    </div>
  );
}
