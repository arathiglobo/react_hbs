import React, { useState, useEffect, useCallback } from "react";
import { Row, Col, Form, Button, Spinner } from "react-bootstrap";
import Select from "react-select";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import useOfflineLineEdit, { asText, supplierOptionFromLine } from "../../../hooks/useOfflineLineEdit";

const initialForm = {
  timeType: "arrival", // arrival or departure
  supplier: null,
  arrivalTransfer: "",
  quantity: "1",
  driverName: "",
  vehicleName: "",
  vechicleNumber: "",
  rate: "",
  tax: "0",
  sellingPrice: "",
  date: "",
  pickupPoint: "",
  dropOffPoint: "",
  flightNumber: "",
  time: "",
};

// A saved transfer line (GET /api/v1/offline-booking/line/{id}) → this form.
// Arrival and departure keep their date / points / time in different fields.
const formFromLine = (data) => {
  const l = data.line || {};
  const dates = data.isoDates || {};
  const isArrival = l.departureTime !== true;
  return {
    timeType: isArrival ? "arrival" : "departure",
    supplier: supplierOptionFromLine(data),
    arrivalTransfer: l.arrivalTransfer || "",
    quantity: asText(l.quantity, "1"),
    driverName: l.driverName || "",
    vehicleName: l.vehicleName || "",
    vechicleNumber: l.vechicleNumber || "",
    rate: asText(l.rate),
    tax: asText(l.tax, "0"),
    sellingPrice: asText(l.sellingPrice),
    date: (isArrival ? dates.checkinDate : dates.checkOutDate) || "",
    pickupPoint: (isArrival ? l.pickupPoint : l.cabdepPickPoint) || "",
    dropOffPoint: (isArrival ? l.cabArrivalDropOffpoint : l.dropOffPoint) || "",
    flightNumber: l.flightNumber || "",
    time: (isArrival ? l.ETA ?? l.eta : l.ETD ?? l.etd) || "",
  };
};

// editingEntry: a line-table row being edited (null = adding a new line).
// onCancelEdit: leave edit mode without saving.
const OfflineCab = ({ mainBasicId, invoiceNo, onAdd, editingEntry, onCancelEdit }) => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isEditing, editData, isLoadingEdit } = useOfflineLineEdit({
    editingEntry,
    initialForm,
    toForm: formFromLine,
    setForm,
    setErrors,
    onCancelEdit,
  });
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
    const r = parseFloat(form.rate) || 0;
    const taxAmt = r * ((parseFloat(tax) || 0) / 100);
    setForm((prev) => ({ ...prev, tax, sellingPrice: form.rate ? (r + taxAmt).toFixed(2) : "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.supplier) e.supplier = "Supplier is required";
    if (!form.arrivalTransfer.trim()) e.arrivalTransfer = "Transfer is required";
    if (!form.quantity.trim()) e.quantity = "Quantity is required";
    if (!form.rate.trim()) e.rate = "Rate is required";
    if (!form.date) e.date = "Date is required";
    return e;
  };

  const formatDatePayload = (dateStr) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (isEditing && !editData) return; // still loading the line being edited
    const formErrors = validate();
    if (Object.keys(formErrors).length > 0) { setErrors(formErrors); return; }

    setIsSubmitting(true);
    const isArrival = form.timeType === "arrival";

    const payload = {
      // "0" adds a new transfer; an existing id updates it in place (the
      // Arrival / Departure choice is locked while editing, so the id is
      // always looked up in the right table).
      id: isEditing ? String(editData.line.id) : "0",
      supplierMainBasicId: String(mainBasicId),
      supplierId: String(form.supplier?.value),
      arrivalTime: isArrival,
      departureTime: !isArrival,
      arrivalTransfer: form.arrivalTransfer,
      quantity: String(form.quantity),
      driverName: form.driverName,
      vehicleName: form.vehicleName,
      vechicleNumber: form.vechicleNumber,
      flightNumber: form.flightNumber,
      tax: String(form.tax),
      sellingPrice: String(form.sellingPrice),
      rate: String(form.rate),
      checkinDate: isArrival ? formatDatePayload(form.date) : "",
      checkOutDate: !isArrival ? formatDatePayload(form.date) : "",
      pickupPoint: isArrival ? form.pickupPoint : "",
      cabdepPickPoint: !isArrival ? form.pickupPoint : "",
      cabArrivalDropOffpoint: isArrival ? form.dropOffPoint : "",
      dropOffPoint: !isArrival ? form.dropOffPoint : "",
      ETA: isArrival ? form.time : "",
      ETD: !isArrival ? form.time : "",
      invoiceNumber: invoiceNo,
    };

    try {
      const response = await axiosInstance.post(
        "/api/v1/offline-booking/cab/save",
        payload
      );
      if (response.data && response.data !== 0) {
        toast.success(isEditing ? "Cab details updated successfully" : "Cab details added successfully");
        if (onAdd) onAdd();
        setForm(initialForm);
        setErrors({});
      } else {
        toast.error(isEditing ? "Failed to update cab details" : "Failed to add cab details");
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
      <h5 className="supplier-form-title">{isEditing ? "Edit Cab" : "Cab"}</h5>
      <Form onSubmit={handleSubmit}>
        <div className="d-flex gap-4 mb-3">
          {/* Locked while editing: arrival and departure transfers are saved
              in different tables, so a line can't switch between them. */}
          <Form.Check
            type="radio"
            label="Arrival Time"
            name="timeType"
            value="arrival"
            checked={form.timeType === "arrival"}
            onChange={(e) => setForm(prev => ({ ...prev, timeType: e.target.value }))}
            disabled={isEditing}
            id="cab-arrival"
            className="modern-radio"
          />
          <Form.Check
            type="radio"
            label="Departure Time"
            name="timeType"
            value="departure"
            checked={form.timeType === "departure"}
            onChange={(e) => setForm(prev => ({ ...prev, timeType: e.target.value }))}
            disabled={isEditing}
            id="cab-departure"
            className="modern-radio"
          />
        </div>

        <Row className="g-3">
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Supplier <span className="text-danger">*</span></Form.Label>
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
              <Form.Label className="form-label-modern">Transfer <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                className={inputCls("arrivalTransfer")}
                name="arrivalTransfer"
                value={form.arrivalTransfer}
                onChange={handleChange}
                placeholder="Transfer"
              />
              {errors.arrivalTransfer && <div className="text-danger small mt-1">{errors.arrivalTransfer}</div>}
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Qty <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="number"
                min="1"
                className={inputCls("quantity")}
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                placeholder="Cab Qty"
              />
              {errors.quantity && <div className="text-danger small mt-1">{errors.quantity}</div>}
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Driver</Form.Label>
              <Form.Control
                type="text"
                className="form-control-premium"
                name="driverName"
                value={form.driverName}
                onChange={handleChange}
                placeholder="Driver Name"
              />
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Vehicle</Form.Label>
              <Form.Control
                type="text"
                className="form-control-premium"
                name="vehicleName"
                value={form.vehicleName}
                onChange={handleChange}
                placeholder="Vehicle Name"
              />
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Vehicle No</Form.Label>
              <Form.Control
                type="text"
                className="form-control-premium"
                name="vechicleNumber"
                value={form.vechicleNumber}
                onChange={handleChange}
                placeholder="Vehicle Number"
              />
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Rate (in AED) <span className="text-danger">*</span></Form.Label>
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

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Date <span className="text-danger">*</span></Form.Label>
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
              <Form.Label className="form-label-modern">
                {form.timeType === "arrival" ? "Pickup Point" : "Pick Up Point"}
              </Form.Label>
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
              <Form.Label className="form-label-modern">DropOff Point</Form.Label>
              <Form.Control
                type="text"
                className="form-control-premium"
                name="dropOffPoint"
                value={form.dropOffPoint}
                onChange={handleChange}
                placeholder="DropOff Point"
              />
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Flight No</Form.Label>
              <Form.Control
                type="text"
                className="form-control-premium"
                name="flightNumber"
                value={form.flightNumber}
                onChange={handleChange}
                placeholder="Flight Number"
              />
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">
                {form.timeType === "arrival" ? "ETA" : "ETD"}
              </Form.Label>
              <Form.Control
                type="time"
                className="form-control-premium"
                name="time"
                value={form.time}
                onChange={handleChange}
              />
            </Form.Group>
          </Col>

          <Col md={12} className="d-flex gap-2">
            <Button
              type="submit"
              className="supplier-submit-btn"
              disabled={isSubmitting || isLoadingEdit}
            >
              {isSubmitting ? (
                <><Spinner animation="border" size="sm" className="me-2" />Saving...</>
              ) : isLoadingEdit ? (
                <><Spinner animation="border" size="sm" className="me-2" />Loading...</>
              ) : isEditing ? (
                <>Update &rarr;</>
              ) : (
                <>Add &rarr;</>
              )}
            </Button>
            {isEditing && (
              <Button
                type="button"
                variant="outline-secondary"
                disabled={isSubmitting}
                onClick={() => onCancelEdit && onCancelEdit()}
              >
                Cancel
              </Button>
            )}
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default OfflineCab;