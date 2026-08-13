// Centralized feature flags for optional/experimental UI features. Flip a
// flag to false to disable that feature app-wide without touching the
// components that consume it.

// Controls the "Explore on Map" hotel-location preview (HotelSearch.jsx +
// components/map/MapModal). When false, the trigger button is hidden and
// no map code runs.
export const ENABLE_MAP_PREVIEW = true;

// Defaults for backend-driven feature flags. Used before the boot fetch of
// /api/config/features resolves, and as the fallback when that endpoint is
// missing (old backends that don't ship the config controller). Keep every
// entry defaulted to the "safe / old" behavior so a missing endpoint never
// exposes an unfinished feature.
//
//   rateCalendarEnabled — new backend ships RateCalendarController and the
//   /api/hotel-search/rate-calendar family of endpoints. When true the
//   date fields render the fare-hint <RateCalendar>; when false they
//   render the pre-existing plain <Form.Control type="date">.
export const DEFAULT_FEATURE_FLAGS = {
  rateCalendarEnabled: false,
};
