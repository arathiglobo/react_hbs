import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import LineChart from "../components/LineChart";
import BarChart from "../components/BarChart";
import { useNavigate } from "react-router-dom";
import { Collapse } from "react-bootstrap";
import {
  FaUserTie,
  FaMapMarkerAlt,
  FaPhone,
  FaEnvelope,
  FaUser,
  FaChartLine,
  FaChevronDown,
} from "react-icons/fa";
import TopBar from "../components/TopBar";
import axiosInstance from "../components/AxiosInstance";
import {
  dashboardCss,
  DashboardHeader,
  DashboardFooter,
  QuickActions,
  ChartCard,
  Icon,
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
  // Analytics charts are collapsed by default to save vertical space,
  // matching the AdminDashboard accordion pattern.
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
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

  // Every "New Booking" feature (mirrors the Sidebar's New Booking submenu),
  // surfaced directly as Quick Actions so an agent can jump straight to the
  // corresponding search/booking page without opening the sidebar.
  const bookingActions = [
    { label: "Hotel Booking",       icon: "hotel",    to: "/new-booking/hotel" },
    { label: "24 Hour",             icon: "hotel",    to: "/new-booking/hotel-24hr" },
    { label: "Last Minute",         icon: "booking",  to: "/new-booking/last-minute-booking" },
    { label: "Long Stay",           icon: "hotel",    to: "/new-booking/long-stay" },
    { label: "Day Stay",            icon: "hotel",    to: "/new-booking/day-stay" },
    { label: "Build Your Own Pkg",  icon: "list",     to: "/new-booking/make-your-own-package-v2" },
    { label: "Package",             icon: "booking",  to: "/new-booking/package-search" },
    { label: "Transfers",           icon: "transfer", to: "/new-booking/cab" },
    { label: "Chauffeur & Limo",    icon: "transfer", to: "/new-booking/scheffer-driver" },
    { label: "Tours & Activity",    icon: "tour",     to: "/new-booking/tours-and-activities" },
    { label: "Offline",             icon: "booking",  to: "/new-booking/offline-search" },
    { label: "Restaurant",          icon: "booking",  to: "/new-booking/restaurant" },
    { label: "Honeymoon Package",   icon: "booking",  to: "/new-booking/honeymoon" },
    { label: "Meet & Space",        icon: "booking",  to: "/new-booking/meet-and-space" },
    { label: "Govt / Airlines",     icon: "agent",    to: "/new-booking/gov-employee" },
    { label: "Ayurveda",            icon: "booking",  to: "/new-booking/ayurveda" },
    { label: "Student",             icon: "user",     to: "/new-booking/student" },
    { label: "Senior Citizen",      icon: "user",     to: "/new-booking/senior-citizen" },
  ];

  const manageActions = [
    { label: "Accounts",  icon: "wallet",   onClick: () => navigate("/inhouse-accounts/agent") },
    { label: "Calendar",  icon: "calendar", onClick: () => navigate("/calendar") },
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        /* Agent dashboard uses Inter instead of the shared skin's Lexend. */
        .dash-shell.agent-compact,
        .dash-shell.agent-compact * { font-family: 'Inter', sans-serif; }

        .agent-compact .dash-main { gap: 14px; padding-top: 14px; }
        .agent-compact .dash-main > div:first-child { margin-bottom: 0 !important; }
        .agent-compact .credit-panel-stats { margin-top: 10px; }

        /* ── Overview — plain stat strip (no per-metric cards) ── */
        .agent-overview-strip {
          display: flex;
          flex-wrap: wrap;
          background: #fff;
          border: 1px solid rgba(0,0,0,.06);
          border-radius: 14px;
          box-shadow: 0 1px 3px rgba(0,0,0,.05);
        }
        .agent-overview-stat {
          flex: 1 1 150px;
          padding: 14px 18px;
          border-right: 1px solid #F0F1F5;
        }
        .agent-overview-stat:last-child { border-right: none; }
        .agent-overview-label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .07em;
          text-transform: uppercase;
          color: #9198a8;
          margin-bottom: 6px;
        }
        .agent-overview-value {
          display: block;
          font-size: 17px;
          font-weight: 700;
          color: #1a1d23;
        }
        .agent-overview-value-sm { font-size: 12.5px; font-weight: 600; line-height: 1.4; }
        @media (max-width: 860px) {
          .agent-overview-stat { flex: 1 1 45%; border-right: none; border-bottom: 1px solid #F0F1F5; }
          .agent-overview-stat:last-child { border-bottom: none; }
        }

        /* ── Quick Actions — New Booking feature tile grid ── */
        .agent-qa-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
          gap: 10px;
        }
        .agent-qa-tile {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 12px 6px;
          background: #fff;
          border: 1px solid rgba(0,0,0,.06);
          border-radius: 12px;
          font-size: 11.5px;
          font-weight: 600;
          color: var(--color-text);
          text-align: center;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,.04);
          transition: border-color .15s, box-shadow .15s, transform .15s;
        }
        .agent-qa-tile:hover {
          border-color: var(--color-primary-tint);
          box-shadow: 0 6px 16px rgba(236,11,67,.12);
          transform: translateY(-2px);
        }
        .agent-qa-icon {
          width: 32px; height: 32px;
          border-radius: 10px;
          display: grid; place-items: center;
          background: var(--color-primary-tint);
          color: var(--color-primary);
        }

        /* ── Analytics — collapsible accordion header (mirrors AdminDashboard) ── */
        .agent-analytics-toggle {
          width: 100%; display: flex; align-items: center; gap: 12px;
          background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 14px;
          padding: 13px 16px; cursor: pointer; text-align: left;
          box-shadow: 0 1px 3px rgba(0,0,0,.05);
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .agent-analytics-toggle:hover { border-color: var(--color-primary-tint); box-shadow: 0 6px 16px rgba(236,11,67,.10); }
        .agent-analytics-toggle[aria-expanded="true"] { border-color: var(--color-primary-tint); }
        .agent-acc-icon {
          width: 34px; height: 34px; border-radius: 10px;
          display: grid; place-items: center;
          background: var(--color-primary-tint); color: var(--color-primary);
          flex-shrink: 0; font-size: 15px;
        }
        .agent-acc-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .agent-acc-title { font-size: 14px; font-weight: 600; color: var(--color-text); }
        .agent-acc-sub { font-size: 11.5px; color: var(--color-text-muted); }
        .agent-acc-chev {
          width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
          background: #F6F6F4; color: #6B7280; flex-shrink: 0; font-size: 12px;
          transition: transform .25s cubic-bezier(.16,1,.3,1), background .15s ease, color .15s ease;
        }
        .agent-analytics-toggle[aria-expanded="true"] .agent-acc-chev {
          background: var(--color-primary); color: #fff; transform: rotate(180deg);
        }
        .agent-analytics-panel { padding-top: 14px; }
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

            {/* ── Quick Actions — every New Booking feature as a neat tile
                grid, each navigating straight to its own page ── */}
            <section>
              <p className="qa-label">Quick Actions</p>
              <div className="agent-qa-grid">
                {bookingActions.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    className="agent-qa-tile"
                    onClick={() => navigate(a.to)}
                  >
                    <span className="agent-qa-icon">
                      <Icon name={a.icon} size={16} />
                    </span>
                    {a.label}
                  </button>
                ))}
              </div>
            </section>

            {/* ── Manage — existing account/calendar shortcuts, kept as a
                lighter secondary row so nothing that was here before is lost ── */}
            <QuickActions actions={manageActions} label="Manage" />

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

            {/* ── Overview — plain stat strip, no per-metric cards ── */}
            <section>
              <p className="qa-label">Overview</p>
              <div className="agent-overview-strip">
                <div className="agent-overview-stat">
                  <span className="agent-overview-label">Total Bookings</span>
                  <span className="agent-overview-value">
                    {formatNumber(dashboardStatus.totalBookings)}
                  </span>
                </div>
                <div className="agent-overview-stat">
                  <span className="agent-overview-label">Today's Bookings</span>
                  <span className="agent-overview-value">
                    {formatNumber(todayBookings)}
                  </span>
                </div>
                <div className="agent-overview-stat">
                  <span className="agent-overview-label">Total Revenue</span>
                  <span className="agent-overview-value" style={{ color: "var(--color-primary)" }}>
                    AED {formatNumber(dashboardStatus.totalRevenue)}
                  </span>
                </div>
                <div className="agent-overview-stat">
                  <span className="agent-overview-label">Hotels Bookings</span>
                  <span className="agent-overview-value">
                    {formatNumber(dashboardStatus.hotelsListed)}
                  </span>
                </div>
                <div className="agent-overview-stat">
                  <span className="agent-overview-label">API Bookings</span>
                  <span className="agent-overview-value">
                    {formatNumber(dashboardStatus.totalApiBookings)}
                  </span>
                </div>
                <div className="agent-overview-stat">
                  <span className="agent-overview-label">Agent Info</span>
                  <span className="agent-overview-value agent-overview-value-sm">
                    {[dashboardStatus.companyName, dashboardStatus.city, dashboardStatus.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </span>
                </div>
              </div>
            </section>

            {/* ── Analytics — collapsible accordion, same pattern as
                AdminDashboard.jsx's "Analytics" section ── */}
            <section>
              <button
                type="button"
                className="agent-analytics-toggle"
                onClick={() => setAnalyticsOpen((o) => !o)}
                aria-expanded={analyticsOpen}
                aria-controls="agent-analytics-panel"
              >
                <span className="agent-acc-icon" aria-hidden="true">
                  <FaChartLine />
                </span>
                <span className="agent-acc-text">
                  <span className="agent-acc-title">Analytics</span>
                  <span className="agent-acc-sub">Bookings over time &amp; revenue trend</span>
                </span>
                <span className="agent-acc-chev" aria-hidden="true">
                  <FaChevronDown />
                </span>
              </button>
              <Collapse in={analyticsOpen}>
                <div id="agent-analytics-panel" className="agent-analytics-panel">
                  <div className="chart-grid">
                    <ChartCard title="Bookings Over Time" dotColor="var(--color-primary)">
                      <LineChart labels={bookingsLabels} data={bookingsData} />
                    </ChartCard>
                    <ChartCard title="Revenue Trends" dotColor="var(--color-secondary)">
                      <BarChart labels={bookingsLabels} data={revenueData} />
                    </ChartCard>
                  </div>
                </div>
              </Collapse>
            </section>

          </main>
        </div>

        <DashboardFooter label="Agent Dashboard" />
      </div>
    </>
  );
}
