/**
 * MeetAndSpaceBookingPage.jsx
 *
 * Booking creation page for the Meet & Space flow.
 *
 * Upgrades in this revision:
 *   - Inline validation errors (no toast spam) for every required field
 *   - Country derived from the nationality picked on the search page —
 *     rendered as plain read-only text (no input)
 *   - State / City rendered as dropdowns (react-select) loaded from
 *       /api/province/countryId?countryId={nationalityId}
 *       /api/destination?page=0&limit=50&search={term}
 *     (mirrors the SubLocation page pattern)
 *   - "Requested Amenities" rendered as checkboxes loaded from
 *       /api/hotels/{hotelId}.amenities — plus an "Additional amenities"
 *     repeater for custom items the customer wants to bring up.
 *   - The booking payload now sends a `selectedAmenities` list (each item
 *     marked Hotel / Custom), persisted into the new
 *     `meet_and_space_booking_amenity` table.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Table,
  Spinner,
  Alert,
  Badge,
} from "react-bootstrap";
import {
  FaCheckCircle,
  FaCalendarAlt,
  FaClock,
  FaUsers,
  FaMapMarkerAlt,
  FaPlus,
  FaTrash,
} from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import Select from "react-select";
import { toast } from "react-hot-toast";
import axiosInstance from "../../../components/AxiosInstance";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";

// ── fixed dropdown options ────────────────────────────────────────────────
const SALUTATIONS = ["Mr", "Ms", "Mrs", "Dr"];
const EVENT_TYPES = [
  "Meeting",
  "Conference",
  "Training",
  "Wedding",
  "Birthday",
  "Anniversary",
  "Seminar",
  "Workshop",
  "Other",
];
const LAYOUTS = ["Theatre", "U-Shape", "Classroom", "Boardroom", "Banquet", "Reception"];
const ID_TYPES = ["Aadhaar", "PAN", "Passport", "Driving License", "Voter ID"];
const PAYMENT_MODES = ["Cash", "Card", "UPI", "Bank Transfer", "Cheque"];

function useQueryParams() {
  const { search } = useLocation();
  return useMemo(
    () => Object.fromEntries(new URLSearchParams(search)),
    [search]
  );
}

export default function MeetAndSpaceBookingPage() {
  const navigate = useNavigate();
  const q = useQueryParams();

  const [space, setSpace] = useState(null);
  // Amenities tied to THIS meeting space (saved on the
  // /hotel-actions/{hotelId}/meeting-space page into meet_space_amenty).
  // We populate this list from space.amenityList (normalised) and fall back
  // to the legacy comma-separated `amenities` string if the master list is
  // empty.
  const [spaceAmenities, setSpaceAmenities] = useState([]); // [{id, name, masterAmenityId, isSelected}]
  const [customAmenities, setCustomAmenities] = useState([]); // free-form amenity strings

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Pricing-related state — initial values come from search.
  const [criteria, setCriteria] = useState({
    bookingDate: q.bookingDate || "",
    startTime: q.startTime || "",
    endTime: q.endTime || "",
    attendees: q.attendees ? Number(q.attendees) : 1,
    layout: q.layout || "",
    ratePlan: q.ratePlan || "Standard",
    rateType: q.rateType || "Hourly",
    unitRate: q.unitRate ? Number(q.unitRate) : 0,
  });
  const [eventType, setEventType] = useState("Meeting");
  const [additionalRequirements, setAdditionalRequirements] = useState("");

  // Agent + nationality propagated from the search page via query params.
  const agentId = q.agentId ? Number(q.agentId) : null;
  const agentName = q.agentName || "";
  const nationalityId = q.nationalityId ? Number(q.nationalityId) : null;
  const nationalityName = q.nationalityName || "";

  const [customer, setCustomer] = useState({
    salutation: "Mr",
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    alternateMobile: "",
    companyName: "",
    designation: "",
    gstNumber: "",
    address: "",
    cityId: null,
    cityName: "",
    stateId: null,
    stateName: "",
    pincode: "",
    idType: "Aadhaar",
    idNumber: "",
    remarks: "",
  });

  const [payment, setPayment] = useState({
    paymentMode: "Cash",
    paymentStatus: "Partial",
    amountPaid: 0,
    transactionReference: "",
    notes: "",
  });

  const [stateOptions, setStateOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);

  const [addons, setAddons] = useState([]);
  const addAddon = () =>
    setAddons((a) => [
      ...a,
      { addonName: "", quantity: 1, unitPrice: 0, totalPrice: 0, remarks: "" },
    ]);
  const removeAddon = (i) => setAddons((a) => a.filter((_, idx) => idx !== i));
  const updateAddon = (i, k, v) =>
    setAddons((a) => {
      const next = [...a];
      next[i] = { ...next[i], [k]: v };
      if (k === "quantity" || k === "unitPrice") {
        next[i].totalPrice =
          Number(next[i].quantity || 0) * Number(next[i].unitPrice || 0);
      }
      return next;
    });

  // ── Load space details — also seeds the amenities checkbox list from
  //    the meeting-space's own amenityList (meet_space_amenty rows). The
  //    hotel's amenities are NOT used: we want to surface only what the
  //    operator configured for this specific space on the manage page.
  useEffect(() => {
    const spaceId = q.spaceId;
    if (!spaceId) {
      setLoading(false);
      return;
    }
    axiosInstance
      .get(`/api/meet-and-space/${spaceId}`)
      .then((r) => {
        setSpace(r.data);

        // Build the checkbox list from the space's normalised amenityList.
        // If the backend hasn't returned that array (older row, no amenities
        // saved yet, etc.) fall back to splitting the legacy comma-separated
        // `amenities` field so the page still renders something usable.
        let amenities = [];
        if (Array.isArray(r.data?.amenityList) && r.data.amenityList.length) {
          amenities = r.data.amenityList
            .map((a, idx) => ({
              id: a.id ? `db-${a.id}` : `sp-${idx}`,
              name: a.amenityName,
              masterAmenityId: a.masterAmenityId || null,
            }))
            .filter((x) => x.name);
        } else if (typeof r.data?.amenities === "string" && r.data.amenities.trim()) {
          amenities = r.data.amenities
            .split(",")
            .map((n, idx) => ({
              id: `sp-${idx}`,
              name: n.trim(),
              masterAmenityId: null,
            }))
            .filter((x) => x.name);
        }
        setSpaceAmenities(amenities.map((x) => ({ ...x, isSelected: false })));
      })
      .catch((e) => {
        console.error("Load space failed", e);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, []);

  // ── Load state list for the selected nationality ──────────────────────
  useEffect(() => {
    if (!nationalityId) {
      setStateOptions([]);
      return;
    }
    axiosInstance
      .get(
        `/api/province/countryId?countryId=${nationalityId}&page=0&limit=50&search=`
      )
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        setStateOptions(
          list.map((s) => ({ value: s.id, label: s.stateName || s.name }))
        );
      })
      .catch(() => setStateOptions([]));
  }, [nationalityId]);

  // ── Load city / destination list filtered by nationality ────────────
  useEffect(() => {
    if (!nationalityId) {
      setCityOptions([]);
      return;
    }
    axiosInstance
      .get(`/api/destination?page=0&limit=50&search=`)
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        // Different shapes for the linked country — be defensive.
        const filtered = list.filter((d) => {
          const cId =
            d.countryId ||
            d.country?.id ||
            d.country?.countryId ||
            d.master_country_id;
          return cId == null || Number(cId) === Number(nationalityId);
        });
        setCityOptions(
          filtered.map((d) => ({
            value: d.id,
            label: d.name || d.destinationName,
          }))
        );
      })
      .catch(() => setCityOptions([]));
  }, [nationalityId]);

  // ── Pricing recompute ────────────────────────────────────────────────
  const pricing = useMemo(() => {
    const [sh, sm] = (criteria.startTime || "0:0").split(":").map(Number);
    const [eh, em] = (criteria.endTime || "0:0").split(":").map(Number);
    const mins = eh * 60 + em - (sh * 60 + sm);
    const hours = mins > 0 ? Math.ceil(mins / 60) : 0;
    const unit = Number(criteria.unitRate || 0);
    const subTotal = criteria.rateType === "Hourly" ? unit * hours : unit;
    const addonTotal = addons.reduce(
      (s, a) => s + Number(a.totalPrice || 0),
      0
    );
    const taxPercent = Number(space?.taxPercent || 0);
    const taxAmount = ((subTotal + addonTotal) * taxPercent) / 100;
    const totalAmount = subTotal + addonTotal + taxAmount;
    const amountPaidNum = Number(payment.amountPaid || 0);
    const balanceDue = Math.max(totalAmount - amountPaidNum, 0);
    return {
      hours,
      subTotal,
      addonTotal,
      taxPercent,
      taxAmount,
      totalAmount,
      balanceDue,
    };
  }, [criteria, addons, space, payment.amountPaid]);

  // ── Amenity selection helpers ───────────────────────────────────────
  // Toggles a checkbox bound to one of the space's pre-configured amenities.
  const toggleSpaceAmenity = (id) =>
    setSpaceAmenities((list) =>
      list.map((a) => (a.id === id ? { ...a, isSelected: !a.isSelected } : a))
    );

  const addCustomAmenity = () => setCustomAmenities((l) => [...l, ""]);
  const removeCustomAmenity = (idx) =>
    setCustomAmenities((l) => l.filter((_, i) => i !== idx));
  const updateCustomAmenity = (idx, value) =>
    setCustomAmenities((l) => {
      const next = [...l];
      next[idx] = value;
      return next;
    });

  // ── Validation (inline) ────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!customer.firstName.trim()) e.firstName = "First name is required";
    if (!customer.mobile.trim()) e.mobile = "Mobile is required";
    else if (!/^\d{8,15}$/.test(customer.mobile.trim()))
      e.mobile = "Mobile must be 8-15 digits";
    if (customer.email && !/\S+@\S+\.\S+/.test(customer.email))
      e.email = "Invalid email format";
    if (!customer.cityId) e.cityId = "City is required";
    if (!customer.stateId) e.stateId = "State is required";
    if (!eventType) e.eventType = "Event type is required";
    if (!criteria.attendees || Number(criteria.attendees) <= 0)
      e.attendees = "Attendees must be > 0";
    if (Number(payment.amountPaid || 0) < 0)
      e.amountPaid = "Amount cannot be negative";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const setCustomerField = (k, v) => {
    setCustomer((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: null }));
  };

  // ── Confirm booking ─────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!space) return;
    if (!validate()) {
      const first = document.querySelector(".is-invalid, .text-danger");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    try {
      // Combine ticked space-amenities (source="Space" — they came from the
      // meeting-space master) with any free-form items the customer added
      // (source="Custom"). The whole list is persisted into the
      // meet_and_space_booking_amenity table on save.
      const selectedAmenities = [
        ...spaceAmenities
          .filter((a) => a.isSelected)
          .map((a) => ({
            amenityName: a.name,
            source: "Space",
            masterAmenityId: a.masterAmenityId,
          })),
        ...customAmenities
          .filter((n) => n && n.trim())
          .map((n) => ({ amenityName: n.trim(), source: "Custom" })),
      ];

      const payload = {
        meetingSpaceId: space.id,
        bookingDate: criteria.bookingDate,
        startTime: criteria.startTime,
        endTime: criteria.endTime,
        rateType: criteria.rateType,
        ratePlan: criteria.ratePlan,
        unitRate: criteria.unitRate,
        subTotal: pricing.subTotal,
        addonTotal: pricing.addonTotal,
        taxPercent: pricing.taxPercent,
        taxAmount: pricing.taxAmount,
        discountAmount: 0,
        totalAmount: pricing.totalAmount,
        currency: space.currency || "INR",
        currencyId: space.currencyId,
        attendees: Number(criteria.attendees || 1),
        layout: criteria.layout,
        eventType,
        requestedAmenities: selectedAmenities
          .map((a) => a.amenityName)
          .join(", "),
        additionalRequirements,
        agentId,
        agentName,
        nationalityId,
        nationalityName,
        selectedAmenities,
        customer: {
          salutation: customer.salutation,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          mobile: customer.mobile,
          alternateMobile: customer.alternateMobile,
          companyName: customer.companyName,
          designation: customer.designation,
          gstNumber: customer.gstNumber,
          address: customer.address,
          city: customer.cityName,
          cityId: customer.cityId,
          state: customer.stateName,
          stateId: customer.stateId,
          country: nationalityName,
          countryId: nationalityId,
          pincode: customer.pincode,
          idType: customer.idType,
          idNumber: customer.idNumber,
          remarks: customer.remarks,
        },
        payment: {
          ...payment,
          amountPaid: Number(payment.amountPaid || 0),
          balanceDue: pricing.balanceDue,
        },
        addons: addons
          .filter((a) => a.addonName && a.addonName.trim())
          .map((a) => ({
            addonName: a.addonName,
            quantity: Number(a.quantity || 1),
            unitPrice: Number(a.unitPrice || 0),
            totalPrice: Number(a.totalPrice || 0),
            remarks: a.remarks,
          })),
      };
      const res = await axiosInstance.post(
        "/api/meet-and-space/booking/save",
        payload
      );
      toast.success(
        `Booking confirmed! Ref: ${res.data?.bookingNumber || ""}`
      );
      setTimeout(
        () =>
          navigate("/booking-details/meet-and-space-booking-list", {
            replace: true,
          }),
        800
      );
    } catch (e) {
      console.error("Save booking failed", e);
      setErrors((p) => ({
        ...p,
        _general:
          e?.response?.data?.message || "Failed to confirm booking",
      }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex">
        <Sidebar />
        <div className="flex-grow-1">
          <TopBar />
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        </div>
      </div>
    );
  }
  if (!space) {
    return (
      <div className="d-flex">
        <Sidebar />
        <div className="flex-grow-1">
          <TopBar />
          <Container className="py-4">
            <Alert variant="danger">Meeting space not found.</Alert>
          </Container>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1">
        <TopBar />
        <Container fluid className="p-4">
          <h4 className="mb-3">
            <FaCheckCircle className="me-2 text-success" /> Confirm Meet &amp; Space
            Booking
          </h4>

          {errors._general && (
            <Alert variant="danger">{errors._general}</Alert>
          )}

          <Row>
            {/* LEFT — booking summary */}
            <Col lg={4} className="mb-3">
              <Card className="shadow-sm">
                {space.images?.[0]?.imageUrl && (
                  <Card.Img
                    variant="top"
                    src={space.images[0].imageUrl}
                    style={{ height: 200, objectFit: "cover" }}
                    onError={(e) => (e.target.style.display = "none")}
                  />
                )}
                <Card.Body>
                  <h5>{space.spaceName}</h5>
                  <div className="text-muted small mb-2">
                    <FaMapMarkerAlt className="me-1" />
                    {space.hotelName}
                  </div>
                  <Badge bg="info" className="me-2">
                    {space.spaceType}
                  </Badge>
                  <Badge bg="secondary">Capacity {space.capacity}</Badge>
                  {space.description && (
                    <p className="small text-muted mt-2">
                      {space.description}
                    </p>
                  )}
                  <hr />
                  <div className="small">
                    <div>
                      <FaCalendarAlt className="me-1" />
                      <strong>Date:</strong> {criteria.bookingDate}
                    </div>
                    <div>
                      <FaClock className="me-1" />
                      <strong>Time:</strong> {criteria.startTime} —{" "}
                      {criteria.endTime} ({pricing.hours}h)
                    </div>
                    <div>
                      <FaUsers className="me-1" />
                      <strong>Attendees:</strong> {criteria.attendees}
                    </div>
                    <div>
                      <strong>Layout:</strong> {criteria.layout || "—"}
                    </div>
                    <div>
                      <strong>Rate Plan:</strong> {criteria.ratePlan} (
                      {criteria.rateType})
                    </div>
                    <div>
                      <strong>Unit Rate:</strong> {space.currency || "INR"}{" "}
                      {Number(criteria.unitRate).toFixed(2)}
                    </div>
                    <div>
                      <strong>Agent:</strong> {agentName || "—"}
                    </div>
                    <div>
                      <strong>Nationality / Country:</strong>{" "}
                      {nationalityName || "—"}
                    </div>
                  </div>
                </Card.Body>
              </Card>

              <Card className="shadow-sm mt-3">
                <Card.Header>
                  <strong>Price Summary</strong>
                </Card.Header>
                <Card.Body>
                  <Table size="sm" borderless className="mb-0">
                    <tbody>
                      <tr>
                        <td>Sub Total</td>
                        <td className="text-end">
                          {pricing.subTotal.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td>Add-ons</td>
                        <td className="text-end">
                          {pricing.addonTotal.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td>Tax ({pricing.taxPercent}%)</td>
                        <td className="text-end">
                          {pricing.taxAmount.toFixed(2)}
                        </td>
                      </tr>
                      <tr className="fw-bold border-top">
                        <td>Total</td>
                        <td className="text-end text-primary">
                          {space.currency || "INR"}{" "}
                          {pricing.totalAmount.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td>Amount Paid</td>
                        <td className="text-end">
                          {Number(payment.amountPaid || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr className="text-danger fw-bold">
                        <td>Balance Due</td>
                        <td className="text-end">
                          {pricing.balanceDue.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>

            {/* RIGHT — event + amenities + customer + addons + payment */}
            <Col lg={8}>
              <Card className="shadow-sm mb-3">
                <Card.Header>
                  <strong>Event Details</strong>
                </Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={4}>
                      <Form.Label>Event Type *</Form.Label>
                      <Form.Select
                        value={eventType}
                        onChange={(e) => {
                          setEventType(e.target.value);
                          if (errors.eventType)
                            setErrors((p) => ({ ...p, eventType: null }));
                        }}
                        isInvalid={!!errors.eventType}
                      >
                        {EVENT_TYPES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </Form.Select>
                      <Form.Control.Feedback type="invalid">
                        {errors.eventType}
                      </Form.Control.Feedback>
                    </Col>
                    <Col md={4}>
                      <Form.Label>Layout</Form.Label>
                      <Form.Select
                        value={criteria.layout}
                        onChange={(e) =>
                          setCriteria((p) => ({
                            ...p,
                            layout: e.target.value,
                          }))
                        }
                      >
                        <option value="">—</option>
                        {LAYOUTS.map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={4}>
                      <Form.Label>Attendees *</Form.Label>
                      <Form.Control
                        type="number"
                        value={criteria.attendees}
                        onChange={(e) => {
                          setCriteria((p) => ({
                            ...p,
                            attendees: e.target.value,
                          }));
                          if (errors.attendees)
                            setErrors((p) => ({ ...p, attendees: null }));
                        }}
                        isInvalid={!!errors.attendees}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.attendees}
                      </Form.Control.Feedback>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* ── Requested Amenities — driven by the meeting space's
                  own configured amenities (saved on the manage page into
                  meet_space_amenty). Additional Amenities below lets the
                  customer add free-form extras. ── */}
              <Card className="shadow-sm mb-3">
                <Card.Header>
                  <strong>Requested Amenities</strong>{" "}
                  <small className="text-muted">
                    (amenities offered by {space.spaceName})
                  </small>
                </Card.Header>
                <Card.Body>
                  {spaceAmenities.length === 0 ? (
                    <div className="text-muted small mb-2">
                      No amenities have been configured for this space yet —
                      add what you need in the "Additional Amenities" section
                      below.
                    </div>
                  ) : (
                    <Row className="g-2 mb-3">
                      {spaceAmenities.map((a) => (
                        <Col md={4} sm={6} key={a.id}>
                          <Form.Check
                            type="checkbox"
                            label={a.name}
                            checked={a.isSelected}
                            onChange={() => toggleSpaceAmenity(a.id)}
                          />
                        </Col>
                      ))}
                    </Row>
                  )}

                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong className="small">Additional Amenities</strong>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={addCustomAmenity}
                    >
                      <FaPlus /> Add
                    </Button>
                  </div>
                  {customAmenities.length === 0 && (
                    <div className="text-muted small">
                      Nothing extra? Skip this section.
                    </div>
                  )}
                  {customAmenities.map((value, idx) => (
                    <Row key={idx} className="g-2 mb-2 align-items-center">
                      <Col md={10}>
                        <Form.Control
                          size="sm"
                          placeholder="e.g. Photographer, Anchor, Décor team..."
                          value={value}
                          onChange={(e) =>
                            updateCustomAmenity(idx, e.target.value)
                          }
                        />
                      </Col>
                      <Col md={2}>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          className="w-100"
                          onClick={() => removeCustomAmenity(idx)}
                        >
                          <FaTrash /> Remove
                        </Button>
                      </Col>
                    </Row>
                  ))}
                  <Form.Text className="text-muted">
                    Selected amenities save into the
                    meet_and_space_booking_amenity table on confirm.
                  </Form.Text>
                </Card.Body>
              </Card>

              <Card className="shadow-sm mb-3">
                <Card.Header>
                  <strong>Customer Details</strong>
                </Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={1}>
                      <Form.Label>Title</Form.Label>
                      <Form.Select
                        value={customer.salutation}
                        onChange={(e) =>
                          setCustomerField("salutation", e.target.value)
                        }
                      >
                        {SALUTATIONS.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={3}>
                      <Form.Label>First Name *</Form.Label>
                      <Form.Control
                        value={customer.firstName}
                        onChange={(e) =>
                          setCustomerField("firstName", e.target.value)
                        }
                        isInvalid={!!errors.firstName}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.firstName}
                      </Form.Control.Feedback>
                    </Col>
                    <Col md={3}>
                      <Form.Label>Last Name</Form.Label>
                      <Form.Control
                        value={customer.lastName}
                        onChange={(e) =>
                          setCustomerField("lastName", e.target.value)
                        }
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Label>Mobile *</Form.Label>
                      <Form.Control
                        value={customer.mobile}
                        onChange={(e) =>
                          setCustomerField("mobile", e.target.value)
                        }
                        isInvalid={!!errors.mobile}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.mobile}
                      </Form.Control.Feedback>
                    </Col>
                    <Col md={2}>
                      <Form.Label>Alt. Mobile</Form.Label>
                      <Form.Control
                        value={customer.alternateMobile}
                        onChange={(e) =>
                          setCustomerField("alternateMobile", e.target.value)
                        }
                      />
                    </Col>
                    <Col md={4}>
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        value={customer.email}
                        onChange={(e) =>
                          setCustomerField("email", e.target.value)
                        }
                        isInvalid={!!errors.email}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.email}
                      </Form.Control.Feedback>
                    </Col>
                    <Col md={4}>
                      <Form.Label>Company / Organization</Form.Label>
                      <Form.Control
                        value={customer.companyName}
                        onChange={(e) =>
                          setCustomerField("companyName", e.target.value)
                        }
                      />
                    </Col>
                    <Col md={2}>
                      <Form.Label>Designation</Form.Label>
                      <Form.Control
                        value={customer.designation}
                        onChange={(e) =>
                          setCustomerField("designation", e.target.value)
                        }
                      />
                    </Col>
                    <Col md={2}>
                      <Form.Label>GSTIN</Form.Label>
                      <Form.Control
                        value={customer.gstNumber}
                        onChange={(e) =>
                          setCustomerField("gstNumber", e.target.value)
                        }
                      />
                    </Col>
                    <Col md={6}>
                      <Form.Label>Address</Form.Label>
                      <Form.Control
                        value={customer.address}
                        onChange={(e) =>
                          setCustomerField("address", e.target.value)
                        }
                      />
                    </Col>

                    {/* Country = nationality, plain read-only text */}
                    <Col md={2}>
                      <Form.Label>Country</Form.Label>
                      <div
                        className="form-control bg-light"
                        title="Set by the nationality picked on the search page"
                      >
                        {nationalityName || "—"}
                      </div>
                      <Form.Text className="text-muted">
                        From search nationality.
                      </Form.Text>
                    </Col>

                    {/* State dropdown (filtered by nationality) */}
                    <Col md={2}>
                      <Form.Label>State *</Form.Label>
                      <Select
                        options={stateOptions}
                        value={
                          stateOptions.find(
                            (s) => s.value === customer.stateId
                          ) || null
                        }
                        onChange={(o) => {
                          setCustomer((p) => ({
                            ...p,
                            stateId: o?.value || null,
                            stateName: o?.label || "",
                          }));
                          if (errors.stateId)
                            setErrors((p) => ({ ...p, stateId: null }));
                        }}
                        placeholder="Select state..."
                        isClearable
                      />
                      {errors.stateId && (
                        <div className="text-danger small mt-1">
                          {errors.stateId}
                        </div>
                      )}
                    </Col>

                    {/* City dropdown (filtered by nationality) */}
                    <Col md={2}>
                      <Form.Label>City *</Form.Label>
                      <Select
                        options={cityOptions}
                        value={
                          cityOptions.find(
                            (c) => c.value === customer.cityId
                          ) || null
                        }
                        onChange={(o) => {
                          setCustomer((p) => ({
                            ...p,
                            cityId: o?.value || null,
                            cityName: o?.label || "",
                          }));
                          if (errors.cityId)
                            setErrors((p) => ({ ...p, cityId: null }));
                        }}
                        placeholder="Select city..."
                        isClearable
                      />
                      {errors.cityId && (
                        <div className="text-danger small mt-1">
                          {errors.cityId}
                        </div>
                      )}
                    </Col>

                    <Col md={2}>
                      <Form.Label>Pincode</Form.Label>
                      <Form.Control
                        value={customer.pincode}
                        onChange={(e) =>
                          setCustomerField("pincode", e.target.value)
                        }
                      />
                    </Col>
                    <Col md={2}>
                      <Form.Label>ID Type</Form.Label>
                      <Form.Select
                        value={customer.idType}
                        onChange={(e) =>
                          setCustomerField("idType", e.target.value)
                        }
                      >
                        {ID_TYPES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={4}>
                      <Form.Label>ID Number</Form.Label>
                      <Form.Control
                        value={customer.idNumber}
                        onChange={(e) =>
                          setCustomerField("idNumber", e.target.value)
                        }
                      />
                    </Col>
                    <Col md={12}>
                      <Form.Label>Remarks</Form.Label>
                      <Form.Control
                        value={customer.remarks}
                        onChange={(e) =>
                          setCustomerField("remarks", e.target.value)
                        }
                      />
                    </Col>
                    <Col md={12}>
                      <Form.Label>
                        Additional Requirements / Notes
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={additionalRequirements}
                        onChange={(e) =>
                          setAdditionalRequirements(e.target.value)
                        }
                      />
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              <Card className="shadow-sm mb-3">
                <Card.Header className="d-flex justify-content-between">
                  <strong>Add-ons</strong>
                  <Button size="sm" variant="outline-primary" onClick={addAddon}>
                    <FaPlus /> Add
                  </Button>
                </Card.Header>
                <Card.Body>
                  {addons.length === 0 ? (
                    <div className="text-muted small">
                      No add-ons added. Click "Add" to include catering, AV
                      rental, etc.
                    </div>
                  ) : (
                    <Table size="sm" bordered>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th style={{ width: 80 }}>Qty</th>
                          <th style={{ width: 120 }}>Unit Price</th>
                          <th style={{ width: 120 }}>Total</th>
                          <th>Remarks</th>
                          <th style={{ width: 40 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {addons.map((a, i) => (
                          <tr key={i}>
                            <td>
                              <Form.Control
                                size="sm"
                                value={a.addonName}
                                onChange={(e) =>
                                  updateAddon(i, "addonName", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <Form.Control
                                size="sm"
                                type="number"
                                value={a.quantity}
                                onChange={(e) =>
                                  updateAddon(i, "quantity", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <Form.Control
                                size="sm"
                                type="number"
                                value={a.unitPrice}
                                onChange={(e) =>
                                  updateAddon(i, "unitPrice", e.target.value)
                                }
                              />
                            </td>
                            <td>{Number(a.totalPrice || 0).toFixed(2)}</td>
                            <td>
                              <Form.Control
                                size="sm"
                                value={a.remarks}
                                onChange={(e) =>
                                  updateAddon(i, "remarks", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => removeAddon(i)}
                              >
                                <FaTrash />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Card.Body>
              </Card>

              <Card className="shadow-sm mb-3">
                <Card.Header>
                  <strong>Payment</strong>
                </Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={3}>
                      <Form.Label>Mode</Form.Label>
                      <Form.Select
                        value={payment.paymentMode}
                        onChange={(e) =>
                          setPayment({
                            ...payment,
                            paymentMode: e.target.value,
                          })
                        }
                      >
                        {PAYMENT_MODES.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={3}>
                      <Form.Label>Status</Form.Label>
                      <Form.Select
                        value={payment.paymentStatus}
                        onChange={(e) =>
                          setPayment({
                            ...payment,
                            paymentStatus: e.target.value,
                          })
                        }
                      >
                        <option>Pending</option>
                        <option>Partial</option>
                        <option>Paid</option>
                      </Form.Select>
                    </Col>
                    <Col md={3}>
                      <Form.Label>Amount Paid</Form.Label>
                      <Form.Control
                        type="number"
                        value={payment.amountPaid}
                        onChange={(e) => {
                          setPayment({
                            ...payment,
                            amountPaid: e.target.value,
                          });
                          if (errors.amountPaid)
                            setErrors((p) => ({ ...p, amountPaid: null }));
                        }}
                        isInvalid={!!errors.amountPaid}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.amountPaid}
                      </Form.Control.Feedback>
                    </Col>
                    <Col md={3}>
                      <Form.Label>Transaction Ref</Form.Label>
                      <Form.Control
                        value={payment.transactionReference}
                        onChange={(e) =>
                          setPayment({
                            ...payment,
                            transactionReference: e.target.value,
                          })
                        }
                      />
                    </Col>
                    <Col md={12}>
                      <Form.Label>Notes</Form.Label>
                      <Form.Control
                        value={payment.notes}
                        onChange={(e) =>
                          setPayment({ ...payment, notes: e.target.value })
                        }
                      />
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              <div className="d-flex justify-content-end gap-2 pb-4">
                <Button
                  variant="outline-secondary"
                  onClick={() => window.close()}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="success"
                  size="lg"
                  onClick={handleConfirm}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Spinner size="sm" animation="border" /> Confirming...
                    </>
                  ) : (
                    <>
                      <FaCheckCircle className="me-2" /> Confirm Booking —{" "}
                      {space.currency || "INR"}{" "}
                      {pricing.totalAmount.toFixed(2)}
                    </>
                  )}
                </Button>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  );
}
