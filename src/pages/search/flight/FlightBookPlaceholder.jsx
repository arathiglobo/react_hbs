import React from "react";
import { Card, Button, Alert } from "react-bootstrap";
import { FaArrowLeft, FaShoppingCart } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";

/*
 * Temporary landing page for /new-booking/flightBook.
 *
 * The full flight booking flow (passenger form, payment, PNR creation) is
 * not part of the current iteration. This shell surfaces the selected fare
 * from FlightBestPriceCheck so the transition still feels intentional and
 * developers can confirm state is being passed through router correctly.
 * Replace the "coming soon" alert body with the real booking form when the
 * flow is designed.
 */
const FlightBookPlaceholder = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const rec = location.state?.rec || null;
  const fare = location.state?.fare || null;

  return (
    <div>
      <TopBar />
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: "24px", background: "#f7f8fa" }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 style={{ margin: 0 }}>
              <FaShoppingCart style={{ marginRight: 8 }} />
              Book Flight
            </h4>
            <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)}>
              <FaArrowLeft style={{ marginRight: 6 }} />
              Back
            </Button>
          </div>

          <Alert variant="info">
            <strong>Flight booking flow — coming soon.</strong>
            <div className="mt-2" style={{ fontSize: 13 }}>
              The passenger details form, seat selection, payment and PNR
              creation steps will be added here in a follow-up. The selected
              fare has been carried over via router state so it can be
              consumed once the form lands.
            </div>
          </Alert>

          {fare && (
            <Card className="shadow-sm">
              <Card.Body>
                <h6 className="mb-3">Selected fare (from previous step)</h6>
                <div style={{ fontSize: 14 }}>
                  <div>
                    <strong>Total:</strong> {fare.currency}{" "}
                    {Number(fare.totalFare ?? 0).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div>
                    <strong>Base fare:</strong> {fare.currency}{" "}
                    {Number(fare.baseFare ?? 0).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div>
                    <strong>Taxes:</strong> {fare.currency}{" "}
                    {Number(fare.totalTax ?? 0).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div>
                    <strong>Fare type:</strong> {fare.fareType || "—"}
                  </div>
                  {rec?.validatingCarrier && (
                    <div>
                      <strong>Airline:</strong> {rec.validatingCarrier}
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
};

export default FlightBookPlaceholder;
