import React, { useEffect, useState, useRef, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import LineChart from '../components/LineChart';
import BarChart from '../components/BarChart';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import axiosInstance from '../components/AxiosInstance';

/* ─── static demo data ─── */
const bookingsLabels = ['Aug 1','Aug 2','Aug 3','Aug 4','Aug 5'];
const bookingsData   = [20, 35, 50, 40, 65];
const revenueData    = [3000, 4800, 5500, 4000, 6800];

/* ─── helpers ─── */
const DEFAULT_DASHBOARD = {
  totalBookings: {}, todayBookings: 0, totalRevenue: 0,
  totalActiveAgents: 0, totalHotels: 0, apiHotelBookings: 0,
  inhouseHotelBookings: 0, agentList: [], hotelList: [],
};

const formatNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString() : '0';
};
const sumValues = (obj) => {
  if (!obj || typeof obj !== 'object') return 0;
  return Object.values(obj).reduce((acc, v) => acc + (Number(v) || 0), 0);
};
const groupByCountryCity = (list = [], labelKey) => {
  const grouped = {};
  list.forEach((item) => {
    const country = item.country || 'Unknown Country';
    const city    = item.city    || 'Unknown City';
    if (!grouped[country]) grouped[country] = {};
    if (!grouped[country][city]) grouped[country][city] = [];
    grouped[country][city].push(item[labelKey] || '-');
  });
  return grouped;
};

/* ─── icons ─── */
const ICONS = {
  hotel:    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
  agent:    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  booking:  <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  transfer: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
  tour:     <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
  account:  <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  chevron:  <polyline points="6 9 12 15 18 9"/>,
  mappin:   <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
};

const Icon = React.memo(({ name, size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {ICONS[name]}
  </svg>
));

/* ─── KPI meta ─── */
const kpiMeta = {
  'Total Bookings':   { accent: '#6366f1', bg: '#eef2ff', icon: 'booking'  },
  "Today's Bookings": { accent: '#0ea5e9', bg: '#e0f2fe', icon: 'booking'  },
  'Total Revenue':    { accent: '#10b981', bg: '#d1fae5', icon: 'account'  },
  'Active Agents':    { accent: '#f59e0b', bg: '#fef3c7', icon: 'agent'    },
  'Hotels Listed':    { accent: '#8b5cf6', bg: '#ede9fe', icon: 'hotel'    },
  'API Bookings':     { accent: '#ef4444', bg: '#fee2e2', icon: 'tour'     },
};

/* ══ DROPDOWN ══ */
function PremiumDropdown({ label, grouped, valueFormatter, accent = '#6366f1' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const countries = Object.keys(grouped || {});

  return (
    <div className="pdd-wrap" ref={ref}>
      <button
        className={`pdd-toggle ${open ? 'pdd-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        style={{ '--dd-accent': accent }}
      >
        <Icon name="mappin" size={11} color={accent} />
        <span>{label}</span>
        <span className={`pdd-chevron ${open ? 'pdd-chevron-up' : ''}`}>
          <Icon name="chevron" size={10} color="#9198a8" />
        </span>
      </button>

      {open && (
        <div className="pdd-menu" role="menu">
          <div className="pdd-menu-header">
            <Icon name="mappin" size={12} color={accent} />
            <span style={{ color: accent }}>{label}</span>
          </div>
          {countries.length === 0 ? (
            <div className="pdd-empty">No records found</div>
          ) : countries.map((country) => (
            <div key={country} className="pdd-country">
              <div className="pdd-country-label">{country}</div>
              {Object.keys(grouped[country]).map((city) => {
                const entry = grouped[country][city];
                const val   = Array.isArray(entry)
                  ? entry.length
                  : (valueFormatter ? valueFormatter(entry) : entry);
                return (
                  <div key={city} className="pdd-city-row" role="menuitem">
                    <span className="pdd-city">{city}</span>
                    <span className="pdd-val" style={{ color: accent }}>{val}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══ KPI CARD ══ */
function KpiCard({ title, value, breakdown, dropdowns }) {
  const meta = kpiMeta[title] || { accent: '#6366f1', bg: '#eef2ff', icon: 'booking' };
  const hasDropdowns = dropdowns && dropdowns.length > 0;

  return (
    <div className="kpi-card">
      <div className="kpi-bar-top" style={{ background: meta.accent }} />

      {/* Icon row — dropdown sits here if present */}
      <div className="kpi-top">
        <div className="kpi-icon-wrap" style={{ background: meta.bg }}>
          <Icon name={meta.icon} size={16} color={meta.accent} />
        </div>
        {hasDropdowns && (
          <div className="kpi-dropdowns">
            {dropdowns.map((d, i) => (
              <PremiumDropdown
                key={i}
                label={d.label}
                grouped={d.grouped}
                valueFormatter={d.valueFormatter}
                accent={meta.accent}
              />
            ))}
          </div>
        )}
      </div>

      <div className="kpi-value" style={{ color: meta.accent }}>{value}</div>
      <div className="kpi-title">{title}</div>

      {breakdown && <div className="kpi-breakdown">{breakdown}</div>}
    </div>
  );
}

/* ══ BREAKDOWN PANEL ══ */
function BreakdownPanel({ title, items }) {
  return (
    <div className="bp-wrap">
      <p className="bp-title">{title}</p>
      {items.map((it, i) => (
        <div className="bp-row" key={i}>
          <span className="bp-label">{it.label}</span>
          <span className="bp-value">{formatNumber(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ══ MAIN DASHBOARD ══ */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [dashboardStatus, setDashboardStatus] = useState(DEFAULT_DASHBOARD);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const userName = localStorage.getItem('UserName') ?? sessionStorage.getItem('UserName');
        if (userName) {
          axiosInstance.get(`/api/personalProfile/${userName}`).catch(() => {});
        }
        const response = await axiosInstance.get('/api/dashboard/stats');
        if (response.data && typeof response.data === 'object') {
          setDashboardStatus((prev) => ({ ...prev, ...response.data }));
        }
      } catch {
        setDashboardStatus(DEFAULT_DASHBOARD);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const totalBookingsObj   = typeof dashboardStatus.totalBookings === 'object'
    ? dashboardStatus.totalBookings : {};
  const totalBookingsCount = sumValues(totalBookingsObj);

  const nonApiBreakdown = [
    { label: 'Hotel',          value: totalBookingsObj.hotel         || 0 },
    { label: 'Custom Package', value: totalBookingsObj.customPackage || 0 },
    { label: 'Package',        value: totalBookingsObj.package       || 0 },
    { label: 'Cab',            value: totalBookingsObj.cab           || 0 },
    { label: 'Offline',        value: totalBookingsObj.offline       || 0 },
  ];

  const apiBookingsCount = Number(dashboardStatus.apiHotelBookings) || 0;
  const apiBreakdown = [
    { label: 'API Hotel',     value: dashboardStatus.apiHotelBookings     || 0 },
    { label: 'Inhouse Hotel', value: dashboardStatus.inhouseHotelBookings || 0 },
  ];

  const agentsByLocation = useMemo(
    () => groupByCountryCity(dashboardStatus.agentList || [], 'companyName'),
    [dashboardStatus.agentList]
  );
  const hotelsByLocation = useMemo(
    () => groupByCountryCity(dashboardStatus.hotelList || [], 'hotelName'),
    [dashboardStatus.hotelList]
  );
  const revenueByLocation = useMemo(() => {
    const grouped = {};
    (dashboardStatus.agentList || []).forEach((a) => {
      const c  = a.country || 'Unknown';
      const ct = a.city    || 'Unknown';
      if (!grouped[c]) grouped[c] = {};
      grouped[c][ct] = (grouped[c][ct] || 0) + (a.revenue || 0);
    });
    return grouped;
  }, [dashboardStatus.agentList]);

  const actions = [
    { label: 'Add New Hotel',      cls: 'btn-indigo', icon: 'hotel',    to: '/registration/hotel/create' },
    { label: 'Add New Agent',      cls: 'btn-green',  icon: 'agent',    to: '/registration/agent' },
    { label: 'Accommodation',      cls: 'btn-yellow', icon: 'booking',  to: '/new-booking/hotel' },
    { label: 'Transfer',           cls: 'btn-blue',   icon: 'transfer', to: null },
    { label: 'Tours & Activities', cls: 'btn-pink',   icon: 'tour',     to: null },
    { label: 'Agent Account',      cls: 'btn-purple', icon: 'account',  to: null },
  ];

  return (
    <>
      <style>{css}</style>
      <div className="dash-shell">
        <TopBar />
        <div className="dash-body">
          <Sidebar />
          <main className="dash-main">

            {/* ── Quick Actions ── */}
            <section className="qa-section">
              <p className="qa-label">Quick Actions</p>
              <div className="qa-row">
                {actions.map((a) => (
                  <button
                    key={a.label}
                    className={`qa-btn ${a.cls}`}
                    disabled={!a.to}
                    onClick={() => a.to && navigate(a.to)}
                  >
                    <span className="qa-icon"><Icon name={a.icon} size={13} /></span>
                    {a.label}
                  </button>
                ))}
              </div>
            </section>

            {/* ── KPI Grid — 3×2 ── */}
            <section>
              <p className="qa-label">Overview</p>
              {loading ? (
                <div className="kpi-grid">
                  {[...Array(6)].map((_, i) => <div key={i} className="kpi-skeleton" />)}
                </div>
              ) : (
                <div className="kpi-grid">
                  {/* Row 1 */}
                  <KpiCard
                    title="Total Bookings"
                    value={formatNumber(totalBookingsCount)}
                    breakdown={<BreakdownPanel title="Breakdown" items={nonApiBreakdown} />}
                    /* no dropdowns — just the breakdown panel */
                  />
                  <KpiCard
                    title="Total Revenue"
                    value={`AED ${formatNumber(dashboardStatus.totalRevenue)}`}
                    dropdowns={[
                      { label: 'Revenue by Location', grouped: revenueByLocation, valueFormatter: (v) => `AED ${formatNumber(v)}` },
                    ]}
                  />
                  <KpiCard
                    title="Active Agents"
                    value={formatNumber(dashboardStatus.totalActiveAgents)}
                    dropdowns={[{ label: 'Agents by Location', grouped: agentsByLocation }]}
                  />
                  {/* Row 2 */}
                  <KpiCard
                    title="Today's Bookings"
                    value={formatNumber(dashboardStatus.todayBookings)}
                  />
                  <KpiCard
                    title="Hotels Listed"
                    value={formatNumber(dashboardStatus.totalHotels)}
                    dropdowns={[{ label: 'Hotels by Location', grouped: hotelsByLocation }]}
                  />
                  <KpiCard
                    title="API Bookings"
                    value={formatNumber(apiBookingsCount)}
                    breakdown={<BreakdownPanel title="Breakdown" items={apiBreakdown} />}
                  />
                </div>
              )}
            </section>

            {/* ── Charts ── */}
            <section>
              <p className="qa-label">Analytics</p>
              <div className="chart-grid">
                <div className="chart-card">
                  <div className="chart-card-header">
                    <span className="chart-dot" style={{ background: '#6366f1' }} />
                    <h3>Bookings Over Time</h3>
                    <span className="chart-badge">Last 5 days</span>
                  </div>
                  <LineChart labels={bookingsLabels} data={bookingsData} />
                </div>
                <div className="chart-card">
                  <div className="chart-card-header">
                    <span className="chart-dot" style={{ background: '#10b981' }} />
                    <h3>Revenue Trends</h3>
                    <span className="chart-badge">Last 5 days</span>
                  </div>
                  <BarChart labels={bookingsLabels} data={revenueData} />
                </div>
              </div>
            </section>

          </main>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════
   STYLES
══════════════════════════════════════════ */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.dash-shell {
  font-family: 'Inter', sans-serif;
  background: #f0f2f8;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: #1a1d23;
}
.dash-body { display: flex; flex-grow: 1; }
.dash-main {
  flex-grow: 1;
  padding: 20px 24px 32px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Section label ── */
.qa-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: #9198a8;
  margin-bottom: 10px;
}

/* ── Quick Actions — single row, scrollable ── */
.qa-section { display: flex; flex-direction: column; }
.qa-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.qa-row::-webkit-scrollbar { height: 3px; }
.qa-row::-webkit-scrollbar-thumb { background: #dde0ea; border-radius: 99px; }

.qa-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,.1);
  transition: transform .15s, box-shadow .15s;
}
.qa-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0,0,0,.14);
}
.qa-btn:disabled { opacity: .45; cursor: not-allowed; }
.qa-icon { display: flex; align-items: center; }
.btn-indigo { background: #6366f1; color: #fff; }
.btn-green  { background: #10b981; color: #fff; }
.btn-yellow { background: #f59e0b; color: #fff; }
.btn-blue   { background: #0ea5e9; color: #fff; }
.btn-pink   { background: #ec4899; color: #fff; }
.btn-purple { background: #8b5cf6; color: #fff; }

/* ── KPI Grid — 3 columns × 2 rows ── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
@media (max-width: 1050px) { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px)  { .kpi-grid { grid-template-columns: 1fr; } }

/* Skeleton loader */
.kpi-skeleton {
  border-radius: 14px;
  height: 130px;
  background: linear-gradient(90deg, #e4e7f0 25%, #eef0f7 50%, #e4e7f0 75%);
  background-size: 200% 100%;
  animation: shim 1.4s infinite;
}
@keyframes shim { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

/* ── KPI Card ── */
.kpi-card {
  background: #fff;
  border-radius: 14px;
  padding: 14px 14px 12px;
  position: relative;
  overflow: visible;
  box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 14px rgba(0,0,0,.05);
  border: 1px solid rgba(0,0,0,.05);
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: box-shadow .2s, transform .2s;
}
.kpi-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,.09), 0 12px 28px rgba(0,0,0,.07);
  transform: translateY(-2px);
}
.kpi-bar-top {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  border-radius: 14px 14px 0 0;
  opacity: .85;
}

/* icon row — space-between pushes dropdown to the right */
.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  gap: 8px;
  min-height: 36px;   /* keeps cards without dropdown same height as cards with one */
}
.kpi-icon-wrap {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.kpi-dropdowns {
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: flex-end;
}

.kpi-value { font-size: 22px; font-weight: 700; letter-spacing: -.4px; line-height: 1; }
.kpi-title { font-size: 11.5px; color: #8692a6; font-weight: 500; margin-top: 3px; }

/* ── Breakdown ── */
.kpi-breakdown { margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0f1f5; }
.bp-wrap { display: flex; flex-direction: column; }
.bp-title {
  font-size: 9.5px; font-weight: 700;
  letter-spacing: .07em; text-transform: uppercase;
  color: #b0b8c8; margin-bottom: 7px;
}
.bp-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 4px 0;
  border-bottom: 1px dashed #f0f2f6;
}
.bp-row:last-child { border-bottom: none; }
.bp-label { font-size: 12px; color: #8692a6; }
.bp-value { font-size: 12px; font-weight: 600; color: #1a1d23; }

/* ── Dropdown ── */
.pdd-wrap { position: relative; }
.pdd-toggle {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 8px;
  background: #fff;
  border: 1px solid #e2e6f0;
  border-radius: 8px;
  font-size: 10px; font-weight: 500; font-family: 'Inter', sans-serif;
  color: #4a5568; cursor: pointer; white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0,0,0,.05);
  transition: border-color .15s, box-shadow .15s;
}
.pdd-toggle:hover,
.pdd-toggle.pdd-open {
  border-color: var(--dd-accent, #6366f1);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dd-accent, #6366f1) 12%, transparent);
}
.pdd-chevron { display: flex; align-items: center; transition: transform .2s; }
.pdd-chevron-up { transform: rotate(180deg); }

.pdd-menu {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 9999;
  background: #fff;
  border: 1px solid #eaecf5;
  border-radius: 14px;
  min-width: 220px; max-height: 280px; overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0,0,0,.04), 0 12px 32px rgba(0,0,0,.11);
  animation: ddIn .14s ease;
}
@keyframes ddIn {
  from { opacity: 0; transform: translateY(-5px) scale(.98); }
  to   { opacity: 1; transform: none; }
}
.pdd-menu-header {
  display: flex; align-items: center; gap: 7px;
  padding: 10px 14px 8px;
  border-bottom: 1px solid #f0f2f8;
  font-size: 10px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
}
.pdd-empty { padding: 14px; font-size: 12px; color: #b0b8c8; text-align: center; }
.pdd-country-label {
  padding: 7px 14px 2px;
  font-size: 9px; font-weight: 700; letter-spacing: .09em;
  text-transform: uppercase; color: #c0c8d8;
}
.pdd-city-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 14px;
  border-bottom: 1px solid #f5f7fc;
  transition: background .1s; cursor: default;
}
.pdd-city-row:hover { background: #f9fafd; }
.pdd-city-row:last-child { border-bottom: none; }
.pdd-city { font-size: 12px; color: #5a6072; }
.pdd-val  { font-size: 12px; font-weight: 600; }

/* ── Charts ── */
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
@media (max-width: 860px) { .chart-grid { grid-template-columns: 1fr; } }

.chart-card {
  background: #fff;
  border-radius: 14px;
  padding: 18px 18px 14px;
  border: 1px solid rgba(0,0,0,.05);
  box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 14px rgba(0,0,0,.05);
  transition: box-shadow .2s, transform .2s;
}
.chart-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,.09), 0 12px 28px rgba(0,0,0,.07);
  transform: translateY(-2px);
}
.chart-card-header {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 14px;
}
.chart-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.chart-card-header h3 { font-size: 13px; font-weight: 600; color: #1a1d23; margin: 0; flex: 1; }
.chart-badge {
  font-size: 10px; font-weight: 500;
  background: #f0f2f8; color: #8692a6;
  padding: 3px 9px; border-radius: 99px;
}
`;