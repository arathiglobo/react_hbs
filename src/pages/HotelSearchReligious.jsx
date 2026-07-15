import React from "react";
import HotelSearch from "./HotelSearch";

/**
 * Dedicated Religious hotel-search page.
 *
 * Renders the same {@link HotelSearch} component as the normal
 * /new-booking/hotel route, but with the `religiousMode` prop set so
 * the destination picker is locked to Mecca + Medina, the page heading
 * gets a "Religious" badge, and the downstream navigation targets
 * /religious-room-list → /religious-booking-page →
 * /booking-details/religious-booking-list. The normal /new-booking/hotel
 * route stays untouched (renders <HotelSearch /> with no prop).
 */
export default function HotelSearchReligious() {
  return <HotelSearch religiousMode />;
}
