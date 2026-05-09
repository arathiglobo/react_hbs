import React, { useState, useEffect, useCallback } from "react";
import { Row, Col, Form, Button, Spinner } from "react-bootstrap";
import Select from "react-select";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

const initialForm = {
  supplier: null,
  activity: "",
  date: "",
  pickupPoint: "",
  activityType: "",
  activityTraveller: "adult",
  activityTravellerCount: "1",
  unitPrice: "",
  tax: "0",
  sellingPrice: "",
};

const OfflineActivity = ({ mainBasicId, invoiceNo, onAdd }) => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);

  const fetchSuppliers = async (search = "") => {
    setIsLoadingSuppliers(true);
    try {
      const res = await axiosInstance.get(`/api/supplier?page=0&limit=10&search=${search}`);
      const options = (res.data || []).map(s => ({ value: s.supplierId, label: s.name }));
      setSupplierOptions(options);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingSuppliers(false);
    }
  };

  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const debouncedFetchSuppliers = useCallback(debounce(fetchSuppliers, 500), []);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => { const { [name]: _, ...rest } = prev; return rest; });
  };

  const handleSelectChange = (name, val) => {
    setForm(prev => ({ ...prev, [name]: val }));
    if (errors[name]) setErrors(prev => { const { [name]: _, ...rest } = prev; return rest; });
  };

  const handleUnitPriceChange = (e) => {
    const unitPrice = e.target.value;
    const tax = parseFloat(form.tax) || 0;
    const taxAmt = (parseFloat(unitPrice) || 0) * (tax / 100);
    const selling = ((parseFloat(unitPrice) || 0) + taxAmt).toFixed(2);
    setForm((prev) => ({ ...prev, unitPrice, sellingPrice: unitPrice ? selling : "" }));
    if (errors.unitPrice) setErrors((prev) => { const { unitPrice: _, ...rest } = prev; return rest; });
  };

  const handleTaxChange = (e) => {
    const tax = e.target.value;
    const unit = parseFloat(form.unitPrice) || 0;
    const taxAmt = unit * ((parseFloat(tax) || 0) / 100);
    setForm((prev) => ({ ...prev, tax, sellingPrice: form.unitPrice ? (unit + taxAmt).toFixed(2) : "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.supplier) e.supplier = "Supplier is required";
    if (!form.activity.trim()) e.activity = "Activity is required";
    if (!form.date) e.date = "Date is required";
    if (!form.unitPrice.trim()) e.unitPrice = "Unit Price is required";
    return e;
  };

  const formatDatePayload = (dateStr) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const formErrors = validate();
    if (Object.keys(formErrors).length > 0) { setErrors(formErrors); return; }

    setIsSubmitting(true);
    const payload = {
      supplierActivityId: "0",
      supplierMainBasicId: String(mainBasicId),
      supplierId: String(form.supplier?.value),
      activity: form.activity,
      date: formatDatePayload(form.date),
      pickupPoint: form.pickupPoint,
      unitPrice: String(form.unitPrice),
      tax: String(form.tax),
      sellingPrice: String(form.sellingPrice),
      invoiceNumber: invoiceNo,
      activityType: form.activityType,
      activityTraveller: form.activityTraveller,
      activityTravellerCount: String(form.activityTravellerCount),
    };

    try {
      const response = await axiosInstance.post(
        "/api/v1/offline-booking/activity/save",
        payload
      );
      if (response.data && response.data !== 0) {
        toast.success("Activity details added successfully");
        if (onAdd) onAdd();
        setForm(initialForm);
        setErrors({});
      } else {
        toast.error("Failed to add activity details");
      }
    } catch (error) {
      console.error("Error saving activity:", error);
      toast.error("An error occurred while saving");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = (field) =>
    `form-control-premium${errors[field] ? " is-invalid" : ""}`;

  return (
    <div className="supplier-form-panel">
      <h5 className="supplier-form-title">Activity</h5>
      <Form onSubmit={handleSubmit}>
        <Row className="g-3">
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Supplier</Form.Label>
              <Select
                className={`react-select-premium ${errors.supplier ? "is-invalid-select" : ""}`}
                classNamePrefix="react-select"
                options={supplierOptions}
                value={form.supplier}
                onChange={(opt) => handleSelectChange("supplier", opt)}
                onInputChange={(val) => debouncedFetchSuppliers(val)}
                isLoading={isLoadingSuppliers}
                placeholder="SELECT"
                isSearchable
              />
              {errors.supplier && <div className="text-danger small mt-1">{errors.supplier}</div>}
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Activity</Form.Label>
              <Form.Control
                type="text"
                className={inputCls("activity")}
                name="activity"
                value={form.activity}
                onChange={handleChange}
                placeholder="Activity Name"
              />
              {errors.activity && <div className="text-danger small mt-1">{errors.activity}</div>}
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Date</Form.Label>
              <Form.Control
                type="date"
                className={inputCls("date")}
                name="date"
                value={form.date}
                onChange={handleChange}
              />
              {errors.date && <div className="text-danger small mt-1">{errors.date}</div>}
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Pickup Point</Form.Label>
              <Form.Control
                type="text"
                className="form-control-premium"
                name="pickupPoint"
                value={form.pickupPoint}
                onChange={handleChange}
                placeholder="Pickup Point"
              />
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Activity Type</Form.Label>
              <Form.Select
                className="form-control-premium"
                name="activityType"
                value={form.activityType}
                onChange={handleChange}
              >
                <option value="">SELECT</option>
                <option value="Private">Private</option>
                <option value="SIC">SIC</option>
              </Form.Select>
            </Form.Group>
          </Col>

          <Col lg={2} md={3}>
            <Form.Group>
              <Form.Label className="form-label-modern">Traveller</Form.Label>
              <Form.Select
                className="form-control-premium"
                name="activityTraveller"
                value={form.activityTraveller}
                onChange={handleChange}
              >
                <option value="adult">Adult</option>
                <option value="child">Child</option>
              </Form.Select>
            </Form.Group>
          </Col>

          <Col lg={2} md={3}>
            <Form.Group>
              <Form.Label className="form-label-modern">Count</Form.Label>
              <Form.Control
                type="number"
                min="1"
                className="form-control-premium"
                name="activityTravellerCount"
                value={form.activityTravellerCount}
                onChange={handleChange}
              />
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Unit Price (in AED)</Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                className={inputCls("unitPrice")}
                name="unitPrice"
                value={form.unitPrice}
                onChange={handleUnitPriceChange}
                placeholder="Unit Price"
              />
              {errors.unitPrice && <div className="text-danger small mt-1">{errors.unitPrice}</div>}
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Tax (%)</Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                className="form-control-premium"
                name="tax"
                value={form.tax}
                onChange={handleTaxChange}
                placeholder="Tax"
              />
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Selling Price (in AED)</Form.Label>
              <Form.Control
                type="number"
                className="form-control-premium"
                name="sellingPrice"
                value={form.sellingPrice}
                onChange={handleChange}
                placeholder="Selling Price"
              />
            </Form.Group>
          </Col>

          <Col lg={4} md={12} className="d-flex align-items-end">
            <Button
              type="submit"
              className="supplier-submit-btn w-100"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Spinner animation="border" size="sm" className="me-2" />Saving...</>
              ) : (
                <>Add &rarr;</>
              )}
            </Button>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default OfflineActivity;
