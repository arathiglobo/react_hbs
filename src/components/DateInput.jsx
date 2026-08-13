import React from "react";
import { Form } from "react-bootstrap";
import RateCalendar from "./RateCalendar";
import { useFeatureFlag } from "../config/FeatureFlagsContext";

/**
 * Uniform date-picker facade used by every search / booking form.
 *
 * When the backend advertises rate-calendar support (feature flag
 * `rateCalendarEnabled` served by /api/config/features) this renders the
 * fare-hint <RateCalendar>. Otherwise it renders the plain
 * <Form.Control type="date"> the app used before RateCalendar was
 * introduced — preserving old behavior on backends that don't ship the
 * /api/hotel-search/rate-calendar family of endpoints.
 *
 * Props mirror <RateCalendar> 1:1 so call sites don't have to change any
 * of their handlers (setCheckIn / setCheckOut / clearError / minCheckOutDate
 * flow through unchanged). Extras that only make sense for the fare
 * calendar (stateId, endpoint, currency, placeholder) are simply ignored
 * in the fallback branch.
 *
 * `onChange` is always invoked with the raw ISO `yyyy-MM-dd` string —
 * matching what the previous <Form.Control type="date"> passed via
 * e.target.value and what RateCalendar passes as its argument — so the
 * downstream date-math, submit payload, nights sync, and error clearing
 * all continue to work with no per-site edits.
 */
export default function DateInput({
  value,
  onChange,
  min,
  isInvalid = false,
  ariaLabel,
  height = "42px",
  // RateCalendar-only, ignored in the fallback branch:
  stateId,
  endpoint,
  currency,
  placeholder,
}) {
  const enabled = useFeatureFlag("rateCalendarEnabled");

  if (enabled) {
    return (
      <RateCalendar
        value={value}
        onChange={onChange}
        min={min}
        stateId={stateId}
        endpoint={endpoint}
        currency={currency}
        isInvalid={isInvalid}
        ariaLabel={ariaLabel}
        height={height}
        placeholder={placeholder}
      />
    );
  }

  // Legacy path — pre-RateCalendar markup. Kept intentionally close to
  // the original so behavior (native date picker, min clamp, showPicker
  // on click) is unchanged on old backends.
  return (
    <Form.Control
      type="date"
      style={{ height }}
      className={`form-control-modern${isInvalid ? " is-invalid" : ""}`}
      value={value || ""}
      min={min}
      aria-label={ariaLabel}
      onClick={(e) => e.target.showPicker && e.target.showPicker()}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
