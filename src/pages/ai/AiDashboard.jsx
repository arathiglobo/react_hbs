import React, { useEffect, useState } from "react";
import { Card, Row, Col, Button, Spinner, Badge, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import RegionalClock from "../../components/RegionalClock";
import { formatDateTime } from "../../utils/dateUtils";

const Tile = ({ title, value, hint, link, color = "primary" }) => (
  <Card className="h-100 shadow-sm">
    <Card.Body>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="text-muted m-0">{title}</h6>
        {link && (
          <Link to={link} className={`btn btn-outline-${color} btn-sm`}>
            Open
          </Link>
        )}
      </div>
      <h2 className={`text-${color} fw-bold m-0`}>{value}</h2>
      <small className="text-muted">{hint}</small>
    </Card.Body>
  </Card>
);

export default function AiDashboard() {
  const [market, setMarket] = useState(null);
  const [risk, setRisk] = useState(null);
  const [events, setEvents] = useState(null);
  const [highDemand, setHighDemand] = useState([]);
  const [lowOcc, setLowOcc] = useState([]);
  const [overbookDates, setOverbookDates] = useState([]);
  const [topAgents, setTopAgents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axiosInstance.get("/api/ai/forecast/market?horizonDays=30"),
      axiosInstance.get("/api/ai/risk/summary?horizonDays=30"),
      axiosInstance.get("/api/ai/system-events?windowDays=30"),
      axiosInstance.get("/api/ai/insights/high-demand-dates?horizonDays=60&threshold=0.85"),
      axiosInstance.get("/api/ai/insights/low-occupancy-dates?horizonDays=60&threshold=0.30"),
      axiosInstance.get("/api/ai/insights/overbooking-risk-dates?horizonDays=60"),
      axiosInstance.get("/api/ai/insights/high-value-agents?windowDays=90&limit=10"),
      axiosInstance.get("/api/ai/insights/location-performance?windowDays=90"),
    ])
      .then(([m, r, e, hd, lo, ob, ag, lc]) => {
        setMarket(m.data);
        setRisk(r.data);
        setEvents(e.data);
        setHighDemand(hd.data || []);
        setLowOcc(lo.data || []);
        setOverbookDates(ob.data || []);
        setTopAgents(ag.data || []);
        setLocations(lc.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmtCurrency = (v) =>
    v == null ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const fmtPct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1">
        <Topbar />
        <div className="p-4">
          {/* Regional date+time chip — top of the page so it's visible
              regardless of how much KPI content scrolls below. */}
          <div className="d-flex justify-content-end mb-3">
            <RegionalClock />
          </div>
          <h4 className="mb-1">AI Insights</h4>
          <p className="text-muted">
            Forward-looking demand, agent behavior, and risk signals — plus high-value
            accounts and location performance.
          </p>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : (
            <>
              {/* KPI tiles */}
              <Row className="g-3 mb-4">
                <Col md={3}>
                  <Tile
                    title="Market occupancy (30d)"
                    value={market ? fmtPct(market.marketOccupancy) : "—"}
                    hint={market ? `${market.hotelCount} hotels` : ""}
                    link="/ai/demand-forecast"
                  />
                </Col>
                <Col md={3}>
                  <Tile
                    title="Market ADR (30d)"
                    value={market ? fmtCurrency(market.marketAdr) : "—"}
                    hint="Avg. daily rate, all bookings"
                    color="success"
                    link="/ai/demand-forecast"
                  />
                </Col>
                <Col md={3}>
                  <Tile
                    title="Bookings at risk (30d)"
                    value={risk ? risk.totalUpcoming : "—"}
                    hint={
                      risk
                        ? `H:${risk.high} · M:${risk.medium} · L:${risk.low}`
                        : ""
                    }
                    color="danger"
                    link="/ai/no-show-risk"
                  />
                </Col>
                <Col md={3}>
                  <Tile
                    title="Top agent revenue (90d)"
                    value={
                      topAgents.length > 0 ? fmtCurrency(topAgents[0].revenue) : "—"
                    }
                    hint={topAgents[0]?.agentName || ""}
                    color="primary"
                    link="/ai/agent-behavior"
                  />
                </Col>
              </Row>

              {/* Demand calendar — high & low */}
              <Row className="g-3 mb-4">
                <Col md={6}>
                  <Card className="shadow-sm h-100">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="m-0">High-demand dates (next 60d)</h6>
                        <Badge bg="danger">≥ 85% predicted</Badge>
                      </div>
                      {highDemand.length === 0 ? (
                        <small className="text-muted">
                          No high-demand days predicted in this window.
                        </small>
                      ) : (
                        <Table hover responsive size="sm" className="mb-0">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>DOW</th>
                              <th>Hotels</th>
                              <th>Avg occ.</th>
                              <th>Avg ADR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {highDemand.slice(0, 12).map((d, i) => (
                              <tr key={i}>
                                <td>{formatDateTime(d.date)}</td>
                                <td>{d.dayOfWeek}</td>
                                <td>{d.hotelCount}</td>
                                <td>
                                  <Badge bg="danger">{fmtPct(d.avgOccupancy)}</Badge>
                                </td>
                                <td>{fmtCurrency(d.avgAdr)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      )}
                      <small className="text-muted d-block mt-2">
                        Action: tighten allotments, extend release period, raise rates.
                      </small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="shadow-sm h-100">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="m-0">Low-occupancy windows (next 60d)</h6>
                        <Badge bg="info">≤ 30% predicted</Badge>
                      </div>
                      {lowOcc.length === 0 ? (
                        <small className="text-muted">
                          No soft-demand pockets predicted.
                        </small>
                      ) : (
                        <Table hover responsive size="sm" className="mb-0">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>DOW</th>
                              <th>Hotels</th>
                              <th>Avg occ.</th>
                              <th>Avg ADR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lowOcc.slice(0, 12).map((d, i) => (
                              <tr key={i}>
                                <td>{formatDateTime(d.date)}</td>
                                <td>{d.dayOfWeek}</td>
                                <td>{d.hotelCount}</td>
                                <td>
                                  <Badge bg="info">{fmtPct(d.avgOccupancy)}</Badge>
                                </td>
                                <td>{fmtCurrency(d.avgAdr)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      )}
                      <small className="text-muted d-block mt-2">
                        Action: launch promo, increase agent allotments, shorten release.
                      </small>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Overbooking + Top agents */}
              <Row className="g-3 mb-4">
                <Col md={6}>
                  <Card className="shadow-sm h-100">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="m-0">Overbooking-risk dates</h6>
                        <Badge bg="warning" text="dark">≥ 30 score</Badge>
                      </div>
                      {overbookDates.length === 0 ? (
                        <small className="text-muted">
                          No overbooking risks predicted in next 60 days.
                        </small>
                      ) : (
                        <Table hover responsive size="sm" className="mb-0">
                          <thead>
                            <tr>
                              <th>Check-in</th>
                              <th>Bookings flagged</th>
                              <th>Total value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overbookDates.slice(0, 10).map((d, i) => (
                              <tr key={i}>
                                <td>{formatDateTime(d.date)}</td>
                                <td>
                                  <Badge bg="warning" text="dark">
                                    {d.count}
                                  </Badge>
                                </td>
                                <td>{fmtCurrency(d.totalValue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      )}
                      <small className="text-muted d-block mt-2">
                        Action: pre-block sister-property inventory, request supplier reconfirmation.
                      </small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="shadow-sm h-100">
                    <Card.Body>
                      <h6 className="mb-2">High-value agents (90d)</h6>
                      {topAgents.length === 0 ? (
                        <small className="text-muted">No agent revenue in window.</small>
                      ) : (
                        <Table hover responsive size="sm" className="mb-0">
                          <thead>
                            <tr>
                              <th>Agent</th>
                              <th>Bookings</th>
                              <th>Revenue</th>
                              <th>Avg ticket</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topAgents.map((a, i) => (
                              <tr key={i}>
                                <td>{a.agentName}</td>
                                <td>{a.bookings}</td>
                                <td>
                                  <Badge bg="success">{fmtCurrency(a.revenue)}</Badge>
                                </td>
                                <td>{fmtCurrency(a.avgTicket)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      )}
                      <small className="text-muted d-block mt-2">
                        Action: protect with preferred rates, raise credit limits.
                      </small>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Location performance */}
              <Row className="g-3 mb-4">
                <Col md={12}>
                  <Card className="shadow-sm">
                    <Card.Body>
                      <h6 className="mb-2">Performance of locations (90d)</h6>
                      {locations.length === 0 ? (
                        <small className="text-muted">No bookings recorded by location.</small>
                      ) : (
                        <Table hover responsive size="sm" className="mb-0">
                          <thead>
                            <tr>
                              <th>Country</th>
                              <th>Hotels</th>
                              <th>Bookings</th>
                              <th>Total nights</th>
                              <th>Revenue</th>
                              <th>Avg ADR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {locations.map((l, i) => (
                              <tr key={i}>
                                <td>{l.country}</td>
                                <td>{l.hotelCount}</td>
                                <td>{l.bookings}</td>
                                <td>{l.totalNights}</td>
                                <td>
                                  <Badge bg="success">{fmtCurrency(l.revenue)}</Badge>
                                </td>
                                <td>{fmtCurrency(l.avgAdr)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Hotel snapshot + events */}
              <Row className="g-3 mb-4">
                <Col md={6}>
                  <Card className="shadow-sm h-100">
                    <Card.Body>
                      <h6 className="text-muted mb-3">Hotel demand snapshot</h6>
                      {market?.hotels?.length ? (
                        <ul className="list-unstyled mb-0">
                          {market.hotels.slice(0, 8).map((h) => (
                            <li
                              key={h.hotelId}
                              className="d-flex justify-content-between align-items-center mb-2"
                            >
                              <Link to={`/ai/demand-forecast?hotelId=${h.hotelId}`}>
                                {h.hotelName}
                              </Link>
                              <span>
                                <Badge bg="primary" className="me-1">
                                  {fmtPct(h.averageOccupancy)}
                                </Badge>
                                <Badge bg="success" className="me-1">
                                  {fmtCurrency(h.averageAdr)}
                                </Badge>
                                {h.signalsCount > 0 && (
                                  <Badge bg="warning" text="dark">
                                    {h.signalsCount} signals
                                  </Badge>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <small className="text-muted">No hotels found.</small>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="shadow-sm h-100">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="text-muted m-0">Agent activity (30d)</h6>
                        <Link to="/ai/agent-behavior" className="btn btn-outline-primary btn-sm">
                          Open
                        </Link>
                      </div>
                      {events && Object.keys(events).length > 0 ? (
                        Object.entries(events).map(([k, v]) => (
                          <Badge key={k} bg="info" className="me-2 mb-1">
                            {k}: {v}
                          </Badge>
                        ))
                      ) : (
                        <small className="text-muted">
                          No telemetry yet — events accumulate as agents search & book.
                        </small>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Card className="shadow-sm">
                <Card.Body>
                  <h6 className="text-muted">Quick actions</h6>
                  <div className="d-flex gap-2 flex-wrap mt-2">
                    <Button as={Link} to="/ai/demand-forecast" variant="outline-primary">
                      Demand & ADR forecast
                    </Button>
                    <Button as={Link} to="/ai/agent-behavior" variant="outline-primary">
                      Agent behavior
                    </Button>
                    <Button as={Link} to="/ai/no-show-risk" variant="outline-danger">
                      No-show / overbooking risk
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
