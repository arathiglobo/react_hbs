import {
  alignFirstChargeBand,
  chargesFromLine,
  chargesFromText,
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

// The "Hotel Policies & Terms" popup says when cancellation charges begin,
// from the same deadline the booking page shows.
describe("policy popup: when cancellation charges begin", () => {
  test("a day deadline charges from the next day", () => {
    expect(chargesFromLine(new Date(2027, 5, 8))).toBe(
      "From 9th Jun 2027, cancellation charges will be applied",
    );
    expect(chargesFromText(new Date(2026, 11, 31))).toBe("1st Jan 2027");
    expect(chargesFromText(new Date(2027, 1, 28))).toBe("1st Mar 2027");
  });

  test("the supplier example: free until 09 Jun → deadline 8 Jun → charges from 9th Jun", () => {
    const info = resolveDeadlineInfo({ deadlineDate: "2027-06-09" });
    expect(chargesFromLine(info.date)).toBe(
      "From 9th Jun 2027, cancellation charges will be applied",
    );
  });

  test("ordinal suffixes", () => {
    expect(chargesFromText(new Date(2027, 5, 1))).toBe("2nd Jun 2027");
    expect(chargesFromText(new Date(2027, 5, 2))).toBe("3rd Jun 2027");
    expect(chargesFromText(new Date(2027, 5, 3))).toBe("4th Jun 2027");
    expect(chargesFromText(new Date(2027, 5, 10))).toBe("11th Jun 2027");
    expect(chargesFromText(new Date(2027, 5, 11))).toBe("12th Jun 2027");
    expect(chargesFromText(new Date(2027, 5, 12))).toBe("13th Jun 2027");
    expect(chargesFromText(new Date(2027, 5, 20))).toBe("21st Jun 2027");
    expect(chargesFromText(new Date(2027, 5, 21))).toBe("22nd Jun 2027");
    expect(chargesFromText(new Date(2027, 5, 22))).toBe("23rd Jun 2027");
    expect(chargesFromText(new Date(2027, 4, 30))).toBe("31st May 2027");
  });

  test("an exact RateHawk deadline charges from that moment", () => {
    expect(chargesFromLine(parseExactUaeTime("2026-12-20T04:00"))).toBe(
      "From 20th Dec 2026, 04:00 AM (UAE), cancellation charges will be applied",
    );
  });

  test("no deadline, no line", () => {
    expect(chargesFromLine(null)).toBeNull();
    expect(chargesFromLine(new Date("not a date"))).toBeNull();
  });
});

// The popup's first charge band starts on the day charges begin, so it reads
// the same date as the "From …, cancellation charges will be applied" line.
describe("policy popup: first charge band starts when charges begin", () => {
  const deadline = new Date(2027, 5, 4); // page shows 04 Jun → charges from 5th Jun

  test("Atharva V2: the reported example", () => {
    const rows = [
      {
        fromDate: "2027-06-06",
        toDate: "2027-06-15",
        value: 8759.46,
        policyText:
          "From 06 Jun 2027 to 15 Jun 2027: cancellation charge AED 8759.46 (100% of the booking amount).",
      },
    ];
    const [band] = alignFirstChargeBand(rows, deadline);
    expect(band.policyText).toBe(
      "From 05 Jun 2027 to 15 Jun 2027: cancellation charge AED 8759.46 (100% of the booking amount).",
    );
    expect(band.fromDate).toBe("2027-06-05");
    expect(band.toDate).toBe("2027-06-15");
    expect(rows[0].fromDate).toBe("2027-06-06"); // the rate itself is not changed
  });

  test("only the earliest band moves; later bands keep their dates", () => {
    const rows = [
      { fromDate: "2027-06-06", toDate: "2027-06-10", value: 50, policyText: "From 06 Jun 2027 to 10 Jun 2027: cancellation charge AED 50 (50% of the booking amount)." },
      { fromDate: "2027-06-11", toDate: "2027-06-15", value: 100, policyText: "From 11 Jun 2027 to 15 Jun 2027: cancellation charge AED 100 (100% of the booking amount)." },
    ];
    const out = alignFirstChargeBand(rows, deadline);
    expect(out[0].policyText.startsWith("From 05 Jun 2027 to 10 Jun 2027")).toBe(true);
    expect(out[1]).toBe(rows[1]);
  });

  test("IWTX / X3 text generator shape", () => {
    const [band] = alignFirstChargeBand(
      [{ fromDate: "2027-06-06", toDate: "2027-06-15", value: 100, policyText: "Cancellation from Jun 06, 2027 - Jun 15, 2027 will be charged 100%" }],
      deadline,
    );
    expect(band.policyText).toBe("Cancellation from Jun 05, 2027 - Jun 15, 2027 will be charged 100%");
    expect(band.fromDate).toBe("2027-06-05");
  });

  test("GRN window shape keeps its time and zone", () => {
    const [band] = alignFirstChargeBand(
      [{ fromDate: "2027-06-06T00:00:00", value: 100, policyText: "From 06 Jun 2027, 12:00 AM IST to 15 Jun 2027, 12:00 AM IST: 100% of the booking amount will be charged." }],
      deadline,
    );
    expect(band.policyText).toBe(
      "From 05 Jun 2027, 12:00 AM IST to 15 Jun 2027, 12:00 AM IST: 100% of the booking amount will be charged.",
    );
    expect(band.fromDate).toBe("2027-06-05T00:00:00");
  });

  test("raw day-first supplier dates (Atharva / GoGlobal)", () => {
    const [band] = alignFirstChargeBand(
      [{ fromDate: "06/06/2027", value: 100, policyText: "From 06/06/2027: penalty 100% of booking" }],
      deadline,
    );
    expect(band.policyText).toBe("From 05/06/2027: penalty 100% of booking");
    expect(band.fromDate).toBe("05/06/2027");
  });

  test("month rollover", () => {
    const [band] = alignFirstChargeBand(
      [{ fromDate: "2027-07-02", value: 100, policyText: "From 02 Jul 2027 to 05 Jul 2027: cancellation charge AED 10 (100% of the booking amount)." }],
      new Date(2027, 5, 30),
    );
    expect(band.policyText.startsWith("From 01 Jul 2027 to 05 Jul 2027")).toBe(true);
  });

  test("left as sent: already aligned, exact RateHawk deadline, amendment rows, free rows", () => {
    const aligned = [{ fromDate: "2027-06-05", value: 100, policyText: "If cancelled within 240 hours of check-in (2027-06-05 onwards): 100% of total." }];
    expect(alignFirstChargeBand(aligned, deadline)).toEqual(aligned);
    const rh = [{ fromDate: "2026-12-21T04:00:00", value: 100, policyText: "Cancellation charge: 100.00 AED if cancelled during this window." }];
    expect(alignFirstChargeBand(rh, parseExactUaeTime("2026-12-20T04:00"))).toEqual(rh);
    const amendment = [{ fromDate: "2027-06-06", toDate: "2027-06-15", value: 20, policyText: "From 2027-06-06 to 2027-06-15: Cancellation charge USD 20 (Amendment policy)" }];
    expect(alignFirstChargeBand(amendment, deadline)).toEqual(amendment);
    const free = [{ fromDate: "2027-06-06", value: 0, policyText: "Free cancellation during this window." }];
    expect(alignFirstChargeBand(free, deadline)).toEqual(free);
  });

  test("a date the text names in an unknown shape leaves the row as sent", () => {
    const rows = [{ fromDate: "2027-06-06", value: 100, policyText: "Charges from 2027/06/06 onwards" }];
    expect(alignFirstChargeBand(rows, deadline)).toEqual(rows);
  });

  test("no deadline, nothing moves", () => {
    const rows = [{ fromDate: "2027-06-06", value: 100, policyText: "From 06 Jun 2027: 100%" }];
    expect(alignFirstChargeBand(rows, null)).toEqual(rows);
  });
});
