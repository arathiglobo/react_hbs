import React, { useState } from "react";
import { Row, Col, Form, Button, Spinner } from "react-bootstrap";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

const initialForm = {
  timeType: "arrival",
  supplier: "",
  transfer: "",
  qty: "",
  driver: "",
  vehicle: "",
  vehicleNo: "",
  rate: "",
  tax: "",
  sellingPrice: "",
};

const OfflineCab = ({ mainBasicId, onAdd }) => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "radio" ? value : value }));
    if (errors[name]) setErrors((prev) => { const { [name]: _, ...rest } = prev; return rest; });
  };

  const handleRateChange = (e) => {
    const rate = e.target.value;
    const tax = parseFloat(form.tax) || 0;
    const taxAmt = (parseFloat(rate) || 0) * (tax / 100);
    const selling = ((parseFloat(rate) || 0) + taxAmt).toFixed(2);
    setForm((prev) => ({ ...prev, rate, sellingPrice: rate ? selling : "" }));
    if (errors.rate) setErrors((prev) => { const { rate: _, ...rest } = prev; return rest; });
  };

  const handleTaxChange = (e) => {
    const tax = e.target.value;
    const rate = parseFloat(form.rate) || 0;
    const taxAmt = rate * ((parseFloat(tax) || 0) / 100);
    setForm((prev) => ({
      ...prev,
      tax,
      sellingPrice: form.rate ? (rate + taxAmt).toFixed(2) : "",
    }));
  };

  const validate = () => {
    const e = {};
    if (!form.supplier.trim()) e.supplier = "Supplier is required";
    if (!form.transfer.trim()) e.transfer = "Transfer is required";
    if (!form.qty.trim()) e.qty = "Qty is required";
    if (!form.rate.trim()) e.rate = "Rate is required";
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const formErrors = validate();
    if (Object.keys(formErrors).length > 0) { setErrors(formErrors); return; }

    setIsSubmitting(true);
    const payload = {
      supplierMainBasicId: mainBasicId,
      timeType: form.timeType,
      supplier: form.supplier,
      transfer: form.transfer,
      qty: form.qty,
      driver: form.driver,
      vehicle: form.vehicle,
      vehicleNo: form.vehicleNo,
      rate: form.rate,
      tax: form.tax,
      sellingPrice: form.sellingPrice,
    };

    try {
      const response = await axiosInstance.post(
        "/api/v1/offline-booking/supplier-cab/save",
        payload
      );
      if (response.data && response.data !== 0) {
        toast.success("Cab details added successfully");
        if (onAdd) {
          onAdd({
            type: "Cab",
            description: form.transfer,
            qty: form.qty,
            unitPrice: form.rate,
            sellingPrice: form.sellingPrice,
            tax: form.tax,
            taxAmount: (
              ((parseFloat(form.rate) || 0) * (parseFloat(form.tax) || 0)) / 100
            ).toFixed(2),
            subTotal: form.sellingPrice,
          });
        }
        setForm(initialForm);
        setErrors({});
      } else {
        toast.error("Failed to add cab details");
      }
    } catch (error) {
      console.error("Error saving cab:", error);
      toast.error("An error occurred while saving");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = (field) =>
    `form-control-premium${errors[field] ? " is-invalid" : ""}`;

  return (
    <div className="supplier-form-panel">
      <h5 className="supplier-form-title">Cab</h5>
      <Form onSubmit={handleSubmit}>
        {/* Radio: Arrival / Departure */}
        <div className="d-flex gap-4 mb-3">
          <Form.Check
            type="radio"
            label="Arrival Time"
            name="timeType"
            value="arrival"
            checked={form.timeType === "arrival"}
            onChange={handleChange}
            id="cab-arrival"
          />
          <Form.Check
            type="radio"
            label="Departure Time"
            name="timeType"
            value="departure"
            checked={form.timeType === "departure"}
            onChange={handleChange}
            id="cab-departure"
          />
        </div>

        <Row className="g-3">
          {/* Supplier */}
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Supplier</Form.Label>
              <Form.Control
                type="text"
                className={inputCls("supplier")}
                name="supplier"
                value={form.supplier}
                onChange={handleChange}
                placeholder="Supplier Name"
              />
              {errors.supplier && <div className="text-danger small mt-1">{errors.supplier}</div>}
            </Form.Group>
          </Col>

          {/* Transfer */}
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Transfer</Form.Label>
              <Form.Control
                type="text"
                className={inputCls("transfer")}
                name="transfer"
                value={form.transfer}
                onChange={handleChange}
                placeholder="Transfer"
              />
              {errors.transfer && <div className="text-danger small mt-1">{errors.transfer}</div>}
            </Form.Group>
          </Col>

          {/* Qty */}
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Qty</Form.Label>
              <Form.Control
                type="number"
                min="1"
                className={inputCls("qty")}
                name="qty"
                value={form.qty}
                onChange={handleChange}
                placeholder="Cab Qty"
              />
              {errors.qty && <div className="text-danger small mt-1">{errors.qty}</div>}
            </Form.Group>
          </Col>

          {/* Driver */}
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Driver</Form.Label>
              <Form.Control
                type="text"
                className="form-control-premium"
                name="driver"
                value={form.driver}
                onChange={handleChange}
                placeholder="Driver Name"
              />
            </Form.Group>
          </Col>

          {/* Vehicle */}
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Vehicle</Form.Label>
              <Form.Control
                type="text"
                className="form-control-premium"
                name="vehicle"
                value={form.vehicle}
                onChange={handleChange}
                placeholder="Vehicle Name"
              />
            </Form.Group>
          </Col>

          {/* Vehicle No */}
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Vehicle No</Form.Label>
              <Form.Control
                type="text"
                className="form-control-premium"
                name="vehicleNo"
                value={form.vehicleNo}
                onChange={handleChange}
                placeholder="Vehicle Number"
              />
            </Form.Group>
          </Col>

          {/* Rate */}
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Rate (in AED)</Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                className={inputCls("rate")}
                name="rate"
                value={form.rate}
                onChange={handleRateChange}
                placeholder="Rate"
              />
              {errors.rate && <div className="text-danger small mt-1">{errors.rate}</div>}
            </Form.Group>
          </Col>

          {/* Tax */}
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

          {/* Selling Price */}
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Selling Price (in AED)</Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                className="form-control-premium"
                name="sellingPrice"
                value={form.sellingPrice}
                onChange={handleChange}
                placeholder="Selling Price"
              />
            </Form.Group>
          </Col>

          {/* Submit */}
          <Col md={12}>
            <Button
              type="submit"
              className="supplier-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Spinner animation="border" size="sm" className="me-2" />Saving...</>
              ) : (
                <>Submit &rarr;</>
              )}
            </Button>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default OfflineCab;