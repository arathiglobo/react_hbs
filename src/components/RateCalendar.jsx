import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axiosInstance from "./AxiosInstance";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Fare-calendar picker for hotel check-in / check-out.
 *
 * Renders a text-input-style trigger that opens a two-month calendar popup
 * with a "starting from" nightly rate under each day. Rates come from
 * GET /api/hotel-search/rate-calendar (see RateCalendarController on the
 * backend). Days with no live rate render "—". The cheapest 3 days across
 * the two visible months get tinted green as a fast visual signal.
 *
 * Drop-in for `<Form.Control type="date">`: same ISO `yyyy-MM-dd` string in
 * value + onChange, same min-date semantics. Existing state and downstream
 * consumers do not need to change.
 *
 * Props:
 *   value        current date as `yyyy-MM-dd` (or "")
 *   onChange     (isoDate) => void — called when the operator picks a day
 *   min          earliest selectable date as `yyyy-MM-dd`; earlier days
 *                render dimmed and non-clickable
 *   stateId      the "city" id (matches HotelSearchRepository — schema calls
 *                it state). Fare fetch is skipped when null.
 *   currency     currency code for the rate hint (e.g. "AED")
 *   endpoint     backend URL to fetch rates from. Defaults to the hotel-search
 *                calendar endpoint. Pass another URL (e.g. the last-minute
 *                calendar) to reuse this component for a different rate
 *                universe — the response shape { days: {"yyyy-MM-dd": {minRate, currency}} }
 *                must be the same.
 *   placeholder  text shown when value is empty
 *   isInvalid    optional error state to mirror Bootstrap's isInvalid style
 *   ariaLabel    accessible label
 *   height       CSS height matching the surrounding form controls
 */
function RateCalendar({
  value,
  onChange,
  min,
  stateId,
  currency = "AED",
  endpoint = "/api/hotel-search/rate-calendar",
  placeholder = "dd-mm-yyyy",
  isInvalid = false,
  ariaLabel,
  height = "42px",
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    // Start the calendar on the currently-selected month if there is one,
    // otherwise on today's month.
    const base = value ? new Date(value) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [rateMap, setRateMap] = useState({});  // { "yyyy-MM-dd": {minRate, currency} }
  const [loading, setLoading] = useState(false);
  // Viewport-space coordinates for the popup — computed from the anchor's
  // bounding rect on open + kept live on scroll/resize. Using explicit
  // {top, left} with `position: fixed` (below) means the popup floats
  // above ANY parent overflow / stacking-context / scroll region, which
  // is what stops the "Ready to Find…" section from clipping the popup
  // bottom. Rendered via React portal into document.body so the DOM
  // parentage doesn't matter either.
  const [popupCoords, setPopupCoords] = useState({ top: 0, left: 0 });
  const anchorRef = useRef(null);
  const popupRef = useRef(null);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const monthWrapRef = useRef(null);
  const yearWrapRef = useRef(null);
  const selectedYearRef = useRef(null);

  // ── compute (and keep updating) the fixed-position coords ──────────
  useEffect(() => {
    if (!open || !anchorRef.current) return undefined;

    const compute = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      const popupWidth = 360;                     // matches POPUP_STYLE.width
      const viewportW = window.innerWidth;
      // Default: anchor to the button's left edge.
      let left = rect.left;
      // Flip when the popup would spill off the right side of the viewport.
      if (rect.left + popupWidth > viewportW - 16) {
        left = rect.right - popupWidth;
      }
      // Never let the popup start before a 16 px left gutter.
      left = Math.max(16, left);
      setPopupCoords({ top: rect.bottom + 8, left });
    };

    compute();
    // useCapture=true catches scroll on ancestor scroll containers too,
    // so the popup follows the anchor if the page scrolls under it.
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open]);

  // ── close on outside click / Escape ────────────────────────────────
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // ── close month/year dropdowns on outside click ────────────────────
  useEffect(() => {
    if (!monthMenuOpen && !yearMenuOpen) return undefined;
    const onDocClick = (e) => {
      if (
        monthMenuOpen &&
        monthWrapRef.current &&
        !monthWrapRef.current.contains(e.target)
      ) {
        setMonthMenuOpen(false);
      }
      if (
        yearMenuOpen &&
        yearWrapRef.current &&
        !yearWrapRef.current.contains(e.target)
      ) {
        setYearMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [monthMenuOpen, yearMenuOpen]);

  // Open the year grid centered on whichever year is currently viewed —
  // otherwise the operator sees the top of the list (2026) and has to
  // hunt for 2050 every time.
  useEffect(() => {
    if (yearMenuOpen && selectedYearRef.current) {
      selectedYearRef.current.scrollIntoView({ block: "center" });
    }
  }, [yearMenuOpen]);

  // ── fetch the visible month of rates whenever the window shifts ────
  useEffect(() => {
    if (!open || !stateId) return undefined;

    // Window: first-of-viewMonth  →  last-of-viewMonth (single month).
    const start = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const end = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);

    const params = {
      stateId,
      monthStart: iso(start),
      monthEnd: iso(end),
      currency,
    };

    let cancelled = false;
    setLoading(true);
    axiosInstance
      .get(endpoint, { params })
      .then((res) => {
        if (cancelled) return;
        const days = res?.data?.days || {};
        setRateMap(days);
      })
      .catch((err) => {
        if (cancelled) return;
        // Rate-hint failure must never take down the picker — just render
        // days without prices.
        // eslint-disable-next-line no-console
        console.warn("Rate-calendar fetch failed — rendering without rates.", err);
        setRateMap({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, viewMonth, stateId, currency, endpoint]);

  // ── compute the cheapest 3 days across the visible window ──────────
  // Past dates are excluded from the "cheapest days" calculation — a
  // green-tinted day the operator can't actually book on is confusing
  // noise, not a useful signal. `min` gates this (same value that dims
  // past cells below).
  const cheapestSet = useMemo(() => {
    const entries = Object.entries(rateMap)
      .filter(([k, v]) => v && v.minRate != null && (!min || k >= min))
      .map(([k, v]) => [k, Number(v.minRate)])
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3);
    return new Set(entries.map(([k]) => k));
  }, [rateMap, min]);

  // ── month grid data ────────────────────────────────────────────────
  const monthA = useMemo(() => buildMonth(viewMonth), [viewMonth]);

  // ── handlers ───────────────────────────────────────────────────────
  const handleSelect = (isoDate, disabled) => {
    if (disabled) return;
    onChange(isoDate);
    setOpen(false);
  };

  // ── month / year dropdown data ─────────────────────────────────────
  // Month/year navigation happens through the two header dropdowns —
  // operators pick the month name or year directly instead of stepping
  // through with arrow buttons. The lists cover the range [min-year,
  // min-year + 5] extended to always include the currently-viewed
  // month/year, so a value set earlier still shows up as the highlighted
  // entry even if it sits outside the default 6-year window.
  const viewYear = viewMonth.getFullYear();
  const viewMonthIdx = viewMonth.getMonth();
  const minYear = min ? Number(min.slice(0, 4)) : new Date().getFullYear();
  const startYear = Math.min(minYear, viewYear);
  // Extend the year list well into the future so long-lead bookings
  // (e.g. 2050) are reachable without arrow navigation. The list is at
  // least 25 years long, always covers up to 2050, and always includes
  // the currently-viewed year (which may sit further out if the caller
  // pre-set a value beyond the default horizon).
  const endYear = Math.max(startYear + 25, viewYear + 1, 2050);
  const years = useMemo(() => {
    const arr = [];
    for (let y = startYear; y <= endYear; y++) arr.push(y);
    return arr;
  }, [startYear, endYear]);

  // A month/year is unavailable when its last day already sits before `min` —
  // nothing in it could be picked anyway. We still render it (dimmed) so
  // operators see the full range and understand why it can't be chosen.
  const parsedMin = useMemo(() => {
    if (!min) return null;
    const [y, m, d] = min.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [min]);
  const isMonthDisabled = (mIdx) => {
    if (!parsedMin) return false;
    return new Date(viewYear, mIdx + 1, 0) < parsedMin;
  };
  const isYearDisabled = (y) => {
    if (!parsedMin) return false;
    return new Date(y, 11, 31) < parsedMin;
  };

  const pickMonth = (mIdx) => {
    if (isMonthDisabled(mIdx)) return;
    setViewMonth(new Date(viewYear, mIdx, 1));
    setMonthMenuOpen(false);
  };
  const pickYear = (y) => {
    if (isYearDisabled(y)) return;
    setViewMonth(new Date(y, viewMonthIdx, 1));
    setYearMenuOpen(false);
  };

  // ── render ─────────────────────────────────────────────────────────
  const display = value ? formatDisplay(value) : "";
  const todayIso = iso(new Date());

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={anchorRef}
        type="button"
        aria-label={ariaLabel || "Open date picker"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`form-control form-control-modern${isInvalid ? " is-invalid" : ""}`}
        style={{
          height,
          textAlign: "left",
          background: "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          fontSize: "0.9rem",
        }}
      >
        <span style={{ color: display ? "#1e2432" : "#8891a3" }}>
          {display || placeholder}
        </span>
        <span aria-hidden="true" style={{ color: "#8891a3" }}>📅</span>
      </button>

      {open && createPortal(
        <div
          ref={popupRef}
          role="dialog"
          aria-label="Fare calendar"
          style={{
            ...POPUP_STYLE,
            top: popupCoords.top,
            left: popupCoords.left,
          }}
        >
          <div style={HEADER_ROW}>
            <div ref={monthWrapRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => {
                  setMonthMenuOpen((o) => !o);
                  setYearMenuOpen(false);
                }}
                style={DROPDOWN_TRIGGER}
                aria-haspopup="listbox"
                aria-expanded={monthMenuOpen}
              >
                {MONTH_NAMES[viewMonthIdx]}
                <span aria-hidden="true" style={DROPDOWN_CARET}>▾</span>
              </button>
              {monthMenuOpen && (
                <div role="listbox" style={MONTH_GRID_MENU}>
                  {MONTH_ABBR.map((abbr, idx) => {
                    const disabled = isMonthDisabled(idx);
                    const selected = idx === viewMonthIdx;
                    return (
                      <button
                        key={abbr}
                        type="button"
                        disabled={disabled}
                        onClick={() => pickMonth(idx)}
                        role="option"
                        aria-selected={selected}
                        aria-label={MONTH_NAMES[idx]}
                        style={{
                          ...GRID_CELL,
                          ...(selected ? GRID_CELL_SELECTED : null),
                          ...(disabled ? GRID_CELL_DISABLED : null),
                        }}
                      >
                        {abbr}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div ref={yearWrapRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => {
                  setYearMenuOpen((o) => !o);
                  setMonthMenuOpen(false);
                }}
                style={DROPDOWN_TRIGGER}
                aria-haspopup="listbox"
                aria-expanded={yearMenuOpen}
              >
                {viewYear}
                <span aria-hidden="true" style={DROPDOWN_CARET}>▾</span>
              </button>
              {yearMenuOpen && (
                <div role="listbox" style={YEAR_GRID_MENU}>
                  {years.map((y) => {
                    const disabled = isYearDisabled(y);
                    const selected = y === viewYear;
                    return (
                      <button
                        key={y}
                        ref={selected ? selectedYearRef : null}
                        type="button"
                        disabled={disabled}
                        onClick={() => pickYear(y)}
                        role="option"
                        aria-selected={selected}
                        style={{
                          ...GRID_CELL,
                          ...(selected ? GRID_CELL_SELECTED : null),
                          ...(disabled ? GRID_CELL_DISABLED : null),
                        }}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <MonthGrid
            monthData={monthA}
            rateMap={rateMap}
            cheapestSet={cheapestSet}
            min={min}
            todayIso={todayIso}
            value={value}
            onSelect={handleSelect}
          />

          <div style={FOOTER_ROW}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 11 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ ...LEGEND_SWATCH, background: "#e8f7e7", border: "1px solid #06a301" }} />
                Cheapest days
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ ...LEGEND_SWATCH, background: "#e91b5b" }} />
                Selected
              </span>
            </div>
            <span style={{ fontStyle: "italic", fontSize: 11, color: "#8891a3" }}>
              {loading ? "Loading rates…" : `Rates are “starting from” references in ${currency}.`}
            </span>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ── one month grid ─────────────────────────────────────────────────────
function MonthGrid({ monthData, rateMap, cheapestSet, min, todayIso, value, onSelect }) {
  return (
    <div>
      <div style={DOW_ROW}>
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d} style={DOW_CELL}>{d}</div>
        ))}
      </div>
      <div style={DAY_GRID}>
        {monthData.leadingBlanks.map((_, i) => (
          <div key={`b${i}`} style={{ visibility: "hidden" }} />
        ))}
        {monthData.days.map((d) => {
          const dateIso = d.iso;
          const isPast = min ? dateIso < min : false;
          const isToday = dateIso === todayIso;
          const isSelected = dateIso === value;
          const isCheap = cheapestSet.has(dateIso);
          const rate = rateMap[dateIso];

          const styles = { ...DAY_CELL };
          if (isPast) Object.assign(styles, DAY_PAST);
          if (isCheap && !isSelected) Object.assign(styles, DAY_CHEAP);
          if (isSelected) Object.assign(styles, DAY_SELECTED);

          return (
            <button
              key={dateIso}
              type="button"
              disabled={isPast}
              onClick={() => onSelect(dateIso, isPast)}
              style={styles}
              aria-label={`${dateIso}${rate ? `, from ${rate.minRate} ${rate.currency}` : ""}`}
            >
              <div style={{ position: "relative" }}>
                <span style={{
                  fontSize: 13.5,
                  fontWeight: isSelected ? 700 : 600,
                  color: isSelected ? "#fff" : "#1e2432",
                }}>
                  {d.day}
                </span>
                {isToday && !isSelected && (
                  <span style={TODAY_DOT} aria-hidden="true" />
                )}
              </div>
              <div style={{
                fontSize: 10,
                marginTop: 2,
                fontVariantNumeric: "tabular-nums",
                color: isSelected ? "#ffffff"
                     : isCheap ? "#06a301"
                     : "#1e2432",
                fontWeight: 600,
                lineHeight: 1,
                minHeight: 12,
              }}>
                {/* Past dates: no rate — the operator can't book on
                    them, so a "starting from" hint is noise. The
                    minHeight above keeps the cell height uniform so
                    the grid doesn't jump between past and future rows. */}
                {isPast ? "" : (rate && rate.minRate != null ? Number(rate.minRate) : "—")}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────
function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatDisplay(isoStr) {
  // Human-friendly display in the input face — keeps ISO in state for the
  // API but shows dd-mm-yyyy in the button, matching what operators expect.
  const [y, m, d] = isoStr.split("-");
  return `${d}-${m}-${y}`;
}
function buildMonth(firstOfMonth) {
  const year = firstOfMonth.getFullYear();
  const month = firstOfMonth.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  // ISO week starts Monday, so shift Sunday(0) → 6 and Mon(1) → 0 etc.
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    days.push({ day: d, iso: iso(new Date(year, month, d)) });
  }
  return {
    date: firstOfMonth,
    leadingBlanks: new Array(firstWeekday).fill(null),
    days,
  };
}

// ── styles (co-located; no external CSS file needed) ──────────────────
const POPUP_STYLE = {
  // Fixed positioning + portal into document.body = escapes every parent
  // overflow / stacking-context. top/left come from popupCoords, computed
  // from the anchor's getBoundingClientRect() and kept live on scroll +
  // resize. High z-index sits above Bootstrap modals (1050) and any
  // sticky headers.
  position: "fixed",
  width: 360,
  maxWidth: "calc(100vw - 32px)",
  boxSizing: "border-box",
  background: "#fff",
  border: "1px solid #ecebef",
  borderRadius: 12,
  boxShadow: "0 12px 28px rgba(30,36,50,0.14)",
  zIndex: 2000,
  padding: "14px 14px 12px",   // tighter horizontal padding + 20 more px
                               // of width gives the 7-column day grid
                               // ~46px per cell — comfortable margin
                               // even with the selected-day border.
};
const HEADER_ROW = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  marginBottom: 10,
};
const DROPDOWN_TRIGGER = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#f7f6f9",
  border: "1px solid #e2dee6",
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 13.5,
  fontWeight: 700,
  color: "#1e2432",
  cursor: "pointer",
  lineHeight: 1,
};
const DROPDOWN_CARET = {
  fontSize: 10,
  color: "#8891a3",
};
const GRID_MENU_BASE = {
  position: "absolute",
  top: "calc(100% + 4px)",
  background: "#fff",
  border: "1px solid #ecebef",
  borderRadius: 10,
  boxShadow: "0 10px 24px rgba(30,36,50,0.16)",
  padding: 8,
  display: "grid",
  gap: 6,
  zIndex: 10,
};
const MONTH_GRID_MENU = {
  // 3×4 grid of month pills — compact enough to overlay the header only,
  // leaving the day grid visible behind it. Anchored to the month button.
  ...GRID_MENU_BASE,
  left: 0,
  width: 210,
  gridTemplateColumns: "repeat(3, 1fr)",
};
const YEAR_GRID_MENU = {
  // 4-column grid; scrolls vertically because the range now reaches
  // 2050+. Right-aligned so it doesn't spill past the popup's right
  // edge — the year button sits close to the right side of the header.
  ...GRID_MENU_BASE,
  right: 0,
  width: 220,
  maxHeight: 240,
  overflowY: "auto",
  gridTemplateColumns: "repeat(4, 1fr)",
};
const GRID_CELL = {
  padding: "8px 4px",
  background: "#f7f6f9",
  border: "1px solid transparent",
  borderRadius: 6,
  fontSize: 12.5,
  fontWeight: 600,
  color: "#1e2432",
  cursor: "pointer",
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1.1,
};
const GRID_CELL_SELECTED = {
  background: "#e91b5b",
  color: "#fff",
  border: "1px solid #e91b5b",
};
const GRID_CELL_DISABLED = {
  opacity: 0.35,
  cursor: "not-allowed",
  background: "transparent",
};
const DOW_ROW = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 4,
  marginBottom: 4,
};
const DOW_CELL = {
  textAlign: "center",
  fontSize: 10, fontWeight: 700,
  color: "#8891a3",
  letterSpacing: 0.5, textTransform: "uppercase",
  padding: "4px 0",
};
const DAY_GRID = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 4,
};
const DAY_CELL = {
  aspectRatio: "1 / 1.05",
  borderRadius: 8,
  background: "#fff",
  border: "1px solid transparent",
  boxSizing: "border-box",   // the 1px border on the selected cell must
                             // NOT push the cell wider than its grid track
                             // — otherwise the last column can overflow
                             // the popup's right edge.
  minWidth: 0,                // buttons carry a browser-default min-width
                             // that ignores parent constraints without
                             // this override.
  width: "100%",              // fill the 1fr grid track exactly.
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: "4px 2px",
  gap: 2,
  transition: "transform 0.05s ease, background 0.1s ease",
};
const DAY_PAST = {
  opacity: 0.35,
  cursor: "not-allowed",
};
const DAY_CHEAP = {
  background: "#e8f7e7",
};
const DAY_SELECTED = {
  background: "#e91b5b",
  border: "1px solid #e91b5b",
};
const TODAY_DOT = {
  position: "absolute",
  bottom: -4, left: "50%",
  transform: "translateX(-50%)",
  width: 4, height: 4, borderRadius: "50%",
  background: "#e91b5b",
};
const LEGEND_SWATCH = {
  width: 10, height: 10, borderRadius: 3,
  display: "inline-block",
};
const FOOTER_ROW = {
  marginTop: 12,
  paddingTop: 10,
  borderTop: "1px solid #ecebef",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  color: "#8891a3",
  fontSize: 11,
};

export default RateCalendar;
