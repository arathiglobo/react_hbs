import React from "react";
import { Card, Table, Badge } from "react-bootstrap";

const RestaurantSummary = ({
  restaurant,
  bookingDate,
  bookingTime,
  memberCount,
  items = [],
  taxPercent = 0,
  customerName,
  agentName,
}) => {
  // Pricing is now driven by the per-person rate set on the restaurant
  // registration page × the member count picked on the search page.
  // The legacy `items` prop is still accepted but no longer rendered as
  // a billable list — restaurants surface their menus as PDFs instead.
  const ratePerPerson = Number(restaurant?.pricePerPerson || 0);
  const members = Number(memberCount || 0);
  const subTotal = ratePerPerson * members;
  const taxAmount = (subTotal * Number(taxPercent || 0)) / 100;
  const grandTotal = subTotal + taxAmount;

  return (
    <Card className="shadow-sm sticky-top" style={{ top: 80 }}>
      <Card.Header className="bg-warning bg-opacity-25 fw-semibold">
        Order Summary
      </Card.Header>
      <Card.Body>
        <h6 className="mb-2">{restaurant?.restaurantName}</h6>
        <div className="small text-muted mb-2">{restaurant?.place}</div>

        <div className="d-flex justify-content-between small">
          <span>Date / Time</span>
          <strong>
            {bookingDate || "-"} {bookingTime}
          </strong>
        </div>
        <div className="d-flex justify-content-between small">
          <span>Members</span>
          <strong>{memberCount || 0}</strong>
        </div>
        {customerName && (
          <div className="d-flex justify-content-between small">
            <span>Customer</span>
            <strong>{customerName}</strong>
          </div>
        )}
        {agentName && (
          <div className="d-flex justify-content-between small">
            <span>Agent</span>
            <strong>{agentName}</strong>
          </div>
        )}

        <hr />
        <div className="small fw-semibold mb-1">Charges</div>
        <Table size="sm" borderless className="mb-0">
          <tbody>
            <tr>
              <td className="ps-0">
                Rate × Members{" "}
                <Badge bg="light" text="dark">
                  ₹ {ratePerPerson.toFixed(2)} × {members}
                </Badge>
              </td>
              <td className="text-end pe-0">₹ {subTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </Table>

        <hr />
        <div className="d-flex justify-content-between">
          <span>Sub Total</span>
          <span>₹ {subTotal.toFixed(2)}</span>
        </div>
        <div className="d-flex justify-content-between text-muted small">
          <span>Tax ({taxPercent || 0}%)</span>
          <span>₹ {taxAmount.toFixed(2)}</span>
        </div>
        <hr />
        <div className="d-flex justify-content-between fs-5 fw-bold">
          <span>Total</span>
          <span className="text-success">₹ {grandTotal.toFixed(2)}</span>
        </div>
      </Card.Body>
    </Card>
  );
};

export default RestaurantSummary;
