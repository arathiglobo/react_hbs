import React, { useEffect, useState } from "react";
import { Card, Button, Form, Row, Col } from "react-bootstrap";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/TopBar";
import axiosInstance from "../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function CompanyProfile() {
  const [formData, setFormData] = useState({
    companyProfileId: "",
    companyName: "",
    authorizedPerson: "",
    address: "",
    website: "",
    mainOffice: "",
    yearStandUp: "",
    labours: "",
    branches: "",
    mailId: "",
    telephone: "",
    faxNumber: "",
    mobile: "",
    postOffice: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isEditMode, setIsEditMode] = useState(false);

  // Helper function to safely convert value to string
  const toString = (value) => {
    if (value == null || value === undefined) return "";
    return String(value);
  };

  // Helper function to safely trim string values
  const safeTrim = (value) => {
    return toString(value).trim();
  };

  const validateForm = () => {
    const errors = {};

    if (!safeTrim(formData.companyName)) {
      errors.companyName = "Company Name is required";
    }

    if (!safeTrim(formData.authorizedPerson)) {
      errors.authorizedPerson = "Authorized Person is required";
    }

    if (!safeTrim(formData.address)) {
      errors.address = "Address is required";
    }

    const website = safeTrim(formData.website);
    if (website && !isValidUrl(website)) {
      errors.website = "Please enter a valid website URL";
    }

    if (!safeTrim(formData.mainOffice)) {
      errors.mainOffice = "Main Office is required";
    }

    const yearStandUp = safeTrim(formData.yearStandUp);
    if (!yearStandUp) {
      errors.yearStandUp = "Year Stand Up is required";
    } else if (!isValidYear(yearStandUp)) {
      errors.yearStandUp = "Please enter a valid year (e.g., 2010)";
    }

    const labours = safeTrim(formData.labours);
    if (!labours) {
      errors.labours = "Number of Labours is required";
    } else if (isNaN(labours) || parseInt(labours) <= 0) {
      errors.labours = "Please enter a valid number";
    }

    const branches = safeTrim(formData.branches);
    if (!branches) {
      errors.branches = "Number of Branches is required";
    } else if (isNaN(branches) || parseInt(branches) <= 0) {
      errors.branches = "Please enter a valid number";
    }

    const mailId = safeTrim(formData.mailId);
    if (!mailId) {
      errors.mailId = "Email is required";
    } else if (!isValidEmail(mailId)) {
      errors.mailId = "Please enter a valid email address";
    }

    if (!safeTrim(formData.mobile)) {
      errors.mobile = "Mobile is required";
    }

    const postOffice = safeTrim(formData.postOffice);
    if (!postOffice) {
      errors.postOffice = "Post Office is required";
    } else if (isNaN(postOffice) || parseInt(postOffice) <= 0) {
      errors.postOffice = "Please enter a valid number";
    }

    return errors;
  };

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidUrl = (url) => {
    try {
      // Add http:// if protocol is missing
      const urlToCheck = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('www.') ? url : `http://${url}`;
      new URL(urlToCheck);
      return true;
    } catch {
      // Also check simple patterns like www.example.com
      const urlPattern = /^(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
      return urlPattern.test(url);
    }
  };

  const isValidYear = (year) => {
    const yearNum = parseInt(year);
    return !isNaN(yearNum) && yearNum >= 1900 && yearNum <= new Date().getFullYear();
  };

  const fetchCompanyProfile = async (id = null) => {
    setIsLoading(true);
    try {
      let res;
      let profileId = id;
      
      // If ID is not provided, check localStorage or use default
      if (!profileId) {
        profileId = localStorage.getItem("companyProfileId") || "1";
      }
      
      // Fetch by ID
      res = await axiosInstance.get(`/api/companyProfile/${profileId}`);
      
      if (res.data) {
        const data = res.data;
        const fetchedProfileId = data.companyProfileId || data.id || profileId || "1";
        
        // Store the ID in localStorage if not already stored
        if (fetchedProfileId && !localStorage.getItem("companyProfileId")) {
          localStorage.setItem("companyProfileId", String(fetchedProfileId));
        }
        
        setFormData({
          companyProfileId: fetchedProfileId,
          companyName: toString(data.companyName),
          authorizedPerson: toString(data.authorizedPerson),
          address: toString(data.address),
          website: toString(data.website),
          mainOffice: toString(data.mainOffice),
          yearStandUp: toString(data.yearStandUp),
          labours: toString(data.labours),
          branches: toString(data.branches),
          mailId: toString(data.mailId),
          telephone: toString(data.telephone),
          faxNumber: toString(data.faxNumber),
          mobile: toString(data.mobile),
          postOffice: toString(data.postOffice),
        });
        setIsEditMode(true);
      }
    } catch (err) {
      console.error("Error fetching company profile:", err);
      // If no profile exists, start with empty form (create mode)
      setIsEditMode(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const saveCompanyProfile = async () => {
    // Validation
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setIsLoading(true);
      setValidationErrors({});
      
      const payload = {
        companyProfileId: formData.companyProfileId || "1",
        companyName: safeTrim(formData.companyName),
        authorizedPerson: safeTrim(formData.authorizedPerson),
        address: safeTrim(formData.address),
        website: safeTrim(formData.website) || "",
        mainOffice: safeTrim(formData.mainOffice),
        yearStandUp: safeTrim(formData.yearStandUp),
        labours: safeTrim(formData.labours),
        branches: safeTrim(formData.branches),
        mailId: safeTrim(formData.mailId),
        telephone: safeTrim(formData.telephone),
        faxNumber: safeTrim(formData.faxNumber) || "",
        mobile: safeTrim(formData.mobile),
        postOffice: safeTrim(formData.postOffice),
      };

      const saveRes = await axiosInstance.post(
        "/api/companyProfile/save",
        payload
      );
      
      // Get the ID from response or use the payload ID
      const profileId = saveRes.data?.companyProfileId || saveRes.data?.id || payload.companyProfileId || "1";
      
      // Store the ID in localStorage for future page loads
      if (profileId) {
        localStorage.setItem("companyProfileId", profileId);
      }
      
      if (saveRes.data !== 0 || saveRes.data === true || saveRes.data) {
        toast.success(isEditMode ? "Company Profile updated successfully!" : "Company Profile saved successfully!");
        
        // Fetch the saved data using the ID
        await fetchCompanyProfile(profileId);
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save company profile");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyProfile();
  }, []);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Company Profile</span>
            </Card.Header>
            <Card.Body>
              {isLoading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="text-muted mt-2">Loading company profile...</p>
                </div>
              ) : (
                <Form>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Company Name <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.companyName}
                          onChange={(e) => handleInputChange("companyName", e.target.value)}
                          placeholder="Enter company name"
                          isInvalid={!!validationErrors.companyName}
                        />
                        {validationErrors.companyName && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.companyName}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Authorized Person <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.authorizedPerson}
                          onChange={(e) => handleInputChange("authorizedPerson", e.target.value)}
                          placeholder="Enter authorized person name"
                          isInvalid={!!validationErrors.authorizedPerson}
                        />
                        {validationErrors.authorizedPerson && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.authorizedPerson}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={12}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Address <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          value={formData.address}
                          onChange={(e) => handleInputChange("address", e.target.value)}
                          placeholder="Enter company address"
                          isInvalid={!!validationErrors.address}
                        />
                        {validationErrors.address && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.address}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Website</Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.website}
                          onChange={(e) => handleInputChange("website", e.target.value)}
                          placeholder="www.example.com"
                          isInvalid={!!validationErrors.website}
                        />
                        {validationErrors.website && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.website}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Main Office <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.mainOffice}
                          onChange={(e) => handleInputChange("mainOffice", e.target.value)}
                          placeholder="Enter main office location"
                          isInvalid={!!validationErrors.mainOffice}
                        />
                        {validationErrors.mainOffice && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.mainOffice}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Year Stand Up <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.yearStandUp}
                          onChange={(e) => handleInputChange("yearStandUp", e.target.value)}
                          placeholder="e.g., 2010"
                          maxLength={4}
                          isInvalid={!!validationErrors.yearStandUp}
                        />
                        {validationErrors.yearStandUp && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.yearStandUp}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Email <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="email"
                          value={formData.mailId}
                          onChange={(e) => handleInputChange("mailId", e.target.value)}
                          placeholder="info@company.com"
                          isInvalid={!!validationErrors.mailId}
                        />
                        {validationErrors.mailId && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.mailId}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Labours <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="number"
                          min="1"
                          value={formData.labours}
                          onChange={(e) => handleInputChange("labours", e.target.value)}
                          placeholder="Enter number of labours"
                          isInvalid={!!validationErrors.labours}
                        />
                        {validationErrors.labours && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.labours}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Branches <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="number"
                          min="1"
                          value={formData.branches}
                          onChange={(e) => handleInputChange("branches", e.target.value)}
                          placeholder="Enter number of branches"
                          isInvalid={!!validationErrors.branches}
                        />
                        {validationErrors.branches && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.branches}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Post Office <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="number"
                          min="1"
                          value={formData.postOffice}
                          onChange={(e) => handleInputChange("postOffice", e.target.value)}
                          placeholder="Enter post office number"
                          isInvalid={!!validationErrors.postOffice}
                        />
                        {validationErrors.postOffice && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.postOffice}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Telephone 
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.telephone}
                          onChange={(e) => handleInputChange("telephone", e.target.value)}
                          placeholder="Enter telephone number"
                          isInvalid={!!validationErrors.telephone}
                        />
                        {validationErrors.telephone && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.telephone}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Mobile <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.mobile}
                          onChange={(e) => handleInputChange("mobile", e.target.value)}
                          placeholder="Enter mobile number"
                          isInvalid={!!validationErrors.mobile}
                        />
                        {validationErrors.mobile && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.mobile}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                <Form.Group className="mb-3">
                        <Form.Label>Fax Number</Form.Label>
                  <Form.Control
                          type="text"
                          value={formData.faxNumber}
                          onChange={(e) => handleInputChange("faxNumber", e.target.value)}
                          placeholder="Enter fax number (optional)"
                          isInvalid={!!validationErrors.faxNumber}
                        />
                        {validationErrors.faxNumber && (
                    <Form.Control.Feedback type="invalid">
                            {validationErrors.faxNumber}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
                    </Col>
                  </Row>

                  <div className="d-flex justify-content-end mt-4">
              <Button
                className="btn-indigo"
                      onClick={saveCompanyProfile}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                          {isEditMode ? "Updating..." : "Saving..."}
                  </>
                      ) : isEditMode ? (
                  "Update"
                ) : (
                  "Save"
                )}
              </Button>
                  </div>
                </Form>
              )}
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
}
