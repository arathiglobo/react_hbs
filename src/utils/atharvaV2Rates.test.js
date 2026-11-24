import {
  buildRateCheckRequest,
  fitsCombination,
  fitsSlot,
  isAtharvaV2,
  pickConflict,
  toSelectedRates,
} from "./atharvaV2Rates";

// Two-room search, one fixed offer (spec 5.1 sample shape): Options "1,11" and "2,12".
const offer = { hKey: "H1", tokenId: "T1", comboFixed: true, comboOptions: ["1,11", "2,12"] };
const r1a = { ...offer, rateKey: "K1", roomSrNo: 1, comboIndex: 1, totalRate: 100 };
const r1b = { ...offer, rateKey: "K2", roomSrNo: 1, comboIndex: 2, totalRate: 120 };
const r2a = { ...offer, rateKey: "K11", roomSrNo: 2, comboIndex: 11, totalRate: 90 };
const r2b = { ...offer, rateKey: "K12", roomSrNo: 2, comboIndex: 12, totalRate: 95 };
const otherOffer = { hKey: "H2", tokenId: "T1", comboFixed: false, comboOptions: [], rateKey: "X", roomSrNo: 2, comboIndex: 5 };

const picks = (...rates) => rates.map((selectedRate) => ({ selectedRate }));

describe("ATHARVA_V2 room-list rules", () => {
  test("apiId 22 only", () => {
    expect(isAtharvaV2(22)).toBe(true);
    expect(isAtharvaV2("22")).toBe(true);
    expect(isAtharvaV2(3)).toBe(false);
  });

  test("a rate shows only under its own room in a multi-room search", () => {
    expect(fitsSlot(r1a, 0, true)).toBe(true);
    expect(fitsSlot(r1a, 1, true)).toBe(false);
    expect(fitsSlot(r1a, 1, false)).toBe(true);
  });

  test("fixed offer: only listed combinations", () => {
    const rooms = picks(r1a, null);
    expect(fitsCombination(r2a, 1, rooms, true)).toBe(true);
    expect(fitsCombination(r2b, 1, rooms, true)).toBe(false);
  });

  test("rooms must come from the same offer", () => {
    const rooms = picks(r1a, null);
    expect(fitsCombination(otherOffer, 1, rooms, true)).toBe(false);
    expect(pickConflict(otherOffer, 1, rooms, true)).toMatch(/same rate group/);
  });

  test("display filter looks at earlier rooms only", () => {
    const rooms = picks(null, r2a);
    expect(fitsCombination(r1b, 0, rooms, true, true)).toBe(true);
    expect(fitsCombination(r1b, 0, rooms, true)).toBe(false);
  });

  test("rate-check body carries the search keys and occupancy in room order", () => {
    const body = buildRateCheckRequest([r1a, r2a], {
      hotelCode: "DXB9891052",
      checkInDate: "2026-10-27",
      checkOutDate: "2026-10-28",
      nationality: "IN",
      agentId: 7,
      rooms: [
        { adults: 1, children: 1, childAges: [5] },
        { adults: 1, children: 2, childAges: [4, 6] },
      ],
    });
    expect(body).toMatchObject({
      hotelCode: "DXB9891052",
      tokenId: "T1",
      hKey: "H1",
      agentId: "7",
      currentTotalRate: 190,
    });
    expect(body.rooms).toEqual([
      { roomSrNo: 1, adults: 1, children: 1, childAges: [5], rateKey: "K1" },
      { roomSrNo: 2, adults: 1, children: 2, childAges: [4, 6], rateKey: "K11" },
    ]);
  });

  test("selected rates take the checked prices and carry the booking details, not the old Atharva keys", () => {
    const check = {
      success: true,
      priceChanged: true,
      bookingKey: "BK",
      bookingTokenId: "PT",
      supplierAmount: 52.5,
      supplierCurrency: "USD",
      deadlineDate: "2026-09-11",
      nationalityId: 1,
      nonRefundable: false,
      rooms: [
        { rate: 101.5, rateWithoutMarkup: 96.1 },
        { rate: 91.25, rateWithoutMarkup: 86.4 },
      ],
      cancellationPolicies: [{ policyText: "From 12 Sep 2026: charge" }],
    };
    const out = toSelectedRates([r1a, r2a], check, [{ atharvaRateKey: "K1" }, {}], "DXB9891052");
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      rate: 101.5,
      rateWithoutMarkup: 96.1,
      rateKey: "K1",
      deadlineDate: "2026-09-11",
      atharvaRateKey: null,
      atharvaV2PriceChanged: true,
    });
    expect(out[0].atharvaV2).toMatchObject({
      bookingKey: "BK",
      bookingTokenId: "PT",
      searchTokenId: "T1",
      hKey: "H1",
      hotelCode: "DXB9891052",
    });
    expect(out[1].rate).toBe(91.25);
  });
});
