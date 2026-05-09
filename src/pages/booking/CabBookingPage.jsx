import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Badge,
  Spinner,
  Modal,
  Table,
} from "react-bootstrap";
import { FaCar, FaUserAlt, FaCheckCircle, FaCalendarAlt, FaMapMarkerAlt } from "react-icons/fa";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import AgentBalanceDisplay from "../../components/AgentBalanceDisplay";

const formatDateToDDMMYYYY = (dateString) => {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${day}-${month}-${year}`;
};

const CabBookingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cab, selectedOption, searchCriteria } = location.state || {};

  // If accessed directly without state, we should probably redirect or show an error
  const hasValidState = !!cab && !!selectedOption && !!searchCriteria;

  const [primaryGuest, setPrimaryGuest] = useState({
    salutation: "Mr",
    firstName: "",
    lastName: "",
    contactNumber: "",
    emailId: "",
    passportNumber: "",
    lpo: "",
  });

  const [transporterDetails, setTransporterDetails] = useState({
    transporter: "",
    contactNumber: "",
    driverName: "",
    driverContact: "",
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Order Summary modal — mirrors HotelBookingPage.jsx pattern ─────
  // The "Confirm Booking" button now validates + builds the payload and
  // opens this modal. Only the modal's own confirm action actually POSTs
  // to /api/cab/book, giving the user a final review step before save.
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  const rate = selectedOption?.types === "SIC" ? selectedOption.sicRate : selectedOption?.privateRate;
  const initialTotalRate = selectedOption?.totalRateWithoutMrk || rate || 0;

  const [prices, setPrices] = useState({
    sellingPrice: initialTotalRate.toString(),
    totalPrice: initialTotalRate.toString(),
  });
  const [tourismDirham, setTourismDirham] = useState("");

  // If no state, show prompt
  if (!hasValidState) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4 d-flex justify-content-center align-items-center">
            <Card className="text-center p-5 shadow-sm border-0 rounded-4">
              <Card.Body>
                <FaCar className="display-4 text-warning mb-3" />
                <h4 className="fw-bold mb-3">No Transfer Selected</h4>
                <p className="text-muted mb-4">Please select a transfer from the search page first.</p>
                <Button variant="primary" onClick={() => navigate("/new-booking/cab")}>
                  Go to Cab Search
                </Button>
              </Card.Body>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  const totalRate = parseFloat(prices.totalPrice) || initialTotalRate;

  const handlePrimaryGuestChange = (field, value) => {
    setPrimaryGuest((prev) => ({ ...prev, [field]: value }));

    // Real-time validation for email format
    if (field === "emailId" && value.trim() !== "") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        setValidationErrors((prev) => ({
          ...prev,
          emailId: "Please enter a valid email address",
        }));
        return;
      }
    }

    // Clear validation error when user starts typing
    const errorKey = field;
    if (validationErrors[errorKey]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[errorKey];
        return updated;
      });
    }
  };

  const handleTransporterChange = (field, value) => {
    setTransporterDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handlePriceChange = (field, value) => {
    setPrices((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const errors = {};
    let hasErrors = false;

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
    if (!primaryGuest.contactNumber || primaryGuest.contactNumber.trim() === "") {
      errors.contactNumber = "Contact Number is required";
      hasErrors = true;
    }
    if (!primaryGuest.emailId || primaryGuest.emailId.trim() === "") {
      errors.emailId = "Email Id is required";
      hasErrors = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryGuest.emailId)) {
      errors.emailId = "Please enter a valid email address";
      hasErrors = true;
    }
    if (!primaryGuest.lpo || primaryGuest.lpo.trim() === "") {
      errors.lpo = "LPO is required";
      hasErrors = true;
    }

    return { errors, hasErrors };
  };

  // ── Step 1: validate + build payload + open Order Summary modal.
  // No backend call yet — the user must explicitly confirm in the modal.
  const handleConfirmClick = () => {
    const { errors, hasErrors } = validateForm();

    if (hasErrors) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields correctly.");
      return;
    }

    const agentId = sessionStorage.getItem("makeYourOwnPackageAgentId")
                 || localStorage.getItem("makeYourOwnPackageAgentId")
                 || "1";

    const tdNumber =
      tourismDirham !== "" && !isNaN(Number(tourismDirham))
        ? Number(tourismDirham)
        : 0;
    const sellingWithTd = (parseFloat(prices.sellingPrice) || 0) + tdNumber;
    const totalWithTd = (parseFloat(prices.totalPrice) || totalRate) + tdNumber;

    const payload = {
      cabId: cab.cabid,
      noOfCabs: cab.noOfCabs || 1,
      pickupDate: formatDateToDDMMYYYY(searchCriteria.pickupDate),
      dropOffDate: formatDateToDDMMYYYY(searchCriteria.dropoffDate || searchCriteria.pickupDate),
      travelType: parseInt(selectedOption.travelType) || 1,
      locationId: parseInt(selectedOption.locationId) || 0,
      noOfAdult: parseInt(searchCriteria.adults) || 1,
      noOfChild: parseInt(searchCriteria.children) || 0,
      childAgeArray: (searchCriteria.childAges || []).map(age => parseInt(age)),
      totalRate: totalWithTd,
      totalRateWithoutmrk: parseFloat(selectedOption.totalRateWithoutMrk || totalRate),
      tourismDirham: tdNumber > 0 ? tdNumber : null,
      agentId: parseInt(agentId),
      userId: parseInt(agentId),
      customerDTO: {
        salutation: primaryGuest.salutation,
        firstName: primaryGuest.firstName,
        lastName: primaryGuest.lastName,
        contactNumber: primaryGuest.contactNumber,
        emailId: primaryGuest.emailId,
        passportNumber: primaryGuest.passportNumber,
        lpo: primaryGuest.lpo
      },
      transporter: transporterDetails.transporter,
      contactNumber: transporterDetails.contactNumber,
      driverName: transporterDetails.driverName,
      driverContact: transporterDetails.driverContact,
      sellingPrice: String(sellingWithTd.toFixed(2)),
      totalPrice: String(totalWithTd.toFixed(2)),
      // Pickup / Drop-off details forwarded from the search page.
      pickupType: searchCriteria.pickupType || null,
      pickupName: searchCriteria.pickupName || null,
      pickupTime:
        searchCriteria.pickupType === "AIRPORT" && searchCriteria.pickupTime
          ? searchCriteria.pickupTime
          : null,
      dropoffType: searchCriteria.dropoffType || null,
      dropoffName: searchCriteria.dropoffName || null,
      dropoffTime: searchCriteria.dropoffTime || null,
    };

    setPendingPayload(payload);
    setShowSummaryModal(true);
  };

  // ── Step 2: actually POST to /api/cab/book once the user confirms in
  // the Order Summary modal. Mirrors HotelBookingPage.jsx's confirmBooking.
  const submitBooking = async () => {
    if (!pendingPayload) return;
    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post("/api/cab/book", pendingPayload);

      if (response && (response.data?.success !== false && response.status === 200)) {
        toast.success("Cab booked successfully!");
        setShowSummaryModal(false);
        navigate("/booking-details/cab-booking-list");
      } else {
        toast.error(response.data?.message || "Failed to book cab.");
      }
    } catch (error) {
      console.error("Booking error:", error);
      toast.error("An error occurred during booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
    }).format(price || 0);
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid className="px-0">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h4 className="fw-bold mb-0 text-primary">Cab Booking Checkout</h4>
              <AgentBalanceDisplay
                agentId={
                  sessionStorage.getItem("makeYourOwnPackageAgentId") ||
                  localStorage.getItem("makeYourOwnPackageAgentId")
                }
              />
            </div>

            <Row className="g-4">
              {/* Left Column: Guest Details */}
              <Col lg={8}>
               <Card className="shadow border-0 rounded-4 mb-4">
  
  {/* Header */}
  <Card.Header className="bg-white border-0 pt-4 px-4">
    <h5 className="fw-semibold text-dark d-flex align-items-center mb-0">
      <FaUserAlt className="me-2 text-primary" />
      Primary Guest Details
    </h5>
  </Card.Header>

  <Card.Body className="px-4 pb-4">

    <Row className="g-3">

      {/* Salutation */}
      <Col xs={12} md={3} lg={2}>
        <Form.Group>
          <Form.Label className="small text-muted fw-semibold">
            Salutation <span className="text-danger">*</span>
          </Form.Label>

          <Form.Select
            className="rounded-3 shadow-sm"
            value={primaryGuest.salutation}
            onChange={(e) =>
              handlePrimaryGuestChange("salutation", e.target.value)
            }
            isInvalid={!!validationErrors.salutation}
          >
            <option value="Mr">Mr</option>
            <option value="Mrs">Mrs</option>
            <option value="Ms">Ms</option>
            <option value="Miss">Miss</option>
            <option value="Dr">Dr</option>
          </Form.Select>

          <Form.Control.Feedback type="invalid">
            {validationErrors.salutation}
          </Form.Control.Feedback>
        </Form.Group>
      </Col>

      {/* First Name */}
      <Col xs={12} md={5}>
        <Form.Group>
          <Form.Label className="small text-muted fw-semibold">
            First Name <span className="text-danger">*</span>
          </Form.Label>

          <Form.Control
            type="text"
            placeholder="First Name"
            className="rounded-3 shadow-sm"
            value={primaryGuest.firstName}
            onChange={(e) =>
              handlePrimaryGuestChange("firstName", e.target.value)
            }
            isInvalid={!!validationErrors.firstName}
          />

          <Form.Control.Feedback type="invalid">
            {validationErrors.firstName}
          </Form.Control.Feedback>
        </Form.Group>
      </Col>

      {/* Last Name */}
      <Col xs={12} md={4} lg={5}>
        <Form.Group>
          <Form.Label className="small text-muted fw-semibold">
            Last Name <span className="text-danger">*</span>
          </Form.Label>

          <Form.Control
            type="text"
            placeholder="Last Name"
            className="rounded-3 shadow-sm"
            value={primaryGuest.lastName}
            onChange={(e) =>
              handlePrimaryGuestChange("lastName", e.target.value)
            }
            isInvalid={!!validationErrors.lastName}
          />

          <Form.Control.Feedback type="invalid">
            {validationErrors.lastName}
          </Form.Control.Feedback>
        </Form.Group>
      </Col>

      {/* Phone */}
      <Col xs={12} md={6}>
        <Form.Group>
          <Form.Label className="small text-muted fw-semibold">
            Contact Number <span className="text-danger">*</span>
          </Form.Label>

          <Form.Control
            type="text"
            placeholder="Contact Number"
            className="rounded-3 shadow-sm"
            value={primaryGuest.contactNumber}
            onChange={(e) =>
              handlePrimaryGuestChange("contactNumber", e.target.value)
            }
            isInvalid={!!validationErrors.contactNumber}
          />

          <Form.Control.Feedback type="invalid">
            {validationErrors.contactNumber}
          </Form.Control.Feedback>
        </Form.Group>
      </Col>

      {/* Email */}
      <Col xs={12} md={6}>
        <Form.Group>
          <Form.Label className="small text-muted fw-semibold">
            Email ID <span className="text-danger">*</span>
          </Form.Label>

          <Form.Control
            type="email"
            placeholder="Email ID"
            className="rounded-3 shadow-sm"
            value={primaryGuest.emailId}
            onChange={(e) =>
              handlePrimaryGuestChange("emailId", e.target.value)
            }
            isInvalid={!!validationErrors.emailId}
          />

          <Form.Control.Feedback type="invalid">
            {validationErrors.emailId}
          </Form.Control.Feedback>
        </Form.Group>
      </Col>

      {/* Passport */}
      <Col xs={12} md={6}>
        <Form.Group>
          <Form.Label className="small text-muted fw-semibold">
            Passport Number{" "}
          </Form.Label>

          <Form.Control
            type="text"
            placeholder="Passport Number"
            className="rounded-3 shadow-sm"
            value={primaryGuest.passportNumber}
            onChange={(e) =>
              handlePrimaryGuestChange("passportNumber", e.target.value)
            }
          />
        </Form.Group>
      </Col>

      {/* LPO */}
      <Col xs={12} md={6}>
        <Form.Group>
          <Form.Label className="small text-muted fw-semibold">
            LPO Number <span className="text-danger">*</span>
          </Form.Label>

          <Form.Control
            type="text"
            placeholder="Agent LPO"
            className="rounded-3 shadow-sm"
            value={primaryGuest.lpo}
            onChange={(e) =>
              handlePrimaryGuestChange("lpo", e.target.value)
            }
            isInvalid={!!validationErrors.lpo}
          />

          <Form.Control.Feedback type="invalid">
            {validationErrors.lpo}
          </Form.Control.Feedback>
        </Form.Group>
      </Col>

    </Row>

  </Card.Body>
</Card>

                {/* Transporter & Driver Details Card */}
               <Card className="shadow border-0 rounded-4 mb-4">

  {/* Header */}
  <Card.Header className="bg-white border-0 pt-4 px-4">
    <h5 className="fw-semibold text-dark d-flex align-items-center mb-0">
      <FaCar className="me-2 text-primary" />
      Transporter & Driver Details
    </h5>
  </Card.Header>

  <Card.Body className="px-4 pb-4">

    {/* ===== Transport Fields ===== */}
    <Row className="g-3">

      <Col xs={12} md={6}>
        <Form.Group>
          <Form.Label className="small text-muted fw-semibold">
            Transporter Name
          </Form.Label>
          <Form.Control
            className="rounded-3 shadow-sm"
            placeholder="Enter transporter name"
            value={transporterDetails.transporter}
            onChange={(e) =>
              handleTransporterChange("transporter", e.target.value)
            }
          />
        </Form.Group>
      </Col>

      <Col xs={12} md={6}>
        <Form.Group>
          <Form.Label className="small text-muted fw-semibold">
            Contact Number
          </Form.Label>
          <Form.Control
            className="rounded-3 shadow-sm"
            placeholder="Enter contact number"
            value={transporterDetails.contactNumber}
            onChange={(e) =>
              handleTransporterChange("contactNumber", e.target.value)
            }
          />
        </Form.Group>
      </Col>

      <Col xs={12} md={6}>
        <Form.Group>
          <Form.Label className="small text-muted fw-semibold">
            Driver Name
          </Form.Label>
          <Form.Control
            className="rounded-3 shadow-sm"
            placeholder="Enter driver name"
            value={transporterDetails.driverName}
            onChange={(e) =>
              handleTransporterChange("driverName", e.target.value)
            }
          />
        </Form.Group>
      </Col>

      <Col xs={12} md={6}>
        <Form.Group>
          <Form.Label className="small text-muted fw-semibold">
            Driver Contact
          </Form.Label>
          <Form.Control
            className="rounded-3 shadow-sm"
            placeholder="Enter driver contact"
            value={transporterDetails.driverContact}
            onChange={(e) =>
              handleTransporterChange("driverContact", e.target.value)
            }
          />
        </Form.Group>
      </Col>

    </Row>

    {/* ===== Price Section ===== */}
    <div className="mt-4 pt-4 border-top">

      <Row className="g-3">

        {/* Selling Price */}
        <Col xs={12} md={6}>
          <div className="bg-light border rounded-3 p-3 h-100">
            <small className="text-muted fw-semibold d-block mb-1">
              Selling Price
            </small>

            <div className="d-flex align-items-center">
              <span className="text-muted me-2">AED</span>

              <Form.Control
                type="text"
                className="border-0 bg-transparent p-0 fw-bold text-success"
                value={prices.sellingPrice}
                onChange={(e) =>
                  handlePriceChange("sellingPrice", e.target.value)
                }
              />
            </div>
          </div>
        </Col>

        {/* Total Price */}
        <Col xs={12} md={6}>
          <div className="bg-light border rounded-3 p-3 h-100">
            <small className="text-muted fw-semibold d-block mb-1">
              Total Price
            </small>

            <div className="d-flex align-items-center">
              <span className="text-muted me-2">AED</span>

              <Form.Control
                type="text"
                className="border-0 bg-transparent p-0 fw-bold text-success"
                value={prices.totalPrice}
                onChange={(e) =>
                  handlePriceChange("totalPrice", e.target.value)
                }
              />
            </div>
          </div>
        </Col>

        {/* Tourism Dirham */}
        <Col xs={12} md={6}>
          <div className="bg-light border rounded-3 p-3 h-100">
            <small className="text-muted fw-semibold d-block mb-1">
              Tourism Dirham
            </small>

            <div className="d-flex align-items-center">
              <span className="text-muted me-2">AED</span>

              <Form.Control
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="border-0 bg-transparent p-0 fw-bold text-primary"
                value={tourismDirham}
                onChange={(e) => setTourismDirham(e.target.value)}
              />
            </div>
            <small className="text-muted">
              Optional — added to Selling &amp; Total Price.
            </small>
          </div>
        </Col>

      </Row>

    </div>

  </Card.Body>
</Card>
              </Col>

              {/* Right Column: Order Summary */}
              <Col lg={4}>
                <Card
  className="shadow border-0 rounded-4 "
 
>
  {/* ===== Header ===== */}
  <Card.Header
    className="border-0 rounded-top-4"
    style={{
      background: "#7193d5",
      padding: "18px 20px",
    }}
  >
    <div className="d-flex align-items-center justify-content-between">
      <div>
        <h5 className="mb-1 fw-bold text-white">Booking Summary</h5>
        <small className="text-white opacity-75">
          Review your trip details
        </small>
      </div>

      <div
        className="bg-white bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center"
        style={{ width: "40px", height: "40px" }}
      >
        <FaCar className="text-white" />
      </div>
    </div>
  </Card.Header>

  <Card.Body className="p-0">

    {/* ===== Transfer Info ===== */}
    <div className="p-4 border-bottom">

      {/* Cab Info */}
      <div className="d-flex align-items-start gap-3 mb-3">
        <div
          style={{
            width: "100px",
            height: "80px",
            borderRadius: "12px",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <img
            src={cab.cabpic || "https://via.placeholder.com/80?text=Cab"}
            alt={cab.cabname}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        <div className="flex-grow-1">
          <h6 className="fw-bold mb-1 text-dark">{cab.cabname}</h6>

          <div className="mb-2">
          <span
  className={`fw-semibold ${
    selectedOption.types === "Private"
      ? "text-success"
      : "text-info"
  }`}
>
  {selectedOption.types}
</span>
          </div>

          {cab.cabdetails && (
            <small className="text-muted d-block" style={{ lineHeight: "1.3" }}>
              {cab.cabdetails}
            </small>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-light rounded-3 p-3 mb-3">

        {/* Date */}
        <div className="d-flex align-items-start gap-2 mb-3">
          <FaCalendarAlt className="text-primary mt-1" />
          <div>
            <small className="text-muted fw-semibold d-block">
              Pickup Date
            </small>
            <span className="fw-medium text-dark">
              {searchCriteria.pickupDate}
            </span>
          </div>
        </div>

        {/* Route */}
        <div className="d-flex align-items-start gap-2">
          <FaMapMarkerAlt className="text-danger mt-1" />
          <div>
            <small className="text-muted fw-semibold d-block">
              Route Details
            </small>
            <span className="fw-medium text-dark">
              {selectedOption.location || "N/A"} →{" "}
              {selectedOption.dropOff || "N/A"}
            </span>
          </div>
        </div>

        {/* ── Pickup details ─────────────────────────────────────────
             Shows the chosen pickup category (HOTEL / AIRPORT) plus
             the actual facility name; airport pickups also show the
             time. The block is hidden entirely when no pickup type
             was selected upstream so existing flows aren't affected. */}
        {searchCriteria.pickupType && (
          <div className="d-flex align-items-start gap-2 mt-3">
            <FaMapMarkerAlt className="text-success mt-1" />
            <div>
              <small className="text-muted fw-semibold d-block">
                Pickup{" "}
                <span className="badge bg-success-subtle text-success ms-1">
                  {searchCriteria.pickupType}
                </span>
              </small>
              <span className="fw-medium text-dark">
                {searchCriteria.pickupName || "—"}
                {searchCriteria.pickupType === "AIRPORT" &&
                  searchCriteria.pickupTime && (
                    <span className="text-muted ms-2 small">
                      @ {searchCriteria.pickupTime}
                    </span>
                  )}
              </span>
            </div>
          </div>
        )}

        {/* ── Dropoff details (same pattern; time is always optional) ── */}
        {searchCriteria.dropoffType && (
          <div className="d-flex align-items-start gap-2 mt-3">
            <FaMapMarkerAlt className="text-warning mt-1" />
            <div>
              <small className="text-muted fw-semibold d-block">
                Dropoff{" "}
                <span className="badge bg-warning-subtle text-warning ms-1">
                  {searchCriteria.dropoffType}
                </span>
              </small>
              <span className="fw-medium text-dark">
                {searchCriteria.dropoffName || "—"}
                {searchCriteria.dropoffTime && (
                  <span className="text-muted ms-2 small">
                    @ {searchCriteria.dropoffTime}
                  </span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Passengers */}
      <div className="d-flex justify-content-between small">
        <span className="text-muted">
          Adults:{" "}
          <span className="fw-bold text-dark">
            {searchCriteria.adults}
          </span>
        </span>
        <span className="text-muted">
          Children:{" "}
          <span className="fw-bold text-dark">
            {searchCriteria.children}
          </span>
        </span>
      </div>
    </div>

    {/* ===== Price Section ===== */}
    <div className="p-4 bg-light">

      <div className="d-flex justify-content-between mb-2 text-muted">
        <span>Transfer Fare</span>
        <span className="fw-medium">{formatPrice(totalRate)}</span>
      </div>

      <div className="d-flex justify-content-between mb-3 text-muted">
        <span>Taxes & Fees</span>
        <span className="fw-medium">{formatPrice(0)}</span>
      </div>

      <hr className="my-3" />

      <div className="d-flex justify-content-between align-items-center">
        <span className="fw-bold text-dark fs-5">
          Total Amount
        </span>
        <span className="fw-bold text-primary fs-4">
          {formatPrice(totalRate)}
        </span>
      </div>
    </div>

    {/* ===== Button ===== */}
    <div className="p-4">

      <Button
        variant="success"
        className="w-100 py-3 rounded-3 fw-bold fs-5 shadow d-flex align-items-center justify-content-center gap-2"
        // Validate + build payload, then open the Order Summary modal.
        // The actual /api/cab/book POST happens only on modal-confirm.
        onClick={handleConfirmClick}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Spinner animation="border" size="sm" />
            Processing...
          </>
        ) : (
          <>
            <FaCheckCircle />
            Confirm Booking
          </>
        )}
      </Button>

      <p className="text-center text-muted small mt-3 mb-0">
        By confirming, you agree to the Terms and Conditions.
      </p>
    </div>

  </Card.Body>
</Card>
              </Col>
            </Row>
          </Container>
        </main>
      </div>

      {/* ── Order Summary modal (mirrors HotelBookingPage.jsx) ─────────
           Triggered by the page-level "Confirm Booking" button after
           validation passes. Lists everything the booking will save so
           the user can review before the actual POST. The "Confirm &
           Book" footer button is what calls /api/cab/book. */}
      <Modal
        show={showSummaryModal}
        onHide={() => !isSubmitting && setShowSummaryModal(false)}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton={!isSubmitting}>
          <Modal.Title>
            <FaCar className="me-2 text-primary" />
            Order Summary — please review
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Vehicle */}
          <Row className="mb-3">
            <Col md={2}>
              <img
                src={cab.cabpic || "https://via.placeholder.com/80?text=Cab"}
                alt={cab.cabname}
                style={{ width: "100%", height: 70, objectFit: "cover", borderRadius: 8 }}
              />
            </Col>
            <Col md={10}>
              <h6 className="fw-bold mb-1">{cab.cabname}</h6>
              <Badge bg={selectedOption?.types === "Private" ? "success" : "info"}>
                {selectedOption?.types}
              </Badge>
              {cab.cabdetails && (
                <div className="text-muted small mt-1">{cab.cabdetails}</div>
              )}
            </Col>
          </Row>

          <hr />

          {/* Trip */}
          <h6 className="fw-bold mb-2">Trip</h6>
          <Row className="mb-3">
            <Col md={4}>
              <small className="text-muted d-block">Pickup Date</small>
              <span>{searchCriteria.pickupDate || "—"}</span>
            </Col>
            <Col md={4}>
              <small className="text-muted d-block">Dropoff Date</small>
              <span>{searchCriteria.dropoffDate || searchCriteria.pickupDate || "—"}</span>
            </Col>
            <Col md={4}>
              <small className="text-muted d-block">Route</small>
              <span>
                {selectedOption?.location || "N/A"} → {selectedOption?.dropOff || "N/A"}
              </span>
            </Col>
          </Row>

          {/* Pickup / Dropoff details — only shown when chosen upstream */}
          {(searchCriteria.pickupType || searchCriteria.dropoffType) && (
            <>
              <h6 className="fw-bold mb-2">Pickup &amp; Dropoff</h6>
              <Table size="sm" bordered className="mb-3">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "20%" }}></th>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {searchCriteria.pickupType && (
                    <tr>
                      <td className="fw-semibold">Pickup</td>
                      <td>
                        <Badge bg="success-subtle" text="success">
                          {searchCriteria.pickupType}
                        </Badge>
                      </td>
                      <td>{searchCriteria.pickupName || "—"}</td>
                      <td>
                        {searchCriteria.pickupType === "AIRPORT" && searchCriteria.pickupTime
                          ? searchCriteria.pickupTime
                          : "—"}
                      </td>
                    </tr>
                  )}
                  {searchCriteria.dropoffType && (
                    <tr>
                      <td className="fw-semibold">Dropoff</td>
                      <td>
                        <Badge bg="warning-subtle" text="warning">
                          {searchCriteria.dropoffType}
                        </Badge>
                      </td>
                      <td>{searchCriteria.dropoffName || "—"}</td>
                      <td>{searchCriteria.dropoffTime || "—"}</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </>
          )}

          {/* Passengers */}
          <h6 className="fw-bold mb-2">Passengers</h6>
          <Row className="mb-3">
            <Col md={6}>
              <small className="text-muted d-block">Adults</small>
              <span>{searchCriteria.adults || 0}</span>
            </Col>
            <Col md={6}>
              <small className="text-muted d-block">Children</small>
              <span>{searchCriteria.children || 0}</span>
            </Col>
          </Row>

          <hr />

          {/* Primary guest */}
          <h6 className="fw-bold mb-2">Primary Guest</h6>
          <Row className="mb-3">
            <Col md={6}>
              <small className="text-muted d-block">Name</small>
              <span>
                {[primaryGuest.salutation, primaryGuest.firstName, primaryGuest.lastName]
                  .filter(Boolean).join(" ") || "—"}
              </span>
            </Col>
            <Col md={3}>
              <small className="text-muted d-block">Phone</small>
              <span>{primaryGuest.contactNumber || "—"}</span>
            </Col>
            <Col md={3}>
              <small className="text-muted d-block">LPO</small>
              <span>{primaryGuest.lpo || "—"}</span>
            </Col>
            <Col md={6} className="mt-2">
              <small className="text-muted d-block">Email</small>
              <span>{primaryGuest.emailId || "—"}</span>
            </Col>
            <Col md={6} className="mt-2">
              <small className="text-muted d-block">Passport</small>
              <span>{primaryGuest.passportNumber || "—"}</span>
            </Col>
          </Row>

          {/* Transporter (only if anything filled) */}
          {(transporterDetails.transporter || transporterDetails.driverName) && (
            <>
              <h6 className="fw-bold mb-2">Transporter &amp; Driver</h6>
              <Row className="mb-3">
                <Col md={6}>
                  <small className="text-muted d-block">Transporter</small>
                  <span>{transporterDetails.transporter || "—"}</span>
                </Col>
                <Col md={6}>
                  <small className="text-muted d-block">Transporter Contact</small>
                  <span>{transporterDetails.contactNumber || "—"}</span>
                </Col>
                <Col md={6} className="mt-2">
                  <small className="text-muted d-block">Driver</small>
                  <span>{transporterDetails.driverName || "—"}</span>
                </Col>
                <Col md={6} className="mt-2">
                  <small className="text-muted d-block">Driver Contact</small>
                  <span>{transporterDetails.driverContact || "—"}</span>
                </Col>
              </Row>
            </>
          )}

          <hr />

          {/* Total */}
          <div className="d-flex justify-content-between align-items-center p-3 bg-light rounded">
            <span className="fw-semibold">Total Amount</span>
            <span className="fs-4 fw-bold text-success">
              AED {Number(prices.totalPrice).toFixed(2)}
            </span>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowSummaryModal(false)}
            disabled={isSubmitting}
          >
            Edit Details
          </Button>
          <Button
            variant="success"
            onClick={submitBooking}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Booking…
              </>
            ) : (
              <>
                <FaCheckCircle className="me-2" />
                Confirm &amp; Book
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CabBookingPage;