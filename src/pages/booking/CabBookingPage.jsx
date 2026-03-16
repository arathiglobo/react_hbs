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
  Spinner
} from "react-bootstrap";
import { FaCar, FaUserAlt, FaCheckCircle, FaCalendarAlt, FaMapMarkerAlt } from "react-icons/fa";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";

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

  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const rate = selectedOption.types === "SIC" ? selectedOption.sicRate : selectedOption.privateRate;
  const totalRate = selectedOption.totalRateWithoutMrk || rate || 0;

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

  const confirmBooking = async () => {
    const { errors, hasErrors } = validateForm();

    if (hasErrors) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields correctly.");
      return;
    }

    setIsSubmitting(true);
    try {
      const agentId = sessionStorage.getItem("makeYourOwnPackageAgentId") 
                   || localStorage.getItem("makeYourOwnPackageAgentId")
                   || "1";

      const payload = {
        agentId: parseInt(agentId),
        cabId: cab.cabid,
        cabName: cab.cabname,
        travelType: selectedOption.travelType || "1",
        shareType: selectedOption.types,
        locationId: String(selectedOption.locationId || ""),
        pickupDate: searchCriteria.pickupDate,
        dropoffDate: searchCriteria.dropoffDate || searchCriteria.pickupDate,
        adults: searchCriteria.adults,
        children: searchCriteria.children,
        childAges: searchCriteria.childAges || [],
        totalRate: totalRate,
        primaryGuestDetails: {
          salutation: primaryGuest.salutation,
          firstName: primaryGuest.firstName,
          lastName: primaryGuest.lastName,
          contactNumber: primaryGuest.contactNumber,
          emailId: primaryGuest.emailId,
          passportNumber: primaryGuest.passportNumber,
          lpo: primaryGuest.lpo
        }
      };

      const response = await axiosInstance.post("/api/saveCabBooking", payload);

      if (response && (response.data?.success !== false && response.status === 200)) {
        toast.success("Cab booked successfully!");
        navigate("/new-booking/cab"); // Or to a booking success list page
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
            <h4 className="fw-bold mb-4 text-primary">Cab Booking Checkout</h4>
            
            <Row className="g-4">
              {/* Left Column: Guest Details */}
              <Col lg={8}>
                <Card className="shadow-sm border-0 rounded-4 mb-4">
                  <Card.Header className="bg-white border-bottom-0 pt-4 pb-0 px-4">
                    <h5 className="fw-bold text-dark d-flex align-items-center m-0">
                      <FaUserAlt className="me-2 text-primary" />
                      Primary Guest Details
                    </h5>
                  </Card.Header>
                  <Card.Body className="p-4">
                    <Row className="g-3">
                      <Col md={2}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold text-muted">Salutation <span className="text-danger">*</span></Form.Label>
                          <Form.Select
                            value={primaryGuest.salutation}
                            onChange={(e) => handlePrimaryGuestChange("salutation", e.target.value)}
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
                      <Col md={5}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold text-muted">First Name <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="e.g. John"
                            value={primaryGuest.firstName}
                            onChange={(e) => handlePrimaryGuestChange("firstName", e.target.value)}
                            isInvalid={!!validationErrors.firstName}
                          />
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.firstName}
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                      <Col md={5}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold text-muted">Last Name <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="e.g. Doe"
                            value={primaryGuest.lastName}
                            onChange={(e) => handlePrimaryGuestChange("lastName", e.target.value)}
                            isInvalid={!!validationErrors.lastName}
                          />
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.lastName}
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold text-muted">Contact Number <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="+1 234 567 8900"
                            value={primaryGuest.contactNumber}
                            onChange={(e) => handlePrimaryGuestChange("contactNumber", e.target.value)}
                            isInvalid={!!validationErrors.contactNumber}
                          />
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.contactNumber}
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold text-muted">Email ID <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="email"
                            placeholder="john.doe@example.com"
                            value={primaryGuest.emailId}
                            onChange={(e) => handlePrimaryGuestChange("emailId", e.target.value)}
                            isInvalid={!!validationErrors.emailId}
                          />
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.emailId}
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold text-muted">Passport Number <span className="text-muted fw-normal">(Optional)</span></Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="A1234567"
                            value={primaryGuest.passportNumber}
                            onChange={(e) => handlePrimaryGuestChange("passportNumber", e.target.value)}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold text-muted">LPO Number <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="LPO-12345"
                            value={primaryGuest.lpo}
                            onChange={(e) => handlePrimaryGuestChange("lpo", e.target.value)}
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
              </Col>

              {/* Right Column: Order Summary */}
              <Col lg={4}>
                <Card className="shadow-sm border-0 rounded-4 sticky-top" style={{ top: "20px" }}>
                  <Card.Header className="bg-primary text-white border-bottom-0 p-3 rounded-top-4">
                    <h5 className="mb-0 fw-bold">Booking Summary</h5>
                  </Card.Header>
                  <Card.Body className="p-0">
                    {/* Transfer Info */}
                    <div className="p-3 border-bottom">
                      <div className="d-flex mb-3">
                        <div className="me-3" style={{ width: "80px", height: "80px", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
                          <img 
                            src={cab.cabpic || "https://via.placeholder.com/80?text=Cab"} 
                            alt={cab.cabname}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                        <div>
                          <h6 className="fw-bold mb-1 text-dark">{cab.cabname}</h6>
                          <div className="mb-1">
                            <span className={`badge ${selectedOption.types === 'Private' ? 'bg-success' : 'bg-info'} bg-opacity-10 text-${selectedOption.types === 'Private' ? 'success' : 'info'} border border-${selectedOption.types === 'Private' ? 'success' : 'info'} border-opacity-25 mr-1`}>
                              {selectedOption.types}
                            </span>
                          </div>
                          {cab.cabdetails && <small className="text-muted d-block line-clamp-2">{cab.cabdetails}</small>}
                        </div>
                      </div>

                      <div className="bg-light rounded p-2 mb-2">
                        <div className="d-flex align-items-start mb-2">
                          <FaCalendarAlt className="text-primary mt-1 me-2 flex-shrink-0" />
                          <div>
                            <small className="d-block text-muted fw-semibold">Pickup Date</small>
                            <span className="fw-medium text-dark">{searchCriteria.pickupDate}</span>
                          </div>
                        </div>
                        <div className="d-flex align-items-start mb-2">
                          <FaMapMarkerAlt className="text-danger mt-1 me-2 flex-shrink-0" />
                          <div>
                            <small className="d-block text-muted fw-semibold">Route details</small>
                            <span className="fw-medium text-dark">{selectedOption.location || "N/A"} → {selectedOption.dropOff || "N/A"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="d-flex justify-content-between text-muted small">
                        <span>Adults: <span className="fw-bold text-dark">{searchCriteria.adults}</span></span>
                        <span>Children: <span className="fw-bold text-dark">{searchCriteria.children}</span></span>
                      </div>
                    </div>

                    {/* Price Summary */}
                    <div className="p-3 bg-light">
                      <div className="d-flex justify-content-between align-items-center mb-2 text-muted">
                        <span>Transfer Fare</span>
                        <span className="fw-medium">{formatPrice(totalRate)}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-2 text-muted">
                        <span>Taxes & Fees</span>
                        <span className="fw-medium">{formatPrice(0)}</span>
                      </div>
                      
                      <hr className="my-3 border-secondary border-opacity-25" />
                      
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="fw-bold text-dark fs-5">Total Amount</span>
                        <span className="fw-bold text-primary fs-4">{formatPrice(totalRate)}</span>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="p-3">
                      <Button
                        variant="success"
                        className="w-100 py-3 rounded-3 fw-bold fs-5 shadow-sm d-flex justify-content-center align-items-center"
                        onClick={confirmBooking}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Processing Booking...
                          </>
                        ) : (
                          <>
                            <FaCheckCircle className="me-2" /> Confirm Booking
                          </>
                        )}
                      </Button>
                      <p className="text-center text-muted small mt-3 mb-0">
                        By confirming, you agree to the Terms and Conditions of this booking.
                      </p>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default CabBookingPage;