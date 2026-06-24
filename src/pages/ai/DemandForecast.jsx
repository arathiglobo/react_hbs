import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Card,
  Form,
  Row,
  Col,
  Spinner,
  Badge,
  Table,
  Button,
} from "react-bootstrap";
import axiosInstance from "../../components/AxiosInstance";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

const HORIZONS = [30, 60, 90];

export default function DemandForecast() {
  const [params] = useSearchParams();
  const initialHotel = params.get("hotelId") || "";
  const [hotels, setHotels] = useState([]);
  const [hotelId, setHotelId] = useState(initialHotel);
  const [horizon, setHorizon] = useState(30);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axiosInstance
      .get("/api/hotels")
      .then((r) => setHotels(r.data || []))
      .catch(() => setHotels([]));
  }, []);

  const fetchForecast = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        `/api/ai/forecast/hotel/${hotelId}?horizonDays=${horizon}`
      );
      setForecast(res.data);
    } catch {
      setForecast(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hotelId) fetchForecast();
    // eslint-disable-next-line
  }, [hotelId, horizon]);

  const chartData = useMemo(() => {
    if (!forecast) return null;
    return {
      labels: forecast.daily.map((d) => d.date),
      datasets: [
        {
          label: "Occupancy",
          data: forecast.daily.map((d) => Math.round(d.occupancy * 100)),
          borderColor: "#0d6efd",
          backgroundColor: "rgba(13,110,253,0.15)",
          fill: true,
          yAxisID: "y",
          tension: 0.25,
        },
        {
          label: "ADR",
          data: forecast.daily.map((d) => d.adr),
          borderColor: "#198754",
          backgroundColor: "rgba(25,135,84,0.0)",
          yAxisID: "y1",
          tension: 0.25,
        },
      ],
    };
  }, [forecast]);

  const signalBadge = (type) => {
    switch (type) {
      case "STOP_SELL":
        return <Badge bg="danger">Stop-sell</Badge>;
      case "RATE_INCREASE":
        return <Badge bg="warning" text="dark">Rate increase</Badge>;
      case "RATE_DROP":
        return <Badge bg="info">Rate drop</Badge>;
      case "ALLOTMENT_INCREASE":
        return <Badge bg="primary">Allotment +</Badge>;
      case "RELEASE_PERIOD_EXTEND":
        return <Badge bg="secondary">Release +</Badge>;
      default:
        return <Badge bg="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-3" style={{ minWidth: 0, overflowX: "hidden" }}>
          <h4 className="mb-3">Demand Forecast — Occupancy & ADR</h4>

          <Card className="p-3 mb-3">
            <Row className="g-3 align-items-end">
              <Col md={5}>
                <Form.Label>Hotel</Form.Label>
                <Form.Select value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
                  <option value="">-- Select hotel --</option>
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.hotelName}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={4}>
                <Form.Label>Horizon</Form.Label>
                <div className="d-flex gap-2">
                  {HORIZONS.map((h) => (
                    <Button
                      key={h}
                      size="sm"
                      variant={horizon === h ? "primary" : "outline-primary"}
                      onClick={() => setHorizon(h)}
                    >
                      {h} days
                    </Button>
                  ))}
                </div>
              </Col>
              <Col md={3} className="text-end">
                <Button onClick={fetchForecast} disabled={!hotelId}>
                  {loading ? <Spinner size="sm" animation="border" /> : "Refresh"}
                </Button>
              </Col>
            </Row>
          </Card>

          {!forecast ? (
            <Card className="p-5 text-center text-muted">Pick a hotel to generate a forecast.</Card>
          ) : (
            <>
              <Row className="g-3 mb-3">
                <Col md={4}>
                  <Card className="p-3">
                    <small className="text-muted">Average occupancy</small>
                    <h3 className="text-primary">
                      {Math.round((forecast.averageOccupancy || 0) * 100)}%
                    </h3>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="p-3">
                    <small className="text-muted">Average ADR</small>
                    <h3 className="text-success">{(forecast.averageAdr || 0).toFixed(2)}</h3>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="p-3">
                    <small className="text-muted">History window</small>
                    <h3>{forecast.historyDaysUsed} days</h3>
                  </Card>
                </Col>
              </Row>

              <Card className="p-3 mb-3">
                <h6 className="mb-3">{forecast.hotelName} — next {forecast.horizonDays} days</h6>
                {chartData && (
                  <div style={{ height: 320 }}>
                    <Line
                      data={chartData}
                      options={{
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            type: "linear",
                            position: "left",
                            min: 0,
                            max: 100,
                            title: { display: true, text: "Occupancy %" },
                          },
                          y1: {
                            type: "linear",
                            position: "right",
                            grid: { drawOnChartArea: false },
                            title: { display: true, text: "ADR" },
                          },
                        },
                      }}
                    />
                  </div>
                )}
              </Card>

              <Card className="p-3 mb-3">
                <h6 className="mb-3">Contracting signals</h6>
                {forecast.contractingSignals?.length ? (
                  <Table size="sm" hover responsive>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecast.contractingSignals.map((s, i) => (
                        <tr key={i}>
                          <td>{signalBadge(s.type)}</td>
                          <td>{s.from}</td>
                          <td>{s.to}</td>
                          <td>{s.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <small className="text-muted">No actionable signals in this horizon.</small>
                )}
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
