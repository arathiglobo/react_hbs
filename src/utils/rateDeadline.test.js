import {
  exactTimeLabel,
  formatResolvedDeadline,
  isExactBookingDeadline,
  isExactDeadline,
  isExactDeadlinePassed,
  isResolvedDeadlinePassed,
  packageCutoffDay,
  parseExactUaeTime,
  resolveDeadlineInfo,
  uaeNow,
} from "./rateDeadline";

// RateHawk's deadline: its UTC+0 time converted to the UAE clock by the
// backend, to the minute, no buffer. 2026-12-20T00:00 UTC = 20 Dec 04:00 UAE.
describe("exact RateHawk deadlines", () => {
  test("parses the backend's exact UAE time", () => {
    const d = parseExactUaeTime("2026-12-20T04:00");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(4);
    expect(d.getMinutes()).toBe(0);
    expect(parseExactUaeTime("2026-12-20")).toBeNull();
    expect(parseExactUaeTime(null)).toBeNull();
  });

  test("uaeNow reads the UAE wall clock", () => {
    const now = uaeNow(new Date("2026-12-20T00:00:00Z"));
    expect(now.getDate()).toBe(20);
    expect(now.getHours()).toBe(4);
    expect(now.getMinutes()).toBe(0);
  });

  test("labels and formats the exact time", () => {
    expect(exactTimeLabel("2026-12-20T04:00")).toBe("04:00 AM (UAE)");
    expect(exactTimeLabel("2026-12-20T23:59")).toBe("11:59 PM (UAE)");
    expect(exactTimeLabel("2026-12-20T12:30")).toBe("12:30 PM (UAE)");
    expect(formatResolvedDeadline(parseExactUaeTime("2026-12-20T04:00"))).toBe(
      "20 Dec 2026, 04:00 AM (UAE)",
    );
    // A day deadline keeps the end-of-day wording.
    expect(formatResolvedDeadline(new Date(2026, 11, 19))).toBe("19 Dec 2026, 11:59 PM (UAE)");
  });

  test("a time of day marks an exact deadline, midnight a day deadline", () => {
    expect(isExactDeadline(parseExactUaeTime("2026-12-20T04:00"))).toBe(true);
    expect(isExactDeadline(new Date(2026, 11, 20))).toBe(false);
    expect(isExactDeadline(null)).toBe(false);
  });

  test("passed by the minute", () => {
    expect(isExactDeadlinePassed("2020-01-01T04:00")).toBe(true);
    expect(isExactDeadlinePassed("2099-01-01T04:00")).toBe(false);
    expect(isResolvedDeadlinePassed(parseExactUaeTime("2020-01-01T04:00"))).toBe(true);
    expect(isResolvedDeadlinePassed(new Date(2099, 0, 1))).toBe(false);
  });

  test("room-list rate resolves to the exact time with no buffer", () => {
    const info = resolveDeadlineInfo({
      refundTerms: { label: "FLEXIBLE", cutoff: "2026-12-20", cutoffTime: "2026-12-20T04:00" },
    });
    expect(info.exact).toBe(true);
    expect(info.date.getDate()).toBe(20);
    expect(info.date.getHours()).toBe(4);
  });

  test("other suppliers keep the day", () => {
    const info = resolveDeadlineInfo({ refundTerms: { label: "FLEXIBLE", cutoff: "2026-12-19" } });
    expect(info.exact).toBeUndefined();
    expect(info.date.getHours()).toBe(0);
  });

  test("saved bookings: exact only for RateHawk with a time", () => {
    expect(isExactBookingDeadline("RATEHAWK", "2026-12-20T04:00:00")).toBe(true);
    // Saved before exact deadlines, at 00:00: day rule.
    expect(isExactBookingDeadline("RATEHAWK", "2026-12-19T00:00:00")).toBe(false);
    expect(isExactBookingDeadline("IWTX", "2026-12-20T04:00:00")).toBe(false);
  });

  test("packages save the day before an exact RateHawk time", () => {
    expect(packageCutoffDay({ cutoff: "2026-12-20", cutoffTime: "2026-12-20T04:00" })).toBe("2026-12-19");
    expect(packageCutoffDay({ cutoff: "2026-12-01", cutoffTime: "2026-12-01T09:00" })).toBe("2026-11-30");
    expect(packageCutoffDay({ cutoff: "2026-12-19" })).toBe("2026-12-19");
    expect(packageCutoffDay(null)).toBeNull();
  });
});
