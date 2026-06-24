import React from "react";
import HotelBookingList from "./HotelBookingList";

/**
 * Dedicated 24-Hour Check-In booking list page.
 *
 * Renders the same {@link HotelBookingList} component as the standard
 * /booking-details/hotel-booking-list route, but with the
 * `force24HourOnly` prop set so the visible list is post-filtered to
 * bookings where `is24HourCheckin === true`. The standard route stays
 * unchanged (shows every booking, with a small "24H" badge on the
 * flagged rows).
 */
export default function HotelBookingList24Hour() {
  return <HotelBookingList force24HourOnly />;
}
