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
  Modal,
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
  FaCheckCircle,
  FaTimesCircle,
  FaChevronDown,
  FaChevronUp,
  FaHotel,
  FaMoneyBillWave,
  FaShieldAlt,
  FaCalendarAlt,
  FaGlobe,
} from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import AgentBalanceDisplay from "../components/AgentBalanceDisplay";
import RoomFilters from "../components/roomlist/RoomFilters";
import useRoomFilters from "../hooks/useRoomFilters";
import axiosInstance from "../components/AxiosInstance";
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

// Effective refundability for a last-minute rate. A rate flagged refundable
// (Flexible) only stays refundable while today is on/before its free-
// cancellation deadline — checkInDate minus the largest daysBeforeArrival
// across its cancellation policies. Once that deadline passes (or the rate is
// flagged non-refundable / carries no cancellation-policy day) it is treated
// as Non-Refundable. Mirrors the deadline rule on /hotel-booking-page.
const isRateNonRefundable = (rate, checkInDate) => {
  if (rate?.refundable !== true) return true;
  const days = (rate?.cancellationPolicies || [])
    .map((p) => Number(p?.daysBeforeArrival))
    .filter((n) => Number.isFinite(n));
  if (days.length === 0) return false;
  const cin = new Date(checkInDate);
  if (isNaN(cin.getTime())) return false;
  const deadline = new Date(cin);
  deadline.setDate(deadline.getDate() - Math.max(...days));
  deadline.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today > deadline;
};

const getRefundBadge = (rate, checkInDate) =>
  isRateNonRefundable(rate, checkInDate) ? (
    <Badge bg="danger">Non-Refundable</Badge>
  ) : (
    <Badge bg="success">Flexible</Badge>
  );

// Availability badge — mirrors /room-list. "On Request" (yellow) when the
// room's category has no inventory for the dates; "Available" (green) otherwise.
const getRoomStatusBadge = (roomStatus) => {
  if (roomStatus === "On Request") {
    return (
      <Badge bg="warning" text="dark" className="ms-1">
        On Request
      </Badge>
    );
  }
  return (
    <Badge bg="success" className="ms-1">
      Available
    </Badge>
  );
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

  // Cancellation Policies & Terms modal — mirrors RoomList.jsx. Opens from a
  // per-rate link inside each room card. Last-minute rates have STATIC
  // policies (non-refundable + amendment/child boilerplate) — no policyList
  // fetch, no T&C fetch — so the modal just renders the same text that used
  // to sit in the bottom "Booking Policies" card, per-rate.
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [selectedRateForPolicies, setSelectedRateForPolicies] = useState(null);

  // ── Payment-path gate — mirrors RoomList.jsx. When the agent has NO
  // available credit (0 / no credit-limit row) AND per-agent Card
  // payment is disabled, block Book-Now here on the room list with the
  // "Booking Cannot Be Completed" modal instead of pushing the user
  // into a booking form they can't submit. Partial-credit shortfalls
  // are still caught by the booking form's own scenario-3 gate.
  const [agentBalance, setAgentBalance] = useState(null);
  const [agentCardPaymentEnabled, setAgentCardPaymentEnabled] = useState(false);
  const [showNoPaymentPathModal, setShowNoPaymentPathModal] = useState(false);
  const openPoliciesModal = (rate) => {
    setSelectedRateForPolicies(rate || null);
    setShowPoliciesModal(true);
  };

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

  // Display currency carried over from the search page. Rates are AED; this
  // converts them for display only and is forwarded into the booking ctx.
  // Shadows the module-level formatPrice so every rate below renders in the
  // chosen currency (AED → factor 1).
  const displayCurrency = payload?.searchContext?.currency || { code: "AED", factor: 1 };
  const curCode = displayCurrency.code || "AED";
  const curFactor = Number(displayCurrency.factor) > 0 ? Number(displayCurrency.factor) : 1;
  const formatPrice = (price) =>
    `${curCode} ${((Number(price) || 0) * curFactor).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

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

  // Fetch the agent's credit balance + Card gate once the search
  // context is available. Same endpoints RoomList uses. Fail-safe
  // defaults keep the flow unblocked when the fetch itself errors so a
  // network hiccup never spuriously blocks a booking.
  useEffect(() => {
    const aId = payload?.searchContext?.agent;
    if (!aId) {
      setAgentBalance(null);
      setAgentCardPaymentEnabled(false);
      return;
    }
    let cancelled = false;
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${aId}`)
      .then((res) => {
        if (!cancelled) {
          setAgentBalance(res?.data?.availableCreditLimit ?? 0);
        }
      })
      .catch(() => {
        if (!cancelled) setAgentBalance(0);
      });
    axiosInstance
      .get(`/api/agent/${aId}`)
      .then((res) => {
        if (!cancelled) {
          setAgentCardPaymentEnabled(!!res?.data?.cardPaymentEnabled);
        }
      })
      .catch(() => {
        if (!cancelled) setAgentCardPaymentEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [payload?.searchContext?.agent]);

  // Blanket "no viable payment path" check for the room-list gate:
  // available credit is 0 (or no credit-limit row) AND Card is disabled.
  // Any partial-credit shortfalls are still caught by the booking form.
  const hasNoPaymentPath =
    Number(agentBalance) <= 0 && !agentCardPaymentEnabled;

  const handleBookRate = (rate, hotel, results) => {
    // Scenario-3 short-circuit: block here when the agent has zero
    // credit AND no Card option — no viable payment path anywhere.
    if (hasNoPaymentPath) {
      setShowNoPaymentPathModal(true);
      return;
    }
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
          // Display currency forwarded to the booking form / create payload.
          currency: sc.currency || { code: "AED", factor: 1 },
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
    // Same room-list gate as the single-room path — block scenario 3
    // before we navigate into the booking form.
    if (hasNoPaymentPath) {
      setShowNoPaymentPathModal(true);
      return;
    }
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
            // Display currency forwarded to the booking form / create payload.
            currency: sc.currency || { code: "AED", factor: 1 },
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

  // Stay-summary data for the right-hand Booking Summary card — mirrors
  // RoomList.jsx. Guests come from the search context's per-room adults/
  // children (single-room shows a combined line, multi-room lists per room).
  const sc = payload.searchContext || {};
  const scRooms = Array.isArray(sc.rooms) ? sc.rooms : [];
  const summaryRoomCount = scRooms.length || 1;
  const summaryTotalAdults = scRooms.reduce((a, r) => a + (r.adults || 0), 0);
  const summaryTotalChildren = scRooms.reduce((a, r) => a + (r.children || 0), 0);
  const summaryGuestLine =
    [
      summaryTotalAdults
        ? `${summaryTotalAdults} adult${summaryTotalAdults > 1 ? "s" : ""}`
        : "",
      summaryTotalChildren
        ? `${summaryTotalChildren} child${summaryTotalChildren > 1 ? "ren" : ""}`
        : "",
    ]
      .filter(Boolean)
      .join(", ") || "—";
  const summaryNationality = sc.nationality?.label || "—";

  return (
    <div className="min-vh-100 bg-light d-flex flex-column room-list-container">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="content-wrapper flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
          <div className="container-fluid" style={{ paddingTop: "10px" }}>
            {/* Top toolbar: Back to Search + agent balance — mirrors
                RoomList.jsx so the flow shares the same header polish. */}
            <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => navigate("/new-booking/last-minute-booking")}
                className="back-to-search-btn"
              >
                ← Back to Search
              </Button>
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
                  <Col md={5}>
                    <div className="hotel-info">
                      <h2 className="hotel-name mb-2">{hotel.hotelName}</h2>
                      <div className="d-flex align-items-center gap-3 mb-2 flex-wrap">
                        <div className="star-rating">
                          {renderStars(hotel.starRating)}
                        </div>
                        {hotel.categoryName && (
                          <Badge bg="primary">{hotel.categoryName}</Badge>
                        )}
                        <Badge bg="warning" text="dark">LAST MINUTE</Badge>
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
                    </div>
                  </Col>
                  {/* Stay summary on the right — mirrors RoomList.jsx's
                      Booking Summary card. */}
                  <Col md={4}>
                    <Card className="booking-summary">
                      <Card.Body className="p-3">
                        <h6 className="mb-3">Booking Summary</h6>
                        <div className="booking-details">
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaCalendarAlt className="text-muted me-2" />
                              Check-in:
                            </span>
                            <span className="fw-semibold">
                              {results.checkInDate}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaCalendarAlt className="text-muted me-2" />
                              Check-out:
                            </span>
                            <span className="fw-semibold">
                              {results.checkOutDate}
                            </span>
                          </div>
                          <div className="mb-2">
                            <div className="d-flex justify-content-between">
                              <span>
                                <FaUsers className="text-muted me-2" />
                                Guests:
                              </span>
                              {summaryRoomCount <= 1 && (
                                <span className="fw-semibold">
                                  {summaryGuestLine}
                                </span>
                              )}
                            </div>
                            {summaryRoomCount > 1 && (
                              <div className="mt-1 ps-4 guest-breakdown-list">
                                {scRooms.map((r, i) => {
                                  const a = r.adults || 0;
                                  const c = r.children || 0;
                                  const parts = [];
                                  if (a) parts.push(`${a} adult${a > 1 ? "s" : ""}`);
                                  if (c) parts.push(`${c} child${c > 1 ? "ren" : ""}`);
                                  return (
                                    <div
                                      key={i}
                                      className="d-flex justify-content-between small"
                                    >
                                      <span className="text-muted">
                                        Room {i + 1}:
                                      </span>
                                      <span className="fw-semibold">
                                        {parts.join(", ") || "—"}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaBed className="text-muted me-2" />
                              Rooms:
                            </span>
                            <span className="fw-semibold">
                              {summaryRoomCount}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaCalendarAlt className="text-muted me-2" />
                              Nights:
                            </span>
                            <span className="fw-semibold">
                              {results.nights} night
                              {results.nights !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span>
                              <FaGlobe className="text-muted me-2" />
                              Nationality:
                            </span>
                            <span className="fw-semibold">
                              {summaryNationality}
                            </span>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
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
                                    <Card.Body className="p-2 pb-0 d-flex flex-column gap-2">
                                      {/* Header row mirrors RoomList.jsx:
                                          only TWO top-level children in
                                          the d-flex justify-content-between
                                          (left column: meal plan + status
                                          badge stacked; right: refund badge).
                                          Room type name moved to its own
                                          line below so the row doesn't get
                                          squeezed. */}
                                      <div className="rate-header d-flex justify-content-between align-items-start">
                                        <div>
                                          <div className="d-flex align-items-center gap-2">
                                            {getMealPlanIcon(rate.mealPlanName)}
                                            <span className="fw-semibold small">
                                              {rate.mealPlanName ||
                                                `Meal Plan #${rate.mealPlanId}`}
                                            </span>
                                          </div>
                                          <div className="mt-1">
                                            {getRoomStatusBadge(rate.roomStatus)}
                                          </div>
                                        </div>
                                        {getRefundBadge(rate, results.checkInDate)}
                                      </div>
                                      {(rate.roomTypeName || rate.roomTypeId) && (
                                        <div className="small text-muted">
                                          {rate.roomTypeName ||
                                            `Type #${rate.roomTypeId}`}
                                        </div>
                                      )}

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
                                        {/* Cancellation Policies & T&C —
                                            open modal on click. Mirrors
                                            RoomList.jsx. */}
                                        <div className="feature-item">
                                          <Button
                                            variant="link"
                                            size="sm"
                                            className="p-0 text-decoration-underline"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openPoliciesModal(rate);
                                            }}
                                          >
                                            <FaShieldAlt className="me-2" />
                                            Cancellation Policies &amp; Terms &amp; Conditions
                                          </Button>
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
                                    // List-mode row — mirrors RoomList.jsx.
                                    <Card.Body className="p-3 py-2 d-flex flex-row align-items-center gap-3 flex-wrap flex-md-nowrap">
                                      <div
                                        className="d-flex flex-column flex-grow-1"
                                        style={{ minWidth: 0 }}
                                      >
                                        <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                                          <div
                                            className="d-flex align-items-center gap-2 flex-shrink-0"
                                            style={{ whiteSpace: "nowrap", minWidth: "200px" }}
                                          >
                                            {getMealPlanIcon(rate.mealPlanName)}
                                            <span className="fw-semibold text-truncate">
                                              {rate.mealPlanName ||
                                                `Meal Plan #${rate.mealPlanId}`}
                                            </span>
                                          </div>
                                          <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                            {getRefundBadge(rate, results.checkInDate)}
                                            {getRoomStatusBadge(rate.roomStatus)}
                                          </div>
                                          <small className="text-muted text-truncate">
                                            {rate.roomTypeName ||
                                              `Type #${rate.roomTypeId}`}
                                          </small>
                                        </div>
                                        <div className="rate-features small text-muted d-flex gap-4">
                                          <div className="feature-item d-flex align-items-center">
                                            <FaInfoCircle className="me-2" />
                                            {rate.rateCode || "Last Minute"}
                                          </div>
                                          <div className="feature-item d-flex align-items-center">
                                            <Button
                                              variant="link"
                                              size="sm"
                                              className="p-0 text-decoration-underline"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openPoliciesModal(rate);
                                              }}
                                            >
                                              <FaShieldAlt className="me-2" />
                                              Cancellation Policies &amp; Terms &amp; Conditions
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                      <div
                                        className="text-end px-3 border-start border-end flex-shrink-0"
                                        style={{ minWidth: "220px" }}
                                      >
                                        {rate.normalContractRate != null && (
                                          <div className="text-decoration-line-through text-muted small">
                                            {formatPrice(rate.normalContractRate)}
                                          </div>
                                        )}
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
                                      <div className="flex-shrink-0">
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
                                            className="book-now-btn px-3 py-2"
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
                {isMultiRoom && (() => {
                  // Highlighted status banner for multi-room progress.
                  // Colour + icon flip from amber (in progress) to green
                  // (all rooms picked). Logic unchanged — same disable rule
                  // and handleProceedBooking handler as before.
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
                              ? `All ${numRooms} rooms selected`
                              : `Select rates for your ${numRooms} rooms`}
                          </div>
                          <div className="small text-muted mb-2">
                            {done
                              ? "Note: every room in this booking will be charged at Room 1's selected rate."
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
                </>
              )}
                </Col>
              </Row>
            </div>

            {/* Hotel Information — cancellation / amendment / child
                policy sections have moved into the per-rate
                "Cancellation Policies & Terms & Conditions" modal
                (opens from each room card). Only stay-desk facts stay
                on the page. Mirrors /room-list. */}
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
                    <FaHotel />
                  </div>
                  <div>
                    <div
                      className="fw-bold"
                      style={{ fontSize: "1.1rem", lineHeight: 1.2 }}
                    >
                      Hotel Information
                    </div>
                    <div className="small" style={{ opacity: 0.85 }}>
                      Stay desk &amp; general details
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className="p-4">
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
                        <span className="fw-semibold">Policies vary by room</span>
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
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Cancellation</span>
                        <span className="fw-semibold">See rate conditions</span>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Cancellation Policies & Terms & Conditions Modal — Last Minute
          rates share the same static non-refundable / amendment / child
          policies (they're a fixed-rate product), so this modal just
          renders the same text that used to live in the bottom
          "Booking Policies" card, per rate. Mirrors RoomList.jsx. */}
      <Modal
        show={showPoliciesModal}
        onHide={() => setShowPoliciesModal(false)}
        size="lg"
        centered
        scrollable
        aria-labelledby="lm-policies-terms-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title id="lm-policies-terms-modal">
            Cancellation Policies &amp; Terms &amp; Conditions
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {selectedRateForPolicies && (
            <div className="text-muted small mb-3">
              {(selectedRateForPolicies.rateCode || "Last Minute")}
              {selectedRateForPolicies.mealPlanName
                ? ` • ${selectedRateForPolicies.mealPlanName}`
                : ""}
            </div>
          )}

          <h6 className="text-danger mb-2">
            <FaTimesCircle className="me-2" />
            Cancellation Policy
          </h6>
          <p className="text-muted mb-4">
            Last-minute bookings are non-refundable once confirmed.
            Cancellations or no-shows will be charged 100% of the total
            booking value.
          </p>

          <h6 className="text-warning mb-2 pt-2 border-top">
            <FaInfoCircle className="me-2" />
            Amendment Policy
          </h6>
          <p className="text-muted mb-4">
            Date or guest-name amendments are subject to availability and
            may be charged at the rate difference plus an administrative
            fee.
          </p>

          <h6 className="text-primary mb-2 pt-2 border-top">
            <FaUsers className="me-2" />
            Child Policy &amp; Additional Notes
          </h6>
          <ul className="mb-4 text-muted ps-3">
            <li>
              Last-minute rates may have stricter cancellation rules than
              the regular contract rate.
            </li>
            <li>Mandatory gala dinner fees may apply on certain dates.</li>
            <li>
              Additional taxes or resort fees may be collected at the
              property during check-in.
            </li>
            <li>
              Photo identification and a deposit may be required at
              check-in for incidental charges.
            </li>
          </ul>

          <h6 className="text-secondary mb-2 pt-2 border-top">
            <FaInfoCircle className="me-2" />
            Terms &amp; Conditions
          </h6>
          <p className="text-muted mb-0">
            Rates are quoted in AED and are subject to availability until
            confirmed. Prices include applicable taxes unless stated
            otherwise. All bookings are governed by the property's own
            terms &amp; conditions and check-in requirements.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowPoliciesModal(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* No Payment Path Modal — scenario 3 hard block. Shown right
          here on the room list so the agent doesn't get pushed into a
          booking form they can't submit. */}
      <Modal
        show={showNoPaymentPathModal}
        onHide={() => setShowNoPaymentPathModal(false)}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Booking Cannot Be Completed</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">
            You do not have sufficient credit limit, and online card
            payment is not enabled for your account. Therefore, this
            booking cannot be completed. Please contact your account
            manager or administrator to enable a payment method.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowNoPaymentPathModal(false)}
          >
            OK
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
