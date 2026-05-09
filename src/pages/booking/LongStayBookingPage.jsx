import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Form,
  Button,
  Row,
  Col,
  Spinner,
  Badge,
  Table,
  Modal,
  Accordion,
} from "react-bootstrap";
import {
  FaHotel,
  FaCalendarAlt,
  FaUsers,
  FaUtensils,
  FaBed,
  FaShieldAlt,
  FaArrowLeft,
  FaCheckCircle,
  FaUser,
  FaIdCard,
  FaEnvelope,
  FaPhone,
  FaGlobe,
  FaMoon,
  FaTag,
  FaReceipt,
} from "react-icons/fa";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import AgentBalanceDisplay from "../../components/AgentBalanceDisplay";
import { toast } from "react-hot-toast";
import { toLocalDateTime, formatDateTime } from "../../utils/dateUtils";

export default function LongStayBookingPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState("");
  const [rooms, setRooms] = useState([]);
  const [primaryGuest, setPrimaryGuest] = useState({
    salutation: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    passportNo: "",
    nationality: "",
    gender: "",
  });
  const [remarks, setRemarks] = useState("");
  const [tourismDirham, setTourismDirham] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("longStayBookingDraft");
    if (!raw) {
      toast.error("No booking draft — please search again");
      navigate("/new-booking/long-stay", { replace: true });
      return;
    }
    const parsed = JSON.parse(raw);
    setDraft(parsed);
    if (parsed.agentId) setAgentId(String(parsed.agentId));
    if (parsed.nationality) {
      setPrimaryGuest((g) => ({ ...g, nationality: parsed.nationality }));
    }

    // Initialize rooms with guests array based on search criteria
    const initialRooms = (parsed.rooms || [{ adults: 1, children: 0, childAges: [] }]).map(
      (room) => ({
        adults: room.adults || 1,
        children: room.children || 0,
        childAges: room.childAges || [],
        guests: Array.from(
          { length: (room.adults || 1) + (room.children || 0) },
          (_, i) => ({
            salutation: "",
            firstName: "",
            lastName: "",
            gender: "",
            isChild: i >= (room.adults || 1),
          })
        ),
      })
    );
    setRooms(initialRooms);

    axiosInstance
      .get("/api/agent")
      .then((res) => setAgents(res.data || []))
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    if (!draft) return;
    const fetchQuote = async () => {
      try {
        setQuoteError(null);
        const res = await axiosInstance.post("/api/longStayBooking/quote", {
          hotelId: draft.hotelId,
          longStayRoomId: draft.room.longStayRoomId,
          checkInDate: toLocalDateTime(draft.checkIn),
          checkOutDate: toLocalDateTime(draft.checkOut),
        });
        setQuote(res.data);
      } catch (err) {
        const msg = err.response?.data?.message || err.message || "Could not compute quote";
        setQuoteError(msg);
        setQuote(null);
      }
    };
    fetchQuote();
  }, [draft]);

  const handleGuestChange = (rIdx, gIdx, field, value) => {
    setRooms((prev) => {
      const updated = [...prev];
      updated[rIdx] = {
        ...updated[rIdx],
        guests: updated[rIdx].guests.map((g, i) =>
          i === gIdx ? { ...g, [field]: value } : g
        ),
      };
      return updated;
    });
    if (rIdx === 0 && gIdx === 0 && ["salutation", "firstName", "lastName", "gender"].includes(field)) {
      setPrimaryGuest((p) => ({ ...p, [field]: value }));
    }
    const key = `r${rIdx}_g${gIdx}_${field}`;
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handlePrimaryGuestChange = (field, value) => {
    setPrimaryGuest((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!primaryGuest.salutation) e.salutation = "Salutation is required";
    if (!primaryGuest.firstName.trim()) e.firstName = "First name is required";
    if (!primaryGuest.lastName.trim()) e.lastName = "Last name is required";
    if (!primaryGuest.email.trim()) {
      e.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryGuest.email.trim())) {
      e.email = "Enter a valid email";
    }
    if (!primaryGuest.phone.trim()) {
      e.phone = "Phone is required";
    } else if (!/^[+0-9\s\-()]{7,}$/.test(primaryGuest.phone.trim())) {
      e.phone = "Enter a valid phone";
    }
    rooms.forEach((room, rIdx) => {
      room.guests.forEach((g, gIdx) => {
        if (!g.salutation) e[`r${rIdx}_g${gIdx}_salutation`] = "Required";
        if (!g.firstName?.trim()) e[`r${rIdx}_g${gIdx}_firstName`] = "Required";
        if (!g.lastName?.trim()) e[`r${rIdx}_g${gIdx}_lastName`] = "Required";
      });
    });
    return e;
  };

  const handleBook = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    if (!quote || quoteError) {
      toast.error("Price quote not ready — please wait or retry");
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmBooking = async () => {
    try {
      setSubmitting(true);
      const fullName = [
        primaryGuest.salutation,
        primaryGuest.firstName,
        primaryGuest.middleName,
        primaryGuest.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      const payload = {
        hotelId: draft.hotelId,
        longStayContractId: draft.contract.longStayContractId,
        longStayRoomId: draft.room.longStayRoomId,
        agentId: agentId ? Number(agentId) : null,
        checkInDate: toLocalDateTime(draft.checkIn),
        checkOutDate: toLocalDateTime(draft.checkOut),
        primaryGuestName: fullName,
        primaryGuestEmail: primaryGuest.email.trim(),
        primaryGuestPhone: primaryGuest.phone.trim(),
        nationality: primaryGuest.nationality || null,
        remarks: remarks || null,
        tourismDirham:
          tourismDirham !== "" && !isNaN(Number(tourismDirham))
            ? Number(tourismDirham)
            : null,
        primaryGuestDetails: {
          salutation: primaryGuest.salutation,
          firstName: primaryGuest.firstName.trim(),
          middleName: primaryGuest.middleName?.trim() || null,
          lastName: primaryGuest.lastName.trim(),
          email: primaryGuest.email.trim(),
          phone: primaryGuest.phone.trim(),
          passportNo: primaryGuest.passportNo?.trim() || null,
          nationality: primaryGuest.nationality || null,
          gender: primaryGuest.gender || null,
        },
        rooms: rooms.map((room) => ({
          adults: room.adults,
          children: room.children,
          childAges: room.childAges,
          guests: room.guests.map((g, gIdx) => ({
            salutation: g.salutation,
            firstName: g.firstName?.trim() || "",
            lastName: g.lastName?.trim() || "",
            gender: g.gender || null,
            isChild: !!g.isChild,
            childAge: g.isChild
              ? room.childAges[gIdx - room.adults] ?? null
              : null,
          })),
        })),
      };
      const res = await axiosInstance.post("/api/longStayBooking/create", payload);
      toast.success(`Booking confirmed: ${res.data.bookingCode}`);
      sessionStorage.removeItem("longStayBookingDraft");
      setShowConfirmModal(false);
      navigate("/booking-details/long-stay-booking-list");
    } catch (err) {
      toast.error(`Booking failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft) return null;
  const fmt = (n) => (n == null ? "-" : Number(n).toFixed(2));

  // ── derived totals for header chips ────────────────────────────────────
  const totalAdults = rooms.reduce((s, r) => s + (r.adults || 0), 0);
  const totalChildren = rooms.reduce((s, r) => s + (r.children || 0), 0);
  const totalGuests = totalAdults + totalChildren;

  // ── style tokens ───────────────────────────────────────────────────────
  const card = {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    boxShadow: "0 1px 2px rgba(16,24,40,.04)",
    background: "#fff",
  };
  const sectionHeader = {
    borderBottom: "1px solid #f1f5f9",
    background: "#fafbfc",
    padding: "14px 20px",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  };
  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 4,
  };
  const valueStyle = { fontSize: 14, color: "#0f172a", fontWeight: 500 };
  const iconChip = {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eef2ff",
    color: "#6366f1",
    flexShrink: 0,
  };

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: "#f8fafc" }}>
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div
            className="d-flex justify-content-end px-4 pt-2"
            style={{ background: "#fff" }}
          >
            <AgentBalanceDisplay agentId={agentId} />
          </div>
          {/* ── Hero Banner ───────────────────────────────────────────── */}
          <div
            style={{
              background:
                "linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%)",
              padding: "28px 32px 64px",
              color: "#fff",
              position: "relative",
            }}
          >
            <Button
              variant="link"
              onClick={() => navigate(-1)}
              className="text-white p-0 mb-3 d-inline-flex align-items-center"
              style={{ textDecoration: "none", fontWeight: 500 }}
            >
              <FaArrowLeft className="me-2" /> Back
            </Button>

            <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
              <div>
                <div
                  className="d-inline-flex align-items-center px-3 py-1 mb-2"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  <FaHotel className="me-2" /> Long Stay Booking
                </div>
                <h2 className="fw-bold mb-1" style={{ letterSpacing: "-0.02em" }}>
                  {draft.hotelName}
                </h2>
                <div className="d-flex flex-wrap gap-3 mt-2" style={{ opacity: 0.92 }}>
                  <span className="d-inline-flex align-items-center">
                    <FaCalendarAlt className="me-2" />
                    {formatDateTime(draft.checkIn)} → {formatDateTime(draft.checkOut)}
                  </span>
                  <span className="d-inline-flex align-items-center">
                    <FaMoon className="me-2" />
                    {quote?.totalNights ?? "—"} nights
                  </span>
                  <span className="d-inline-flex align-items-center">
                    <FaTag className="me-2" />
                    {draft.contract.rateCode}
                  </span>
                </div>
              </div>

              <div className="d-flex gap-2 flex-wrap">
                <span
                  className="px-3 py-2 d-inline-flex align-items-center"
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    color: "#fff",
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {draft.contract.additionalCostType === "WEEKLY"
                    ? "Weekly billing"
                    : "Day-wise billing"}
                </span>
                <span
                  className="px-3 py-2 d-inline-flex align-items-center"
                  style={{
                    background: draft.room.refundable
                      ? "rgba(34,197,94,0.25)"
                      : "rgba(239,68,68,0.25)",
                    color: "#fff",
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  <FaShieldAlt className="me-2" />
                  {draft.room.refundable ? "Flexible" : "Non-Refundable"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Main content area, lifted over the hero ──────────────── */}
          <div
            className="px-4 pb-5"
            style={{ marginTop: -36, position: "relative", zIndex: 2 }}
          >
            <Row className="g-4">
              {/* Left column */}
              <Col lg={8}>
                {/* Stay Details */}
                <div style={card} className="mb-4 overflow-hidden">
                  <div style={sectionHeader} className="d-flex align-items-center">
                    <span style={iconChip} className="me-3">
                      <FaBed />
                    </span>
                    <div>
                      <h6 className="mb-0 fw-bold" style={{ color: "#0f172a" }}>
                        Stay & Room Details
                      </h6>
                      <div className="small text-muted">
                        Snapshot of the room you selected
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <Row className="g-4">
                      <Col md={4}>
                        <div style={labelStyle}>Hotel</div>
                        <div style={valueStyle}>{draft.hotelName}</div>
                      </Col>
                      <Col md={4}>
                        <div style={labelStyle}>Contract</div>
                        <div style={valueStyle}>{draft.contract.rateCode}</div>
                      </Col>
                      <Col md={4}>
                        <div style={labelStyle}>Billing</div>
                        <div style={valueStyle}>
                          {draft.contract.additionalCostType === "WEEKLY"
                            ? "Weekly"
                            : "Day-wise"}
                        </div>
                      </Col>
                      <Col md={4}>
                        <div style={labelStyle}>Room Category</div>
                        <div style={valueStyle}>
                          {draft.room.roomCategoryName ||
                            `Category #${draft.room.hotelRoomCategoryId}`}
                        </div>
                      </Col>
                      <Col md={4}>
                        <div style={labelStyle}>Meal Plan</div>
                        <div style={valueStyle} className="d-flex align-items-center">
                          <FaUtensils className="me-2 text-muted" />
                          {draft.room.roomTypeName ||
                            (draft.room.meal ? "Meal included" : "Room only")}
                        </div>
                      </Col>
                      <Col md={4}>
                        <div style={labelStyle}>Occupancy</div>
                        <div style={valueStyle}>
                          {draft.room.occupancyTypeName ||
                            `Occ-${draft.room.occupancyTypeId}`}
                        </div>
                      </Col>
                      <Col md={4}>
                        <div style={labelStyle}>Check-In</div>
                        <div style={valueStyle}>{formatDateTime(draft.checkIn)}</div>
                      </Col>
                      <Col md={4}>
                        <div style={labelStyle}>Check-Out</div>
                        <div style={valueStyle}>{formatDateTime(draft.checkOut)}</div>
                      </Col>
                      <Col md={4}>
                        <div style={labelStyle}>Refund Policy</div>
                        <div>
                          {draft.room.refundable ? (
                            <Badge
                              bg=""
                              style={{
                                background: "#dcfce7",
                                color: "#166534",
                                fontWeight: 600,
                                padding: "6px 12px",
                                borderRadius: 999,
                              }}
                            >
                              <FaCheckCircle className="me-1" /> Flexible
                            </Badge>
                          ) : (
                            <Badge
                              bg=""
                              style={{
                                background: "#fee2e2",
                                color: "#991b1b",
                                fontWeight: 600,
                                padding: "6px 12px",
                                borderRadius: 999,
                              }}
                            >
                              Non-Refundable
                            </Badge>
                          )}
                        </div>
                      </Col>
                    </Row>
                  </div>
                </div>

                {/* Guest Details */}
                <div style={card} className="mb-4 overflow-hidden">
                  <div style={sectionHeader} className="d-flex align-items-center">
                    <span style={iconChip} className="me-3">
                      <FaUsers />
                    </span>
                    <div className="flex-grow-1">
                      <h6 className="mb-0 fw-bold" style={{ color: "#0f172a" }}>
                        Guest Details
                      </h6>
                      <div className="small text-muted">
                        {totalGuests} guest{totalGuests !== 1 ? "s" : ""} across{" "}
                        {rooms.length} room{rooms.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <Badge
                      bg=""
                      style={{
                        background: "#eef2ff",
                        color: "#4338ca",
                        fontWeight: 600,
                        padding: "6px 12px",
                        borderRadius: 999,
                      }}
                    >
                      {totalAdults} Adult{totalAdults !== 1 ? "s" : ""}
                      {totalChildren > 0
                        ? ` · ${totalChildren} Child${totalChildren > 1 ? "ren" : ""}`
                        : ""}
                    </Badge>
                  </div>
                  <div className="p-2">
                    <Accordion defaultActiveKey="0" flush>
                      {rooms.map((room, rIdx) => (
                        <Accordion.Item
                          key={rIdx}
                          eventKey={String(rIdx)}
                          style={{
                            border: "1px solid #f1f5f9",
                            borderRadius: 12,
                            marginBottom: 8,
                            overflow: "hidden",
                          }}
                        >
                          <Accordion.Header>
                            <div className="d-flex align-items-center w-100">
                              <span
                                style={{
                                  ...iconChip,
                                  width: 28,
                                  height: 28,
                                  fontSize: 12,
                                  marginRight: 12,
                                }}
                              >
                                {rIdx + 1}
                              </span>
                              <div>
                                <div className="fw-semibold" style={{ color: "#0f172a" }}>
                                  Room {rIdx + 1}
                                </div>
                                <div className="small text-muted">
                                  {room.adults} Adult{room.adults > 1 ? "s" : ""}
                                  {room.children > 0
                                    ? ` · ${room.children} Child${
                                        room.children > 1 ? "ren" : ""
                                      }`
                                    : ""}
                                </div>
                              </div>
                            </div>
                          </Accordion.Header>
                          <Accordion.Body style={{ background: "#fafbfc" }}>
                            {room.guests.map((g, gIdx) => (
                              <div
                                key={gIdx}
                                className="p-3 mb-2"
                                style={{
                                  background: "#fff",
                                  border: "1px solid #f1f5f9",
                                  borderRadius: 10,
                                }}
                              >
                                <div
                                  className="d-flex align-items-center mb-2"
                                  style={{ gap: 8 }}
                                >
                                  <span
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      background: g.isChild ? "#f59e0b" : "#6366f1",
                                    }}
                                  />
                                  <span
                                    className="fw-semibold"
                                    style={{ fontSize: 13, color: "#0f172a" }}
                                  >
                                    {g.isChild
                                      ? `Child ${gIdx - room.adults + 1}`
                                      : `Adult ${gIdx + 1}`}
                                  </span>
                                  {g.isChild && (
                                    <Badge
                                      bg=""
                                      style={{
                                        background: "#fef3c7",
                                        color: "#92400e",
                                        fontWeight: 600,
                                        fontSize: 11,
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                      }}
                                    >
                                      Age{" "}
                                      {room.childAges[gIdx - room.adults] ?? "-"}
                                    </Badge>
                                  )}
                                  <span
                                    className="ms-auto small text-muted"
                                    style={{ fontSize: 11 }}
                                  >
                                    Required *
                                  </span>
                                </div>
                                <Row className="g-2">
                                  <Col md={2}>
                                    <Form.Select
                                      size="sm"
                                      value={g.salutation}
                                      isInvalid={
                                        !!errors[`r${rIdx}_g${gIdx}_salutation`]
                                      }
                                      onChange={(e) =>
                                        handleGuestChange(
                                          rIdx,
                                          gIdx,
                                          "salutation",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <option value="">Title</option>
                                      <option value="Mr">Mr</option>
                                      <option value="Mrs">Mrs</option>
                                      <option value="Ms">Ms</option>
                                      <option value="Master">Master</option>
                                    </Form.Select>
                                  </Col>
                                  <Col md={4}>
                                    <Form.Control
                                      size="sm"
                                      placeholder="First Name"
                                      value={g.firstName}
                                      isInvalid={
                                        !!errors[`r${rIdx}_g${gIdx}_firstName`]
                                      }
                                      onChange={(e) =>
                                        handleGuestChange(
                                          rIdx,
                                          gIdx,
                                          "firstName",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </Col>
                                  <Col md={4}>
                                    <Form.Control
                                      size="sm"
                                      placeholder="Last Name"
                                      value={g.lastName}
                                      isInvalid={
                                        !!errors[`r${rIdx}_g${gIdx}_lastName`]
                                      }
                                      onChange={(e) =>
                                        handleGuestChange(
                                          rIdx,
                                          gIdx,
                                          "lastName",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </Col>
                                  <Col md={2}>
                                    <Form.Select
                                      size="sm"
                                      value={g.gender}
                                      onChange={(e) =>
                                        handleGuestChange(
                                          rIdx,
                                          gIdx,
                                          "gender",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <option value="">Gender</option>
                                      <option value="Male">Male</option>
                                      <option value="Female">Female</option>
                                      <option value="Other">Other</option>
                                    </Form.Select>
                                  </Col>
                                </Row>
                              </div>
                            ))}
                          </Accordion.Body>
                        </Accordion.Item>
                      ))}
                    </Accordion>
                  </div>
                </div>

                {/* Primary Guest */}
                <div style={card} className="mb-4 overflow-hidden">
                  <div style={sectionHeader} className="d-flex align-items-center">
                    <span style={iconChip} className="me-3">
                      <FaUser />
                    </span>
                    <div>
                      <h6 className="mb-0 fw-bold" style={{ color: "#0f172a" }}>
                        Primary Guest
                      </h6>
                      <div className="small text-muted">
                        Lead booker contact information
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <Row className="g-3">
                      <Col md={3}>
                        <Form.Label className="small fw-semibold text-muted mb-1">
                          Salutation <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Select
                          value={primaryGuest.salutation}
                          isInvalid={!!errors.salutation}
                          onChange={(e) =>
                            handlePrimaryGuestChange("salutation", e.target.value)
                          }
                        >
                          <option value="">Select</option>
                          <option value="Mr">Mr</option>
                          <option value="Mrs">Mrs</option>
                          <option value="Ms">Ms</option>
                          <option value="Dr">Dr</option>
                        </Form.Select>
                      </Col>
                      <Col md={3}>
                        <Form.Label className="small fw-semibold text-muted mb-1">
                          First Name <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          value={primaryGuest.firstName}
                          isInvalid={!!errors.firstName}
                          onChange={(e) =>
                            handlePrimaryGuestChange("firstName", e.target.value)
                          }
                        />
                      </Col>
                      <Col md={3}>
                        <Form.Label className="small fw-semibold text-muted mb-1">
                          Middle Name
                        </Form.Label>
                        <Form.Control
                          value={primaryGuest.middleName}
                          onChange={(e) =>
                            handlePrimaryGuestChange("middleName", e.target.value)
                          }
                        />
                      </Col>
                      <Col md={3}>
                        <Form.Label className="small fw-semibold text-muted mb-1">
                          Last Name <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          value={primaryGuest.lastName}
                          isInvalid={!!errors.lastName}
                          onChange={(e) =>
                            handlePrimaryGuestChange("lastName", e.target.value)
                          }
                        />
                      </Col>
                      <Col md={4}>
                        <Form.Label className="small fw-semibold text-muted mb-1">
                          <FaEnvelope className="me-1" /> Email{" "}
                          <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="email"
                          value={primaryGuest.email}
                          isInvalid={!!errors.email}
                          onChange={(e) =>
                            handlePrimaryGuestChange("email", e.target.value)
                          }
                        />
                      </Col>
                      <Col md={4}>
                        <Form.Label className="small fw-semibold text-muted mb-1">
                          <FaPhone className="me-1" /> Phone{" "}
                          <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          value={primaryGuest.phone}
                          isInvalid={!!errors.phone}
                          onChange={(e) =>
                            handlePrimaryGuestChange("phone", e.target.value)
                          }
                        />
                      </Col>
                      <Col md={4}>
                        <Form.Label className="small fw-semibold text-muted mb-1">
                          <FaIdCard className="me-1" /> Passport No
                        </Form.Label>
                        <Form.Control
                          value={primaryGuest.passportNo}
                          onChange={(e) =>
                            handlePrimaryGuestChange("passportNo", e.target.value)
                          }
                        />
                      </Col>
                      <Col md={4}>
                        <Form.Label className="small fw-semibold text-muted mb-1">
                          <FaGlobe className="me-1" /> Nationality
                        </Form.Label>
                        <Form.Control
                          maxLength={2}
                          placeholder="e.g. AE"
                          value={primaryGuest.nationality}
                          onChange={(e) =>
                            handlePrimaryGuestChange(
                              "nationality",
                              e.target.value.toUpperCase()
                            )
                          }
                        />
                      </Col>
                      <Col md={12}>
                        <Form.Label className="small fw-semibold text-muted mb-1">
                          Remarks
                        </Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          placeholder="Any special requests or notes for the property"
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                        />
                      </Col>
                    </Row>
                  </div>
                </div>
              </Col>

              {/* Right column — sticky price summary */}
              <Col lg={4}>
                <div style={{ position: "sticky", top: 16 }}>
                  <div style={card} className="overflow-hidden mb-3">
                    {/* Total hero band */}
                    <div
                      style={{
                        background:
                          "linear-gradient(135deg,#10b981 0%,#059669 100%)",
                        color: "#fff",
                        padding: "20px 24px",
                      }}
                    >
                      <div
                        className="small"
                        style={{
                          opacity: 0.85,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          fontWeight: 600,
                        }}
                      >
                        Total Amount
                      </div>
                      <div className="d-flex align-items-baseline mt-1">
                        <h2 className="fw-bold mb-0" style={{ letterSpacing: "-0.02em" }}>
                          {quote ? fmt(quote.totalAmount) : "—"}
                        </h2>
                        <span className="ms-2" style={{ opacity: 0.85, fontSize: 13 }}>
                          {quote?.totalNights ?? "—"} nights
                        </span>
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="p-3">
                      <div className="d-flex align-items-center mb-3">
                        <FaReceipt className="me-2 text-muted" />
                        <h6 className="mb-0 fw-bold" style={{ color: "#0f172a" }}>
                          Price Breakdown
                        </h6>
                      </div>

                      {quoteError ? (
                        <div
                          style={{
                            background: "#fee2e2",
                            color: "#991b1b",
                            border: "1px solid #fecaca",
                            borderRadius: 10,
                            padding: 12,
                            fontSize: 13,
                          }}
                        >
                          {quoteError}
                        </div>
                      ) : !quote ? (
                        <div className="text-center py-4">
                          <Spinner animation="border" size="sm" />
                          <div className="small text-muted mt-2">
                            Computing quote…
                          </div>
                        </div>
                      ) : (
                        <>
                          {quote.contractsUsed && quote.contractsUsed.length > 1 && (
                            <div
                              style={{
                                background: "#eff6ff",
                                color: "#1e40af",
                                border: "1px solid #bfdbfe",
                                borderRadius: 10,
                                padding: 10,
                                fontSize: 12,
                                marginBottom: 12,
                              }}
                            >
                              Booking spans{" "}
                              <strong>{quote.contractsUsed.length}</strong> contract
                              validities — billed pro-rata.
                            </div>
                          )}

                          {quote.months && quote.months.length > 0 && (
                            <>
                              {quote.months.map((m) => (
                                <div
                                  key={m.monthIndex}
                                  className="mb-2 p-3"
                                  style={{
                                    background: "#fafbfc",
                                    border: "1px solid #f1f5f9",
                                    borderRadius: 10,
                                  }}
                                >
                                  <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                      <div
                                        className="fw-semibold small"
                                        style={{ color: "#0f172a" }}
                                      >
                                        Month {m.monthIndex}
                                      </div>
                                      <div
                                        className="text-muted"
                                        style={{ fontSize: 11 }}
                                      >
                                        {m.from} → {m.to}
                                      </div>
                                    </div>
                                    <span
                                      className="fw-bold"
                                      style={{ color: "#059669", fontSize: 14 }}
                                    >
                                      {fmt(m.amount)}
                                    </span>
                                  </div>
                                  {m.slices && m.slices.length > 0 && (
                                    <Table
                                      size="sm"
                                      className="mt-2 mb-0"
                                      style={{ fontSize: 12 }}
                                    >
                                      <thead className="text-muted">
                                        <tr>
                                          <th>Validity</th>
                                          <th>Days</th>
                                          <th className="text-end">Sub-total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {m.slices.map((s, i) => (
                                          <tr key={i}>
                                            <td>{s.rateCode}</td>
                                            <td>{s.days}</td>
                                            <td className="text-end">
                                              {fmt(s.amount)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </Table>
                                  )}
                                </div>
                              ))}
                            </>
                          )}

                          {quote.remainder && quote.remainder.days > 0 && (
                            <div
                              className="mb-2 p-3"
                              style={{
                                background: "#fffbeb",
                                border: "1px solid #fde68a",
                                borderRadius: 10,
                              }}
                            >
                              <div className="d-flex justify-content-between">
                                <div>
                                  <div
                                    className="fw-semibold small"
                                    style={{ color: "#92400e" }}
                                  >
                                    Remainder · {quote.remainder.days} day
                                    {quote.remainder.days > 1 ? "s" : ""}
                                  </div>
                                  <div
                                    className="text-muted"
                                    style={{ fontSize: 11 }}
                                  >
                                    {quote.remainder.costType === "WEEKLY"
                                      ? "Weekly"
                                      : "Day-wise"}
                                  </div>
                                </div>
                                <span
                                  className="fw-bold"
                                  style={{ color: "#92400e", fontSize: 14 }}
                                >
                                  {fmt(quote.remainder.amount)}
                                </span>
                              </div>
                            </div>
                          )}

                          <hr style={{ borderColor: "#e5e7eb" }} />
                          <div className="d-flex justify-content-between align-items-baseline">
                            <span style={{ fontSize: 14, color: "#475569" }}>
                              Grand Total
                            </span>
                            <span
                              className="fw-bold"
                              style={{ fontSize: 22, color: "#0f172a" }}
                            >
                              {fmt(quote.totalAmount)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="d-grid gap-2">
                    <Button
                      onClick={handleBook}
                      disabled={!quote || !!quoteError || submitting}
                      style={{
                        background:
                          "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)",
                        border: "none",
                        padding: "12px 20px",
                        borderRadius: 12,
                        fontWeight: 600,
                        fontSize: 15,
                        boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
                      }}
                    >
                      <FaCheckCircle className="me-2" /> Confirm Booking
                    </Button>
                    <Button
                      variant="link"
                      onClick={() => navigate(-1)}
                      style={{
                        color: "#64748b",
                        textDecoration: "none",
                        fontWeight: 500,
                        fontSize: 14,
                      }}
                    >
                      Cancel & go back
                    </Button>
                  </div>

                  {/* Trust badges */}
                  <div
                    className="mt-3 p-3"
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "#64748b",
                    }}
                  >
                    <div className="d-flex align-items-center mb-2">
                      <FaShieldAlt className="me-2" style={{ color: "#10b981" }} />
                      <span className="fw-semibold" style={{ color: "#0f172a" }}>
                        Booking Protection
                      </span>
                    </div>
                    Your booking is processed securely. Cancellation policy follows the
                    refund terms shown above.
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </div>
      </div>

      {/* ── Confirmation Modal ─────────────────────────────────────────── */}
      <Modal
        show={showConfirmModal}
        onHide={() => !submitting && setShowConfirmModal(false)}
        centered
        backdrop="static"
        size="md"
      >
        <Modal.Header
          closeButton={!submitting}
          style={{
            background: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)",
            color: "#fff",
            borderBottom: "none",
            padding: "20px 24px",
          }}
        >
          <Modal.Title className="fw-bold d-flex align-items-center">
            <FaHotel className="me-2" /> Confirm Long Stay Booking
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4" style={{ background: "#f8fafc" }}>
          {draft && (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <h5 className="fw-bold mb-1" style={{ color: "#0f172a" }}>
                {draft.hotelName}
              </h5>
              <div className="small text-muted mb-3">
                Contract <strong>{draft.contract.rateCode}</strong> ·{" "}
                {draft.contract.additionalCostType === "WEEKLY"
                  ? "Weekly"
                  : "Day-wise"}{" "}
                billing
              </div>

              <Row className="g-3">
                <Col xs={6}>
                  <div style={labelStyle}>Check-In</div>
                  <div style={valueStyle}>{formatDateTime(draft.checkIn)}</div>
                </Col>
                <Col xs={6}>
                  <div style={labelStyle}>Check-Out</div>
                  <div style={valueStyle}>{formatDateTime(draft.checkOut)}</div>
                </Col>
                <Col xs={6}>
                  <div style={labelStyle}>Nights</div>
                  <div style={valueStyle}>{quote?.totalNights ?? "—"}</div>
                </Col>
                <Col xs={6}>
                  <div style={labelStyle}>Guests</div>
                  <div style={valueStyle}>
                    {totalAdults} Adult{totalAdults !== 1 ? "s" : ""}
                    {totalChildren > 0
                      ? `, ${totalChildren} Child${totalChildren > 1 ? "ren" : ""}`
                      : ""}
                  </div>
                </Col>
                <Col xs={12}>
                  <div style={labelStyle}>Primary Guest</div>
                  <div style={valueStyle}>
                    {primaryGuest.salutation} {primaryGuest.firstName}{" "}
                    {primaryGuest.lastName}
                  </div>
                  <div className="small text-muted">
                    {primaryGuest.email} · {primaryGuest.phone}
                    {primaryGuest.nationality ? ` · ${primaryGuest.nationality}` : ""}
                  </div>
                </Col>
              </Row>

              <div
                className="mt-3 p-3 text-center"
                style={{
                  background:
                    "linear-gradient(135deg,#10b981 0%,#059669 100%)",
                  color: "#fff",
                  borderRadius: 12,
                }}
              >
                <div
                  className="small"
                  style={{
                    opacity: 0.9,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 600,
                  }}
                >
                  Total Amount
                </div>
                <h3 className="fw-bold mb-0">
                  {quote?.totalAmount != null
                    ? (
                        Number(quote.totalAmount) +
                        (tourismDirham !== "" && !isNaN(Number(tourismDirham))
                          ? Number(tourismDirham)
                          : 0)
                      ).toFixed(2)
                    : "—"}
                </h3>
              </div>
            </div>
          )}
          <div className="mt-3">
            <Form.Label className="fw-semibold mb-1 small text-uppercase">
              Tourism Dirham
            </Form.Label>
            <Form.Control
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={tourismDirham}
              onChange={(e) => setTourismDirham(e.target.value)}
            />
            <Form.Text className="text-muted">
              Optional — added to the Total Amount above.
            </Form.Text>
          </div>
        </Modal.Body>
        <Modal.Footer
          style={{ background: "#f8fafc", borderTop: "1px solid #e5e7eb" }}
          className="d-flex justify-content-between"
        >
          <Button
            variant="link"
            onClick={() => setShowConfirmModal(false)}
            disabled={submitting}
            style={{ color: "#64748b", textDecoration: "none", fontWeight: 500 }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmBooking}
            disabled={submitting}
            style={{
              background: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)",
              border: "none",
              padding: "10px 28px",
              borderRadius: 10,
              fontWeight: 600,
              boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
            }}
          >
            {submitting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Processing…
              </>
            ) : (
              <>
                <FaCheckCircle className="me-2" /> Confirm Booking
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
