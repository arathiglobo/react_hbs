import React from "react";
import HotelSearch from "./HotelSearch";

/**
 * Dedicated 24-Hour Check-In hotel search page.
 *
 * Renders the same {@link HotelSearch} component as the normal
 * /new-booking/hotel route, but with the `force24Hour` prop set so
 * the page is permanently in 24-hour mode:
 *   • the legacy in-page toggle is hidden,
 *   • the check-in / check-out time pickers are always visible,
 *   • the post-search probe + per-hotel uplift always run.
 *
 * The normal hotel-booking flow at /new-booking/hotel renders
 * <HotelSearch /> with no prop and therefore stays in its
 * pre-existing normal-flow behaviour — no 24-hour UI, no probe.
 */
export default function HotelSearch24Hour() {
  return <HotelSearch force24Hour />;
}
