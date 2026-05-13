import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Row,
  Col,
  Table,
  Badge,
  Spinner,
  Accordion,
  Modal,
} from "react-bootstrap";
import {
  FaArrowLeft,
  FaClock,
  FaHotel,
  FaMapMarkerAlt,
  FaPhone,
  FaCalendarAlt,
  FaUsers,
  FaBed,
  FaGlobe,
  FaStar,
  FaUtensils,
  FaCoffee,
  FaCheckCircle,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import "../../styles/RoomList.css";

/**
 * DayStayRoomList — mirrors the structure of /room-list (RoomList.jsx).
 *
 *  - Hotel header card with title, stars, address, "Back to Search" button.
 *  - Booking Summary card (date, check-in / check-out time, hotel window).
 *  - Room Categories accordion: rate rows grouped by category, each row has
 *    meal-plan icon, refundable / non-refundable badge, day-stay rate, Book
 *    button.
 *
 * Reads dayStayRoomListPayload from sessionStorage and continues to the
 * booking page on Book.
 */
export default function DayStayRoomList() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  // Primary contract — the one the user clicked on (for window cap calc).
  const [contract, setContract] = useState(null);
  // All contracts for the same hotel that matched the search (each window
  // is rendered as its own section in the list).
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeAccordion, setActiveAccordion] = useState("0");
  const [showSelectedModal, setShowSelectedModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [agentBalance, setAgentBalance] = useState(null);
  // Grid / list view toggle — same pattern as RoomList.jsx
  const [viewMode, setViewMode] = useState("list");

  useEffect(() => {
    const raw = sessionStorage.getItem("dayStayRoomListPayload");
    if (!raw) {
      setLoading(false);
      return;
    }
    try {
      const p = JSON.parse(raw);
      setPayload(p);
      // Fetch every contract id passed from search so the user can see all
      // windows offered by the hotel.
      const ids =
        (p.allContractIds && p.allContractIds.length > 0
          ? p.allContractIds
          : p.contractId
          ? [p.contractId]
          : []);
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      Promise.all(
        ids.map((id) =>
          axiosInstance
            .get(`/api/day-stay-contract/${id}`)
            .then((r) => r.data)
            .catch(() => null)
        )
      )
        .then((rows) => {
          const ok = rows.filter(Boolean);
          setContracts(ok);
          setContract(
            ok.find((c) => c?.id === p.contractId) || ok[0] || null
          );
        })
        .finally(() => setLoading(false));
    } catch {
      setLoading(false);
    }
  }, []);

  // Agent balance (in red) — same as RoomList.
  useEffect(() => {
    if (!payload?.agentId) {
      setAgentBalance(null);
      return;
    }
    let cancelled = false;
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${payload.agentId}`)
      .then((res) => {
        if (!cancelled)
          setAgentBalance(res?.data?.availableCreditLimit ?? null);
      })
      .catch(() => {
        if (!cancelled) setAgentBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  const adjustedCheckOut = useMemo(() => {
    if (!payload || !contract) return payload?.checkOutTime || "";
    if (!payload.checkOutTime) return contract.checkInEndTime;
    return payload.checkOutTime > contract.checkInEndTime
      ? contract.checkInEndTime
      : payload.checkOutTime;
  }, [payload, contract]);

  // Build category list for any one contract — used inside each window section.
  const buildCategories = (c) => {
    if (!c) return [];
    const rooms = c.roomRates || c.rooms || [];
    if (rooms.length === 0) {
      return [
        {
          name: "Day Stay Standard",
          rates: [
            {
              key: "base",
              roomTypeName: "Standard Room",
              mealPlan: "Room Only",
              dayStayRate: c.dayStayRate,
              refundable: true,
            },
          ],
        },
      ];
    }
    const byCat = new Map();
    rooms.forEach((r, i) => {
      // Only surface rate rows the user actually configured. Skip placeholder
      // rows where neither the room rate nor the extras carry any value.
      const rate = Number(r.rate ?? r.dayStayRate ?? 0);
      const adultRate = Number(r.adultRate || 0);
      const childRate = Number(r.childRate || 0);
      if (rate <= 0 && adultRate <= 0 && childRate <= 0) return;

      const cat = r.roomCategoryName || "Day Stay Rooms";
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push({
        key: r.id || `${cat}-${i}`,
        // Backend now returns the actual hotel-configured names. Fall back
        // sensibly when older rows have nulls.
        roomTypeName: r.roomTypeName || r.mealType || "Standard",
        occupancyTypeName: r.occupancyTypeName || "—",
        mealPlan: r.mealType || r.roomTypeName || "Room Only",
        dayStayRate: rate || c.dayStayRate,
        adultRate: r.adultRate,
        childRate: r.childRate,
        meal: r.meal,
        refundable: r.refundable,
        roomCategoryName: cat,
        contractId: c.id,
      });
    });
    return Array.from(byCat.entries()).map(([name, rates]) => ({ name, rates }));
  };

  const renderStars = (count) =>
    Array.from({ length: Math.max(0, Number(count) || 0) }).map((_, i) => (
      <FaStar key={i} className="text-warning" />
    ));

  // Compute final per-room rate using the row's adult/child rates + the
  // contract-level markup percentage. First adult is included in the base,
  // each extra adult and each child adds on. Returns null when base is 0.
  const computeFinalRate = (row) => {
    const base = Number(row.dayStayRate || 0);
    if (!base) return null;
    const adultsN = Number(payload?.adults || 1);
    const childrenN = Number(payload?.children || 0);
    const extras =
      Math.max(0, adultsN - 1) * Number(row.adultRate || 0) +
      childrenN * Number(row.childRate || 0);
    const pct = Number(payload?.basePctRate || 0);
    return +((base + extras) * (1 + pct / 100)).toFixed(2);
  };
  const computeRoomsTotal = (row) => {
    const r = computeFinalRate(row);
    if (r == null) return null;
    return +(r * (Number(payload?.rooms) || 1)).toFixed(2);
  };

  const getMealPlanIcon = (mp = "") => {
    const m = (mp || "").toLowerCase();
    if (m.includes("breakfast")) return <FaCoffee className="text-primary me-1" />;
    if (m.includes("all inclusive")) return <FaUtensils className="text-success me-1" />;
    if (m.includes("full board")) return <FaUtensils className="text-warning me-1" />;
    if (m.includes("half board")) return <FaUtensils className="text-info me-1" />;
    return <FaBed className="text-muted me-1" />;
  };

  const openBookConfirm = (row) => {
    setSelectedRow(row);
    setShowSelectedModal(true);
  };

  const proceedToBooking = () => {
    if (!selectedRow || !payload) return;
    const totalAmount = computeRoomsTotal(selectedRow) ?? 0;
    const perRoomFinal = computeFinalRate(selectedRow) ?? 0;
    const bookingPayload = {
      ...payload,
      // Keep contract window times; adjustedCheckOut already caps to window end.
      checkOutTime: adjustedCheckOut,
      roomCategory: selectedRow.roomCategoryName,
      roomType: selectedRow.roomTypeName,
      occupancyTypeName: selectedRow.occupancyTypeName,
      mealPlan: selectedRow.mealPlan,
      rateRow: selectedRow,
      dayStayRate: perRoomFinal,
      perRoomRate: perRoomFinal,
      totalAmount,
    };
    sessionStorage.setItem(
      "dayStayBookingPayload",
      JSON.stringify(bookingPayload)
    );
    navigate("/day-stay-booking-page");
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4 text-center">
            <Spinner animation="border" />
          </main>
        </div>
      </div>
    );
  }

  if (!payload || !contract) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4">
            <Card className="shadow-sm">
              <Card.Body className="text-center text-muted py-5">
                <h5>Day Stay information missing</h5>
                <p>Please go back to Day Stay search and try again.</p>
                <Button onClick={() => navigate("/new-booking/day-stay")}>
                  Back to Search
                </Button>
              </Card.Body>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  const totalGuests =
    Number(payload.adults || 0) + Number(payload.children || 0);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column room-list-container">
      {/* Inline style — slim accordion header padding for day-stay sections. */}
      <style>{`
        .day-stay-cat-header .accordion-button {
          padding: 0.55rem 1rem !important;
          background: #fafbfd;
          font-size: 0.95rem;
        }
        .day-stay-cat-header .accordion-button:not(.collapsed) {
          background: #eef3ff;
          color: #0d6efd;
        }
      `}</style>
      <TopBar />
      <div className="main-content">
        <Sidebar />
        <main className="content-wrapper">
          <div className="container-fluid" style={{ paddingTop: "10px" }}>
            {/* Agent available balance — top-right red indicator */}
            {agentBalance != null && (
              <div
                className="d-flex justify-content-end mb-2"
                style={{ fontSize: "0.95rem" }}
              >
                <span className="fw-bold" style={{ color: "#dc3545" }}>
                  Available Balance: {Number(agentBalance).toFixed(2)}
                </span>
              </div>
            )}

            {/* Hotel Header Card — mirrors RoomList.jsx */}
            <Card className="hotel-header-card mb-4">
              <Card.Body className="p-4">
                <Row>
                  <Col md={8}>
                    <div className="d-flex align-items-start gap-3">
                      <div className="hotel-icon">
                        <FaHotel size={40} className="text-primary" />
                      </div>
                      <div className="hotel-info">
                        <h2 className="hotel-name mb-2">
                          {payload.hotelName}
                        </h2>
                        <div className="d-flex align-items-center gap-3 mb-2">
                          <Badge bg="primary">Day Stay</Badge>
                          <Badge bg="info">
                            {(contract.checkInStartTime || "").slice(0, 5)} –{" "}
                            {(contract.checkInEndTime || "").slice(0, 5)}
                          </Badge>
                        </div>
                        <div className="hotel-details">
                          <p className="mb-1">
                            <FaMapMarkerAlt className="text-muted me-2" />
                            {payload.hotelAddress || "—"}
                          </p>
                          <div className="mt-2">
                            <small className="text-muted">
                              <strong>Please note:</strong>{" "}
                              <p className="someproperties">
                                Day-stay check-outs are auto-capped to the
                                hotel's window end. Day-stay rates do not
                                include overnight stays or breakfast unless
                                otherwise indicated on the rate row.
                              </p>
                            </small>
                          </div>
                        </div>
                        <div className="mt-3">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => navigate(-1)}
                          >
                            <FaArrowLeft className="me-1" /> Back to Search
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <Card className="booking-summary">
                      <Card.Body className="p-3">
                        <h6 className="mb-3">Booking Summary</h6>
                        <div className="booking-details">
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaCalendarAlt className="text-muted me-2" />
                              Date:
                            </span>
                            <span className="fw-semibold">
                              {payload.checkInDate}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaClock className="text-muted me-2" />
                              Check-in:
                            </span>
                            <span className="fw-semibold">
                              {payload.checkInTime}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaClock className="text-muted me-2" />
                              Check-out:
                            </span>
                            <span className="fw-semibold">
                              {adjustedCheckOut}
                              {payload.checkOutTime !== adjustedCheckOut && (
                                <Badge
                                  bg="warning"
                                  text="dark"
                                  className="ms-2"
                                  style={{ fontSize: "0.65rem" }}
                                >
                                  Capped
                                </Badge>
                              )}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaUsers className="text-muted me-2" />
                              Guests:
                            </span>
                            <span className="fw-semibold">
                              {payload.adults || 0} Adult
                              {payload.adults > 1 ? "s" : ""}
                              {payload.children
                                ? `, ${payload.children} Child${
                                    payload.children > 1 ? "ren" : ""
                                  }`
                                : ""}
                            </span>
                          </div>
                          {Array.isArray(payload.childAges) &&
                            payload.childAges.length > 0 && (
                              <div className="d-flex justify-content-between mb-2 small text-muted">
                                <span>Child Ages:</span>
                                <span>
                                  {payload.childAges
                                    .map((a) => `${a}y`)
                                    .join(", ")}
                                </span>
                              </div>
                            )}
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaBed className="text-muted me-2" />
                              Rooms:
                            </span>
                            <span className="fw-semibold">
                              {payload.rooms || 1}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span>
                              <FaGlobe className="text-muted me-2" />
                              Nationality:
                            </span>
                            <span className="fw-semibold">
                              {payload.nationality || "—"}
                            </span>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Room Categories Accordion — mirrors RoomList.jsx.
                One Accordion per contract: each contract has its own daily
                check-in window so we render them as separate sections. */}
            <div className="room-categories-section">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="mb-0">Available Day Stay Rates</h4>
                <div className="d-flex align-items-center gap-2">
                  <Badge bg="secondary">
                    {contracts.length} Window{contracts.length > 1 ? "s" : ""}
                  </Badge>
                  <div className="btn-group shadow-sm gap-1" role="group">
                    <Button
                      variant={
                        viewMode === "grid" ? "primary" : "outline-primary"
                      }
                      onClick={() => setViewMode("grid")}
                      className="d-flex align-items-center gap-2"
                      size="sm"
                      title="Grid view"
                    >
                      <span className="fs-5" style={{ lineHeight: 1 }}>
                        ⊞
                      </span>
                    </Button>
                    <Button
                      variant={
                        viewMode === "list" ? "primary" : "outline-primary"
                      }
                      onClick={() => setViewMode("list")}
                      className="d-flex align-items-center gap-2"
                      size="sm"
                      title="List view"
                    >
                      <span className="fs-5" style={{ lineHeight: 1 }}>
                        ☰
                      </span>
                    </Button>
                  </div>
                </div>
              </div>

              {contracts.map((c, ci) => {
                const winStart = (c.checkInStartTime || "").slice(0, 5);
                const winEnd = (c.checkInEndTime || "").slice(0, 5);
                const catList = buildCategories(c);
                return (
              <div key={c.id || ci} className="mb-4">
                <div
                  className="d-flex justify-content-between align-items-center mb-2 px-3 py-2"
                  style={{
                    background: "#f0f4ff",
                    borderRadius: "8px",
                    borderLeft: "4px solid #0d6efd",
                  }}
                >
                  <div className="fw-semibold text-primary">
                    <FaClock className="me-2" />
                    Window: {winStart} – {winEnd}
                  </div>
                  <small className="text-muted">
                    {c.rateCode ? `Rate Code: ${c.rateCode}` : ""}
                  </small>
                </div>
              <Accordion
                defaultActiveKey="0"
              >
                {catList.map((category, index) => {
                  const eventKey = index.toString();
                  return (
                    <Accordion.Item
                      key={eventKey}
                      eventKey={eventKey}
                      className="room-category-item"
                    >
                      {/* Default Accordion.Header renders as a <button>
                          which keeps Bootstrap's built-in chevron. We just
                          slim it down with inline padding overrides. */}
                      <Accordion.Header className="day-stay-cat-header">
                        <div
                          className="d-flex justify-content-between align-items-center w-100 pe-3"
                          style={{ paddingTop: 0, paddingBottom: 0 }}
                        >
                          <div>
                            <div
                              className="fw-semibold"
                              style={{ fontSize: "0.95rem" }}
                            >
                              {category.name}
                            </div>
                            <small className="text-muted">
                              {category.rates.length} rate
                              {category.rates.length > 1 ? "s" : ""}{" "}
                              available
                            </small>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <FaClock className="text-primary" />
                            <span
                              className="fw-semibold"
                              style={{ fontSize: "0.9rem" }}
                            >
                              {winStart} – {winEnd}
                            </span>
                          </div>
                        </div>
                      </Accordion.Header>
                      <Accordion.Body className="p-0">
                        {viewMode === "list" ? (
                          <Table responsive bordered hover className="mb-0">
                            <thead className="table-light">
                              <tr>
                                <th>Occupancy</th>
                                <th>Room Type</th>
                                <th>Meal Plan</th>
                                <th>Refund Policy</th>
                                <th>Extra Bed</th>
                                <th className="text-end">
                                  Rate (per room)
                                </th>
                                <th className="text-end">Total</th>
                                <th style={{ width: 110 }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {category.rates.map((rate) => {
                                const finalRate = computeFinalRate(rate);
                                const total = computeRoomsTotal(rate);
                                const pct = Number(payload.basePctRate || 0);
                                return (
                                  <tr key={rate.key}>
                                    <td>
                                      <FaUsers className="text-muted me-1" />
                                      {rate.occupancyTypeName}
                                    </td>
                                    <td>
                                      <FaBed className="text-muted me-2" />
                                      {rate.roomTypeName}
                                    </td>
                                    <td>
                                      {getMealPlanIcon(rate.mealPlan)}
                                      {rate.mealPlan}
                                    </td>
                                    <td>
                                      {rate.refundable ? (
                                        <Badge bg="success">Refundable</Badge>
                                      ) : (
                                        <Badge bg="danger">
                                          Non-Refundable
                                        </Badge>
                                      )}
                                    </td>
                                    <td>
                                      {Number(rate.adultRate || 0) > 0 ||
                                      Number(rate.childRate || 0) > 0 ? (
                                        <small>
                                          Adult: AED{" "}
                                          {Number(
                                            rate.adultRate || 0
                                          ).toFixed(0)}{" "}
                                          / Child: AED{" "}
                                          {Number(
                                            rate.childRate || 0
                                          ).toFixed(0)}
                                        </small>
                                      ) : (
                                        <span className="text-muted small">
                                          —
                                        </span>
                                      )}
                                    </td>
                                    <td className="text-end">
                                      {finalRate != null ? (
                                        <>
                                          <strong>
                                            AED{" "}
                                            {finalRate.toLocaleString()}
                                          </strong>
                                          {pct > 0 && (
                                            <div>
                                              <small className="text-muted">
                                                incl. {pct}%
                                              </small>
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <span className="text-muted">—</span>
                                      )}
                                    </td>
                                    <td className="text-end fw-bold text-success">
                                      {total != null
                                        ? `AED ${total.toLocaleString()}`
                                        : "—"}
                                    </td>
                                    <td>
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() => openBookConfirm(rate)}
                                      >
                                        Book
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </Table>
                        ) : (
                          <Row className="g-3 p-3">
                            {category.rates.map((rate) => {
                              const finalRate = computeFinalRate(rate);
                              const total = computeRoomsTotal(rate);
                              return (
                                <Col md={4} key={rate.key}>
                                  <Card className="h-100 shadow-sm">
                                    <Card.Body>
                                      <div className="d-flex justify-content-between mb-2">
                                        <Badge bg="info">
                                          <FaUsers className="me-1" />
                                          {rate.occupancyTypeName}
                                        </Badge>
                                        {rate.refundable ? (
                                          <Badge bg="success">
                                            Refundable
                                          </Badge>
                                        ) : (
                                          <Badge bg="danger">
                                            Non-Refundable
                                          </Badge>
                                        )}
                                      </div>
                                      <h6 className="mb-2">
                                        <FaBed className="text-muted me-1" />
                                        {rate.roomTypeName}
                                      </h6>
                                      <div className="text-muted small mb-3">
                                        {getMealPlanIcon(rate.mealPlan)}
                                        {rate.mealPlan}
                                      </div>
                                      <div className="d-flex justify-content-between border-top pt-2">
                                        <small className="text-muted">
                                          Per room
                                        </small>
                                        <strong>
                                          {finalRate != null
                                            ? `AED ${finalRate.toLocaleString()}`
                                            : "—"}
                                        </strong>
                                      </div>
                                      <div className="d-flex justify-content-between">
                                        <small className="text-muted">
                                          Total ({payload.rooms || 1} room
                                          {(payload.rooms || 1) > 1 ? "s" : ""})
                                        </small>
                                        <span className="fw-bold text-success">
                                          {total != null
                                            ? `AED ${total.toLocaleString()}`
                                            : "—"}
                                        </span>
                                      </div>
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        className="w-100 mt-3"
                                        onClick={() => openBookConfirm(rate)}
                                      >
                                        Book
                                      </Button>
                                    </Card.Body>
                                  </Card>
                                </Col>
                              );
                            })}
                          </Row>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
              </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>

      {/* Confirm-rate modal before navigating to the booking page */}
      <Modal
        show={showSelectedModal}
        onHide={() => setShowSelectedModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaCheckCircle className="text-success me-2" /> Confirm Rate
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRow && (
            <>
              <h5 className="mb-2">{selectedRow.roomCategoryName}</h5>
              <p className="text-muted mb-2">{selectedRow.roomTypeName}</p>
              <div className="d-flex align-items-center gap-2 mb-2">
                {getMealPlanIcon(selectedRow.mealPlan)}
                <span className="fw-semibold">{selectedRow.mealPlan}</span>
                {selectedRow.refundable ? (
                  <Badge bg="success" className="ms-2">
                    Refundable
                  </Badge>
                ) : (
                  <Badge bg="danger" className="ms-2">
                    Non-Refundable
                  </Badge>
                )}
              </div>
              <div className="border-top pt-2">
                <div className="d-flex justify-content-between">
                  <span>Day Stay Rate (per room)</span>
                  <strong>
                    AED{" "}
                    {(computeFinalRate(selectedRow) ?? 0).toFixed(2)}
                  </strong>
                </div>
                <div className="d-flex justify-content-between text-muted small">
                  <span>
                    Pax: {payload.adults || 0} adult
                    {(payload.adults || 0) > 1 ? "s" : ""}
                    {payload.children
                      ? `, ${payload.children} child${
                          payload.children > 1 ? "ren" : ""
                        }`
                      : ""}
                  </span>
                  <span>Rooms: {payload.rooms || 1}</span>
                </div>
                <div className="d-flex justify-content-between fs-5 fw-bold text-success mt-2">
                  <span>Total</span>
                  <span>
                    AED {(computeRoomsTotal(selectedRow) ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
              <p className="text-muted small mt-3 mb-0">
                Check-in {payload.checkInTime}, check-out {adjustedCheckOut}{" "}
                ({totalGuests} guest{totalGuests > 1 ? "s" : ""}).
              </p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setShowSelectedModal(false)}
          >
            Cancel
          </Button>
          <Button variant="success" onClick={proceedToBooking}>
            Proceed to Booking
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
