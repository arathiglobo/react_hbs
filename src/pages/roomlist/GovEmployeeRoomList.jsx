/**
 * GovEmployeeRoomList.jsx
 *
 * Room-list page for the gov-employee flow.
 *
 * Layout / look-and-feel mirrors the standard /room-list page
 * (RoomList.jsx) — same hotel header card, booking summary side
 * panel and accordion of room categories with grid/list view toggle.
 *
 * Functional differences:
 *   1) Fetches the active gov-employee promotion for the hotel.
 *   2) For every per-rate amount it shows BOTH the standard price
 *      (struck-through) AND the discounted price (in green).
 *   3) The "Select" button forwards the rate to the gov-employee
 *      booking page with the rateBeforeDiscount + post-discount rate
 *      so the server can re-apply the discount authoritatively.
 *
 * Endpoint:
 *   POST /api/hotel-rooms/search  (same as RoomList — unchanged)
 */

import React, { useEffect, useState } from "react";
import {
  Card,
  Button,
  Row,
  Col,
  Badge,
  Accordion,
  Spinner,
  Alert,
} from "react-bootstrap";
import {
  FaBed,
  FaUtensils,
  FaStar,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaUsers,
  FaInfoCircle,
  FaHotel,
  FaMoneyBillWave,
  FaShieldAlt,
  FaGlobe,
  FaIdBadge,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import RoomFilters from "../../components/roomlist/RoomFilters";
import useRoomFilters from "../../hooks/useRoomFilters";
import "../../styles/RoomList.css";

const GovEmployeeRoomList = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Search-state passed from the gov-employee search page.
  const ctx = location.state || {};

  const [roomData, setRoomData] = useState(null);   // /api/hotel-rooms/search response
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agentBalance, setAgentBalance] = useState(null);
  const [activePromotion, setActivePromotion] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [activeAccordion, setActiveAccordion] = useState("0");

  // Shared Room-Type + Refund-Policy filters (same UX as /room-list).
  const filters = useRoomFilters();
  const rateVisible = (r) =>
    filters.rateMatches({
      isNonRefundable: String(r.nonRefundable).toLowerCase() === "true",
      mealPlan: r.mealPlan,
    });

  // ── Helpers ─────────────────────────────────────────────────────
  // Apply gov-employee promotion: % then flat. Never returns < 0.
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

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" })
      .format(Number(price) || 0);

  const renderStars = (rating) =>
    Array.from({ length: rating || 0 }, (_, i) => (
      <FaStar key={i} className="text-warning" />
    ));

  const getMealPlanIcon = (mealPlan) => {
    switch ((mealPlan || "").toLowerCase()) {
      case "room only":  return <FaBed className="text-muted" />;
      case "breakfast":  return <FaUtensils className="text-warning" />;
      case "full board": return <FaUtensils className="text-success" />;
      default:           return <FaUtensils className="text-primary" />;
    }
  };

  const getRefundStatusBadge = (nonRefundable) => {
    const v = String(nonRefundable).toLowerCase();
    if (v === "false") return <Badge bg="success">Flexible</Badge>;
    if (v === "true")  return <Badge bg="danger">Non-Refundable</Badge>;
    return <Badge bg="secondary">{String(nonRefundable)}</Badge>;
  };

  // ── Fetch active promotion + rooms ──────────────────────────────
  useEffect(() => {
    if (!ctx?.hotelCode) {
      setError("Missing hotel context — please go back and search again.");
      setLoading(false);
      return;
    }

    // 1) Active gov-employee promotion for this hotel (preview-only).
    //
    //    The hotelCode that comes from the search results may include
    //    the supplier prefix (e.g. "IN11"). Promotions are stored
    //    keyed on the numeric master hotelId, so strip non-digits
    //    before hitting the endpoint.
    const numericHotelId = String(ctx.hotelCode || "").replace(/\D/g, "");
    (async () => {
      if (!numericHotelId) return;
      try {
        const { data } = await axiosInstance.get(
          `/api/hotel-gov-employee-promotion/hotel/${numericHotelId}/active?date=${ctx.checkIn || ""}`
        );
        if (data?.active) setActivePromotion(data.promotion);
      } catch (e) { /* silent — preview only */ }
    })();

    // 2) Room availability — same endpoint the standard RoomList uses.
    (async () => {
      setLoading(true);
      try {
        const payload = {
          checkInDate: ctx.checkIn,
          checkOutDate: ctx.checkOut,
          hotelCode: String(ctx.hotelCode),
          // 2-letter ISO code — required by backend @Pattern("[A-Z]{2}").
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
        console.error("[gov-employee] room search failed:", e);
        setError(e?.response?.data?.message || "Failed to load rooms.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [ctx.hotelCode]);

  // ── Agent credit balance display ───────────────────────────────
  useEffect(() => {
    if (!ctx?.agentId) { setAgentBalance(null); return; }
    let cancelled = false;
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${ctx.agentId}`)
      .then((res) => { if (!cancelled) setAgentBalance(res?.data?.availableCreditLimit ?? null); })
      .catch(() => { if (!cancelled) setAgentBalance(null); });
    return () => { cancelled = true; };
  }, [ctx.agentId]);

  // ── "Select" a rate → navigate to gov-employee booking page ───
  const handleBooking = (category, rate) => {
    // We send a single-rate selection (one click = one booking) —
    // matches the standard /hotel-booking-page flow.
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

    // sessionStorage handoff — same pattern HotelBookingPage uses.
    const govBookingData = {
      selectedRate,
      hotelStaticData: {
        hotelName: roomData.hotels?.[0]?.hotelName,
        address: roomData.hotels?.[0]?.hotelAddress,
        starRating: roomData.hotels?.[0]?.starRating,
        hotelImage: ctx.hotelImage,
        phone: roomData.hotels?.[0]?.hotelPhoneNumber,
      },
      payload: roomData.payload,
      activePromotion,
      searchCtx: ctx,
    };
    sessionStorage.setItem("govEmployeeBookingData", JSON.stringify(govBookingData));
    navigate("/gov-employee-booking-page");
  };

  // ── Loading / error / empty states (match standard look) ───────
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
              <p className="text-muted small mb-0">Applying government-employee discount</p>
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
              <Button variant="primary" onClick={() => navigate("/new-booking/gov-employee")}>Back to Search</Button>
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
            {/* Agent balance — top right */}
            {agentBalance != null && (
              <div className="d-flex justify-content-end mb-2" style={{ fontSize: "0.95rem" }}>
                <span className="fw-bold" style={{ color: "#dc3545" }}>
                  Available Balance: {Number(agentBalance).toFixed(2)}
                </span>
              </div>
            )}

            {/* Hotel Header */}
            <Card className="hotel-header-card mb-4">
              <Card.Body className="p-4">
                <Row>
                  <Col md={8}>
                    <div className="d-flex align-items-start gap-3">
                      <div className="hotel-icon">
                        <FaHotel size={40} className="text-primary" />
                      </div>
                      <div className="hotel-info">
                        <h2 className="hotel-name mb-2">{hotel.hotelName}</h2>
                        <div className="d-flex align-items-center gap-3 mb-2">
                          <div className="star-rating">{renderStars(hotel.starRating)}</div>
                          {hotel.propertyType && <Badge bg="primary">{hotel.propertyType}</Badge>}
                          {hotel.chain && <Badge bg="info">{hotel.chain}</Badge>}
                          <Badge bg="success" className="d-inline-flex align-items-center">
                            <FaIdBadge className="me-1" /> Gov-Employee Flow
                          </Badge>
                        </div>
                        <p className="mb-1">
                          <FaMapMarkerAlt className="text-muted me-2" />
                          {hotel.hotelAddress}
                        </p>
                        {hotel.hotelPhoneNumber && (
                          <p className="mb-0 text-muted small">{hotel.hotelPhoneNumber}</p>
                        )}
                        <div className="mt-3">
                          <Button variant="outline-primary" size="sm" onClick={() => navigate(-1)}>
                            Back to Search
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Col>

                  {/* Booking Summary (side panel) */}
                  <Col md={4}>
                    <Card className="booking-summary">
                      <Card.Body className="p-3">
                        <h6 className="mb-3">Booking Summary</h6>
                        <div className="booking-details">
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
                        </div>

                        {/* Gov-Employee Discount banner */}
                        <hr />
                        {activePromotion ? (
                          <div className="text-success small">
                            <strong>Gov Discount applied:</strong>{" "}
                            {activePromotion.discountPercent ? `${activePromotion.discountPercent}% off` : ""}
                            {activePromotion.discountAmount ? ` + flat ${activePromotion.discountAmount}` : ""}
                          </div>
                        ) : (
                          <div className="text-muted small">No active gov-employee discount.</div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Room Categories Accordion */}
            <div className="room-categories-section">
              <div className="d-flex justify-content-between align-items-center mb-4">
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
                <Col lg={3} md={4}>
                  <RoomFilters filters={filters} />
                </Col>
                <Col lg={9} md={8}>
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
                          </div>
                        </div>
                      </Accordion.Header>

                      <Accordion.Body className="room-rates-section">
                        <Row>
                          {filteredRates.map((rate, rateIndex) => {
                            const base = Number(rate.roomRateBasedOnRoomCount ?? rate.totalRate ?? rate.rate ?? 0);
                            const after = applyDiscount(base);
                            return (
                              <Col key={rateIndex}
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
                                      </div>
                                      {getRefundStatusBadge(rate.nonRefundable)}
                                    </div>

                                    {/* Price block with strike-through standard + green discounted */}
                                    <div className="rate-pricing text-center py-2">
                                      {activePromotion && base !== after && (
                                        <div className="original-price text-decoration-line-through text-muted">
                                          {formatPrice(base)}
                                        </div>
                                      )}
                                      <div className="current-price text-success">
                                        {formatPrice(after)}
                                      </div>
                                      <div className="text-muted small">
                                        {formatPrice(rate.totalRate || 0)} × {rate.numberOfRooms || 1} rooms
                                      </div>
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

                                    <Button variant="primary" className="w-100 book-now-btn mt-1 mb-1"
                                            onClick={() => handleBooking(category, rate)}>
                                      <FaMoneyBillWave className="me-2" />
                                      Select & Continue
                                    </Button>
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
                </Col>
              </Row>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default GovEmployeeRoomList;
