import React, { useState, useEffect } from "react";
import Select from "react-select";
import "../styles/Register.css";
import "../styles/RegisterModern.css";
import axiosInstance from "../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { Card, Form, Row, Col, Button, Container } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

// Shared react-select styling — matches the searchable dropdowns on /register.
const selectStyles = (hasError) => ({
  control: (base, state) => ({
    ...base,
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: hasError ? "#F75E00" : state.isFocused ? "#F75E00" : "#E5E5E1",
    backgroundColor: state.isFocused ? "#fff" : "#FAFAF8",
    boxShadow: state.isFocused ? "0 0 0 4px rgba(247, 94, 0, .12)" : "none",
    fontSize: "0.92rem",
    fontFamily: "inherit",
  }),
  placeholder: (b) => ({ ...b, color: "#A8A8A3", fontWeight: 400 }),
  menu: (b) => ({ ...b, borderRadius: 11, overflow: "hidden", zIndex: 30 }),
  option: (b, s) => ({
    ...b,
    backgroundColor: s.isSelected ? "#F75E00" : s.isFocused ? "#FDECD6" : "#fff",
    color: s.isSelected ? "#fff" : "#15171C",
    fontSize: "0.92rem",
  }),
});

const HotelRegisterFromOut = () => {
  const [formData, setFormData] = useState({
    hotelName: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    regionId: "",
    countryId: "",
    stateId: "",
    placeId: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  // Cascading geo lists — mirrors the admin HotelReg form's loading chain.
  const [regions, setRegions] = useState([]);
  const [countries, setCountries] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [places, setPlaces] = useState([]);

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  const navigate = useNavigate();

  // ── Geo loaders (same endpoints HotelReg.jsx uses) ──
  const loadRegions = async () => {
    try {
      const res = await axiosInstance.get("/api/region");
      setRegions(res.data || []);
    } catch (error) {
      console.error("Error loading regions:", error);
    }
  };

  const loadCountries = async (regionId) => {
    try {
      const res = await axiosInstance.post(
        `/api/country/getListBasedOnRegions/${regionId}`
      );
      setCountries(res.data || []);
    } catch (error) {
      console.error("Error loading countries:", error);
    }
  };

  const loadProvinces = async (countryId) => {
    try {
      const res = await axiosInstance.get(
        `/api/province/getByCountryId/${countryId}`
      );
      setProvinces(res.data || []);
    } catch (error) {
      console.error("Error loading provinces:", error);
    }
  };

  const loadPlaces = async (stateId) => {
    try {
      const res = await axiosInstance.get(
        `/api/destination/getplaces/${stateId}`
      );
      setPlaces(res.data || []);
    } catch (error) {
      console.error("Error loading places:", error);
    }
  };

  useEffect(() => {
    loadRegions();
  }, []);

  useEffect(() => {
    if (formData.regionId) loadCountries(formData.regionId);
  }, [formData.regionId]);

  useEffect(() => {
    if (formData.countryId) loadProvinces(formData.countryId);
  }, [formData.countryId]);

  useEffect(() => {
    if (formData.stateId) loadPlaces(formData.stateId);
  }, [formData.stateId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // Geo dropdown change — resets the dependent fields/lists down the chain.
  const handleGeoChange = (name, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "regionId") {
        updated.countryId = "";
        updated.stateId = "";
        updated.placeId = "";
        setCountries([]);
        setProvinces([]);
        setPlaces([]);
      } else if (name === "countryId") {
        updated.stateId = "";
        updated.placeId = "";
        setProvinces([]);
        setPlaces([]);
      } else if (name === "stateId") {
        updated.placeId = "";
        setPlaces([]);
      }
      return updated;
    });
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.hotelName.trim()) newErrors.hotelName = "Hotel Name is required";
    if (!formData.contactPerson.trim()) newErrors.contactPerson = "Contact Person is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Invalid email format";
    if (!formData.phone.trim()) newErrors.phone = "Phone is required";
    else if (!/^\+?\d{7,15}$/.test(formData.phone.replace(/\s/g, "")))
      newErrors.phone = "Phone must be 7-15 digits";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (!formData.regionId) newErrors.regionId = "Region is required";
    if (!formData.countryId) newErrors.countryId = "Country is required";
    if (!formData.stateId) newErrors.stateId = "State/Province is required";
    if (!formData.placeId) newErrors.placeId = "City is required";
    if (!formData.username.trim()) newErrors.username = "Username is required";
    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    if (!formData.confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";
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

    // Resolve the human-readable names from the selected ids for the payload.
    const regionName = regions.find((r) => String(r.id) === String(formData.regionId))?.name || "";
    const countryName = countries.find((c) => String(c.id) === String(formData.countryId))?.name || "";
    const stateName = provinces.find((p) => String(p.id) === String(formData.stateId))?.stateName || "";
    const cityName = places.find((pl) => String(pl.id) === String(formData.placeId))?.name || "";

    try {
      const res = await axiosInstance.post("/api/hotel-external-register", {
        hotelName: formData.hotelName,
        contactPerson: formData.contactPerson,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        region: regionName,
        country: countryName,
        state: stateName,
        city: cityName,
        regionId: Number(formData.regionId),
        countryId: Number(formData.countryId),
        stateId: Number(formData.stateId),
        placeId: Number(formData.placeId),
        username: formData.username,
        password: formData.password,
      });

      // Show the exact message returned by the backend.
      setSuccessMsg(
        res.data?.message ||
          "Registration submitted. An administrator will review and approve your account."
      );
      setShowSuccess(true);
      setRedirectCountdown(5);

      const countdownInterval = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            navigate("/");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      if (error.response) {
        if (error.response.data?.message) {
          toast.error(error.response.data.message);
        } else {
          toast.error("An error occurred during registration");
        }
        if (error.response.data?.errors) {
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

  return (
    <div className="register-page">
      <Container fluid className="px-0">
        <div className="register-container">
          {/* Header */}
          <div className="register-header">
            <div className="header-content">
              <div className="header-left">
                <h1 className="register-title">Register Your Hotel</h1>
                <p className="register-subtitle">
                  Partner with us — request access to the Hotel Extranet
                </p>
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
                onClick={() => navigate("/")}
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
                    <h2 className="success-title">Registration Submitted!</h2>
                    <p className="success-message">{successMsg}</p>
                    <div className="success-actions">
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={() => navigate("/")}
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
            <div className="register-form-container">
              <Form onSubmit={handleSubmit} className="register-form" noValidate autoComplete="off">
                <Card className="form-card">
                  <Card.Body className="p-4">
                    {/* Section: Hotel Information */}
                    <div className="form-step active">
                      <div className="step-header">
                        <h3 className="step-title">
                          <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="step-icon">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                          </svg>
                          Hotel Information
                        </h3>
                        <p className="step-description">Tell us about your hotel</p>
                      </div>

                      <Row className="g-3">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="form-label">
                              Hotel Name <span className="required">*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              name="hotelName"
                              value={formData.hotelName}
                              onChange={handleChange}
                              placeholder="Enter hotel name"
                              className={`form-input ${errors.hotelName ? "is-invalid" : ""}`}
                            />
                            {errors.hotelName && (
                              <Form.Control.Feedback type="invalid">
                                {errors.hotelName}
                              </Form.Control.Feedback>
                            )}
                          </Form.Group>
                        </Col>

                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="form-label">
                              Contact Person <span className="required">*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              name="contactPerson"
                              value={formData.contactPerson}
                              onChange={handleChange}
                              placeholder="Full name"
                              className={`form-input ${errors.contactPerson ? "is-invalid" : ""}`}
                            />
                            {errors.contactPerson && (
                              <Form.Control.Feedback type="invalid">
                                {errors.contactPerson}
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
                              name="email"
                              value={formData.email}
                              onChange={handleChange}
                              placeholder="hotel@example.com"
                              className={`form-input ${errors.email ? "is-invalid" : ""}`}
                            />
                            {errors.email && (
                              <Form.Control.Feedback type="invalid">
                                {errors.email}
                              </Form.Control.Feedback>
                            )}
                          </Form.Group>
                        </Col>

                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="form-label">
                              Phone <span className="required">*</span>
                            </Form.Label>
                            <Form.Control
                              type="tel"
                              name="phone"
                              value={formData.phone}
                              onChange={handleChange}
                              placeholder="+1 000 000 0000"
                              className={`form-input ${errors.phone ? "is-invalid" : ""}`}
                              maxLength={15}
                            />
                            {errors.phone && (
                              <Form.Control.Feedback type="invalid">
                                {errors.phone}
                              </Form.Control.Feedback>
                            )}
                          </Form.Group>
                        </Col>

                        <Col md={6} lg={3}>
                          <Form.Group>
                            <Form.Label className="form-label">
                              Region <span className="required">*</span>
                            </Form.Label>
                            <Select
                              inputId="regionId"
                              classNamePrefix="reg-select"
                              isSearchable
                              isClearable
                              placeholder="Search region..."
                              options={regions.map((r) => ({ value: r.id, label: r.name }))}
                              value={
                                regions
                                  .map((r) => ({ value: r.id, label: r.name }))
                                  .find((opt) => String(opt.value) === String(formData.regionId)) || null
                              }
                              onChange={(opt) =>
                                handleGeoChange("regionId", opt ? String(opt.value) : "")
                              }
                              styles={selectStyles(!!errors.regionId)}
                            />
                            {errors.regionId && (
                              <div className="invalid-feedback d-block">{errors.regionId}</div>
                            )}
                          </Form.Group>
                        </Col>

                        <Col md={6} lg={3}>
                          <Form.Group>
                            <Form.Label className="form-label">
                              Country <span className="required">*</span>
                            </Form.Label>
                            <Select
                              inputId="countryId"
                              classNamePrefix="reg-select"
                              isSearchable
                              isClearable
                              isDisabled={!formData.regionId}
                              placeholder="Search country..."
                              options={countries.map((c) => ({ value: c.id, label: c.name }))}
                              value={
                                countries
                                  .map((c) => ({ value: c.id, label: c.name }))
                                  .find((opt) => String(opt.value) === String(formData.countryId)) || null
                              }
                              onChange={(opt) =>
                                handleGeoChange("countryId", opt ? String(opt.value) : "")
                              }
                              styles={selectStyles(!!errors.countryId)}
                            />
                            {errors.countryId && (
                              <div className="invalid-feedback d-block">{errors.countryId}</div>
                            )}
                          </Form.Group>
                        </Col>

                        <Col md={6} lg={3}>
                          <Form.Group>
                            <Form.Label className="form-label">
                              State/Province <span className="required">*</span>
                            </Form.Label>
                            <Select
                              inputId="stateId"
                              classNamePrefix="reg-select"
                              isSearchable
                              isClearable
                              isDisabled={!formData.countryId}
                              placeholder="Search state..."
                              options={provinces.map((p) => ({ value: p.id, label: p.stateName }))}
                              value={
                                provinces
                                  .map((p) => ({ value: p.id, label: p.stateName }))
                                  .find((opt) => String(opt.value) === String(formData.stateId)) || null
                              }
                              onChange={(opt) =>
                                handleGeoChange("stateId", opt ? String(opt.value) : "")
                              }
                              styles={selectStyles(!!errors.stateId)}
                            />
                            {errors.stateId && (
                              <div className="invalid-feedback d-block">{errors.stateId}</div>
                            )}
                          </Form.Group>
                        </Col>

                        <Col md={6} lg={3}>
                          <Form.Group>
                            <Form.Label className="form-label">
                              City <span className="required">*</span>
                            </Form.Label>
                            <Select
                              inputId="placeId"
                              classNamePrefix="reg-select"
                              isSearchable
                              isClearable
                              isDisabled={!formData.stateId}
                              placeholder="Search city..."
                              options={places.map((pl) => ({ value: pl.id, label: pl.name }))}
                              value={
                                places
                                  .map((pl) => ({ value: pl.id, label: pl.name }))
                                  .find((opt) => String(opt.value) === String(formData.placeId)) || null
                              }
                              onChange={(opt) =>
                                handleGeoChange("placeId", opt ? String(opt.value) : "")
                              }
                              styles={selectStyles(!!errors.placeId)}
                            />
                            {errors.placeId && (
                              <div className="invalid-feedback d-block">{errors.placeId}</div>
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
                              className={`form-input ${errors.address ? "is-invalid" : ""}`}
                            />
                            {errors.address && (
                              <Form.Control.Feedback type="invalid">
                                {errors.address}
                              </Form.Control.Feedback>
                            )}
                          </Form.Group>
                        </Col>
                      </Row>

                      {/* Section: Login Credentials */}
                      <div className="step-header" style={{ marginTop: "2rem" }}>
                        <h3 className="step-title">
                          <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="step-icon">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          Login Credentials
                        </h3>
                        <p className="step-description">Choose how you'll sign in to the extranet</p>
                      </div>

                      <Row className="g-3">
                        <Col md={4}>
                          <Form.Group>
                            <Form.Label className="form-label">
                              Username <span className="required">*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              name="username"
                              value={formData.username}
                              onChange={handleChange}
                              placeholder="Choose a username"
                              className={`form-input ${errors.username ? "is-invalid" : ""}`}
                            />
                            {errors.username && (
                              <Form.Control.Feedback type="invalid">
                                {errors.username}
                              </Form.Control.Feedback>
                            )}
                          </Form.Group>
                        </Col>

                        <Col md={4}>
                          <Form.Group>
                            <Form.Label className="form-label">
                              Password <span className="required">*</span>
                            </Form.Label>
                            <Form.Control
                              type="password"
                              name="password"
                              value={formData.password}
                              onChange={handleChange}
                              placeholder="Choose a password"
                              className={`form-input ${errors.password ? "is-invalid" : ""}`}
                            />
                            {errors.password && (
                              <Form.Control.Feedback type="invalid">
                                {errors.password}
                              </Form.Control.Feedback>
                            )}
                          </Form.Group>
                        </Col>

                        <Col md={4}>
                          <Form.Group>
                            <Form.Label className="form-label">
                              Confirm Password <span className="required">*</span>
                            </Form.Label>
                            <Form.Control
                              type="password"
                              name="confirmPassword"
                              value={formData.confirmPassword}
                              onChange={handleChange}
                              placeholder="Repeat your password"
                              className={`form-input ${errors.confirmPassword ? "is-invalid" : ""}`}
                            />
                            {errors.confirmPassword && (
                              <Form.Control.Feedback type="invalid">
                                {errors.confirmPassword}
                              </Form.Control.Feedback>
                            )}
                          </Form.Group>
                        </Col>
                      </Row>
                    </div>

                    {/* Form Actions */}
                    <div className="form-actions">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="form-info">
                          <span className="required">*</span> Required fields
                        </div>
                        <div className="d-flex gap-3">
                          <Button
                            type="button"
                            variant="outline-secondary"
                            size="lg"
                            onClick={() => navigate("/")}
                            className="nav-button"
                          >
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" className="me-2">
                              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Back to Login
                          </Button>
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
                                Submitting...
                              </>
                            ) : (
                              <>
                                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" className="me-2">
                                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                </svg>
                                Submit Registration
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Form>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
};

export default HotelRegisterFromOut;
