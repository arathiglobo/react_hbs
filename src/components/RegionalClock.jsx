import React, { useEffect, useState } from "react";
import axiosInstance from "./AxiosInstance";

/**
 * RegionalClock
 * ─────────────
 * Live date+time chip pinned to the top of every dashboard. The clock
 * is rendered in the timezone of the country the logged-in user is
 * registered in (Agent / Hotel → server-side `countryCode` on
 * /api/personalProfile/{userName}; Admin / Staff / others → browser
 * timezone fallback). Ticks once per second.
 *
 *   <RegionalClock />                    // default chip
 *   <RegionalClock variant="compact" />  // small inline pill
 *
 * Resolution order:
 *   1. countryCode override passed as prop (rare — overrides everything).
 *   2. Cached profile in localStorage under "regionalClockProfile"
 *      (so subsequent dashboards don't re-fetch the profile).
 *   3. GET /api/personalProfile/{userName} — `countryCode` field.
 *   4. Browser-local timezone (Intl.DateTimeFormat().resolvedOptions()).
 */

// ISO-3166 alpha-2 → IANA timezone. We pick a single representative
// zone per country (the one most travel-booking ops use). Multi-zone
// countries (US, RU, etc.) get a primary; if your business needs
// finer per-state granularity, extend this map or expose timezone
// directly on the profile.
const COUNTRY_TZ = {
  AE: "Asia/Dubai",
  SA: "Asia/Riyadh",
  QA: "Asia/Qatar",
  KW: "Asia/Kuwait",
  BH: "Asia/Bahrain",
  OM: "Asia/Muscat",
  IN: "Asia/Kolkata",
  PK: "Asia/Karachi",
  BD: "Asia/Dhaka",
  LK: "Asia/Colombo",
  NP: "Asia/Kathmandu",
  US: "America/New_York",
  CA: "America/Toronto",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  IT: "Europe/Rome",
  ES: "Europe/Madrid",
  PT: "Europe/Lisbon",
  NL: "Europe/Amsterdam",
  BE: "Europe/Brussels",
  CH: "Europe/Zurich",
  AT: "Europe/Vienna",
  RU: "Europe/Moscow",
  TR: "Europe/Istanbul",
  EG: "Africa/Cairo",
  ZA: "Africa/Johannesburg",
  NG: "Africa/Lagos",
  KE: "Africa/Nairobi",
  CN: "Asia/Shanghai",
  HK: "Asia/Hong_Kong",
  TW: "Asia/Taipei",
  JP: "Asia/Tokyo",
  KR: "Asia/Seoul",
  SG: "Asia/Singapore",
  MY: "Asia/Kuala_Lumpur",
  TH: "Asia/Bangkok",
  VN: "Asia/Ho_Chi_Minh",
  ID: "Asia/Jakarta",
  PH: "Asia/Manila",
  AU: "Australia/Sydney",
  NZ: "Pacific/Auckland",
  BR: "America/Sao_Paulo",
  AR: "America/Argentina/Buenos_Aires",
  MX: "America/Mexico_City",
};

const BROWSER_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
})();

const PROFILE_CACHE_KEY = "regionalClockProfile";

const readCachedProfile = () => {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeCachedProfile = (data) => {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
  } catch {
    /* localStorage disabled / quota — silently ignore */
  }
};

const resolveTimezone = (countryCode) => {
  if (!countryCode) return BROWSER_TZ;
  const code = String(countryCode).trim().toUpperCase();
  return COUNTRY_TZ[code] || BROWSER_TZ;
};

const formatDateTime = (now, timezone) => {
  try {
    const dateFmt = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: timezone,
    });
    const timeFmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: timezone,
    });
    return { date: dateFmt.format(now), time: timeFmt.format(now) };
  } catch {
    return { date: now.toDateString(), time: now.toTimeString().slice(0, 8) };
  }
};

const RegionalClock = ({ variant = "default", countryCode: override } = {}) => {
  const [profile, setProfile] = useState(() => readCachedProfile());
  const [now, setNow] = useState(() => new Date());

  // 1) Resolve the user's profile (just for countryCode + countryName).
  //    Skip the round-trip if we've cached it from an earlier dashboard.
  useEffect(() => {
    if (override) return; // explicit override wins
    if (profile && profile.countryCode) return; // cached — done
    let alive = true;
    const userName =
      localStorage.getItem("UserName") || sessionStorage.getItem("UserName");
    if (!userName) return;
    axiosInstance
      .get(`/api/personalProfile/${userName}`)
      .then((res) => {
        if (!alive) return;
        const data = res?.data || {};
        const next = {
          countryCode: data.countryCode || "",
          countryName: data.countryName || "",
        };
        setProfile(next);
        writeCachedProfile(next);
      })
      .catch(() => {
        // 404 / network — just fall back to browser TZ.
      });
    return () => {
      alive = false;
    };
  }, [override, profile]);

  // 2) Tick every second.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const effectiveCode = override || profile?.countryCode || "";
  const timezone = resolveTimezone(effectiveCode);
  const { date, time } = formatDateTime(now, timezone);
  const regionLabel =
    profile?.countryName ||
    effectiveCode ||
    timezone.replace("_", " ").split("/").pop();

  if (variant === "compact") {
    return (
      <span
        className="regional-clock regional-clock-compact d-inline-flex align-items-center gap-2 px-2 py-1 rounded border bg-white small"
        title={`${regionLabel} (${timezone})`}
      >
        <i className="fa-regular fa-clock text-primary" />
        <span className="fw-semibold">{time}</span>
        <span className="text-muted">{date}</span>
      </span>
    );
  }

  return (
    <div
      className="regional-clock d-inline-flex align-items-center gap-3 px-3 py-2 rounded-3 border bg-white shadow-sm"
      title={`${regionLabel} (${timezone})`}
    >
      <div
        className="d-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary"
        style={{ width: 36, height: 36 }}
      >
        <i className="fa-regular fa-clock" />
      </div>
      <div className="d-flex flex-column">
        <span className="fw-bold lh-1" style={{ fontSize: "1.05rem" }}>
          {time}
        </span>
        <span className="text-muted small lh-1 mt-1">{date}</span>
      </div>
      <div className="vr" />
      <div className="d-flex flex-column">
        <span className="text-uppercase text-muted" style={{ fontSize: "0.7rem", letterSpacing: 0.5 }}>
          Region
        </span>
        <span className="fw-semibold small">{regionLabel}</span>
      </div>
    </div>
  );
};

export default RegionalClock;
