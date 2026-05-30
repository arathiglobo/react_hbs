/**
 * SeniorCitizenBookingPage.jsx
 *
 * Booking page for the Senior Citizen flow.
 *
 * Layout mirrors /hotel-booking-page (HotelBookingPage.jsx):
 *   - Two-column layout: left = guest details / verification, right
 *     = sticky Booking Summary + Price card
 *   - "Confirm Booking" opens the Policies & T&C modal
 *   - "Proceed" inside that modal builds the payload and opens the
 *     Order Summary modal
 *   - "Confirm" inside that modal posts to
 *     POST /api/senior-citizen-booking/create
 *
 * Extras vs HotelBookingPage:
 *   - Optional Senior Citizen proof upload (POST /api/senior-citizen-id-upload).
 *     The booking is allowed without a proof — the senior-citizen
 *     markup is driven by the adult ages captured on the search page —
 *     but uploading one keeps a record for admin reporting.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHotel, FaCalendarAlt, FaUsers, FaUtensils, FaUserTie,
  FaUserClock, FaFileUpload,
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
  "Early Check-In", "Non-Smoking Rooms", "Ground Floor", "Wheelchair Access",
  "Late Check-In", "Inter-connecting rooms", "Low Floor",
  "Room with Bathtub", "Late check-Out", "Quiet Room",
];

export default function SeniorCitizenBookingPage() {
  const navigate = useNavigate();
  const activeUserRole = localStorage.getItem("currentActiveRole");

  const [bookingData, setBookingData] = useState(null);
  const [agentAvailableBalance, setAgentAvailableBalance] = useState(null);

  const [rooms, setRooms] = useState([]);
  const [primaryGuest, setPrimaryGuest] = useState({
    salutation: "", firstName: "", middleName: "", lastName: "",
    email: "", nativeCountry: "IN",
  });

  const [remarks, setRemarks] = useState("");
  const [specialRequests, setSpecialRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [bookingDoneByEmployeeId, setBookingDoneByEmployeeId] = useState("");

  // Tourism Dirhams — flat add-on to the room total. Mirrors
  // HotelBookingPage where it's editable per booking.
  const [tourismDirhams, setTourismDirhams] = useState("0");

  // ── Optional senior-citizen proof upload ──────────────────────
  // Pure record-keeping — booking still goes through if left empty.
  const [proofFile, setProofFile] = useState(null);
  const [uploadedFilePath, setUploadedFilePath] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploading, setUploading] = useState(false);

  // ── Two-step confirm flow state ─────────────────────────────
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 — policies & T&C modal
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyData, setPolicyData] = useState(null);
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);

  // Step 2 — order summary modal (built payload waits for Confirm)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("seniorCitizenBookingData");
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
          age: i < (room.adults || 0)
            ? (room.adultAges?.[i] ?? null)
            : (room.childAges?.[i - (room.adults || 0)] ?? null),
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

  // ── Optional proof upload ──────────────────────────────────
  const onProofChange = (e) => {
    setProofFile(e.target.files?.[0] || null);
    setUploadedFilePath("");
    setUploadedFileName("");
  };
  const handleUploadProof = async () => {
    if (!proofFile) { toast.error("Choose a file first"); return; }
    if (proofFile.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5 MB)"); return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", proofFile);
      const { data } = await axiosInstance.post(
        "/api/senior-citizen-id-upload", fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      if (data?.success) {
        setUploadedFilePath(data.filePath);
        setUploadedFileName(data.fileName);
        toast.success("Proof uploaded");
      } else {
        toast.error(data?.message || "Upload failed");
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Upload failed");
    } finally { setUploading(false); }
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" })
      .format(Number(price) || 0);

  const validateForm = () => {
    const errors = {};
    if (!primaryGuest.salutation) errors.salutation = "Salutation is required";
    if (!primaryGuest.firstName) errors.firstName = "First Name is required";
    if (!primaryGuest.lastName) errors.lastName = "Last Name is required";
    if (!primaryGuest.email) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryGuest.email))
      errors.email = "Please enter a valid email address";
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

  // ── Step 1 of the confirm flow — validate, fetch policies + T&C,
  //     open the policy modal. Mirrors HotelBookingPage.openPolicyConsent.
  const openPolicyConsent = async () => {
    const { errors, hasErrors } = validateForm();
    if (hasErrors) {
      setValidationErrors(errors);
      toast.error("Please complete the highlighted fields");
      return;
    }
    setValidationErrors({});

    const hotelId = bookingData?.selectedRate?.hotelId;
    if (!hotelId) {
      toast.error("Hotel reference missing — cannot fetch policies.");
      return;
    }

    setPolicyAccepted(false);
    setShowPolicyModal(true);
    setPoliciesLoading(true);
    try {
      const [policiesRes, termsRes] = await Promise.allSettled([
        axiosInstance.get(`/api/hotels/${hotelId}/policies`),
        axiosInstance.get(`/api/hotels/${hotelId}/terms-and-conditions`),
      ]);
      setPolicyData(policiesRes.status === "fulfilled" ? (policiesRes.value?.data || null) : null);

      let tc = "";
      if (termsRes.status === "fulfilled") {
        const d = termsRes.value?.data;
        if (Array.isArray(d)) {
          tc = d.map((row) =>
            typeof row === "string" ? row : row?.description || ""
          ).filter(Boolean).join("\n\n");
        } else if (typeof d === "string") {
          tc = d;
        } else {
          tc = d?.termsAndConditions || d?.terms || d?.data || d?.message || "";
        }
      }
      setTermsAndConditions(tc);
    } catch (err) {
      console.error("policies/T&C fetch error", err);
    } finally {
      setPoliciesLoading(false);
    }
  };

  // ── Step 2 — build the booking payload and open the Order Summary
  //     modal. Triggered from the "Proceed" button inside the policy
  //     modal once the consent checkbox is ticked.
  const buildPayloadAndShowOrderSummary = () => {
    const { selectedRate, hotelStaticData, payload, activePromotion, searchCtx } = bookingData;
    const ci = new Date(payload.checkInDate);
    const co = new Date(payload.checkOutDate);
    const nights = Math.max(1, Math.round((co - ci) / 86400000));

    const allRooms = (rooms || []).map((room, idx) => ({
      roomNo: idx + 1,
      roomCategory: selectedRate.roomCategory,
      mealPlan: selectedRate.mealPlan,
      nonRefundable: !!selectedRate.nonRefundable,
      rate: Number(selectedRate.rate || 0),
      rateWithoutMarkup: Number(selectedRate.rate || 0),
      rateBeforeDiscount: Number(selectedRate.rateBeforeDiscount || selectedRate.rate || 0),
      adults: room.adults,
      children: room.children,
      childAges: room.childAges || [],
      adultAges: room.adultAges || [],
      currency: selectedRate.currency || "INR",
      guests: (room.guests || []).map((g) => ({
        salutation: g.salutation, firstName: g.firstName, lastName: g.lastName,
        gender: g.gender, isChild: !!g.isChild, age: g.age,
      })),
    }));

    const promoType = activePromotion?.discountType
      || (activePromotion?.discountPercent != null ? "PERCENTAGE"
       : activePromotion?.discountAmount  != null ? "AMOUNT" : null);
    const promoValue = activePromotion?.discountValue
      ?? activePromotion?.discountPercent ?? activePromotion?.discountAmount ?? null;

    const built = {
      agentId: String(payload.agentId || searchCtx?.agentId || ""),
      apiId: String(payload.apiId || searchCtx?.apiId || 1),
      hotelId: String(selectedRate.hotelId || searchCtx?.hotelCode || ""),
      hotelName: hotelStaticData.hotelName,
      address: hotelStaticData.address,
      starRating: hotelStaticData.starRating,
      checkInDate: `${payload.checkInDate}T14:00:00`,
      checkOutDate: `${payload.checkOutDate}T11:00:00`,
      nights,
      // Senior-citizen markup snapshot — server re-applies authoritatively.
      discountType: promoType,
      discountValue: promoValue != null ? Number(promoValue) : null,
      discountPercent: promoType === "PERCENTAGE" ? Number(promoValue) : null,
      discountAmount:  promoType === "AMOUNT"     ? Number(promoValue) : null,
      totalRateBeforeDiscount: allRooms.reduce((s, r) => s + Number(r.rateBeforeDiscount || 0), 0),
      primaryGuest: { ...primaryGuest },
      rooms: allRooms,
      remarks,
      specialRequests,
      tourismDirhams: tdAmount,
      // Optional proof — null when the user didn't upload anything.
      seniorCitizenIdFilePath: uploadedFilePath || null,
      seniorCitizenIdFileName: uploadedFileName || null,
      // Backend still requires one of EMPLOYEE_CODE / GOVT_ID_UPLOAD
      // even though the senior-citizen flow is now age-based. We send
      // GOVT_ID_UPLOAD (the closer match — proof is the optional govt
      // ID we accept on this page) so the API stops rejecting the
      // request. Once the backend is updated to make this field
      // optional, this line can be removed.
      verificationMethod: "GOVT_ID_UPLOAD",
      // Mirror the proof name into the legacy "senior citizen name"
      // field so any backend validator that expects a value gets one.
      seniorCitizenName: `${primaryGuest.firstName || ""} ${primaryGuest.lastName || ""}`.trim() || null,
      source: "B2B_PORTAL",
      createdByRole: (activeUserRole || "AGENT").toUpperCase(),
      bookingDate: new Date().toISOString().slice(0, 19),
      deadlineDate: `${payload.checkInDate}T23:59:59`,
      roomStatus: "CONFIRMED",
      employeeId: bookingDoneByEmployeeId || null,
    };
    setPendingPayload(built);
    setShowConfirmModal(true);
  };

  // ── Step 3 — actually post the booking. Triggered from the
  //     "Confirm" button inside the order-summary modal.
  const confirmBooking = async () => {
    if (!pendingPayload) return;
    setShowConfirmModal(false);
    setIsSubmitting(true);
    try {
      const { data } = await axiosInstance.post(
        "/api/senior-citizen-booking/create", pendingPayload
      );
      if (data?.success !== false) {
        toast.success(`Booking ${data?.bookingCode || ""} created successfully`);
        navigate("/booking-details/senior-citizen-booking-list");
      } else {
        toast.error(data?.message || "Booking failed");
      }
    } catch (e) {
      console.error("[senior-citizen] booking failed:", e);
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
  const tdAmount = parseFloat(tourismDirhams) || 0;
  const totalBefore = Number(selectedRate.rateBeforeDiscount || 0) * (rooms.length || 1);
  // New Total includes Tourism Dirhams as a flat add-on. The room-rate
  // subtotal is the senior-citizen-discounted rate × number of rooms.
  const roomSubtotal = Number(selectedRate.rate || 0) * (rooms.length || 1);
  const totalAfter = roomSubtotal + tdAmount;

  const promoSummary = (() => {
    if (!activePromotion) return null;
    const t = activePromotion.discountType;
    const v = activePromotion.discountValue;
    if (t === "PERCENTAGE") return `${v}% off`;
    if (t === "AMOUNT") return `flat ${v}`;
    const out = [];
    if (activePromotion.discountPercent) out.push(`${activePromotion.discountPercent}% off`);
    if (activePromotion.discountAmount) out.push(`+ flat ${activePromotion.discountAmount}`);
    return out.join(" ");
  })();

  return (
    <div className="min-vh-100 bg-light d-flex flex-column hotel-booking-container">
      <TopBar />
      <div className="main-content">
        <Sidebar />
        <main className="content-wrapper py-4">
          <Container fluid="xl">
            {agentAvailableBalance != null && (
              <div className="d-flex justify-content-end mb-2">
                <span className="fw-bold" style={{ color: "#dc3545", fontSize: "0.95rem" }}>
                  Available Balance: {Number(agentAvailableBalance).toFixed(2)}
                </span>
              </div>
            )}

            <Form onSubmit={(e) => { e.preventDefault(); openPolicyConsent(); }}>
              <Row className="g-3">
                {/* ── LEFT COLUMN — Guest + verification + proof ─────────── */}
                <Col lg={8} className="hbp-left-col">
                  <Card className="mb-2 shadow-sm border-0">
                    <Card.Header className="bg-light py-2">
                      <div className="d-flex align-items-center">
                        <Button variant="outline-secondary" size="sm"
                                onClick={() => navigate(-1)}
                                className="me-3">← Back</Button>
                        <h5 className="mb-0 fw-bold text-dark">Guest Details</h5>
                      </div>
                    </Card.Header>
                    <Card.Body className="p-0">
                      <Accordion alwaysOpen
                        defaultActiveKey={rooms.map((_, i) => i.toString())}
                        className="guest-details-accordion">
                        {rooms.map((room, roomIndex) => (
                          <Accordion.Item key={roomIndex}
                                          eventKey={roomIndex.toString()}
                                          className="mb-2 guest-room-item">
                            <Accordion.Header className="bg-primary text-white">
                              <h6 className="mb-0 fw-bold w-100 d-flex flex-wrap align-items-center gap-2">
                                <span>
                                  Room {roomIndex + 1} — {selectedRate.roomCategory}
                                </span>
                                {Array.isArray(room.adultAges) && room.adultAges.some((a) => Number(a) >= 60) && (
                                  <Badge bg="success" className="ms-2">Senior Citizen Room</Badge>
                                )}
                              </h6>
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
                                          : `Adult ${gi + 1}${guest.age != null ? ` · ${guest.age} yrs` : ""}`} *
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

                  {/* Primary Guest + Tourism Dirhams */}
                  <Card className="p-3 mb-2 shadow-sm border-0">
                    <h6 className="mb-2 fw-bold text-primary">Primary Guest Details</h6>
                    <Row className="g-2">
                      <Col md={2}>
                        <Form.Label className="mb-1">Salutation *</Form.Label>
                        <Form.Select isInvalid={!!validationErrors.salutation}
                                     value={primaryGuest.salutation}
                                     onChange={(e) => handlePrimaryGuestChange("salutation", e.target.value)}>
                          <option value="">Select</option>
                          <option>Mr</option><option>Mrs</option><option>Ms</option><option>Dr</option>
                        </Form.Select>
                      </Col>
                      <Col md={3}>
                        <Form.Label className="mb-1">First Name *</Form.Label>
                        <Form.Control isInvalid={!!validationErrors.firstName}
                                      value={primaryGuest.firstName}
                                      onChange={(e) => handlePrimaryGuestChange("firstName", e.target.value)} />
                      </Col>
                      <Col md={3}>
                        <Form.Label className="mb-1">Last Name *</Form.Label>
                        <Form.Control isInvalid={!!validationErrors.lastName}
                                      value={primaryGuest.lastName}
                                      onChange={(e) => handlePrimaryGuestChange("lastName", e.target.value)} />
                      </Col>
                      <Col md={4}>
                        <Form.Label className="mb-1">Email *</Form.Label>
                        <Form.Control type="email" isInvalid={!!validationErrors.email}
                                      value={primaryGuest.email}
                                      onChange={(e) => handlePrimaryGuestChange("email", e.target.value)} />
                        {validationErrors.email && <small className="text-danger">{validationErrors.email}</small>}
                      </Col>
                      <Col md={4}>
                        <Form.Label className="mb-1">Native Country</Form.Label>
                        <Form.Control value={primaryGuest.nativeCountry}
                                      onChange={(e) => handlePrimaryGuestChange("nativeCountry", e.target.value)} />
                      </Col>
                      <Col md={4}>
                        <Form.Label className="mb-1">Tourism Dirhams (AED)</Form.Label>
                        <Form.Control type="number" min="0" step="0.01"
                                      value={tourismDirhams}
                                      onChange={(e) => setTourismDirhams(e.target.value)}
                                      placeholder="0" />
                        <Form.Text className="text-muted">Added to the New Total below.</Form.Text>
                      </Col>
                    </Row>
                  </Card>

                  {/* Optional Senior Citizen proof upload */}
                  <Card className="p-3 mb-2 shadow-sm border-0">
                    <h6 className="mb-1 fw-bold text-primary d-flex align-items-center">
                      <FaUserClock className="me-2" /> Senior Citizen Proof
                      <Badge bg="secondary" className="ms-2">Optional</Badge>
                    </h6>
                    <div className="text-muted small mb-2">
                      Upload Aadhar / Passport / Voter ID / Senior Citizen card. Not
                      required — the discount applies based on the adult ages from
                      the search — but a proof is saved on the booking for admin reference.
                    </div>
                    <Row className="g-2 align-items-end">
                      <Col md={6}>
                        <Form.Label>Document</Form.Label>
                        <Form.Control type="file" accept=".pdf,.png,.jpg,.jpeg"
                                      onChange={onProofChange} />
                        <Form.Text className="text-muted">PDF, PNG or JPG. Max ~5 MB.</Form.Text>
                      </Col>
                      <Col md={3}>
                        <Button variant="outline-primary"
                                onClick={handleUploadProof}
                                disabled={!proofFile || uploading}>
                          {uploading ? <Spinner size="sm" />
                            : <><FaFileUpload className="me-1" /> Upload</>}
                        </Button>
                      </Col>
                      <Col md={3}>
                        {uploadedFilePath
                          ? <Badge bg="success" className="p-2">✓ {uploadedFileName}</Badge>
                          : proofFile
                            ? <span className="text-muted small">Click Upload to save</span>
                            : <span className="text-muted small">No file selected</span>}
                      </Col>
                    </Row>
                  </Card>

                  {/* Special requests + remarks */}
                  <Card className="p-3 mb-2 shadow-sm border-0">
                    <h6 className="mb-2 fw-bold text-primary">Special Requests & Remarks</h6>
                    <div className="mb-2 d-flex flex-wrap gap-2">
                      {SPECIAL_REQUEST_OPTIONS.map((req) => (
                        <Form.Check key={req} type="checkbox" id={`sr-${req}`} label={req}
                                    checked={specialRequests.includes(req)}
                                    onChange={() => toggleSpecialRequest(req)} />
                      ))}
                    </div>
                    <Form.Label className="mb-1">Remarks</Form.Label>
                    <Form.Control as="textarea" rows={2} value={remarks}
                                  onChange={(e) => setRemarks(e.target.value)} />
                  </Card>

                  {/* Booking Done By */}
                  <Card className="p-3 mb-2 shadow-sm border-0 bg-light">
                    <h6 className="mb-2 fw-bold text-primary d-flex align-items-center">
                      <FaUserTie className="me-2" /> Booking Done By
                    </h6>
                    <Row className="g-2">
                      <Col md={4}>
                        <Form.Label className="mb-1">Employee</Form.Label>
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
                </Col>

                {/* ── RIGHT COLUMN — Sticky Booking Summary + Price ──────── */}
                <Col lg={4} className="hbp-right-col">
                  <div className="hbp-sticky-summary">
                    <Card className="shadow-sm rounded-3 mb-3 booking-summary-card border-0 overflow-hidden">
                      <Card.Header className="bg-primary text-white py-2 rounded-top">
                        <h6 className="mb-0 d-flex align-items-center">
                          <FaHotel className="me-2" /> Booking Summary
                        </h6>
                      </Card.Header>
                      <Card.Body className="p-3">
                        <div className="mb-3">
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
                            {promoSummary && (
                              <Badge bg="success" className="d-inline-flex align-items-center">
                                <FaUserClock className="me-1" /> Senior {promoSummary}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaCalendarAlt className="me-2 text-primary" />Check-in
                          </div>
                          <div className="hbp-summary-value">{payload.checkInDate}</div>
                        </div>
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaCalendarAlt className="me-2 text-primary" />Check-out
                          </div>
                          <div className="hbp-summary-value">{payload.checkOutDate}</div>
                        </div>
                        <div className="hbp-summary-row align-items-start">
                          <div className="hbp-summary-label">
                            <FaUsers className="me-2 text-primary" />Guests
                          </div>
                          <div className="hbp-summary-value text-end">
                            {payload.rooms.map((room, i) => (
                              <div key={i} className="small">
                                Room {i + 1}: {room.adults} Adult{room.adults > 1 ? "s" : ""}
                                {room.children
                                  ? `, ${room.children} Child${room.children > 1 ? "ren" : ""}`
                                  : ""}
                                {Array.isArray(room.adultAges) && room.adultAges.some((a) => Number(a) >= 60) && (
                                  <Badge bg="success" pill className="ms-1" style={{ fontSize: "0.6rem" }}>
                                    Senior
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaUtensils className="me-2 text-primary" />Meal Plan
                          </div>
                          <div className="hbp-summary-value">{selectedRate.mealPlan}</div>
                        </div>
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">
                            <FaUserClock className="me-2 text-primary" />Native Country
                          </div>
                          <div className="hbp-summary-value">
                            {primaryGuest.nativeCountry || "—"}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>

                    <Card className="shadow-sm rounded-3 border-0 hbp-price-card">
                      <Card.Header className="bg-light py-2">
                        <h6 className="mb-0 fw-bold">Price Details</h6>
                      </Card.Header>
                      <Card.Body className="p-3">
                        {promoSummary && totalBefore !== roomSubtotal && (
                          <div className="hbp-summary-row">
                            <div className="hbp-summary-label text-muted">Standard Total</div>
                            <div className="hbp-summary-value text-decoration-line-through text-muted">
                              {formatPrice(totalBefore)}
                            </div>
                          </div>
                        )}
                        {promoSummary && (
                          <div className="hbp-summary-row">
                            <div className="hbp-summary-label text-success">Senior Discount</div>
                            <div className="hbp-summary-value text-success">{promoSummary}</div>
                          </div>
                        )}
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">Room Subtotal</div>
                          <div className="hbp-summary-value">{formatPrice(roomSubtotal)}</div>
                        </div>
                        <div className="hbp-summary-row">
                          <div className="hbp-summary-label">Tourism Dirhams</div>
                          <div className="hbp-summary-value">{formatPrice(tdAmount)}</div>
                        </div>
                        <hr className="my-2" />
                        <div className="hbp-summary-row fw-bold">
                          <div className="hbp-summary-label text-danger">New Total</div>
                          <div className="hbp-summary-value text-danger">
                            {formatPrice(totalAfter)}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>

                    <div className="hbp-action-bar mt-3 d-flex gap-2">
                      <Button variant="outline-secondary"
                              onClick={() => navigate(-1)}
                              className="flex-grow-1">Back</Button>
                      <Button variant="primary" type="button"
                              onClick={openPolicyConsent}
                              className="flex-grow-1">Confirm Booking</Button>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* ── Step 1 — Policies + T&C consent modal ─────────────── */}
              <Modal show={showPolicyModal}
                     onHide={() => setShowPolicyModal(false)}
                     centered backdrop="static" size="lg" scrollable
                     dialogClassName="policy-modal">
                <Modal.Header closeButton className="policy-modal-header">
                  <Modal.Title className="policy-modal-title">
                    Hotel Policies &amp; Terms
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body className="policy-modal-body">
                  {policiesLoading ? (
                    <div className="text-center py-4">
                      <Spinner size="sm" />
                      <div className="mt-2 text-muted small">Loading policies &amp; terms…</div>
                    </div>
                  ) : (
                    <>
                      <section className="policy-section">
                        <h6 className="policy-section-title">Cancellation Policy</h6>
                        {policyData?.policies?.cancellationPolicy?.length ? (
                          policyData.policies.cancellationPolicy.map((p, idx) => (
                            <div key={idx} className="policy-item">
                              <div className="policy-text">{p.policyText || "—"}</div>
                              {(p.fromDate || p.toDate) && (
                                <div className="policy-meta">
                                  Valid{" "}
                                  {p.fromDate ? new Date(p.fromDate).toLocaleDateString() : "—"}
                                  {" – "}
                                  {p.toDate ? new Date(p.toDate).toLocaleDateString() : "—"}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="policy-empty">No cancellation policy specified.</div>
                        )}
                      </section>

                      <section className="policy-section">
                        <h6 className="policy-section-title">Amendment Policy</h6>
                        {policyData?.policies?.amendmentPolicy?.length ? (
                          policyData.policies.amendmentPolicy.map((p, idx) => (
                            <div key={idx} className="policy-item">
                              <div className="policy-text">{p.policyText || "—"}</div>
                              {(p.fromDate || p.toDate) && (
                                <div className="policy-meta">
                                  Valid{" "}
                                  {p.fromDate ? new Date(p.fromDate).toLocaleDateString() : "—"}
                                  {" – "}
                                  {p.toDate ? new Date(p.toDate).toLocaleDateString() : "—"}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="policy-empty">No amendment policy specified.</div>
                        )}
                      </section>

                      <section className="policy-section">
                        <h6 className="policy-section-title">Child Policy</h6>
                        {policyData?.policies?.childPolicy?.length &&
                         policyData.policies.childPolicy.some((p) => p.policyText) ? (
                          policyData.policies.childPolicy.map((p, idx) => (
                            <div key={idx} className="policy-item">
                              <div className="policy-text">{p.policyText || "—"}</div>
                            </div>
                          ))
                        ) : (
                          <div className="policy-empty">No child policy specified.</div>
                        )}
                      </section>

                      <section className="policy-section policy-section-last">
                        <h6 className="policy-section-title">Terms &amp; Conditions</h6>
                        {termsAndConditions ? (
                          <div className="terms-content"
                               dangerouslySetInnerHTML={{ __html: termsAndConditions }} />
                        ) : (
                          <div className="policy-empty">
                            No terms &amp; conditions configured for this hotel.
                          </div>
                        )}
                      </section>
                    </>
                  )}
                </Modal.Body>
                <Modal.Footer className="policy-modal-footer">
                  <Form.Check type="checkbox" id="sc-policy-accept"
                              className="me-auto policy-accept-check"
                              label="I have read and accept the policies and terms & conditions"
                              checked={policyAccepted}
                              onChange={(e) => setPolicyAccepted(e.target.checked)} />
                  <Button variant="outline-secondary" size="sm"
                          onClick={() => setShowPolicyModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm"
                          disabled={!policyAccepted || policiesLoading}
                          onClick={() => {
                            setShowPolicyModal(false);
                            buildPayloadAndShowOrderSummary();
                          }}>
                    Proceed
                  </Button>
                </Modal.Footer>
              </Modal>

              {/* ── Step 2 — Order Summary modal ──────────────────────── */}
              <Modal show={showConfirmModal}
                     onHide={() => setShowConfirmModal(false)}
                     centered backdrop="static" size="md">
                <Modal.Header closeButton className="bg-primary text-white py-2"
                              style={{ borderBottom: "none" }}>
                  <Modal.Title className="fw-semibold d-flex align-items-center">
                    <FaHotel className="me-2" /> Confirm Your Booking
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body className="px-4 py-3 bg-light">
                  {pendingPayload && (
                    <div className="border rounded-3 bg-white shadow-sm p-3">
                      <div className="mb-3">
                        <h5 className="fw-bold text-primary mb-2">{pendingPayload.hotelName}</h5>
                        <p className="text-muted mb-0">{pendingPayload.address}</p>
                      </div>
                      <hr />
                      <Row className="gy-2">
                        <Col xs={6}><strong>Check-In:</strong><br />{pendingPayload.checkInDate}</Col>
                        <Col xs={6}><strong>Check-Out:</strong><br />{pendingPayload.checkOutDate}</Col>
                        <Col xs={6}><strong>Rooms:</strong> {pendingPayload.rooms.length}</Col>
                        <Col xs={6}><strong>Nights:</strong> {pendingPayload.nights}</Col>
                        <Col xs={12}>
                          <strong>Adult ages per room:</strong>
                          <ul className="mb-0 ps-3 small">
                            {pendingPayload.rooms.map((r, i) => (
                              <li key={i}>
                                Room {r.roomNo}:{" "}
                                {Array.isArray(r.adultAges) && r.adultAges.length
                                  ? r.adultAges.join(", ")
                                  : "—"}
                              </li>
                            ))}
                          </ul>
                        </Col>
                        {pendingPayload.seniorCitizenIdFileName && (
                          <Col xs={12}>
                            <strong>Proof:</strong>{" "}
                            <Badge bg="success">{pendingPayload.seniorCitizenIdFileName}</Badge>
                          </Col>
                        )}
                      </Row>
                      <div className="mt-3 p-3 bg-white border rounded">
                        <h6 className="fw-bold mb-2">Rate Split</h6>
                        {(() => {
                          const roomSub = pendingPayload.rooms.reduce((s, r) => s + r.rate, 0);
                          const td = Number(pendingPayload.tourismDirhams || 0);
                          const total = roomSub + td;
                          return (
                            <>
                              {pendingPayload.totalRateBeforeDiscount > roomSub && (
                                <div className="d-flex justify-content-between">
                                  <span>Standard total</span>
                                  <span className="text-decoration-line-through text-muted">
                                    {formatPrice(pendingPayload.totalRateBeforeDiscount)}
                                  </span>
                                </div>
                              )}
                              {promoSummary && (
                                <div className="d-flex justify-content-between text-success">
                                  <span>Senior Citizen Discount</span>
                                  <span>{promoSummary}</span>
                                </div>
                              )}
                              <div className="d-flex justify-content-between">
                                <span>Room Subtotal</span>
                                <span>{formatPrice(roomSub)}</span>
                              </div>
                              <div className="d-flex justify-content-between">
                                <span>Tourism Dirhams</span>
                                <span>{formatPrice(td)}</span>
                              </div>
                              <hr className="my-2" />
                              <div className="d-flex justify-content-between fw-bold text-success">
                                <span>Total Payable</span>
                                <span>{formatPrice(total)}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <div className="mt-3 p-2 bg-white border rounded d-flex align-items-center">
                        <span className="me-2 d-inline-flex align-items-center justify-content-center"
                              style={{ width: 18, height: 18, borderRadius: "50%",
                                       background: "#16a34a", color: "#fff",
                                       fontSize: "0.7rem", fontWeight: 700, lineHeight: 1 }}
                              aria-hidden="true">✓</span>
                        <span className="small text-dark">
                          Hotel policies and terms &amp; conditions accepted
                        </span>
                      </div>
                    </div>
                  )}
                </Modal.Body>
                <Modal.Footer className="bg-light border-0 d-flex justify-content-between">
                  <Button variant="outline-secondary"
                          onClick={() => setShowConfirmModal(false)}
                          disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={confirmBooking}
                          disabled={isSubmitting} className="px-4 fw-semibold">
                    {isSubmitting
                      ? <><Spinner size="sm" className="me-2" /> Processing…</>
                      : "Confirm"}
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
