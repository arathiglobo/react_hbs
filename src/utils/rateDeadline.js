import React from "react";

/**
 * Free-cancellation deadline shown on every room-list rate card.
 *
 * One helper for every supplier and for inhouse, because the three pills this
 * replaces (Atharva / Darina / GoGlobal) had drifted apart — different date
 * formats, different wording, and the Atharva one wasn't even red.
 *
 * Where the date comes from, in order:
 *   1. `rate.deadlineDate` — the supplier's own field. Only Atharva
 *      ("DD-MMM-YYYY"), Darina ("yyyy-MM-dd") and GoGlobal ("dd/MMM/yyyy")
 *      populate it; see RateOptionResponse.java.
 *   2. the earliest `cancellationPolicies[].fromDate` — the first charge band
 *      starts when free cancellation ends, so that date IS the cut-off. This
 *      is the only source for Jumeirah, IWTX, X3, RateHawk and inhouse, and
 *      it is where the backend already writes RateHawk's
 *      `free_cancellation_before` (RatehawkHotelRoomSearchService.java).
 *
 * The date is displayed exactly as the supplier sent it — no buffer is
 * subtracted. GRN is deliberately NOT routed through here: it keeps its own
 * colour-coded, IST-based pill in components/grn/GrnPolicy.jsx.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_INDEX = MONTHS.reduce((acc, name, i) => {
  acc[name.toLowerCase()] = i;
  return acc;
}, {});

/**
 * Every supplier date shape this app sees, parsed explicitly.
 *
 * Deliberately not `new Date(str)` first: the engine reads "01-02-2026" as
 * 1 February in some formats and 2 January in others, and it rejects
 * "18/Nov/2026" outright. Guessing wrong on a cancellation cut-off is worse
 * than showing nothing, so each known shape is matched by pattern and the
 * engine is only a last resort.
 */
export const parseSupplierDate = (value) => {
  if (value == null) return null;
  const str = String(value).trim();
  if (!str) return null;

  // ISO `yyyy-MM-dd`, with or without a time component (Darina, policy rows).
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

  // `dd-MMM-yyyy` (Atharva) and `dd/MMM/yyyy` (GoGlobal).
  m = str.match(/^(\d{1,2})[-/]([A-Za-z]{3,})[-/](\d{4})$/);
  if (m) {
    const idx = MONTH_INDEX[m[2].slice(0, 3).toLowerCase()];
    if (idx != null) return new Date(+m[3], idx, +m[1]);
  }

  // `dd-MM-yyyy` / `dd/MM/yyyy` — day-first, the convention across this app.
  m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);

  // `dd MMM yyyy[, hh:mm AM/PM TZ]` — GRN's already-formatted
  // freeCancellationUntil, e.g. "08 Nov 2026, 11:59 PM IST". The engine
  // rejects it outright because of the trailing zone label, so match the
  // date part ourselves and ignore the rest.
  m = str.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (m) {
    const idx = MONTH_INDEX[m[2].slice(0, 3).toLowerCase()];
    if (idx != null) return new Date(+m[3], idx, +m[1]);
  }

  const nat = new Date(str);
  return Number.isNaN(nat.getTime()) ? null : nat;
};

/** One display format for every supplier: "18 Nov 2026". */
export const formatDeadlineDay = (value) => {
  const d = parseSupplierDate(value);
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * Suppliers disagree on how they say "no": true / "true" / "Y" / "yes" / 1.
 * Mirrors isNonRefundableRate in RoomList.jsx.
 */
export const isNonRefundable = (value) => {
  const v = String(value).trim().toLowerCase();
  return v === "true" || v === "y" || v === "yes" || v === "1";
};

/**
 * The cut-off for a rate, as a `Date`, or null when there isn't one.
 * `fallbackPolicies` covers suppliers that hang the policy list off the hotel
 * rather than the rate.
 */
/**
 * True when a supplier date carries no meaningful time — either no time part
 * at all, or exactly midnight.
 *
 * The time is read from the position after the date, NOT by searching for
 * "00:00" anywhere: "2026-11-08T21:00:00Z" contains "00:00" inside its
 * seconds and would otherwise be misread as midnight.
 */
const isMidnightOrDateOnly = (value) => {
  const m = String(value || "").match(/[T\s](\d{1,2}):(\d{2})/);
  if (!m) return true; // date-only
  return Number(m[1]) === 0 && Number(m[2]) === 0;
};

/**
 * Same as resolveDeadlineDate but also reports WHICH field the answer came
 * from and its raw value. The pill puts this in its tooltip: when two screens
 * disagree, hovering each one says immediately whether they read different
 * fields or the same field with different data, instead of it being guesswork.
 */
export const resolveDeadlineInfo = (rate, fallbackPolicies) => {
  if (!rate) return null;

  // 1. GRN states the end of the free window outright — the most direct
  //    answer any supplier gives, so it wins.
  const grn = parseSupplierDate(rate.freeCancellationUntil);
  if (grn) return { date: grn, source: "freeCancellationUntil", raw: rate.freeCancellationUntil };

  // 2. Atharva / Darina / GoGlobal `deadlineDate`. Darina's is the free (0%)
  //    band's toDate — see extractFreeCancellationDeadline in
  //    DarinaHotelRoomSearchService — i.e. already the LAST FREE DAY, so it
  //    is used as-is.
  const own = parseSupplierDate(rate.deadlineDate);
  if (own) return { date: own, source: "deadlineDate", raw: rate.deadlineDate };

  // 3. Cancellation-policy rows. `cancellationPolicy` (singular) is the key
  //    mapRateForPayload hands to the booking page; `cancellationPolicies` is
  //    what the room list carries. Accept both so one rate resolves the same
  //    on either screen.
  //
  //    `fallbackPolicies` is a last resort and callers should normally NOT
  //    pass it: the room list used to hand in the HOTEL-level policy list,
  //    which the booking page has no access to, so the two screens resolved
  //    from different data for any rate without its own rows.
  const policies = Array.isArray(rate.cancellationPolicies)
    ? rate.cancellationPolicies
    : Array.isArray(rate.cancellationPolicy)
      ? rate.cancellationPolicy
      : Array.isArray(fallbackPolicies)
        ? fallbackPolicies
        : [];

  let earliest = null;
  let earliestRaw = null;
  policies.forEach((p) => {
    const d = parseSupplierDate(p?.fromDate);
    if (d && (!earliest || d < earliest)) {
      earliest = d;
      earliestRaw = p?.fromDate;
    }
  });
  if (!earliest) return null;

  // A band that starts at 00:00 on day D means charges begin the instant D
  // starts — so the last moment you can cancel free is the END of D−1, which
  // is what this pill's "11:59 PM" label states. Without this the card
  // promises a free day that the supplier already charges for: the room list
  // read 9 Nov where the booking page (using Darina's own free-band toDate)
  // read 8 Nov, for one and the same policy.
  //
  // When the band start carries a real time (RateHawk writes
  // free_cancellation_before straight into fromDate) that instant IS the
  // cut-off, so it is left alone.
  if (isMidnightOrDateOnly(earliestRaw)) {
    const adjusted = new Date(earliest);
    adjusted.setDate(adjusted.getDate() - 1);
    return { date: adjusted, source: "policy fromDate − 1 day", raw: earliestRaw };
  }
  return { date: earliest, source: "policy fromDate", raw: earliestRaw };
};

export const resolveDeadlineDate = (rate, fallbackPolicies) =>
  resolveDeadlineInfo(rate, fallbackPolicies)?.date || null;

/**
 * Static cut-off times. Suppliers send a date with no time, so the hour is
 * stamped on rather than derived.
 *
 * 02:00 PM is the house convention — every booking page and booking-detail
 * view already prints it, so anything that has to agree with a booking page
 * must use it too. 11:59 PM is the room-list convention for API suppliers.
 */
export const DEADLINE_TIME_2PM = "02:00 PM (UAE)";
export const DEADLINE_TIME_EOD = "11:59 PM (UAE)";

/**
 * Inhouse (apiId 1) free-cancellation deadline: `checkInDate − maxNights`, at
 * local midnight.
 *
 * This is not a guess — it is the rule the backend itself applies when it
 * stores the booking (InhouseHotelBookingService: `checkInDate.minusDays(
 * maxNights).atStartOfDay()`), where maxNights is `MAX(noOfNights)` across the
 * hotel's live cancellation-policy rows — the ones edited at
 * /hotel-actions/{hotelId}/hotel-policy. HotelBookingPage computes it the same
 * way, so room list, booking page, Booking List and voucher all agree.
 *
 * Deliberately NOT the earliest cancellation-policy fromDate: those are
 * derived display rows, and for inhouse they do not reproduce this value.
 */
export const resolveInhouseDeadline = (checkInDate, maxCancellationNights) => {
  if (maxCancellationNights == null) return null;
  const cin = parseSupplierDate(checkInDate);
  if (!cin) return null;
  const deadline = new Date(cin);
  deadline.setDate(deadline.getDate() - Number(maxCancellationNights || 0));
  deadline.setHours(0, 0, 0, 0);
  return deadline;
};

/**
 * Red deadline line for a room-list rate card.
 *
 * Pass `deadline` to render an already-resolved cut-off (inhouse does this,
 * because its deadline comes from the hotel's policy rather than the rate);
 * otherwise it is resolved from the rate as described above.
 *
 * Renders "Non-refundable — no free cancellation" when the rate is
 * non-refundable OR carries no usable date — an empty slot would otherwise
 * read as "we don't know".
 */
export const RateDeadlinePill = ({
  rate,
  fallbackPolicies,
  deadline: deadlineOverride,
  timeLabel = DEADLINE_TIME_EOD,
}) => {
  const info = isNonRefundable(rate?.nonRefundable)
    ? null
    : deadlineOverride
      ? { date: deadlineOverride, source: "hotel policy", raw: "" }
      : resolveDeadlineInfo(rate, fallbackPolicies);

  if (!info?.date) {
    return (
      <span className="text-danger fw-semibold" title="This rate cannot be cancelled free of charge">
        Non-refundable — no free cancellation
      </span>
    );
  }

  const { date, source, raw } = info;
  const label = `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  return (
    <span
      className="text-danger fw-semibold"
      title={`Cancel before this date/time to avoid charges — read from ${source}${raw ? `: ${raw}` : ""}`}
    >
      Deadline Date: {label}, {timeLabel}
    </span>
  );
};

export default RateDeadlinePill;
