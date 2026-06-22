import React, { useEffect, useState } from "react";
import axiosInstance from "../../components/AxiosInstance";
import { Card, Row, Col, Spinner, Alert } from "react-bootstrap";
import { FaImages, FaExclamationTriangle } from "react-icons/fa";
import RestaurantExtranetLayout from "./RestaurantExtranetLayout";

/**
 * Read-only restaurant photo gallery for the extranet portal.
 *
 * The layout chrome calls `/api/restaurant-extranet/me` to resolve
 * the manager's restaurant; this page issues a parallel call so it
 * doesn't need to lift state through the render-prop. The duplicate
 * `/me` round-trip is intentional + cheap — both responses cache in
 * memory for the page lifetime and keep the React tree dead simple.
 *
 * Photo uploads stay with the platform admin (the multipart
 * `/restaurant/{id}` PUT endpoint wholesale replaces images and isn't
 * safe to call from a JSON edit form). The empty-state copy points
 * managers at their admin contact for image changes.
 */
const RestaurantExtranetGallery = () => {
  const [restaurantId, setRestaurantId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 1. Resolve the restaurantId from the JWT (via /me).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get("/api/restaurant-extranet/me");
        if (!cancelled && res?.data?.restaurantId) {
          setRestaurantId(res.data.restaurantId);
        }
      } catch {
        // Layout will handle the 401 redirect; just stop here.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Once we know the id, fetch the full restaurant payload so we
  //    can render its image list.
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
          console.error("gallery fetch failed", err);
          setError("Failed to load gallery.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const images = Array.isArray(restaurant?.images) ? restaurant.images : [];

  return (
    <RestaurantExtranetLayout
      title="Gallery"
      subtitle="Photos uploaded against your restaurant profile."
    >
      <Card className="shadow-sm border-0 rounded-3 mb-3">
        <Card.Body className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <FaImages className="text-success" />
            <span className="fw-semibold">
              {images.length} {images.length === 1 ? "photo" : "photos"}
            </span>
          </div>
          <div className="small text-muted">
            Photo uploads are managed by the platform administrator.
          </div>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger">
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : images.length === 0 && !error ? (
        <Card className="shadow-sm border-0 rounded-3">
          <Card.Body className="text-center py-5 text-muted">
            <FaImages size={48} className="mb-3 opacity-50" />
            <h5 className="mb-2">No photos uploaded yet</h5>
            <p className="small mb-0">
              No photos have been uploaded for your restaurant yet.
              Please ask the platform administrator to add photos so
              agents can showcase your venue to their customers.
            </p>
          </Card.Body>
        </Card>
      ) : (
        <Row className="g-3">
          {images.map((src, idx) => (
            <Col key={idx} xs={6} md={4} lg={3}>
              <Card
                className="shadow-sm border-0 rounded-3 h-100"
                style={{ overflow: "hidden" }}
              >
                <Card.Img
                  variant="top"
                  src={
                    typeof src === "string" ? src : src?.url || src?.path || ""
                  }
                  alt={`Restaurant ${idx + 1}`}
                  style={{
                    width: "100%",
                    height: 200,
                    objectFit: "cover",
                  }}
                  onError={(e) => {
                    e.target.src = "/images/not-available.jpg";
                  }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </RestaurantExtranetLayout>
  );
};

export default RestaurantExtranetGallery;
