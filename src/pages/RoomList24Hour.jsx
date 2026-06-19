import React from "react";
import RoomList from "./RoomList";

/**
 * Dedicated 24-Hour Check-In room list page.
 *
 * Renders the same {@link RoomList} component as the normal
 * /room-list route, but with the `force24Hour` prop set so the
 * downstream Book Now / Confirm Booking buttons navigate to the
 * dedicated /hotel-booking-page-24hr instead of /hotel-booking-page.
 * This keeps the legacy hotel flow at /room-list untouched.
 *
 * The /new-booking/hotel-24hr search page opens /room-list-24hr in a
 * new tab when the operator clicks View Rooms; everything else about
 * the listing UI — filters, view modes, multi-room selection, agent
 * balance — comes from RoomList.jsx unchanged.
 */
export default function RoomList24Hour() {
  return <RoomList force24Hour />;
}
