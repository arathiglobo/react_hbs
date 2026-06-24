import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Row,
  Col,
  Form,
  Button,
  Badge,
  Accordion,
  InputGroup,
  ListGroup,
  Alert,
} from "react-bootstrap";
import {
  FaHotel,
  FaCar,
  FaUmbrellaBeach,
  FaCheckCircle,
  FaSearch,
  FaArrowLeft,
  FaArrowRight,
  FaTimes,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

/**
 * v3 results page — multi-select per module, hotels grouped by leg.
 *
 * Selection is held in component state and forwarded to /booking on
 * "Continue to Booking" (no Redis cart). Operator can pick multiple of
 * each module; the booking page accepts arrays of any size.
 */

const V3_CRITERIA_KEY = "makePkgV3Criteria";
const V3_RESULTS_KEY = "makePkgV3Results";

const fmtMoney = (n) => `AED ${Number(n || 0).toLocaleString()}`;

// ── helpers — pick the displayable bits out of legacy result shapes ──
const hotelLabel = (h) => h.hotelName || h.name || `Hotel #${h.hotelId}`;
const hotelRate = (h) =>
  Number(h.totalRate || h.baseRate || h.rate || 0);
const hotelMeta = (h) => {
  const meta = [];
  if (h.starRating) meta.push(`${h.starRating}★`);
  if (h.roomCategory || h.roomcategory) meta.push(h.roomCategory || h.roomcategory);
  if (h.address) meta.push(h.address);
  return meta.filter(Boolean).join(" · ");
};
const cabLabel = (c) => c.cabName || c.cabname || `Cab #${c.cabid || c.cabId}`;
const cabRate = (c) =>
  Number(c.totalRate || c.totalrate || c.privateTotal || c.sicRate || 0);
const cabMeta = (c) =>
  [c.types, c.paxDetails ? `${c.paxDetails} pax` : null, c.dropDetails]
    .filter(Boolean)
    .join(" · ");
const actLabel = (a) =>
  a.activityName || a.activityname || a.name || `Activity #${a.activityId}`;
const actRate = (a) => Number(a.totalRate || a.rate || 0);
const actMeta = (a) =>
  [a.duration, a.timing, a.__destCityName].filter(Boolean).join(" · ");

const MakePkgV3Results = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Load criteria + results from location.state, falling back to sessionStorage.
  const criteria = useMemo(() => {
    if (location.state?.criteria) return location.state.criteria;
    try {
      const raw = sessionStorage.getItem(V3_CRITERIA_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [location.state]);
  const results = useMemo(() => {
    if (location.state?.results) return location.state.results;
    try {
      const raw = sessionStorage.getItem(V3_RESULTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [location.state]);

  const hotelsByDest = results.hotelsByDestination || [];
  const transfers = results.transfers || [];
  const activities = results.activities || [];
  const addOns = results.addOns || criteria.addOns || {};
  const modules = criteria.modules || {
    hotel: true,
    transfer: true,
    activity: true,
  };

  // Selection state — arrays so operator can pick multiple per module.
  const [selected, setSelected] = useState({
    hotels: [], // [{ key, payload, leg }]
    transfers: [], // [{ key, payload }]
    activities: [], // [{ key, payload }]
  });

  // Filters
  const [hotelFilter, setHotelFilter] = useState("");
  const [transferFilter, setTransferFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");

  const keyOf = (type, idx, leg) => {
    // Stable enough — Map indices are unique within a section
    if (type === "hotel") return `H-${leg?.cityId ?? "x"}-${idx}`;
    if (type === "transfer") return `T-${idx}`;
    return `A-${idx}`;
  };

  // ── selection toggles ──────────────────────────────────────────────
  const isSelected = (type, key) =>
    selected[`${type}s`].some((x) => x.key === key);
  const toggleHotel = (key, payload, leg) =>
    setSelected((p) => {
      const list = p.hotels;
      const exists = list.find((x) => x.key === key);
      return {
        ...p,
        hotels: exists
          ? list.filter((x) => x.key !== key)
          : [...list, { key, payload: { ...payload, __leg: leg }, leg }],
      };
    });
  const toggleTransfer = (key, payload) =>
    setSelected((p) => {
      const list = p.transfers;
      const exists = list.find((x) => x.key === key);
      return {
        ...p,
        transfers: exists
          ? list.filter((x) => x.key !== key)
          : [...list, { key, payload }],
      };
    });
  const toggleActivity = (key, payload) =>
    setSelected((p) => {
      const list = p.activities;
      const exists = list.find((x) => x.key === key);
      return {
        ...p,
        activities: exists
          ? list.filter((x) => x.key !== key)
          : [...list, { key, payload }],
      };
    });

  // ── totals ────────────────────────────────────────────────────────
  const hotelTotal = selected.hotels.reduce(
    (s, x) => s + hotelRate(x.payload),
    0
  );
  const transferTotal = selected.transfers.reduce(
    (s, x) => s + cabRate(x.payload),
    0
  );
  const activityTotal = selected.activities.reduce(
    (s, x) => s + actRate(x.payload),
    0
  );
  const grandTotal = hotelTotal + transferTotal + activityTotal;

  // ── filtered views ────────────────────────────────────────────────
  const filteredTransfers = useMemo(() => {
    const q = transferFilter.trim().toLowerCase();
    if (!q) return transfers;
    return transfers.filter((c) =>
      [cabLabel(c), cabMeta(c)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [transfers, transferFilter]);
  const filteredActivities = useMemo(() => {
    const q = activityFilter.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter((a) =>
      [actLabel(a), actMeta(a)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [activities, activityFilter]);

  // ── continue ──────────────────────────────────────────────────────
  const canContinue =
    selected.hotels.length > 0 ||
    (!modules.hotel &&
      (selected.transfers.length > 0 || selected.activities.length > 0));

  const goToBooking = () => {
    if (modules.hotel && selected.hotels.length === 0) {
      toast.error("Pick at least one hotel before continuing.");
      return;
    }
    navigate("/new-booking/make-your-own-package-v3/booking", {
      state: { criteria, selected, addOns },
    });
  };

  // Initial criteria sanity check
  useEffect(() => {
    if (!criteria || !criteria.checkIn) {
      toast.error("No search criteria found — redirecting.");
      const t = setTimeout(
        () => navigate("/new-booking/make-your-own-package-v3"),
        600
      );
      return () => clearTimeout(t);
    }
  }, [criteria, navigate]);

  // ── render ────────────────────────────────────────────────────────
  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-3" style={{ width: "100%" }}>
          <Container fluid className="px-0">
            <Card
              className="shadow-sm border-0 mb-3"
              style={{ borderRadius: 8 }}
            >
              <Card.Body className="d-flex justify-content-between align-items-center">
                <div>
                  <h3 className="fw-bold mb-0">
                    Build Your Package
                    <Badge bg="info" className="ms-2 align-middle">
                      v3
                    </Badge>
                  </h3>
                  <small className="text-muted">
                    {criteria.checkIn} → {criteria.checkOut} · {""}
                    {(criteria.destinations || [])
                      .map((d) => d.cityName)
                      .filter(Boolean)
                      .join(" → ") || "—"}
                  </small>
                </div>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => navigate(-1)}
                >
                  <FaArrowLeft className="me-1" /> Back to criteria
                </Button>
              </Card.Body>
            </Card>

            <Row className="g-3">
              {/* ─── Left rail: selection summary ─────────────── */}
              <Col lg={4}>
                <div style={{ position: "sticky", top: 80 }}>
                  <Card
                    className="shadow-sm border-0 mb-3"
                    style={{ borderRadius: 8 }}
                  >
                    <Card.Header className="bg-success text-white fw-semibold">
                      Selection Summary
                    </Card.Header>
                    <ListGroup variant="flush">
                      {/* Hotels */}
                      <ListGroup.Item>
                        <div className="d-flex justify-content-between fw-semibold mb-1">
                          <span>
                            <FaHotel className="me-2 text-primary" />
                            Hotels ({selected.hotels.length})
                          </span>
                          <span>{fmtMoney(hotelTotal)}</span>
                        </div>
                        {selected.hotels.length === 0 ? (
                          <small className="text-muted">
                            None selected.
                          </small>
                        ) : (
                          selected.hotels.map((x) => (
                            <div
                              key={x.key}
                              className="d-flex justify-content-between small"
                            >
                              <span>
                                {hotelLabel(x.payload)}
                                {x.leg?.cityName ? (
                                  <small className="text-muted ms-1">
                                    ({x.leg.cityName})
                                  </small>
                                ) : null}
                              </span>
                              <span>
                                <FaTimes
                                  role="button"
                                  className="text-danger me-2"
                                  title="Remove"
                                  onClick={() =>
                                    toggleHotel(x.key, x.payload, x.leg)
                                  }
                                />
                                {fmtMoney(hotelRate(x.payload))}
                              </span>
                            </div>
                          ))
                        )}
                      </ListGroup.Item>

                      {/* Transfers */}
                      {modules.transfer && (
                        <ListGroup.Item>
                          <div className="d-flex justify-content-between fw-semibold mb-1">
                            <span>
                              <FaCar className="me-2 text-info" />
                              Transfers ({selected.transfers.length})
                            </span>
                            <span>{fmtMoney(transferTotal)}</span>
                          </div>
                          {selected.transfers.length === 0 ? (
                            <small className="text-muted">
                              None selected.
                            </small>
                          ) : (
                            selected.transfers.map((x) => (
                              <div
                                key={x.key}
                                className="d-flex justify-content-between small"
                              >
                                <span>{cabLabel(x.payload)}</span>
                                <span>
                                  <FaTimes
                                    role="button"
                                    className="text-danger me-2"
                                    title="Remove"
                                    onClick={() =>
                                      toggleTransfer(x.key, x.payload)
                                    }
                                  />
                                  {fmtMoney(cabRate(x.payload))}
                                </span>
                              </div>
                            ))
                          )}
                        </ListGroup.Item>
                      )}

                      {/* Activities */}
                      {modules.activity && (
                        <ListGroup.Item>
                          <div className="d-flex justify-content-between fw-semibold mb-1">
                            <span>
                              <FaUmbrellaBeach className="me-2 text-warning" />
                              Activities ({selected.activities.length})
                            </span>
                            <span>{fmtMoney(activityTotal)}</span>
                          </div>
                          {selected.activities.length === 0 ? (
                            <small className="text-muted">
                              None selected.
                            </small>
                          ) : (
                            selected.activities.map((x) => (
                              <div
                                key={x.key}
                                className="d-flex justify-content-between small"
                              >
                                <span>{actLabel(x.payload)}</span>
                                <span>
                                  <FaTimes
                                    role="button"
                                    className="text-danger me-2"
                                    title="Remove"
                                    onClick={() =>
                                      toggleActivity(x.key, x.payload)
                                    }
                                  />
                                  {fmtMoney(actRate(x.payload))}
                                </span>
                              </div>
                            ))
                          )}
                        </ListGroup.Item>
                      )}

                      {/* Add-ons echo */}
                      <ListGroup.Item>
                        <div className="fw-semibold mb-1">Add-Ons</div>
                        <div className="d-flex flex-wrap gap-2">
                          {[
                            ["Visa", addOns.visa],
                            ["Insurance", addOns.insurance],
                            ["Meet & Greet", addOns.meetGreet],
                            ["SIM/Forex", addOns.simForex],
                          ].map(([label, val]) => (
                            <Badge
                              key={label}
                              bg={val === "YES" ? "danger" : "secondary"}
                            >
                              {label}: {val || "NO"}
                            </Badge>
                          ))}
                        </div>
                        <small className="text-muted d-block mt-2">
                          <a
                            href="#edit"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(
                                "/new-booking/make-your-own-package-v3"
                              );
                            }}
                          >
                            Edit add-ons / criteria
                          </a>
                        </small>
                      </ListGroup.Item>
                    </ListGroup>
                    <Card.Footer
                      className="bg-light d-flex justify-content-between align-items-center"
                      style={{ borderRadius: "0 0 8px 8px" }}
                    >
                      <strong className="text-success">
                        Total: {fmtMoney(grandTotal)}
                      </strong>
                      <Button
                        variant="success"
                        onClick={goToBooking}
                        disabled={!canContinue}
                      >
                        Continue
                        <FaArrowRight className="ms-2" />
                      </Button>
                    </Card.Footer>
                  </Card>
                </div>
              </Col>

              {/* ─── Right: inventory accordions ──────────────── */}
              <Col lg={8}>
                <Accordion defaultActiveKey={["h", "t", "a"]} alwaysOpen>
                  {/* Hotels — grouped by destination */}
                  {modules.hotel && (
                    <Accordion.Item eventKey="h" className="mb-3">
                      <Accordion.Header>
                        <h5 className="mb-0 fw-bold d-flex align-items-center">
                          <FaHotel className="me-2 text-primary" />
                          Hotels
                          <Badge bg="primary-subtle" text="primary" className="ms-2">
                            {hotelsByDest.reduce(
                              (s, g) => s + (g.hotels?.length || 0),
                              0
                            )}{" "}
                            options
                          </Badge>
                        </h5>
                      </Accordion.Header>
                      <Accordion.Body>
                        <InputGroup className="mb-3" style={{ maxWidth: 360 }}>
                          <InputGroup.Text>
                            <FaSearch />
                          </InputGroup.Text>
                          <Form.Control
                            placeholder="Filter hotels…"
                            value={hotelFilter}
                            onChange={(e) => setHotelFilter(e.target.value)}
                          />
                        </InputGroup>
                        {hotelsByDest.length === 0 && (
                          <Alert variant="warning" className="mb-0">
                            No hotels found for the selected destinations.
                          </Alert>
                        )}
                        {hotelsByDest.map((g) => {
                          const q = hotelFilter.trim().toLowerCase();
                          const list = q
                            ? (g.hotels || []).filter((h) =>
                                [hotelLabel(h), hotelMeta(h)]
                                  .filter(Boolean)
                                  .join(" ")
                                  .toLowerCase()
                                  .includes(q)
                              )
                            : g.hotels || [];
                          return (
                            <div key={g.cityId ?? g.cityName} className="mb-3">
                              <h6 className="fw-bold text-secondary mt-2">
                                {g.cityName || "Destination"} ·{" "}
                                <Badge bg="info">{g.nights}n</Badge>{" "}
                                <Badge bg="secondary">{list.length} hotels</Badge>
                              </h6>
                              {list.length === 0 ? (
                                <Alert variant="light" className="mb-2 small">
                                  No matches in this destination.
                                </Alert>
                              ) : (
                                <Row className="g-2">
                                  {list.map((h, i) => {
                                    const key = keyOf("hotel", i, g);
                                    const sel = isSelected("hotel", key);
                                    return (
                                      <Col md={6} key={key}>
                                        <Card
                                          className={
                                            sel
                                              ? "border-success shadow-sm"
                                              : "shadow-sm"
                                          }
                                          style={{ cursor: "pointer" }}
                                          onClick={() => toggleHotel(key, h, g)}
                                        >
                                          <Card.Body className="p-2">
                                            <div className="d-flex justify-content-between">
                                              <div>
                                                <div className="fw-semibold">
                                                  {sel && (
                                                    <FaCheckCircle className="text-success me-1" />
                                                  )}
                                                  {hotelLabel(h)}
                                                </div>
                                                <small className="text-muted">
                                                  {hotelMeta(h)}
                                                </small>
                                              </div>
                                              <strong className="text-end">
                                                {fmtMoney(hotelRate(h))}
                                              </strong>
                                            </div>
                                          </Card.Body>
                                        </Card>
                                      </Col>
                                    );
                                  })}
                                </Row>
                              )}
                            </div>
                          );
                        })}
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Transfers */}
                  {modules.transfer && (
                    <Accordion.Item eventKey="t" className="mb-3">
                      <Accordion.Header>
                        <h5 className="mb-0 fw-bold d-flex align-items-center">
                          <FaCar className="me-2 text-info" />
                          Transfers
                          <Badge bg="info-subtle" text="info" className="ms-2">
                            {transfers.length}
                          </Badge>
                        </h5>
                      </Accordion.Header>
                      <Accordion.Body>
                        <InputGroup className="mb-3" style={{ maxWidth: 360 }}>
                          <InputGroup.Text>
                            <FaSearch />
                          </InputGroup.Text>
                          <Form.Control
                            placeholder="Filter transfers…"
                            value={transferFilter}
                            onChange={(e) => setTransferFilter(e.target.value)}
                          />
                        </InputGroup>
                        {filteredTransfers.length === 0 ? (
                          <Alert variant="warning" className="mb-0">
                            No transfers available.
                          </Alert>
                        ) : (
                          <Row className="g-2">
                            {filteredTransfers.map((c, i) => {
                              const key = keyOf("transfer", i);
                              const sel = isSelected("transfer", key);
                              return (
                                <Col md={6} key={key}>
                                  <Card
                                    className={
                                      sel
                                        ? "border-success shadow-sm"
                                        : "shadow-sm"
                                    }
                                    style={{ cursor: "pointer" }}
                                    onClick={() => toggleTransfer(key, c)}
                                  >
                                    <Card.Body className="p-2">
                                      <div className="d-flex justify-content-between">
                                        <div>
                                          <div className="fw-semibold">
                                            {sel && (
                                              <FaCheckCircle className="text-success me-1" />
                                            )}
                                            {cabLabel(c)}
                                          </div>
                                          <small className="text-muted">
                                            {cabMeta(c)}
                                          </small>
                                        </div>
                                        <strong className="text-end">
                                          {fmtMoney(cabRate(c))}
                                        </strong>
                                      </div>
                                    </Card.Body>
                                  </Card>
                                </Col>
                              );
                            })}
                          </Row>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Activities */}
                  {modules.activity && (
                    <Accordion.Item eventKey="a" className="mb-3">
                      <Accordion.Header>
                        <h5 className="mb-0 fw-bold d-flex align-items-center">
                          <FaUmbrellaBeach className="me-2 text-warning" />
                          Tours &amp; Activities
                          <Badge
                            bg="warning-subtle"
                            text="warning"
                            className="ms-2"
                          >
                            {activities.length}
                          </Badge>
                        </h5>
                      </Accordion.Header>
                      <Accordion.Body>
                        <InputGroup className="mb-3" style={{ maxWidth: 360 }}>
                          <InputGroup.Text>
                            <FaSearch />
                          </InputGroup.Text>
                          <Form.Control
                            placeholder="Filter activities…"
                            value={activityFilter}
                            onChange={(e) => setActivityFilter(e.target.value)}
                          />
                        </InputGroup>
                        {filteredActivities.length === 0 ? (
                          <Alert variant="warning" className="mb-0">
                            No activities available.
                          </Alert>
                        ) : (
                          <Row className="g-2">
                            {filteredActivities.map((a, i) => {
                              const key = keyOf("activity", i);
                              const sel = isSelected("activity", key);
                              return (
                                <Col md={6} key={key}>
                                  <Card
                                    className={
                                      sel
                                        ? "border-success shadow-sm"
                                        : "shadow-sm"
                                    }
                                    style={{ cursor: "pointer" }}
                                    onClick={() => toggleActivity(key, a)}
                                  >
                                    <Card.Body className="p-2">
                                      <div className="d-flex justify-content-between">
                                        <div>
                                          <div className="fw-semibold">
                                            {sel && (
                                              <FaCheckCircle className="text-success me-1" />
                                            )}
                                            {actLabel(a)}
                                          </div>
                                          <small className="text-muted">
                                            {actMeta(a)}
                                          </small>
                                        </div>
                                        <strong className="text-end">
                                          {fmtMoney(actRate(a))}
                                        </strong>
                                      </div>
                                    </Card.Body>
                                  </Card>
                                </Col>
                              );
                            })}
                          </Row>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>
                  )}
                </Accordion>
              </Col>
            </Row>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default MakePkgV3Results;
