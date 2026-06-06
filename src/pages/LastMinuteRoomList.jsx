import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Row,
  Col,
  Badge,
  Spinner,
  Alert,
  Accordion,
  Form,
} from "react-bootstrap";
import { useAccordionButton } from "react-bootstrap/AccordionButton";
import {
  FaBed,
  FaUtensils,
  FaStar,
  FaMapMarkerAlt,
  FaPhone,
  FaUsers,
  FaInfoCircle,
  FaTimesCircle,
  FaChevronDown,
  FaChevronUp,
  FaHotel,
  FaMoneyBillWave,
  FaShieldAlt,
} from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import AgentBalanceDisplay from "../components/AgentBalanceDisplay";
import RoomFilters from "../components/roomlist/RoomFilters";
import useRoomFilters from "../hooks/useRoomFilters";
import "../styles/RoomList.css";

/**
 * LastMinuteRoomList — mirrors RoomList.jsx structure for the Last Minute flow.
 *
 * Layout:
 *   1. Hotel header card: image / name / star / address / phone / Back button.
 *   2. "Available Room Categories" with grid/list view toggle.
 *   3. Accordion — one item per (roomCategory) group:
 *        - Header: category name, "From AED X", "N rates available", toggle btn.
 *        - Body: rate cards (meal plan, refund badge, contract code, last-minute
 *          price, normal-rate strike-through, savings %, View Details button).
 *   4. Additional Information card (child policy placeholder).
 *   5. Policies card (cancellation + check-in/out + deposit).
 *
 * Data source: sessionStorage["lastMinuteRoomListPayload"] populated by the
 * search page when the user clicks "View Rooms".
 */
const DEFAULT_HOTEL_IMAGE =
  "https://details/assets/details/profilepic/hotel/hoteldefault.jpg";

// ─── Accordion toggle helper (copied from RoomList.jsx) ─────────────────────
function AccordionToggleButton({ eventKey, isActive }) {
  const decoratedOnClick = useAccordionButton(eventKey);
  return (
    <Button
      variant="outline-primary"
      size="sm"
      onClick={decoratedOnClick}
      className="d-flex align-items-center gap-1"
    >
      {isActive ? "Hide Details/Book" : "View Details/Book"}
      {isActive ? <FaChevronUp /> : <FaChevronDown />}
    </Button>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────
const formatPrice = (price) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
  }).format(price || 0);

// Rates saved in the DB already include the admin markup (it is pre-applied
// on the contract rate form). Return the base rate as-is to avoid double-applying.
const applyMarkup = (baseRate, _markupPct) => {
  return Number(baseRate || 0);
};

const renderStars = (rating) =>
  Array.from({ length: rating || 0 }, (_, i) => (
    <FaStar key={i} className="text-warning" />
  ));

const getMealPlanIcon = (mealPlan) => {
  const m = (mealPlan || "").toLowerCase();
  if (m.includes("room only")) return <FaBed className="text-muted" />;
  if (m.includes("breakfast")) return <FaUtensils className="text-warning" />;
  if (m.includes("full")) return <FaUtensils className="text-success" />;
  return <FaUtensils className="text-primary" />;
};

const getRefundBadge = (refundable) => {
  if (refundable === true) return <Badge bg="success">Flexible</Badge>;
  if (refundable === false) return <Badge bg="danger">Non-Refundable</Badge>;
  return <Badge bg="secondary">Non-Refundable</Badge>;
};

// Group flat room rates by roomCategoryId so each becomes one Accordion item.
const groupRoomsByCategory = (rooms) => {
  const map = new Map();
  (rooms || []).forEach((r) => {
    const key = r.roomCategoryId ?? `cat-${r.roomTypeId}`;
    if (!map.has(key)) {
      map.set(key, {
        roomCategoryId: r.roomCategoryId,
        roomCategoryName: r.roomCategoryName || `Category #${r.roomCategoryId}`,
        baseRoomType: r.roomTypeName || `Room Type #${r.roomTypeId}`,
        rates: [],
      });
    }
    map.get(key).rates.push(r);
  });
  // Sort rates within each category by lastMinuteRate asc (cheapest first).
  Array.from(map.values()).forEach((c) =>
    c.rates.sort(
      (a, b) =>
        Number(a.lastMinuteRate || 0) - Number(b.lastMinuteRate || 0)
    )
  );
  return Array.from(map.values());
};

// ─── main page ──────────────────────────────────────────────────────────────
export default function LastMinuteRoomList() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeAccordion, setActiveAccordion] = useState(null);
  const [viewMode, setViewMode] = useState("grid");

  // ──────────────────────────────────────────────────────────────────────
  // Multi-room selection — mirrors RoomList.jsx.
  //
  // Single-room searches (numRooms === 1) keep the legacy
  // `handleBookRate` flow — the per-rate "View Details / Book" button
  // renders unchanged and navigates with the single rate as `ctx.room`.
  //
  // Multi-room searches (numRooms > 1) render a per-room outer
  // Accordion. Each rate's button becomes a radio bound to a room
  // slot. Important caveat: the `last-minute-booking/create` endpoint
  // accepts only ONE `lastMinuteRateId` today, so when the user picks
  // different rates per slot the combined handler uses Room 1's pick
  // for the booking itself. The other slots' picks ride along as
  // `roomBreakdown` for future backend work; the user is told this on
  // the bottom CTA.
  // ──────────────────────────────────────────────────────────────────────
  const [selectedRooms, setSelectedRooms] = useState([]);

  // Shared Room-Type + Refund-Policy filters (same UX as /room-list).
  // Last-minute rates carry `refundable` (boolean) + `mealPlanName`.
  const filters = useRoomFilters();
  const rateVisible = (r) =>
    filters.rateMatches({
      isNonRefundable: r.refundable === false,
      mealPlan: r.mealPlanName,
    });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("lastMinuteRoomListPayload");
      if (!raw) {
        setError("No search context. Please go back and search again.");
      } else {
        setPayload(JSON.parse(raw));
      }
    } catch (e) {
      console.error(e);
      setError("Failed to read search context.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBookRate = (rate, hotel, results) => {
    const sc = payload?.searchContext || {};
    const searchRooms = sc.rooms || [{ adults: 1, children: 0, childAges: [] }];
    const nat = sc.nationality || null;
    navigate("/new-booking/last-minute-booking/create", {
      state: {
        ctx: {
          hotel: {
            hotelId: hotel.hotelId,
            hotelName: hotel.hotelName,
            address: hotel.address,
            hotelImage: hotel.hotelImage,
            starRating: hotel.starRating,
            categoryName: hotel.categoryName,
          },
          room: rate,
          checkInDate: results.checkInDate,
          checkOutDate: results.checkOutDate,
          nights: results.nights,
          searchRooms,
          agentId: sc.agent || null,
          // Optional "Booking Done By Employee" — carried from
          // LastMinuteBookingPage searchContext into the form's create payload.
          employeeId: sc.employeeId || null,
          nationalityId: nat?.value ?? null,
          nationalityCode: nat?.code ?? null,
          nationalityName: nat?.label ?? null,
        },
      },
    });
  };

  // ──────────────────────────────────────────────────────────────────────
  // Multi-room helpers (see comment near `selectedRooms`).
  // ──────────────────────────────────────────────────────────────────────
  const numRooms =
    (payload?.searchContext?.rooms || []).length || 1;
  const isMultiRoom = numRooms > 1;
  const allRoomsSelected =
    selectedRooms.length > 0 &&
    selectedRooms.every((r) => r.selectedRate !== null);

  useEffect(() => {
    setSelectedRooms((prev) => {
      if (prev.length === numRooms) return prev;
      return Array.from({ length: numRooms }, (_, i) => ({
        roomNo: i + 1,
        selectedRate: null,
      }));
    });
  }, [numRooms]);

  const handleRateSelect = (roomIndex, rate) => {
    setSelectedRooms((prev) =>
      prev.map((r, i) => {
        if (i !== roomIndex) return r;
        if (r.selectedRate === rate) {
          return { ...r, selectedRate: null };
        }
        return { ...r, selectedRate: rate };
      }),
    );
  };

  /** Multi-room navigation. The booking-create endpoint takes a single
   *  `lastMinuteRateId` so we send Room 1's pick as `ctx.room`
   *  (legacy single-rate shape). All slots' picks ride along as
   *  `ctx.roomBreakdown` for any future backend work that wants real
   *  per-room rates. */
  const handleProceedBooking = () => {
    if (!allRoomsSelected || !payload) return;
    try {
      const hotelFromPayload = payload.hotel;
      const resultsFromPayload = payload.results;
      const sc = payload.searchContext || {};
      const searchRooms = sc.rooms || [{ adults: 1, children: 0, childAges: [] }];
      const nat = sc.nationality || null;
      const primaryRate = selectedRooms[0].selectedRate;

      navigate("/new-booking/last-minute-booking/create", {
        state: {
          ctx: {
            hotel: {
              hotelId: hotelFromPayload.hotelId,
              hotelName: hotelFromPayload.hotelName,
              address: hotelFromPayload.address,
              hotelImage: hotelFromPayload.hotelImage,
              starRating: hotelFromPayload.starRating,
              categoryName: hotelFromPayload.categoryName,
            },
            // Backend takes one rate today — primary slot wins.
            room: primaryRate,
            // Additive — downstream code can use this to render
            // per-slot details on the form (LastMinuteBookingForm
            // currently ignores it). When the backend gains a
            // per-room rate list, this is the field to read.
            roomBreakdown: selectedRooms.map((r, i) => ({
              roomNo: i + 1,
              rate: r.selectedRate,
            })),
            checkInDate: resultsFromPayload.checkInDate,
            checkOutDate: resultsFromPayload.checkOutDate,
            nights: resultsFromPayload.nights,
            searchRooms,
            agentId: sc.agent || null,
            // Optional "Booking Done By Employee" — same forwarding
            // path as the single-room flow above.
            employeeId: sc.employeeId || null,
            nationalityId: nat?.value ?? null,
            nationalityCode: nat?.code ?? null,
            nationalityName: nat?.label ?? null,
          },
        },
      });
    } catch (err) {
      console.error("Error preparing multi-room ctx:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <div className="text-center results-loader">
              <div className="loader-ring">
                <span></span><span></span><span></span><span></span>
              </div>
              <h4 className="text-primary fw-bold mt-3 mb-1">
                Fetching Best Last Minute Options...
              </h4>
              <p className="text-muted small mb-0">
                Loading discounted rates
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center p-3">
            <div className="w-100" style={{ maxWidth: 480 }}>
              <Alert variant="warning" className="mb-3">
                <Alert.Heading>No data</Alert.Heading>
                <p className="mb-0">{error || "Missing data."}</p>
              </Alert>
              <Button
                variant="primary"
                onClick={() => navigate("/new-booking/last-minute-booking")}
              >
                Back to Search
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const hotel = payload.hotel;
  const results = payload.results;
  const categories = groupRoomsByCategory(hotel.rooms || []);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column room-list-container">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="content-wrapper flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
          <div className="container-fluid" style={{ paddingTop: "10px" }}>
            <div className="d-flex justify-content-end mb-2">
              <AgentBalanceDisplay agentId={payload?.searchContext?.agent} />
            </div>
            {/* ── Hotel Header ────────────────────────────────────────── */}
            <Card className="hotel-header-card mb-4">
              <Card.Body className="p-4">
                <Row>
                  <Col md={3}>
                    <img
                      src={hotel.hotelImage || DEFAULT_HOTEL_IMAGE}
                      alt={hotel.hotelName}
                      className="rounded shadow-sm w-100"
                      style={{ height: 150, objectFit: "cover" }}
                      onError={(e) => { e.currentTarget.src = DEFAULT_HOTEL_IMAGE; }}
                    />
                  </Col>
                  <Col md={9}>
                    <div className="d-flex align-items-start gap-3">
                      <div className="hotel-icon">
                        <FaHotel size={36} className="text-primary" />
                      </div>
                      <div className="hotel-info flex-grow-1">
                        <h2 className="hotel-name mb-2">{hotel.hotelName}</h2>
                        <div className="d-flex align-items-center gap-3 mb-2 flex-wrap">
                          <div className="star-rating">
                            {renderStars(hotel.starRating)}
                          </div>
                          {hotel.categoryName && (
                            <Badge bg="primary">{hotel.categoryName}</Badge>
                          )}
                          <Badge bg="warning" text="dark">LAST MINUTE</Badge>
                          <Badge bg="info">
                            {results.checkInDate} → {results.checkOutDate} ·{" "}
                            {results.nights} night{results.nights !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <div className="hotel-details">
                          <p className="mb-1">
                            <FaMapMarkerAlt className="text-muted me-2" />
                            {hotel.address || hotel.cityName || "—"}
                          </p>
                          {hotel.phone && (
                            <p className="mb-0">
                              <FaPhone className="text-muted me-2" />
                              {hotel.phone}
                            </p>
                          )}
                          <div className="mt-2">
                            <small className="text-muted">
                              <strong>Please note:</strong>{" "}
                              <span className="someproperties">
                                Last-minute rates are typically non-refundable.
                                Some properties may collect additional charges
                                such as city tax, resort fees, or security
                                deposits during check-in.
                              </span>
                            </small>
                          </div>
                        </div>
                        <div className="mt-3">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => navigate(-1)}
                          >
                            Back to Search
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* ── Available Room Categories ─────────────────────────── */}
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0 border-bottom border-2 border-primary pb-2">
                  Available Room Categories
                </h4>
                <div className="d-flex gap-2">
                  <Button
                    variant={viewMode === "grid" ? "primary" : "outline-primary"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    title="Grid view"
                  >
                    ▦
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "primary" : "outline-primary"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    title="List view"
                  >
                    ☰
                  </Button>
                </div>
              </div>

              <Row className="g-3">
                <Col lg={3} md={4}>
                  <RoomFilters filters={filters} />
                </Col>
                <Col lg={9} md={8}>
              {categories.length === 0 ? (
                <Alert variant="light" className="text-center text-muted">
                  No last-minute rates available for this hotel.
                </Alert>
              ) : (
                <>
                {/* Per-room wrapper — single-room renders the inner
                    Accordion once unwrapped (legacy behavior);
                    multi-room renders it per slot inside a
                    "Room N" Accordion. */}
                {(isMultiRoom ? selectedRooms : [null]).map((_slot, roomSlotIndex) => {
                  const inner = (
                <Accordion
                  activeKey={activeAccordion}
                  onSelect={(key) => setActiveAccordion(key)}
                >
                  {categories.map((cat, index) => {
                    const eventKey = String(index);
                    const isActive = activeAccordion === eventKey;
                    const visibleRates = (cat.rates || []).filter(rateVisible);
                    if (visibleRates.length === 0) return null;
                    const minRate = Math.min(
                      ...visibleRates.map((r) =>
                        applyMarkup(r.lastMinuteRate, r.markup)
                      )
                    );return (
                      <Accordion.Item
                        eventKey={eventKey}
                        key={eventKey}
                        className="room-category-item"
                      >
                        <Accordion.Header as="div" className="room-category-header">
                          <div className="d-flex justify-content-between align-items-center w-100">
                            <div className="room-category-info">
                              <h5 className="mb-1">{cat.roomCategoryName}</h5>
                              <p className="mb-0 text-muted small">
                                {cat.baseRoomType}
                              </p>
                            </div>
                            <div className="d-flex align-items-center gap-3">
                              <div className="room-category-price text-end">
                                <div className="price-range">
                                  From {formatPrice(minRate)}
                                </div>
                                <div className="rates-count small text-muted">
                                  {visibleRates.length} rate
                                  {visibleRates.length !== 1 ? "s" : ""} available
                                </div>
                              </div>
                              <AccordionToggleButton
                                eventKey={eventKey}
                                isActive={isActive}
                              />
                            </div>
                          </div>
                        </Accordion.Header>

                        <Accordion.Body className="room-rates-section">
                          <Row>
                            {visibleRates.map((rate, i) => (
                              <Col
                                key={rate.lastMinuteRateId || i}
                                lg={viewMode === "grid" ? 6 : 12}
                                xl={viewMode === "grid" ? 4 : 12}
                                className="mb-2"
                              >
                                <Card className="rate-card h-100 shadow-sm">
                                  {viewMode === "grid" ? (
                                    <Card.Body className="p-3 pb-2 d-flex flex-column gap-2">
                                      <div className="rate-header d-flex justify-content-between align-items-start">
                                        <div>
                                          <div className="d-flex align-items-center gap-2">
                                            {getMealPlanIcon(rate.mealPlanName)}
                                            <span className="fw-semibold small">
                                              {rate.mealPlanName ||
                                                `Meal Plan #${rate.mealPlanId}`}
                                            </span>
                                          </div>
                                          <div className="mt-1 small text-muted">
                                            {rate.roomTypeName ||
                                              `Type #${rate.roomTypeId}`}
                                          </div>
                                        </div>
                                        {getRefundBadge(rate.refundable)}
                                      </div>

                                      <div className="rate-pricing text-center py-2">
                                        <div className="current-price">
                                          {formatPrice(applyMarkup(rate.lastMinuteRate, rate.markup))}
                                        </div>
                                        {rate.normalContractRate != null && (
                                          <div className="original-price text-decoration-line-through">
                                            {formatPrice(rate.normalContractRate)}
                                          </div>
                                        )}
                                        {rate.savingsPercent != null && (
                                          <Badge bg="success" className="mt-1">
                                            Save {Number(rate.savingsPercent).toFixed(1)}%
                                          </Badge>
                                        )}
                                        <div className="price-per-night small text-muted mt-1">
                                          per night
                                        </div>
                                      </div>

                                      <div className="rate-features small">
                                        <div className="feature-item">
                                          <FaInfoCircle className="me-2 text-muted" />
                                          {rate.rateCode || "Last Minute"}
                                        </div>
                                        <div className="feature-item">
                                          <FaShieldAlt className="me-2 text-muted" />
                                          Last-minute rates are typically non-refundable.
                                        </div>
                                        {rate.adultRate != null &&
                                          Number(rate.adultRate) > 0 && (
                                            <div className="feature-item">
                                              <FaUsers className="me-2 text-muted" />
                                              Extra Adult: <strong>{formatPrice(applyMarkup(rate.adultRate, rate.markup))}</strong>{" "}
                                              <span className="text-muted">/ night</span>
                                            </div>
                                          )}
                                        {rate.childRate != null &&
                                          Number(rate.childRate) > 0 && (
                                            <div className="feature-item">
                                              <FaUsers className="me-2 text-muted" />
                                              Child: <strong>{formatPrice(applyMarkup(rate.childRate, rate.markup))}</strong>{" "}
                                              <span className="text-muted">/ night</span>
                                            </div>
                                          )}
                                        <div className="feature-item">
                                          <FaMoneyBillWave className="me-2 text-muted" />
                                          Total ({results.nights} nt):{" "}
                                          <strong>
                                            {formatPrice(applyMarkup(rate.totalPriceForStay, rate.markup))}
                                          </strong>
                                        </div>
                                      </div>

                                      {isMultiRoom ? (
                                        <Form.Check
                                          type="radio"
                                          id={`lm-rate-radio-grid-${roomSlotIndex}-${index}-${i}`}
                                          name={`lm-rate-radio-grid-room-${roomSlotIndex}`}
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
                                            handleRateSelect(roomSlotIndex, rate)
                                          }
                                        />
                                      ) : (
                                        <Button
                                          variant="primary"
                                          className="w-100 book-now-btn mt-1 mb-1"
                                          onClick={() =>
                                            handleBookRate(rate, hotel, results)
                                          }
                                        >
                                          <FaMoneyBillWave className="me-2" />
                                          View Details / Book
                                        </Button>
                                      )}
                                    </Card.Body>
                                  ) : (
                                    <Card.Body className="p-3 py-2 d-flex flex-row justify-content-between align-items-center gap-3">
                                      <div className="d-flex flex-column flex-grow-1">
                                        <div className="d-flex align-items-center gap-3 mb-2">
                                          <div className="d-flex align-items-center gap-2">
                                            {getMealPlanIcon(rate.mealPlanName)}
                                            <span className="fw-semibold">
                                              {rate.mealPlanName ||
                                                `Meal Plan #${rate.mealPlanId}`}
                                            </span>
                                          </div>
                                          {getRefundBadge(rate.refundable)}
                                          <small className="text-muted">
                                            {rate.roomTypeName ||
                                              `Type #${rate.roomTypeId}`}
                                          </small>
                                        </div>
                                        <div className="rate-features small text-muted d-flex gap-4">
                                          <div className="feature-item d-flex align-items-center">
                                            <FaInfoCircle className="me-2" />
                                            {rate.rateCode || "Last Minute"}
                                          </div>
                                          <div className="feature-item d-flex align-items-center text-truncate" style={{ maxWidth: "350px" }}>
                                            <FaShieldAlt className="me-2" />
                                            Non-refundable
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-end px-4 border-start border-end" style={{ minWidth: "220px" }}>
                                        <div className="fs-5 fw-bold text-primary">
                                          {formatPrice(applyMarkup(rate.lastMinuteRate, rate.markup))}
                                        </div>
                                        {rate.savingsPercent != null && (
                                          <Badge bg="success" className="mt-1">
                                            Save {Number(rate.savingsPercent).toFixed(1)}%
                                          </Badge>
                                        )}
                                        <div className="text-muted small">
                                          Total: {formatPrice(applyMarkup(rate.totalPriceForStay, rate.markup))}
                                        </div>
                                        <div className="small text-muted">per night</div>
                                        {rate.adultRate != null && Number(rate.adultRate) > 0 && (
                                          <div className="small text-muted">
                                            Extra Adult: {formatPrice(applyMarkup(rate.adultRate, rate.markup))}/nt
                                          </div>
                                        )}
                                        {rate.childRate != null && Number(rate.childRate) > 0 && (
                                          <div className="small text-muted">
                                            Child: {formatPrice(applyMarkup(rate.childRate, rate.markup))}/nt
                                          </div>
                                        )}
                                      </div>
                                      <div className="ps-2">
                                        {isMultiRoom ? (
                                          <Form.Check
                                            type="radio"
                                            id={`lm-rate-radio-list-${roomSlotIndex}-${index}-${i}`}
                                            name={`lm-rate-radio-list-room-${roomSlotIndex}`}
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
                                              handleRateSelect(roomSlotIndex, rate)
                                            }
                                            style={{ whiteSpace: "nowrap" }}
                                          />
                                        ) : (
                                          <Button
                                            variant="primary"
                                            className="book-now-btn px-4 py-2"
                                            onClick={() =>
                                              handleBookRate(rate, hotel, results)
                                            }
                                            style={{ whiteSpace: "nowrap" }}
                                          >
                                            <FaMoneyBillWave className="me-2" />
                                            View Details
                                          </Button>
                                        )}
                                      </div>
                                    </Card.Body>
                                  )}
                                </Card>
                              </Col>
                            ))}
                          </Row>
                        </Accordion.Body>
                      </Accordion.Item>
                    );
                  })}
                  {categories.every(
                    (c) => (c.rates || []).filter(rateVisible).length === 0,
                  ) && (
                    <Alert variant="info" className="mb-0">
                      No rates match the selected filters.
                    </Alert>
                  )}
                </Accordion>
                  );
                  if (!isMultiRoom) {
                    return (
                      <React.Fragment key="lm-single-room">{inner}</React.Fragment>
                    );
                  }
                  const slotSelection = selectedRooms[roomSlotIndex];
                  return (
                    <Accordion
                      key={`lm-room-slot-${roomSlotIndex}`}
                      defaultActiveKey={`lm-room-slot-${roomSlotIndex}`}
                      className="mb-3 room-slot-accordion"
                    >
                      <Accordion.Item eventKey={`lm-room-slot-${roomSlotIndex}`}>
                        <Accordion.Header>
                          <div className="d-flex w-100 justify-content-between align-items-center pe-3">
                            <span className="fw-semibold">
                              <FaBed className="me-2 text-primary" />
                              Room {roomSlotIndex + 1}
                            </span>
                            {slotSelection?.selectedRate ? (
                              <Badge bg="success" className="ms-2">
                                {slotSelection.selectedRate.roomCategoryName}
                                {" — "}
                                {formatPrice(
                                  applyMarkup(
                                    slotSelection.selectedRate.lastMinuteRate,
                                    slotSelection.selectedRate.markup,
                                  ),
                                )}
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

                {/* Multi-room "Continue with Booking" CTA. The
                    last-minute-booking endpoint takes one rate id, so
                    Room 1's pick is applied to all rooms. The notice
                    below makes that explicit so users aren't
                    surprised. */}
                {isMultiRoom && (
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mt-3 p-3 border rounded bg-light">
                    <div className="small text-muted">
                      {allRoomsSelected
                        ? `All ${numRooms} rooms selected. Note: every room in this booking will be charged at Room 1's selected rate.`
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
                </>
              )}
                </Col>
              </Row>
            </div>

            {/* ── Additional Information ──────────────────────────────── */}
            <div className="mt-4">
              <Card className="mb-4">
                <Card.Header as="h6">Additional Information</Card.Header>
                <Card.Body>
                  <h6 className="text-primary mb-2">
                    <FaUsers className="me-2" />
                    Child Policy
                  </h6>
                  <ul className="mb-0 text-muted">
                    <li>
                      Last-minute rates may have stricter cancellation rules
                      than the regular contract rate.
                    </li>
                    <li>
                      Mandatory gala dinner fees may apply on certain dates.
                    </li>
                    <li>
                      Additional taxes or resort fees may be collected at the
                      property during check-in.
                    </li>
                    <li>
                      Photo identification and a deposit may be required at
                      check-in for incidental charges.
                    </li>
                  </ul>
                </Card.Body>
              </Card>

              {/* ── Policies ──────────────────────────────────────────── */}
              <Card className="mb-4">
                <Card.Header as="h6">Policies</Card.Header>
                <Card.Body>
                  <div className="mb-3">
                    <h6 className="text-danger mb-2">
                      <FaTimesCircle className="me-2" />
                      Cancellation Policy
                    </h6>
                    <p className="text-muted mb-1">
                      Last-minute bookings are non-refundable once confirmed.
                      Cancellations or no-shows will be charged 100% of the
                      total booking value.
                    </p>
                  </div>

                  <div className="mb-3">
                    <h6 className="text-warning mb-2">
                      <FaInfoCircle className="me-2" />
                      Amendment Policy
                    </h6>
                    <p className="text-muted mb-1">
                      Date or guest-name amendments are subject to availability
                      and may be charged at the rate difference plus an
                      administrative fee.
                    </p>
                  </div>

                  <Row className="g-3 mt-3">
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
                        <span className="fw-semibold">Subject to availability</span>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
