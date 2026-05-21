import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import LineChart from "../components/LineChart";
import BarChart from "../components/BarChart";
import {
  Container,
  Row,
  Col,
  Button,
  Card,
  ProgressBar,
  Spinner,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import RegionalClock from "../components/RegionalClock";
import axiosInstance from "../components/AxiosInstance";

const bookingsLabels = ["Aug 1", "Aug 2", "Aug 3", "Aug 4", "Aug 5"];
const bookingsData = [20, 35, 50, 40, 65];
const revenueData = [3000, 4800, 5500, 4000, 6800];

export default function AgentDashboard() {
  const navigate = useNavigate();
  const [creditSummary, setCreditSummary] = useState(null);
  const [loadingCredit, setLoadingCredit] = useState(true);
  const defaultDashboardStatus = {
    totalBookings: 0,
    todayBookings: 0,
    totalRevenue: 0,
    totalActiveAgents: 0,
    totalHotels: 0,
    totalApiBookings: 0,
  };
  const [dashboardStatus, setDashboardStatus] = useState(
    defaultDashboardStatus,
  );
  // ✅ Fetch dashboard data
  const fetchAgentDashboardStatus = async () => {
    try {
      const response = await axiosInstance.get(`/api/dashboard/agent/stats`);

      if (response.data && typeof response.data === "object") {
        setDashboardStatus((prev) => ({
          ...prev,
          ...response.data,
        }));
      } else {
        setDashboardStatus(defaultDashboardStatus);
      }
    } catch (error) {
      console.error("Error fetching dashboard status:", error);
      setDashboardStatus(defaultDashboardStatus);
    }
  };

  // ✅ CALL IT HERE
  useEffect(() => {
    fetchAgentDashboardStatus();
  }, []);

  useEffect(() => {
    const fetchCreditLimit = async () => {
      try {
        setLoadingCredit(true);
        const response = await axiosInstance.get(
          "/api/agent-credit-limit/single-agent",
        );
        const data = response.data;

        const creditData = {
          creditLimit: data.totalCreditLimit || 0,
          used: data.usedCreditLimit || 0,
          available: data.availableCreditLimit || 0,
          usedPercent: Math.min(
            100,
            Math.round(
              (data.usedCreditLimit / (data.totalCreditLimit || 1)) * 100,
            ),
          ),
        };

        setCreditSummary(creditData);
      } catch (error) {
        console.error("Error fetching credit limit:", error);
        // Set default values on error
        setCreditSummary({
          creditLimit: 0,
          used: 0,
          available: 0,
          usedPercent: 0,
        });
      } finally {
        setLoadingCredit(false);
      }
    };

    fetchCreditLimit();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userName =
          localStorage.getItem("UserName") ||
          sessionStorage.getItem("UserName");
        if (userName) {
          const response = await axiosInstance.get(
            `/api/personalProfile/${userName}`,
          );
          console.log("Profile Data:", response.data);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchProfile();
  }, []);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          {/* <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h3">Agent</h1>
         
        </div> */}

          <Container fluid>
            {/* Regional date+time chip — uses the agent's registered
                country's timezone (resolved server-side via
                /api/personalProfile). Falls back to browser TZ when
                the profile has no country. */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "28px",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#111827", margin: 0 }}>
                Agent Dashboard
              </h1>
              <p style={{ fontSize: "13.5px", color: "#6B7280", marginTop: "4px", marginBottom: 0 }}>
                Welcome back. Here's what's happening today.
              </p>
            </div>
            <RegionalClock />
          </div>

            {/* Credit summary (left) and Quick Access (right) */}
            <Row className="g-4 mb-4">
              <Col lg={7}>
                <Card className="h-100 shadow-sm">
                  <Card.Body>
                    {loadingCredit ? (
                      <div className="text-center py-4">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-2 text-muted">
                          Loading credit information...
                        </p>
                      </div>
                    ) : creditSummary ? (
                      <>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <div className="h6 mb-0">
                            Credit Limit Used : {creditSummary.usedPercent}%
                          </div>
                        </div>
                        <ProgressBar
                          now={creditSummary.usedPercent}
                          variant={
                            creditSummary.usedPercent > 80
                              ? "danger"
                              : "success"
                          }
                          className="mb-3"
                        />
                        <div className="d-flex flex-wrap gap-4">
                          <div>
                            <span className="text-muted">Credit :</span>{" "}
                            <span className="fw-semibold">
                              {creditSummary.creditLimit.toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted">Used :</span>{" "}
                            <span className="fw-semibold">
                              {creditSummary.used.toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted">
                              Available Limit :
                            </span>{" "}
                            <span className="fw-semibold text-danger">
                              {creditSummary.available.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-muted">
                          No credit information available
                        </p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col lg={5}>
                <Card className="h-100 shadow-sm">
                  <Card.Body>
                    <div className="h6 mb-3">Quick Access</div>
                    <div className="d-flex flex-wrap gap-2">
                      <Button
                        className="btn-indigo"
                        onClick={() => navigate("/new-booking/hotel")}
                      >
                        New Booking
                      </Button>
                      <Button
                        className="btn-green"
                        onClick={() => navigate("/inhouse-accounts/agent")}
                      >
                        Accounts
                      </Button>
                      <Button
                        className="btn-yellow"
                        onClick={() => navigate("/calendar")}
                      >
                        Calendar
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <Row xs={1} sm={2} lg={3} className="g-4 mb-3">
              <Col>
                <KpiCard
                  title="Total Bookings"
                  value={dashboardStatus.totalBookings}
                />
              </Col>
              <Col>
                <KpiCard
                  title="Today's Bookings"
                  value={dashboardStatus.todaysBookings}
                />
              </Col>
              <Col>
                <KpiCard
                  title="Total Revenue"
                  value={`AED ${dashboardStatus.totalRevenue.toLocaleString()}`}
                />
              </Col>
              <Col>
                <KpiCard
                  title="Agent Info"
                  value={
                    <div style={{ fontSize: "13px", lineHeight: "1.5" }}>
                      <div>{dashboardStatus.companyName}</div>
                      <div>{dashboardStatus.city}</div>
                      <div>{dashboardStatus.country}</div>
                   </div>
                  }
                />
              </Col>
              <Col><KpiCard title="Hotels Bookings" value={dashboardStatus.hotelsListed} /></Col>
              <Col>
                <KpiCard
                  title="API Bookings"
                  value={dashboardStatus.totalApiBookings}
                />
              </Col>
            </Row>

            <Row className="g-4">
              <Col lg={6}>
                <Card className="h-100">
                  <Card.Body>
                    <Card.Title>Bookings Over Time</Card.Title>
                    <LineChart labels={bookingsLabels} data={bookingsData} />
                  </Card.Body>
                </Card>
              </Col>
              <Col lg={6}>
                <Card className="h-100">
                  <Card.Body>
                    <Card.Title>Revenue Trends</Card.Title>
                    <BarChart labels={bookingsLabels} data={revenueData} />
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Container>
        </main>
      </div>
    </div>
  );
}

function KpiCard({ title, value }) {
  return (
    <Card className="shadow-sm rounded-xl p-3 h-100">
      <div className="text-muted">{title}</div>
      <div className="h4 fw-bold">{value}</div>
    </Card>
  );
}
