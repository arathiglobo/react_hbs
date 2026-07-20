import React from "react";
import RoomList from "./RoomList";

/**
 * Dedicated Religious room-list page.
 *
 * Renders the same {@link RoomList} component as the normal /room-list
 * route, but with the `religiousMode` prop set so the per-rate Book Now
 * / Confirm Booking actions navigate to /religious-booking-page instead
 * of /hotel-booking-page, and the persisted `bookingData` carries
 * `isReligiousBooking: true` for the downstream create payload.
 */
export default function RoomListReligious() {
  return <RoomList religiousMode />;
}
