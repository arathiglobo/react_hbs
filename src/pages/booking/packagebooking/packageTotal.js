// Single source of truth for the package-booking "Total Price".
//
// Why this lives in its own module: the Package Details page
// (PackageBooking.jsx) and the Package Checkout page (PackageCheckout.jsx)
// each computed this inline and had drifted apart —
//   • Details sidebar rendered  base + hotel + cab + activity + mealPlan
//   • Details `totalPrice` state used  hotel-replaces-base + mealPlan
//   • Checkout rendered AND billed  base + hotel + cab + activity
//     (the meal plan was silently dropped)
// so the operator saw one number on step 1, a different one on step 2, and a
// third was posted to /book. Both pages now call this helper, so what is
// shown on step 1, what is shown on step 2, and what lands on the /book
// payload are the same figure.
//
// ── Why hotel REPLACES the base rate (it is not an extra charge) ──
// Both numbers come out of the SAME PackageRates rows — see
// PackageBookingServiceImpl on the backend:
//   • the search-card `rate` is resolveBestBaseAdultRate(): the LOWEST
//     *per-adult* rate across the package's hotel rows, + agent markup. It is
//     a "starting from, per adult" headline.
//   • a hotel's `totalRateWithMarkup` is
//     perAdultRate * adultCount + perChildRate * childCount, + agent markup —
//     the very same rate, pax-scaled, for the hotel the operator picked.
// The PackageRates form makes this explicit: one shared "Hotel Rates" per
// adult / per child amount applies to every hotel listed under a category +
// occupancy. So adding the base rate on top of the hotel total charges the
// package twice (for a single-adult booking it is exactly 2x). Until a hotel
// is picked the base rate stands in as the headline; once one is picked its
// pax-scaled total takes over.
//
// Meal plan, cab and activity ARE separate line items (their own rate rows in
// PackageRates / the cab + activity masters) and stack on top.

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * The package's accommodation rate to show before a hotel has been picked.
 *
 * Precedence matters here, and the order is deliberate:
 *
 *  1. `resolvedRate` — the pax-scaled figure the backend returned from
 *     /api/v1/package-booking/hotel-details, i.e.
 *     perAdultRate * adults + perChildRate * children + agent markup. This is
 *     the REAL price of the package for the searched occupancy and is what the
 *     operator is charged. Use it whenever it has arrived.
 *  2. `searchRate` — the search card's "starting from" number, which is only
 *     the LOWEST *per-adult* rate (resolveBestBaseAdultRate on the backend).
 *     For 2 adults + 1 child at 500/adult + 200/child it reads 500, not 1200,
 *     so it is a placeholder for the moment before the rates load, never the
 *     final answer.
 *  3. `packageData?.rate` — last-ditch fallback for a direct visit / hard
 *     refresh. Note /api/packageRates/{id} is keyed by RATE id, not package
 *     id, so this is usually empty on this page; it is kept only so the
 *     sidebar renders something rather than 0.
 */
export const resolvePackageBaseRate = (searchRate, packageData, resolvedRate) => {
  if (num(resolvedRate) > 0) return num(resolvedRate);
  if (num(searchRate) > 0) return num(searchRate);
  return num(packageData?.rate);
};

/**
 * Breakdown + grand total for a package booking.
 *
 * @param {object} selections  bookingData.selections — hotelPrice,
 *                             mealPlanPrice, cabPrice, activityPrice.
 * @param {number} baseRate    from resolvePackageBaseRate().
 * @returns {{accommodation:number, hotelSelected:boolean, mealPlan:number,
 *            cab:number, activity:number, total:number}}
 */
export const computePackageTotal = (selections, baseRate) => {
  const hotel = num(selections?.hotelPrice);
  const mealPlan = num(selections?.mealPlanPrice);
  const cab = num(selections?.cabPrice);
  const activity = num(selections?.activityPrice);

  // Hotel replaces the base "from" rate — see the note at the top of the file.
  const hotelSelected = hotel > 0;
  const accommodation = hotelSelected ? hotel : num(baseRate);

  return {
    accommodation,
    hotelSelected,
    mealPlan,
    cab,
    activity,
    total: accommodation + mealPlan + cab + activity,
  };
};

/** AED display formatting shared by both sidebars. */
export const formatPackageAmount = (value) =>
  num(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
