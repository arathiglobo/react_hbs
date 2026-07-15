import React from "react";
import HotelBookingPage from "./HotelBookingPage";

/**
 * Dedicated Religious booking page.
 *
 * Renders the same {@link HotelBookingPage} component as the normal
 * /hotel-booking-page route, but with the `religiousMode` prop set so
 * the /api/hotel-booking/create payload includes
 * `isReligiousBooking: true` and the post-booking redirect lands on
 * /booking-details/religious-booking-list instead of the standard
 * hotel booking list. The normal /hotel-booking-page route stays
 * untouched.
 */
export default function HotelBookingPageReligious() {
  return <HotelBookingPage religiousMode />;
}
