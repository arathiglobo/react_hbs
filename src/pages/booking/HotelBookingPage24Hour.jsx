import React from "react";
import HotelBookingPage from "./HotelBookingPage";

/**
 * Dedicated 24-Hour Check-In booking page.
 *
 * Renders the same {@link HotelBookingPage} component as the normal
 * /hotel-booking-page route, but with the `force24Hour` prop set so
 * the post-booking redirect goes to
 * /booking-details/24hr-booking-list instead of
 * /booking-details/hotel-booking-list. This keeps the legacy hotel
 * flow at /hotel-booking-page untouched.
 *
 * /room-list-24hr opens /hotel-booking-page-24hr in a new tab when
 * the operator confirms a rate; everything else (guest details,
 * verification, totals, summary) comes from HotelBookingPage.jsx
 * unchanged.
 */
export default function HotelBookingPage24Hour() {
  return <HotelBookingPage force24Hour />;
}
