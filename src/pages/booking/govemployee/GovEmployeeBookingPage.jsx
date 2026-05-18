/**
 * GovEmployeeBookingPage.jsx
 *
 * Booking page for the gov-employee flow.
 *
 * Layout / look-and-feel mirrors /hotel-booking-page
 * (pages/booking/HotelBookingPage.jsx) — same Booking Summary card
 * at the top, per-room guest accordion, primary guest section,
 * remarks / special requests block, "Booking Done By" footer,
 * Confirm Booking button + confirmation modal showing the booking
 * summary again.
 *
 * Differences from the normal flow:
 *   1) Adds a "Government Employee Verification" block with two
 *      options (radio toggle):
 *         ◯ Employee Code  → text input
 *         ◯ Government ID Upload → file picker (uploads to
 *           /api/gov-employee-id-upload first, then submits the
 *           returned path with the booking).
 *   2) Shows both standard (struck-through) and discounted prices
 *      everywhere the rate appears, including the modal.
 *   3) Posts to /api/gov-employee-booking/create — the server
 *      re-applies the discount authoritatively, checks the agent
 *      credit limit and decrements it.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHotel,
  FaCalendarAlt,
  FaUsers,
  FaUtensils,
  FaUserTie,
  FaIdBadge,
  FaFileUpload,
} from "react-icons/fa";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Accordion,
  Badge,
  Modal,
  Spinner,
} from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import toast from "react-hot-toast";
import "../../../styles/HotelBookingPage.css";

const SPECIAL_REQUEST_OPTIONS = [
  "Early Check-In",
  "Non-Smoking Rooms",
  "High Floor",
  "VIP Client",
  "Late Check-In",
  "Inter-connecting rooms",
  "Low Floor",
  "Room with Bathtub",
  "Late check-Out",
  "Smoking Room",
];

const METHOD_CODE = "EMPLOYEE_CODE";
const METHOD_UPLOAD = "GOVT_ID_UPLOAD";

const GovEmployeeBookingPage = () => {
  const navigate = useNavigate();
  const activeUserRole = localStorage.getItem("currentActiveRole");

  // ── State pulled from sessionStorage (set by GovEmployeeRoomList) ─
  const [bookingData, setBookingData] = useState(null);
  const [agentAvailableBalance, setAgentAvailableBalance] = useState(null);

  // ── Per-room guest details (one row per adult / child) ──────────
  const [rooms, setRooms] = useState([]);

  // ── Primary guest details ───────────────────────────────────────
  const [primaryGuest, setPrimaryGuest] = useState({
    salutation: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    passportNo: "",
    agentLpo: "",
  });

  // Remarks + special requests + employee that books
  const [remarks, setRemarks] = useState("");
  const [specialRequests, setSpecialRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [bookingDoneByEmployeeId, setBookingDoneByEmployeeId] = useState("");

  // ── Government employee verification block ──────────────────────
  const [verificationMethod, setVerificationMethod] = useState(METHOD_CODE);
  const [govEmployeeCode, setGovEmployeeCode] = useState("");
  const [govEmployeeName, setGovEmployeeName] = useState("");
  const [govEmployeeDepartment, setGovEmployeeDepartment] = useState("");
  const [idFile, setIdFile] = useState(null);
  const [uploadedFilePath, setUploadedFilePath] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploading, setUploading] = useState(false);

  // ── Submission state ────────────────────────────────────────────
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  // ── Load bookingData from sessionStorage ────────────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem("govEmployeeBookingData");
    if (!stored) return;
    const parsed = JSON.parse(stored);
    setBookingData(parsed);
    // Initial rooms structure — one guest per adult + child, matches HotelBookingPage.
    const payloadRooms = parsed?.payload?.rooms || [];
    setRooms(
      payloadRooms.map((room) => ({
        ...room,
        guests: Array.from(
          { length: (room.adults || 0) + (room.children || 0) },
          (_, i) => ({
            salutation: "",
            firstName: "",
            middleName: "",
            lastName: "",
            gender: "",
            isChild: i >= (room.adults || 0),
          })
        ),
      }))
    );
  }, []);

  // ── Employee list (for "Booking Done By") ───────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get("/api/employee?page=0&limit=1000");
        if (Array.isArray(res.data)) setEmployees(res.data);
      } catch (e) { /* silent */ }
    })();
  }, []);

  // ── Agent credit balance ───────────────────────────────────────
  useEffect(() => {
    const aId = bookingData?.payload?.agentId;
    if (!aId) { setAgentAvailableBalance(null); return; }
    let cancelled = false;
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${aId}`)
      .then((res) => {
        if (!cancelled) setAgentAvailableBalance(res?.data?.availableCreditLimit ?? null);
      })
      .catch(() => { if (!cancelled) setAgentAvailableBalance(null); });
    return () => { cancelled = true; };
  }, [bookingData]);

  // ── Guest input handlers (mirrors HotelBookingPage.jsx) ─────────
  const handleGuestChange = (roomIndex, guestIndex, field, value) => {
    setRooms((prev) => {
      const next = [...prev];
      next[roomIndex].guests[guestIndex][field] = value;
      return next;
    });
    // Auto-populate primary guest from Room 1 / Adult 1.
    if (roomIndex === 0 && guestIndex === 0 &&
        ["salutation", "firstName", "lastName"].includes(field)) {
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

  // ── File upload for govt-ID method ─────────────────────────────
  const onFileChange = (e) => {
    setIdFile(e.target.files?.[0] || null);
    setUploadedFilePath("");
    setUploadedFileName("");
  };
  const handleUpload = async () => {
    if (!idFile) { toast.error("Please choose a file first"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", idFile);
      const { data } = await axiosInstance.post("/api/gov-employee-id-upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data?.success) {
        setUploadedFilePath(data.filePath);
        setUploadedFileName(data.fileName);
        toast.success("Document uploaded");
      } else {
        toast.error(data?.message || "Upload failed");
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────
  const formatPrice = (price) =>
    new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" })
      .format(Number(price) || 0);

  const isVerificationReady =
    verificationMethod === METHOD_CODE
      ? govEmployeeCode.trim().length > 0
      : !!uploadedFilePath;

  // ── Validation (matches HotelBookingPage's required fields) ────
  const validateForm = () => {
    const errors = {};
    if (!primaryGuest.salutation) errors.salutation = "Salutation is required";
    if (!primaryGuest.firstName)  errors.firstName  = "First Name is required";
    if (!primaryGuest.lastName)   errors.lastName   = "Last Name is required";
    if (!primaryGuest.email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryGuest.email)) {
      errors.email = "Please enter a valid email address";
    }
    if (!primaryGuest.phone) errors.phone = "Phone is required";
    if (!primaryGuest.agentLpo) errors.agentLpo = "Agent LPO is required";

    rooms.forEach((room, ri) => {
      room.guests.forEach((g, gi) => {
        const k = `room_${ri}_guest_${gi}`;
        if (!g.salutation) errors[`${k}_salutation`] = "Required";
        if (!g.firstName)  errors[`${k}_firstName`]  = "Required";
        if (!g.lastName)   errors[`${k}_lastName`]   = "Required";
        if (!g.gender)     errors[`${k}_gender`]     = "Required";
      });
    });

    return { errors, hasErrors: Object.keys(errors).length > 0 };
  };

  // ── Build payload + open confirmation modal ────────────────────
  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!isVerificationReady) {
      toast.error(verificationMethod === METHOD_CODE
        ? "Enter the employee code" : "Upload the government ID document first");
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

    // Per-room rate breakdown — replicated for each room in the search
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
        salutation: g.salutation,
        firstName: g.firstName,
        lastName: g.lastName,
        gender: g.gender,
        isChild: !!g.isChild,
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
      // Verification
      verificationMethod,
      govEmployeeCode: verificationMethod === METHOD_CODE ? govEmployeeCode.trim() : null,
      govtIdFilePath: verificationMethod === METHOD_UPLOAD ? uploadedFilePath : null,
      govtIdFileName: verificationMethod === METHOD_UPLOAD ? uploadedFileName : null,
      govEmployeeName: govEmployeeName.trim() || null,
      govEmployeeDepartment: govEmployeeDepartment.trim() || null,
      // Discount snapshot (server re-resolves and re-applies)
      discountPercent: activePromotion?.discountPercent ?? null,
      discountAmount: activePromotion?.discountAmount ?? null,
      totalRateBeforeDiscount: allRooms.reduce((s, r) => s + Number(r.rateBeforeDiscount || 0), 0),
      // Employee who is doing the booking (separate from gov employee)
      employeeId: bookingDoneByEmployeeId || null,
    };

    setPendingPayload(built);
    setShowConfirmModal(true);
  };

  // ── Confirm modal → submit ─────────────────────────────────────
  const confirmBooking = async () => {
    if (!pendingPayload) return;
    setIsSubmitting(true);
    try {
      const { data } = await axiosInstance.post(
        "/api/gov-employee-booking/create",
        pendingPayload
      );
      if (data?.success) {
        setShowConfirmModal(false);
        toast.success(`Booking ${data.bookingCode} created`);
        navigate("/booking-details/gov-employee-booking-list");
      } else {
        toast.error(data?.message || "Booking failed");
      }
    } catch (e) {
      console.error("[gov-employee] booking failed:", e);
      toast.error(e?.response?.data?.message || "Booking failed");
    } finally {
      setIsSubmitting(false);
    }
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
  const totalAfter  = Number(selectedRate.rate || 0) * (rooms.length || 1);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column hotel-booking-container">
      <TopBar />
      <div className="main-content">
        <Sidebar />
        <main className="content-wrapper py-4">
          <Container fluid="xl">
            {/* ── Booking Summary card (top) ──────────────────── */}
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
                            <FaIdBadge className="me-1" />
                            Gov Discount:
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
                          <h5 className="fw-bold text-primary mb-3">
                            {hotelStaticData.hotelName}
                          </h5>
                          <p className="text-muted mb-2">{hotelStaticData.address}</p>
                          <div className="d-flex align-items-center mb-2">
                            <span className="badge bg-warning text-dark me-2">
                              ⭐ {hotelStaticData.starRating} Star
                            </span>
                            {selectedRate?.nonRefundable !== undefined && (
                              <Badge bg={selectedRate.nonRefundable === true || selectedRate.nonRefundable === "true" ? "danger" : "success"}>
                                {selectedRate.nonRefundable === true || selectedRate.nonRefundable === "true" ? "Non-Refundable" : "Flexible"}
                              </Badge>
                            )}
                          </div>
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
                    {/* Total before / after with strike-through */}
                    {activePromotion && totalBefore !== totalAfter && (
                      <div className="pricing-section p-3 bg-white rounded shadow-sm mb-2">
                        <div className="d-flex justify-content-between align-items-center">
                          <h6 className="mb-0 text-muted">Standard Total</h6>
                          <h5 className="mb-0 text-decoration-line-through text-muted">
                            {formatPrice(totalBefore)}
                          </h5>
                        </div>
                      </div>
                    )}
                    <div className="pricing-section p-3 bg-gradient-success text-white rounded shadow-sm">
                      <div className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">
                          Total Payable {activePromotion ? "(after Gov discount)" : ""}
                        </h5>
                        <h4 className="mb-0 fw-bold">{formatPrice(totalAfter)}</h4>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* ── Form ────────────────────────────────────────── */}
            <Form onSubmit={handleSubmit}>
              {/* Government Employee Verification block */}
              <Card className="mb-3 shadow-sm border-0">
                <Card.Header className="bg-primary text-white py-3">
                  <h5 className="mb-0 fw-bold d-flex align-items-center">
                    <FaIdBadge className="me-2" /> Government Employee Verification
                  </h5>
                </Card.Header>
                <Card.Body className="p-4">
                  <div className="d-flex gap-4 mb-3">
                    <Form.Check
                      type="radio"
                      id="vm-code"
                      name="verificationMethod"
                      label="Employee Code"
                      checked={verificationMethod === METHOD_CODE}
                      onChange={() => setVerificationMethod(METHOD_CODE)}
                    />
                    <Form.Check
                      type="radio"
                      id="vm-upload"
                      name="verificationMethod"
                      label="Government ID Upload"
                      checked={verificationMethod === METHOD_UPLOAD}
                      onChange={() => setVerificationMethod(METHOD_UPLOAD)}
                    />
                  </div>

                  {verificationMethod === METHOD_CODE && (
                    <Row className="g-3">
                      <Col md={6}>
                        <Form.Label className="fw-semibold">Government Employee Code *</Form.Label>
                        <Form.Control
                          placeholder="e.g. GOV-1001"
                          value={govEmployeeCode}
                          onChange={(e) => setGovEmployeeCode(e.target.value)}
                        />
                      </Col>
                    </Row>
                  )}

                  {verificationMethod === METHOD_UPLOAD && (
                    <Row className="g-3 align-items-end">
                      <Col md={6}>
                        <Form.Label className="fw-semibold">Government ID Document *</Form.Label>
                        <Form.Control type="file"
                                      accept=".pdf,.png,.jpg,.jpeg"
                                      onChange={onFileChange} />
                        <Form.Text className="text-muted">PDF, PNG or JPG. Max ~5 MB.</Form.Text>
                      </Col>
                      <Col md={3}>
                        <Button variant="outline-primary" onClick={handleUpload}
                                disabled={!idFile || uploading}>
                          {uploading ? <Spinner size="sm" /> : <><FaFileUpload className="me-1" /> Upload</>}
                        </Button>
                      </Col>
                      <Col md={3}>
                        {uploadedFilePath ? (
                          <Badge bg="success" className="p-2">✓ Uploaded: {uploadedFileName}</Badge>
                        ) : idFile ? (
                          <span className="text-muted small">Click Upload to save</span>
                        ) : null}
                      </Col>
                    </Row>
                  )}

                  <Row className="g-3 mt-2">
                    <Col md={6}>
                      <Form.Label>Employee Name (optional)</Form.Label>
                      <Form.Control value={govEmployeeName}
                                    onChange={(e) => setGovEmployeeName(e.target.value)} />
                    </Col>
                    <Col md={6}>
                      <Form.Label>Department (optional)</Form.Label>
                      <Form.Control value={govEmployeeDepartment}
                                    onChange={(e) => setGovEmployeeDepartment(e.target.value)} />
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Per-room guest details */}
              <Card className="mb-3 shadow-sm border-0">
                <Card.Header className="bg-light text-center py-3">
                  <h5 className="mb-0 fw-bold text-dark">Guest Details</h5>
                </Card.Header>
                <Card.Body className="p-0">
                  <Accordion defaultActiveKey="0">
                    {rooms.map((room, roomIndex) => (
                      <Accordion.Item key={roomIndex} eventKey={String(roomIndex)} className="mb-3">
                        <Accordion.Header>
                          <h6 className="mb-0 fw-bold">
                            Room {roomIndex + 1} — {selectedRate.roomCategory}
                          </h6>
                        </Accordion.Header>
                        <Accordion.Body className="p-4">
                          {room.guests.map((guest, guestIndex) => {
                            const k = `room_${roomIndex}_guest_${guestIndex}`;
                            return (
                              <Row key={guestIndex} className="align-items-center g-2 mb-2">
                                <Col md={2}>
                                  <span className="fw-semibold text-muted">
                                    {guest.isChild
                                      ? `Child ${guestIndex - room.adults + 1}`
                                      : `Adult ${guestIndex + 1}`} *
                                  </span>
                                </Col>
                                <Col md={2}>
                                  <Form.Select
                                    isInvalid={!!validationErrors[`${k}_salutation`]}
                                    value={guest.salutation}
                                    onChange={(e) => handleGuestChange(roomIndex, guestIndex, "salutation", e.target.value)}>
                                    <option value="">Title</option>
                                    <option>Mr</option><option>Mrs</option>
                                    <option>Ms</option><option>Dr</option>
                                  </Form.Select>
                                </Col>
                                <Col md={3}>
                                  <Form.Control
                                    placeholder="First Name"
                                    isInvalid={!!validationErrors[`${k}_firstName`]}
                                    value={guest.firstName}
                                    onChange={(e) => handleGuestChange(roomIndex, guestIndex, "firstName", e.target.value)} />
                                </Col>
                                <Col md={3}>
                                  <Form.Control
                                    placeholder="Last Name"
                                    isInvalid={!!validationErrors[`${k}_lastName`]}
                                    value={guest.lastName}
                                    onChange={(e) => handleGuestChange(roomIndex, guestIndex, "lastName", e.target.value)} />
                                </Col>
                                <Col md={2}>
                                  <Form.Select
                                    isInvalid={!!validationErrors[`${k}_gender`]}
                                    value={guest.gender}
                                    onChange={(e) => handleGuestChange(roomIndex, guestIndex, "gender", e.target.value)}>
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
                    <Form.Select
                      isInvalid={!!validationErrors.salutation}
                      value={primaryGuest.salutation}
                      onChange={(e) => handlePrimaryGuestChange("salutation", e.target.value)}>
                      <option value="">Select</option>
                      <option>Mr</option><option>Mrs</option><option>Ms</option><option>Dr</option>
                    </Form.Select>
                  </Col>
                  <Col md={3}>
                    <Form.Label>First Name *</Form.Label>
                    <Form.Control
                      isInvalid={!!validationErrors.firstName}
                      value={primaryGuest.firstName}
                      onChange={(e) => handlePrimaryGuestChange("firstName", e.target.value)} />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Last Name *</Form.Label>
                    <Form.Control
                      isInvalid={!!validationErrors.lastName}
                      value={primaryGuest.lastName}
                      onChange={(e) => handlePrimaryGuestChange("lastName", e.target.value)} />
                  </Col>
                  <Col md={4}>
                    <Form.Label>Email *</Form.Label>
                    <Form.Control type="email"
                      isInvalid={!!validationErrors.email}
                      value={primaryGuest.email}
                      onChange={(e) => handlePrimaryGuestChange("email", e.target.value)} />
                    {validationErrors.email && <small className="text-danger">{validationErrors.email}</small>}
                  </Col>
                  <Col md={3}>
                    <Form.Label>Phone *</Form.Label>
                    <Form.Control
                      isInvalid={!!validationErrors.phone}
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
                    <Form.Control
                      isInvalid={!!validationErrors.agentLpo}
                      value={primaryGuest.agentLpo}
                      onChange={(e) => handlePrimaryGuestChange("agentLpo", e.target.value)} />
                  </Col>
                </Row>
              </Card>

              {/* Special Requests + Remarks */}
              <Card className="p-4 mb-3 shadow-sm border-0">
                <h6 className="mb-3 fw-bold text-primary">Special Requests & Remarks</h6>
                <div className="mb-3 d-flex flex-wrap gap-2">
                  {SPECIAL_REQUEST_OPTIONS.map((req) => (
                    <Form.Check key={req} type="checkbox" id={`sr-${req}`}
                                label={req}
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
                    <Form.Select
                      value={bookingDoneByEmployeeId}
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
                <Button
                  variant="primary"
                  type="submit"
                  disabled={!isVerificationReady}
                  title={!isVerificationReady ? "Complete verification first" : ""}
                >
                  Confirm Booking
                </Button>
              </div>

              {/* ── Confirmation Modal (shown on Confirm Booking click) ─ */}
              <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)}
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
                      <h5 className="fw-bold text-primary mb-2">{pendingPayload.hotelName}</h5>
                      <p className="text-muted mb-0">{pendingPayload.address}</p>
                      <hr />
                      <Row className="gy-2">
                        <Col xs={6}>
                          <strong>Check-In:</strong><br />
                          <span>{pendingPayload.checkInDate}</span>
                        </Col>
                        <Col xs={6}>
                          <strong>Check-Out:</strong><br />
                          <span>{pendingPayload.checkOutDate}</span>
                        </Col>
                        <Col xs={6}>
                          <strong>Rooms:</strong> {pendingPayload.rooms.length}
                        </Col>
                        <Col xs={6}>
                          <strong>Nights:</strong> {pendingPayload.nights}
                        </Col>
                        <Col xs={12}>
                          <strong>Verification:</strong>{" "}
                          {pendingPayload.verificationMethod === METHOD_UPLOAD
                            ? `Government ID Upload (${pendingPayload.govtIdFileName || "uploaded"})`
                            : `Employee Code (${pendingPayload.govEmployeeCode || "-"})`}
                        </Col>
                      </Row>

                      {/* Pricing block */}
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
                            <span>Government Discount</span>
                            <span>
                              {pendingPayload.discountPercent ? `${pendingPayload.discountPercent}%` : ""}
                              {pendingPayload.discountAmount ? ` + ${pendingPayload.discountAmount}` : ""}
                            </span>
                          </div>
                        )}
                        <hr className="my-2" />
                        <div className="d-flex justify-content-between fw-bold text-success">
                          <span>Total Payable</span>
                          <span>
                            {formatPrice(pendingPayload.rooms.reduce((s, r) => s + r.rate, 0))}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 text-center">
                        <p className="text-muted small mb-0">
                          Please review the booking details carefully before confirming.
                        </p>
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
};

export default GovEmployeeBookingPage;
