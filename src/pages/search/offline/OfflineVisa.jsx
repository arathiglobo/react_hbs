import React, { useState } from "react";
import { Row, Col, Form, Button, Spinner } from "react-bootstrap";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

const initialForm = {
  supplier: "",
  visaType: "",
  country: "",
  qty: "",
  unitPrice: "",
  tax: "",
  sellingPrice: "",
  travelDate: "",
  summary: "",
};

const OfflineVisa = ({ mainBasicId, onAdd }) => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => { const { [name]: _, ...rest } = prev; return rest; });
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
    if (!form.supplier.trim()) e.supplier = "Supplier is required";
    if (!form.visaType.trim()) e.visaType = "Visa Type is required";
    if (!form.qty.trim()) e.qty = "Qty is required";
    if (!form.unitPrice.trim()) e.unitPrice = "Unit Price is required";
    if (!form.travelDate) e.travelDate = "Travel Date is required";
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const formErrors = validate();
    if (Object.keys(formErrors).length > 0) { setErrors(formErrors); return; }

    setIsSubmitting(true);
    const payload = {
      supplierMainBasicId: mainBasicId,
      supplier: form.supplier,
      visaType: form.visaType,
      country: form.country,
      qty: form.qty,
      unitPrice: form.unitPrice,
      tax: form.tax,
      sellingPrice: form.sellingPrice,
      travelDate: form.travelDate,
      summary: form.summary,
    };

    try {
      const response = await axiosInstance.post(
        "/api/v1/offline-booking/supplier-visa/save",
        payload
      );
      if (response.data && response.data !== 0) {
        toast.success("Visa details added successfully");
        if (onAdd) {
          onAdd({
            type: "Visa",
            description: `${form.visaType}${form.country ? ` - ${form.country}` : ""}`,
            qty: form.qty,
            unitPrice: form.unitPrice,
            sellingPrice: form.sellingPrice,
            tax: form.tax,
            taxAmount: (
              ((parseFloat(form.unitPrice) || 0) * (parseFloat(form.tax) || 0)) / 100
            ).toFixed(2),
            subTotal: form.sellingPrice,
          });
        }
        setForm(initialForm);
        setErrors({});
      } else {
        toast.error("Failed to add visa details");
      }
    } catch (error) {
      console.error("Error saving visa:", error);
      toast.error("An error occurred while saving");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = (field) =>
    `form-control-premium${errors[field] ? " is-invalid" : ""}`;

  return (
    <div className="supplier-form-panel">
      <h5 className="supplier-form-title">Visa</h5>
      <Form onSubmit={handleSubmit}>
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

          {/* Visa Type */}
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Visa Type</Form.Label>
              <Form.Control
                type="text"
                className={inputCls("visaType")}
                name="visaType"
                value={form.visaType}
                onChange={handleChange}
                placeholder="Visa Type"
              />
              {errors.visaType && <div className="text-danger small mt-1">{errors.visaType}</div>}
            </Form.Group>
          </Col>

          {/* Country */}
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Country</Form.Label>
              <Form.Control
                type="text"
                className="form-control-premium"
                name="country"
                value={form.country}
                onChange={handleChange}
                placeholder="Country"
              />
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
                placeholder="Quantity"
              />
              {errors.qty && <div className="text-danger small mt-1">{errors.qty}</div>}
            </Form.Group>
          </Col>

          {/* Unit Price */}
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

          {/* Travel Date */}
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Travel Date</Form.Label>
              <Form.Control
                type="date"
                className={inputCls("travelDate")}
                name="travelDate"
                value={form.travelDate}
                onChange={handleChange}
              />
              {errors.travelDate && <div className="text-danger small mt-1">{errors.travelDate}</div>}
            </Form.Group>
          </Col>

          {/* Summary */}
          <Col lg={8} md={12}>
            <Form.Group>
              <Form.Label className="form-label-modern">Summary</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                className="form-control-premium"
                name="summary"
                value={form.summary}
                onChange={handleChange}
                placeholder="Enter summary here..."
              />
            </Form.Group>
          </Col>

          {/* Submit */}
          <Col lg={4} md={12} className="d-flex align-items-end">
            <Button
              type="submit"
              className="supplier-submit-btn w-100"
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

export default OfflineVisa;