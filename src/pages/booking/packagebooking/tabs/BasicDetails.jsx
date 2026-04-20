import React, { useState, useEffect } from "react";
import { Row, Col, Form } from "react-bootstrap";
import AsyncSelect from "react-select/async";
import axiosInstance from "../../../../components/AxiosInstance";
import { FaMinus, FaPlus } from "react-icons/fa";

const BasicDetails = ({ data, updateData, onNext }) => {
  const [localData, setLocalData] = useState(data);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axiosInstance.get("/api/packageCategory");
        setCategories(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  const loadPassportOptions = async (inputValue) => {
    try {
      const response = await axiosInstance.get(
        `/api/country?page=0&limit=20&search=${encodeURIComponent(inputValue)}`
      );
      return (response.data || []).map((country) => ({
        value: country.id,
        label: country.name,
      }));
    } catch {
      return [];
    }
  };

  const handleCounter = (field, delta) => {
    const newValue = Math.max(0, (localData[field] || 0) + delta);
    const updated = { ...localData, [field]: newValue };
    setLocalData(updated);
    updateData(updated);
  };

  const handleChange = (field, value) => {
    const updated = { ...localData, [field]: value };
    setLocalData(updated);
    updateData(updated);
  };

  return (
    <div className="tab-pane-active">
      <p className="tab-section-title">Travel details</p>

      <Row className="g-2 mb-3">
        <Col md={4}>
          <Form.Group>
            <Form.Label className="booking-field-label">
              Travel date <span className="required-dot">*</span>
            </Form.Label>
            <Form.Control
              type="date"
              value={localData.travelDate || ""}
              onChange={(e) => handleChange("travelDate", e.target.value)}
              className="form-control-modern"
            />
          </Form.Group>
        </Col>

        <Col md={4}>
          <Form.Group>
            <Form.Label className="booking-field-label">
              Package category <span className="required-dot">*</span>
            </Form.Label>
            <Form.Select
              value={localData.packageCategory || ""}
              onChange={(e) => handleChange("packageCategory", e.target.value)}
              className="form-control-modern"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.packageCategoryId} value={cat.packageCategoryId}>
                  {cat.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col md={4}>
          <Form.Group>
            <Form.Label className="booking-field-label">
              Pax passport <span className="required-dot">*</span>
            </Form.Label>
            <AsyncSelect
              cacheOptions
              defaultOptions
              loadOptions={loadPassportOptions}
              value={localData.paxPassport}
              onChange={(option) => {
                handleChange("paxPassport", option);
                handleChange("nativeCountry", option ? option.value : "");
              }}
              placeholder="Select country"
              className="modern-select"
              classNamePrefix="react-select"
            />
          </Form.Group>
        </Col>
      </Row>

      <p className="tab-section-title">Passengers</p>
      <Row className="g-2 mb-3">
        <Col md={4}>
          <Form.Label className="booking-field-label">Adults</Form.Label>
          <div className="counter-box">
            <button
              className="counter-btn"
              onClick={() => handleCounter("adultCount", -1)}
              disabled={(localData.adultCount || 1) <= 1}
            >
              <FaMinus size={11} />
            </button>
            <span className="counter-value">{localData.adultCount || 1}</span>
            <button className="counter-btn" onClick={() => handleCounter("adultCount", 1)}>
              <FaPlus size={11} />
            </button>
          </div>
        </Col>

        <Col md={4}>
          <Form.Label className="booking-field-label">Children</Form.Label>
          <div className="counter-box">
            <button
              className="counter-btn"
              onClick={() => handleCounter("childCount", -1)}
              disabled={(localData.childCount || 0) <= 0}
            >
              <FaMinus size={11} />
            </button>
            <span className="counter-value">{localData.childCount || 0}</span>
            <button className="counter-btn" onClick={() => handleCounter("childCount", 1)}>
              <FaPlus size={11} />
            </button>
          </div>
        </Col>
      </Row>

      <hr className="tab-nav-divider" />
      <div className="d-flex justify-content-end mt-3">
        <button className="btn-nav-next" onClick={onNext}>
          Next <span style={{ fontSize: "1rem" }}>→</span>
        </button>
      </div>
    </div>
  );
};

export default BasicDetails;