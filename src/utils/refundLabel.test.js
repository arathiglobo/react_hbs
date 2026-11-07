import {
  REFUND_FLEXIBLE,
  REFUND_NON_REFUNDABLE,
  REFUND_PARTIAL,
  chargeNowText,
  labelOfRate,
  labelOfStatus,
  refundFilterMatches,
  refundLabelText,
  statusText,
  uaeToday,
  worstLabel,
} from "./refundLabel";

describe("labelOfRate", () => {
  it("reads the backend's answer first", () => {
    expect(labelOfRate({ refundTerms: { label: REFUND_PARTIAL }, nonRefundable: false })).toBe(REFUND_PARTIAL);
  });

  it("falls back to the flag for a rate without the field", () => {
    expect(labelOfRate({ nonRefundable: true })).toBe(REFUND_NON_REFUNDABLE);
    expect(labelOfRate({ nonRefundable: "Y" })).toBe(REFUND_NON_REFUNDABLE);
    expect(labelOfRate({ nonRefundable: false })).toBe(REFUND_FLEXIBLE);
    expect(labelOfRate({})).toBe(REFUND_FLEXIBLE);
  });
});

describe("stored statuses", () => {
  it("print the new words and never change the stored value", () => {
    expect(statusText("Flexi")).toBe("Flexible");
    expect(statusText("Refundable")).toBe("Flexible");
    expect(statusText("Non-Refundable")).toBe("Non Refundable");
    expect(labelOfStatus(null)).toBeNull();
    expect(statusText(null)).toBe("");
  });
});

describe("words", () => {
  it("match the approved labels exactly", () => {
    expect(refundLabelText(REFUND_FLEXIBLE)).toBe("Flexible");
    expect(refundLabelText(REFUND_PARTIAL)).toBe("Flexible - Partial");
    expect(refundLabelText(REFUND_NON_REFUNDABLE)).toBe("Non Refundable");
  });
});

describe("refundFilterMatches", () => {
  it("lets everything through with no box ticked", () => {
    expect(refundFilterMatches({}, REFUND_PARTIAL)).toBe(true);
  });

  it("keeps Partial out of the Flexible box", () => {
    expect(refundFilterMatches({ refundable: true }, REFUND_FLEXIBLE)).toBe(true);
    expect(refundFilterMatches({ refundable: true }, REFUND_PARTIAL)).toBe(false);
    expect(refundFilterMatches({ partial: true }, REFUND_PARTIAL)).toBe(true);
    expect(refundFilterMatches({ nonRefundable: true }, REFUND_FLEXIBLE)).toBe(false);
  });

  it("allows two boxes together", () => {
    const both = { refundable: true, nonRefundable: true };
    expect(refundFilterMatches(both, REFUND_FLEXIBLE)).toBe(true);
    expect(refundFilterMatches(both, REFUND_NON_REFUNDABLE)).toBe(true);
    expect(refundFilterMatches(both, REFUND_PARTIAL)).toBe(false);
  });
});

describe("worstLabel", () => {
  it("takes the worst room", () => {
    expect(worstLabel([REFUND_FLEXIBLE, REFUND_NON_REFUNDABLE])).toBe(REFUND_NON_REFUNDABLE);
    expect(worstLabel([REFUND_FLEXIBLE, REFUND_PARTIAL])).toBe(REFUND_PARTIAL);
    expect(worstLabel([REFUND_FLEXIBLE])).toBe(REFUND_FLEXIBLE);
    expect(worstLabel([])).toBeNull();
  });
});

describe("chargeNowText", () => {
  it("states a partial charge only", () => {
    expect(chargeNowText({ refundTerms: { chargeNowPercent: 50 } })).toBe("Cancelling now costs 50% of the booking");
    expect(chargeNowText({ refundTerms: { chargeNowPercent: 12.5 } })).toBe("Cancelling now costs 12.50% of the booking");
    expect(chargeNowText({ refundTerms: { chargeNowPercent: 100 } })).toBe("");
    expect(chargeNowText({ refundTerms: { chargeNowPercent: 0 } })).toBe("");
    expect(chargeNowText({})).toBe("");
  });
});

describe("uaeToday", () => {
  it("uses the UAE date, not the browser's", () => {
    // 21:30 UTC on 5 Nov is already 01:30 on 6 Nov in the UAE.
    const d = uaeToday(new Date("2026-11-05T21:30:00Z"));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(6);
  });

  it("stays on the same day before midnight in the UAE", () => {
    const d = uaeToday(new Date("2026-11-05T19:30:00Z"));
    expect(d.getDate()).toBe(5);
  });
});
