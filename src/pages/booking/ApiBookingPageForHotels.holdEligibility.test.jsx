import { HOLD_CAPABLE_API_IDS, isHoldEligible } from "./ApiBookingPageForHotels";
import { REFUND_FLEXIBLE } from "../../utils/refundLabel";

jest.mock("../../components/AxiosInstance", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("../../components/Sidebar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/TopBar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/AgentBalanceDisplay", () => ({ __esModule: true, default: () => null }));
jest.mock("react-hot-toast", () => {
  const toast = Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() });
  return { __esModule: true, default: toast, toast };
});

const iso = (daysFromToday) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
};

// The backend decides the refund label and its last free day (refundTerms);
// the page reads that before anything else.
const refundableRate = (cutoffDaysFromToday) => ({
  rate: 500,
  nonRefundable: false,
  refundTerms: { label: REFUND_FLEXIBLE, cutoff: iso(cutoffDaysFromToday) },
});

const booking = (apiId, rates) => ({ payload: { apiId }, selectedRate: rates });

const SUPPLIERS = [
  ["GRN", 20],
  ["IWTX", 12],
  ["GoGlobal", 21],
  ["X3", 15],
  ["Darina", 16],
];

describe("Hold Room and Pay Later on the supplier booking page", () => {
  test.each(SUPPLIERS)("%s is offered the hold on a refundable rate inside its free window", (_name, apiId) => {
    expect(HOLD_CAPABLE_API_IDS.has(apiId)).toBe(true);
    expect(isHoldEligible(booking(apiId, [refundableRate(10)]))).toBe(true);
  });

  test("a supplier id sent as text still counts", () => {
    expect(isHoldEligible(booking("15", [refundableRate(10)]))).toBe(true);
    expect(isHoldEligible(booking("16", [refundableRate(10)]))).toBe(true);
  });

  test.each([
    ["RateHawk", 14],
    ["Jumeirah", 10],
    ["Juniper", 17],
    ["Atharva, which has its own picker", 3],
  ])("%s is not offered this hold", (_name, apiId) => {
    expect(isHoldEligible(booking(apiId, [refundableRate(10)]))).toBe(false);
  });

  test.each(SUPPLIERS)("%s is not offered the hold once the free window has passed", (_name, apiId) => {
    expect(isHoldEligible(booking(apiId, [refundableRate(-2)]))).toBe(false);
  });

  test.each(SUPPLIERS)("%s is not offered the hold when any room is non-refundable", (_name, apiId) => {
    const nonRefundable = { rate: 500, nonRefundable: true };
    expect(isHoldEligible(booking(apiId, [refundableRate(10), nonRefundable]))).toBe(false);
  });

  test("a rate with no free-cancellation date is not offered the hold", () => {
    expect(isHoldEligible(booking(15, [{ rate: 500, nonRefundable: false }]))).toBe(false);
  });
});
