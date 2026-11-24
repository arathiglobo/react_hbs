/**
 * ATHARVA_V2 (Atharva XConnect Hotel Service API, apiId 22) room-list rules
 * and rate check. Kept apart from the old Atharva (apiId 3) code on purpose:
 * nothing here reads or writes the Atharva prebook carriers.
 *
 * How the supplier's rates work (spec 5.1):
 *   - every rate is the price of ONE room (`roomSrNo`, 1-based) for the stay;
 *   - rates are grouped in vendor offers (`hKey`); all rooms of one booking
 *     must come from the same offer;
 *   - when the offer's `comboFixed` (FixedOption) is true, only the room
 *     combinations listed in `comboOptions` (Options, e.g. "1,11" — one rate
 *     `comboIndex` per room, in room order) can be booked.
 *
 * Before the booking page the selected rates go through
 * POST /api/hotel-booking/rate-check/22 (ratedetails + pricecheck), which
 * returns the price that will be honoured and the BookingKey the booking needs.
 */

export const ATHARVA_V2_API_ID = 22;

export const isAtharvaV2 = (apiId) => Number(apiId) === ATHARVA_V2_API_ID;

/** In a multi-room search a rate is shown only under its own room. */
export const fitsSlot = (rate, slotIndex, isMultiRoom) =>
  !isMultiRoom || rate?.roomSrNo == null || Number(rate.roomSrNo) === slotIndex + 1;

/**
 * May `rate` be picked for room `slotIndex`, given what the other rooms
 * already hold? Same offer (hKey) as the other picks and, for a fixed offer,
 * part of an allowed combination with them.
 *
 * `earlierOnly` compares with the rooms before `slotIndex` only — the room
 * list's display filter, so room 1 always shows all its rates (as the old
 * Atharva room list does). The click check compares with every other room.
 */
export const fitsCombination = (rate, slotIndex, selectedRooms, isMultiRoom, earlierOnly = false) => {
  if (!isMultiRoom) return true;
  const rooms = Array.isArray(selectedRooms) ? selectedRooms : [];
  const others = rooms.map((r, i) =>
    i === slotIndex || (earlierOnly && i > slotIndex) ? null : r?.selectedRate || null,
  );
  const otherPick = others.find(Boolean);
  if (otherPick?.hKey && rate?.hKey && otherPick.hKey !== rate.hKey) return false;
  if (
    rate?.comboFixed !== true ||
    !Array.isArray(rate?.comboOptions) ||
    rate.comboOptions.length === 0 ||
    rate?.comboIndex == null
  ) {
    return true;
  }
  return rate.comboOptions.some((option) => {
    const parts = String(option)
      .split(",")
      .map((p) => Number(String(p).trim()));
    if (parts.length !== rooms.length) return false;
    if (parts[slotIndex] !== Number(rate.comboIndex)) return false;
    return others.every(
      (o, i) => !o || o.comboIndex == null || parts[i] === Number(o.comboIndex),
    );
  });
};

/** Why `rate` cannot be added to the current picks, or null when it can. */
export const pickConflict = (rate, slotIndex, selectedRooms, isMultiRoom) => {
  if (fitsCombination(rate, slotIndex, selectedRooms, isMultiRoom)) return null;
  return "All rooms of one booking must come from the same rate group, in a combination the supplier allows. Clear the other room's selection first, or pick a rate from the same group.";
};

const sum = (rates, key) =>
  rates.reduce((total, r) => total + (Number(r?.[key]) || 0), 0);

/** Body of POST /api/hotel-booking/rate-check/22 for the picked rates (room order). */
export const buildRateCheckRequest = (rates, payload) => {
  const searchRooms = Array.isArray(payload?.rooms) ? payload.rooms : [];
  const first = rates[0] || {};
  return {
    hotelCode: payload?.hotelCode || null,
    checkInDate: payload?.checkInDate || null,
    checkOutDate: payload?.checkOutDate || null,
    nationality: payload?.nationality || null,
    agentId: payload?.agentId != null ? String(payload.agentId) : null,
    tokenId: first.tokenId || null,
    hKey: first.hKey || null,
    currentTotalRate: Math.round(sum(rates, "totalRate") * 100) / 100,
    rooms: rates.map((rate, i) => {
      const room = searchRooms[i] || {};
      return {
        roomSrNo: rate?.roomSrNo != null ? Number(rate.roomSrNo) : i + 1,
        adults: room.adults != null ? Number(room.adults) : null,
        children: room.children != null ? Number(room.children) : 0,
        childAges: Array.isArray(room.childAges) ? room.childAges : [],
        rateKey: rate?.rateKey || null,
      };
    }),
  };
};

/** Runs the rate check; never throws. */
export const fetchRateCheck = async (axiosInstance, body) => {
  try {
    const resp = await axiosInstance.post("/api/hotel-booking/rate-check/22", body);
    return resp?.data || { success: false, message: "Empty response" };
  } catch (err) {
    return {
      success: false,
      message:
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Rate check failed",
    };
  }
};

/**
 * The booking page's selectedRate entries: the room-list mapping of each
 * picked rate, re-priced with the rate check's per-room amounts, plus the
 * `atharvaV2` details the create call sends back. The old Atharva carriers
 * are cleared so they can never reach this supplier's booking.
 */
export const toSelectedRates = (rates, check, mapped, hotelCode) => {
  const details = {
    bookingKey: check.bookingKey || null,
    bookingTokenId: check.bookingTokenId || null,
    bookingKeyExpiry: check.bookingKeyExpiry || null,
    supplierAmount: check.supplierAmount ?? null,
    supplierCurrency: check.supplierCurrency || null,
    withinTimeLimit: check.withinTimeLimit ?? null,
    deadlineDate: check.deadlineDate || null,
    nationalityId: check.nationalityId ?? null,
    searchTokenId: rates[0]?.tokenId || null,
    hKey: rates[0]?.hKey || null,
    hotelCode: hotelCode || null,
  };
  const checkRooms = Array.isArray(check.rooms) ? check.rooms : [];
  return rates.map((rate, i) => {
    const base = mapped[i] || {};
    const priced = checkRooms[i] || {};
    const total = priced.rate != null ? Number(priced.rate) : Number(rate?.totalRate || 0);
    const totalNoMarkup =
      priced.rateWithoutMarkup != null
        ? Number(priced.rateWithoutMarkup)
        : Number(rate?.totalRateWithoutMarkup ?? total);
    return {
      ...base,
      hotelCode: hotelCode || base.hotelCode,
      roomCategory: priced.roomCategory || base.roomCategory,
      mealPlan: priced.mealPlan || base.mealPlan,
      mealPlanCode: priced.mealPlanCode || base.mealPlanCode,
      nonRefundable: check.nonRefundable || base.nonRefundable === true || base.nonRefundable === "Y" ? "Y" : "N",
      rate: total,
      rateWithoutMarkup: totalNoMarkup,
      roomRateBasedOnRoomCount: total,
      roomRateBasedOnRoomCount_WithoutMarkup: totalNoMarkup,
      currency: "AED",
      cancellationPolicy:
        Array.isArray(check.cancellationPolicies) && check.cancellationPolicies.length
          ? check.cancellationPolicies
          : base.cancellationPolicy || [],
      deadlineDate: check.deadlineDate || base.deadlineDate || null,
      rateKey: rate?.rateKey || base.rateKey || null,
      // Old Atharva (apiId 3) carriers — never used by this supplier.
      atharvaRateKey: null,
      atharvaHKey: null,
      atharvaTokenId: null,
      atharvaSearchRateKey: null,
      atharvaSearchHKey: null,
      atharvaSearchTokenId: null,
      atharvaPrebooked: null,
      atharvaDisplayDeadlineDate: null,
      atharvaExpectedAmount: null,
      atharvaWithinTimeLimit: null,
      atharvaPackageRate: null,
      atharvaV2: details,
      atharvaV2PriceChanged: !!check.priceChanged,
      atharvaV2PreviousTotalRate: check.previousTotalRate ?? null,
      atharvaV2Remarks: check.remarks || null,
    };
  });
};

/** Message for a failed rate check. */
export const rateCheckFailureMessage = (check) =>
  check?.available === false
    ? "This rate is no longer available. Please search again."
    : check?.message || "The rate could not be checked. Please try again or select another rate.";
