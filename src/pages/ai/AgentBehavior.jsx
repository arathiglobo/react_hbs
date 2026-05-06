import React, { useEffect, useState } from "react";
import { Card, Form, Row, Col, Spinner, Badge, Table, Button } from "react-bootstrap";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import { Line } from "react-chartjs-2";

export default function AgentBehavior() {
  const [overview, setOverview] = useState([]);
  const [windowDays, setWindowDays] = useState(30);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentDetail, setAgentDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    axiosInstance
      .get(`/api/ai/agent-behavior?windowDays=${windowDays}&limit=50`)
      .then((r) => setOverview(r.data || []))
      .catch(() => setOverview([]))
      .finally(() => setLoading(false));
  }, [windowDays]);

  useEffect(() => {
    if (!selectedAgent) {
      setAgentDetail(null);
      return;
    }
    axiosInstance
      .get(`/api/ai/agent-behavior/${selectedAgent}?windowDays=${windowDays}`)
      .then((r) => setAgentDetail(r.data))
      .catch(() => setAgentDetail(null));
  }, [selectedAgent, windowDays]);

  const segmentBadge = (s) => {
    const map = {
      CONVERTER: "success",
      BROWSER: "info",
      CHURN_RISK: "danger",
      DORMANT: "secondary",
      NEW: "primary",
    };
    return <Badge bg={map[s] || "secondary"}>{s}</Badge>;
  };

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1">
        <Topbar />
        <div className="p-4">
          <h4 className="mb-3">Agent Behavior Overview</h4>

          <Card className="p-3 mb-3">
            <Row className="g-3 align-items-end">
              <Col md={3}>
                <Form.Label>Window</Form.Label>
                <Form.Select
                  value={windowDays}
                  onChange={(e) => setWindowDays(Number(e.target.value))}
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </Form.Select>
              </Col>
              <Col md={9}>
                <small className="text-muted">
                  Searches, rate views, and login activity captured by AI telemetry +
                  bookings from the system. Click an agent to see their full behavior
                  timeline and recommendation.
                </small>
              </Col>
            </Row>
          </Card>

          <Row>
            <Col md={6}>
              <Card className="shadow-sm">
                <Card.Body>
                  <h6>Top agents by activity</h6>
                  {loading ? (
                    <Spinner animation="border" variant="primary" />
                  ) : overview.length === 0 ? (
                    <small className="text-muted">No agent activity yet.</small>
                  ) : (
                    <Table hover responsive size="sm">
                      <thead>
                        <tr>
                          <th>Agent</th>
                          <th>Searches</th>
                          <th>Rate views</th>
                          <th>Bookings</th>
                          <th>Conv.</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {overview.map((a) => (
                          <tr
                            key={a.agentId}
                            className={selectedAgent === a.agentId ? "table-active" : ""}
                          >
                            <td>{a.agentName}</td>
                            <td>{a.searches}</td>
                            <td>{a.rateViews}</td>
                            <td>{a.bookings}</td>
                            <td>{Math.round((a.conversion || 0) * 100)}%</td>
                            <td>
                              <Button
                                size="sm"
                                variant="outline-primary"
                                onClick={() => setSelectedAgent(a.agentId)}
                              >
                                Open
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Card.Body>
              </Card>
            </Col>

            <Col md={6}>
              {!agentDetail ? (
                <Card className="p-4 text-center text-muted">
                  Select an agent on the left to see their detail.
                </Card>
              ) : (
                <Card className="shadow-sm">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h5 className="m-0">{agentDetail.agentName}</h5>
                        <small className="text-muted">
                          Window: {agentDetail.windowDays} days
                        </small>
                      </div>
                      {segmentBadge(agentDetail.segment)}
                    </div>

                    <Row className="g-2 mb-3">
                      <Col xs={6}>
                        <small className="text-muted">Logins</small>
                        <div className="fw-bold">{agentDetail.totalLogins}</div>
                      </Col>
                      <Col xs={6}>
                        <small className="text-muted">Searches</small>
                        <div className="fw-bold">{agentDetail.totalSearches}</div>
                      </Col>
                      <Col xs={6}>
                        <small className="text-muted">Rate views</small>
                        <div className="fw-bold">{agentDetail.totalRateViews}</div>
                      </Col>
                      <Col xs={6}>
                        <small className="text-muted">Bookings</small>
                        <div className="fw-bold">{agentDetail.totalBookings}</div>
                      </Col>
                      <Col xs={6}>
                        <small className="text-muted">Cancellations</small>
                        <div className="fw-bold">{agentDetail.totalCancellations}</div>
                      </Col>
                      <Col xs={6}>
                        <small className="text-muted">Conversion</small>
                        <div className="fw-bold">
                          {Math.round((agentDetail.conversionRate || 0) * 100)}%
                        </div>
                      </Col>
                      <Col xs={6}>
                        <small className="text-muted">Avg ticket</small>
                        <div className="fw-bold">
                          {agentDetail.avgBookingValue?.toFixed(2)}
                        </div>
                      </Col>
                      <Col xs={6}>
                        <small className="text-muted">Total revenue</small>
                        <div className="fw-bold">
                          {agentDetail.totalRevenue?.toFixed(2)}
                        </div>
                      </Col>
                    </Row>

                    <div className="alert alert-info py-2 small">
                      <strong>AI recommendation:</strong> {agentDetail.recommendation}
                    </div>

                    {agentDetail.activitySeries?.length > 0 && (
                      <div style={{ height: 200 }}>
                        <Line
                          data={{
                            labels: agentDetail.activitySeries.map((p) => p.date),
                            datasets: [
                              {
                                label: "Searches",
                                data: agentDetail.activitySeries.map((p) => p.searches),
                                borderColor: "#0d6efd",
                                tension: 0.25,
                              },
                              {
                                label: "Bookings",
                                data: agentDetail.activitySeries.map((p) => p.bookings),
                                borderColor: "#198754",
                                tension: 0.25,
                              },
                              {
                                label: "Logins",
                                data: agentDetail.activitySeries.map((p) => p.logins),
                                borderColor: "#6c757d",
                                tension: 0.25,
                              },
                            ],
                          }}
                          options={{
                            maintainAspectRatio: false,
                            scales: { y: { beginAtZero: true } },
                          }}
                        />
                      </div>
                    )}

                    {agentDetail.topHotels?.length > 0 && (
                      <>
                        <h6 className="mt-3">Top hotels booked</h6>
                        <Table size="sm">
                          <thead>
                            <tr>
                              <th>Hotel</th>
                              <th>Bookings</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agentDetail.topHotels.map((t, i) => (
                              <tr key={i}>
                                <td>{t.hotelName}</td>
                                <td>{t.bookings}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </>
                    )}
                  </Card.Body>
                </Card>
              )}
            </Col>
          </Row>
        </div>
      </div>
    </div>
  );
}
