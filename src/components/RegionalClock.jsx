import React, { useEffect, useState } from "react";
import axiosInstance from "./AxiosInstance";

/**
 * RegionalClock
 * ─────────────
 * Live date+time chip pinned to the top of every dashboard. Always shows
 * United Arab Emirates time, taken from the server via
 * GET /api/dashboard/regional-time — not from the user's browser clock or
 * timezone, so every user sees the same, correct UAE time. Ticks once per
 * second.
 *
 *   <RegionalClock />                    // default chip
 *   <RegionalClock variant="compact" />  // small inline pill
 *
 * The server time is fetched once per mount. The difference between it and
 * the browser clock is kept as an offset, so the per-second tick stays on
 * server time even when the user's PC clock is wrong.
 */

// Used only if the regional-time call fails, so the chip never stays blank —
// the time then comes from the browser clock, still shown in UAE time.
const FALLBACK_REGION = {
  timezone: "Asia/Dubai",
  countryName: "United Arab Emirates",
  offsetMs: 0,
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

const RegionalClock = ({ variant = "default" } = {}) => {
  // { timezone, countryName, offsetMs } — null until the server answers.
  const [region, setRegion] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  // 1) Fetch the UAE time from the server once per mount.
  useEffect(() => {
    let alive = true;
    const sentAt = Date.now();
    axiosInstance
      .get("/api/dashboard/regional-time")
      .then((res) => {
        if (!alive) return;
        const receivedAt = Date.now();
        const data = res?.data || {};
        const serverMs = Number(data.epochMillis);
        // The server read its clock somewhere during the round trip; assume
        // the midpoint so network latency doesn't skew the offset.
        const offsetMs = Number.isFinite(serverMs)
          ? serverMs - Math.round((sentAt + receivedAt) / 2)
          : 0;
        setRegion({
          timezone: data.timezone || FALLBACK_REGION.timezone,
          countryName: data.countryName || FALLBACK_REGION.countryName,
          offsetMs,
        });
      })
      .catch(() => {
        if (alive) setRegion(FALLBACK_REGION);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 2) Tick every second.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const timezone = region?.timezone || FALLBACK_REGION.timezone;
  const { date, time } = region
    ? formatDateTime(new Date(now + region.offsetMs), timezone)
    : { date: "", time: "--:--:--" };
  const regionLabel = region?.countryName || "";

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
