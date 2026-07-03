import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import LineChart from "../components/LineChart";
import BarChart from "../components/BarChart";
import { useNavigate } from "react-router-dom";
import {
  FaUserTie,
  FaMapMarkerAlt,
  FaPhone,
  FaEnvelope,
  FaUser,
} from "react-icons/fa";
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
  // Logged-in agent's id (resolved via /api/personalProfile — for AGENT
  // users the DTO id IS the agent id) and their full registration record
  // (GET /api/agent/{id}, same source AgentView reads) for the identity
  // card: company / location / contact + Finance Manager & GM.
  const [agentId, setAgentId] = useState(null);
  const [agentInfo, setAgentInfo] = useState(null);
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
          if (response.data?.id) setAgentId(response.data.id);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchProfile();
  }, []);

  // ✅ Fetch this agent's registration details once the id is resolved, so
  // the dashboard can identify the agent (mirrors ExtranetHotelDashboard's
  // hotel identity card).
  useEffect(() => {
    if (!agentId) return undefined;
    let alive = true;
    axiosInstance
      .get(`/api/agent/${agentId}`)
      .then((res) => {
        if (alive) setAgentInfo(res.data);
      })
      .catch((error) => {
        console.error("Error fetching agent info:", error);
      });
    return () => {
      alive = false;
    };
  }, [agentId]);

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
      {/* Above-the-fold compaction, scoped to the agent dashboard only:
          tighter section gap / header margin / credit-stats spacing so
          the identity card, Quick Actions and Credit panel are all
          visible without scrolling on a 768px-tall screen. The header
          margin needs !important to beat DashboardHeader's inline
          marginBottom. */}
      <style>{`
        .agent-compact .dash-main { gap: 14px; padding-top: 14px; }
        .agent-compact .dash-main > div:first-child { margin-bottom: 0 !important; }
        .agent-compact .credit-panel-stats { margin-top: 10px; }
      `}</style>
      <div className="dash-shell rw-dashboard agent-compact">
        <TopBar />
        <div className="dash-body">
          <Sidebar />
          <main className="dash-main">

            {/* Regional date+time chip — uses the agent's registered
                country's timezone (resolved server-side via
                /api/personalProfile, browser-TZ fallback). */}
            <DashboardHeader title="Agent Dashboard" />

            {/* ── Agent identity card — company / location / contact +
                Finance Manager & GM. Mirrors the hotel identity card on
                /extranetDashboard; data comes from /api/agent/{id} (the
                same record /registration/agent/view/{id} displays). ── */}
            {agentInfo && (() => {
              // Same robust logo handling as AgentView: accept a data:URL
              // or raw base64, sniff the MIME from the magic bytes, fall
              // back to an icon badge when there's no logo.
              const raw =
                typeof agentInfo.agentLogo === "string"
                  ? agentInfo.agentLogo.trim()
                  : "";
              let logoSrc = "";
              if (raw) {
                if (raw.startsWith("data:")) {
                  logoSrc = raw;
                } else {
                  let mime = "image/png";
                  if (raw.startsWith("/9j/")) mime = "image/jpeg";
                  else if (raw.startsWith("iVBORw")) mime = "image/png";
                  else if (raw.startsWith("R0lGOD")) mime = "image/gif";
                  else if (raw.startsWith("UklGR")) mime = "image/webp";
                  logoSrc = `data:${mime};base64,${raw}`;
                }
              }
              const locationBits = [
                agentInfo.address,
                agentInfo.placeName,
                agentInfo.provinceName,
                agentInfo.countryName,
              ]
                .filter(Boolean)
                .join(", ");
              const contactPerson =
                agentInfo.contactPerson ||
                [agentInfo.firstName, agentInfo.lastName]
                  .filter(Boolean)
                  .join(" ");
              const phone =
                agentInfo.mobileNumber || agentInfo.telephoneNumber;
              const managerBlock = (label, name, contactNo, email) =>
                name || contactNo || email ? (
                  <div style={{ minWidth: 170 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".06em",
                        textTransform: "uppercase",
                        color: "#EC0B43",
                        marginBottom: 6,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                        fontSize: 13,
                        color: "#3E3E3B",
                      }}
                    >
                      {name && (
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <FaUser color="#9A9A95" /> {name}
                        </span>
                      )}
                      {contactNo && (
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <FaPhone color="#9A9A95" /> {contactNo}
                        </span>
                      )}
                      {email && (
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <FaEnvelope color="#9A9A95" /> {email}
                        </span>
                      )}
                    </div>
                  </div>
                ) : null;
              const fmBlock = managerBlock(
                "Finance Manager",
                agentInfo.financeManagerName,
                agentInfo.financeManagerContactNo,
                agentInfo.financeManagerEmail,
              );
              const gmBlock = managerBlock(
                "General Manager",
                agentInfo.gmName,
                agentInfo.gmContactNo,
                agentInfo.gmEmail,
              );
              return (
                <section>
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #ECECE8",
                      borderRadius: 16,
                      padding: "14px 18px",
                      boxShadow:
                        "0 1px 3px rgba(17,19,24,.04), 0 8px 20px rgba(17,19,24,.045)",
                    }}
                  >
                    {/* Single wrapping row — logo, welcome, FM, GM, contact —
                        keeps the card short enough that Quick Actions and the
                        Credit panel stay above the fold. */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 16,
                        alignItems: "center",
                      }}
                    >
                      {logoSrc ? (
                        <img
                          src={logoSrc}
                          alt={`${agentInfo.companyName || "Agent"} logo`}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                          style={{
                            width: 52,
                            height: 52,
                            objectFit: "contain",
                            borderRadius: 13,
                            border: "1px solid #ECECE8",
                            background: "#FAFAF8",
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 13,
                            background: "#FDE7ED",
                            color: "#EC0B43",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <FaUserTie size={22} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            letterSpacing: ".06em",
                            textTransform: "uppercase",
                            color: "#EC0B43",
                            marginBottom: 2,
                          }}
                        >
                          Welcome
                        </div>
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            letterSpacing: "-.02em",
                            color: "#15171C",
                          }}
                        >
                          {agentInfo.companyName || "Agent"}
                        </div>
                        {locationBits && (
                          <div
                            style={{
                              fontSize: 13.5,
                              color: "#6B7280",
                              marginTop: 4,
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                            }}
                          >
                            <FaMapMarkerAlt color="#EC0B43" /> {locationBits}
                          </div>
                        )}
                      </div>
                      {fmBlock}
                      {gmBlock}
                      {(contactPerson || phone || agentInfo.personalEmail) && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            fontSize: 13,
                            color: "#3E3E3B",
                          }}
                        >
                          {contactPerson && (
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <FaUser color="#9A9A95" /> {contactPerson}
                            </span>
                          )}
                          {phone && (
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <FaPhone color="#9A9A95" /> {phone}
                            </span>
                          )}
                          {agentInfo.personalEmail && (
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <FaEnvelope color="#9A9A95" /> {agentInfo.personalEmail}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              );
            })()}

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
