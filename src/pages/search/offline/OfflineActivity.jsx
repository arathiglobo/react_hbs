import React, { useState, useEffect, useCallback } from "react";
import { Row, Col, Form, Button, Spinner } from "react-bootstrap";
import Select from "react-select";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import useOfflineLineEdit, { asText, supplierOptionFromLine } from "../../../hooks/useOfflineLineEdit";

// Travellers picker: adults and children on one activity (each 0–99, at
// least one traveller). Their sum is the line's quantity. Adults and children
// have their own prices (one tax %); the sub total is
// adult selling price × adults + child selling price × children.
const MAX_TRAVELLERS_EACH = 99;

const initialForm = {
  supplier: null,
  activity: "",
  date: "",
  pickupPoint: "",
  activityType: "",
  activityAdults: 1,
  activityChildren: 0,
  unitPrice: "", // adult
  tax: "0",
  sellingPrice: "", // adult
  childUnitPrice: "",
  childSellingPrice: "",
};

// Selling price = unit price + tax %, to 2 decimals; blank while no unit price.
const sellingFrom = (unitPrice, tax) =>
  unitPrice === "" || unitPrice == null
    ? ""
    : ((parseFloat(unitPrice) || 0) * (1 + (parseFloat(tax) || 0) / 100)).toFixed(2);

// "2 Adults, 1 Child" — the parts with a count only (the server builds the same text).
const travellerLabel = (adults, children) =>
  [
    adults > 0 ? `${adults} ${adults === 1 ? "Adult" : "Adults"}` : "",
    children > 0 ? `${children} ${children === 1 ? "Child" : "Children"}` : "",
  ]
    .filter(Boolean)
    .join(", ");

// A saved line's travellers. Lines saved before the picker have one
// traveller type ("adult" / "child") and its count.
const travellersFromLine = (l) => {
  if (l.activityAdults != null || l.activityChildren != null) {
    return { activityAdults: Number(l.activityAdults) || 0, activityChildren: Number(l.activityChildren) || 0 };
  }
  const count = Math.max(1, parseInt(l.activityTravellerCount, 10) || 1);
  return String(l.activityTraveller || "").toLowerCase() === "child"
    ? { activityAdults: 0, activityChildren: count }
    : { activityAdults: count, activityChildren: 0 };
};

// A saved activity line (GET /api/v1/offline-booking/line/{id}) → this form.
const formFromLine = (data) => {
  const l = data.line || {};
  const travellers = travellersFromLine(l);
  // An older children-only line kept the child's price as its only price.
  const legacyChildOnly =
    l.activityAdults == null && l.activityChildren == null && travellers.activityAdults === 0;
  return {
    supplier: supplierOptionFromLine(data),
    activity: l.activity || "",
    date: (data.isoDates || {}).date || "",
    pickupPoint: l.pickupPoint || "",
    activityType: l.activityType || "",
    ...travellers,
    unitPrice: legacyChildOnly ? "" : asText(l.unitPrice),
    tax: asText(l.tax, "0"),
    sellingPrice: legacyChildOnly ? "" : asText(l.sellingPrice),
    childUnitPrice: legacyChildOnly ? asText(l.unitPrice) : asText(l.childUnitPrice),
    childSellingPrice: legacyChildOnly ? asText(l.sellingPrice) : asText(l.childSellingPrice),
  };
};

// One − / + counter in the Travellers picker (the Search Guest picker's look).
function TravellerCounter({ label, sub, value, onChange }) {
  return (
    <div className="offline-traveller-row">
      <div>
        <span className="rgs-counter-title">{label}</span>
        <span className="rgs-counter-sub">{sub}</span>
      </div>
      <div className="offline-traveller-stepper">
        <button
          type="button"
          className="rgs-counter-btn"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          aria-label={`Fewer ${label.toLowerCase()}`}
        >
          −
        </button>
        <span className="rgs-counter-val">{value}</span>
        <button
          type="button"
          className="rgs-counter-btn"
          onClick={() => onChange(Math.min(MAX_TRAVELLERS_EACH, value + 1))}
          disabled={value >= MAX_TRAVELLERS_EACH}
          aria-label={`More ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

// editingEntry: a line-table row being edited (null = adding a new line).
// onCancelEdit: leave edit mode without saving.
const OfflineActivity = ({ mainBasicId, invoiceNo, onAdd, editingEntry, onCancelEdit }) => {
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
  const [travellersOpen, setTravellersOpen] = useState(false);
  const travellerCount = (form.activityAdults || 0) + (form.activityChildren || 0);

  const setTravellers = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors.travellers) setErrors((prev) => { const { travellers: _, ...rest } = prev; return rest; });
  };

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

  const hasAdults = (form.activityAdults || 0) > 0;
  const hasChildren = (form.activityChildren || 0) > 0;

  const handleUnitPriceChange = (e) => {
    const unitPrice = e.target.value;
    setForm((prev) => ({ ...prev, unitPrice, sellingPrice: sellingFrom(unitPrice, prev.tax) }));
    if (errors.unitPrice) setErrors((prev) => { const { unitPrice: _, ...rest } = prev; return rest; });
  };

  const handleChildUnitPriceChange = (e) => {
    const childUnitPrice = e.target.value;
    setForm((prev) => ({ ...prev, childUnitPrice, childSellingPrice: sellingFrom(childUnitPrice, prev.tax) }));
    if (errors.childUnitPrice) setErrors((prev) => { const { childUnitPrice: _, ...rest } = prev; return rest; });
  };

  // One tax % for adults and children: both selling prices follow it.
  const handleTaxChange = (e) => {
    const tax = e.target.value;
    setForm((prev) => ({
      ...prev,
      tax,
      sellingPrice: sellingFrom(prev.unitPrice, tax),
      childSellingPrice: sellingFrom(prev.childUnitPrice, tax),
    }));
  };

  const validate = () => {
    const e = {};
    if (!form.supplier) e.supplier = "Supplier is required";
    if (!form.activity.trim()) e.activity = "Activity is required";
    if (!form.date) e.date = "Date is required";
    if (travellerCount < 1) e.travellers = "Add at least one traveller (adult or child)";
    // Each traveller type on the activity needs its price.
    if (hasAdults && !String(form.unitPrice).trim()) e.unitPrice = "Adult Unit Price is required";
    if (hasChildren && !String(form.childUnitPrice).trim()) e.childUnitPrice = "Child Unit Price is required";
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
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      if (formErrors.travellers) setTravellersOpen(true);
      return;
    }

    setIsSubmitting(true);
    const payload = {
      // "0" adds a new line; an existing id updates that line in place.
      supplierActivityId: isEditing ? String(editData.line.supplierActivityId) : "0",
      supplierMainBasicId: String(mainBasicId),
      supplierId: String(form.supplier?.value),
      activity: form.activity,
      date: formatDatePayload(form.date),
      pickupPoint: form.pickupPoint,
      // Adult price (none without adults) and child price (none without children).
      unitPrice: hasAdults ? String(form.unitPrice) : null,
      tax: String(form.tax),
      sellingPrice: hasAdults ? String(form.sellingPrice) : null,
      childUnitPrice: hasChildren ? String(form.childUnitPrice) : null,
      childSellingPrice: hasChildren ? String(form.childSellingPrice) : null,
      invoiceNumber: invoiceNo,
      activityType: form.activityType,
      // Travellers picker; the server makes the count (adults + children,
      // the line's quantity) and the "2 Adults, 1 Child" text from these.
      activityAdults: form.activityAdults,
      activityChildren: form.activityChildren,
      activityTraveller: travellerLabel(form.activityAdults, form.activityChildren),
      activityTravellerCount: String(travellerCount),
    };

    try {
      const response = await axiosInstance.post(
        "/api/v1/offline-booking/activity/save",
        payload
      );
      if (response.data && response.data !== 0) {
        toast.success(isEditing ? "Activity details updated successfully" : "Activity details added successfully");
        if (onAdd) onAdd();
        setForm(initialForm);
        setErrors({});
        setTravellersOpen(false);
      } else {
        toast.error(isEditing ? "Failed to update activity details" : "Failed to add activity details");
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
      <h5 className="supplier-form-title">{isEditing ? "Edit Activity" : "Activity"}</h5>
      <Form onSubmit={handleSubmit}>
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
              <Form.Label className="form-label-modern">Activity <span className="text-danger">*</span></Form.Label>
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

          {/* Travellers — adults and children added together, like the
              Search Guest picker; their total is the line's quantity. */}
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Travellers <span className="text-danger">*</span></Form.Label>
              <Button
                variant="outline-primary"
                type="button"
                className={`w-100 text-start rooms-summary-btn-modern${errors.travellers ? " border-danger" : ""}`}
                onClick={() => setTravellersOpen((o) => !o)}
                aria-expanded={travellersOpen}
              >
                {travellerCount > 0
                  ? travellerLabel(form.activityAdults, form.activityChildren).replace(", ", " · ")
                  : "Add travellers"}
                <span className="float-end">{travellersOpen ? "▴" : "▾"}</span>
              </Button>
              {travellersOpen && (
                <div className="offline-traveller-panel">
                  <TravellerCounter
                    label="Adults"
                    sub="Age 18+"
                    value={form.activityAdults}
                    onChange={(v) => setTravellers("activityAdults", v)}
                  />
                  <TravellerCounter
                    label="Children"
                    sub="Age 0–17"
                    value={form.activityChildren}
                    onChange={(v) => setTravellers("activityChildren", v)}
                  />
                  <div className="d-flex justify-content-between align-items-center pt-1">
                    <span className="rgs-counter-sub">
                      Total: {travellerCount} traveller{travellerCount === 1 ? "" : "s"}
                    </span>
                    <Button variant="link" size="sm" className="p-0" onClick={() => setTravellersOpen(false)}>
                      Done
                    </Button>
                  </div>
                </div>
              )}
              {errors.travellers && <div className="text-danger small mt-1">{errors.travellers}</div>}
            </Form.Group>
          </Col>

          {/* Adults' price (not used when the activity has no adults). */}
          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">
                Adult Unit Price (in AED) {hasAdults && <span className="text-danger">*</span>}
              </Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                className={inputCls("unitPrice")}
                name="unitPrice"
                value={hasAdults ? form.unitPrice : ""}
                onChange={handleUnitPriceChange}
                placeholder={hasAdults ? "Adult Unit Price" : "No adults"}
                disabled={!hasAdults}
              />
              {errors.unitPrice && <div className="text-danger small mt-1">{errors.unitPrice}</div>}
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Additional Markup (%)</Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                className="form-control-premium"
                name="tax"
                value={form.tax}
                onChange={handleTaxChange}
                placeholder="Additional Markup"
              />
            </Form.Group>
          </Col>

          <Col lg={4} md={6}>
            <Form.Group>
              <Form.Label className="form-label-modern">Adult Selling Price (in AED)</Form.Label>
              <Form.Control
                type="number"
                className="form-control-premium"
                name="sellingPrice"
                value={hasAdults ? form.sellingPrice : ""}
                onChange={handleChange}
                placeholder={hasAdults ? "Adult Selling Price" : "No adults"}
                disabled={!hasAdults}
              />
            </Form.Group>
          </Col>

          {/* Children's own price, with the same Additional Markup (%) — only when the
              activity has children. */}
          {hasChildren && (
            <>
              <Col lg={4} md={6}>
                <Form.Group>
                  <Form.Label className="form-label-modern">
                    Child Unit Price (in AED) <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls("childUnitPrice")}
                    name="childUnitPrice"
                    value={form.childUnitPrice}
                    onChange={handleChildUnitPriceChange}
                    placeholder="Child Unit Price"
                  />
                  {errors.childUnitPrice && <div className="text-danger small mt-1">{errors.childUnitPrice}</div>}
                </Form.Group>
              </Col>

              <Col lg={4} md={6}>
                <Form.Group>
                  <Form.Label className="form-label-modern">Child Selling Price (in AED)</Form.Label>
                  <Form.Control
                    type="number"
                    className="form-control-premium"
                    name="childSellingPrice"
                    value={form.childSellingPrice}
                    onChange={handleChange}
                    placeholder="Child Selling Price"
                  />
                </Form.Group>
              </Col>
            </>
          )}

          <Col lg={4} md={12} className="d-flex align-items-end gap-2">
            <Button
              type="submit"
              className="supplier-submit-btn w-100"
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
                className="w-50"
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

export default OfflineActivity;
