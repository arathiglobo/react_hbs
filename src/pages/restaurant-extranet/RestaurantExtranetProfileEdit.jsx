import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../components/AxiosInstance";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Spinner,
  Alert,
} from "react-bootstrap";
import { toast } from "react-hot-toast";
import { FaSave, FaArrowLeft } from "react-icons/fa";
import RestaurantExtranetLayout from "./RestaurantExtranetLayout";

/**
 * Restaurant-extranet profile edit page.
 *
 * Lives entirely inside the extranet — does NOT route to the admin
 * `/restaurant/edit/:id` form, because:
 *   • That form's "Back" / "Cancel" buttons hard-code a navigate to
 *     `/restaurant/list`, which restaurant managers shouldn't see.
 *   • The admin save path wholesale replaces the restaurant's images /
 *     menus / promotions / multi-row policies on every PUT — a JSON
 *     edit form here would wipe them out.
 *
 * Submits to {@code PUT /api/restaurant-extranet/profile} with only
 * the scalar fields. The backend handler (see
 * RestaurantExtranetAuthService#updateProfileFields) is a partial
 * patch that never touches associated collections.
 *
 * Cancel / Save success → returns to `/restaurant-extranet/profile`.
 */

const fmtTimeInput = (t) => {
  if (!t) return "";
  if (typeof t === "string" && t.length >= 5) return t.substring(0, 5);
  return t;
};

const RestaurantExtranetProfileEdit = () => {
  const navigate = useNavigate();
  const [restaurantId, setRestaurantId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);

  // Resolve restaurant id from JWT.
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

  // Load existing restaurant detail into the form.
  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axiosInstance.get(`/api/restaurant/${restaurantId}`);
        if (cancelled) return;
        const r = res?.data || {};
        const cuisineStr = Array.isArray(r.cuisineTypes)
          ? r.cuisineTypes.join(", ")
          : r.cuisineTypes || "";
        setForm({
          restaurantName: r.restaurantName || "",
          place: r.place || "",
          address: r.address || "",
          locationUrl: r.locationUrl || "",
          contactNumber: r.contactNumber || "",
          alternateNumber: r.alternateNumber || "",
          email: r.email || "",
          website: r.website || "",
          openTime: fmtTimeInput(r.openTime),
          closeTime: fmtTimeInput(r.closeTime),
          description: r.description || "",
          cuisineTypes: cuisineStr,
          foodType: r.foodType || "",
          averageCostForTwo: r.averageCostForTwo ?? "",
          pricePerPerson: r.pricePerPerson ?? "",
          taxPercent: r.taxPercent ?? "",
          seatingCapacity: r.seatingCapacity ?? "",
          numberOfTables: r.numberOfTables ?? "",
          dressCode: r.dressCode || "",
          reservationPolicy: r.reservationPolicy || "",
          cancellationPolicy: r.cancellationPolicy || "",
          hasParking: !!r.hasParking,
          hasWifi: !!r.hasWifi,
          hasAc: !!r.hasAc,
          hasOutdoorSeating: !!r.hasOutdoorSeating,
          hasLiveMusic: !!r.hasLiveMusic,
          servesAlcohol: !!r.servesAlcohol,
          isPureVeg: !!r.isPureVeg,
          isFamilyFriendly: !!r.isFamilyFriendly,
          petFriendly: !!r.petFriendly,
          homeDelivery: !!r.homeDelivery,
          takeAway: !!r.takeAway,
        });
      } catch (err) {
        if (!cancelled) {
          console.error("profile load failed", err);
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

  const setField = (name, value) =>
    setForm((prev) => (prev ? { ...prev, [name]: value } : prev));

  const validationError = useMemo(() => {
    if (!form) return "";
    if (!form.restaurantName.trim()) return "Restaurant name is required.";
    if (!form.contactNumber.trim()) return "Contact number is required.";
    if (!form.email.trim()) return "Email is required.";
    return "";
  }, [form]);

  const handleSave = async () => {
    if (!form || !restaurantId) return;
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        // Server expects plain numbers / null; trim empty strings.
        averageCostForTwo: form.averageCostForTwo === "" ? null : Number(form.averageCostForTwo),
        pricePerPerson: form.pricePerPerson === "" ? null : Number(form.pricePerPerson),
        taxPercent: form.taxPercent === "" ? null : Number(form.taxPercent),
        seatingCapacity: form.seatingCapacity === "" ? null : Number(form.seatingCapacity),
        numberOfTables: form.numberOfTables === "" ? null : Number(form.numberOfTables),
      };
      const res = await axiosInstance.put(
        "/api/restaurant-extranet/profile",
        payload
      );
      const data = res?.data || {};
      if (data.status === "SUCCESS") {
        toast.success(data.message || "Profile updated.");
        navigate("/restaurant-extranet/profile", { replace: true });
      } else {
        const msg = data.message || "Failed to save profile.";
        toast.error(msg);
        setError(msg);
      }
    } catch (err) {
      console.error("profile save failed", err);
      const msg = err?.response?.data?.message || "Failed to save profile.";
      toast.error(msg);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <RestaurantExtranetLayout
      title="Edit Profile"
      subtitle="Update your restaurant's public details. Photos & menu PDFs are managed by the platform admin."
    >
      {loading || !form ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : (
        <>
          {error && <Alert variant="danger">{error}</Alert>}

          {/* Basic */}
          <Card className="shadow-sm border-0 rounded-3 mb-3">
            <Card.Body>
              <h6 className="fw-bold mb-3">Basic Info</h6>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Label className="fw-semibold small">
                    Restaurant Name <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    value={form.restaurantName}
                    onChange={(e) => setField("restaurantName", e.target.value)}
                    disabled={saving}
                  />
                </Col>
                <Col md={6}>
                  <Form.Label className="fw-semibold small">Place / City</Form.Label>
                  <Form.Control
                    value={form.place}
                    onChange={(e) => setField("place", e.target.value)}
                    disabled={saving}
                  />
                </Col>
                <Col md={12}>
                  <Form.Label className="fw-semibold small">Address</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={form.address}
                    onChange={(e) => setField("address", e.target.value)}
                    disabled={saving}
                  />
                </Col>
                <Col md={6}>
                  <Form.Label className="fw-semibold small">Map Link (URL)</Form.Label>
                  <Form.Control
                    value={form.locationUrl}
                    onChange={(e) => setField("locationUrl", e.target.value)}
                    disabled={saving}
                  />
                </Col>
                <Col md={12}>
                  <Form.Label className="fw-semibold small">Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    disabled={saving}
                  />
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Contact */}
          <Card className="shadow-sm border-0 rounded-3 mb-3">
            <Card.Body>
              <h6 className="fw-bold mb-3">Contact</h6>
              <Row className="g-3">
                <Col md={4}>
                  <Form.Label className="fw-semibold small">
                    Contact Number <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    value={form.contactNumber}
                    onChange={(e) => setField("contactNumber", e.target.value)}
                    disabled={saving}
                  />
                </Col>
                <Col md={4}>
                  <Form.Label className="fw-semibold small">Alternate</Form.Label>
                  <Form.Control
                    value={form.alternateNumber}
                    onChange={(e) => setField("alternateNumber", e.target.value)}
                    disabled={saving}
                  />
                </Col>
                <Col md={4}>
                  <Form.Label className="fw-semibold small">
                    Email <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    disabled={saving}
                  />
                </Col>
                <Col md={6}>
                  <Form.Label className="fw-semibold small">Website</Form.Label>
                  <Form.Control
                    value={form.website}
                    onChange={(e) => setField("website", e.target.value)}
                    disabled={saving}
                  />
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Timings + capacity */}
          <Card className="shadow-sm border-0 rounded-3 mb-3">
            <Card.Body>
              <h6 className="fw-bold mb-3">Timings &amp; Capacity</h6>
              <Row className="g-3">
                <Col md={3}>
                  <Form.Label className="fw-semibold small">Open Time</Form.Label>
                  <Form.Control
                    type="time"
                    value={form.openTime}
                    onChange={(e) => setField("openTime", e.target.value)}
                    disabled={saving}
                  />
                </Col>
                <Col md={3}>
                  <Form.Label className="fw-semibold small">Close Time</Form.Label>
                  <Form.Control
                    type="time"
                    value={form.closeTime}
                    onChange={(e) => setField("closeTime", e.target.value)}
                    disabled={saving}
                  />
                </Col>
                <Col md={3}>
                  <Form.Label className="fw-semibold small">Seating Capacity</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    value={form.seatingCapacity}
                    onChange={(e) => setField("seatingCapacity", e.target.value)}
                    disabled={saving}
                  />
                </Col>
                <Col md={3}>
                  <Form.Label className="fw-semibold small">Number of Tables</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    value={form.numberOfTables}
                    onChange={(e) => setField("numberOfTables", e.target.value)}
                    disabled={saving}
                  />
                </Col>
                <Col md={4}>
                  <Form.Label className="fw-semibold small">Dress Code</Form.Label>
                  <Form.Control
                    value={form.dressCode}
                    onChange={(e) => setField("dressCode", e.target.value)}
                    disabled={saving}
                  />
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Cuisine + Pricing */}
          <Card className="shadow-sm border-0 rounded-3 mb-3">
            <Card.Body>
              <h6 className="fw-bold mb-3">Cuisine &amp; Pricing</h6>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Label className="fw-semibold small">Cuisine Types (comma separated)</Form.Label>
                  <Form.Control
                    value={form.cuisineTypes}
                    onChange={(e) => setField("cuisineTypes", e.target.value)}
                    placeholder="Indian, Chinese, Italian"
                    disabled={saving}
                  />
                </Col>
                <Col md={3}>
                  <Form.Label className="fw-semibold small">Food Type</Form.Label>
                  <Form.Select
                    value={form.foodType}
                    onChange={(e) => setField("foodType", e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Select…</option>
                    <option value="Veg">Veg</option>
                    <option value="Non-Veg">Non-Veg</option>
                    <option value="Both">Both</option>
                    <option value="Vegan">Vegan</option>
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Label className="fw-semibold small">Tax %</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.taxPercent}
                    onChange={(e) => setField("taxPercent", e.target.value)}
                    disabled={saving}
                  />
                </Col>
                <Col md={4}>
                  <Form.Label className="fw-semibold small">Average Cost for Two</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    value={form.averageCostForTwo}
                    onChange={(e) => setField("averageCostForTwo", e.target.value)}
                    disabled={saving}
                  />
                </Col>
                <Col md={4}>
                  <Form.Label className="fw-semibold small">Price per Person</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.pricePerPerson}
                    onChange={(e) => setField("pricePerPerson", e.target.value)}
                    disabled={saving}
                  />
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Facilities */}
          <Card className="shadow-sm border-0 rounded-3 mb-3">
            <Card.Body>
              <h6 className="fw-bold mb-3">Facilities &amp; Highlights</h6>
              <Row className="g-2">
                {[
                  ["hasParking", "Parking"],
                  ["hasWifi", "Free Wi-Fi"],
                  ["hasAc", "Air-conditioned"],
                  ["hasOutdoorSeating", "Outdoor Seating"],
                  ["hasLiveMusic", "Live Music"],
                  ["servesAlcohol", "Serves Alcohol"],
                  ["isPureVeg", "Pure Veg"],
                  ["isFamilyFriendly", "Family Friendly"],
                  ["petFriendly", "Pet Friendly"],
                  ["homeDelivery", "Home Delivery"],
                  ["takeAway", "Take Away"],
                ].map(([key, label]) => (
                  <Col xs={6} md={4} lg={3} key={key}>
                    <Form.Check
                      type="switch"
                      id={`pe-${key}`}
                      label={label}
                      checked={!!form[key]}
                      onChange={(e) => setField(key, e.target.checked)}
                      disabled={saving}
                    />
                  </Col>
                ))}
              </Row>
            </Card.Body>
          </Card>

          {/* Policies */}
          <Card className="shadow-sm border-0 rounded-3 mb-3">
            <Card.Body>
              <h6 className="fw-bold mb-3">Policies (single-paragraph summary)</h6>
              <Row className="g-3">
                <Col md={12}>
                  <Form.Label className="fw-semibold small">Reservation Policy</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={form.reservationPolicy}
                    onChange={(e) => setField("reservationPolicy", e.target.value)}
                    disabled={saving}
                  />
                </Col>
                <Col md={12}>
                  <Form.Label className="fw-semibold small">Cancellation Policy</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={form.cancellationPolicy}
                    onChange={(e) => setField("cancellationPolicy", e.target.value)}
                    disabled={saving}
                  />
                </Col>
              </Row>
              <div className="text-muted small mt-2">
                More granular multi-row policies are managed by the platform admin.
              </div>
            </Card.Body>
          </Card>

          {/* Action bar */}
          <div className="d-flex justify-content-end gap-2 mb-3">
            <Button
              variant="outline-secondary"
              onClick={() => navigate("/restaurant-extranet/profile")}
              disabled={saving}
            >
              <FaArrowLeft className="me-2" />
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || !!validationError}
              title={validationError || "Save changes"}
            >
              {saving ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Saving…
                </>
              ) : (
                <>
                  <FaSave className="me-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </RestaurantExtranetLayout>
  );
};

export default RestaurantExtranetProfileEdit;
