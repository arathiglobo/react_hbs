import React, { useState, useEffect, useMemo } from "react";
import { Row, Col, Form } from "react-bootstrap";
import AsyncSelect from "react-select/async";
import axiosInstance from "../../../../components/AxiosInstance";

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

  // Keep local state in sync with parent data
  useEffect(() => {
    setLocalData(data);
  }, [data]);

  // Resolve the selected category (master row) so we can display its
  // occupancy template and propagate the counts upward.
  const selectedCategory = useMemo(() => {
    if (!localData.packageCategory) return null;
    return (
      categories.find(
        (c) => String(c.packageCategoryId) === String(localData.packageCategory)
      ) || null
    );
  }, [categories, localData.packageCategory]);

  // Whenever the selected category changes, push its adult/child/childAge/
  // occupancy into the shared booking state so downstream tabs (Pax Info,
  // Order summary, submission payload) keep working unchanged.
  useEffect(() => {
    if (!selectedCategory) return;
    const updated = {
      ...localData,
      adultCount: selectedCategory.adults != null ? selectedCategory.adults : (localData.adultCount || 1),
      childCount: selectedCategory.children != null ? selectedCategory.children : (localData.childCount || 0),
      childAge: selectedCategory.childAge != null ? selectedCategory.childAge : (localData.childAge || ""),
      occupancy: selectedCategory.occupancy != null ? selectedCategory.occupancy : (localData.occupancy ?? null),
    };
    setLocalData(updated);
    updateData(updated);
  }, [selectedCategory]);

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

  const handleChange = (field, value) => {
    setLocalData((prev) => {
      const updated = { ...prev, [field]: value };
      updateData(updated);
      return updated;
    });
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
              value={localData.paxPassport || null}
              onChange={(option) => {
                setLocalData((prev) => {
                  const updated = {
                    ...prev,
                    paxPassport: option,
                    nativeCountry: option ? option.value : "",
                  };
                  updateData(updated);
                  return updated;
                });
              }}
              placeholder="Select country"
              className="modern-select"
              classNamePrefix="react-select"
            />
          </Form.Group>
        </Col>
      </Row>

      {/* Passenger counts + occupancy are derived from the selected package
          category — they are no longer editable here. If no category is
          selected yet we show a friendly hint instead of stale defaults. */}
      <p className="tab-section-title">Package category details</p>
      {selectedCategory ? (
        <div
          className="mb-3 p-3 rounded"
          style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
        >
          <Row className="g-3">
            <Col md={3}>
              <div className="booking-field-label">Adults</div>
              <div className="fw-semibold" style={{ fontSize: "1rem" }}>
                {selectedCategory.adults != null ? selectedCategory.adults : "-"}
              </div>
            </Col>
            <Col md={3}>
              <div className="booking-field-label">Children</div>
              <div className="fw-semibold" style={{ fontSize: "1rem" }}>
                {selectedCategory.children != null ? selectedCategory.children : "-"}
              </div>
            </Col>
            <Col md={3}>
              <div className="booking-field-label">Child Age</div>
              <div className="fw-semibold" style={{ fontSize: "1rem" }}>
                {selectedCategory.childAge || "-"}
              </div>
            </Col>
            <Col md={3}>
              <div className="booking-field-label">Occupancy</div>
              <div className="fw-semibold" style={{ fontSize: "1rem" }}>
                {selectedCategory.occupancy != null ? selectedCategory.occupancy : "-"}
              </div>
            </Col>
          </Row>
        </div>
      ) : (
        <div className="mb-3 text-muted small">
          Select a package category above to see its adult / child / age /
          occupancy configuration.
        </div>
      )}

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