import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  // Viewport-space coordinates for the popup — seeded from the anchor's
  // bounding rect in the click handler (so the first paint is already
  // beside the field) and kept live on scroll/resize. Using explicit
  // {top, left} with `position: fixed` (below) means the popup floats
  // above ANY parent overflow / stacking-context / scroll region, which
  // is what stops the "Ready to Find…" section from clipping the popup
  // bottom. Rendered via React portal into document.body so the DOM
  // parentage doesn't matter either.
  //
  // null means "not placed yet" — the popup is not rendered at all until
  // this holds real coordinates, so it can never paint at the viewport's
  // top-left corner the way the old {top:0,left:0} default could.
  const [popupCoords, setPopupCoords] = useState(null);
  const anchorRef = useRef(null);
  const popupRef = useRef(null);
  // Which side of the field the popup opened on. Frozen for the duration of
  // one open so scrolling can't make it hop between above and below.
  const sideRef = useRef(null);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const monthWrapRef = useRef(null);
  const yearWrapRef = useRef(null);
  const selectedYearRef = useRef(null);

  // ── compute (and keep updating) the fixed-position coords ──────────
  // The popup is a portal + position:fixed so it escapes parent overflow /
  // stacking contexts, but it must still behave like a dropdown ATTACHED to
  // the field: coords are re-derived from the anchor's rect on every scroll
  // and resize, so the calendar travels WITH the Check-In / Check-Out input
  // instead of sitting still on screen. When the field itself is no longer
  // visible — scrolled past, or collapsed away by the Modify-Search strip —
  // the picker closes instead of hanging over the results list.
  //
  // useLayoutEffect (not useEffect) so the first placement lands BEFORE the
  // browser paints — with useEffect the popup showed for one frame at the
  // *previous* open's coordinates and then jumped.
  useLayoutEffect(() => {
    if (!open) return undefined;

    const compute = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();

      // Nothing left to anchor to — the field scrolled out of view, or the
      // Modify-Search strip collapsed it away. Close instead of leaving a
      // detached panel hanging over the results list.
      if (isAnchorHidden(rect)) {
        setOpen(false);
        return;
      }

      // Measure the rendered popup instead of assuming a height — it varies
      // with the month's row count and the footer text. The portal is in the
      // DOM by the time this layout effect runs, so this is a real
      // measurement that refines the click-time estimate before any paint.
      const popupH = popupRef.current
        ? popupRef.current.getBoundingClientRect().height
        : POPUP_FALLBACK_HEIGHT;

      // sideRef pins the popup to the side it opened on; passing it back in
      // stops the panel hopping above/below the field mid-scroll.
      const placement = computePlacement(rect, popupH, sideRef.current);
      sideRef.current = placement.side;

      // Bail out when nothing moved — scroll fires continuously and a fresh
      // object every time would re-render the whole grid on each event.
      setPopupCoords((prev) =>
        prev && prev.top === placement.top && prev.left === placement.left
          ? prev
          : placement);
    };

    compute();
    // useCapture=true so scrolls inside ANY ancestor scroll container are
    // caught too — scroll events don't bubble, so a bubble-phase listener on
    // window only ever sees document-level scrolling. HotelSearch scrolls
    // its own results column rather than the document, so without capture
    // the popup would sit still while the field moved out from under it.
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
  /**
   * Open the picker from a click on the field itself — the only path that
   * ever sets open=true. Coordinates are seeded here from the field's live
   * rect so the popup's FIRST render is already directly below the input;
   * the layout effect then refines that placement with the popup's measured
   * height before the browser paints. Without this seeding the first frame
   * would use whatever was in popupCoords already.
   */
  const openPicker = () => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    sideRef.current = null;            // let the effect re-decide for this open
    setPopupCoords(
      computePlacement(anchor.getBoundingClientRect(), POPUP_FALLBACK_HEIGHT, "below"),
    );
    setOpen(true);
  };

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
        onClick={() => (open ? setOpen(false) : openPicker())}
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

      {/* popupCoords guard: never render before the placement is known, so
          the calendar cannot flash at the viewport's top-left corner. */}
      {open && popupCoords && createPortal(
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
                {isPast ? "" : (rate && rate.minRate != null ? Number(rate.minRate) : " ")}
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

// ── placement ─────────────────────────────────────────────────────────
/** Breathing room kept between the popup and the left/right viewport edge. */
const EDGE_GAP = 16;
/** Gap between the trigger field and the popup. */
const ANCHOR_GAP = 8;
/** Height estimate used for the click-time seed, before the popup exists to
 *  measure. The layout effect re-runs with the real height straight after. */
const POPUP_FALLBACK_HEIGHT = 420;

/**
 * Where the popup sits for a given anchor rect, in viewport coordinates.
 *
 * Kept as a module-scope pure function so the click handler (first paint)
 * and the scroll/resize listener (every subsequent frame) run identical
 * maths — if they drifted apart the popup would jump on the first scroll.
 *
 * The result is ALWAYS relative to the field and deliberately NOT clamped
 * to the viewport: the calendar has to travel with the input when the page
 * scrolls, and a clamp would peel it off and park it on screen instead.
 *
 * @param side  "below" | "above" to force a side (used to keep an already-
 *              open popup on the side it started on), or null to pick from
 *              the available space.
 */
function computePlacement(rect, popupH, side) {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  // ── horizontal: align to the field's left edge ──
  const popupWidth = 360;                     // matches POPUP_STYLE.width
  let left = rect.left;
  // Flip when the popup would spill off the right side of the viewport.
  if (rect.left + popupWidth > viewportW - EDGE_GAP) {
    left = rect.right - popupWidth;
  }
  // Never let the popup start before the left gutter.
  left = Math.max(EDGE_GAP, left);

  // ── vertical: directly below the field by preference ──
  let chosen = side;
  if (chosen == null) {
    const spaceBelow = viewportH - rect.bottom - ANCHOR_GAP - EDGE_GAP;
    const spaceAbove = rect.top - ANCHOR_GAP - EDGE_GAP;
    // Only flip above when it genuinely won't fit below but will fit above.
    chosen = popupH > spaceBelow && popupH <= spaceAbove ? "above" : "below";
  }
  const top = chosen === "above"
    ? rect.top - ANCHOR_GAP - popupH
    : rect.bottom + ANCHOR_GAP;

  return { top, left, side: chosen };
}

/**
 * True when the trigger field has nothing left to anchor to: a zero-size
 * rect (display:none / unmounted — e.g. the Modify-Search strip collapsing
 * the form away) or scrolled clean out of the viewport.
 */
function isAnchorHidden(rect) {
  return (
    (rect.width === 0 && rect.height === 0) ||
    rect.bottom <= 0 ||
    rect.top >= window.innerHeight ||
    rect.right <= 0 ||
    rect.left >= window.innerWidth
  );
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
  // Never taller than the viewport. The popup is pinned to the field and
  // travels with it, so page scrolling can't reveal anything that hangs
  // past the bottom of the screen — on a short window the calendar scrolls
  // INSIDE itself instead.
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
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
