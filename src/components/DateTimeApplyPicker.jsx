import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/**
 * Custom date + time picker with an explicit OK / Cancel gate.
 *
 * Originally defined inline on the Occupancy & Minimum Length page's Validity
 * From / Validity To fields (/hotel-actions/{id}/occupancy-and-minimumlength).
 * Extracted here so other date-time inputs across the app (e.g. Package Search
 * Arrival / Departure) can render the exact same calendar without a second
 * copy of the calendar grid, time steppers, portal-positioning logic and
 * outside-click handler.
 *
 * The chosen date & time live in a local `draft` while the popup is open;
 * nothing is written back to the form until "OK" is clicked (Cancel discards
 * the draft, Clear wipes the field). Value in / out uses the same
 * "YYYY-MM-DDTHH:mm" local-datetime string a native <input type="datetime-local">
 * produces, so any code that already reads / writes that shape works unchanged.
 *
 * Props:
 *   value        current value as "YYYY-MM-DDTHH:mm", or "" when unset
 *   onApply(v)   called with the new value on OK / Clear
 *   disabled     dims and blocks the input
 *   isInvalid    paints Bootstrap's .is-invalid red border on the input
 *   minDate      Date; days before this are disabled in the calendar
 *   placeholder  shown when value is empty
 *
 * Styling lives in `src/styles/custom.scss` under the `.cdt-*` class family
 * (already global via the app's SCSS bundle).
 */
const pad2 = (n) => String(n).padStart(2, "0");

// Exported alongside the picker so callers that pass `minDate` can convert
// their "YYYY-MM-DDTHH:mm" strings into Date objects with the exact same rules
// the picker uses internally (naïve local time, no timezone shifts).
export const parseLocalDateTime = (str) => {
  if (!str) return null;
  const [datePart, timePart = "00:00"] = str.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hh || 0, mm || 0);
};

const formatLocalDateTime = (date) => {
  if (!date) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 31 }, (_, i) => CURRENT_YEAR - 10 + i);

// 12-hour display for the input box: "dd-MM-yyyy hh:mm AM".
const formatDisplay = (date) => {
  if (!date) return "";
  const h24 = date.getHours();
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()} ${pad2(
    h12,
  )}:${pad2(date.getMinutes())} ${ampm}`;
};

const sameDay = (a, b) =>
  !!a &&
  !!b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Build the 42-cell (6-week) day grid for the month shown in `view`.
const buildCalendar = (view) => {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // back up to the Sunday of week 1
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

// yyyy-MM-dd for looking up rateMap entries — matches the key format the
// backend rate-calendar endpoints emit. Kept module-scoped so the day
// grid can call it without allocating per render.
const isoDateKey = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const DateTimeApplyPicker = ({
  value,
  onApply,
  disabled = false,
  isInvalid = false,
  minDate,
  placeholder = "Select date & time",
  // Optional per-day rate hint. `rateMap` is a { "yyyy-MM-dd":
  // { minRate, currency } } object; when a day matches, the number is
  // rendered as a small line under the day number inside the existing
  // calendar cell. Nothing else about the picker's date+time format,
  // popup shape, or OK/Cancel flow changes when these are absent.
  // `onViewMonthChange({ year, monthIndex })` fires when the user
  // navigates the calendar so a parent can lazily fetch the next
  // month's rates.
  rateMap,
  rateCurrency,
  onViewMonthChange,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(parseLocalDateTime(value));
  const [viewDate, setViewDate] = useState(
    parseLocalDateTime(value) || new Date(),
  );
  const wrapRef = useRef(null);
  const popupRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [hourText, setHourText] = useState("");
  const [minuteText, setMinuteText] = useState("");

  // Keep the draft aligned with the committed value whenever it changes
  // from the outside (edit/view prefill).
  useEffect(() => {
    setDraft(parseLocalDateTime(value));
  }, [value]);

  // Position the popup just below the input, flipping/shifting so it stays
  // inside the viewport (the popup is portaled to <body>, so it escapes any
  // ancestor scroll/overflow clipping).
  const computePos = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = 470;
    const H = 360;
    let left = r.left;
    if (left + W > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - W - 8);
    }
    let top = r.bottom + 4;
    if (top + H > window.innerHeight - 8) {
      const above = r.top - H - 4;
      top = above > 8 ? above : Math.max(8, window.innerHeight - H - 8);
    }
    setPos({ top, left });
  };

  // Close (and discard) on outside click; keep the popup positioned while
  // the page scrolls or the window resizes.
  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      const inInput = wrapRef.current && wrapRef.current.contains(e.target);
      const inPopup = popupRef.current && popupRef.current.contains(e.target);
      if (!inInput && !inPopup) {
        setDraft(parseLocalDateTime(value));
        setOpen(false);
      }
    };
    const onReflow = () => computePos();
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, value]);

  const openPicker = () => {
    if (disabled) return;
    const init = parseLocalDateTime(value) || new Date();
    init.setSeconds(0, 0);
    setDraft(init);
    setViewDate(init);
    computePos();
    setOpen(true);
  };

  const handleApply = () => {
    onApply(formatLocalDateTime(draft));
    setOpen(false);
  };

  const handleCancel = () => {
    setDraft(parseLocalDateTime(value)); // discard any unapplied change
    setOpen(false);
  };

  const handleClear = () => {
    setDraft(null);
    onApply("");
    setOpen(false);
  };

  // ----- time helpers -----
  const draftHour24 = draft ? draft.getHours() : 0;
  const draftAmPm = draftHour24 >= 12 ? "PM" : "AM";
  const draftHour12 = draftHour24 % 12 === 0 ? 12 : draftHour24 % 12;
  const draftMinute = draft ? draft.getMinutes() : 0;

  // Sync the editable hour/minute text boxes when the draft changes via the
  // steppers, day click, AM/PM, or when the popup (re)opens.
  useEffect(() => {
    setHourText(pad2(draftHour12));
    setMinuteText(pad2(draftMinute));
  }, [draftHour12, draftMinute]);

  const ensureDraft = () => {
    const base = draft ? new Date(draft) : new Date();
    base.setSeconds(0, 0);
    return base;
  };

  const stepHour = (delta) => {
    const base = ensureDraft();
    base.setHours((base.getHours() + delta + 24) % 24);
    setDraft(base);
  };

  const stepMinute = (delta) => {
    const base = ensureDraft();
    base.setMinutes((base.getMinutes() + delta + 60) % 60);
    setDraft(base);
  };

  const setAmPm = (ampm) => {
    const base = ensureDraft();
    const isPM = base.getHours() >= 12;
    if (ampm === "PM" && !isPM) base.setHours(base.getHours() + 12);
    if (ampm === "AM" && isPM) base.setHours(base.getHours() - 12);
    setDraft(base);
  };

  // Commit a typed hour/minute on blur (or Enter): clamp + write to draft.
  const commitHour = () => {
    const h = parseInt(hourText.replace(/\D/g, ""), 10);
    if (Number.isNaN(h)) {
      setHourText(pad2(draftHour12));
      return;
    }
    const clamped = Math.min(12, Math.max(1, h));
    const base = ensureDraft();
    base.setHours((clamped % 12) + (draftAmPm === "PM" ? 12 : 0));
    setDraft(base);
  };

  const commitMinute = () => {
    const m = parseInt(minuteText.replace(/\D/g, ""), 10);
    if (Number.isNaN(m)) {
      setMinuteText(pad2(draftMinute));
      return;
    }
    const clamped = Math.min(59, Math.max(0, m));
    const base = ensureDraft();
    base.setMinutes(clamped);
    setDraft(base);
  };

  // ----- calendar helpers -----
  const setMonth = (m) =>
    setViewDate((prev) => new Date(prev.getFullYear(), m, 1));
  const setYear = (y) =>
    setViewDate((prev) => new Date(y, prev.getMonth(), 1));

  const selectDay = (day) => {
    if (minDate && startOfDay(day) < startOfDay(minDate)) return;
    const base = ensureDraft();
    base.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    setDraft(base);
  };

  const gotoMonth = (delta) => {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  };

  const committed = parseLocalDateTime(value);
  const days = buildCalendar(viewDate);

  // Notify the parent when the visible month changes so it can fetch
  // rate data for that window on demand. Guarded by onViewMonthChange
  // so pickers that don't care (default use) pay no cost.
  useEffect(() => {
    if (!onViewMonthChange) return;
    onViewMonthChange({
      year: viewDate.getFullYear(),
      monthIndex: viewDate.getMonth(),
    });
  }, [viewDate, onViewMonthChange]);

  return (
    <div className="cdt" ref={wrapRef}>
      <input
        type="text"
        readOnly
        value={formatDisplay(committed)}
        placeholder={placeholder}
        onClick={openPicker}
        disabled={disabled}
        className={`form-control ${isInvalid ? "is-invalid" : ""}`}
        autoComplete="off"
      />

      {open &&
        !disabled &&
        createPortal(
          <div
            className="cdt-popup"
            ref={popupRef}
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="cdt-body">
              {/* Calendar */}
              <div className="cdt-cal">
                <div className="cdt-cal-head">
                  <button
                    type="button"
                    className="cdt-nav"
                    onClick={() => gotoMonth(-1)}
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="cdt-cal-selects">
                    <select
                      className="cdt-select"
                      value={viewDate.getMonth()}
                      onChange={(e) => setMonth(Number(e.target.value))}
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      className="cdt-select"
                      value={viewDate.getFullYear()}
                      onChange={(e) => setYear(Number(e.target.value))}
                    >
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="cdt-nav"
                    onClick={() => gotoMonth(1)}
                    aria-label="Next month"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="cdt-grid cdt-grid-dow">
                  {WEEKDAYS.map((d) => (
                    <span key={d} className="cdt-dow">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="cdt-grid">
                  {days.map((day, i) => {
                    const outside = day.getMonth() !== viewDate.getMonth();
                    const isSel = sameDay(day, draft);
                    const isDisabled =
                      !!minDate && startOfDay(day) < startOfDay(minDate);
                    // Optional per-day rate hint. Only render when a rate
                    // exists for this day and the cell belongs to the
                    // currently-viewed month, so outside-month spillover
                    // days don't gain a stray number. Selected /
                    // disabled days keep the same visual language they
                    // had before rateMap existed.
                    const rateEntry =
                      rateMap && !outside
                        ? rateMap[isoDateKey(day)]
                        : null;
                    const rateVal =
                      rateEntry && rateEntry.minRate != null
                        ? Number(rateEntry.minRate)
                        : null;
                    return (
                      <button
                        type="button"
                        key={i}
                        disabled={isDisabled}
                        onClick={() => selectDay(day)}
                        title={
                          rateVal != null
                            ? `From ${rateVal}${
                                rateCurrency ? " " + rateCurrency : ""
                              }`
                            : undefined
                        }
                        className={`cdt-day${outside ? " cdt-day-out" : ""}${
                          isSel ? " cdt-day-sel" : ""
                        }${isDisabled ? " cdt-day-disabled" : ""}${
                          rateVal != null ? " cdt-day-has-rate" : ""
                        }`}
                      >
                        <span className="cdt-day-num">{day.getDate()}</span>
                        {rateVal != null && (
                          <span className="cdt-day-rate">{rateVal}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time spinner */}
              <div className="cdt-time">
                <div className="cdt-stepper">
                  <button
                    type="button"
                    className="cdt-chev"
                    onClick={() => stepHour(1)}
                    aria-label="Hour up"
                  >
                    <ChevronUp size={18} />
                  </button>
                  <input
                    className="cdt-num"
                    inputMode="numeric"
                    maxLength={2}
                    value={hourText}
                    onChange={(e) =>
                      setHourText(e.target.value.replace(/\D/g, "").slice(0, 2))
                    }
                    onBlur={commitHour}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    aria-label="Hour"
                  />
                  <button
                    type="button"
                    className="cdt-chev"
                    onClick={() => stepHour(-1)}
                    aria-label="Hour down"
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>

                <span className="cdt-sep">:</span>

                <div className="cdt-stepper">
                  <button
                    type="button"
                    className="cdt-chev"
                    onClick={() => stepMinute(1)}
                    aria-label="Minute up"
                  >
                    <ChevronUp size={18} />
                  </button>
                  <input
                    className="cdt-num"
                    inputMode="numeric"
                    maxLength={2}
                    value={minuteText}
                    onChange={(e) =>
                      setMinuteText(
                        e.target.value.replace(/\D/g, "").slice(0, 2),
                      )
                    }
                    onBlur={commitMinute}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    aria-label="Minute"
                  />
                  <button
                    type="button"
                    className="cdt-chev"
                    onClick={() => stepMinute(-1)}
                    aria-label="Minute down"
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>

                <div className="cdt-ampm">
                  <button
                    type="button"
                    className={`cdt-ampm-btn${draftAmPm === "AM" ? " active" : ""}`}
                    onClick={() => setAmPm("AM")}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    className={`cdt-ampm-btn${draftAmPm === "PM" ? " active" : ""}`}
                    onClick={() => setAmPm("PM")}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="cdt-footer">
              <button type="button" className="cdt-clear" onClick={handleClear}>
                Clear
              </button>
              <div className="cdt-foot-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleApply}
                >
                  OK
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default DateTimeApplyPicker;
