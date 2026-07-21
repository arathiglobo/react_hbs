import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronUp, ChevronDown } from "lucide-react";

/**
 * Time-only picker with explicit OK / Cancel — the time-column half of the
 * DateTimeApplyPicker used by hotel-actions/{id}/occupancy-and-minimumlength,
 * lifted out so screens that only need HH:MM (no date) can reuse the same
 * feel: hour + minute steppers, editable text, AM/PM toggle, OK to commit,
 * Cancel to discard.
 *
 *   value / onApply — "HH:MM" 24-hour strings (same shape as <input type="time" />)
 *   Empty string means "no time chosen".
 *
 * Reuses the .cdt-* classes already defined in src/styles/custom.scss, so no
 * new CSS ships with this component.
 */

const pad2 = (n) => String(n).padStart(2, "0");

const parseTime = (str) => {
  if (!str) return null;
  const [hh, mm] = String(str).split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return { h: hh, m: mm };
};

const formatTime24 = ({ h, m }) => `${pad2(h)}:${pad2(m)}`;

const formatDisplay = (t) => {
  if (!t) return "";
  const ampm = t.h >= 12 ? "PM" : "AM";
  const h12 = t.h % 12 === 0 ? 12 : t.h % 12;
  return `${pad2(h12)}:${pad2(m2(t.m))} ${ampm}`;
};

// Never gets pad2 twice; separate helper keeps formatDisplay readable.
const m2 = (m) => (Number.isFinite(m) ? m : 0);

export default function TimeApplyPicker({
  value,
  onApply,
  disabled = false,
  isInvalid = false,
  placeholder = "Select time",
  allowClear = false,
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(parseTime(value));
  const [hourText, setHourText] = useState("");
  const [minuteText, setMinuteText] = useState("");
  const wrapRef = useRef(null);
  const popupRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setDraft(parseTime(value));
  }, [value]);

  const computePos = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = 260;
    const H = 200;
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

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      const inInput = wrapRef.current && wrapRef.current.contains(e.target);
      const inPopup = popupRef.current && popupRef.current.contains(e.target);
      if (!inInput && !inPopup) {
        setDraft(parseTime(value));
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
    const init = parseTime(value) || { h: new Date().getHours(), m: 0 };
    setDraft(init);
    computePos();
    setOpen(true);
  };

  const handleApply = () => {
    if (draft) onApply(formatTime24(draft));
    else onApply("");
    setOpen(false);
  };

  const handleCancel = () => {
    setDraft(parseTime(value));
    setOpen(false);
  };

  const handleClear = () => {
    setDraft(null);
    onApply("");
    setOpen(false);
  };

  const draftHour24 = draft ? draft.h : 0;
  const draftAmPm = draftHour24 >= 12 ? "PM" : "AM";
  const draftHour12 = draftHour24 % 12 === 0 ? 12 : draftHour24 % 12;
  const draftMinute = draft ? draft.m : 0;

  useEffect(() => {
    setHourText(pad2(draftHour12));
    setMinuteText(pad2(draftMinute));
  }, [draftHour12, draftMinute]);

  const ensureDraft = () =>
    draft ? { ...draft } : { h: new Date().getHours(), m: 0 };

  const stepHour = (delta) => {
    const base = ensureDraft();
    base.h = (base.h + delta + 24) % 24;
    setDraft(base);
  };

  const stepMinute = (delta) => {
    const base = ensureDraft();
    base.m = (base.m + delta + 60) % 60;
    setDraft(base);
  };

  const setAmPm = (ampm) => {
    const base = ensureDraft();
    const isPM = base.h >= 12;
    if (ampm === "PM" && !isPM) base.h += 12;
    if (ampm === "AM" && isPM) base.h -= 12;
    setDraft(base);
  };

  const commitHour = () => {
    const h = parseInt(hourText.replace(/\D/g, ""), 10);
    if (Number.isNaN(h)) {
      setHourText(pad2(draftHour12));
      return;
    }
    const clamped = Math.min(12, Math.max(1, h));
    const base = ensureDraft();
    base.h = (clamped % 12) + (draftAmPm === "PM" ? 12 : 0);
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
    base.m = clamped;
    setDraft(base);
  };

  return (
    <div className="cdt" ref={wrapRef}>
      <input
        type="text"
        readOnly
        value={formatDisplay(parseTime(value))}
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
            style={{ top: pos.top, left: pos.left, minWidth: 260 }}
          >
            <div className="cdt-body" style={{ padding: 8 }}>
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
                      setHourText(
                        e.target.value.replace(/\D/g, "").slice(0, 2),
                      )
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

            <div className="cdt-footer">
              {allowClear ? (
                <button
                  type="button"
                  className="cdt-clear"
                  onClick={handleClear}
                >
                  Clear
                </button>
              ) : (
                <span />
              )}
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
}
