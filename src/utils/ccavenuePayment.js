import toast from "react-hot-toast";
import axiosInstance from "../components/AxiosInstance";
import { orderIdPathSegment } from "./urlSafety";

// What a page may do with a CC Avenue payment it just came back from.
// Only PAID may go on to the finalize call.
export const CCAVENUE_OUTCOME = Object.freeze({
  PAID: "paid",
  NOT_PAID: "not-paid",
  // Bank / CC Avenue said paid, but CC Avenue's status API has not
  // confirmed it within the wait below. Never "try again" here: the
  // customer would pay twice.
  STILL_VERIFYING: "still-verifying",
  // The status could not be read at all (network, 403, 404).
  UNVERIFIED: "unverified",
});

// The backend asks CC Avenue's status API again at most every
// ccavenue.api.status-poll-min-interval-seconds (10 s), so polling /status
// faster than that only returns the same answer.
const POLL_INTERVAL_MS = 10000;
// How long the page keeps waiting for CC Avenue to confirm a payment
// before handing the customer over to support.
const MAX_WAIT_MS = 120000;

const VERIFYING_FALLBACK =
  "Your payment is being verified with CC Avenue. Do not pay again — the booking is completed as soon as CC Avenue confirms the payment.";
const COULD_NOT_VERIFY =
  "Could not verify payment status. Please contact support if you were charged.";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const NOT_COMPLETED = "Payment was not completed. Please try again.";

/**
 * The redirect said "failed". Asks /status once (no waiting) so the
 * customer sees the backend's reason — e.g. "CC Avenue reports the order
 * as Aborted." or an amount mismatch held for manual review, where money
 * WAS taken and "try again" would make them pay twice — instead of a bare
 * "Payment was not completed". A row that is still being verified, an
 * unknown order or no answer keep that old message.
 */
async function reportFailedReturn(orderId) {
  let data = null;
  try {
    const response = await axiosInstance.get(
      `/api/payment/ccavenue/status/${orderIdPathSegment(orderId)}`,
    );
    data = response?.data || null;
  } catch (err) {
    console.error("Could not read CC Avenue payment status:", err);
  }
  if (data?.status === "SUCCESS") {
    // A finished payment re-shown as failed: the finalize call re-checks
    // it with CC Avenue and is idempotent, so letting it run is safe.
    return CCAVENUE_OUTCOME.PAID;
  }
  const reason =
    data && !data.verificationPending ? data.statusMessage : null;
  toast.error(reason || NOT_COMPLETED);
  return CCAVENUE_OUTCOME.NOT_PAID;
}

const stillVerifyingMessage = (orderId) =>
  `CC Avenue has not confirmed your payment yet (order ${orderId}). Do not pay again — please contact support with this order number so the booking can be completed once CC Avenue confirms it.`;

/**
 * Decides, after CC Avenue sends the browser back, whether the payment may
 * be finalized, and tells the customer what is happening.
 *
 * The backend's redirect carries ccavenueStatus:
 *   "success"   — paid and confirmed by CC Avenue's status API;
 *   "verifying" — the bank's result said paid, but CC Avenue's status API
 *                 has not confirmed it yet (it may say "Awaited" for a
 *                 moment, or be unreachable);
 *   "failed"    — not paid / not accepted (one /status read for the
 *                 reason to show; see reportFailedReturn).
 *
 * "success" and "verifying" are both checked against
 * GET /api/payment/ccavenue/status/{orderId}. While that answers
 * verificationPending=true the page waits (a loading toast with the
 * backend's message) and asks again every 10 s, up to 2 minutes; each ask
 * makes the backend re-check with CC Avenue. Before this, "verifying" was
 * shown as "Payment was not completed", so payments CC Avenue confirmed a
 * moment later were never booked.
 *
 * Waiting stops early if the user leaves the page (another path).
 *
 * @param {string} orderId        ccavenueOrderId from the return URL
 * @param {string} gatewayStatus  ccavenueStatus from the return URL
 * @returns {Promise<string>} one of CCAVENUE_OUTCOME; error toasts for
 *          every outcome but PAID are already shown.
 */
export async function confirmCCAvenuePayment(orderId, gatewayStatus) {
  if (gatewayStatus !== "success" && gatewayStatus !== "verifying") {
    return reportFailedReturn(orderId);
  }

  let statusPath;
  try {
    statusPath = `/api/payment/ccavenue/status/${orderIdPathSegment(orderId)}`;
  } catch (err) {
    console.error("Could not verify CC Avenue payment status:", err);
    toast.error(COULD_NOT_VERIFY);
    return CCAVENUE_OUTCOME.UNVERIFIED;
  }

  const waitToastId = `ccavenue-verifying-${orderId}`;
  const startPath = window.location.pathname;
  const deadline = Date.now() + MAX_WAIT_MS;
  let waiting = false;

  try {
    for (;;) {
      let data = null;
      try {
        const response = await axiosInstance.get(statusPath);
        data = response?.data || {};
      } catch (err) {
        console.error("Could not verify CC Avenue payment status:", err);
        // Before any "being verified" answer this is the old behaviour;
        // once waiting, a single failed poll is retried next round.
        if (!waiting) {
          toast.error(COULD_NOT_VERIFY);
          return CCAVENUE_OUTCOME.UNVERIFIED;
        }
      }

      if (data) {
        if (data.status === "SUCCESS") {
          return CCAVENUE_OUTCOME.PAID;
        }
        if (!data.verificationPending) {
          toast.error(
            data.statusMessage ||
              "Payment was not successful. Please try again.",
          );
          return CCAVENUE_OUTCOME.NOT_PAID;
        }
        waiting = true;
        // Explicit duration: the app's <Toaster> sets 1 s for every toast
        // type, which would hide a loading toast almost at once.
        toast.loading(data.statusMessage || VERIFYING_FALLBACK, {
          id: waitToastId,
          duration: Infinity,
        });
      }

      if (
        Date.now() + POLL_INTERVAL_MS > deadline ||
        window.location.pathname !== startPath
      ) {
        toast.error(stillVerifyingMessage(orderId), { duration: 20000 });
        return CCAVENUE_OUTCOME.STILL_VERIFYING;
      }
      await sleep(POLL_INTERVAL_MS);
      if (window.location.pathname !== startPath) {
        toast.error(stillVerifyingMessage(orderId), { duration: 20000 });
        return CCAVENUE_OUTCOME.STILL_VERIFYING;
      }
    }
  } finally {
    toast.dismiss(waitToastId);
  }
}
