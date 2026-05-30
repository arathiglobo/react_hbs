import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Spinner,
  Badge,
  Row,
  Col,
  Alert,
  Accordion,
} from "react-bootstrap";
import { useAccordionButton } from "react-bootstrap/AccordionButton";
import {
  FaHotel,
  FaMapMarkerAlt,
  FaPhone,
  FaCalendarAlt,
  FaBed,
  FaUsers,
  FaStar,
  FaInfoCircle,
  FaShieldAlt,
  FaMoneyBillWave,
  FaUtensils,
  FaChevronDown,
  FaChevronUp,
  FaTimesCircle,
  FaGlobe,
  FaThLarge,
  FaList,
} from "react-icons/fa";
import axiosInstance from "../components/AxiosInstance";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import AgentBalanceDisplay from "../components/AgentBalanceDisplay";
import RoomFilters from "../components/roomlist/RoomFilters";
import useRoomFilters from "../hooks/useRoomFilters";
import { toast } from "react-hot-toast";
import "../styles/RoomList.css";

const formatPrice = (price) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
  }).format(price || 0);

// Short "how it adds up" line for the room card. Shows the exact pieces
// the backend used (months × monthly + remainder per cost type + extra
// adult + child charges) so the operator can sanity-check the total.
const buildBreakdown = (contract, room, totalNights, extraAdults = 0, children = 0) => {
  if (!contract || !room || !totalNights) return null;
  const monthly = Number(room.monthlyRate) || 0;
  const weekly = Number(room.weeklyRate) || 0;
  const daily = Number(room.dayRate) || 0;
  const adultRate = Number(room.adultRate) || 0;
  const childRate = Number(room.childRate) || 0;
  const months = Math.floor(totalNights / 30);
  const extra = totalNights % 30;
  const parts = [];
  if (months > 0) {
    parts.push(`${months} × ${formatPrice(monthly)}`);
  }
  const ct = (contract.additionalCostType || "").toUpperCase();
  if (extra > 0) {
    if (ct === "WEEKLY") {
      const weeks = Math.floor(extra / 7);
      const sub = extra % 7;
      if (weeks > 0) parts.push(`${weeks} wk × ${formatPrice(weekly)}`);
      if (sub > 0) parts.push(`${sub} d × ${formatPrice(daily)}`);
    } else if (ct === "PRO_RATE" || ct === "PRORATE") {
      const perDay = monthly / 30;
      parts.push(`${extra} d × ${formatPrice(perDay)}`);
    } else {
      parts.push(`${extra} d × ${formatPrice(daily)}`);
    }
  }
  // Extras are PER MONTH — show "× N month" where N = totalNights/30.
  // Stringify to 2 decimals only when there's a remainder so the
  // common 1-month / 2-month / 3-month cases stay clean.
  const monthsFactor = totalNights / 30;
  const monthsLabel = Number.isInteger(monthsFactor)
    ? `${monthsFactor} month${monthsFactor === 1 ? "" : "s"}`
    : `${monthsFactor.toFixed(2)} months`;
  if (extraAdults > 0 && adultRate > 0) {
    parts.push(`${extraAdults} extra adult × ${formatPrice(adultRate)} × ${monthsLabel}`);
  }
  if (children > 0 && childRate > 0) {
    parts.push(`${children} child × ${formatPrice(childRate)} × ${monthsLabel}`);
  }
  return parts.join("  +  ");
};

const renderStars = (rating) => {
  const n = Number(rating) || 0;
  if (n <= 0) return <span className="text-muted small">No rating</span>;
  return Array.from({ length: n }, (_, i) => (
    <FaStar key={i} className="text-warning" />
  ));
};

const refundableBadge = (refundable) =>
  refundable ? (
    <Badge bg="success">Flexible</Badge>
  ) : (
    <Badge bg="danger">Non-Refundable</Badge>
  );

const costTypeBadge = (type) => {
  const t = (type || "").toUpperCase();
  if (t === "WEEKLY") {
    return <Badge bg="info">Weekly billing</Badge>;
  }
  if (t === "PRO_RATE" || t === "PRORATE") {
    return <Badge bg="warning" text="dark">Pro-rate billing</Badge>;
  }
  return <Badge bg="secondary">Day-wise billing</Badge>;
};

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

// ── View Toggle Bar ──────────────────────────────────────────────────────────
function ViewToggleBar({ view, onViewChange, count }) {
  return (
    <div className="d-flex justify-content-between align-items-center mb-3">
      <h4 className="mb-0">
        Available Long Stay Contracts ({count})
      </h4>
      <div className="btn-group btn-group-sm" role="group" aria-label="View toggle">
        <button
          type="button"
          className={`btn ${view === "grid" ? "btn-primary" : "btn-outline-secondary"} d-flex align-items-center gap-1`}
          onClick={() => onViewChange("grid")}
          title="Grid view"
        >
          <FaThLarge size={13} />
          <span className="d-none d-sm-inline">Grid</span>
        </button>
        <button
          type="button"
          className={`btn ${view === "list" ? "btn-primary" : "btn-outline-secondary"} d-flex align-items-center gap-1`}
          onClick={() => onViewChange("list")}
          title="List view"
        >
          <FaList size={13} />
          <span className="d-none d-sm-inline">List</span>
        </button>
      </div>
    </div>
  );
}

// ── Grid Room Card ────────────────────────────────────────────────────────────
function RoomCardGrid({ contract, room, totalNights, estPrice, exceedsCap, onBook, extraAdults = 0, extraChildren = 0 }) {
  return (
    <Col lg={6} xl={4} className="mb-3">
      <Card className="rate-card h-100 shadow-sm">
        <Card.Body className="p-3 d-flex flex-column gap-2">
          {/* Header */}
          <div className="rate-header d-flex justify-content-between align-items-start">
            <div>
              <h6 className="mb-1">
                {room.roomCategoryName || `Category #${room.hotelRoomCategoryId}`}
              </h6>
              <div className="small text-muted">
                {room.roomTypeName || `Type #${room.hotelRoomTypeId}`}
              </div>
            </div>
            {refundableBadge(room.refundable)}
          </div>

          {/* Attributes */}
          <div className="small text-muted d-flex flex-wrap gap-3">
            <span>
              <FaUsers className="me-1" />
              {room.occupancyTypeName || `Occ-${room.occupancyTypeId}`}
            </span>
            {room.meal && (
              <span>
                <FaUtensils className="me-1 text-success" />
                Meal included
              </span>
            )}
            {room.extraBed && (
              <span>
                <FaBed className="me-1 text-info" />
                Extra bed
              </span>
            )}
          </div>

          {/* Estimated total + how it's calculated — one compact block
              so the operator sees the headline figure AND the pieces
              that make it up (e.g. "3 × AED 1,000  +  17 d × AED 100")
              without the full rate sheet on screen. */}
          <div className="rate-pricing text-center py-2 border-top border-bottom">
            <div className="small text-muted">
              Estimated total for {totalNights} night{totalNights !== 1 ? "s" : ""}
            </div>
            <div className="current-price fw-bold text-primary" style={{ fontSize: "1.4rem" }}>
              {formatPrice(estPrice)}
            </div>
            {(() => {
              const line = buildBreakdown(contract, room, totalNights, extraAdults, extraChildren);
              return line ? (
                <div className="small text-muted mt-1">{line}</div>
              ) : null;
            })()}
            <div className="price-per-night small text-muted mt-1">
              Final amount confirmed at booking
            </div>
          </div>

          {/* Book button */}
          <Button
            variant={exceedsCap ? "outline-secondary" : "primary"}
            className="w-100 book-now-btn"
            disabled={exceedsCap}
            onClick={() => onBook(contract, room)}
          >
            <FaMoneyBillWave className="me-2" />
            {exceedsCap ? "Stay too long" : "Book this room"}
          </Button>

          <div className="small text-muted text-center">
            <FaShieldAlt className="me-1" />
            Room ID #{room.longStayRoomId}
          </div>
        </Card.Body>
      </Card>
    </Col>
  );
}

// ── List Room Card ────────────────────────────────────────────────────────────
function RoomCardList({ contract, room, totalNights, estPrice, exceedsCap, onBook, extraAdults = 0, extraChildren = 0 }) {
  return (
    <div
      className="d-flex align-items-center gap-3 p-3 mb-2 bg-white border rounded"
      style={{ flexWrap: "wrap" }}
    >
      {/* Left: name & attributes */}
      <div style={{ minWidth: 160, flex: "1 1 160px" }}>
        <div className="fw-semibold small">
          {room.roomCategoryName || `Category #${room.hotelRoomCategoryId}`}
        </div>
        <div className="text-muted" style={{ fontSize: 12 }}>
          {room.roomTypeName || `Type #${room.hotelRoomTypeId}`}
        </div>
        <div className="d-flex flex-wrap gap-2 mt-1">
          {refundableBadge(room.refundable)}
          {room.meal && (
            <Badge bg="success" className="small">
              <FaUtensils className="me-1" />
              Meal
            </Badge>
          )}
          {room.extraBed && (
            <Badge bg="info" className="small">
              <FaBed className="me-1" />
              Extra bed
            </Badge>
          )}
        </div>
      </div>

      {/* Middle: how the total is computed (compact) */}
      <div
        className="small text-muted"
        style={{ flex: "1 1 220px" }}
      >
        <div style={{ fontSize: 11 }}>How it adds up</div>
        <div className="text-dark" style={{ fontSize: 12 }}>
          {buildBreakdown(contract, room, totalNights, extraAdults, extraChildren) || "—"}
        </div>
      </div>

      {/* Right: estimated total (headline) + button */}
      <div className="d-flex align-items-center gap-3 ms-auto" style={{ flexShrink: 0 }}>
        <div className="text-end">
          <div className="text-muted" style={{ fontSize: 11 }}>
            Estimated total · {totalNights} night{totalNights !== 1 ? "s" : ""}
          </div>
          <div className="fw-bold text-primary" style={{ fontSize: 18 }}>
            {formatPrice(estPrice)}
          </div>
        </div>
        <Button
          variant={exceedsCap ? "outline-secondary" : "primary"}
          size="sm"
          disabled={exceedsCap}
          onClick={() => onBook(contract, room)}
          className="d-flex align-items-center gap-1"
        >
          <FaMoneyBillWave size={12} />
          {exceedsCap ? "Stay too long" : "Book"}
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LongStayRoomList() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeAccordion, setActiveAccordion] = useState("0");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"

  // Shared Room-Type + Refund-Policy filters (same UX as /room-list).
  // Long-stay rooms carry `refundable` (boolean); they have no meal-plan
  // string, so the closest "type" label (roomTypeName) is matched against
  // the Room-Type options. The Refund-Policy filter applies fully.
  const filters = useRoomFilters();
  const roomVisible = (r) =>
    filters.rateMatches({
      isNonRefundable: r.refundable === false,
      mealPlan: r.roomTypeName,
    });
  // Agent markup config — fetched once for the agent the search was
  // initiated with. Used by estimateStayPrice to surface the
  // agent-marked-up total (same shape the hotel flow shows: the
  // displayed "from" price is what the agent actually pays).
  // markup = { markupType: "PERCENT" | "AMOUNT", markupValue: Number }
  const [agentMarkup, setAgentMarkup] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("longStayRoomListPayload");
    if (!raw) {
      toast.error("No search context — please search again");
      window.close();
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setError("Search context is corrupted. Please search again.");
      setLoading(false);
      return;
    }
    setDraft(parsed);

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axiosInstance.get(
          `/api/longStayContract?hotelId=${parsed.payload.hotelId}&page=0&size=50`
        );
        const cIn = new Date(parsed.payload.checkInDate);
        const cOut = new Date(parsed.payload.checkOutDate);
        const valid = (res.data.content || []).filter(
          (c) =>
            c.isLive &&
            new Date(c.validityFrom) <= cIn &&
            new Date(c.validityTo) >= cOut
        );
        setContracts(valid);
      } catch (e) {
        console.error("Long stay load failed:", e);
        setError("Failed to load long stay contracts");
        toast.error("Failed to load long stay contracts");
      } finally {
        setLoading(false);
      }
    };
    load();

    // Fire-and-forget: fetch the agent's markup so estimateStayPrice
    // can apply it to each room card's "Estimated total". Silent on
    // failure (404 = agent has no markup → no surcharge to apply).
    const agentId = parsed?.payload?.agentId;
    if (agentId) {
      axiosInstance
        .get(`/api/agents/${agentId}/markup`)
        .then((res) => {
          const d = res.data;
          if (d && d.markupType && d.markupValue != null) {
            setAgentMarkup({
              markupType: d.markupType,
              markupValue: Number(d.markupValue),
            });
          }
        })
        .catch(() => {
          // Agent without configured markup — leave agentMarkup null
          // so the room list shows pre-markup rates.
        });
    }
  }, []);

  const totalNights = useMemo(() => {
    if (!draft) return 0;
    const ci = new Date(draft.payload.checkInDate);
    const co = new Date(draft.payload.checkOutDate);
    return Math.max(0, Math.round((co - ci) / 86400000));
  }, [draft]);

  const guestSummary = useMemo(() => {
    if (!draft?.payload?.rooms) return null;
    const rooms = draft.payload.rooms;
    const adults = rooms.reduce((s, r) => s + (r.adults || 0), 0);
    const children = rooms.reduce((s, r) => s + (r.children || 0), 0);
    return { rooms: rooms.length, adults, children };
  }, [draft]);

  // Sum the party across all requested rooms once.
  // Long-stay convention (matches backend LongStayBookingService and
  // LongStaySearchService): monthly rate covers ONE adult, every
  // additional adult is "extra" billed at adultRate × nights. All
  // children incur childRate × nights.
  const partyExtras = useMemo(() => {
    const list = draft?.payload?.rooms || [];
    let extraAdults = 0;
    let children = 0;
    for (const r of list) {
      const a = Number(r.adults || 0);
      const c = Number(r.children || 0);
      if (a > 1) extraAdults += a - 1;
      children += c;
    }
    return { extraAdults, children };
  }, [draft]);

  // Mirror of the backend LongStayPricingService formula so the UI
  // estimate matches the booking quote. 30-day month for all cost
  // types; the remainder (< 30 days) is billed per the contract's
  // additionalCostType:
  //   • WEEKLY   → 7-day blocks × weeklyRate + sub-week × dayRate
  //   • PRO_RATE → remainder × (monthlyRate / 30)
  //   • else     → remainder × dayRate (day-wise)
  // Then extras: (extraAdults × adultRate + children × childRate) × nights.
  const estimateStayPrice = (contract, room) => {
    if (!contract || !room || !totalNights) return 0;
    const monthly = Number(room.monthlyRate) || 0;
    const weekly = Number(room.weeklyRate) || 0;
    const daily = Number(room.dayRate) || 0;
    const adultRate = Number(room.adultRate) || 0;
    const childRate = Number(room.childRate) || 0;
    const months = Math.floor(totalNights / 30);
    const extraDays = totalNights % 30;
    const monthsAmount = months * monthly;

    let base;
    const ct = (contract.additionalCostType || "").toUpperCase();
    if (ct === "WEEKLY") {
      const weeks = Math.floor(extraDays / 7);
      const subWeekDays = extraDays % 7;
      base = monthsAmount + weeks * weekly + subWeekDays * daily;
    } else if (ct === "PRO_RATE" || ct === "PRORATE") {
      base = monthsAmount + extraDays * (monthly / 30);
    } else {
      base = monthsAmount + extraDays * daily;
    }
    // adultRate / childRate are PER MONTH (mirrors monthlyRate cadence).
    // Pro-rate by months stayed: 30 nights = 1×, 60 nights = 2×, etc.
    const monthsFactor = totalNights / 30;
    const extras =
      (partyExtras.extraAdults * adultRate + partyExtras.children * childRate) *
      monthsFactor;
    const subtotal = base + extras;

    // Apply agent markup last — same shape the backend uses
    // (LongStayBookingService#applyAgentMarkup → calculateMarkupDirect).
    // PERCENT: subtotal + subtotal × value / 100. AMOUNT: subtotal + value.
    if (agentMarkup && agentMarkup.markupValue > 0) {
      if (agentMarkup.markupType === "PERCENT") {
        return subtotal + (subtotal * agentMarkup.markupValue) / 100;
      }
      if (agentMarkup.markupType === "AMOUNT") {
        return subtotal + agentMarkup.markupValue;
      }
    }
    return subtotal;
  };

  const handleBook = (contract, room) => {
    if (contract.maxBookingDays && totalNights > contract.maxBookingDays) {
      toast.error(
        `Selected contract caps stays at ${contract.maxBookingDays} nights — your dates are ${totalNights}.`
      );
      return;
    }
    sessionStorage.setItem(
      "longStayBookingDraft",
      JSON.stringify({
        hotelId: draft.payload.hotelId,
        hotelName: draft.meta.hotelName,
        // Pass the hotel address through so the booking page's
        // confirmation summary can render it under the hotel name
        // (the long-stay search payload puts it on meta.address).
        address: draft.meta?.address || "",
        checkIn: draft.payload.checkInDate,
        checkOut: draft.payload.checkOutDate,
        agentId: draft.payload.agentId || null,
        nationality: draft.payload.nationality || null,
        rooms: draft.payload.rooms || [],
        contract,
        room,
      })
    );
    navigate("/long-stay-booking-page");
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <div className="text-center">
              <Spinner animation="border" variant="primary" />
              <h5 className="text-primary fw-bold mt-3 mb-1">
                Fetching Long Stay Contracts…
              </h5>
              <p className="text-muted small mb-0">
                Comparing rates and validity windows
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center p-3">
            <div style={{ maxWidth: 480 }}>
              <Alert variant="danger">
                <Alert.Heading>Error</Alert.Heading>
                <p className="mb-0">{error}</p>
              </Alert>
              <Button variant="primary" onClick={() => window.close()}>
                Close
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!draft) return null;

  return (
    <div className="min-vh-100 bg-light d-flex flex-column room-list-container">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="content-wrapper flex-grow-1" style={{ minWidth: 0, overflowX: "hidden" }}>
          <div className="container-fluid" style={{ paddingTop: "10px" }}>
            <div className="d-flex justify-content-end mb-2">
              <AgentBalanceDisplay agentId={draft?.payload?.agentId} />
            </div>

            {/* ── Hotel Header ─────────────────────────────────────────────── */}
            <Card className="hotel-header-card mb-4">
              <Card.Body className="p-4">
                <Row>
                  <Col md={8}>
                    <div className="d-flex align-items-start gap-3">
                      {draft?.meta?.hotelImage ? (
                        <img
                          src={draft.meta.hotelImage}
                          alt={draft.meta.hotelName}
                          style={{
                            width: 80,
                            height: 80,
                            objectFit: "cover",
                            borderRadius: 8,
                          }}
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="hotel-icon">
                          <FaHotel size={40} className="text-primary" />
                        </div>
                      )}
                      <div className="hotel-info flex-grow-1">
                        <h2 className="hotel-name mb-2">
                          {draft.meta?.hotelName || "—"}
                        </h2>
                        <div className="d-flex align-items-center gap-3 mb-2">
                          <div className="star-rating">
                            {renderStars(draft.meta?.starRating)}
                          </div>
                          <Badge bg="primary">Long Stay</Badge>
                        </div>
                        <div className="hotel-details">
                          <p className="mb-1">
                            <FaMapMarkerAlt className="text-muted me-2" />
                            {draft.meta?.address || "Address not available"}
                          </p>
                          {draft.meta?.phone && (
                            <p className="mb-0">
                              <FaPhone className="text-muted me-2" />
                              {draft.meta.phone}
                            </p>
                          )}
                          <div className="mt-2">
                            <small className="text-muted">
                              <strong>Please note:</strong>{" "}
                              <span className="someproperties">
                                Long-stay contracts may require minimum stays.
                                Additional charges (deposit, cleaning, utilities)
                                may apply at check-in. Policies such as deposit,
                                early checkout, and minimum-stay rules vary by
                                contract.
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

                  <Col md={4}>
                    <Card className="booking-summary">
                      <Card.Body className="p-3">
                        <h6 className="mb-3">Stay Summary</h6>
                        <div className="booking-details">
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaCalendarAlt className="text-muted me-2" />
                              Check-in:
                            </span>
                            <span className="fw-semibold">
                              {draft.payload.checkInDate}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaCalendarAlt className="text-muted me-2" />
                              Check-out:
                            </span>
                            <span className="fw-semibold">
                              {draft.payload.checkOutDate}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaBed className="text-muted me-2" />
                              Total nights:
                            </span>
                            <span className="fw-semibold">{totalNights}</span>
                          </div>
                          {guestSummary && (
                            <>
                              <div className="d-flex justify-content-between mb-2">
                                <span>
                                  <FaUsers className="text-muted me-2" />
                                  Guests:
                                </span>
                                <span className="fw-semibold">
                                  {guestSummary.adults} adult
                                  {guestSummary.adults !== 1 ? "s" : ""}
                                  {guestSummary.children > 0
                                    ? `, ${guestSummary.children} child${guestSummary.children !== 1 ? "ren" : ""}`
                                    : ""}
                                </span>
                              </div>
                              <div className="d-flex justify-content-between mb-2">
                                <span>
                                  <FaBed className="text-muted me-2" />
                                  Rooms:
                                </span>
                                <span className="fw-semibold">
                                  {guestSummary.rooms}
                                </span>
                              </div>
                            </>
                          )}
                          {draft.payload.nationality && (
                            <div className="d-flex justify-content-between">
                              <span>
                                <FaGlobe className="text-muted me-2" />
                                Nationality:
                              </span>
                              <span className="fw-semibold">
                                {draft.payload.nationality}
                              </span>
                            </div>
                          )}
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* ── Contracts Section ─────────────────────────────────────────── */}
            <div className="room-categories-section">

              {/* View Toggle Bar */}
              <ViewToggleBar
                view={viewMode}
                onViewChange={setViewMode}
                count={contracts.length}
              />

              <Row className="g-3">
                <Col lg={3} md={4}>
                  <RoomFilters filters={filters} />
                </Col>
                <Col lg={9} md={8}>
              {contracts.length === 0 ? (
                <Card className="p-5 text-center text-muted">
                  <FaInfoCircle size={32} className="text-muted mx-auto mb-2" />
                  <h5>No active Long Stay contracts cover these dates</h5>
                  <p className="mb-0 small">
                    Try adjusting your check-in / check-out range, or contact
                    the hotel directly.
                  </p>
                </Card>
              ) : (
                <Accordion
                  activeKey={activeAccordion}
                  onSelect={(key) => setActiveAccordion(key)}
                >
                  {contracts.map((c, index) => {
                    const eventKey = index.toString();
                    const isActive = activeAccordion === eventKey;
                    const exceedsCap =
                      c.maxBookingDays && totalNights > c.maxBookingDays;
                    // Apply Room-Type / Refund-Policy filters per room. Only
                    // skip the whole contract when filters are active AND
                    // nothing matches, so an unfiltered empty contract still
                    // renders its "no rooms configured" note exactly as before.
                    const visibleRooms = (c.rooms || []).filter(roomVisible);
                    if (filters.hasActiveFilters && visibleRooms.length === 0)
                      return null;
                    const minPrice =
                      visibleRooms.reduce((acc, r) => {
                        const p = estimateStayPrice(c, r);
                        return acc === null || p < acc ? p : acc;
                      }, null) ?? 0;

                    return (
                      <Accordion.Item
                        key={eventKey}
                        eventKey={eventKey}
                        className="room-category-item mb-2"
                      >
                        <Accordion.Header
                          as="div"
                          className="room-category-header"
                        >
                          <div className="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
                            <div className="room-category-info">
                              <h5 className="mb-1 d-flex align-items-center gap-2 flex-wrap">
                                <span>{c.rateCode}</span>
                                {costTypeBadge(c.additionalCostType)}
                              </h5>
                              <p className="mb-0 text-muted small">
                                <FaCalendarAlt className="me-1" />
                                Validity: <strong>{c.validityFrom}</strong> →{" "}
                                <strong>{c.validityTo}</strong>
                                {c.maxBookingDays ? (
                                  <>
                                    {" "}
                                    · Max stay:{" "}
                                    <strong>{c.maxBookingDays}</strong> nights
                                  </>
                                ) : (
                                  " · No stay cap"
                                )}
                              </p>
                            </div>

                            <div className="d-flex align-items-center gap-3">
                              <div className="room-category-price text-end">
                                <div className="price-range">
                                  From {formatPrice(minPrice)}
                                </div>
                                <div className="rates-count small text-muted">
                                  {visibleRooms.length} room
                                  {visibleRooms.length !== 1 ? "s" : ""}{" "}
                                  available
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
                          {exceedsCap && (
                            <Alert variant="warning" className="py-2 small mb-3">
                              <FaInfoCircle className="me-2" />
                              Your selected stay is{" "}
                              <strong>{totalNights}</strong> nights but this
                              contract allows max{" "}
                              <strong>{c.maxBookingDays}</strong> nights. Booking
                              will be blocked for all rooms in this contract.
                            </Alert>
                          )}

                          {/* ── Grid View ──────────────────────────────────── */}
                          {viewMode === "grid" && (
                            <Row>
                              {visibleRooms.map((r) => (
                                <RoomCardGrid
                                  key={r.longStayRoomId}
                                  contract={c}
                                  room={r}
                                  totalNights={totalNights}
                                  estPrice={estimateStayPrice(c, r)}
                                  exceedsCap={exceedsCap}
                                  onBook={handleBook}
                                  extraAdults={partyExtras.extraAdults}
                                  extraChildren={partyExtras.children}
                                />
                              ))}
                              {(!c.rooms || c.rooms.length === 0) && (
                                <Col xs={12}>
                                  <Alert variant="info" className="mb-0 small">
                                    This contract has no rooms configured.
                                  </Alert>
                                </Col>
                              )}
                            </Row>
                          )}

                          {/* ── List View ──────────────────────────────────── */}
                          {viewMode === "list" && (
                            <div>
                              {visibleRooms.map((r) => (
                                <RoomCardList
                                  key={r.longStayRoomId}
                                  contract={c}
                                  room={r}
                                  totalNights={totalNights}
                                  estPrice={estimateStayPrice(c, r)}
                                  exceedsCap={exceedsCap}
                                  onBook={handleBook}
                                  extraAdults={partyExtras.extraAdults}
                                  extraChildren={partyExtras.children}
                                />
                              ))}
                              {(!c.rooms || c.rooms.length === 0) && (
                                <Alert variant="info" className="mb-0 small">
                                  This contract has no rooms configured.
                                </Alert>
                              )}
                            </div>
                          )}
                        </Accordion.Body>
                      </Accordion.Item>
                    );
                  })}
                  {filters.hasActiveFilters &&
                    contracts.length > 0 &&
                    contracts.every(
                      (c) => (c.rooms || []).filter(roomVisible).length === 0,
                    ) && (
                      <Alert variant="info" className="mb-0">
                        No rooms match the selected filters.
                      </Alert>
                    )}
                </Accordion>
              )}
                </Col>
              </Row>
            </div>

            {/* ── Additional Information ───────────────────────────────────── */}
            <div className="mt-4">
              <Card className="mb-4">
                <Card.Header as="h6">Additional Information</Card.Header>
                <Card.Body>
                  <ul className="mb-0 text-muted">
                    <li>
                      Long stay contracts typically require a refundable
                      security deposit collected at check-in.
                    </li>
                    <li>
                      Cleaning, utility, and resort fees may apply on top of the
                      monthly / day rate per the contract.
                    </li>
                    <li>
                      Extra adult / extra child rates apply only when the
                      contract marks the room as having an extra bed.
                    </li>
                    <li>
                      Photo identification may be required at check-in for
                      incidental charges.
                    </li>
                  </ul>
                </Card.Body>
              </Card>

              <Card className="mb-4">
                <Card.Header as="h6">Policies</Card.Header>
                <Card.Body>
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
                        <span className="text-muted">Minimum stay</span>
                        <span className="fw-semibold">
                          Per contract (see card)
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
                        <span className="text-muted">
                          <FaTimesCircle className="text-danger me-1" />
                          Cancellation
                        </span>
                        <span className="fw-semibold">See contract terms</span>
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