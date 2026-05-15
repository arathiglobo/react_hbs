import React, { useEffect, useMemo, useState } from "react";
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
import { FaArrowLeft, FaUtensils, FaCheckCircle, FaSave, FaCheck, FaFilePdf, FaExternalLinkAlt } from "react-icons/fa";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import RestaurantSummary from "./RestaurantSummary";

const SEATING_PREFERENCES = ["Indoor", "Outdoor", "AC", "Non-AC", "Smoking", "Non-Smoking"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Brunch", "High Tea"];
const OCCASIONS = ["None", "Birthday", "Anniversary", "Business Meeting", "Family Gathering", "Date"];
// Only two payment paths are supported:
//   Cash → settles against the agent's credit limit (backend deducts on save)
//   Card → triggers the online-payment modal; backend keeps the booking
//          in "Not Paid" until the gateway confirms.
const PAYMENT_MODES = ["Cash", "Card"];

const RestaurantBooking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = location.state || {};
  const restaurant = incoming.restaurant;

  // Booking no longer captures per-item selections — operators upload menu
  // PDFs on registration and the customer orders at the venue. We keep an
  // empty selection so the existing payload shape (items: []) keeps working
  // until the backend stops expecting that field.
  const selectedItems = [];
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  // Modal shown when paymentMode === "Card" is picked — informs the user
  // they'll be redirected to the online payment gateway.
  const [cardModalOpen, setCardModalOpen] = useState(false);
  // Live agent balance forwarded from the search page. Used to pop up the
  // "Not enough credit limit" warning client-side before hitting the API.
  const agentBalance =
    typeof incoming.agentBalance === "number"
      ? incoming.agentBalance
      : null;

  // What modes does this restaurant offer? Defaults to "Both" when missing.
  const offeredModes = restaurant?.bookingModes || "Both";
  const initialMode = offeredModes === "Walk-in" ? "Walk-in" : "Advance";

  const [form, setForm] = useState({
    bookingMode: initialMode,
    // These three are pre-filled from the search criteria and rendered as
    // read-only fields below (the user already picked them upstream — no
    // reason to let them drift on the booking page).
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
    mealType: incoming.mealType && incoming.mealType !== "Any" ? incoming.mealType : "Dinner",
    occasion: "None",
    dietaryNotes: "",
    // Defaulted to Cash (agent credit) per spec — the user must explicitly
    // switch to Card to go through the online-payment modal.
    paymentMode: "Cash",
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
    // Card flow → inform the user we're going to an online payment screen.
    // We just show a modal for now; the actual gateway redirect is wired in
    // when the payment integration lands.
    if (name === "paymentMode" && value === "Card") {
      setCardModalOpen(true);
    }
  };

  /** Returns an errors object, empty when the form is valid. */
  const validate = () => {
    const err = {};
    const isAdvance = form.bookingMode === "Advance";
    if (!form.bookingDate) err.bookingDate = "Booking date is required";
    // Time is required only for Advance bookings; Walk-ins are flexible.
    if (isAdvance && !form.bookingTime) err.bookingTime = "Booking time is required";
    // Enforce the venue's advance-booking lead time on the client too.
    if (isAdvance && form.bookingDate && form.bookingTime) {
      const slot = new Date(`${form.bookingDate}T${form.bookingTime}`);
      const minHours = Number(restaurant?.advanceBookingMinHours) || 0;
      const earliest = new Date(Date.now() + minHours * 3600 * 1000);
      if (!isNaN(slot.getTime()) && slot < earliest) {
        const hhmm = `${String(earliest.getHours()).padStart(2, "0")}:${String(
          earliest.getMinutes()
        ).padStart(2, "0")}`;
        const dateStr = earliest.toLocaleDateString();
        err.bookingTime =
          `Advance bookings need at least ${minHours} hour(s) notice. ` +
          `Earliest valid slot is ${hhmm} on ${dateStr}.`;
      }
    }
    if (!form.memberCount || Number(form.memberCount) < 1)
      err.memberCount = "At least 1 member";
    if (!form.customerName.trim()) err.customerName = "Customer name is required";
    if (!form.customerMobile.trim()) err.customerMobile = "Mobile is required";
    else if (!/^[0-9+\-\s]{7,15}$/.test(form.customerMobile))
      err.customerMobile = "Invalid mobile number";
    if (form.customerEmail && !/\S+@\S+\.\S+/.test(form.customerEmail))
      err.customerEmail = "Invalid email";
    // Restaurants must have a per-person rate set on the registration page
    // for the booking math to work. Without it, subTotal would be 0 and
    // the agent credit-limit + invoice flow downstream would be broken.
    if (!Number(restaurant?.pricePerPerson)) {
      err._rate =
        "This restaurant has no per-person rate configured. Ask the operator to set 'Rate Per Person' on the registration page.";
    }
    return err;
  };

  /** Submit handler — validates then opens the order summary modal.
   *  The actual API call happens only when the user clicks "Confirm Booking"
   *  inside the modal.
   *
   *  When paymentMode === "Cash" we also pre-check the agent's credit
   *  limit against the computed grand total and, if it's insufficient,
   *  pop up a SweetAlert instead of opening the summary. This keeps
   *  the same UX the backend enforces (which throws 400 when credit is
   *  short).
   */
  /** Friendly label → field-key map so the toast can name the missing
   *  inputs instead of saying "Please fix the highlighted fields". */
  const FIELD_LABELS = {
    bookingDate: "Booking Date",
    bookingTime: "Booking Time",
    memberCount: "Members",
    customerName: "Customer Name",
    customerMobile: "Mobile",
    customerEmail: "Email",
    _rate: "Per-Person Rate (set on restaurant registration)",
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate();
    setErrors(err);
    if (Object.keys(err).length) {
      const labels = Object.keys(err).map((k) => FIELD_LABELS[k] || k);
      const head = labels.slice(0, 3).join(", ");
      const more = labels.length > 3 ? ` (+${labels.length - 3} more)` : "";
      toast.error(`Please fill: ${head}${more}`);
      // Scroll the first inline error into view so the user can see it.
      setTimeout(() => {
        const first = document.querySelector(".is-invalid, .text-danger");
        first?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
      return;
    }
    // Credit-limit guard — only for the Cash flow.
    if (form.paymentMode === "Cash" && agentBalance != null) {
      const { grandTotal } = computeTotals();
      if (Number(grandTotal) > Number(agentBalance)) {
        Swal.fire({
          icon: "warning",
          title: "Not enough credit limit",
          html:
            `<div class="text-start">` +
            `Agent <strong>${form.agentName || ""}</strong> has only ` +
            `<strong>₹ ${Number(agentBalance).toFixed(2)}</strong> credit ` +
            `available, but this booking costs ` +
            `<strong>₹ ${Number(grandTotal).toFixed(2)}</strong>.` +
            `<br/><br/>` +
            `Reduce the order, top up the agent's credit, or switch to ` +
            `<strong>Card</strong> for an online payment.` +
            `</div>`,
          confirmButtonText: "OK",
        });
        return;
      }
    }
    setSummaryOpen(true);
  };

  /**
   * Earliest acceptable HH:MM for the picked booking date, given the
   * venue's advance-booking lead time. When the date is today, the time
   * picker can only allow now + leadHours. For any future date the venue
   * is wide open (00:00). When the date is in the past nothing's valid;
   * we still return "00:00" so the picker doesn't refuse to render.
   *
   * Used both as the `min` attribute on the time input (so the browser
   * picker visually grays out impossible slots) and to drive the helper
   * text below the input.
   */
  const earliestSlot = useMemo(() => {
    const leadHours = Number(restaurant?.advanceBookingMinHours) || 0;
    if (!form.bookingDate) return null;
    const earliest = new Date(Date.now() + leadHours * 3600 * 1000);
    const picked = new Date(`${form.bookingDate}T00:00:00`);
    // If the picked date is later than today, any time of day is fine.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (picked.getTime() > today.getTime()) return { hhmm: "00:00", date: picked };
    // Same day or past: enforce now + leadHours.
    const hh = String(earliest.getHours()).padStart(2, "0");
    const mm = String(earliest.getMinutes()).padStart(2, "0");
    return { hhmm: `${hh}:${mm}`, date: earliest, sameDay: true };
  }, [form.bookingDate, restaurant?.advanceBookingMinHours]);

  /**
   * Totals are now driven by the restaurant's per-person rate (set on the
   * registration page) and the member count picked on the search page —
   * the old item-by-item subtotal disappeared when we replaced manual
   * menu rows with menu-PDF uploads.
   *
   *   subTotal   = pricePerPerson × memberCount
   *   taxAmount  = subTotal × taxPercent / 100
   *   grandTotal = subTotal + taxAmount
   */
  const computeTotals = () => {
    const rate = Number(restaurant?.pricePerPerson || 0);
    const members = Number(form.memberCount || 0);
    const subTotal = rate * members;
    const taxPercent = Number(restaurant.taxPercent || 0);
    const taxAmount = (subTotal * taxPercent) / 100;
    const grandTotal = subTotal + taxAmount;
    return { subTotal, taxPercent, taxAmount, grandTotal, rate, members };
  };

  /** Final commit — POST to backend, then redirect to bookings list. */
  const confirmAndSave = async () => {
    const { subTotal, taxPercent, taxAmount, grandTotal, rate } = computeTotals();
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
        // Snapshot the per-person rate that drove subTotal — keeps the
        // booking auditable if the restaurant's rate changes later.
        pricePerPerson: rate,
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
            {/* Back to search — uses an explicit route + replace so the
                search page reads the persisted sessionStorage criteria. */}
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() =>
                navigate("/new-booking/restaurant", { replace: true })
              }
            >
              <FaArrowLeft className="me-1" /> Back
            </Button>
          </div>

          {/* Surface the per-person-rate-missing error above the form so
              the agent can act on it without scrolling. */}
          {errors._rate && (
            <Alert variant="warning" className="mb-3">
              {errors._rate}
            </Alert>
          )}

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
                    {/* Booking mode picker — only renders the modes this restaurant offers. */}
                    <Row className="g-3 mb-2">
                      <Col md={12}>
                        <Form.Label className="fw-semibold">Booking Mode *</Form.Label>
                        <div className="d-flex flex-wrap gap-3">
                          {(offeredModes === "Both" || offeredModes === "Advance") && (
                            <Form.Check
                              type="radio"
                              id="mode-advance"
                              name="bookingMode"
                              label={
                                <span>
                                  <strong>Advance Booking</strong>{" "}
                                  <span className="text-muted small">
                                    — reserved slot
                                    {restaurant?.advanceBookingMinHours
                                      ? ` (min ${restaurant.advanceBookingMinHours}h notice)`
                                      : ""}
                                  </span>
                                </span>
                              }
                              value="Advance"
                              checked={form.bookingMode === "Advance"}
                              onChange={handleChange}
                            />
                          )}
                          {(offeredModes === "Both" || offeredModes === "Walk-in") && (
                            <Form.Check
                              type="radio"
                              id="mode-walkin"
                              name="bookingMode"
                              label={
                                <span>
                                  <strong>Free to Available</strong>{" "}
                                  <span className="text-muted small">
                                    — walk-in, no specific slot
                                  </span>
                                </span>
                              }
                              value="Walk-in"
                              checked={form.bookingMode === "Walk-in"}
                              onChange={handleChange}
                            />
                          )}
                        </div>
                      </Col>
                    </Row>

                    <Row className="g-3">
                      {/* These three fields are read-only — already captured on
                          the search page. The "Back" button lets the user go
                          edit them upstream. */}
                      <Col md={4}>
                        <Form.Label>Booking Date *</Form.Label>
                        <Form.Control
                          type="date"
                          name="bookingDate"
                          value={form.bookingDate}
                          readOnly
                          plaintext={false}
                          className="bg-light"
                        />
                        <Form.Text muted>From search — go back to change.</Form.Text>
                      </Col>
                      <Col md={4}>
                        <Form.Label>
                          Booking Time {form.bookingMode === "Advance" ? "*" : ""}
                        </Form.Label>
                        <Form.Control
                          type="time"
                          name="bookingTime"
                          value={form.bookingTime}
                          onChange={handleChange}
                          isInvalid={!!errors.bookingTime}
                          // When the booking date is today, refuse times
                          // before now+leadHours at the browser-picker level
                          // so the user can't even land on a slot that will
                          // then fail validation. Skipped for Walk-in.
                          min={
                            form.bookingMode === "Advance" &&
                            earliestSlot?.sameDay
                              ? earliestSlot.hhmm
                              : undefined
                          }
                          placeholder={
                            form.bookingMode === "Walk-in" ? "Anytime during open hours" : ""
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {errors.bookingTime}
                        </Form.Control.Feedback>
                        {form.bookingMode === "Walk-in" ? (
                          <Form.Text muted>
                            Walk-in — guest can arrive any time during open hours.
                          </Form.Text>
                        ) : (
                          <Form.Text muted className="d-block">
                            {restaurant?.openTime && restaurant?.closeTime && (
                              <>
                                Open {String(restaurant.openTime).slice(0, 5)} –{" "}
                                {String(restaurant.closeTime).slice(0, 5)}
                                {earliestSlot?.sameDay && " · "}
                              </>
                            )}
                            {earliestSlot?.sameDay && (
                              <span className="text-danger">
                                Earliest today: {earliestSlot.hhmm} (
                                {Number(restaurant?.advanceBookingMinHours) || 0}h notice)
                              </span>
                            )}
                          </Form.Text>
                        )}
                      </Col>
                      <Col md={4}>
                        <Form.Label>Members *</Form.Label>
                        <Form.Control
                          type="number"
                          min={1}
                          name="memberCount"
                          value={form.memberCount}
                          readOnly
                          plaintext={false}
                          className="bg-light"
                        />
                        <Form.Text muted>From search — go back to change.</Form.Text>
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
                      {/* Agent input removed — already shown in the order summary
                          on the right side. */}
                      <Col md={12}>
                        <Form.Label>Payment Mode</Form.Label>
                        <Form.Select
                          name="paymentMode"
                          value={form.paymentMode}
                          onChange={handleChange}
                        >
                          {PAYMENT_MODES.map((p) => (
                            <option key={p} value={p}>
                              {p === "Cash"
                                ? "Cash — settle against agent credit limit"
                                : "Card — online payment"}
                            </option>
                          ))}
                        </Form.Select>
                        <Form.Text muted>
                          Cash debits the agent's available balance; Card opens
                          the online-payment screen.
                        </Form.Text>
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

                {/* Menu PDFs — the operator uploads one or more menu PDFs on
                    the registration page; we just surface them here so the
                    customer / agent can browse them while booking. No pre-
                    selection of items happens on this page anymore. */}
                <Card className="mb-3 shadow-sm">
                  <Card.Header className="bg-white fw-semibold">
                    <FaFilePdf className="me-2 text-danger" /> Menu PDFs
                  </Card.Header>
                  <Card.Body>
                    {Array.isArray(restaurant.menuPdfs) &&
                    restaurant.menuPdfs.length > 0 ? (
                      <ul className="list-unstyled mb-0">
                        {restaurant.menuPdfs.map((p, i) => (
                          <li
                            key={p.id || i}
                            className="d-flex align-items-center justify-content-between border rounded px-2 py-1 mb-1"
                          >
                            <span className="text-truncate" style={{ maxWidth: 380 }}>
                              <FaFilePdf className="text-danger me-2" />
                              {p.displayName ||
                                (p.fileUrl ? p.fileUrl.split("/").pop() : `Menu ${i + 1}`)}
                            </span>
                            {p.fileUrl && (
                              <a
                                href={p.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-outline-primary"
                              >
                                <FaExternalLinkAlt className="me-1" /> View
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Alert variant="light" className="mb-0 text-muted">
                        No menu PDFs uploaded for this restaurant yet.
                      </Alert>
                    )}
                  </Card.Body>
                </Card>
              </Col>

              {/* Sticky right column — RestaurantSummary + Review & Submit
                  stay visible as the user scrolls the long form. The panel
                  is capped to viewport height with overflow:auto so the
                  Submit button is always reachable without overlapping the
                  Copilot widget at the bottom-right of the page. */}
              <Col lg={4}>
                <div
                  className="restaurant-booking-summary-sticky"
                  style={{
                    position: "sticky",
                    top: 80,
                    zIndex: 2,
                    maxHeight: "calc(100vh - 100px)",
                    overflowY: "auto",
                  }}
                >
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
                  {/* Show available agent balance just above the submit so the
                      user always sees it without scrolling back up. */}
                  {form.agentId && agentBalance != null && (
                    <div className="mt-2 small text-end">
                      Agent balance:{" "}
                      <span className="fw-semibold text-danger">
                        ₹ {Number(agentBalance).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-100 mt-3"
                    disabled={saving}
                  >
                    <FaCheck className="me-2" />{" "}
                    {saving ? "Saving..." : "Review & Submit"}
                  </Button>
                </div>
              </Col>
            </Row>
          </Form>
        </div>
      </div>

      {/* Online-payment modal — Card mode informs the user that an online
          gateway redirect will happen on Confirm. (Gateway redirect is
          wired in when the payment integration lands.) */}
      <Modal
        show={cardModalOpen}
        onHide={() => setCardModalOpen(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Online Payment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            You've selected <strong>Card</strong> as the payment mode.
          </p>
          <p>
            On confirm, you'll be redirected to our secure online payment
            gateway to complete the booking. The booking will remain in
            <em> Not Paid </em> until the gateway confirms the transaction.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setCardModalOpen(false)}>
            Continue
          </Button>
        </Modal.Footer>
      </Modal>

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
                    <strong>Date / Time:</strong>{" "}
                    {form.bookingDate}
                    {form.bookingMode === "Walk-in"
                      ? " (Walk-in — anytime)"
                      : ` ${form.bookingTime}`}
                  </Col>
                  <Col md={6}><strong>Members:</strong> {form.memberCount}</Col>
                  <Col md={6}>
                    <strong>Booking Mode:</strong>{" "}
                    {form.bookingMode === "Walk-in" ? "Free to Available" : "Advance"}
                  </Col>
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
