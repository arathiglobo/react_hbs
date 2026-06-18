/**
 * SeniorCitizenRoomList.jsx
 *
 * Room-list page for the Senior Citizen flow. Layout mirrors
 * StudentRoomList — hotel header card, booking summary side panel,
 * accordion of room categories with grid/list view toggle.
 *
 * Endpoints:
 *   POST /api/hotel-rooms/search                     — room rates
 *   GET  /api/hotel-senior-citizen-promotion/hotel/{id}/active?date=...
 *                                                  — active promotion preview
 */

import React, { useEffect, useState } from "react";
import {
  Card, Button, Row, Col, Badge, Accordion, Spinner, Alert, Form,
} from "react-bootstrap";
import {
  FaBed, FaUtensils, FaStar, FaMapMarkerAlt, FaCalendarAlt, FaUsers,
  FaInfoCircle, FaCheckCircle, FaTimesCircle, FaHotel, FaMoneyBillWave,
  FaShieldAlt, FaGlobe, FaUserClock, FaChevronUp, FaChevronDown,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { formatFlexibleDate } from "../../utils/dateUtils";
import "../../styles/RoomList.css";

/**
 * Builds the "Valid: <from> - <to>" label for a policy validity period.
 * Returns null when NEITHER date is usable so the caller can hide the line
 * entirely. When only one side is usable we still show the range with an
 * "N/A" placeholder. (Mirrors the helper on /room-list.)
 */
const renderPolicyValidity = (fromDate, toDate) => {
  const from = formatFlexibleDate(fromDate);
  const to = formatFlexibleDate(toDate);
  if (!from && !to) return null;
  return `Valid: ${from || "N/A"} - ${to || "N/A"}`;
};

export default function SeniorCitizenRoomList() {
  const location = useLocation();
  const navigate = useNavigate();
  // SeniorCitizenSearch now opens this page in a NEW tab, where React Router's
  // navigate-state isn't available — fall back to the handoff context it
  // persisted to localStorage (shared across same-origin tabs).
  const ctx = React.useMemo(() => {
    if (location.state) return location.state;
    try {
      const raw = localStorage.getItem("seniorCitizenRoomListCtx");
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }, [location.state]);

  const [roomData, setRoomData] = useState(null);
  const [policyList, setPolicyList] = useState(null); // /api/hotels/{id}/policies
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agentBalance, setAgentBalance] = useState(null);
  const [activePromotion, setActivePromotion] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [activeAccordion, setActiveAccordion] = useState("0");

  // ── Filter sidebar state ─────────────────────────────────────
  // Mirrors RoomList.jsx — refundability + room-type checkboxes
  // surface as a left sidebar in the "Available Room Categories"
  // section. Rooms whose rates don't match are pruned out of the
  // accordion.
  const [refundFilter, setRefundFilter] = useState({
    refundable: false, nonRefundable: false,
  });
  const [roomTypeOptions, setRoomTypeOptions] = useState([]);
  const [selectedRoomTypes, setSelectedRoomTypes] = useState([]);

  // ──────────────────────────────────────────────────────────────────────
  // Multi-room selection (per-room slots) — mirrors RoomList.jsx.
  //
  // Single-room searches (numRooms === 1) keep using the legacy
  // `handleBooking` flow — the "Select & Continue" button renders
  // exactly as before and navigates to /senior-citizen-booking-page
  // with the single-room bookingData shape.
  //
  // Multi-room searches (numRooms > 1) render a per-room outer
  // Accordion ("Room 1 / Room 2 / ..."), each with a radio in place of
  // the button. `handleProceedBooking` combines selections into the
  // legacy single-`selectedRate` shape (sum of per-room rates,
  // concatenated category/meal labels). Per-room detail rides along as
  // an additive `roomBreakdown` array.
  // ──────────────────────────────────────────────────────────────────────
  const [selectedRooms, setSelectedRooms] = useState([]);

  useEffect(() => {
    let cancelled = false;
    axiosInstance.get("/api/roomType?page=0&limit=10")
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data
          : Array.isArray(res?.data?.content) ? res.data.content : [];
        setRoomTypeOptions(list);
      })
      .catch(() => { if (!cancelled) setRoomTypeOptions([]); });
    return () => { cancelled = true; };
  }, []);

  const toggleRoomType = (name) =>
    setSelectedRoomTypes((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );

  const matchesFilters = (rate) => {
    const isNonRefundable = String(rate.nonRefundable).toLowerCase() === "true";
    if (refundFilter.refundable && refundFilter.nonRefundable) {
      // both checked → no narrowing
    } else if (refundFilter.refundable && isNonRefundable) {
      return false;
    } else if (refundFilter.nonRefundable && !isNonRefundable) {
      return false;
    }
    if (selectedRoomTypes.length > 0) {
      const mp = String(rate.mealPlan || "").toLowerCase();
      const hit = selectedRoomTypes.some(
        (name) => name && mp === String(name).toLowerCase(),
      );
      if (!hit) return false;
    }
    return true;
  };

  // Accept both shapes: the new (discountType + discountValue) shape
  // produced by SeniorCitizenList, and the legacy (discountPercent /
  // discountAmount) shape some older rows may still have.
  const applyDiscount = (base) => {
    if (base == null) return base;
    let out = Number(base);
    if (activePromotion) {
      const t = activePromotion.discountType;
      const v = Number(activePromotion.discountValue || 0);
      if (t === "PERCENTAGE" && v) {
        out = out * (1 - v / 100);
      } else if (t === "AMOUNT" && v) {
        out = out - v;
      } else {
        // legacy fallback
        if (activePromotion.discountPercent)
          out = out * (1 - Number(activePromotion.discountPercent) / 100);
        if (activePromotion.discountAmount)
          out = out - Number(activePromotion.discountAmount);
      }
    }
    return Math.max(0, +out.toFixed(2));
  };

  // Display currency carried over from the search page (rates are AED; this
  // converts them for display only and rides the booking handoff). AED → 1.
  const _scCur = ctx?.currency || { code: "AED", factor: 1 };
  const curCode = _scCur.code || "AED";
  const curFactor = Number(_scCur.factor) > 0 ? Number(_scCur.factor) : 1;
  const formatPrice = (price) =>
    `${curCode} ${((Number(price) || 0) * curFactor).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const renderStars = (rating) =>
    Array.from({ length: rating || 0 }, (_, i) => <FaStar key={i} className="text-warning" />);
  const getMealPlanIcon = (mealPlan) => {
    switch ((mealPlan || "").toLowerCase()) {
      case "room only": return <FaBed className="text-muted" />;
      case "breakfast": return <FaUtensils className="text-warning" />;
      case "full board": return <FaUtensils className="text-success" />;
      default: return <FaUtensils className="text-primary" />;
    }
  };
  const getRefundStatusBadge = (nonRefundable) => {
    const v = String(nonRefundable).toLowerCase();
    if (v === "false") return <Badge bg="success">Flexible</Badge>;
    if (v === "true") return <Badge bg="danger">Non-Refundable</Badge>;
    return <Badge bg="secondary">{String(nonRefundable)}</Badge>;
  };

  // Room availability status from POST /api/hotel-rooms/search. Drives the
  // booking flow on the booking page: "On Request" rates book as REQUESTED
  // (no instant voucher); "Available" rates offer Book Now & Voucher Now /
  // Later. Mirrors getRoomStatusBadge in RoomList.jsx.
  const getRoomStatusBadge = (roomStatus) => {
    if (roomStatus === "On Request") {
      return (
        <Badge bg="warning" text="dark" className="px-2 py-1 fw-bold border border-warning">
          On Request
        </Badge>
      );
    }
    return (
      <Badge bg="success" className="px-2 py-1 fw-bold">
        Available
      </Badge>
    );
  };

  useEffect(() => {
    if (!ctx?.hotelCode) {
      setError("Missing hotel context — please go back and search again.");
      setLoading(false);
      return;
    }
    const numericHotelId = String(ctx.hotelCode || "").replace(/\D/g, "");
    (async () => {
      if (!numericHotelId) return;
      try {
        const { data } = await axiosInstance.get(
          `/api/hotel-senior-citizen-promotion/hotel/${numericHotelId}/active?date=${ctx.checkIn || ""}`
        );
        if (data?.active) setActivePromotion(data.promotion);
        else if (data?.promotionId || data?.discountPercent || data?.discountAmount)
          setActivePromotion(data);
      } catch (e) { /* silent — promotion preview is non-blocking */ }
    })();

    (async () => {
      setLoading(true);
      try {
        // Carry forward the EXACT adult ages the user picked on the
        // search page. If we drop them and re-seed with 65, the backend
        // would treat every room as senior-citizen — defeating the
        // explicit per-adult age the user provided.
        const roomsList = Array.isArray(ctx.rooms) && ctx.rooms.length > 0
          ? ctx.rooms.map((r) => ({
              adults: r.adults || 1,
              children: r.children || 0,
              childAges: r.childAges || [],
              adultAges: Array.isArray(r.adultAges) && r.adultAges.length === (r.adults || 1)
                ? r.adultAges
                : Array.from({ length: r.adults || 1 }, () => 65),
            }))
          : Array.from({ length: ctx.noOfRooms || 1 }).map(() => ({
              adults: ctx.adults || 1,
              children: ctx.children || 0,
              childAges: [],
              adultAges: Array.from({ length: ctx.adults || 1 }, () => 65),
            }));

        const payload = {
          checkInDate: ctx.checkIn,
          checkOutDate: ctx.checkOut,
          hotelCode: String(ctx.hotelCode),
          hotelId: Number(numericHotelId) || ctx.hotelId,
          nationality: (ctx.nationalityCode || "IN").toUpperCase().slice(0, 2),
          agentId: String(ctx.agentId || ""),
          apiId: Number(ctx.apiId || 1),
          rooms: roomsList,
        };
        const { data } = await axiosInstance.post("/api/hotel-rooms/search", payload);
        if (!data || data.success === false) {
          setError(data?.message || "No rooms available for the selected hotel / dates.");
          return;
        }
        if (!Array.isArray(data.hotels) || data.hotels.length === 0) {
          setError("No rooms available for the selected hotel / dates.");
          return;
        }
        setRoomData({ ...data, payload });
      } catch (e) {
        console.error("[senior-citizen] room search failed:", e);
        setError(e?.response?.data?.message || "Failed to load rooms.");
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line
  }, [ctx.hotelCode]);

  useEffect(() => {
    if (!ctx?.agentId) { setAgentBalance(null); return; }
    let cancelled = false;
    axiosInstance.get(`/api/agent-credit-limit/agent/${ctx.agentId}`)
      .then((res) => { if (!cancelled) setAgentBalance(res?.data?.availableCreditLimit ?? null); })
      .catch(() => { if (!cancelled) setAgentBalance(null); });
    return () => { cancelled = true; };
  }, [ctx.agentId]);

  const handleBooking = (category, rate) => {
    const base = Number(rate.roomRateBasedOnRoomCount ?? rate.totalRate ?? rate.rate ?? 0);
    const after = applyDiscount(base);
    const selectedRate = {
      hotelId: roomData.hotels?.[0]?.hotelId,
      hotelName: roomData.hotels?.[0]?.hotelName,
      roomCategory: category.roomCategory,
      mealPlan: rate.mealPlan,
      mealPlanCode: rate.mealPlanCode,
      roomTypeCode: rate.roomTypeCode,
      contractLabel: rate.contractLabel,
      nonRefundable: rate.nonRefundable,
      rateBeforeDiscount: base,
      rate: after,
      rateWithoutMarkup: after,
      currency: rate.currency || "AED",
      roomStatus: rate.roomStatus,
      roomRateBasedOnRoomCount: after,
      roomRateBasedOnRoomCount_WithoutMarkup: after,
      cancellationPolicy: roomData.hotels?.[0]?.cancellationPolicies || [],
    };
    const data = {
      selectedRate,
      hotelStaticData: {
        hotelName: roomData.hotels?.[0]?.hotelName,
        address: roomData.hotels?.[0]?.hotelAddress,
        starRating: roomData.hotels?.[0]?.starRating,
        hotelImage: ctx.hotelImage,
        phone: roomData.hotels?.[0]?.hotelPhoneNumber,
      },
      // Forward optional "Booking Done By Employee" from SeniorCitizenSearch
      // onto payload so SeniorCitizenBookingPage can read it.
      payload: {
        ...roomData.payload,
        employeeId: ctx.employeeId || null,
        // "Add New Item" flow — forward the parent code so the create call
        // saves this booking as a child (SNCIT7/1, SNCIT7/2, …).
        parentBookingCode: ctx.parentBookingCode || null,
      },
      activePromotion,
      searchCtx: ctx,
    };
    sessionStorage.setItem("seniorCitizenBookingData", JSON.stringify(data));
    navigate("/senior-citizen-booking-page");
  };

  // ──────────────────────────────────────────────────────────────────────
  // Multi-room helpers (see comment above near `selectedRooms`).
  // ──────────────────────────────────────────────────────────────────────
  const numRooms = (roomData?.payload?.rooms || []).length || 1;
  const isMultiRoom = numRooms > 1;
  const allRoomsSelected =
    selectedRooms.length > 0 &&
    selectedRooms.every((r) => r.selectedRate !== null);

  /** Seed one selection slot per room as soon as the API result
   *  arrives. Re-init only when slot count changes so filter / view
   *  toggles preserve the user's picks. */
  useEffect(() => {
    setSelectedRooms((prev) => {
      if (prev.length === numRooms) return prev;
      return Array.from({ length: numRooms }, (_, i) => ({
        roomNo: i + 1,
        selectedRate: null,
        category: null,
      }));
    });
  }, [numRooms]);

  // Fetch the hotel's in-house policy details once rooms are loaded —
  // same source as /room-list (only meaningful for apiId === 1, the
  // in-house inventory). Failures are swallowed so the page still
  // renders its static fallback policies.
  useEffect(() => {
    const fetchInhousePolicyDetails = async () => {
      const hotelsdetail = roomData?.hotels?.[0];
      if (!hotelsdetail) return;
      if (roomData.payload?.apiId !== 1) return;
      try {
        const response = await axiosInstance.get(
          `/api/hotels/${hotelsdetail.hotelId}/policies`,
        );
        setPolicyList(response.data);
      } catch (error) {
        // Non-fatal — fall back to the static policy block.
      }
    };
    fetchInhousePolicyDetails();
  }, [roomData]);

  /** Toggle the rate for one room slot. Clicking the already-selected
   *  rate clears that slot. */
  const handleRateSelect = (roomIndex, category, rate) => {
    setSelectedRooms((prev) =>
      prev.map((r, i) => {
        if (i !== roomIndex) return r;
        if (r.selectedRate === rate) {
          return { ...r, selectedRate: null, category: null };
        }
        return { ...r, selectedRate: rate, category };
      }),
    );
  };

  /** Combine the per-room picks into the existing single-`selectedRate`
   *  shape `/senior-citizen-booking-page` already understands, then
   *  navigate. Also passes `roomBreakdown` — the booking page reads
   *  per-room values from it when present (see SeniorCitizenBookingPage
   *  `buildPayloadAndShowOrderSummary`); without it, the legacy
   *  selectedRate-only path runs unchanged. */
  const handleProceedBooking = () => {
    if (!allRoomsSelected || !roomData) return;
    try {
      const hotelsdetail = roomData.hotels?.[0];
      if (!hotelsdetail) {
        alert("Hotel context missing. Please refresh and try again.");
        return;
      }
      const primary = selectedRooms[0].selectedRate;

      // Per slot, compute the discounted figure on the per-room rate.
      // Each slot represents ONE room so we DON'T use
      // `roomRateBasedOnRoomCount` (which is already × numberOfRooms).
      const perSlot = selectedRooms.map((r) => {
        const base = Number(r.selectedRate.totalRate ?? r.selectedRate.rate ?? 0);
        const after = applyDiscount(base);
        return { base, after };
      });
      const sumBefore = perSlot.reduce((s, p) => s + p.base, 0);
      const sumAfter = perSlot.reduce((s, p) => s + p.after, 0);

      const combinedSelectedRate = {
        hotelId: hotelsdetail.hotelId,
        hotelName: hotelsdetail.hotelName,
        roomCategory: selectedRooms
          .map((r) => r.category?.roomCategory)
          .filter(Boolean)
          .join(" + "),
        mealPlan: selectedRooms
          .map((r) => r.selectedRate?.mealPlan)
          .filter(Boolean)
          .join(" + "),
        mealPlanCode: primary.mealPlanCode,
        roomTypeCode: primary.roomTypeCode,
        contractLabel: primary.contractLabel,
        nonRefundable: primary.nonRefundable,
        rateBeforeDiscount: sumBefore,
        rate: sumAfter,
        rateWithoutMarkup: sumAfter,
        currency: primary.currency || "AED",
        roomStatus: primary.roomStatus,
        roomRateBasedOnRoomCount: sumAfter,
        roomRateBasedOnRoomCount_WithoutMarkup: sumAfter,
        cancellationPolicy: hotelsdetail.cancellationPolicies || [],
      };

      const data = {
        selectedRate: combinedSelectedRate,
        // Additive — read per-room by SeniorCitizenBookingPage when
        // present. Legacy single-room flows pass no roomBreakdown.
        roomBreakdown: selectedRooms.map((r, i) => {
          const base = Number(r.selectedRate.totalRate ?? r.selectedRate.rate ?? 0);
          const after = applyDiscount(base);
          return {
            roomNo: i + 1,
            roomCategory: r.category?.roomCategory,
            mealPlan: r.selectedRate?.mealPlan,
            mealPlanCode: r.selectedRate?.mealPlanCode,
            roomTypeCode: r.selectedRate?.roomTypeCode,
            contractLabel: r.selectedRate?.contractLabel,
            nonRefundable: !!r.selectedRate?.nonRefundable,
            rate: after,
            rateWithoutMarkup: after,
            rateBeforeDiscount: base,
            currency: r.selectedRate?.currency || "AED",
            roomStatus: r.selectedRate?.roomStatus,
          };
        }),
        hotelStaticData: {
          hotelName: hotelsdetail.hotelName,
          address: hotelsdetail.hotelAddress,
          starRating: hotelsdetail.starRating,
          hotelImage: ctx.hotelImage,
          phone: hotelsdetail.hotelPhoneNumber,
        },
        // Same employeeId forwarding as the single-room flow above.
        payload: {
        ...roomData.payload,
        employeeId: ctx.employeeId || null,
        // "Add New Item" flow — forward the parent code so the create call
        // saves this booking as a child (SNCIT7/1, SNCIT7/2, …).
        parentBookingCode: ctx.parentBookingCode || null,
      },
        activePromotion,
        searchCtx: ctx,
      };
      sessionStorage.setItem("seniorCitizenBookingData", JSON.stringify(data));
      navigate("/senior-citizen-booking-page");
    } catch (err) {
      console.error("Error preparing multi-room bookingData:", err);
      alert("Unable to proceed with booking. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <div className="text-center">
              <Spinner animation="border" variant="primary" />
              <h4 className="text-primary fw-bold mt-3 mb-1">Fetching Best Room Options...</h4>
              <p className="text-muted small mb-0">Applying senior-citizen discount</p>
            </div>
          </main>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center p-3">
            <div className="w-100" style={{ maxWidth: 480 }}>
              <Alert variant="warning">
                <Alert.Heading>Couldn't load rooms</Alert.Heading>
                <p className="mb-0">{error}</p>
              </Alert>
              <Button variant="primary" onClick={() => navigate("/new-booking/senior-citizen")}>
                Back to Search
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const hotel = roomData.hotels[0];
  const payload = roomData.payload || {};

  return (
    <div className="min-vh-100 bg-light d-flex flex-column room-list-container">
      <TopBar />
      <div className="main-content">
        <Sidebar />
        <main className="content-wrapper">
          <div className="container-fluid" style={{ paddingTop: 10 }}>
            {agentBalance != null && (
              <div className="d-flex justify-content-end mb-2" style={{ fontSize: "0.95rem" }}>
                <span className="fw-bold" style={{ color: "#dc3545" }}>
                  Available Balance: {Number(agentBalance).toFixed(2)}
                </span>
              </div>
            )}

            <Card className="hotel-header-card mb-4">
              <Card.Body className="p-4">
                <Row>
                  <Col md={8}>
                    <div className="d-flex align-items-start gap-3">
                      <div className="hotel-icon"><FaHotel size={40} className="text-primary" /></div>
                      <div className="hotel-info">
                        <h2 className="hotel-name mb-2">{hotel.hotelName}</h2>
                        <div className="d-flex align-items-center gap-3 mb-2">
                          <div className="star-rating">{renderStars(hotel.starRating)}</div>
                          {hotel.propertyType && <Badge bg="primary">{hotel.propertyType}</Badge>}
                          {hotel.chain && <Badge bg="info">{hotel.chain}</Badge>}
                          <Badge bg="success" className="d-inline-flex align-items-center">
                            <FaUserClock className="me-1" /> Senior Citizen
                          </Badge>
                        </div>
                        <p className="mb-1">
                          <FaMapMarkerAlt className="text-muted me-2" />
                          {hotel.hotelAddress}
                        </p>
                        <div className="mt-3">
                          <Button variant="outline-primary" size="sm" onClick={() => navigate(-1)}>
                            Back to Search
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <Card className="booking-summary">
                      <Card.Body className="p-3">
                        <h6 className="mb-3">Booking Summary</h6>
                        <div className="d-flex justify-content-between mb-2">
                          <span><FaCalendarAlt className="text-muted me-2" />Check-in:</span>
                          <span className="fw-semibold">{payload.checkInDate || ctx.checkIn}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span><FaCalendarAlt className="text-muted me-2" />Check-out:</span>
                          <span className="fw-semibold">{payload.checkOutDate || ctx.checkOut}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span><FaUsers className="text-muted me-2" />Guests:</span>
                          <span className="fw-semibold">
                            {ctx.adults || 1} adults
                            {ctx.children ? `, ${ctx.children} children` : ""}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span><FaBed className="text-muted me-2" />Rooms:</span>
                          <span className="fw-semibold">{ctx.noOfRooms || 1}</span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span><FaGlobe className="text-muted me-2" />Nationality:</span>
                          <span className="fw-semibold">{ctx.nationalityCode}</span>
                        </div>
                        <hr />
                        {activePromotion ? (
                          <div className="text-success small">
                            <strong>Senior Citizen Discount applied:</strong>{" "}
                            {(() => {
                              const t = activePromotion.discountType;
                              const v = activePromotion.discountValue;
                              if (t === "PERCENTAGE") return `${v}% off`;
                              if (t === "AMOUNT") return `flat ${v}`;
                              // legacy
                              const out = [];
                              if (activePromotion.discountPercent) out.push(`${activePromotion.discountPercent}% off`);
                              if (activePromotion.discountAmount) out.push(`+ flat ${activePromotion.discountAmount}`);
                              return out.join(" ");
                            })()}
                          </div>
                        ) : (
                          <div className="text-muted small">No active senior-citizen discount for this hotel.</div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            <div className="room-categories-section">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="mb-0">Available Room Categories</h4>
                <div className="btn-group shadow-sm gap-1" role="group">
                  <Button variant={viewMode === "grid" ? "primary" : "outline-primary"}
                          size="sm" onClick={() => setViewMode("grid")}>
                    <span className="fs-5" style={{ lineHeight: 1 }}>⊞</span>
                  </Button>
                  <Button variant={viewMode === "list" ? "primary" : "outline-primary"}
                          size="sm" onClick={() => setViewMode("list")}>
                    <span className="fs-5" style={{ lineHeight: 1 }}>☰</span>
                  </Button>
                </div>
              </div>

              <Row className="g-3">
                {/* Filter sidebar — mirrors the RoomList.jsx layout. */}
                <Col lg={3} md={4}>
                  <Card className="room-filters-card">
                    <Card.Body className="p-3">
                      <h6 className="filter-title mb-3">Filters</h6>

                      <div className="filter-group mb-3">
                        <div className="filter-group-label">Refund Policy</div>
                        <Form.Check type="checkbox" id="sc-filter-refundable" label="Refundable"
                          checked={refundFilter.refundable}
                          onChange={(e) =>
                            setRefundFilter((p) => ({ ...p, refundable: e.target.checked }))} />
                        <Form.Check type="checkbox" id="sc-filter-nonrefundable" label="Non Refundable"
                          checked={refundFilter.nonRefundable}
                          onChange={(e) =>
                            setRefundFilter((p) => ({ ...p, nonRefundable: e.target.checked }))} />
                      </div>

                      <div className="filter-group">
                        <div className="filter-group-label">Room Type</div>
                        {roomTypeOptions.length === 0 ? (
                          <div className="text-muted small">No options</div>
                        ) : (
                          roomTypeOptions.map((rt) => (
                            <Form.Check
                              key={rt.roomtypeId ?? rt.code ?? rt.name}
                              type="checkbox"
                              id={`sc-filter-rt-${rt.roomtypeId ?? rt.code ?? rt.name}`}
                              label={rt.name}
                              checked={selectedRoomTypes.includes(rt.name)}
                              onChange={() => toggleRoomType(rt.name)} />
                          ))
                        )}
                      </div>

                      {(refundFilter.refundable || refundFilter.nonRefundable ||
                        selectedRoomTypes.length > 0) && (
                        <Button variant="link" size="sm" className="p-0 mt-2"
                          onClick={() => {
                            setRefundFilter({ refundable: false, nonRefundable: false });
                            setSelectedRoomTypes([]);
                          }}>
                          Clear filters
                        </Button>
                      )}
                    </Card.Body>
                  </Card>
                </Col>

                <Col lg={9} md={8}>
                  {/* Per-room outer wrapper. Single-room mode renders
                      the inner Accordion once, unwrapped — identical
                      to legacy behavior. Multi-room mode renders it
                      once per slot, each wrapped in its own
                      "Room N" Accordion. See RoomList.jsx for the
                      same pattern. */}
                  {(isMultiRoom ? selectedRooms : [null]).map((_slot, roomSlotIndex) => {
                    const inner = (
                  <Accordion activeKey={activeAccordion} onSelect={(k) => setActiveAccordion(k)}>
                    {(hotel.roomCategories || []).map((category, index) => {
                      const eventKey = index.toString();
                      const filteredRates = (category.availableRates || []).filter(matchesFilters);
                      // Skip categories where every rate was filtered out so
                      // the layout doesn't leave a blank, empty accordion.
                      if (filteredRates.length === 0) return null;

                      const lowestAfter = applyDiscount(
                        Math.min(...filteredRates.map((r) => r.rate || 0))
                      );
                      return (
                        <Accordion.Item key={eventKey} eventKey={eventKey} className="room-category-item">
                          <Accordion.Header as="div" className="room-category-header">
                            <div className="d-flex justify-content-between align-items-center w-100">
                              <div className="room-category-info">
                                <h5 className="mb-1">{category.roomCategory}</h5>
                                <p className="mb-0 text-muted small">{category.baseRoomType}</p>
                              </div>
                              <div className="d-flex align-items-center gap-3">
                                <div className="room-category-price text-end">
                                  <div className="price-range">From {formatPrice(lowestAfter)}</div>
                                  <div className="rates-count small text-muted">
                                    {filteredRates.length} rate
                                    {filteredRates.length !== 1 ? "s" : ""} available
                                  </div>
                                </div>
                                {/* Open/closed indicator — up when this
                                    category is expanded, down when collapsed. */}
                                {activeAccordion === eventKey ? (
                                  <FaChevronUp className="text-muted" />
                                ) : (
                                  <FaChevronDown className="text-muted" />
                                )}
                              </div>
                            </div>
                          </Accordion.Header>
                          <Accordion.Body className="room-rates-section">
                            <Row>
                              {filteredRates.map((rate, ri) => {
                                const base = Number(rate.roomRateBasedOnRoomCount ?? rate.totalRate ?? rate.rate ?? 0);
                                const after = applyDiscount(base);
                                return (
                                  <Col key={ri}
                                       lg={viewMode === "grid" ? 6 : 12}
                                       xl={viewMode === "grid" ? 4 : 12}
                                       className="mb-2">
                                    <Card className="rate-card h-100 shadow-sm">
                                      <Card.Body className="p-3 pb-2 d-flex flex-column gap-2">
                                        <div className="rate-header d-flex justify-content-between align-items-start">
                                          <div className="d-flex align-items-center gap-2">
                                            {getMealPlanIcon(rate.mealPlan)}
                                            <span className="fw-semibold small">{rate.mealPlan}</span>
                                          </div>
                                          <div className="d-flex align-items-center gap-2">
                                            {getRoomStatusBadge(rate.roomStatus)}
                                            {getRefundStatusBadge(rate.nonRefundable)}
                                          </div>
                                        </div>
                                        <div className="rate-pricing text-center py-2">
                                          {/* In single-room mode the
                                              big price is the bulk
                                              total (= per-room × N
                                              rooms) and the "× N rooms"
                                              subtitle explains it.
                                              In multi-room mode each
                                              slot is ONE room, so the
                                              big price collapses to
                                              the per-room rate and the
                                              "× N rooms" line drops. */}
                                          {(() => {
                                            const slotBase = isMultiRoom
                                              ? Number(rate.totalRate ?? rate.rate ?? 0)
                                              : base;
                                            const slotAfter = applyDiscount(slotBase);
                                            return (
                                              <>
                                                {activePromotion && slotBase !== slotAfter && (
                                                  <div className="text-decoration-line-through text-muted">
                                                    {formatPrice(slotBase)}
                                                  </div>
                                                )}
                                                <div className="current-price text-success">{formatPrice(slotAfter)}</div>
                                              </>
                                            );
                                          })()}
                                          {!isMultiRoom && (
                                            <div className="text-muted small">
                                              {formatPrice(rate.totalRate || 0)} × {rate.numberOfRooms || 1} rooms
                                            </div>
                                          )}
                                          <div className="price-per-night small text-muted">per night</div>
                                        </div>
                                        <div className="rate-features small">
                                          <div className="feature-item">
                                            <FaInfoCircle className="me-2 text-muted" />
                                            {rate.contractLabel}
                                          </div>
                                          {rate.cancellationPolicies?.length > 0 && (
                                            <div className="feature-item">
                                              <FaShieldAlt className="me-2 text-muted" />
                                              {rate.cancellationPolicies[0].policyText}
                                            </div>
                                          )}
                                        </div>
                                        {/* Single-room: legacy CTA.
                                            Multi-room: radio bound to
                                            the active slot. */}
                                        {isMultiRoom ? (
                                          <Form.Check
                                            type="radio"
                                            id={`sc-rate-radio-${roomSlotIndex}-${index}-${ri}`}
                                            name={`sc-rate-radio-room-${roomSlotIndex}`}
                                            className="w-100 mt-1 mb-1"
                                            label={
                                              selectedRooms[roomSlotIndex]
                                                ?.selectedRate === rate
                                                ? `Selected for Room ${roomSlotIndex + 1}`
                                                : `Select for Room ${roomSlotIndex + 1}`
                                            }
                                            checked={
                                              selectedRooms[roomSlotIndex]
                                                ?.selectedRate === rate
                                            }
                                            onChange={() =>
                                              handleRateSelect(roomSlotIndex, category, rate)
                                            }
                                          />
                                        ) : (
                                          <Button variant="primary" className="w-100 mt-1 mb-1"
                                                  onClick={() => handleBooking(category, rate)}>
                                            <FaMoneyBillWave className="me-2" /> Select & Continue
                                          </Button>
                                        )}
                                      </Card.Body>
                                    </Card>
                                  </Col>
                                );
                              })}
                            </Row>
                          </Accordion.Body>
                        </Accordion.Item>
                      );
                    })}
                    {(hotel.roomCategories || []).every(
                      (c) => (c.availableRates || []).filter(matchesFilters).length === 0
                    ) && (
                      <Alert variant="info" className="mb-0">
                        No rates match the selected filters.
                      </Alert>
                    )}
                  </Accordion>
                    );
                    if (!isMultiRoom) {
                      return (
                        <React.Fragment key="sc-single-room">{inner}</React.Fragment>
                      );
                    }
                    const slotSelection = selectedRooms[roomSlotIndex];
                    const slotPerRoomRate = slotSelection?.selectedRate
                      ? applyDiscount(
                          Number(
                            slotSelection.selectedRate.totalRate ??
                              slotSelection.selectedRate.rate ??
                              0,
                          ),
                        )
                      : null;
                    return (
                      <Accordion
                        key={`sc-room-slot-${roomSlotIndex}`}
                        defaultActiveKey={`sc-room-slot-${roomSlotIndex}`}
                        className="mb-3 room-slot-accordion"
                      >
                        <Accordion.Item eventKey={`sc-room-slot-${roomSlotIndex}`}>
                          <Accordion.Header>
                            <div className="d-flex w-100 justify-content-between align-items-center pe-3">
                              <span className="fw-semibold">
                                <FaBed className="me-2 text-primary" />
                                Room {roomSlotIndex + 1}
                              </span>
                              {slotSelection?.selectedRate ? (
                                <Badge bg="success" className="ms-2">
                                  {slotSelection.category?.roomCategory}
                                  {" — "}
                                  {formatPrice(slotPerRoomRate || 0)}
                                </Badge>
                              ) : (
                                <Badge bg="warning" text="dark" className="ms-2">
                                  Not selected
                                </Badge>
                              )}
                            </div>
                          </Accordion.Header>
                          <Accordion.Body>{inner}</Accordion.Body>
                        </Accordion.Item>
                      </Accordion>
                    );
                  })}

                  {/* Multi-room "Continue with Booking" CTA. Disabled
                      until every slot has a rate. */}
                  {isMultiRoom && (() => {
                    // Highlighted status banner for multi-room progress.
                    // Colour + icon flip from amber (in progress) to green
                    // (all rooms picked). Logic unchanged — same disable
                    // rule and handleProceedBooking handler as before.
                    const selectedCount = selectedRooms.filter(
                      (r) => r.selectedRate,
                    ).length;
                    const pct =
                      numRooms > 0
                        ? Math.round((selectedCount / numRooms) * 100)
                        : 0;
                    const done = allRoomsSelected;
                    const accent = done ? "#198754" : "#fd7e14";
                    return (
                      <div
                        className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mt-3 p-3 rounded-3 shadow-sm"
                        style={{
                          borderLeft: `6px solid ${accent}`,
                          border: `1px solid ${done ? "#a7d7b8" : "#fed7aa"}`,
                          backgroundColor: done ? "#e8f5ec" : "#fff7ed",
                        }}
                      >
                        <div className="d-flex align-items-center gap-3">
                          <div
                            className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                            style={{
                              width: 46,
                              height: 46,
                              backgroundColor: accent,
                              color: "#fff",
                              fontSize: "1.3rem",
                            }}
                          >
                            {done ? <FaCheckCircle /> : <FaInfoCircle />}
                          </div>
                          <div>
                            <div
                              className="fw-bold"
                              style={{
                                fontSize: "1.05rem",
                                color: done ? "#14653a" : "#9a3412",
                              }}
                            >
                              {done
                                ? `All ${numRooms} room${numRooms === 1 ? "" : "s"} selected`
                                : `Select rates for your ${numRooms} rooms`}
                            </div>
                            <div className="small text-muted mb-2">
                              {done
                                ? "You can continue to booking."
                                : `Pick a rate for each room to continue — ${selectedCount} of ${numRooms} selected.`}
                            </div>
                            <div
                              className="progress"
                              style={{
                                height: 6,
                                width: 240,
                                maxWidth: "100%",
                                backgroundColor: "#e9ecef",
                              }}
                            >
                              <div
                                className="progress-bar"
                                role="progressbar"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: accent,
                                  transition: "width .3s ease",
                                }}
                                aria-valuenow={selectedCount}
                                aria-valuemin={0}
                                aria-valuemax={numRooms}
                              />
                            </div>
                          </div>
                        </div>
                        <Button
                          variant={done ? "success" : "primary"}
                          size="lg"
                          disabled={!allRoomsSelected}
                          onClick={handleProceedBooking}
                          className="flex-shrink-0"
                        >
                          <FaMoneyBillWave className="me-2" />
                          Continue with Booking
                        </Button>
                      </div>
                    );
                  })()}
                </Col>
              </Row>
            </div>

            {/* Policies Section — Cancellation, Amendment, Child, and
                Additional Policy in a single card. Dynamic in-house
                policies (apiId === 1) fall back to static stay details
                otherwise. Mirrors /room-list. */}
            <div className="mt-4">
              <Card
                className="mb-4 shadow-sm"
                style={{ overflow: "hidden", border: "1px solid #dbe3ef" }}
              >
                <Card.Header
                  className="d-flex align-items-center gap-3 py-3"
                  style={{
                    background:
                      "linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)",
                    color: "#fff",
                    border: "none",
                  }}
                >
                  <div
                    className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: "rgba(255,255,255,.18)",
                      fontSize: "1.15rem",
                    }}
                  >
                    <FaShieldAlt />
                  </div>
                  <div>
                    <div
                      className="fw-bold"
                      style={{ fontSize: "1.1rem", lineHeight: 1.2 }}
                    >
                      Booking Policies
                    </div>
                    <div className="small" style={{ opacity: 0.85 }}>
                      Cancellation, amendment &amp; stay details
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className="p-4">
                  {payload.apiId === 1 && policyList && policyList.policies ? (
                    <div className="policies-dynamic">
                      {/* Cancellation Policy */}
                      {policyList.policies?.cancellationPolicy &&
                        policyList.policies.cancellationPolicy.length > 0 && (
                          <div className="mb-3">
                            <h6 className="text-danger mb-2">
                              <FaTimesCircle className="me-2" />
                              Cancellation Policy
                            </h6>
                            {policyList.policies.cancellationPolicy.map(
                              (policy, index) => {
                                const validity = renderPolicyValidity(
                                  policy.fromDate,
                                  policy.toDate,
                                );
                                return (
                                  <div key={index} className="policy-item mb-2">
                                    <p className="text-muted mb-1">
                                      {policy.policyText}
                                    </p>
                                    {validity && (
                                      <small
                                        className="text-muted"
                                        style={{
                                          fontWeight: "400",
                                          fontSize: "0.99rem",
                                        }}
                                      >
                                        {validity}
                                      </small>
                                    )}
                                  </div>
                                );
                              },
                            )}
                          </div>
                        )}

                      {/* Amendment Policy */}
                      {policyList.policies?.amendmentPolicy &&
                        policyList.policies.amendmentPolicy.length > 0 && (
                          <div className="mb-3">
                            <h6 className="text-warning mb-2">
                              <FaInfoCircle className="me-2" />
                              Amendment Policy
                            </h6>
                            {policyList.policies.amendmentPolicy.map(
                              (policy, index) => {
                                const validity = renderPolicyValidity(
                                  policy.fromDate,
                                  policy.toDate,
                                );
                                return (
                                  <div key={index} className="policy-item mb-2">
                                    <p className="text-muted mb-1">
                                      {policy.policyText}
                                    </p>
                                    {validity && (
                                      <small
                                        style={{
                                          fontWeight: "400",
                                          fontSize: "0.99rem",
                                        }}
                                        className="text-muted"
                                      >
                                        {validity}
                                      </small>
                                    )}
                                  </div>
                                );
                              },
                            )}
                          </div>
                        )}

                      {/* Child Policy */}
                      {policyList.policies?.childPolicy &&
                        policyList.policies.childPolicy.length > 0 && (
                          <div className="mb-3">
                            <h6 className="text-primary mb-2">
                              <FaUsers className="me-2" />
                              Child Policy
                            </h6>
                            {policyList.policies.childPolicy.map(
                              (policy, index) => (
                                <p key={index} className="mb-2 text-muted">
                                  {policy.policyText}
                                </p>
                              ),
                            )}
                          </div>
                        )}

                      {/* Additional Policy — fees stored on the policy
                          row (no-show, early-departure, non-refundable).
                          Suppress empty zero/null amounts. */}
                      {policyList.policies?.additionalPolicy &&
                        (() => {
                          const ap = policyList.policies.additionalPolicy;
                          const formatFee = (amt, type) => {
                            if (
                              amt === null ||
                              amt === undefined ||
                              Number(amt) === 0
                            )
                              return null;
                            const suffix =
                              String(type || "").toUpperCase() === "PERCENT"
                                ? "%"
                                : "";
                            return `${amt}${suffix}`;
                          };
                          const noShow = formatFee(ap.noShowFee, ap.noShowFeeType);
                          const earlyDep = formatFee(
                            ap.earlyDepartureFee,
                            ap.earlyDepartureFeeType,
                          );
                          const nonRef = formatFee(
                            ap.nonRefundableFee,
                            ap.nonRefundableFeeType,
                          );
                          if (!noShow && !earlyDep && !nonRef) return null;
                          return (
                            <div className="mb-3">
                              <h6 className="text-info mb-2">
                                <FaInfoCircle className="me-2" />
                                Additional Policy
                              </h6>
                              {noShow && (
                                <p className="mb-1 text-muted">
                                  <strong>No-Show Fee:</strong> {noShow}
                                </p>
                              )}
                              {earlyDep && (
                                <p className="mb-1 text-muted">
                                  <strong>Early Departure Fee:</strong>{" "}
                                  {earlyDep}
                                </p>
                              )}
                              {nonRef && (
                                <p className="mb-1 text-muted">
                                  <strong>Non-Refundable Fee:</strong> {nonRef}
                                </p>
                              )}
                            </div>
                          );
                        })()}

                      {/* General Policies */}
                      <h6 className="text-secondary mb-2 pt-2 border-top">
                        <FaHotel className="me-2" />
                        Hotel Information
                      </h6>
                      <Row className="g-3">
                        <Col md={6}>
                          <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                            <span className="text-muted">Check-in</span>
                            <span className="fw-semibold">After 14:00</span>
                          </div>
                          <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                            <span className="text-muted">Check-out</span>
                            <span className="fw-semibold">Before 12:00</span>
                          </div>
                        </Col>
                        <Col md={6}>
                          <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                            <span className="text-muted">Deposit</span>
                            <span className="fw-semibold">May be required</span>
                          </div>
                          <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                            <span className="text-muted">Additional Bed</span>
                            <span className="fw-semibold">
                              Subject to availability
                            </span>
                          </div>
                        </Col>
                      </Row>
                    </div>
                  ) : (
                    <Row className="g-3">
                      <Col md={6}>
                        <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                          <span className="text-muted">Check-in</span>
                          <span className="fw-semibold">After 14:00</span>
                        </div>
                        <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                          <span className="text-muted">Check-out</span>
                          <span className="fw-semibold">Before 12:00</span>
                        </div>
                        <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                          <span className="text-muted">Children</span>
                          <span className="fw-semibold">
                            Policies vary by room
                          </span>
                        </div>
                      </Col>
                      <Col md={6}>
                        <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                          <span className="text-muted">Deposit</span>
                          <span className="fw-semibold">May be required</span>
                        </div>
                        <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                          <span className="text-muted">Additional Bed</span>
                          <span className="fw-semibold">
                            Subject to availability
                          </span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span className="text-muted">Cancellation</span>
                          <span className="fw-semibold">
                            See rate conditions
                          </span>
                        </div>
                      </Col>
                    </Row>
                  )}
                </Card.Body>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
