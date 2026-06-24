import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../components/AxiosInstance";
import {
  Card,
  Row,
  Col,
  Spinner,
  Button,
  Badge,
  Alert,
} from "react-bootstrap";
import {
  FaUserCog,
  FaMapMarkerAlt,
  FaPhone,
  FaEnvelope,
  FaGlobe,
  FaClock,
  FaUtensils,
  FaStar,
  FaEdit,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";
import RestaurantExtranetLayout from "./RestaurantExtranetLayout";

/**
 * Restaurant profile page for the extranet portal.
 *
 * Shows a read-only summary of the restaurant's master fields (name,
 * place, contact, timings, cuisine, facilities, policies). For actual
 * editing the manager clicks "Edit Profile" → routes to the existing
 * `/restaurant/edit/:id` page (full registration form with image and
 * menu PDF upload widgets already wired). This avoids cloning the
 * registration form just for the extranet.
 */
const fmtTime = (t) => {
  if (!t) return "—";
  if (typeof t === "string" && t.length >= 5) return t.substring(0, 5);
  return t;
};

const yesNo = (v) =>
  v ? (
    <span className="text-success">
      <FaCheckCircle className="me-1" />
      Yes
    </span>
  ) : (
    <span className="text-muted">
      <FaTimesCircle className="me-1" />
      No
    </span>
  );

const RestaurantExtranetProfile = () => {
  const navigate = useNavigate();
  const [restaurantId, setRestaurantId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get("/api/restaurant-extranet/me");
        if (!cancelled && res?.data?.restaurantId) {
          setRestaurantId(res.data.restaurantId);
        }
      } catch {
        // Layout handles auth redirect.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axiosInstance.get(`/api/restaurant/${restaurantId}`);
        if (!cancelled) setRestaurant(res?.data || null);
      } catch (err) {
        if (!cancelled) {
          console.error("profile fetch failed", err);
          setError("Failed to load profile.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const cuisines = (() => {
    const raw = restaurant?.cuisineTypes;
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === "string") {
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  })();

  const facilities = restaurant
    ? [
        { label: "Parking", v: restaurant.hasParking },
        { label: "Free Wi-Fi", v: restaurant.hasWifi },
        { label: "Air-conditioned", v: restaurant.hasAc },
        { label: "Outdoor Seating", v: restaurant.hasOutdoorSeating },
        { label: "Live Music", v: restaurant.hasLiveMusic },
        { label: "Serves Alcohol", v: restaurant.servesAlcohol },
        { label: "Pure Veg", v: restaurant.isPureVeg },
        { label: "Family Friendly", v: restaurant.isFamilyFriendly },
        { label: "Pet Friendly", v: restaurant.petFriendly },
        { label: "Home Delivery", v: restaurant.homeDelivery },
        { label: "Take Away", v: restaurant.takeAway },
      ]
    : [];

  return (
    <RestaurantExtranetLayout
      title="My Profile"
      subtitle="Your restaurant's public-facing details."
    >
      <Card className="shadow-sm border-0 rounded-3 mb-3">
        <Card.Body className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <FaUserCog className="text-primary" />
            <span className="fw-semibold">Restaurant details</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate("/restaurant-extranet/profile/edit")}
            disabled={!restaurantId}
          >
            <FaEdit className="me-2" />
            Edit Profile
          </Button>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : !restaurant ? (
        <Card className="shadow-sm border-0 rounded-3">
          <Card.Body className="text-center py-5 text-muted">
            No profile available.
          </Card.Body>
        </Card>
      ) : (
        <>
          {/* Hero card */}
          <Card className="shadow-sm border-0 rounded-3 mb-3">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                <div>
                  <h4 className="fw-bold mb-1" style={{ color: "#111827" }}>
                    <FaUtensils className="me-2 text-primary" />
                    {restaurant.restaurantName || "—"}
                  </h4>
                  <div className="text-muted small mb-2">
                    {restaurant.destinationName || restaurant.place || "—"}
                  </div>
                  {restaurant.starRating ? (
                    <Badge bg="warning" text="dark">
                      <FaStar className="me-1" />
                      {restaurant.starRating} Star
                    </Badge>
                  ) : null}
                  {restaurant.foodType && (
                    <Badge bg="secondary" className="ms-2">
                      {restaurant.foodType}
                    </Badge>
                  )}
                  {restaurant.status && (
                    <Badge
                      bg={
                        (restaurant.status || "").toLowerCase() === "active"
                          ? "success"
                          : "secondary"
                      }
                      className="ms-2"
                    >
                      {restaurant.status}
                    </Badge>
                  )}
                </div>
              </div>
              {restaurant.description && (
                <p className="mt-3 mb-0 text-muted" style={{ whiteSpace: "pre-line" }}>
                  {restaurant.description}
                </p>
              )}
            </Card.Body>
          </Card>

          {/* Contact + Timings */}
          <Row className="g-3 mb-3">
            <Col md={6}>
              <Card className="shadow-sm border-0 rounded-3 h-100">
                <Card.Body>
                  <h6 className="fw-bold mb-3">Contact</h6>
                  <KV icon={<FaMapMarkerAlt className="text-danger" />} label="Address" value={restaurant.address} />
                  <KV icon={<FaPhone className="text-success" />} label="Phone" value={restaurant.contactNumber} />
                  <KV icon={<FaPhone className="text-muted" />} label="Alternate" value={restaurant.alternateNumber} />
                  <KV icon={<FaEnvelope className="text-info" />} label="Email" value={restaurant.email} />
                  <KV icon={<FaGlobe className="text-primary" />} label="Website" value={restaurant.website} />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="shadow-sm border-0 rounded-3 h-100">
                <Card.Body>
                  <h6 className="fw-bold mb-3">Service</h6>
                  <KV icon={<FaClock className="text-info" />} label="Open" value={fmtTime(restaurant.openTime)} />
                  <KV icon={<FaClock className="text-info" />} label="Close" value={fmtTime(restaurant.closeTime)} />
                  <KV
                    label="Seating Capacity"
                    value={restaurant.seatingCapacity || "—"}
                  />
                  <KV
                    label="Number of Tables"
                    value={restaurant.numberOfTables || "—"}
                  />
                  <KV
                    label="Dress Code"
                    value={restaurant.dressCode || "—"}
                  />
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Cuisine + Pricing */}
          <Row className="g-3 mb-3">
            <Col md={6}>
              <Card className="shadow-sm border-0 rounded-3 h-100">
                <Card.Body>
                  <h6 className="fw-bold mb-3">Cuisine</h6>
                  {cuisines.length > 0 ? (
                    <div className="d-flex flex-wrap gap-2">
                      {cuisines.map((c) => (
                        <Badge key={c} bg="light" text="dark" className="border">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted small">—</span>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="shadow-sm border-0 rounded-3 h-100">
                <Card.Body>
                  <h6 className="fw-bold mb-3">Pricing</h6>
                  <KV
                    label="Currency"
                    value={restaurant.currencyCode || "—"}
                  />
                  <KV
                    label="Price per Person"
                    value={
                      restaurant.pricePerPerson != null
                        ? `${restaurant.currencyCode || ""} ${restaurant.pricePerPerson}`
                        : "—"
                    }
                  />
                  <KV
                    label="Average for Two"
                    value={
                      restaurant.averageCostForTwo
                        ? `${restaurant.currencyCode || ""} ${restaurant.averageCostForTwo}`
                        : "—"
                    }
                  />
                  <KV
                    label="Tax %"
                    value={restaurant.taxPercent != null ? `${restaurant.taxPercent}%` : "—"}
                  />
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Facilities */}
          <Card className="shadow-sm border-0 rounded-3 mb-3">
            <Card.Body>
              <h6 className="fw-bold mb-3">Facilities &amp; Highlights</h6>
              <Row className="g-2">
                {facilities.map((f) => (
                  <Col xs={6} md={4} lg={3} key={f.label}>
                    <div className="d-flex justify-content-between border rounded-2 px-2 py-1">
                      <span className="small">{f.label}</span>
                      {yesNo(f.v)}
                    </div>
                  </Col>
                ))}
              </Row>
            </Card.Body>
          </Card>

          {/* Policies */}
          {(restaurant.reservationPolicy || restaurant.cancellationPolicy) && (
            <Card className="shadow-sm border-0 rounded-3 mb-3">
              <Card.Body>
                <h6 className="fw-bold mb-3">Policies</h6>
                {restaurant.reservationPolicy && (
                  <div className="mb-2">
                    <div className="fw-semibold small text-muted">Reservation</div>
                    <div style={{ whiteSpace: "pre-line" }}>
                      {restaurant.reservationPolicy}
                    </div>
                  </div>
                )}
                {restaurant.cancellationPolicy && (
                  <div>
                    <div className="fw-semibold small text-muted">Cancellation</div>
                    <div style={{ whiteSpace: "pre-line" }}>
                      {restaurant.cancellationPolicy}
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </>
      )}
    </RestaurantExtranetLayout>
  );
};

function KV({ icon, label, value }) {
  return (
    <div className="d-flex justify-content-between align-items-start mb-2">
      <div className="text-muted small">
        {icon && <span className="me-2">{icon}</span>}
        {label}
      </div>
      <div className="text-end" style={{ maxWidth: "60%", wordBreak: "break-word" }}>
        {value || "—"}
      </div>
    </div>
  );
}

export default RestaurantExtranetProfile;
