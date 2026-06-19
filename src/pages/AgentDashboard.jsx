import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import LineChart from "../components/LineChart";
import BarChart from "../components/BarChart";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import axiosInstance from "../components/AxiosInstance";
import {
  dashboardCss,
  DashboardHeader,
  DashboardFooter,
  QuickActions,
  KpiCard,
  ChartCard,
  formatNumber,
} from "./dashboardSkin";

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

  const actions = [
    { label: "New Booking", icon: "booking",  onClick: () => navigate("/new-booking/hotel") },
    { label: "Accounts",    icon: "wallet",   onClick: () => navigate("/inhouse-accounts/agent") },
    { label: "Calendar",    icon: "calendar", onClick: () => navigate("/calendar") },
  ];

  const todayBookings =
    dashboardStatus.todayBookings ?? dashboardStatus.todaysBookings ?? 0;

  return (
    <>
      <style>{dashboardCss}</style>
      <div className="dash-shell rw-dashboard">
        <TopBar />
        <div className="dash-body">
          <Sidebar />
          <main className="dash-main">

            {/* Regional date+time chip — uses the agent's registered
                country's timezone (resolved server-side via
                /api/personalProfile, browser-TZ fallback). */}
            <DashboardHeader title="Agent Dashboard" />

            {/* ── Quick Actions ── */}
            <QuickActions actions={actions} />

            {/* ── Credit summary panel ── */}
            <section>
              <p className="qa-label">Credit</p>
              <ChartCard
                title="Credit Limit"
                badge={creditSummary ? `${creditSummary.usedPercent}% used` : "—"}
              >
                {loadingCredit ? (
                  <div style={{ padding: "8px 0", color: "var(--color-text-muted)", fontSize: "13px" }}>
                    Loading credit information…
                  </div>
                ) : creditSummary ? (
                  <>
                    <div className="credit-bar">
                      <div
                        className="credit-bar-fill"
                        style={{
                          width: `${creditSummary.usedPercent}%`,
                          background:
                            creditSummary.usedPercent > 80
                              ? "var(--color-primary)"
                              : "var(--color-success)",
                        }}
                      />
                    </div>
                    <div className="credit-panel-stats">
                      <div className="credit-stat">
                        <span className="credit-stat-label">Credit</span>
                        <span className="credit-stat-value">
                          {formatNumber(creditSummary.creditLimit)}
                        </span>
                      </div>
                      <div className="credit-stat">
                        <span className="credit-stat-label">Used</span>
                        <span className="credit-stat-value">
                          {formatNumber(creditSummary.used)}
                        </span>
                      </div>
                      <div className="credit-stat">
                        <span className="credit-stat-label">Available Limit</span>
                        <span
                          className="credit-stat-value"
                          style={{ color: "var(--color-primary)" }}
                        >
                          {formatNumber(creditSummary.available)}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: "8px 0", color: "var(--color-text-muted)", fontSize: "13px" }}>
                    No credit information available
                  </div>
                )}
              </ChartCard>
            </section>

            {/* ── KPI Grid — 3×2 ── */}
            <section>
              <p className="qa-label">Overview</p>
              <div className="kpi-grid">
                <KpiCard
                  title="Total Bookings"
                  icon="booking"
                  color="#6366f1"
                  value={formatNumber(dashboardStatus.totalBookings)}
                />
                <KpiCard
                  title="Today's Bookings"
                  icon="booking"
                  color="#0ea5e9"
                  value={formatNumber(todayBookings)}
                />
                <KpiCard
                  title="Total Revenue"
                  icon="account"
                  color="#EC0B43"
                  value={`AED ${formatNumber(dashboardStatus.totalRevenue)}`}
                />
                <KpiCard
                  title="Agent Info"
                  icon="agent"
                  color="#f59e0b"
                  value={
                    <div style={{ fontSize: "13px", lineHeight: 1.5, fontWeight: 600 }}>
                      <div>{dashboardStatus.companyName || "—"}</div>
                      <div>{dashboardStatus.city || ""}</div>
                      <div>{dashboardStatus.country || ""}</div>
                    </div>
                  }
                />
                <KpiCard
                  title="Hotels Bookings"
                  icon="hotel"
                  color="#8b5cf6"
                  value={formatNumber(dashboardStatus.hotelsListed)}
                />
                <KpiCard
                  title="API Bookings"
                  icon="tour"
                  color="#10b981"
                  value={formatNumber(dashboardStatus.totalApiBookings)}
                />
              </div>
            </section>

            {/* ── Charts ── */}
            <section>
              <p className="qa-label">Analytics</p>
              <div className="chart-grid">
                <ChartCard title="Bookings Over Time" dotColor="var(--color-primary)">
                  <LineChart labels={bookingsLabels} data={bookingsData} />
                </ChartCard>
                <ChartCard title="Revenue Trends" dotColor="var(--color-secondary)">
                  <BarChart labels={bookingsLabels} data={revenueData} />
                </ChartCard>
              </div>
            </section>

          </main>
        </div>

        <DashboardFooter label="Agent Dashboard" />
      </div>
    </>
  );
}
