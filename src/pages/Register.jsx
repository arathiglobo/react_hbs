import React, { useState, useEffect, useRef } from "react";
import Select from "react-select";
import "../styles/Register.css";
import "../styles/RegisterModern.css";
import axios from "axios";
import axiosInstance from "../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { Card, Form, Row, Col, Button, Container, Alert } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const Register = () => {
  const [formData, setFormData] = useState({
    companyName: "",
    businessType: "",
    agentCategoryId: "",
    firstName: "",
    lastName: "",
    mobileNumber: "",
    personalEmail: "",
    countryId: "",
    provinceId: "",
    placeId: "",
    address: "",
    agentClassification: "registered",
    agentGstIn: "",
    agentProvisionalGstno: "",
    agentCorrespondmail: "",
    agentRegisterstatus: "",
    agentHsncode: "",
    agentStatus: "yes",
    currency: "",
    // Finance Manager + GM details (required by backend, mirrors AgentReg).
    financeManagerName: "",
    financeManagerContactNo: "",
    financeManagerEmail: "",
    gmName: "",
    gmContactNo: "",
    gmEmail: "",
    // Incentive claim preference: "" | "CREDIT_LIMIT" | "BANK_TRANSFER".
    preferredClaimMethod: "",
  });

  const [errors, setErrors] = useState({});
  // Tracks whether the user picked "Others" in the Business Type dropdown,
  // which then reveals a free-text box (still bound to formData.businessType).
  const FIXED_BUSINESS_TYPES = ["Tour Operator", "Travel Agency", "Event Company", "Airline"];
  const [businessTypeOther, setBusinessTypeOther] = useState(false);
  // Holds the timer for debounced country search so we don't hammer /api/country
  // on every keystroke.
  const countrySearchTimer = useRef(null);
  // Debounced agent-email availability check (table agent.personal_email).
  const emailCheckTimer = useRef(null);
  const [emailExists, setEmailExists] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [countries, setCountries] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [places, setPlaces] = useState("");
  const [agentCategoryies, setAgentCategoryies] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  const navigate = useNavigate();

  const agentCategoryList = async () => {
    try {
      const agentCatResponse = await axiosInstance.get("/api/agentCategory");
      setAgentCategoryies(agentCatResponse.data);
    } catch (error) {
      console.log("agent category api call error::", error);
    }
  };

  // Calls the /api/country endpoint. If a `search` term is provided it's
  // passed as a query param so the BACKEND filters (CountryController already
  // supports `?search=...`); otherwise the full list is loaded as before.
  const countryList = async (search = "") => {
    try {
      const params = {};
      if (search && search.trim()) params.search = search.trim();
      const response = await axiosInstance.get("/api/country", { params });
      setCountries(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log("error for country list :", error);
    }
  };

  useEffect(() => {
    countryList();
    agentCategoryList();

  }, []);

  const provinceList = async (countryId) => {
    try {
      const response = await axiosInstance.get(
        `/api/province/getByCountryId/${countryId}`
      );

      setProvinces(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log("axios call error for province list : ", error);
    }
  };

  const cityList = async (stateId) => {
    try {
      const response = await axiosInstance.get(`/api/destination/getplaces/${stateId}`);
      setPlaces(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log("axios call error for city list : ", error);
    }
  };

  const currencyList = async () => {
    try {
      const response = await axiosInstance.get("/api/currency?page=0&limit=100");
      console.log("Currency API Response:", response.data);

      const currencyData = Array.isArray(response.data) ? response.data : [];
      setCurrencies(currencyData);

      // Auto-select first currency if none selected
      if (currencyData.length > 0 && !formData.currency) {
        console.log("Auto-selecting currency:", currencyData[0].currencyId);
        setFormData(prev => ({
          ...prev,
          currency: currencyData[0].currencyId
        }));
      }
    } catch (error) {
      console.log("axios call error for currency list : ", error);
    }
  };

  useEffect(() => {
    currencyList(); // Call currencyList on component mount
  }, []);

  useEffect(() => {
    if (formData.countryId) {
      setProvinces([]); // Reset states when country changes
      setPlaces([]); // Reset cities when country changes
      provinceList(formData.countryId);
    }
  }, [formData.countryId]);

  useEffect(() => {
    if (formData.provinceId) {
      setPlaces([]); // Reset cities when state changes
      cityList(formData.provinceId);
    }
  }, [formData.provinceId]);

  // Debounced email-availability check. Only fires for well-formed
  // addresses; hits the public /api/agent/check-email endpoint and
  // flags duplicates so the field can warn inline before submit. A
  // failed check never blocks the user (server still validates on save).
  useEffect(() => {
    const email = (formData.personalEmail || "").trim();
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailExists(false);
      setEmailChecking(false);
      return undefined;
    }
    setEmailChecking(true);
    emailCheckTimer.current = setTimeout(() => {
      axiosInstance
        .get("/api/agent/check-email", { params: { email } })
        .then((res) => setEmailExists(Boolean(res.data?.exists)))
        .catch(() => setEmailExists(false))
        .finally(() => setEmailChecking(false));
    }, 500);
    return () => {
      if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    };
  }, [formData.personalEmail]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => {
      if (name === "agentCategoryId") {
        return {
          ...prevData,
          agentCategoryId: value,
        };
      }

      if (name === "countryId") {
        return {
          ...prevData,
          countryId: value,
          provinceId: "",
          placeId: "",
        };
      }
      if (name === "provinceId") {
        return {
          ...prevData,
          provinceId: value,
          placeId: "",
        };
      }
      if (name === "placeId") {
        return {
          ...prevData,
          placeId: value,
        };
      }
      return {
        ...prevData,
        [name]: value,
      };
    });
    setErrors((prevErrors) => ({
      ...prevErrors,
      [name]: "",
    }));
  };

  const validateCurrentStep = () => {
    const newErrors = {};

    if (currentStep === 1) {
      if (!formData.companyName.trim()) newErrors.companyName = "Company Name is required";
      if (!formData.businessType.trim()) newErrors.businessType = "Business Type is required";
      if (!formData.agentCategoryId) newErrors.agentCategoryId = "Company Type is required";
      if (!formData.currency) newErrors.currency = "Currency is required";

    } else if (currentStep === 2) {
      if (!formData.firstName.trim()) newErrors.firstName = "First Name is required";
      if (!formData.lastName.trim()) newErrors.lastName = "Last Name is required";
      if (!formData.mobileNumber.trim()) newErrors.mobileNumber = "Mobile Number is required";
      if (!formData.personalEmail.trim()) newErrors.personalEmail = "Email ID is required";
      if (formData.personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personalEmail)) {
        newErrors.personalEmail = "Invalid email format";
      } else if (emailExists) {
        newErrors.personalEmail = "An agent with this email already exists";
      }
      if (formData.mobileNumber && !/^\+?\d{10,15}$/.test(formData.mobileNumber.replace(/\s/g, ""))) {
        newErrors.mobileNumber = "Mobile Number must be 10-15 digits";
      }
    } else if (currentStep === 3) {
      if (!formData.countryId) newErrors.countryId = "Country is required";
      if (!formData.provinceId) newErrors.provinceId = "City is required";
      if (!formData.placeId) newErrors.placeId = "Location is required";
      if (!formData.address.trim()) newErrors.address = "Address is required";
    } else if (currentStep === 4) {
      // Step 4 — Finance Manager + GM details (always required to match backend)
      if (!formData.financeManagerName.trim())
        newErrors.financeManagerName = "Finance Manager name is required";
      if (!formData.financeManagerContactNo.trim())
        newErrors.financeManagerContactNo = "Finance Manager mobile number is required";
      if (!formData.financeManagerEmail.trim())
        newErrors.financeManagerEmail = "Finance Manager email is required";
      if (formData.financeManagerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.financeManagerEmail))
        newErrors.financeManagerEmail = "Invalid Finance Manager email format";
      if (!formData.gmName.trim())
        newErrors.gmName = "GM name is required";
      if (!formData.gmContactNo.trim())
        newErrors.gmContactNo = "GM mobile number is required";
      if (!formData.gmEmail.trim())
        newErrors.gmEmail = "GM email is required";
      if (formData.gmEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.gmEmail))
        newErrors.gmEmail = "Invalid GM email format";
    } else if (currentStep === 5 && formData.countryId === "1") {
      if (formData.agentClassification === "registered" && !formData.agentGstIn.trim()) {
        newErrors.agentGstIn = "GSTIN is required for registered agencies";
      }
      if (formData.agentGstIn && !/^[A-Z0-9]{15}$/.test(formData.agentGstIn.trim())) {
        newErrors.agentGstIn = "GSTIN must be 15 alphanumeric characters";
      }
      if (formData.agentCorrespondmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.agentCorrespondmail)) {
        newErrors.agentCorrespondmail = "Invalid correspondence email format";
      }
    }

    return newErrors;
  };

  const handleNextStep = () => {
    const stepErrors = validateCurrentStep();
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setCurrentStep(currentStep + 1);
  };

  const validateForm = () => {
    const newErrors = {};

    // Required field validations
    if (!formData.companyName.trim())
      newErrors.companyName = "Company Name is required";
    if (!formData.businessType.trim())
      newErrors.businessType = "Business Type is required";
    if (!formData.agentCategoryId)
      newErrors.agentCategoryId = "Company Type or Agent category is required";
    if (!formData.currency) newErrors.currency = "Currency is required";
    if (!formData.firstName.trim())
      newErrors.firstName = "First Name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last Name is required";
    if (!formData.mobileNumber.trim())
      newErrors.mobileNumber = "Mobile Number is required";
    if (!formData.personalEmail.trim())
      newErrors.personalEmail = "Email ID is required";
    if (!formData.countryId) newErrors.countryId = "Country is required";
    if (!formData.provinceId) newErrors.provinceId = "Province is required";
    if (!formData.placeId) newErrors.placeId = "City is required";
    if (!formData.address.trim()) newErrors.address = "Address is required";

    // Additional format validations
    if (
      formData.personalEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personalEmail)
    )
      newErrors.personalEmail = "Invalid email format";
    else if (emailExists)
      newErrors.personalEmail = "An agent with this email already exists";
    if (
      formData.mobileNumber &&
      !/^\+?\d{10,15}$/.test(formData.mobileNumber.replace(/\s/g, ""))
    )
      newErrors.mobileNumber = "Mobile Number must be 10-15 digits";

    // Finance Manager + GM details (required by backend)
    if (!formData.financeManagerName.trim())
      newErrors.financeManagerName = "Finance Manager name is required";
    if (!formData.financeManagerContactNo.trim())
      newErrors.financeManagerContactNo = "Finance Manager mobile number is required";
    if (!formData.financeManagerEmail.trim())
      newErrors.financeManagerEmail = "Finance Manager email is required";
    if (formData.financeManagerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.financeManagerEmail))
      newErrors.financeManagerEmail = "Invalid Finance Manager email format";
    if (!formData.gmName.trim())
      newErrors.gmName = "GM name is required";
    if (!formData.gmContactNo.trim())
      newErrors.gmContactNo = "GM mobile number is required";
    if (!formData.gmEmail.trim())
      newErrors.gmEmail = "GM email is required";
    if (formData.gmEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.gmEmail))
      newErrors.gmEmail = "Invalid GM email format";

    // GST fields validation (only if companyType is 3 or 5)
    if (formData.countryId === "1") {
      if (
        formData.agentClassification === "registered" &&
        !formData.agentGstIn.trim()
      )
        newErrors.agentGstIn = "GSTIN is required for registered agencies";
      if (
        formData.agentGstIn &&
        !/^[A-Z0-9]{15}$/.test(formData.agentGstIn.trim())
      )
        newErrors.agentGstIn = "GSTIN must be 15 alphanumeric characters";
      if (
        formData.agentCorrespondmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.agentCorrespondmail)
      )
        newErrors.agentCorrespondmail = "Invalid correspondence email format";
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formErrors = validateForm();

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      /* GM / Finance Manager fields are now collected in Step 4 of the form
         (matches the Agent admin registration). The form validation guarantees
         non-empty values; the `|| ""` here is just a defensive no-op. */
      const payload = { ...formData };
      const registerResponse = await axiosInstance.post(
        "/api/agent/register",
        payload
      );
      console.log("registerResponse::", registerResponse);

      // Show success state
      setShowSuccess(true);
      setRedirectCountdown(5);

      // Start countdown for auto-redirect
      const countdownInterval = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            navigate('/');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Reset form on success
      setFormData({
        companyName: "",
        businessType: "",
        agentCategoryId: "",
        firstName: "",
        lastName: "",
        mobileNumber: "",
        personalEmail: "",
        countryId: "",
        provinceId: "",
        placeId: "",
        address: "",
        agentClassification: "registered",
        agentGstIn: "",
        agentProvisionalGstno: "",
        agentCorrespondmail: "",
        agentRegisterstatus: "",
        agentHsncode: "",
        currency: "",
        agentStatus: "yes",
        financeManagerName: "",
        financeManagerContactNo: "",
        financeManagerEmail: "",
        gmName: "",
        gmContactNo: "",
        gmEmail: "",
        preferredClaimMethod: "",
      });
      setErrors({});
      setCurrentStep(1);
    } catch (error) {
      if (error.response) {
        if (error.response.data.message) {
          toast.error(error.response.data.message);
        } else {
          toast.error("An error occurred during registration");
        }

        if (error.response.data.errors) {
          setErrors(error.response.data.errors);
        }
      } else if (error.request) {
        toast.error("Network error - please try again");
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="step-indicator mb-4">
      <div className="step-item" onClick={() => setCurrentStep(1)} style={{ cursor: 'pointer' }}>
        <div className={`step-circle ${currentStep >= 1 ? 'active' : ''}`}>1</div>
        <div className="step-label">Company Details</div>
      </div>
      <div className={`step-connector ${currentStep >= 2 ? 'active' : ''}`}></div>
      <div className="step-item" onClick={() => setCurrentStep(2)} style={{ cursor: 'pointer' }}>
        <div className={`step-circle ${currentStep >= 2 ? 'active' : ''}`}>2</div>
        <div className="step-label">Contact Info</div>
      </div>
      <div className={`step-connector ${currentStep >= 3 ? 'active' : ''}`}></div>
      <div className="step-item" onClick={() => setCurrentStep(3)} style={{ cursor: 'pointer' }}>
        <div className={`step-circle ${currentStep >= 3 ? 'active' : ''}`}>3</div>
        <div className="step-label">Location</div>
      </div>
      <div className={`step-connector ${currentStep >= 4 ? 'active' : ''}`}></div>
      <div className="step-item" onClick={() => setCurrentStep(4)} style={{ cursor: 'pointer' }}>
        <div className={`step-circle ${currentStep >= 4 ? 'active' : ''}`}>4</div>
        <div className="step-label">Finance & GM</div>
      </div>
      {formData.countryId === "1" && (
        <>
          <div className={`step-connector ${currentStep >= 5 ? 'active' : ''}`}></div>
          <div className="step-item" onClick={() => setCurrentStep(5)} style={{ cursor: 'pointer' }}>
            <div className={`step-circle ${currentStep >= 5 ? 'active' : ''}`}>5</div>
            <div className="step-label">GST Details</div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="register-page">
      <Container fluid className="px-0">
        <div className="register-container">
          {/* Header */}
          <div className="register-header">
            <div className="header-content">
              <div className="header-left">
                <h1 className="register-title">Create Your Account</h1>
                <p className="register-subtitle">Join our network of travel professionals</p>
              </div>
              <div className="header-right">
                <img
                  className="register-logo"
                  src={`${process.env.PUBLIC_URL}/images/logo-1.jpg`}
                  alt="Logo"
                />
              </div>
            </div>
            {/* Back to Login Button */}
            <div className="back-to-login">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => navigate('/')}
                className="back-button"
              >
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="me-2">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Back to Home
              </Button>
            </div>
          </div>

          {/* Success Screen */}
          {showSuccess ? (
            <div className="register-form-container">
              <Card className="form-card">
                <Card.Body className="p-4 text-center">
                  <div className="success-content">
                    <div className="success-icon">
                      <svg width="80" height="80" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h2 className="success-title">Registration Successful!</h2>
                    <p className="success-message">
                      Welcome to our network! Your account has been created successfully.
                      You can now log in with your email and password.
                    </p>
                    <div className="success-actions">
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={() => navigate('/')}
                        className="login-now-button"
                      >
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" className="me-2">
                          <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Go to Home
                      </Button>
                      <p className="redirect-message">
                        Redirecting to home page in <strong>{redirectCountdown}</strong> seconds...
                      </p>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </div>
          ) : (
            <>
              {/* Progress Indicator */}
              {renderStepIndicator()}

              {/* Form */}
              <div className="register-form-container">
                <Form onSubmit={handleSubmit} className="register-form" noValidate autoComplete="off">
                  <Card className="form-card">
                    <Card.Body className="p-4">

                      {/* Step 1: Company Details */}
                      <div className={`form-step ${currentStep === 1 ? 'active' : ''}`}>
                        <div className="step-header">
                          <h3 className="step-title">
                            <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="step-icon">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                            </svg>
                            Company Information
                          </h3>
                          <p className="step-description">Tell us about your business</p>
                        </div>

                        <Row className="g-3">
                          <Col xs={12}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Company Name <span className="required">*</span>
                              </Form.Label>
                              <Form.Control
                                type="text"
                                name="companyName"
                                value={formData.companyName}
                                onChange={handleChange}
                                placeholder="Enter your company name"
                                className={`form-input ${errors.companyName ? 'is-invalid' : ''}`}
                              />
                              {errors.companyName && (
                                <Form.Control.Feedback type="invalid">
                                  {errors.companyName}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>

                          <Col md={6}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Business Type <span className="required">*</span>
                              </Form.Label>
                              {/* Fixed-option dropdown; "Others" reveals a free-text input.
                                  The same `businessType` form field is preserved so submit /
                                  validation logic is untouched. */}
                              <Form.Select
                                name="businessTypeSelect"
                                value={
                                  businessTypeOther
                                    ? "Others"
                                    : (FIXED_BUSINESS_TYPES.includes(formData.businessType)
                                        ? formData.businessType
                                        : "")
                                }
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === "Others") {
                                    setBusinessTypeOther(true);
                                    setFormData((prev) => ({ ...prev, businessType: "" }));
                                  } else {
                                    setBusinessTypeOther(false);
                                    setFormData((prev) => ({ ...prev, businessType: v }));
                                  }
                                  setErrors((prev) => ({ ...prev, businessType: "" }));
                                }}
                                className={`form-input ${errors.businessType && !businessTypeOther ? 'is-invalid' : ''}`}
                              >
                                <option value="">Select business type</option>
                                <option value="Tour Operator">Tour Operator</option>
                                <option value="Travel Agency">Travel Agency</option>
                                <option value="Event Company">Event Company</option>
                                <option value="Airline">Airline</option>
                                <option value="Others">Others</option>
                              </Form.Select>
                              {businessTypeOther && (
                                <Form.Control
                                  type="text"
                                  name="businessType"
                                  value={formData.businessType}
                                  onChange={handleChange}
                                  placeholder="Please specify your business type"
                                  className={`form-input mt-2 ${errors.businessType ? 'is-invalid' : ''}`}
                                  maxLength={30}
                                />
                              )}
                              {errors.businessType && (
                                <Form.Control.Feedback type="invalid">
                                  {errors.businessType}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>

                          <Col md={6}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Company Type <span className="required">*</span>
                              </Form.Label>
                              <Form.Select
                                name="agentCategoryId"
                                value={formData.agentCategoryId}
                                onChange={handleChange}
                                className={`form-input ${errors.agentCategoryId ? 'is-invalid' : ''}`}
                              >
                                <option value="">Select company type</option>
                                {agentCategoryies.map((agent) => (
                                  <option key={agent.agentCategoryId} value={agent.agentCategoryId}>
                                    {agent.name}
                                  </option>
                                ))}
                              </Form.Select>
                              {errors.agentCategoryId && (
                                <Form.Control.Feedback type="invalid">
                                  {errors.agentCategoryId}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>

                      {/* Step 2: Contact Information */}
                      <div className={`form-step ${currentStep === 2 ? 'active' : ''}`}>
                        <div className="step-header">
                          <h3 className="step-title">
                            <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="step-icon">
                              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                            </svg>
                            Contact Information
                          </h3>
                          <p className="step-description">How can we reach you?</p>
                        </div>

                        <Row className="g-3">
                          <Col md={6}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                First Name <span className="required">*</span>
                              </Form.Label>
                              <Form.Control
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                placeholder="Enter first name"
                                className={`form-input ${errors.firstName ? 'is-invalid' : ''}`}
                                maxLength={15}
                              />
                              {errors.firstName && (
                                <Form.Control.Feedback type="invalid">
                                  {errors.firstName}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>

                          <Col md={6}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Last Name <span className="required">*</span>
                              </Form.Label>
                              <Form.Control
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                placeholder="Enter last name"
                                className={`form-input ${errors.lastName ? 'is-invalid' : ''}`}
                                maxLength={15}
                              />
                              {errors.lastName && (
                                <Form.Control.Feedback type="invalid">
                                  {errors.lastName}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>

                          <Col md={6}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Mobile Number <span className="required">*</span>
                              </Form.Label>
                              <Form.Control
                                type="tel"
                                name="mobileNumber"
                                value={formData.mobileNumber}
                                onChange={handleChange}
                                placeholder="Enter mobile number"
                                className={`form-input ${errors.mobileNumber ? 'is-invalid' : ''}`}
                                maxLength={15}
                              />
                              {errors.mobileNumber && (
                                <Form.Control.Feedback type="invalid">
                                  {errors.mobileNumber}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>

                          <Col md={6}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Email Address <span className="required">*</span>
                              </Form.Label>
                              <Form.Control
                                type="email"
                                name="personalEmail"
                                value={formData.personalEmail}
                                onChange={handleChange}
                                placeholder="Enter email address"
                                className={`form-input ${errors.personalEmail ? 'is-invalid' : ''}`}
                              />
                              {errors.personalEmail && (
                                <Form.Control.Feedback type="invalid">
                                  {errors.personalEmail}
                                </Form.Control.Feedback>
                              )}
                              {/* Live availability hint (agent.personal_email). */}
                              {!errors.personalEmail && emailChecking && (
                                <div className="text-muted small mt-1">
                                  Checking availability…
                                </div>
                              )}
                              {!errors.personalEmail &&
                                !emailChecking &&
                                emailExists && (
                                  <div className="text-danger small mt-1">
                                    An agent with this email already exists.
                                  </div>
                                )}
                              {!errors.personalEmail &&
                                !emailChecking &&
                                !emailExists &&
                                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                                  (formData.personalEmail || "").trim(),
                                ) && (
                                  <div className="text-success small mt-1">
                                    Email is available.
                                  </div>
                                )}
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>

                      {/* Step 3: Location */}
                      <div className={`form-step ${currentStep === 3 ? 'active' : ''}`}>
                        <div className="step-header">
                          <h3 className="step-title">
                            <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="step-icon">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                            Location Details
                          </h3>
                          <p className="step-description">Where are you located?</p>
                        </div>

                        <Row className="g-3">
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Country <span className="required">*</span>
                              </Form.Label>
                              {/* Searchable country dropdown — uses the existing /api/country data
                                  (loaded into `countries`). react-select's built-in filter searches
                                  by typed terms; selection still updates `countryId` via handleChange,
                                  so cascading province/city logic is unchanged. */}
                              <Select
                                inputId="countryId"
                                name="countryId"
                                classNamePrefix="reg-select"
                                isSearchable
                                isClearable
                                placeholder="Search country..."
                                /* Backend handles filtering via /api/country?search=...
                                   so we disable react-select's local filter to show the
                                   server's results verbatim. */
                                filterOption={null}
                                options={countries.map((c) => ({ value: c.id, label: c.name }))}
                                value={
                                  countries
                                    .map((c) => ({ value: c.id, label: c.name }))
                                    .find((opt) => String(opt.value) === String(formData.countryId)) || null
                                }
                                /* Refetch on every keystroke, debounced 300ms.
                                   `action` is 'input-change' when the user types;
                                   ignore 'menu-close'/'set-value' so the list isn't
                                   refetched when the dropdown closes after a pick. */
                                onInputChange={(value, meta) => {
                                  if (meta.action !== "input-change") return value;
                                  if (countrySearchTimer.current) clearTimeout(countrySearchTimer.current);
                                  countrySearchTimer.current = setTimeout(() => {
                                    countryList(value);
                                  }, 300);
                                  return value;
                                }}
                                onMenuOpen={() => {
                                  // Refresh the list when the menu opens so it
                                  // shows the unfiltered results (helps after a
                                  // previous filtered search).
                                  if (countrySearchTimer.current) clearTimeout(countrySearchTimer.current);
                                  countryList("");
                                }}
                                onChange={(opt) =>
                                  handleChange({
                                    target: { name: "countryId", value: opt ? String(opt.value) : "" },
                                  })
                                }
                                className={errors.countryId ? "is-invalid" : ""}
                                styles={{
                                  control: (base, state) => ({
                                    ...base,
                                    minHeight: 44,
                                    borderRadius: 11,
                                    borderWidth: 1.5,
                                    borderColor: errors.countryId ? "#EC0B43" : (state.isFocused ? "#EC0B43" : "#E5E5E1"),
                                    backgroundColor: state.isFocused ? "#fff" : "#FAFAF8",
                                    boxShadow: state.isFocused ? "0 0 0 4px rgba(236, 11, 67, .12)" : "none",
                                    fontSize: "0.92rem",
                                    fontFamily: "inherit",
                                  }),
                                  placeholder: (b) => ({ ...b, color: "#A8A8A3", fontWeight: 400 }),
                                  menu: (b) => ({ ...b, borderRadius: 11, overflow: "hidden", zIndex: 30 }),
                                  option: (b, s) => ({
                                    ...b,
                                    backgroundColor: s.isSelected ? "#EC0B43" : (s.isFocused ? "#FDE7ED" : "#fff"),
                                    color: s.isSelected ? "#fff" : "#15171C",
                                    fontSize: "0.92rem",
                                  }),
                                }}
                              />
                              {errors.countryId && (
                                <div className="invalid-feedback d-block">{errors.countryId}</div>
                              )}
                            </Form.Group>
                          </Col>

                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                City <span className="required">*</span>
                              </Form.Label>
                              {/* Searchable city dropdown — provinces are
                                  preloaded for the chosen country, so we let
                                  react-select filter locally by typed text.
                                  Selection still updates `provinceId` via
                                  handleChange so the cascading place logic is
                                  unchanged. */}
                              <Select
                                inputId="provinceId"
                                name="provinceId"
                                classNamePrefix="reg-select"
                                isSearchable
                                isClearable
                                isDisabled={!formData.countryId}
                                placeholder="Search city..."
                                options={
                                  Array.isArray(provinces)
                                    ? provinces.map((p) => ({
                                        value: p.id,
                                        label: p.stateName,
                                      }))
                                    : []
                                }
                                value={
                                  (Array.isArray(provinces) ? provinces : [])
                                    .map((p) => ({ value: p.id, label: p.stateName }))
                                    .find(
                                      (opt) =>
                                        String(opt.value) ===
                                        String(formData.provinceId),
                                    ) || null
                                }
                                onChange={(opt) =>
                                  handleChange({
                                    target: {
                                      name: "provinceId",
                                      value: opt ? String(opt.value) : "",
                                    },
                                  })
                                }
                                className={errors.provinceId ? "is-invalid" : ""}
                                styles={{
                                  control: (base, state) => ({
                                    ...base,
                                    minHeight: 44,
                                    borderRadius: 11,
                                    borderWidth: 1.5,
                                    borderColor: errors.provinceId
                                      ? "#EC0B43"
                                      : state.isFocused
                                      ? "#EC0B43"
                                      : "#E5E5E1",
                                    backgroundColor: state.isFocused ? "#fff" : "#FAFAF8",
                                    boxShadow: state.isFocused
                                      ? "0 0 0 4px rgba(236, 11, 67, .12)"
                                      : "none",
                                    fontSize: "0.92rem",
                                    fontFamily: "inherit",
                                  }),
                                  placeholder: (b) => ({
                                    ...b,
                                    color: "#A8A8A3",
                                    fontWeight: 400,
                                  }),
                                  menu: (b) => ({
                                    ...b,
                                    borderRadius: 11,
                                    overflow: "hidden",
                                    zIndex: 30,
                                  }),
                                  option: (b, s) => ({
                                    ...b,
                                    backgroundColor: s.isSelected
                                      ? "#EC0B43"
                                      : s.isFocused
                                      ? "#FDE7ED"
                                      : "#fff",
                                    color: s.isSelected ? "#fff" : "#15171C",
                                    fontSize: "0.92rem",
                                  }),
                                }}
                              />
                              {errors.provinceId && (
                                <div className="invalid-feedback d-block">
                                  {errors.provinceId}
                                </div>
                              )}
                            </Form.Group>
                          </Col>

                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Location <span className="required">*</span>
                              </Form.Label>
                              <Form.Select
                                name="placeId"
                                value={formData.placeId}
                                onChange={handleChange}
                                disabled={!formData.provinceId}
                                className={`form-input ${errors.placeId ? 'is-invalid' : ''}`}
                              >
                                <option value="">Select location</option>
                                {Array.isArray(places) &&
                                  places.map((place) => (
                                    <option key={place.id} value={place.id}>
                                      {place.name}
                                    </option>
                                  ))}
                              </Form.Select>
                              {errors.placeId && (
                                <Form.Control.Feedback type="invalid">
                                  {errors.placeId}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Address <span className="required">*</span>
                              </Form.Label>
                              <Form.Control
                                as="textarea"
                                rows={3}
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                placeholder="Enter your complete address"
                                className={`form-input ${errors.address ? 'is-invalid' : ''}`}
                              />
                              {errors.address && (
                                <Form.Control.Feedback type="invalid">
                                  {errors.address}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>

                      {/* Step 4: Finance Manager & GM Details + Incentive Claim Preferences */}
                      <div className={`form-step ${currentStep === 4 ? 'active' : ''}`}>
                        <div className="step-header">
                          <h3 className="step-title">
                            <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="step-icon">
                              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                            </svg>
                            Finance Manager &amp; GM Details
                          </h3>
                          <p className="step-description">Add the contacts the backend needs for incentives, finance and management communication.</p>
                        </div>

                        {/* ── Finance Manager ── */}
                        <h5 className="mt-2 mb-3" style={{ fontSize: "1rem", fontWeight: 600, color: "#3E3E3B", letterSpacing: "-0.01em" }}>Finance Manager</h5>
                        <Row className="g-3">
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Name <span className="required">*</span>
                              </Form.Label>
                              <Form.Control
                                type="text"
                                name="financeManagerName"
                                value={formData.financeManagerName}
                                onChange={handleChange}
                                placeholder="Enter finance manager name"
                                className={`form-input ${errors.financeManagerName ? 'is-invalid' : ''}`}
                              />
                              {errors.financeManagerName && (
                                <Form.Control.Feedback type="invalid">{errors.financeManagerName}</Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Contact No <span className="required">*</span>
                              </Form.Label>
                              <Form.Control
                                type="tel"
                                name="financeManagerContactNo"
                                value={formData.financeManagerContactNo}
                                onChange={handleChange}
                                placeholder="Enter contact number"
                                className={`form-input ${errors.financeManagerContactNo ? 'is-invalid' : ''}`}
                              />
                              {errors.financeManagerContactNo && (
                                <Form.Control.Feedback type="invalid">{errors.financeManagerContactNo}</Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Email <span className="required">*</span>
                              </Form.Label>
                              <Form.Control
                                type="email"
                                name="financeManagerEmail"
                                value={formData.financeManagerEmail}
                                onChange={handleChange}
                                placeholder="Enter finance manager email"
                                className={`form-input ${errors.financeManagerEmail ? 'is-invalid' : ''}`}
                              />
                              {errors.financeManagerEmail && (
                                <Form.Control.Feedback type="invalid">{errors.financeManagerEmail}</Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                        </Row>

                        {/* ── General Manager ── */}
                        <h5 className="mt-4 mb-3" style={{ fontSize: "1rem", fontWeight: 600, color: "#3E3E3B", letterSpacing: "-0.01em" }}>GM (General Manager)</h5>
                        <Row className="g-3">
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Name <span className="required">*</span>
                              </Form.Label>
                              <Form.Control
                                type="text"
                                name="gmName"
                                value={formData.gmName}
                                onChange={handleChange}
                                placeholder="Enter GM name"
                                className={`form-input ${errors.gmName ? 'is-invalid' : ''}`}
                              />
                              {errors.gmName && (
                                <Form.Control.Feedback type="invalid">{errors.gmName}</Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Contact No <span className="required">*</span>
                              </Form.Label>
                              <Form.Control
                                type="tel"
                                name="gmContactNo"
                                value={formData.gmContactNo}
                                onChange={handleChange}
                                placeholder="Enter GM contact number"
                                className={`form-input ${errors.gmContactNo ? 'is-invalid' : ''}`}
                              />
                              {errors.gmContactNo && (
                                <Form.Control.Feedback type="invalid">{errors.gmContactNo}</Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="form-label">
                                Email <span className="required">*</span>
                              </Form.Label>
                              <Form.Control
                                type="email"
                                name="gmEmail"
                                value={formData.gmEmail}
                                onChange={handleChange}
                                placeholder="Enter GM email"
                                className={`form-input ${errors.gmEmail ? 'is-invalid' : ''}`}
                              />
                              {errors.gmEmail && (
                                <Form.Control.Feedback type="invalid">{errors.gmEmail}</Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                        </Row>

                        {/* ── Incentive Claim Preferences ── */}
                        <h5 className="mt-4 mb-3" style={{ fontSize: "1rem", fontWeight: 600, color: "#3E3E3B", letterSpacing: "-0.01em" }}>Incentive Claim Preferences</h5>
                        <Row className="g-3">
                          <Col md={6}>
                            <Form.Group>
                              <Form.Label className="form-label">Preferred Incentive Claim Method</Form.Label>
                              <Form.Select
                                name="preferredClaimMethod"
                                value={formData.preferredClaimMethod}
                                onChange={handleChange}
                                className="form-input"
                              >
                                <option value="">Select method</option>
                                <option value="CREDIT_LIMIT">Add to Credit Limit</option>
                                <option value="BANK_TRANSFER">Transfer to Bank Account</option>
                              </Form.Select>
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>

                      {/* Step 5: GST Details (India only) */}
                      {formData.countryId === "1" && (
                        <div className={`form-step ${currentStep === 5 ? 'active' : ''}`}>
                          <div className="step-header">
                            <h3 className="step-title">
                              <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="step-icon">
                                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                              GST Information
                            </h3>
                            <p className="step-description">Tax registration details for Indian businesses</p>
                          </div>

                          <Row className="g-3">
                            <Col md={6}>
                              <Form.Group>
                                <Form.Label className="form-label">
                                  Agency Classification
                                </Form.Label>
                                <Form.Select
                                  name="agentClassification"
                                  value={formData.agentClassification}
                                  onChange={handleChange}
                                  className="form-input"
                                >
                                  <option value="registered">Registered</option>
                                  <option value="unregistered">Unregistered</option>
                                </Form.Select>
                              </Form.Group>
                            </Col>

                            <Col md={6}>
                              <Form.Group>
                                <Form.Label className="form-label">
                                  GSTIN <span className="required">*</span>
                                </Form.Label>
                                <Form.Control
                                  type="text"
                                  name="agentGstIn"
                                  value={formData.agentGstIn}
                                  onChange={handleChange}
                                  placeholder="Enter 15-digit GSTIN"
                                  className={`form-input ${errors.agentGstIn ? 'is-invalid' : ''}`}
                                  maxLength={15}
                                />
                                {errors.agentGstIn && (
                                  <Form.Control.Feedback type="invalid">
                                    {errors.agentGstIn}
                                  </Form.Control.Feedback>
                                )}
                              </Form.Group>
                            </Col>

                            <Col md={6}>
                              <Form.Group>
                                <Form.Label className="form-label">
                                  Provisional GST Number
                                </Form.Label>
                                <Form.Control
                                  type="text"
                                  name="agentProvisionalGstno"
                                  value={formData.agentProvisionalGstno}
                                  onChange={handleChange}
                                  placeholder="Enter provisional GST number"
                                  className="form-input"
                                  maxLength={30}
                                />
                              </Form.Group>
                            </Col>

                            <Col md={6}>
                              <Form.Group>
                                <Form.Label className="form-label">
                                  Correspondence Email
                                </Form.Label>
                                <Form.Control
                                  type="email"
                                  name="agentCorrespondmail"
                                  value={formData.agentCorrespondmail}
                                  onChange={handleChange}
                                  placeholder="Enter correspondence email"
                                  className={`form-input ${errors.agentCorrespondmail ? 'is-invalid' : ''}`}
                                />
                                {errors.agentCorrespondmail && (
                                  <Form.Control.Feedback type="invalid">
                                    {errors.agentCorrespondmail}
                                  </Form.Control.Feedback>
                                )}
                              </Form.Group>
                            </Col>

                            <Col md={6}>
                              <Form.Group>
                                <Form.Label className="form-label">
                                  GST Registration Status
                                </Form.Label>
                                <Form.Control
                                  type="text"
                                  name="agentRegisterstatus"
                                  value={formData.agentRegisterstatus}
                                  onChange={handleChange}
                                  placeholder="Enter registration status"
                                  className="form-input"
                                  maxLength={30}
                                />
                              </Form.Group>
                            </Col>

                            <Col md={6}>
                              <Form.Group>
                                <Form.Label className="form-label">
                                  HSN/SAC Code
                                </Form.Label>
                                <Form.Control
                                  type="text"
                                  name="agentHsncode"
                                  value={formData.agentHsncode}
                                  onChange={handleChange}
                                  placeholder="Enter HSN/SAC code"
                                  className="form-input"
                                  maxLength={30}
                                />
                              </Form.Group>
                            </Col>
                          </Row>
                        </div>
                      )}

                      {/* Form Actions */}
                      <div className="form-actions">
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="form-info">
                            <span className="required">*</span> Required fields
                          </div>
                          <div className="d-flex gap-3">
                            {currentStep > 1 && (
                              <Button
                                type="button"
                                variant="outline-secondary"
                                size="lg"
                                onClick={() => setCurrentStep(currentStep - 1)}
                                className="nav-button"
                              >
                                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" className="me-2">
                                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Previous
                              </Button>
                            )}
                            {currentStep < 4 && (
                              <Button
                                type="button"
                                variant="outline-primary"
                                size="lg"
                                onClick={handleNextStep}
                                className="nav-button"
                              >
                                Next
                                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" className="ms-2">
                                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                              </Button>
                            )}
                            {currentStep === 4 && formData.countryId === "1" && (
                              <Button
                                type="button"
                                variant="outline-primary"
                                size="lg"
                                onClick={handleNextStep}
                                className="nav-button"
                              >
                                Next
                                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" className="ms-2">
                                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                              </Button>
                            )}
                            {currentStep === 4 && formData.countryId !== "1" && (
                              <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                disabled={isSubmitting}
                                className="submit-button"
                              >
                                {isSubmitting ? (
                                  <>
                                    <svg className="spinner me-2" width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                    </svg>
                                    Creating Account...
                                  </>
                                ) : (
                                  <>
                                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" className="me-2">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Create Account
                                  </>
                                )}
                              </Button>
                            )}
                            {currentStep === 5 && formData.countryId === "1" && (
                              <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                disabled={isSubmitting}
                                className="submit-button"
                              >
                                {isSubmitting ? (
                                  <>
                                    <svg className="spinner me-2" width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                    </svg>
                                    Creating Account...
                                  </>
                                ) : (
                                  <>
                                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" className="me-2">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Create Account
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Form>
              </div>
            </>
          )}
        </div>
      </Container >
    </div >
  );
};

export default Register;
