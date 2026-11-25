import React from "react";

/**
 * Phone line shown under a hotel name on the Manual Review lists. The number
 * is printed exactly as the backend sends it: our hotel's telephone from its
 * contact details, or the number the supplier itself sent. Without a number,
 * the backend's reason (e.g. "GRN does not provide hotel phone numbers") is
 * shown in small letters.
 */
export default function HotelPhoneLine({ phone, note }) {
  return (
    <div className="ahm-hotel-phone">
      <i className="fas fa-phone" aria-hidden="true"></i>
      <span className="visually-hidden">Phone: </span>
      {phone ? <span>{phone}</span> : <span className="ahm-hotel-phone-note">{note || "No phone listed"}</span>}
    </div>
  );
}
