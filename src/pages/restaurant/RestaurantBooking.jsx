import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Card,
  Form,
  Row,
  Col,
  Button,
  Badge,
  Spinner,
  Alert,
  Modal,
  Table,
} from "react-bootstrap";
import { FaArrowLeft, FaUtensils, FaCheckCircle, FaSave, FaCheck } from "react-icons/fa";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import RestaurantMenuModal from "./RestaurantMenuModal";
import RestaurantSummary from "./RestaurantSummary";

const SEATING_PREFERENCES = ["Indoor", "Outdoor", "AC", "Non-AC", "Smoking", "Non-Smoking"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Brunch", "High Tea"];
const OCCASIONS = ["None", "Birthday", "Anniversary", "Business Meeting", "Family Gathering", "Date"];
const PAYMENT_MODES = ["Cash", "Card", "UPI", "Online", "Pay at Restaurant"];

const RestaurantBooking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = location.state || {};
  const restaurant = incoming.restaurant;

  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [form, setForm] = useState({
    bookingDate: incoming.bookingDate || incoming.checkIn || "",
    bookingTime: incoming.bookingTime || "",
    memberCount: incoming.memberCount || 2,
    customerName: "",
    customerMobile: "",
    customerEmail: "",
    specialRequest: "",
    agentId: incoming.agentId || "",
    agentName: incoming.agentName || "",
    seatingPreference: "Indoor",
    mealType: "Dinner",
    occasion: "None",
    dietaryNotes: "",
    paymentMode: "Pay at Restaurant",
    advancePayment: "",
  });

  // Redirect back if user lands here directly without a restaurant context.
  useEffect(() => {
    if (!restaurant) {
      toast.error("Please select a restaurant first.");
      navigate("/new-booking/restaurant");
    }
  }, [restaurant, navigate]);

  if (!restaurant) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleConfirmMenuSelection = (items) => {
    setSelectedItems(items);
  };

  /** Returns an errors object, empty when the form is valid. */
  const validate = () => {
    const err = {};
    if (!form.bookingDate) err.bookingDate = "Booking date is required";
    if (!form.bookingTime) err.bookingTime = "Booking time is required";
    if (!form.memberCount || Number(form.memberCount) < 1)
      err.memberCount = "At least 1 member";
    if (!form.customerName.trim()) err.customerName = "Customer name is required";
    if (!form.customerMobile.trim()) err.customerMobile = "Mobile is required";
    else if (!/^[0-9+\-\s]{7,15}$/.test(form.customerMobile))
      err.customerMobile = "Invalid mobile number";
    if (form.customerEmail && !/\S+@\S+\.\S+/.test(form.customerEmail))
      err.customerEmail = "Invalid email";
    return err;
  };

  /** Submit handler — validates then opens the order summary modal.
   *  The actual API call happens only when the user clicks "Confirm Booking"
   *  inside the modal. */
  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate();
    setErrors(err);
    if (Object.keys(err).length) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSummaryOpen(true);
  };

  const computeTotals = () => {
    const subTotal = selectedItems.reduce((a, b) => a + Number(b.total || 0), 0);
    const taxPercent = Number(restaurant.taxPercent || 0);
    const taxAmount = (subTotal * taxPercent) / 100;
    const grandTotal = subTotal + taxAmount;
    return { subTotal, taxPercent, taxAmount, grandTotal };
  };

  /** Final commit — POST to backend, then redirect to bookings list. */
  const confirmAndSave = async () => {
    const { subTotal, taxPercent, taxAmount, grandTotal } = computeTotals();
    setSaving(true);
    try {
      const payload = {
        restaurantId: restaurant.id,
        restaurantName: restaurant.restaurantName,
        ...form,
        items: selectedItems.map((it) => ({
          menuId: it.menuId,
          menuName: it.menuName,
          qty: it.qty,
          price: it.price,
          total: it.total,
        })),
        subTotal,
        taxPercent,
        taxAmount,
        totalAmount: grandTotal,
      };

      const res = await axiosInstance.post("/api/restaurant/booking/save", payload);
      const bookingNo = res.data?.bookingNumber || "RB-" + Date.now();

      setSummaryOpen(false);
      await Swal.fire({
        icon: "success",
        title: "Booking Confirmed!",
        html: `<div>Your booking number is <strong>${bookingNo}</strong></div>`,
        confirmButtonText: "View Bookings",
      });
      navigate("/booking-details/restaurant-booking-list");
    } catch (er) {
      console.error(er);
      toast.error(er?.response?.data?.message || "Failed to save booking");
    } finally {
      setSaving(false);
    }
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
              Book a Table
            </h4>
            <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)}>
              <FaArrowLeft className="me-1" /> Back
            </Button>
          </div>

          <Form onSubmit={handleSubmit}>
            <Row>
              <Col lg={8}>
                <Card className="mb-3 shadow-sm">
                  <Card.Header className="bg-white fw-semibold">Restaurant</Card.Header>
                  <Card.Body>
                    <Row className="g-3 align-items-center">
                      <Col md={3}>
                        <img
                          src={
                            restaurant.images?.[0] ||
                            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=60"
                          }
                          alt="r"
                          style={{
                            width: "100%",
                            height: 120,
                            objectFit: "cover",
                            borderRadius: 6,
                          }}
                        />
                      </Col>
                      <Col md={9}>
                        <h5 className="mb-1">{restaurant.restaurantName}</h5>
                        <div className="text-muted small">{restaurant.place}</div>
                        <div className="small">
                          {restaurant.openTime} - {restaurant.closeTime}
                        </div>
                        <div className="mt-1 d-flex flex-wrap gap-1">
                          {(restaurant.cuisineTypes || []).slice(0, 4).map((c) => (
                            <Badge key={c} bg="light" text="dark" className="border">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                <Card className="mb-3 shadow-sm">
                  <Card.Header className="bg-white fw-semibold">Booking Details</Card.Header>
                  <Card.Body>
                    <Row className="g-3">
                      <Col md={4}>
                        <Form.Label>Booking Date *</Form.Label>
                        <Form.Control
                          type="date"
                          name="bookingDate"
                          value={form.bookingDate}
                          onChange={handleChange}
                          min={new Date().toISOString().slice(0, 10)}
                          isInvalid={!!errors.bookingDate}
                        />
                        <Form.Control.Feedback type="invalid">{errors.bookingDate}</Form.Control.Feedback>
                      </Col>
                      <Col md={4}>
                        <Form.Label>Booking Time *</Form.Label>
                        <Form.Control
                          type="time"
                          name="bookingTime"
                          value={form.bookingTime}
                          onChange={handleChange}
                          isInvalid={!!errors.bookingTime}
                        />
                        <Form.Control.Feedback type="invalid">{errors.bookingTime}</Form.Control.Feedback>
                      </Col>
                      <Col md={4}>
                        <Form.Label>Members *</Form.Label>
                        <Form.Control
                          type="number"
                          min={1}
                          name="memberCount"
                          value={form.memberCount}
                          onChange={handleChange}
                          isInvalid={!!errors.memberCount}
                        />
                        <Form.Control.Feedback type="invalid">{errors.memberCount}</Form.Control.Feedback>
                      </Col>
                      <Col md={4}>
                        <Form.Label>Meal Type</Form.Label>
                        <Form.Select name="mealType" value={form.mealType} onChange={handleChange}>
                          {MEAL_TYPES.map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </Form.Select>
                      </Col>
                      <Col md={4}>
                        <Form.Label>Seating Preference</Form.Label>
                        <Form.Select
                          name="seatingPreference"
                          value={form.seatingPreference}
                          onChange={handleChange}
                        >
                          {SEATING_PREFERENCES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </Form.Select>
                      </Col>
                      <Col md={4}>
                        <Form.Label>Occasion</Form.Label>
                        <Form.Select name="occasion" value={form.occasion} onChange={handleChange}>
                          {OCCASIONS.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                <Card className="mb-3 shadow-sm">
                  <Card.Header className="bg-white fw-semibold">Customer Details</Card.Header>
                  <Card.Body>
                    <Row className="g-3">
                      <Col md={4}>
                        <Form.Label>Customer Name *</Form.Label>
                        <Form.Control
                          name="customerName"
                          value={form.customerName}
                          onChange={handleChange}
                          isInvalid={!!errors.customerName}
                        />
                        <Form.Control.Feedback type="invalid">{errors.customerName}</Form.Control.Feedback>
                      </Col>
                      <Col md={4}>
                        <Form.Label>Mobile *</Form.Label>
                        <Form.Control
                          name="customerMobile"
                          value={form.customerMobile}
                          onChange={handleChange}
                          isInvalid={!!errors.customerMobile}
                        />
                        <Form.Control.Feedback type="invalid">{errors.customerMobile}</Form.Control.Feedback>
                      </Col>
                      <Col md={4}>
                        <Form.Label>Email</Form.Label>
                        <Form.Control
                          type="email"
                          name="customerEmail"
                          value={form.customerEmail}
                          onChange={handleChange}
                          isInvalid={!!errors.customerEmail}
                        />
                        <Form.Control.Feedback type="invalid">{errors.customerEmail}</Form.Control.Feedback>
                      </Col>
                      <Col md={6}>
                        <Form.Label>Agent</Form.Label>
                        <Form.Control
                          name="agentName"
                          value={form.agentName}
                          onChange={handleChange}
                          placeholder="Agent name"
                        />
                      </Col>
                      <Col md={6}>
                        <Form.Label>Payment Mode</Form.Label>
                        <Form.Select
                          name="paymentMode"
                          value={form.paymentMode}
                          onChange={handleChange}
                        >
                          {PAYMENT_MODES.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </Form.Select>
                      </Col>
                      <Col md={12}>
                        <Form.Label>Dietary Notes / Allergies</Form.Label>
                        <Form.Control
                          name="dietaryNotes"
                          value={form.dietaryNotes}
                          onChange={handleChange}
                          placeholder="e.g. Nut allergy, Jain food"
                        />
                      </Col>
                      <Col md={12}>
                        <Form.Label>Special Request</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          name="specialRequest"
                          value={form.specialRequest}
                          onChange={handleChange}
                        />
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                <Card className="mb-3 shadow-sm">
                  <Card.Header className="bg-white d-flex justify-content-between align-items-center fw-semibold">
                    <span>Pre-Select Menu (optional)</span>
                    <Button size="sm" variant="outline-success" onClick={() => setMenuModalOpen(true)}>
                      <FaUtensils className="me-1" /> Choose Items
                    </Button>
                  </Card.Header>
                  <Card.Body>
                    {selectedItems.length === 0 ? (
                      <Alert variant="light" className="mb-0 text-muted">
                        No items selected. You can add menu items now or order at the restaurant.
                      </Alert>
                    ) : (
                      <ul className="list-unstyled mb-0">
                        {selectedItems.map((it, i) => (
                          <li key={i} className="d-flex justify-content-between border-bottom py-1">
                            <span>
                              <FaCheckCircle className="text-success me-2" />
                              {it.menuName}{" "}
                              <Badge bg="light" text="dark">
                                x{it.qty}
                              </Badge>
                            </span>
                            <span>₹ {Number(it.total).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={4}>
                <RestaurantSummary
                  restaurant={restaurant}
                  bookingDate={form.bookingDate}
                  bookingTime={form.bookingTime}
                  memberCount={form.memberCount}
                  customerName={form.customerName}
                  agentName={form.agentName}
                  items={selectedItems}
                  taxPercent={restaurant.taxPercent}
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-100 mt-3"
                  disabled={saving}
                >
                  <FaCheck className="me-2" /> Review &amp; Submit
                </Button>
              </Col>
            </Row>
          </Form>
        </div>
      </div>

      <RestaurantMenuModal
        show={menuModalOpen}
        onHide={() => setMenuModalOpen(false)}
        restaurant={restaurant}
        mode="select"
        initialSelected={selectedItems}
        onConfirm={handleConfirmMenuSelection}
      />

      {/* Order summary confirm modal — final commit happens here.
       *  Validation has already passed by the time this opens. */}
      <Modal
        show={summaryOpen}
        onHide={() => !saving && setSummaryOpen(false)}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            <FaCheckCircle className="text-success me-2" />
            Order Summary
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {(() => {
            const { subTotal, taxPercent, taxAmount, grandTotal } = computeTotals();
            return (
              <>
                <Row className="g-2 mb-3">
                  <Col md={6}><strong>Restaurant:</strong> {restaurant.restaurantName}</Col>
                  <Col md={6}><strong>Place:</strong> {restaurant.place}</Col>
                  <Col md={6}>
                    <strong>Date / Time:</strong> {form.bookingDate} {form.bookingTime}
                  </Col>
                  <Col md={6}><strong>Members:</strong> {form.memberCount}</Col>
                  <Col md={6}><strong>Meal Type:</strong> {form.mealType}</Col>
                  <Col md={6}><strong>Seating:</strong> {form.seatingPreference}</Col>
                  <Col md={6}>
                    <strong>Customer:</strong> {form.customerName} ({form.customerMobile})
                  </Col>
                  <Col md={6}><strong>Agent:</strong> {form.agentName || "-"}</Col>
                  <Col md={12}>
                    <strong>Special Request:</strong> {form.specialRequest || "-"}
                  </Col>
                </Row>

                <div className="fw-semibold mb-2">Selected Items</div>
                {selectedItems.length === 0 ? (
                  <Alert variant="light" className="mb-2 text-muted">
                    No items pre-selected (guest will order at the restaurant).
                  </Alert>
                ) : (
                  <Table size="sm" bordered>
                    <thead className="table-light">
                      <tr>
                        <th>Item</th>
                        <th className="text-end">Qty</th>
                        <th className="text-end">Price</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((it, i) => (
                        <tr key={i}>
                          <td>{it.menuName}</td>
                          <td className="text-end">{it.qty}</td>
                          <td className="text-end">₹ {Number(it.price).toFixed(2)}</td>
                          <td className="text-end">₹ {Number(it.total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}

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
              </>
            );
          })()}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={saving} onClick={() => setSummaryOpen(false)}>
            Edit
          </Button>
          <Button variant="primary" disabled={saving} onClick={confirmAndSave}>
            {saving ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Saving...
              </>
            ) : (
              <>
                <FaSave className="me-2" /> Confirm Booking
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default RestaurantBooking;
