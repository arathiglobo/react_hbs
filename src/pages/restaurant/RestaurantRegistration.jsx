import React, { useEffect, useState } from "react";
import {
  Card,
  Button,
  Form,
  Row,
  Col,
  Table,
  Modal,
  Badge,
  Image,
} from "react-bootstrap";
import {
  FaPlus,
  FaTrash,
  FaEdit,
  FaUtensils,
  FaMapMarkerAlt,
  FaImages,
  FaSave,
  FaArrowLeft,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";

/**
 * Restaurant Registration Form.
 * Backend contract (expected):
 *   POST /api/restaurant/save  (multipart/form-data)
 *     - JSON fields for restaurant, menu list
 *     - "images" : File[]      (multiple restaurant images)
 *     - "menuImage_<index>" : File   (per-menu image)
 *   GET  /api/restaurant/{id}
 */
const CUISINE_OPTIONS = [
  "Indian",
  "Chinese",
  "Italian",
  "Continental",
  "Arabic",
  "Mughlai",
  "South Indian",
  "North Indian",
  "Thai",
  "Japanese",
  "Mexican",
  "Fast Food",
  "Seafood",
  "BBQ",
  "Bakery",
];

const FOOD_TYPES = ["Veg", "Non-Veg", "Both", "Vegan"];
const DRESS_CODES = ["Casual", "Smart Casual", "Formal", "Beach Wear"];
const MEAL_CATEGORIES = [
  "Starter",
  "Main Course",
  "Snacks",
  "Soup",
  "Salad",
  "Dessert",
  "Beverage",
  "Breakfast",
  "Special",
];

const initialState = {
  // Basic details
  restaurantName: "",
  place: "",
  address: "",
  locationUrl: "",
  latitude: "",
  longitude: "",
  contactNumber: "",
  alternateNumber: "",
  email: "",
  website: "",
  openTime: "",
  closeTime: "",
  description: "",
  status: "Active",

  // Extra useful fields
  cuisineTypes: [],
  foodType: "Both",
  averageCostForTwo: "",
  seatingCapacity: "",
  numberOfTables: "",
  dressCode: "Casual",
  reservationPolicy: "",
  cancellationPolicy: "",

  // Amenities (boolean toggles)
  hasParking: false,
  hasWifi: false,
  hasAc: true,
  hasOutdoorSeating: false,
  hasLiveMusic: false,
  servesAlcohol: false,
  isPureVeg: false,
  isFamilyFriendly: true,
  petFriendly: false,
  homeDelivery: false,
  takeAway: true,

  // Social
  facebookUrl: "",
  instagramUrl: "",

  // Tax
  gstNumber: "",
  taxPercent: "",
};

const emptyMenuRow = () => ({
  menuName: "",
  category: "Main Course",
  price: "",
  description: "",
  isVeg: true,
  isAvailable: true,
  image: null,
  imagePreview: "",
});

const RestaurantRegistration = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialState);
  const [images, setImages] = useState([]); // File[]
  const [imagePreviews, setImagePreviews] = useState([]);
  const [menuList, setMenuList] = useState([emptyMenuRow()]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const toggleCuisine = (c) => {
    setFormData((prev) => {
      const has = prev.cuisineTypes.includes(c);
      return {
        ...prev,
        cuisineTypes: has
          ? prev.cuisineTypes.filter((x) => x !== c)
          : [...prev.cuisineTypes, c],
      };
    });
  };

  const handleImagesUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeImage = (idx) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ---------- menu rows ---------- */
  const addMenuRow = () =>
    setMenuList((prev) => [...prev, emptyMenuRow()]);

  const removeMenuRow = (idx) =>
    setMenuList((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  const updateMenuRow = (idx, field, value) =>
    setMenuList((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );

  const handleMenuImage = (idx, file) => {
    if (!file) return;
    updateMenuRow(idx, "image", file);
    updateMenuRow(idx, "imagePreview", URL.createObjectURL(file));
  };

  /* ---------- validation ---------- */
  const validate = () => {
    const err = {};
    if (!formData.restaurantName.trim()) err.restaurantName = "Restaurant name is required";
    if (!formData.place.trim()) err.place = "Place is required";
    if (!formData.address.trim()) err.address = "Address is required";
    if (!formData.contactNumber.trim()) err.contactNumber = "Contact number is required";
    else if (!/^[0-9+\-\s]{7,15}$/.test(formData.contactNumber))
      err.contactNumber = "Invalid contact number";
    if (!formData.email.trim()) err.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) err.email = "Invalid email";
    if (!formData.openTime) err.openTime = "Open time is required";
    if (!formData.closeTime) err.closeTime = "Close time is required";
    if (!images.length) err.images = "Please upload at least 1 image";
    if (menuList.length === 0 || !menuList.some((m) => m.menuName.trim() && m.price))
      err.menu = "Add at least 1 menu item with name & price";

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  /* ---------- submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fix the errors in the form");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();

      // Build a single JSON-encoded "data" part — the backend deserialises
      // this into RestaurantDTO. Images travel as separate file parts.
      const data = {
        ...formData,
        menuList: menuList
          .filter((m) => m.menuName && m.price)
          .map((m) => ({
            menuName: m.menuName,
            category: m.category,
            price: Number(m.price) || 0,
            description: m.description || "",
            isVeg: !!m.isVeg,
            isAvailable: !!m.isAvailable,
          })),
      };
      // Send as a plain string field — wrapping in Blob would make Spring
      // bind this part as a MultipartFile instead of a String.
      fd.append("data", JSON.stringify(data));

      // Restaurant images (multi-file)
      images.forEach((file) => fd.append("images", file));

      // Per-menu image — index aligned with the filtered menuList sent in "data"
      const filtered = menuList.filter((m) => m.menuName && m.price);
      filtered.forEach((row, idx) => {
        if (row.image instanceof File) fd.append(`menuImage_${idx}`, row.image);
      });

      await axiosInstance.post("/api/restaurant/save", fd);

      Swal.fire({
        icon: "success",
        title: "Restaurant Registered",
        text: "Restaurant saved successfully.",
        timer: 1800,
        showConfirmButton: false,
      });
      navigate("/restaurant/list");
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to save restaurant");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData(initialState);
    setImages([]);
    setImagePreviews([]);
    setMenuList([emptyMenuRow()]);
    setErrors({});
  };

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1">
        <TopBar />
        <div className="p-3 p-md-4" style={{ background: "#f5f7fb", minHeight: "calc(100vh - 60px)" }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className="mb-0">
              <FaUtensils className="me-2 text-warning" />
              Register Restaurant
            </h4>
            <div>
              <Button variant="outline-secondary" size="sm" className="me-2" onClick={() => navigate("/restaurant/list")}>
                <FaArrowLeft className="me-1" /> Back to List
              </Button>
              <Button variant="outline-danger" size="sm" onClick={resetForm}>
                Reset
              </Button>
            </div>
          </div>

          <Form onSubmit={handleSubmit} noValidate>
            {/* Basic Details */}
            <Card className="mb-3 shadow-sm">
              <Card.Header className="bg-white fw-semibold">Basic Details</Card.Header>
              <Card.Body>
                <Row className="g-3">
                  <Col md={4}>
                    <Form.Label>Restaurant Name *</Form.Label>
                    <Form.Control
                      name="restaurantName"
                      value={formData.restaurantName}
                      onChange={handleChange}
                      isInvalid={!!errors.restaurantName}
                      placeholder="e.g. Spice Garden"
                    />
                    <Form.Control.Feedback type="invalid">{errors.restaurantName}</Form.Control.Feedback>
                  </Col>
                  <Col md={4}>
                    <Form.Label>Place / City *</Form.Label>
                    <Form.Control
                      name="place"
                      value={formData.place}
                      onChange={handleChange}
                      isInvalid={!!errors.place}
                      placeholder="e.g. Kochi"
                    />
                    <Form.Control.Feedback type="invalid">{errors.place}</Form.Control.Feedback>
                  </Col>
                  <Col md={4}>
                    <Form.Label>Status</Form.Label>
                    <Form.Select name="status" value={formData.status} onChange={handleChange}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </Form.Select>
                  </Col>

                  <Col md={6}>
                    <Form.Label>Address *</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      isInvalid={!!errors.address}
                    />
                    <Form.Control.Feedback type="invalid">{errors.address}</Form.Control.Feedback>
                  </Col>
                  <Col md={6}>
                    <Form.Label>
                      <FaMapMarkerAlt className="me-1 text-danger" />
                      Location URL (Google Maps)
                    </Form.Label>
                    <Form.Control
                      name="locationUrl"
                      value={formData.locationUrl}
                      onChange={handleChange}
                      placeholder="https://maps.google.com/..."
                    />
                    <Row className="mt-2 g-2">
                      <Col>
                        <Form.Control
                          name="latitude"
                          value={formData.latitude}
                          onChange={handleChange}
                          placeholder="Latitude"
                        />
                      </Col>
                      <Col>
                        <Form.Control
                          name="longitude"
                          value={formData.longitude}
                          onChange={handleChange}
                          placeholder="Longitude"
                        />
                      </Col>
                    </Row>
                  </Col>

                  <Col md={3}>
                    <Form.Label>Contact Number *</Form.Label>
                    <Form.Control
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={handleChange}
                      isInvalid={!!errors.contactNumber}
                    />
                    <Form.Control.Feedback type="invalid">{errors.contactNumber}</Form.Control.Feedback>
                  </Col>
                  <Col md={3}>
                    <Form.Label>Alternate Number</Form.Label>
                    <Form.Control
                      name="alternateNumber"
                      value={formData.alternateNumber}
                      onChange={handleChange}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Email *</Form.Label>
                    <Form.Control
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      isInvalid={!!errors.email}
                    />
                    <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
                  </Col>
                  <Col md={3}>
                    <Form.Label>Website</Form.Label>
                    <Form.Control name="website" value={formData.website} onChange={handleChange} />
                  </Col>

                  <Col md={3}>
                    <Form.Label>Open Time *</Form.Label>
                    <Form.Control
                      type="time"
                      name="openTime"
                      value={formData.openTime}
                      onChange={handleChange}
                      isInvalid={!!errors.openTime}
                    />
                    <Form.Control.Feedback type="invalid">{errors.openTime}</Form.Control.Feedback>
                  </Col>
                  <Col md={3}>
                    <Form.Label>Close Time *</Form.Label>
                    <Form.Control
                      type="time"
                      name="closeTime"
                      value={formData.closeTime}
                      onChange={handleChange}
                      isInvalid={!!errors.closeTime}
                    />
                    <Form.Control.Feedback type="invalid">{errors.closeTime}</Form.Control.Feedback>
                  </Col>
                  <Col md={3}>
                    <Form.Label>Avg. Cost For Two</Form.Label>
                    <Form.Control
                      type="number"
                      name="averageCostForTwo"
                      value={formData.averageCostForTwo}
                      onChange={handleChange}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Food Type</Form.Label>
                    <Form.Select name="foodType" value={formData.foodType} onChange={handleChange}>
                      {FOOD_TYPES.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>

                  <Col md={12}>
                    <Form.Label>Description</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Brief about the restaurant, ambience, specialties..."
                    />
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Additional Details */}
            <Card className="mb-3 shadow-sm">
              <Card.Header className="bg-white fw-semibold">Additional Details</Card.Header>
              <Card.Body>
                <Row className="g-3">
                  <Col md={12}>
                    <Form.Label>Cuisine Types</Form.Label>
                    <div className="d-flex flex-wrap gap-2">
                      {CUISINE_OPTIONS.map((c) => {
                        const active = formData.cuisineTypes.includes(c);
                        return (
                          <Badge
                            key={c}
                            bg={active ? "warning" : "light"}
                            text={active ? "dark" : "dark"}
                            className="py-2 px-3 border"
                            style={{ cursor: "pointer", fontWeight: 500 }}
                            onClick={() => toggleCuisine(c)}
                          >
                            {c}
                          </Badge>
                        );
                      })}
                    </div>
                  </Col>

                  <Col md={3}>
                    <Form.Label>Seating Capacity</Form.Label>
                    <Form.Control
                      type="number"
                      name="seatingCapacity"
                      value={formData.seatingCapacity}
                      onChange={handleChange}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Number Of Tables</Form.Label>
                    <Form.Control
                      type="number"
                      name="numberOfTables"
                      value={formData.numberOfTables}
                      onChange={handleChange}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Dress Code</Form.Label>
                    <Form.Select name="dressCode" value={formData.dressCode} onChange={handleChange}>
                      {DRESS_CODES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={3}>
                    <Form.Label>Tax %</Form.Label>
                    <Form.Control
                      type="number"
                      name="taxPercent"
                      value={formData.taxPercent}
                      onChange={handleChange}
                      placeholder="e.g. 5"
                    />
                  </Col>

                  <Col md={6}>
                    <Form.Label>Reservation Policy</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      name="reservationPolicy"
                      value={formData.reservationPolicy}
                      onChange={handleChange}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label>Cancellation Policy</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      name="cancellationPolicy"
                      value={formData.cancellationPolicy}
                      onChange={handleChange}
                    />
                  </Col>

                  <Col md={12}>
                    <Form.Label>Facilities</Form.Label>
                    <Row className="g-2">
                      {[
                        ["hasParking", "Parking"],
                        ["hasWifi", "WiFi"],
                        ["hasAc", "AC"],
                        ["hasOutdoorSeating", "Outdoor Seating"],
                        ["hasLiveMusic", "Live Music"],
                        ["servesAlcohol", "Bar / Alcohol"],
                        ["isPureVeg", "Pure Veg"],
                        ["isFamilyFriendly", "Family Friendly"],
                        ["petFriendly", "Pet Friendly"],
                        ["homeDelivery", "Home Delivery"],
                        ["takeAway", "Take Away"],
                      ].map(([key, label]) => (
                        <Col md={3} sm={4} xs={6} key={key}>
                          <Form.Check
                            type="switch"
                            id={`f-${key}`}
                            name={key}
                            checked={formData[key]}
                            onChange={handleChange}
                            label={label}
                          />
                        </Col>
                      ))}
                    </Row>
                  </Col>

                  <Col md={4}>
                    <Form.Label>Facebook URL</Form.Label>
                    <Form.Control name="facebookUrl" value={formData.facebookUrl} onChange={handleChange} />
                  </Col>
                  <Col md={4}>
                    <Form.Label>Instagram URL</Form.Label>
                    <Form.Control name="instagramUrl" value={formData.instagramUrl} onChange={handleChange} />
                  </Col>
                  <Col md={4}>
                    <Form.Label>GST Number</Form.Label>
                    <Form.Control name="gstNumber" value={formData.gstNumber} onChange={handleChange} />
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Images */}
            <Card className="mb-3 shadow-sm">
              <Card.Header className="bg-white fw-semibold">
                <FaImages className="me-2 text-info" />
                Restaurant Images *
              </Card.Header>
              <Card.Body>
                <Form.Control type="file" multiple accept="image/*" onChange={handleImagesUpload} />
                {errors.images && <div className="text-danger small mt-1">{errors.images}</div>}
                {imagePreviews.length > 0 && (
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="position-relative" style={{ width: 120, height: 90 }}>
                        <Image
                          src={src}
                          alt={`img-${i}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                          onClick={() => setPreviewImage(src)}
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removeImage(i)}
                          style={{
                            position: "absolute",
                            top: 2,
                            right: 2,
                            padding: "0 6px",
                            lineHeight: 1.1,
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Menu */}
            <Card className="mb-3 shadow-sm">
              <Card.Header className="bg-white fw-semibold d-flex justify-content-between align-items-center">
                <span>
                  <FaUtensils className="me-2 text-success" />
                  Menu Items
                </span>
                <Button size="sm" variant="success" onClick={addMenuRow}>
                  <FaPlus className="me-1" /> Add Menu
                </Button>
              </Card.Header>
              <Card.Body className="p-0">
                <Table responsive bordered hover className="mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Menu Name</th>
                      <th>Category</th>
                      <th style={{ width: 110 }}>Price</th>
                      <th>Description</th>
                      <th style={{ width: 90 }}>Veg</th>
                      <th style={{ width: 110 }}>Available</th>
                      <th style={{ width: 130 }}>Image</th>
                      <th style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuList.map((row, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>
                          <Form.Control
                            value={row.menuName}
                            onChange={(e) => updateMenuRow(idx, "menuName", e.target.value)}
                            placeholder="Chicken Biriyani"
                          />
                        </td>
                        <td>
                          <Form.Select
                            value={row.category}
                            onChange={(e) => updateMenuRow(idx, "category", e.target.value)}
                          >
                            {MEAL_CATEGORIES.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </Form.Select>
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            value={row.price}
                            onChange={(e) => updateMenuRow(idx, "price", e.target.value)}
                          />
                        </td>
                        <td>
                          <Form.Control
                            value={row.description}
                            onChange={(e) => updateMenuRow(idx, "description", e.target.value)}
                            placeholder="optional"
                          />
                        </td>
                        <td className="text-center">
                          <Form.Check
                            type="switch"
                            id={`veg-${idx}`}
                            checked={row.isVeg}
                            onChange={(e) => updateMenuRow(idx, "isVeg", e.target.checked)}
                          />
                        </td>
                        <td className="text-center">
                          <Form.Check
                            type="switch"
                            id={`avl-${idx}`}
                            checked={row.isAvailable}
                            onChange={(e) => updateMenuRow(idx, "isAvailable", e.target.checked)}
                          />
                        </td>
                        <td>
                          {row.imagePreview ? (
                            <Image
                              src={row.imagePreview}
                              alt="menu"
                              style={{
                                width: 80,
                                height: 50,
                                objectFit: "cover",
                                cursor: "pointer",
                              }}
                              onClick={() => setPreviewImage(row.imagePreview)}
                            />
                          ) : (
                            <Form.Control
                              type="file"
                              size="sm"
                              accept="image/*"
                              onChange={(e) => handleMenuImage(idx, e.target.files[0])}
                            />
                          )}
                        </td>
                        <td className="text-center">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            disabled={menuList.length === 1}
                            onClick={() => removeMenuRow(idx)}
                          >
                            <FaTrash />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                {errors.menu && <div className="text-danger small p-2">{errors.menu}</div>}
              </Card.Body>
            </Card>

            <div className="d-flex justify-content-end gap-2 pb-4">
              <Button variant="outline-secondary" type="button" onClick={() => navigate("/restaurant/list")}>
                Cancel
              </Button>
              <Button type="submit" variant="warning" disabled={saving}>
                <FaSave className="me-1" />
                {saving ? "Saving..." : "Save Restaurant"}
              </Button>
            </div>
          </Form>
        </div>
      </div>

      <Modal show={!!previewImage} onHide={() => setPreviewImage(null)} centered size="lg">
        <Modal.Body className="p-0">
          {previewImage && <img src={previewImage} alt="preview" style={{ width: "100%" }} />}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default RestaurantRegistration;
