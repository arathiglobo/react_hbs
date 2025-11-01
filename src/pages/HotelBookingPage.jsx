import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaHotel, FaCalendarAlt, FaUsers, FaUtensils } from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import "../styles/HotelBookingPage.css";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Accordion,
  Badge,
  Alert,
  Modal,
} from "react-bootstrap";
import axiosInstance from "../components/AxiosInstance";
import toast from "react-hot-toast";

const HotelBookingPage = () => {
  const navigate = useNavigate();

  let activeUserRole = localStorage.getItem("currentActiveRole");
  console.log("currentActiveRole::", activeUserRole);

  const [bookingData, setBookingData] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [primaryGuest, setPrimaryGuest] = useState({
    salutation: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    passportNo: "",
    agentLpo: "",
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  // Load bookingData once
  useEffect(() => {
    const storedData = sessionStorage.getItem("bookingData");
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      setBookingData(parsedData);

      // Initialize rooms with guests
      const initialRooms = parsedData.payload.rooms.map((room) => ({
        ...room,
        guests: Array.from({ length: room.adults + room.children }, (_, i) => ({
          salutation: "",
          firstName: "",
          middleName: "",
          lastName: "",
          gender: "",
          isChild: i >= room.adults,
        })),
      }));
      setRooms(initialRooms);
    }
  }, []);

  const handleGuestChange = (roomIndex, guestIndex, field, value) => {
    setRooms((prevRooms) => {
      const updatedRooms = [...prevRooms];
      updatedRooms[roomIndex].guests[guestIndex][field] = value;
      return updatedRooms;
    });

    // Clear validation error when user starts typing
    const guestKey = `room_${roomIndex}_guest_${guestIndex}_${field}`;
    if (validationErrors[guestKey]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[guestKey];
        return updated;
      });
    }
  };

  const handlePrimaryGuestChange = (field, value) => {
    setPrimaryGuest((prev) => ({ ...prev, [field]: value }));

    // Real-time validation for email format
    if (field === "email" && value.trim() !== "") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        setValidationErrors((prev) => ({
          ...prev,
          email: "Please enter a valid email address",
        }));
        return;
      }
    }

    // Real-time validation for phone length
    if (field === "phone" && value.trim() !== "") {
      if (value.trim().length > 10) {
        setValidationErrors((prev) => ({
          ...prev,
          phone: "Phone number cannot exceed 10 digits",
        }));
        return;
      }
    }

    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const getRefundStatusBadge = (refundStatus) => {
    switch (refundStatus) {
      case "FLEXIBLE":
        return <Badge bg="success">Flexible</Badge>;
      case "NON REFUNDABLE":
        return <Badge bg="danger">Non-Refundable</Badge>;
      default:
        return <Badge bg="secondary">{refundStatus}</Badge>;
    }
  };

  const validateForm = () => {
    const errors = {};
    let hasErrors = false;

    // Validate Primary Guest fields
    if (!primaryGuest.salutation || primaryGuest.salutation.trim() === "") {
      errors.salutation = "Salutation is required";
      hasErrors = true;
    }
    if (!primaryGuest.firstName || primaryGuest.firstName.trim() === "") {
      errors.firstName = "First Name is required";
      hasErrors = true;
    }
    if (!primaryGuest.lastName || primaryGuest.lastName.trim() === "") {
      errors.lastName = "Last Name is required";
      hasErrors = true;
    }
    if (!primaryGuest.email || primaryGuest.email.trim() === "") {
      errors.email = "Email is required";
      hasErrors = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryGuest.email)) {
      errors.email = "Please enter a valid email address";
      hasErrors = true;
    }
    if (!primaryGuest.phone || primaryGuest.phone.trim() === "") {
      errors.phone = "Phone is required";
      hasErrors = true;
    } else if (primaryGuest.phone.trim().length > 10) {
      errors.phone = "Phone number cannot exceed 10 digits";
      hasErrors = true;
    }
    if (!primaryGuest.agentLpo || primaryGuest.agentLpo.trim() === "") {
      errors.agentLpo = "Agent LPO is required";
      hasErrors = true;
    }

    // Validate Guest fields in rooms
    rooms.forEach((room, roomIndex) => {
      room.guests.forEach((guest, guestIndex) => {
        const guestKey = `room_${roomIndex}_guest_${guestIndex}`;

        if (!guest.salutation || guest.salutation.trim() === "") {
          errors[`${guestKey}_salutation`] = "Salutation is required";
          hasErrors = true;
        }
        if (!guest.firstName || guest.firstName.trim() === "") {
          errors[`${guestKey}_firstName`] = "First Name is required";
          hasErrors = true;
        }
        if (!guest.lastName || guest.lastName.trim() === "") {
          errors[`${guestKey}_lastName`] = "Last Name is required";
          hasErrors = true;
        }
        if (!guest.gender || guest.gender.trim() === "") {
          errors[`${guestKey}_gender`] = "Gender is required";
          hasErrors = true;
        }
      });
    });

    return { errors, hasErrors };
  };

  const checkIn = new Date(bookingData.payload.checkInDate);
  const checkOut = new Date(bookingData.payload.checkOutDate);

  // Calculate difference in milliseconds → convert to days
  const nights = Math.max(
    1,
    Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24))
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { errors, hasErrors } = validateForm();

    if (hasErrors) {
      setValidationErrors(errors);
      return;
    }

    // ✅ Clear validation errors before submission
    setValidationErrors({});

    try {
      setIsSubmitting(true);

      // ---------------------------
      // ✅ Construct booking payload
      // ---------------------------

      const payload = {
        agentId: bookingData.payload.agentId || null,
        apiId: bookingData.payload.apiId || null,
        hotelId: selectedRate.hotelId,
        hotelName: bookingData.hotelStaticData.hotelName,
        address: bookingData.hotelStaticData.address,
        starRating: bookingData.hotelStaticData.starRating,
        checkInDate: bookingData.payload.checkInDate,
        checkOutDate: bookingData.payload.checkOutDate,
        nights: nights,

        // ✅ Primary guest details
        primaryGuest: {
          salutation: primaryGuest.salutation,
          firstName: primaryGuest.firstName,
          middleName: primaryGuest.middleName,
          lastName: primaryGuest.lastName,
          email: primaryGuest.email,
          phone: primaryGuest.phone,
          passportNo: primaryGuest.passportNo,
          agentLpo: primaryGuest.agentLpo,
        },

        // ✅ Room & guest breakdown
        rooms: rooms.map((room, roomIndex) => ({
          roomNo: roomIndex + 1,
          roomCategory: bookingData.selectedRate.roomCategory, // per room
          mealPlan: bookingData.selectedRate.mealPlan,
          nonRefundable:
            bookingData.selectedRate.nonRefundable === true ||
            bookingData.selectedRate.nonRefundable === "true"
              ? true
              : false,
          currency: bookingData.selectedRate.currency || "AED",
          rate: bookingData.selectedRate.rate,
          rateWithoutMarkup: "", //bookingData.selectedRate.rateWithoutMarkup,
          adults: room.adults,
          children: room.children,
          childAges: room.childAges || [],
          guests: room.guests.map((guest) => ({
            salutation: guest.salutation,
            firstName: guest.firstName,
            middleName: guest.middleName || "",
            lastName: guest.lastName,
            gender: guest.gender,
            isChild: guest.isChild,
          })),
        })),

        // ✅ Additional remarks
        remarks:
          document.querySelector("textarea[placeholder='Any remarks...']")
            ?.value || "",
        specialRequests:
          document.querySelector(
            "textarea[placeholder='Any special requests...']"
          )?.value || "",

        // ✅ Metadata
      };

      console.log("📦 Final booking payload:", payload);
      setPendingPayload(payload);
      setShowConfirmModal(true);
    } catch (err) {
      console.error("booking payload error", err);
      
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Confirm and post API only on OK
  const confirmBooking = async () => {
    if (!pendingPayload) return;
    setShowConfirmModal(false);
    setIsSubmitting(true);
    try {
   
      const response = await axiosInstance.post(
        "/hotel-booking/confirm",
        pendingPayload
      );
      if (response.status === 200 || response.status === 201) {

        toast.success("Booking submitted successfully.");
        navigate("/booking-confirmation", {
          state: { bookingData: response.data },
        });
      } else {
         toast.error("Booking submission failed. Please try again.");
      }
    } catch (err) {
     
      toast.error("Booking submission failed. Please try again.");
      
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
    }).format(price);

  if (!bookingData) return <div>Loading booking data...</div>;

  const { hotelStaticData, payload, selectedRate } = bookingData;
  console.log("bookingData:::", bookingData);

  return (
    <div className="hotel-booking-container">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <main className="content-wrapper py-4">
          <Container maxWidth="xl">
            {/* Booking Summary */}
            <Row>
              <Col>
                <Card className="shadow-lg rounded-xl mb-3 booking-summary-card border-0 overflow-hidden">
                  <Card.Header className="bg-gradient-secondary text-black py-2 rounded-top">
                    <h4 className="mb-0 d-flex align-items-center">
                      <FaHotel className="me-1 fs-4" /> Booking Summary
                    </h4>
                  </Card.Header>
                  <Card.Body className="p-4 bg-light">
                    <Row className="gy-4">
                      <Col md={6} lg={4}>
                        <div className="hotel-info-card p-3 bg-white rounded shadow-sm h-100">
                          <h5 className="fw-bold text-primary mb-3">
                            {hotelStaticData.hotelName}
                          </h5>
                          <p className="text-muted mb-2 d-flex align-items-start">
                            <i className="bi bi-geo-alt-fill me-2 mt-1 text-primary"></i>
                            {hotelStaticData.address}
                          </p>
                          <div className="d-flex align-items-center mb-2">
                            <span className="badge bg-warning text-dark me-2">
                              ⭐ {hotelStaticData.starRating} Star
                            </span>
                            {selectedRate?.nonRefundable !== undefined &&
                              getRefundStatusBadge(
                                selectedRate.nonRefundable === true ||
                                  selectedRate.nonRefundable === "true"
                                  ? "NON REFUNDABLE"
                                  : "FLEXIBLE"
                              )}
                          </div>
                        </div>
                      </Col>
                      <Col md={6} lg={2}>
                        <div className="info-card p-3 bg-white rounded shadow-sm h-100 text-center">
                          <FaCalendarAlt className="me-2 text-primary fs-5 mb-2" />
                          <h6 className="fw-bold text-primary mb-2">
                            Check-in
                          </h6>
                          <p className="mb-0 fw-semibold text-dark">
                            {payload.checkInDate}
                          </p>
                        </div>
                      </Col>
                      <Col md={6} lg={2}>
                        <div className="info-card p-3 bg-white rounded shadow-sm h-100 text-center">
                          <FaCalendarAlt className="me-2 text-primary fs-5 mb-2" />
                          <h6 className="fw-bold text-primary mb-2">
                            Check-out
                          </h6>
                          <p className="mb-0 fw-semibold text-dark">
                            {payload.checkOutDate}
                          </p>
                        </div>
                      </Col>
                      <Col md={6} lg={2}>
                        <div className="info-card p-3 bg-white rounded shadow-sm h-100 text-center">
                          <FaUsers className="me-2 text-primary fs-5 mb-2" />
                          <h6 className="fw-bold text-primary mb-2">Guests</h6>
                          <div className="text-start">
                            {payload.rooms.map((room, i) => (
                              <div key={i} className="mb-1">
                                <small className="fw-semibold text-dark">
                                  Room {i + 1}: {room.adults} Adults
                                  {room.children
                                    ? `, ${room.children} Children`
                                    : ""}
                                </small>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Col>
                      <Col md={6} lg={2}>
                        <div className="info-card p-3 bg-white rounded shadow-sm h-100 text-center">
                          <FaUtensils className="me-2 text-primary fs-5 mb-2" />
                          <h6 className="fw-bold text-primary mb-2">
                            Meal Plan
                          </h6>
                          <p className="mb-0 fw-semibold text-dark">
                            {selectedRate.mealPlan}
                          </p>
                        </div>
                      </Col>
                    </Row>
                    <hr className="my-4" />

                    {/* ✅ Show Selling Price only if ADMIN */}
                    {activeUserRole === "ADMIN" && (
                      <div className="pricing-section p-3 bg-white rounded shadow-sm mb-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <h5 className="mb-0 text-muted">Selling Price</h5>
                          <h4 className="mb-0 text-success fw-bold">
                            {formatPrice(selectedRate.rate)}
                          </h4>
                        </div>
                      </div>
                    )}

                    <div className="pricing-section p-3 bg-gradient-success text-white rounded shadow-sm">
                      <div className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">Total Price</h5>
                        <h4 className="mb-0 fw-bold">
                          {formatPrice(selectedRate.rate)}
                        </h4>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Guest Details Section */}
            <Form onSubmit={handleSubmit}>
              {/* {Object.keys(validationErrors).length > 0 && (
                <Alert variant="danger" className="mb-3 d-flex align-items-center">
                  <strong className="me-2">✕</strong>
                  <div>
                    <Alert.Heading className="mb-0">
                      Please fix the validation errors
                    </Alert.Heading>
                  </div>
                </Alert>
              )} */}
              <Card className="mb-2 shadow-sm border-0">
                <Card.Header className="bg-light text-center py-3">
                  <h5 className="mb-0 fw-bold text-dark">Guest Details</h5>
                </Card.Header>
                <Card.Body className="p-0">
                  <Accordion defaultActiveKey="0">
                    {rooms.map((room, roomIndex) => (
                      <Accordion.Item
                        key={roomIndex}
                        eventKey={roomIndex.toString()}
                        className="mb-3"
                      >
                        <Accordion.Header className="bg-primary text-white">
                          <h6 className="mb-0 fw-bold">
                            Room {roomIndex + 1} - {selectedRate.roomCategory}
                          </h6>
                        </Accordion.Header>
                        <Accordion.Body className="p-4">
                          {room.guests.map((guest, guestIndex) => (
                            <div key={guestIndex} className="guest-row mb-3">
                              <Row className="align-items-center">
                                <Col md={2}>
                                  <span className="fw-semibold text-muted">
                                    {guest.isChild
                                      ? `Child ${
                                          guestIndex - room.adults + 1
                                        } (Age: ${
                                          room.childAges[
                                            guestIndex - room.adults
                                          ]
                                        })`
                                      : `Adult ${guestIndex + 1}`}{" "}
                                    *
                                  </span>
                                </Col>
                                <Col md={2}>
                                  <Form.Select
                                    value={guest.salutation}
                                    onChange={(e) =>
                                      handleGuestChange(
                                        roomIndex,
                                        guestIndex,
                                        "salutation",
                                        e.target.value
                                      )
                                    }
                                    className="form-control-sm"
                                    isInvalid={
                                      !!validationErrors[
                                        `room_${roomIndex}_guest_${guestIndex}_salutation`
                                      ]
                                    }
                                  >
                                    <option value="">SELECT</option>
                                    <option value="Mr">Mr</option>
                                    <option value="Mrs">Mrs</option>
                                    <option value="Ms">Ms</option>
                                    <option value="Dr">Dr</option>
                                  </Form.Select>
                                  {validationErrors[
                                    `room_${roomIndex}_guest_${guestIndex}_salutation`
                                  ] && (
                                    <Form.Control.Feedback type="invalid">
                                      {
                                        validationErrors[
                                          `room_${roomIndex}_guest_${guestIndex}_salutation`
                                        ]
                                      }
                                    </Form.Control.Feedback>
                                  )}
                                </Col>
                                <Col md={3}>
                                  <Form.Control
                                    type="text"
                                    placeholder="First Name *"
                                    value={guest.firstName}
                                    onChange={(e) =>
                                      handleGuestChange(
                                        roomIndex,
                                        guestIndex,
                                        "firstName",
                                        e.target.value
                                      )
                                    }
                                    className="form-control-sm"
                                    isInvalid={
                                      !!validationErrors[
                                        `room_${roomIndex}_guest_${guestIndex}_firstName`
                                      ]
                                    }
                                  />
                                  {validationErrors[
                                    `room_${roomIndex}_guest_${guestIndex}_firstName`
                                  ] && (
                                    <Form.Control.Feedback type="invalid">
                                      {
                                        validationErrors[
                                          `room_${roomIndex}_guest_${guestIndex}_firstName`
                                        ]
                                      }
                                    </Form.Control.Feedback>
                                  )}
                                </Col>
                                <Col md={3}>
                                  <Form.Control
                                    type="text"
                                    placeholder="Last Name *"
                                    value={guest.lastName}
                                    onChange={(e) =>
                                      handleGuestChange(
                                        roomIndex,
                                        guestIndex,
                                        "lastName",
                                        e.target.value
                                      )
                                    }
                                    className="form-control-sm"
                                    isInvalid={
                                      !!validationErrors[
                                        `room_${roomIndex}_guest_${guestIndex}_lastName`
                                      ]
                                    }
                                  />
                                  {validationErrors[
                                    `room_${roomIndex}_guest_${guestIndex}_lastName`
                                  ] && (
                                    <Form.Control.Feedback type="invalid">
                                      {
                                        validationErrors[
                                          `room_${roomIndex}_guest_${guestIndex}_lastName`
                                        ]
                                      }
                                    </Form.Control.Feedback>
                                  )}
                                </Col>
                                <Col md={2}>
                                  <Form.Select
                                    value={guest.gender}
                                    onChange={(e) =>
                                      handleGuestChange(
                                        roomIndex,
                                        guestIndex,
                                        "gender",
                                        e.target.value
                                      )
                                    }
                                    className="form-control-sm"
                                    isInvalid={
                                      !!validationErrors[
                                        `room_${roomIndex}_guest_${guestIndex}_gender`
                                      ]
                                    }
                                  >
                                    <option value="">Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                  </Form.Select>
                                  {validationErrors[
                                    `room_${roomIndex}_guest_${guestIndex}_gender`
                                  ] && (
                                    <Form.Control.Feedback type="invalid">
                                      {
                                        validationErrors[
                                          `room_${roomIndex}_guest_${guestIndex}_gender`
                                        ]
                                      }
                                    </Form.Control.Feedback>
                                  )}
                                </Col>
                              </Row>
                              {guestIndex < room.guests.length - 1 && (
                                <hr className="my-3" />
                              )}
                            </div>
                          ))}
                        </Accordion.Body>
                      </Accordion.Item>
                    ))}
                  </Accordion>
                </Card.Body>
              </Card>

              {/* Primary Guest */}
              <Card className="p-4 mb-4 shadow-sm border-0">
                <h5 className="mb-3 fw-bold">Primary Guest Details</h5>
                <Row className="g-3">
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>
                        <span style={{ color: "red" }}>*</span>Salutation
                      </Form.Label>
                      <Form.Select
                        value={primaryGuest.salutation}
                        onChange={(e) =>
                          handlePrimaryGuestChange("salutation", e.target.value)
                        }
                        isInvalid={!!validationErrors.salutation}
                      >
                        <option value="">Select</option>
                        <option value="Mr">Mr</option>
                        <option value="Mrs">Mrs</option>
                        <option value="Ms">Ms</option>
                        <option value="Dr">Dr</option>
                      </Form.Select>
                      {validationErrors.salutation && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.salutation}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>
                        <span style={{ color: "red" }}>*</span>First Name
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={primaryGuest.firstName}
                        onChange={(e) =>
                          handlePrimaryGuestChange("firstName", e.target.value)
                        }
                        isInvalid={!!validationErrors.firstName}
                        required
                      />
                      {validationErrors.firstName && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.firstName}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Middle Name</Form.Label>
                      <Form.Control
                        type="text"
                        value={primaryGuest.middleName}
                        onChange={(e) =>
                          handlePrimaryGuestChange("middleName", e.target.value)
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>
                        <span style={{ color: "red" }}>*</span>Last Name
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={primaryGuest.lastName}
                        onChange={(e) =>
                          handlePrimaryGuestChange("lastName", e.target.value)
                        }
                        isInvalid={!!validationErrors.lastName}
                        required
                      />
                      {validationErrors.lastName && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.lastName}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>
                        <span style={{ color: "red" }}>*</span>Email
                      </Form.Label>
                      <Form.Control
                        type="email"
                        value={primaryGuest.email}
                        onChange={(e) =>
                          handlePrimaryGuestChange("email", e.target.value)
                        }
                        isInvalid={!!validationErrors.email}
                        required
                      />
                      {validationErrors.email && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.email}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>
                        <span style={{ color: "red" }}>*</span>Phone
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={primaryGuest.phone}
                        onChange={(e) =>
                          handlePrimaryGuestChange("phone", e.target.value)
                        }
                        isInvalid={!!validationErrors.phone}
                        required
                      />
                      {validationErrors.phone && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.phone}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Passport No</Form.Label>
                      <Form.Control
                        type="text"
                        value={primaryGuest.passportNo}
                        onChange={(e) =>
                          handlePrimaryGuestChange("passportNo", e.target.value)
                        }
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>
                        <span style={{ color: "red" }}>*</span>Agent LPO
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={primaryGuest.agentLpo}
                        onChange={(e) =>
                          handlePrimaryGuestChange("agentLpo", e.target.value)
                        }
                        isInvalid={!!validationErrors.agentLpo}
                        required
                      />
                      {validationErrors.agentLpo && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.agentLpo}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                </Row>
              </Card>

              {/* Remarks & Requests */}
              <Card className="p-4 mb-4 shadow-sm border-0">
                <h5 className="mb-3 fw-bold">Remarks & Special Requests</h5>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Remarks</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        placeholder="Any remarks..."
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group>
                      <Form.Label>Special Requests</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        placeholder="Any special requests..."
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => navigate(-1)}>
                  Back
                </Button>
                <Button variant="primary" type="submit" onClick={handleSubmit}>
                  Confirm Booking
                </Button>
              </div>

              {/* ✅ Confirmation Modal */}
             <Modal
  show={showConfirmModal}
  onHide={() => setShowConfirmModal(false)}
  centered
  backdrop="static"
  size="md"
>
  <Modal.Header
    closeButton
    className="bg-primary text-white py-2"
    style={{ borderBottom: "none" }}
  >
    <Modal.Title className="fw-semibold d-flex align-items-center">
      <FaHotel className="me-2" /> Confirm Your Booking
    </Modal.Title>
  </Modal.Header>

  <Modal.Body className="px-4 py-3 bg-light">
    {pendingPayload && (
      <div className="border rounded-3 bg-white shadow-sm p-3">
        <div className="mb-3">
          <h5 className="fw-bold text-primary mb-2">
            {pendingPayload.hotelName}
          </h5>
          <p className="text-muted mb-0">{pendingPayload.address}</p>
        </div>

        <hr />

        <Row className="gy-2">
          <Col xs={6}>
            <p className="mb-1">
              <strong>Check-In:</strong>
              <br />
              <span className="text-dark">{pendingPayload.checkInDate}</span>
            </p>
          </Col>
          <Col xs={6}>
            <p className="mb-1">
              <strong>Check-Out:</strong>
              <br />
              <span className="text-dark">{pendingPayload.checkOutDate}</span>
            </p>
          </Col>
          <Col xs={6}>
            <p className="mb-1">
              <strong>Rooms:</strong> {pendingPayload.rooms.length}
            </p>
          </Col>
          <Col xs={6}>
            <p className="mb-1">
              <strong>Nights:</strong> {pendingPayload.nights}
            </p>
          </Col>
          <Col xs={12}>
            <div className="p-3 rounded bg-gradient-success text-white text-center mt-2">
              <h6 className="mb-0 fw-bold">Total Price</h6>
              <h4 className="mb-0">
                {formatPrice(
                  pendingPayload.rooms.reduce(
                    (sum, r) => sum + (r.rate || 0),
                    0
                  )
                )}
              </h4>
            </div>
          </Col>
        </Row>

        <div className="mt-4 text-center">
          <p className="text-muted small mb-0">
            Please review the booking details carefully before confirming.
          </p>
        </div>
      </div>
    )}
  </Modal.Body>

  <Modal.Footer className="bg-light border-0 d-flex justify-content-between">
    <Button
      variant="outline-secondary"
      onClick={() => setShowConfirmModal(false)}
      disabled={isSubmitting}
    >
      <i className="bi bi-x-circle me-1"></i> Cancel
    </Button>
    <Button
      variant="primary"
      onClick={confirmBooking}
      disabled={isSubmitting}
      className="px-4 fw-semibold"
    >
      {isSubmitting ? (
        <>
          <span
            className="spinner-border spinner-border-sm me-2"
            role="status"
          ></span>
          Processing...
        </>
      ) : (
        <>
          <i className="bi bi-check-circle me-1"></i> Confirm
        </>
      )}
    </Button>
  </Modal.Footer>
</Modal>

            </Form>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default HotelBookingPage;
