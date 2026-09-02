import axiosInstance from "../components/AxiosInstance";

/**
 * Supplier-API hotels for the Last Minute flow (/new-booking/last-minute-booking).
 *
 * Last Minute has always been inhouse-only: LastMinuteBookingPage hits
 * /api/last-minute-hotel-search/search, which reads hotel_last_minute_contract_rate
 * and nothing else. This module adds a SECOND, independent source — the same
 * supplier fan-out the normal hotel search uses — so both can be shown together.
 *
 * Deliberately self-contained: it does NOT import from HotelSearch.jsx. That
 * page owns the normal hotel flow and must not be perturbed, so the small
 * amount of post-and-poll logic is duplicated here rather than extracted and
 * shared. The cost is ~40 lines; the benefit is that this feature cannot
 * regress /new-booking/hotel.
 *
 * Everything here is gated by hbs.last-minute.api-hotels.enabled. The backend
 * enforces the same flag at booking time (see BookingFlagStamper), so this is
 * a UX gate, not the security boundary.
 */

/** Prefix that makes an API row's synthetic id impossible to confuse with a DB id. */
const API_ID_PREFIX = "API";

/**
 * Read the server-side kill switch.
 *
 * Fails CLOSED: any error is treated as "disabled", so a backend that is old,
 * down, or returning junk leaves Last Minute in its original inhouse-only
 * state rather than half-enabling a feature.
 *
 * @returns {Promise<boolean>}
 */
export async function fetchApiHotelsEnabled() {
  try {
    const res = await axiosInstance.get("/api/last-minute-hotel-search/api-hotels-enabled");
    return res?.data?.enabled === true;
  } catch (err) {
    console.warn("Last Minute: could not read api-hotels-enabled, treating as disabled.", err);
    return false;
  }
}

/**
 * Build the /api/hotel-search/search payload from the Last Minute page's own
 * search state. Mirrors the field names the fan-out expects.
 *
 * @param {object} ctx
 * @param {number|string} ctx.nationalityId
 * @param {string}        ctx.nationalityCode
 * @param {number|string} ctx.destinationCityId
 * @param {number|string} ctx.destinationCountryId
 * @param {string}        ctx.checkIn   "YYYY-MM-DD"
 * @param {string}        ctx.checkOut  "YYYY-MM-DD"
 * @param {Array}         ctx.rooms     the page's rooms[] state
 * @param {number|string} ctx.agentId
 */
export function buildApiSearchPayload(ctx) {
  const rooms = Array.isArray(ctx.rooms) && ctx.rooms.length ? ctx.rooms : [{ adults: 1, children: 0 }];

  return {
    nationalityId: ctx.nationalityId,
    nationalityCode: ctx.nationalityCode,
    destinationCityId: ctx.destinationCityId,
    destinationCountryId: ctx.destinationCountryId,
    checkIn: ctx.checkIn,
    checkOut: ctx.checkOut,
    noOfRooms: String(rooms.length),
    roomConfigurations: rooms.map((room, index) => ({
      roomNo: index + 1,
      adultCount: String(room.adults || 1),
      childCount: String(room.children || 0),
      childAges: room.childAges?.length ? room.childAges : [0],
      adultAges: room.adultAges?.length ? room.adultAges : [25],
    })),
    agentId: ctx.agentId || 1,
  };
}

/**
 * Map one HotelSearchResult from the fan-out onto the shape
 * LastMinuteBookingPage's result list renders.
 *
 * The two sources have genuinely different identity models, and squashing that
 * difference is what makes the merged list safe to render:
 *
 *   inhouse → hotelId is a real hotel table PK (number)
 *   api     → hotelCode is a supplier-specific string ("12345", "test_hotel")
 *
 * A supplier code can be purely numeric, so an API row must never be given a
 * bare number as its hotelId — downstream code (and React keys) would then be
 * unable to tell it apart from inhouse hotel 12345. Hence the "API-<type>-"
 * prefix, and hence `source` being carried explicitly rather than inferred.
 */
export function mapApiHotelToLastMinuteRow(hotel, searchId) {
  const apiType = String(hotel.apiType || "").toUpperCase();
  const hotelCode = hotel.hotelCode == null ? "" : String(hotel.hotelCode);

  return {
    // ── identity ──
    source: "API",
    apiType,
    hotelCode,
    searchId,
    hotelId: `${API_ID_PREFIX}-${apiType}-${hotelCode}`,

    // ── display fields, matching the inhouse HotelResult shape ──
    hotelName: hotel.hotelName || "Unknown Hotel",
    address: hotel.hotelAddress || "",
    cityName: hotel.cityName || "",
    starRating: hotel.starRating || 0,
    hotelImage: hotel.hotelImage || "",
    categoryName: "",
    fromRate: hotel.baseRate == null ? null : Number(hotel.baseRate),

    // Rooms are fetched on demand by the room-list page via
    // /api/hotelroom/search — the fan-out only returns hotel-level rates.
    rooms: [],

    // No inhouse contract rate exists to compare a supplier rate against, so
    // the "% off" badge is not meaningful for these rows.
    discountPercentage: null,

    latitude: hotel.latitude,
    longitude: hotel.longitude,
    contactNumber: hotel.contactNumber || "",
  };
}

/** True for rows produced by this module. */
export function isApiHotel(hotel) {
  return hotel?.source === "API";
}

/**
 * Run the supplier fan-out and stream results back as they arrive.
 *
 * The fan-out is asynchronous: POST returns a searchId, then results
 * accumulate in Redis as each supplier replies. `onPartial` is invoked on
 * every poll tick so the page can render supplier hotels progressively
 * instead of waiting for the slowest one.
 *
 * Never throws. A supplier-side failure must not take down the inhouse
 * results that are already on screen, so errors are logged and reported via
 * the returned object.
 *
 * @param {object}   payload           from buildApiSearchPayload()
 * @param {function} onPartial         (rows, searchId) => void
 * @param {object}   opts
 * @param {number}   opts.intervalMs   poll cadence   (default 2000)
 * @param {number}   opts.timeoutMs    give-up window (default 20000)
 * @param {number}   opts.initialDelay wait before first poll (default 2000)
 * @returns {Promise<{rows: Array, searchId: string|null, failed: boolean}>}
 */
export async function searchApiHotels(payload, onPartial, opts = {}) {
  const { intervalMs = 2000, timeoutMs = 20000, initialDelay = 2000 } = opts;

  let searchId = null;
  const byId = new Map();

  const snapshot = () => Array.from(byId.values());

  try {
    const startRes = await axiosInstance.post("/api/hotel-search/search", payload);
    searchId = startRes?.data?.searchId || null;
    if (!searchId) {
      console.warn("Last Minute: fan-out returned no searchId; skipping API hotels.");
      return { rows: [], searchId: null, failed: true };
    }

    const params = { agentId: payload.agentId, page: 0, pageSize: 100 };
    const startedAt = Date.now();

    const absorb = (data) => {
      const list = Array.isArray(data?.result) ? data.result : [];
      list.forEach((hotel) => {
        const row = mapApiHotelToLastMinuteRow(hotel, searchId);
        byId.set(row.hotelId, row); // later polls supersede earlier ones
      });
      if (onPartial) onPartial(snapshot(), searchId);
    };

    await new Promise((resolve) => {
      const poll = async () => {
        try {
          const res = await axiosInstance.get(`/api/hotel-search/results/${searchId}`, { params });
          absorb(res.data);

          if (res.data?.finalStatus === "COMPLETED") return resolve();
          if (Date.now() - startedAt >= timeoutMs) {
            console.warn("Last Minute: API hotel poll timed out; showing what arrived.");
            return resolve();
          }
          setTimeout(poll, intervalMs);
        } catch (err) {
          // Resolve rather than reject — partial supplier results are still
          // worth showing next to the inhouse ones.
          console.warn("Last Minute: API hotel poll failed; showing what arrived.", err);
          resolve();
        }
      };
      setTimeout(poll, initialDelay);
    });

    return { rows: snapshot(), searchId, failed: false };
  } catch (err) {
    console.warn("Last Minute: API hotel search failed; inhouse results are unaffected.", err);
    return { rows: snapshot(), searchId, failed: true };
  }
}

/**
 * Supplier apiType → numeric apiId, matching the same table the normal
 * hotel search uses in HotelSearch.jsx (~line 3038). Kept in sync manually
 * because HotelSearch.jsx is the canonical reference for that mapping and
 * touching it is out of scope for this feature — see the "self-contained"
 * note at the top of this file.
 *
 * If a new supplier is added, that supplier's apiId belongs in HotelSearch.jsx
 * FIRST; this map is a mirror.
 */
const API_TYPE_TO_API_ID = {
  JUMEIRAH: 10,
  IWTX: 12,
  X3: 15,
  INHOUSE: 1,
  RATEHAWK: 14,
  DARINA: 16,
  ATHARVA: 3,
  GRN: 20,
};

/**
 * Resolve the numeric apiId for a Last Minute API hotel row.
 * Returns 0 when the supplier is unknown — same sentinel HotelSearch.jsx
 * uses, so downstream code (ApiBookingPageForHotels, hotelroom search) sees
 * the exact behaviour it would for a normal-hotel-search row.
 */
export function apiIdForApiType(apiType) {
  if (!apiType) return 0;
  return API_TYPE_TO_API_ID[String(apiType).toUpperCase()] || 0;
}
