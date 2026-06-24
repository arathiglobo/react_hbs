import React from "react";
import { Card, Button, Badge } from "react-bootstrap";
import {
  FaMapMarkerAlt,
  FaMoon,
  FaSuitcaseRolling,
  FaImages,
  FaStar,
  FaEye,
  FaRupeeSign,
} from "react-icons/fa";

/**
 * Honeymoon result card. Shows base + marked-up pricing so the agent can see
 * both the contract rate and the price after their markup.
 */
const HoneymoonCard = ({ pkg, onView, onBook }) => {
  const mainImage = pkg.images?.[0] || "/images/not-available.jpg";
  const marked = Number(pkg.markedUpRate ?? pkg.perPaxRate ?? 0);
  const base = Number(pkg.baseRate ?? pkg.perPaxRate ?? 0);
  const markupPercent = Number(pkg.markupPercent ?? 0);
  const showMarkup = markupPercent > 0 && marked > base;

  return (
    <Card className="shadow-sm h-100 honeymoon-card">
      <div
        style={{
          height: 200,
          backgroundImage: `url(${mainImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "relative",
          cursor: "pointer",
        }}
        onClick={onView}
      >
        {pkg.images?.length > 1 && (
          <Badge bg="dark" style={{ position: "absolute", bottom: 8, right: 8, opacity: 0.85 }}>
            <FaImages className="me-1" />+{pkg.images.length}
          </Badge>
        )}
        {pkg.rating != null && (
          <Badge bg="warning" text="dark" style={{ position: "absolute", top: 8, left: 8 }}>
            <FaStar className="me-1" />
            {Number(pkg.rating).toFixed(1)}
          </Badge>
        )}
        {pkg.category && (
          <Badge bg="danger" style={{ position: "absolute", top: 8, right: 8 }}>
            <FaSuitcaseRolling className="me-1" />
            {pkg.category}
          </Badge>
        )}
      </div>
      <Card.Body className="d-flex flex-column">
        <h5 className="mb-1 text-primary">
          <FaSuitcaseRolling className="me-2" />
          {pkg.packageName}
        </h5>
        <div className="text-muted small mb-1">
          <FaMapMarkerAlt className="me-1 text-primary" />
          {pkg.startingFrom} → {pkg.destination}
        </div>
        <div className="small text-muted mb-2">
          <FaMoon className="me-1 text-info" />
          {pkg.noOfNights}N / {pkg.noOfDays}D · {pkg.hotelCategory || ""}
          {pkg.mealPlan ? ` · ${pkg.mealPlan}` : ""}
        </div>
        {pkg.theme && (
          <div className="mb-2">
            <Badge bg="light" text="dark" className="border me-1">
              {pkg.theme}
            </Badge>
          </div>
        )}
        {pkg.overview && (
          <p
            className="text-muted small mb-2"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {pkg.overview}
          </p>
        )}

        <div className="mt-auto">
          <div className="d-flex justify-content-between align-items-end mb-2">
            <div>
              <small className="text-muted d-block">Per Person</small>
              <h5 className="text-success mb-0">
                <FaRupeeSign />
                {marked.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </h5>
              {showMarkup && (
                <small className="text-muted text-decoration-line-through d-block">
                  ₹ {base.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </small>
              )}
            </div>
            {showMarkup && (
              <Badge bg="info" className="mb-1">
                +{markupPercent}% markup
              </Badge>
            )}
          </div>
          <div className="d-flex gap-2">
            <Button
              variant="outline-primary"
              size="sm"
              onClick={onView}
              className="flex-fill rounded-pill"
            >
              <FaEye className="me-1" /> View
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onBook}
              className="flex-fill rounded-pill"
            >
              <FaSuitcaseRolling className="me-1" /> Book
            </Button>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default HoneymoonCard;
