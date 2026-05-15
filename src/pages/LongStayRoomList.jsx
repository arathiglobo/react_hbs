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
import { toast } from "react-hot-toast";
import "../styles/RoomList.css";

const formatPrice = (price) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
  }).format(price || 0);

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
  const isWeekly = type === "WEEKLY";
  return (
    <Badge bg={isWeekly ? "warning" : "info"} text={isWeekly ? "dark" : undefined}>
      {isWeekly ? "Weekly billing" : "Day-wise billing"}
    </Badge>
  );
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
function RoomCardGrid({ contract, room, totalNights, estPrice, exceedsCap, onBook }) {
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

          {/* Rates table */}
          <div className="bg-light rounded p-2 small">
            <div className="d-flex justify-content-between">
              <span className="text-muted">Monthly rate</span>
              <span className="fw-semibold">{formatPrice(room.monthlyRate)}</span>
            </div>
            {contract.additionalCostType === "WEEKLY" && (
              <div className="d-flex justify-content-between">
                <span className="text-muted">Weekly rate</span>
                <span className="fw-semibold">
                  {room.weeklyRate ? formatPrice(room.weeklyRate) : "—"}
                </span>
              </div>
            )}
            <div className="d-flex justify-content-between">
              <span className="text-muted">Day rate</span>
              <span className="fw-semibold">
                {room.dayRate ? formatPrice(room.dayRate) : "—"}
              </span>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">Extra adult</span>
              <span>{room.adultRate ? formatPrice(room.adultRate) : "—"}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">Extra child</span>
              <span>{room.childRate ? formatPrice(room.childRate) : "—"}</span>
            </div>
          </div>

          {/* Estimated total */}
          <div className="rate-pricing text-center py-2 border-top">
            <div className="small text-muted">
              Estimated for {totalNights} night{totalNights !== 1 ? "s" : ""}
            </div>
            <div className="current-price">{formatPrice(estPrice)}</div>
            <div className="price-per-night small text-muted">
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
function RoomCardList({ contract, room, totalNights, estPrice, exceedsCap, onBook }) {
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

      {/* Middle: rates */}
      <div
        className="d-flex gap-3 small text-muted"
        style={{ flex: "1 1 220px", flexWrap: "wrap" }}
      >
        <div>
          <div style={{ fontSize: 11 }}>Monthly</div>
          <div className="fw-semibold text-dark">{formatPrice(room.monthlyRate)}</div>
        </div>
        {contract.additionalCostType === "WEEKLY" && (
          <div>
            <div style={{ fontSize: 11 }}>Weekly</div>
            <div className="fw-semibold text-dark">
              {room.weeklyRate ? formatPrice(room.weeklyRate) : "—"}
            </div>
          </div>
        )}
        <div>
          <div style={{ fontSize: 11 }}>Per day</div>
          <div className="fw-semibold text-dark">
            {room.dayRate ? formatPrice(room.dayRate) : "—"}
          </div>
        </div>
      </div>

      {/* Right: estimated total + button */}
      <div className="d-flex align-items-center gap-3 ms-auto" style={{ flexShrink: 0 }}>
        <div className="text-end">
          <div className="text-muted" style={{ fontSize: 11 }}>
            Est. {totalNights} night{totalNights !== 1 ? "s" : ""}
          </div>
          <div className="fw-semibold text-primary" style={{ fontSize: 16 }}>
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

  const estimateStayPrice = (contract, room) => {
    if (!contract || !room || !totalNights) return 0;
    if (contract.additionalCostType === "WEEKLY") {
      const weeks = Math.floor(totalNights / 7);
      const extraDays = totalNights % 7;
      return weeks * (room.weeklyRate || 0) + extraDays * (room.dayRate || 0);
    }
    const months = Math.floor(totalNights / 30);
    const extraDays = totalNights % 30;
    return months * (room.monthlyRate || 0) + extraDays * (room.dayRate || 0);
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
      <div className="main-content">
        <Sidebar />
        <main className="content-wrapper">
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
                    const minPrice =
                      (c.rooms || []).reduce((acc, r) => {
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
                                  {(c.rooms || []).length} room
                                  {(c.rooms || []).length !== 1 ? "s" : ""}{" "}
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
                              {(c.rooms || []).map((r) => (
                                <RoomCardGrid
                                  key={r.longStayRoomId}
                                  contract={c}
                                  room={r}
                                  totalNights={totalNights}
                                  estPrice={estimateStayPrice(c, r)}
                                  exceedsCap={exceedsCap}
                                  onBook={handleBook}
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
                              {(c.rooms || []).map((r) => (
                                <RoomCardList
                                  key={r.longStayRoomId}
                                  contract={c}
                                  room={r}
                                  totalNights={totalNights}
                                  estPrice={estimateStayPrice(c, r)}
                                  exceedsCap={exceedsCap}
                                  onBook={handleBook}
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
                </Accordion>
              )}
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