import React from "react";
import { Card, Button, Badge, Row, Col } from "react-bootstrap";

/** Renders one or two badges describing which booking modes a restaurant
 *  accepts. "Both" expands to two badges so the agent sees both options. */
const BookingModeBadges = ({ modes }) => {
  if (!modes) return null;
  const both = modes === "Both";
  return (
    <>
      {(both || modes === "Walk-in") && (
        <Badge bg="success" className="me-1">Walk-in</Badge>
      )}
      {(both || modes === "Advance") && (
        <Badge bg="primary">Advance</Badge>
      )}
    </>
  );
};
import {
  FaMapMarkerAlt,
  FaClock,
  FaUtensils,
  FaImages,
  FaStar,
  FaEye,
  FaRupeeSign,
  FaPhone,
} from "react-icons/fa";

/**
 * Restaurant result card.
 *
 * Two layouts:
 *   - viewMode="grid" : default 3-up tile (image on top, content below).
 *   - viewMode="list" : horizontal row (image left, content + actions right).
 *
 * Card exposes two actions:
 *   - View         → /restaurant/view/:id (tabbed detail page)
 *   - Book a Table → /new-booking/restaurant/booking
 */
const RestaurantCard = ({ restaurant, viewMode = "grid", onView, onBook }) => {
  const mainImage =
    restaurant.images?.[0] ||
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=60";

  if (viewMode === "list") {
    return (
      <Card className="shadow-sm restaurant-card overflow-hidden">
        <Row className="g-0">
          <Col md={3} lg={2}>
            <div
              style={{
                height: "100%",
                minHeight: 160,
                backgroundImage: `url(${mainImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                position: "relative",
                cursor: "pointer",
              }}
              onClick={onView}
            >
              {restaurant.images?.length > 1 && (
                <Badge
                  bg="dark"
                  style={{ position: "absolute", bottom: 8, right: 8, opacity: 0.85 }}
                >
                  <FaImages className="me-1" />
                  +{restaurant.images.length}
                </Badge>
              )}
              {restaurant.rating != null && (
                <Badge
                  bg="success"
                  style={{ position: "absolute", top: 8, left: 8 }}
                >
                  <FaStar className="me-1" />
                  {Number(restaurant.rating).toFixed(1)}
                </Badge>
              )}
            </div>
          </Col>
          <Col md={9} lg={10}>
            <Card.Body className="d-flex flex-column flex-md-row gap-3 align-items-md-stretch">
              <div className="flex-grow-1">
                <h5 className="mb-1 text-primary">{restaurant.restaurantName}</h5>
                <div className="text-muted small mb-1">
                  <FaMapMarkerAlt className="me-1 text-danger" />
                  {restaurant.place}
                  {restaurant.address ? ` · ${restaurant.address}` : ""}
                </div>
                <Row className="g-2 small text-muted mb-2">
                  <Col xs={6} md={4}>
                    <FaClock className="me-1 text-info" />
                    {String(restaurant.openTime || "").slice(0, 5)} -{" "}
                    {String(restaurant.closeTime || "").slice(0, 5)}
                  </Col>
                  {restaurant.contactNumber && (
                    <Col xs={6} md={4}>
                      <FaPhone className="me-1 text-success" />
                      {restaurant.contactNumber}
                    </Col>
                  )}
                  {restaurant.averageCostForTwo > 0 && (
                    <Col xs={6} md={4}>
                      <FaRupeeSign className="me-1" />
                      {restaurant.averageCostForTwo} for two
                    </Col>
                  )}
                </Row>
                <div className="d-flex flex-wrap gap-1 mb-1">
                  <BookingModeBadges modes={restaurant.bookingModes} />
                </div>
                <div className="d-flex flex-wrap gap-1 mb-2">
                  {(restaurant.cuisineTypes || []).slice(0, 5).map((c) => (
                    <Badge key={c} bg="light" text="dark" className="border">
                      {c}
                    </Badge>
                  ))}
                </div>
                {restaurant.description && (
                  <p
                    className="text-muted small mb-0"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {restaurant.description}
                  </p>
                )}
              </div>
              <div
                className="d-flex flex-md-column justify-content-md-center gap-2"
                style={{ minWidth: 180 }}
              >
                <Button
                  size="sm"
                  variant="outline-primary"
                  onClick={onView}
                  className="rounded-pill"
                >
                  <FaEye className="me-1" /> View
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={onBook}
                  className="rounded-pill"
                >
                  <FaUtensils className="me-1" /> Book a Table
                </Button>
              </div>
            </Card.Body>
          </Col>
        </Row>
      </Card>
    );
  }

  // Default grid layout.
  return (
    <Card className="shadow-sm h-100 restaurant-card">
      <div
        style={{
          height: 180,
          backgroundImage: `url(${mainImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "relative",
          cursor: "pointer",
        }}
        onClick={onView}
      >
        {restaurant.images?.length > 1 && (
          <Badge
            bg="dark"
            style={{ position: "absolute", bottom: 8, right: 8, opacity: 0.85 }}
          >
            <FaImages className="me-1" />
            +{restaurant.images.length}
          </Badge>
        )}
        {restaurant.rating != null && (
          <Badge
            bg="success"
            style={{ position: "absolute", top: 8, left: 8 }}
          >
            <FaStar className="me-1" />
            {Number(restaurant.rating).toFixed(1)}
          </Badge>
        )}
      </div>
      <Card.Body className="d-flex flex-column">
        <h5 className="mb-1">{restaurant.restaurantName}</h5>
        <div className="text-muted small mb-1">
          <FaMapMarkerAlt className="me-1 text-danger" />
          {restaurant.place}
        </div>
        {restaurant.address && (
          <div
            className="text-muted small mb-2"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
            title={restaurant.address}
          >
            {restaurant.address}
          </div>
        )}
        <div className="small mb-2">
          <FaClock className="me-1 text-info" />
          {String(restaurant.openTime || "").slice(0, 5)} -{" "}
          {String(restaurant.closeTime || "").slice(0, 5)}
        </div>
        <div className="mb-2 d-flex flex-wrap gap-1">
          <BookingModeBadges modes={restaurant.bookingModes} />
        </div>
        <div className="mb-2 d-flex flex-wrap gap-1">
          {(restaurant.cuisineTypes || []).slice(0, 3).map((c) => (
            <Badge key={c} bg="light" text="dark" className="border">
              {c}
            </Badge>
          ))}
        </div>
        <div className="mt-auto d-flex gap-2">
          <Button
            size="sm"
            variant="outline-primary"
            onClick={onView}
            className="flex-grow-1"
          >
            <FaEye className="me-1" /> View
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={onBook}
            className="flex-grow-1"
          >
            <FaUtensils className="me-1" /> Book a Table
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default RestaurantCard;
