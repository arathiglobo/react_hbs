import React from "react";
import HotelBookingList from "./HotelBookingList";

/**
 * Dedicated Religious booking list page.
 *
 * Renders the same {@link HotelBookingList} component as the standard
 * /booking-details/hotel-booking-list route, but with the
 * `religiousOnly` prop set so the visible list is post-filtered to
 * bookings where `isReligiousBooking === true`. The standard route
 * excludes religious rows (they surface only here) so a booking never
 * appears in two lists at once.
 */
export default function ReligiousBookingList() {
  return <HotelBookingList religiousOnly />;
}
