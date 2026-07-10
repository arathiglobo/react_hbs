// Centralized feature flags for optional/experimental UI features. Flip a
// flag to false to disable that feature app-wide without touching the
// components that consume it.

// Controls the "Explore on Map" hotel-location preview (HotelSearch.jsx +
// components/map/MapModal). When false, the trigger button is hidden and
// no map code runs.
export const ENABLE_MAP_PREVIEW = true;
