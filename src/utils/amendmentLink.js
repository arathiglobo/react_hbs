import axiosInstance from "../components/AxiosInstance";

/**
 * Records a newly created booking as an amendment (sub-booking / child) of a
 * primary HOTEL booking via the additive /api/booking-amendment-link feature,
 * and returns the parent hotel booking's numeric id so the caller can redirect
 * to its detail page.
 *
 * This is purely additive: it runs AFTER a booking has already been created
 * through its own unchanged create flow. On any failure it returns null and
 * the caller should fall back to its normal post-create navigation, so the
 * just-created booking is never lost.
 *
 * @param {object} link - {
 *   parentBookingCode, childType, childTypeLabel, childBookingId,
 *   childBookingCode, childDetailRoutePrefix, childReferenceNumber,
 *   childStatus, childHotelName, childCheckInDate, childCheckOutDate,
 *   childTotalRate, childGuestName
 * }
 * @returns {Promise<number|null>} parent hotel booking id, or null on failure.
 */
export async function createAmendmentLink(link) {
  try {
    if (!link || !link.parentBookingCode) return null;
    const { data } = await axiosInstance.post(
      "/api/booking-amendment-link",
      link,
    );
    return data?.parentBookingId ?? null;
  } catch (e) {
    return null;
  }
}
