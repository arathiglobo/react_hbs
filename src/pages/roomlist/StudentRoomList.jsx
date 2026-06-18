/**
 * StudentRoomList.jsx
 *
 * Room-list page for the student flow. Layout mirrors /room-list
 * (RoomList.jsx) — same hotel header card + booking summary side
 * panel + accordion of room categories with grid/list view toggle.
 *
 * Discount preview math is applied client-side (the server re-applies
 * authoritatively at booking time).
 *
 * Endpoints used:
 *   POST /api/hotel-rooms/search  (same as RoomList — unchanged)
 *   GET  /api/hotel-student-discount-promotion/hotel/{numericId}/active?date=...
 */

import React, { useEffect, useMemo, useState } from "react";
import { Card, Button, Row, Col, Badge, Accordion, Spinner, Alert, Form } from "react-bootstrap";
import {
  FaBed, FaUtensils, FaStar, FaMapMarkerAlt, FaCalendarAlt, FaUsers,
  FaInfoCircle, FaHotel, FaMoneyBillWave, FaShieldAlt, FaGlobe, FaGraduationCap,
  FaChevronDown,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import RoomFilters from "../../components/roomlist/RoomFilters";
import useRoomFilters from "../../hooks/useRoomFilters";
import "../../styles/RoomList.css";

export default function StudentRoomList() {
  const location = useLocation();
  const navigate = useNavigate();
  // StudentSearch now opens this page in a NEW tab, where React Router's
  // navigate-state isn't available. Fall back to the handoff context that
  // StudentSearch persisted to localStorage (shared across same-origin tabs).
  const ctx = useMemo(() => {
    if (location.state) return location.state;
    try {
      const raw = localStorage.getItem("studentRoomListCtx");
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }, [location.state]);

  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agentBalance, setAgentBalance] = useState(null);
  const [activePromotion, setActivePromotion] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [activeAccordion, setActiveAccordion] = useState("0");

  // ──────────────────────────────────────────────────────────────────────
  // Multi-room selection (per-room slots) — mirrors SeniorCitizenRoomList.
  //
  // Single-room searches (numRooms === 1) keep the legacy
  // `handleBooking` flow — the "Select & Continue" button stays
  // untouched and navigates to /student-booking-page with the
  // single-room bookingData shape.
  //
  // Multi-room searches (numRooms > 1) render a per-room outer
  // Accordion. Each rate's button becomes a radio bound to its slot.
  // `handleProceedBooking` combines the picks into the legacy
  // single-`selectedRate` shape (concatenated category/meal labels,
  // summed totals) AND carries per-room detail as an additive
  // `roomBreakdown` array which StudentBookingPage reads to build
  // the per-room payload — so each room's actual rate is what lands
  // in the DB.
  // ──────────────────────────────────────────────────────────────────────
  const [selectedRooms, setSelectedRooms] = useState([]);

  // Shared Room-Type + Refund-Policy filters (same UX as /room-list).
  const filters = useRoomFilters();
  // Normalise a rate into the predicate's shape (student rates use the
  // string `nonRefundable` + `mealPlan` fields, same as RoomList).
  const rateVisible = (r) =>
    filters.rateMatches({
      isNonRefundable: String(r.nonRefundable).toLowerCase() === "true",
      mealPlan: r.mealPlan,
    });

  const applyDiscount = (base) => {
    if (base == null) return base;
    let out = Number(base);
    if (activePromotion) {
      if (activePromotion.discountPercent) {
        out = out * (1 - Number(activePromotion.discountPercent) / 100);
      }
      if (activePromotion.discountAmount) {
        out = out - Number(activePromotion.discountAmount);
      }
    }
    return Math.max(0, +out.toFixed(2));
  };

  // Display currency carried over from the search page (rates are AED; this
  // converts them for display only and rides the booking handoff). AED → 1.
  const _stCur = ctx?.currency || { code: "AED", factor: 1 };
  const curCode = _stCur.code || "AED";
  const curFactor = Number(_stCur.factor) > 0 ? Number(_stCur.factor) : 1;
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

  // Per-rate availability indicator — mirrors RoomList.jsx so each rate
  // clearly shows whether it is bookable immediately ("Available", green) or
  // needs supplier confirmation ("On Request", amber). The roomStatus flows
  // through the booking handoff and drives the booking-page flow:
  //   Available + refundable → Voucher Now / Voucher Later choice
  //   On Request             → REQUESTED (no choice)
  const getRoomStatusBadge = (roomStatus) => {
    switch (roomStatus) {
      case "On Request":
        return (
          <Badge
            bg="warning"
            text="dark"
            className="px-2 py-1 fw-bold border border-warning shadow-sm"
          >
            On Request
          </Badge>
        );
      case "Available":
        return (
          <span style={{ color: "#198754", fontWeight: 700, fontSize: "0.78rem" }}>
            Available
          </span>
        );
      default:
        return roomStatus ? (
          <span style={{ color: "#198754", fontWeight: 700, fontSize: "0.78rem" }}>
            Available
          </span>
        ) : null;
    }
  };

  useEffect(() => {
    if (!ctx?.hotelCode) {
      setError("Missing hotel context — please go back and search again.");
      setLoading(false);
      return;
    }
    // Strip prefix ("IN11" → "11") so the master-ID lookup works.
    const numericHotelId = String(ctx.hotelCode || "").replace(/\D/g, "");
    (async () => {
      if (!numericHotelId) return;
      try {
        const { data } = await axiosInstance.get(
          `/api/hotel-student-discount-promotion/hotel/${numericHotelId}/active?date=${ctx.checkIn || ""}`
        );
        if (data?.active) setActivePromotion(data.promotion);
      } catch (e) { /* silent */ }
    })();

    (async () => {
      setLoading(true);
      try {
        const payload = {
          checkInDate: ctx.checkIn,
          checkOutDate: ctx.checkOut,
          hotelCode: String(ctx.hotelCode),
          nationality: (ctx.nationalityCode || "IN").toUpperCase().slice(0, 2),
          agentId: String(ctx.agentId || ""),
          apiId: Number(ctx.apiId || 1),
          rooms: Array.from({ length: ctx.noOfRooms || 1 }).map(() => ({
            adults: ctx.adults || 1,
            children: ctx.children || 0,
            childAges: [],
            adultAges: Array.from({ length: ctx.adults || 1 }, () => 30),
          })),
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
        console.error("[student] room search failed:", e);
        setError(e?.response?.data?.message || "Failed to load rooms.");
      } finally {
        setLoading(false);
      }
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
      // Forward optional "Booking Done By Employee" picked in StudentSearch
      // onto payload so StudentBookingPage can include it in the create body.
      payload: {
        ...roomData.payload,
        employeeId: ctx.employeeId || null,
        // "Add New Item" flow — forward the parent code so the create call
        // saves this booking as a child (STU7/1, STU7/2, …).
        parentBookingCode: ctx.parentBookingCode || null,
      },
      activePromotion,
      searchCtx: ctx,
    };
    sessionStorage.setItem("studentBookingData", JSON.stringify(data));
    navigate("/student-booking-page");
  };

  // ──────────────────────────────────────────────────────────────────────
  // Multi-room helpers (see comment near `selectedRooms`).
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

  /** Combine the per-room picks into the legacy single-`selectedRate`
   *  shape /student-booking-page already understands, then navigate.
   *  Also passes `roomBreakdown` — StudentBookingPage reads per-room
   *  rate/category/meal from it when present, so each room is saved
   *  with its OWN rate in the DB. */
  const handleProceedBooking = () => {
    if (!allRoomsSelected || !roomData) return;
    try {
      const hotelsdetail = roomData.hotels?.[0];
      if (!hotelsdetail) {
        alert("Hotel context missing. Please refresh and try again.");
        return;
      }
      const primary = selectedRooms[0].selectedRate;

      // Per slot, discount the per-room rate (totalRate ?? rate).
      // Each slot = ONE room so we DON'T use
      // `roomRateBasedOnRoomCount` (that's already × numberOfRooms).
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
        // Additive — read per-room by StudentBookingPage when present.
        // Legacy single-room flows pass no roomBreakdown.
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
        // saves this booking as a child (STU7/1, STU7/2, …).
        parentBookingCode: ctx.parentBookingCode || null,
      },
        activePromotion,
        searchCtx: ctx,
      };
      sessionStorage.setItem("studentBookingData", JSON.stringify(data));
      navigate("/student-booking-page");
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
              <p className="text-muted small mb-0">Applying student discount</p>
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
              <Alert variant="warning"><Alert.Heading>Couldn't load rooms</Alert.Heading><p className="mb-0">{error}</p></Alert>
              <Button variant="primary" onClick={() => navigate("/new-booking/student")}>Back to Search</Button>
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
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="content-wrapper flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
          <div className="container-fluid" style={{ paddingTop: 10 }}>
            {agentBalance != null && (
              <div className="d-flex justify-content-end mb-2" style={{ fontSize: "0.95rem" }}>
                <span className="fw-bold" style={{ color: "#dc3545" }}>
                  Available Balance: {Number(agentBalance).toFixed(2)}
                </span>
              </div>
            )}

            {/* Hotel header */}
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
                            <FaGraduationCap className="me-1" /> Student Flow
                          </Badge>
                        </div>
                        <p className="mb-1">
                          <FaMapMarkerAlt className="text-muted me-2" />
                          {hotel.hotelAddress}
                        </p>
                        <div className="mt-3">
                          <Button variant="outline-primary" size="sm" onClick={() => navigate(-1)}>Back to Search</Button>
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
                          <span className="fw-semibold">{hotel.guestBreakdown ||
                            `${ctx.adults || 1} adults${ctx.children ? `, ${ctx.children} children` : ""}`}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span><FaBed className="text-muted me-2" />Rooms:</span>
                          <span className="fw-semibold">{hotel.numberOfRooms || ctx.noOfRooms || 1}</span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span><FaGlobe className="text-muted me-2" />Nationality:</span>
                          <span className="fw-semibold">{hotel.nationality || ctx.nationalityCode}</span>
                        </div>
                        <hr />
                        {activePromotion ? (
                          <div className="text-success small">
                            <strong>Student Discount applied:</strong>{" "}
                            {activePromotion.discountPercent ? `${activePromotion.discountPercent}% off` : ""}
                            {activePromotion.discountAmount ? ` + flat ${activePromotion.discountAmount}` : ""}
                          </div>
                        ) : (
                          <div className="text-muted small">No active student discount.</div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Rooms */}
            <div className="room-categories-section">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="mb-0">Available Room Categories</h4>
                <div className="btn-group shadow-sm gap-1" role="group">
                  <Button variant={viewMode === "grid" ? "primary" : "outline-primary"}
                          size="sm" onClick={() => setViewMode("grid")}>⊞</Button>
                  <Button variant={viewMode === "list" ? "primary" : "outline-primary"}
                          size="sm" onClick={() => setViewMode("list")}>☰</Button>
                </div>
              </div>

              <Row className="g-3">
                <Col lg={3} md={4}>
                  <RoomFilters filters={filters} />
                </Col>
                <Col lg={9} md={8}>
              {/* Per-room outer wrapper. Single-room mode renders
                  the inner Accordion once, unwrapped — identical to
                  legacy behavior. Multi-room mode renders it once
                  per slot, each wrapped in its own "Room N"
                  Accordion. */}
              {(isMultiRoom ? selectedRooms : [null]).map((_slot, roomSlotIndex) => {
                const inner = (
              <Accordion activeKey={activeAccordion} onSelect={(k) => setActiveAccordion(k)}>
                {(hotel.roomCategories || []).map((category, index) => {
                  const eventKey = index.toString();
                  const filteredRates = (category.availableRates || []).filter(rateVisible);
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
                            {/* Down-arrow indicator. This header is rendered
                                `as="div"` (not a Bootstrap button), so the
                                default accordion chevron never appears — add an
                                explicit one that rotates 180° when this item is
                                the open accordion. */}
                            <FaChevronDown
                              className="text-primary flex-shrink-0"
                              style={{
                                transition: "transform 0.25s ease",
                                transform:
                                  activeAccordion === eventKey
                                    ? "rotate(180deg)"
                                    : "rotate(0deg)",
                              }}
                            />
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
                                      <div>
                                        <div className="d-flex align-items-center gap-2">
                                          {getMealPlanIcon(rate.mealPlan)}
                                          <span className="fw-semibold small">{rate.mealPlan}</span>
                                        </div>
                                        {/* Availability — Available (green) /
                                            On Request (amber), mirrors RoomList.jsx */}
                                        <div className="mt-1">
                                          {getRoomStatusBadge(rate.roomStatus)}
                                        </div>
                                      </div>
                                      {getRefundStatusBadge(rate.nonRefundable)}
                                    </div>
                                    <div className="rate-pricing text-center py-2">
                                      {/* Single-room: big price is the
                                          bulk total (= per-room × N
                                          rooms) with "× N rooms"
                                          subtitle. Multi-room: each
                                          slot is ONE room so the big
                                          price collapses to the per-
                                          room rate and "× N rooms"
                                          drops. */}
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
                                          {formatPrice(rate.totalRate || 0)} × {rate.numberOfRooms || 1} room
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
                                        Multi-room: radio bound to the
                                        active slot. */}
                                    {isMultiRoom ? (
                                      <Form.Check
                                        type="radio"
                                        id={`st-rate-radio-${roomSlotIndex}-${index}-${ri}`}
                                        name={`st-rate-radio-room-${roomSlotIndex}`}
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
                  (c) => (c.availableRates || []).filter(rateVisible).length === 0,
                ) && (
                  <Alert variant="info" className="mb-0">
                    No rates match the selected filters.
                  </Alert>
                )}
              </Accordion>
                );
                if (!isMultiRoom) {
                  return (
                    <React.Fragment key="st-single-room">{inner}</React.Fragment>
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
                    key={`st-room-slot-${roomSlotIndex}`}
                    defaultActiveKey={`st-room-slot-${roomSlotIndex}`}
                    className="mb-3 room-slot-accordion"
                  >
                    <Accordion.Item eventKey={`st-room-slot-${roomSlotIndex}`}>
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

              {/* Multi-room "Continue with Booking" CTA — disabled
                  until every slot has a rate. */}
              {isMultiRoom && (
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mt-3 p-3 border rounded bg-light">
                  <div className="small text-muted">
                    {allRoomsSelected
                      ? `All ${numRooms} room${numRooms === 1 ? "" : "s"} selected. You can continue to booking.`
                      : `Pick a rate for each of the ${numRooms} rooms to continue. ${selectedRooms.filter((r) => r.selectedRate).length}/${numRooms} selected.`}
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    disabled={!allRoomsSelected}
                    onClick={handleProceedBooking}
                  >
                    <FaMoneyBillWave className="me-2" />
                    Continue with Booking
                  </Button>
                </div>
              )}
                </Col>
              </Row>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
