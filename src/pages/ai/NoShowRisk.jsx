import React, { useEffect, useState } from "react";
import {
  Card,
  Form,
  Row,
  Col,
  Spinner,
  Badge,
  Table,
  Modal,
  ListGroup,
} from "react-bootstrap";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";

export default function NoShowRisk() {
  const [horizonDays, setHorizonDays] = useState(30);
  const [minScore, setMinScore] = useState(0);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [r1, r2] = await Promise.all([
          axiosInstance.get(
            `/api/ai/risk/upcoming?horizonDays=${horizonDays}&minScore=${minScore}`
          ),
          axiosInstance.get(`/api/ai/risk/summary?horizonDays=${horizonDays}`),
        ]);
        setRows(r1.data || []);
        setSummary(r2.data);
      } catch {
        setRows([]);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [horizonDays, minScore]);

  const riskBadge = (level) => {
    const map = { HIGH: "danger", MEDIUM: "warning", LOW: "secondary" };
    return <Badge bg={map[level] || "secondary"}>{level}</Badge>;
  };

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1">
        <Topbar />
        <div className="p-4">
          <h4 className="mb-3">No-show & Overbooking Risk</h4>

          <Card className="p-3 mb-3">
            <Row className="g-3 align-items-end">
              <Col md={3}>
                <Form.Label>Horizon</Form.Label>
                <Form.Select
                  value={horizonDays}
                  onChange={(e) => setHorizonDays(Number(e.target.value))}
                >
                  <option value={7}>Next 7 days</option>
                  <option value={30}>Next 30 days</option>
                  <option value={60}>Next 60 days</option>
                  <option value={90}>Next 90 days</option>
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label>Min score</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  max={100}
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                />
              </Col>
              <Col md={6}>
                {summary && (
                  <div className="d-flex gap-3">
                    <Card className="flex-grow-1 p-2 text-center">
                      <small className="text-muted">Total upcoming</small>
                      <h5 className="m-0">{summary.totalUpcoming}</h5>
                    </Card>
                    <Card className="flex-grow-1 p-2 text-center border-danger">
                      <small className="text-muted">High</small>
                      <h5 className="m-0 text-danger">{summary.high}</h5>
                    </Card>
                    <Card className="flex-grow-1 p-2 text-center border-warning">
                      <small className="text-muted">Medium</small>
                      <h5 className="m-0 text-warning">{summary.medium}</h5>
                    </Card>
                    <Card className="flex-grow-1 p-2 text-center">
                      <small className="text-muted">Low</small>
                      <h5 className="m-0">{summary.low}</h5>
                    </Card>
                  </div>
                )}
              </Col>
            </Row>
          </Card>

          <Card>
            <Card.Body>
              {loading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" variant="primary" />
                </div>
              ) : rows.length === 0 ? (
                <div className="text-center text-muted py-4">
                  No bookings flagged in this horizon at min score {minScore}.
                </div>
              ) : (
                <Table hover responsive>
                  <thead>
                    <tr>
                      <th>Booking</th>
                      <th>Hotel</th>
                      <th>Guest</th>
                      <th>Check-in</th>
                      <th>Lead time</th>
                      <th>Value</th>
                      <th>No-show</th>
                      <th>Overbook</th>
                      <th>Risk</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.bookingId}>
                        <td>{r.bookingCode}</td>
                        <td>{r.hotelName}</td>
                        <td>
                          {r.guestName}
                          <br />
                          <small className="text-muted">{r.guestEmail}</small>
                        </td>
                        <td>{r.checkInDate}</td>
                        <td>{r.leadTimeDays} days</td>
                        <td>{r.bookingValue?.toFixed(2)}</td>
                        <td>
                          <Badge bg={r.noShowScore >= 60 ? "danger" : r.noShowScore >= 30 ? "warning" : "secondary"}>
                            {r.noShowScore}
                          </Badge>
                        </td>
                        <td>
                          <Badge bg={r.overbookingScore >= 60 ? "danger" : r.overbookingScore >= 30 ? "warning" : "secondary"}>
                            {r.overbookingScore}
                          </Badge>
                        </td>
                        <td>{riskBadge(r.overallRisk)}</td>
                        <td>
                          <a
                            href="#detail"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowDetail(r);
                            }}
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>

      <Modal show={!!showDetail} onHide={() => setShowDetail(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {showDetail?.bookingCode} — {showDetail?.guestName}
          </Modal.Title>
        </Modal.Header>
        {showDetail && (
          <Modal.Body>
            <Row className="mb-3">
              <Col md={6}>
                <small className="text-muted">Hotel</small>
                <div>{showDetail.hotelName}</div>
              </Col>
              <Col md={6}>
                <small className="text-muted">Check-in / out</small>
                <div>
                  {showDetail.checkInDate} → {showDetail.checkOutDate}
                </div>
              </Col>
              <Col md={4} className="mt-2">
                <small className="text-muted">No-show score</small>
                <h4 className="text-danger">{showDetail.noShowScore}</h4>
              </Col>
              <Col md={4} className="mt-2">
                <small className="text-muted">Overbooking score</small>
                <h4 className="text-warning">{showDetail.overbookingScore}</h4>
              </Col>
              <Col md={4} className="mt-2">
                <small className="text-muted">Overall</small>
                <h4>{riskBadge(showDetail.overallRisk)}</h4>
              </Col>
            </Row>

            <h6>Why this score?</h6>
            <ListGroup className="mb-3">
              {showDetail.reasons.map((r, i) => (
                <ListGroup.Item key={i}>{r}</ListGroup.Item>
              ))}
            </ListGroup>

            <h6>Suggested actions</h6>
            <ListGroup>
              {showDetail.suggestedActions.map((a, i) => (
                <ListGroup.Item key={i} className="text-primary">
                  {a}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Modal.Body>
        )}
      </Modal>
    </div>
  );
}
