import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Container, Card, Button, Spinner, Alert } from "react-bootstrap";
import { FaLock, FaArrowLeft, FaShieldAlt } from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

// Real CC Avenue redirect step (Non-Seamless billing page integration).
// Reached from HotelBookingPage's, BookingDetailedView's,
// LastMinuteBookingForm's, LongStayBookingPage's, PaxInformation's, or
// PackageBookingDetailView's "Select Payment Gateway" modal when CC Avenue
// is chosen. Modes, driven by what the caller put in location.state:
//   - CREATE  (bookingPayload set, no flowType) — HotelBookingPage.jsx,
//     insufficient credit at booking time. Sends the FULL booking payload
//     so the backend can compute the payable amount server-side and persist
//     it for after-payment recovery. This is the legacy/default shape —
//     kept flowType-less for backward compatibility.
//   - RECONFIRM (reconfirmBookingId set, no explicit flowType) —
//     BookingDetailedView.jsx (hotel), paying off an ALREADY-CREATED hotel
//     booking pending reconfirmation. Only the existing bookingId travels —
//     the backend already has everything else it needs (the booking's own
//     stored total, agent, etc). Legacy shape: reconfirmBookingId alone
//     implies flowType="RECONFIRM" so no existing hotel caller has to change.
//   - PACKAGE_RECONFIRM (reconfirmBookingId + flowType="PACKAGE_RECONFIRM")
//     — PackageBookingDetailView.jsx, the package equivalent of the hotel
//     reconfirm above. Same wire shape, different backend service
//     (initiatePackageReconfirm reads booking.totalPrice from
//     PackageBooking, not HotelBooking).
//   - Any other CREATE-shaped flow (flowType + bookingPayload set) — e.g.
//     LASTMINUTE_CREATE (LastMinuteBookingForm.jsx), LONGSTAY_CREATE
//     (LongStayBookingPage.jsx), or PACKAGE_CREATE (PaxInformation.jsx).
//     Same idea as CREATE, but the backend derives the payable amount from
//     that flow's own pricing rather than summing a per-room `rate` field
//     — flowType is passed straight through so /initiate knows which one.
//     Adding a new create-flow page needs no changes here — just set
//     flowType + bookingPayload in location.state.
// Either way this page then auto-submits a hidden form POST to CC Avenue's
// hosted payment page — the browser navigates away entirely, completes
// payment on CC Avenue's domain, and CC Avenue posts the result straight
// back to the backend, which then redirects back to `returnTo` with the
// outcome.
export default function CCAvenueCheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const formRef = useRef(null);

  const stateAmountLabel = location.state?.amountLabel || "";
  const billingName = location.state?.billingName || "";
  const returnTo = location.state?.returnTo || "/hotel-booking-page";
  const bookingPayload = location.state?.bookingPayload || null;
  const reconfirmBookingId = location.state?.reconfirmBookingId || null;
  const flowType = location.state?.flowType || null;

  const [error, setError] = useState(null);
  // { gatewayUrl, accessCode, encRequest }
  const [formFields, setFormFields] = useState(null);
  // Server-authoritative payable amount (returned by /initiate). Shown to
  // the operator so they see what will actually be charged, in case the
  // client-side estimate they landed here with is stale.
  const [serverAmountLabel, setServerAmountLabel] = useState("");

  useEffect(() => {
    if (!bookingPayload && !reconfirmBookingId) {
      setError(
        "Missing booking details — please go back and try again.",
      );
      return;
    }

    let cancelled = false;

    (async () => {
      try {
const response = await axiosInstance.post(
  "/api/payment/ccavenue/initiate",
  {
    billingName,
    returnPath: returnTo,
    // The backend re-derives the payable amount server-side either
    // way (from the payload's room rates, the existing booking's
    // stored total, or that create-flow's own pricing) and IGNORES
    // any client-supplied amount — kept off the wire deliberately so
    // a tampered client can't influence the charge.
    //
    // Precedence: an explicit flowType always wins over the legacy
    // "reconfirmBookingId → RECONFIRM" shortcut, so a caller that
    // passes BOTH (e.g. PACKAGE_RECONFIRM with the existing package
    // bookingId) reaches the right backend arm. When flowType is
    // absent, reconfirmBookingId still defaults to RECONFIRM (hotel)
    // — every legacy hotel-detail caller keeps working unchanged.
    ...(flowType
      ? reconfirmBookingId
        ? {
            flowType,
            existingBookingId: Number(reconfirmBookingId),
          }
        : { flowType, bookingPayload }
      : reconfirmBookingId
        ? {
            flowType: "RECONFIRM",
            existingBookingId: Number(reconfirmBookingId),
          }
        : { bookingPayload }),
  },
);
        if (cancelled) return;
        const { gatewayUrl, accessCode, encRequest, payableAmount, currency } =
          response.data || {};
        if (!gatewayUrl || !accessCode || !encRequest) {
          setError(
            "CC Avenue did not return a valid payment request. Please try again.",
          );
          return;
        }
        if (payableAmount != null) {
          setServerAmountLabel(
            `${currency || "AED"} ${Number(payableAmount).toFixed(2)}`,
          );
        }
        setFormFields({ gatewayUrl, accessCode, encRequest });
      } catch (err) {
        if (cancelled) return;
        const beMsg =
          err?.response?.data?.message ||
          "Could not start the CC Avenue payment. Please try again.";
        setError(beMsg);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // As soon as we have the encrypted request, submit the hidden form —
  // this navigates the browser away to CC Avenue's hosted billing page.
  useEffect(() => {
    if (formFields && formRef.current) {
      formRef.current.submit();
    }
  }, [formFields]);

  const goBack = () => navigate(returnTo);

  const displayAmountLabel = serverAmountLabel || stateAmountLabel;

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container style={{ maxWidth: 560 }}>
            <Button
              variant="link"
              className="text-decoration-none mb-3 px-0"
              onClick={goBack}
            >
              <FaArrowLeft className="me-2" />
              Back
            </Button>

            <Card className="shadow-sm border-0">
              <Card.Body className="px-4 py-5 text-center">
                <FaShieldAlt size={36} className="text-success mb-3" />
                <h5 className="fw-bold mb-2">CC Avenue Secure Payment</h5>
                {displayAmountLabel && (
                  <div className="text-muted mb-4">
                    Amount payable:{" "}
                    <span className="fw-bold text-dark">
                      {displayAmountLabel}
                    </span>
                  </div>
                )}

                {error ? (
                  <>
                    <Alert variant="danger" className="text-start">
                      {error}
                    </Alert>
                    <Button variant="secondary" onClick={goBack}>
                      Back to Booking
                    </Button>
                  </>
                ) : (
                  <>
                    <Spinner
                      animation="border"
                      variant="success"
                      role="status"
                      className="mb-3"
                    />
                    <div className="text-muted small">
                      <FaLock className="me-1" />
                      Redirecting you to CC Avenue's secure payment page — do
                      not close this window.
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>

            {/* Hidden auto-submit form — CC Avenue's Non-Seamless integration expects a
                real browser POST (encRequest + access_code), not an AJAX call. */}
            {formFields && (
              <form
                ref={formRef}
                method="POST"
                action={formFields.gatewayUrl}
                style={{ display: "none" }}
              >
                <input
                  type="hidden"
                  name="encRequest"
                  value={formFields.encRequest}
                />
                <input
                  type="hidden"
                  name="access_code"
                  value={formFields.accessCode}
                />
              </form>
            )}
          </Container>
        </main>
      </div>
    </div>
  );
}
