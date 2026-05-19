import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Row,
  Col,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import {
  FaEdit,
  FaTrash,
  FaEye,
  FaPlus,
  FaDollarSign,
  FaBackward,
} from "react-icons/fa";

const SchefferDriverRates = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [cabProviderId, setCabProviderId] = useState(() => {
    const state = location.state;
    const id =
      state?.cabProviderId ??
      state?.cabProvider?.cabprovider ??
      state?.cabProvider?.cabproviderId ??
      state?.cabProvider?.id ??
      "";
    return String(id || "");
  });
  const [cabProviderName, setCabProviderName] = useState(
    () => location.state?.cabProviderName || ""
  );
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [marketTypeList, setMarketTypeList] = useState([]);
  const [cabFullList, setCabFullList] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});
  const [cabZonePickup, setCabZonePickup] = useState([]);
  const [cabZoneDropoff, setCabZoneDropoff] = useState([]);

  const fetchCabZone = async (cabId) => {
    if (!cabId) {
      setCabZonePickup([]);
      setCabZoneDropoff([]);
      return;
    }
    try {
      const res = await axiosInstance.get(`/api/scheffer-zones/by-cab/${cabId}`);
      const zone = res.data || {};
      setCabZonePickup(Array.isArray(zone.pickupLocations) ? zone.pickupLocations : []);
      setCabZoneDropoff(Array.isArray(zone.dropoffLocations) ? zone.dropoffLocations : []);
    } catch (err) {
      console.error("Error loading scheffer zone:", err);
      setCabZonePickup([]);
      setCabZoneDropoff([]);
    }
  };

  const [formData, setFormData] = useState({
    cabId: "",
    rateCode: "",
    marketType: [],
    cabProviderId: cabProviderId,
    cabratesId: "",
  });

  useEffect(() => {
    if (formData.cabId) fetchCabZone(formData.cabId);
    else {
      setCabZonePickup([]);
      setCabZoneDropoff([]);
    }
  }, [formData.cabId]);

  // Car Rental rows — daily-hours-based rate; has Hours field.
  const newCarRentalRow = (id) => ({
    id,
    pickupZoneLocationId: "",
    dropoffZoneLocationId: "",
    pickupTime: "",
    dropoffTime: "",
    minPax: "",
    maxPax: "",
    sicPerWay: "",
    privateTotal: "",
    privatePerPax: "",
    luggage: false,
    hours: "",
  });
  const [carRentalRows, setCarRentalRows] = useState([newCarRentalRow(1)]);

  const [validityDates, setValidityDates] = useState([
    { id: 1, validityFrom: "", validityTo: "" },
  ]);

  const openCreate = () => {
    setEditing(null);
    setIsViewMode(false);
    setValidationErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setIsViewMode(false);
    setValidationErrors({});
    setFormData({
      cabId: "",
      rateCode: "",
      marketType: [],
      cabProviderId: cabProviderId,
      cabratesId: "",
    });
    setCarRentalRows([newCarRentalRow(1)]);
    setCabZonePickup([]);
    setCabZoneDropoff([]);
    setValidityDates([{ id: 1, validityFrom: "", validityTo: "" }]);
  };

  const addCarRentalRow = () =>
    setCarRentalRows((prev) => [...prev, newCarRentalRow(Date.now())]);
  const removeCarRentalRow = (id) =>
    setCarRentalRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.id !== id) : prev
    );
  const updateCarRentalRow = (id, field, value) =>
    setCarRentalRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );

  const addValidityDate = () =>
    setValidityDates([
      ...validityDates,
      { id: Date.now(), validityFrom: "", validityTo: "" },
    ]);
  const removeValidityDate = (id) => {
    if (validityDates.length > 1)
      setValidityDates(validityDates.filter((d) => d.id !== id));
  };
  const updateValidityDate = (id, field, value) =>
    setValidityDates(
      validityDates.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );

  const updateFormData = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "cabId") {
      fetchCabZone(value);
      setCarRentalRows((rows) =>
        rows.map((row) => ({
          ...row,
          pickupZoneLocationId: "",
          dropoffZoneLocationId: "",
        }))
      );
    }
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = (data) => {
    const errs = {};
    const s = (v) => (v ? String(v).trim() : "");
    if (!s(data.cabId)) errs.cabId = "Cab is required";
    if (!s(data.rateCode)) errs.rateCode = "Rate code is required";
    if (!data.marketType || data.marketType.length === 0)
      errs.marketType = "Market is required";
    return errs;
  };

  const validateValidityDates = () => {
    const errors = [];
    validityDates.forEach((date, i) => {
      if (date.validityFrom && date.validityTo) {
        if (new Date(date.validityTo) <= new Date(date.validityFrom))
          errors.push(`Validity period ${i + 1}: "To" date must be after "From" date`);
      }
    });
    return errors;
  };

  const formatDateForAPI = (s) => {
    if (!s) return "";
    const d = new Date(s);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };
  const convertDateFromAPI = (s) => {
    if (!s) return "";
    const parts = s.split("/");
    if (parts.length === 3)
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    return s;
  };
  const getMinToDate = (fromDate) => {
    if (!fromDate) return "";
    const d = new Date(fromDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  const transformToPayload = () => ({
    marketype: formData.marketType,
    cabId: parseInt(formData.cabId) || 0,
    cabratesId: editing ? parseInt(editing.cabratesId) : null,
    rateCode: formData.rateCode,
    cabproviderId: formData.cabProviderId ? parseInt(formData.cabProviderId) : null,
    cabRateValidityDTOList: validityDates.map((d) => ({
      cabValidityId: editing ? d.cabValidityId || null : null,
      validityFrom: formatDateForAPI(d.validityFrom),
      validityTo: formatDateForAPI(d.validityTo),
    })),
    cabRateDetailsDTOList: carRentalRows.map((row) => ({
      minpax: parseInt(row.minPax) || 0,
      maxpax: parseInt(row.maxPax) || 0,
      locationId: 0,
      sicRate: parseFloat(row.sicPerWay) || 0,
      luggage: Boolean(row.luggage),
      hourDetails: row.hours || "",
      cabRatesdetailsId: editing ? row.cabRatesdetailsId || null : null,
      travelType: "2",
      pickupZoneLocationId: row.pickupZoneLocationId
        ? parseInt(row.pickupZoneLocationId)
        : null,
      dropoffZoneLocationId: row.dropoffZoneLocationId
        ? parseInt(row.dropoffZoneLocationId)
        : null,
      pickupTime: row.pickupTime || "",
      dropoffTime: row.dropoffTime || "",
      privateTotalRate:
        row.privateTotal !== "" && row.privateTotal != null
          ? parseFloat(row.privateTotal)
          : null,
      privatePerPaxRate:
        row.privatePerPax !== "" && row.privatePerPax != null
          ? parseFloat(row.privatePerPax)
          : null,
    })),
  });

  const rowInvalid = (row) =>
    !row.minPax ||
    !row.maxPax ||
    !row.sicPerWay ||
    !row.privateTotal ||
    !row.privatePerPax ||
    !row.hours;

  const saveRate = async () => {
    try {
      const errors = validateForm(formData);
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }
      if (!formData.cabProviderId) {
        toast.error("No Provider selected. Please navigate from registration page.");
        return;
      }
      if (validityDates.some((d) => !d.validityFrom || !d.validityTo)) {
        toast.error("Please fill in all validity date ranges");
        return;
      }
      const vErrs = validateValidityDates();
      if (vErrs.length > 0) {
        toast.error(vErrs[0]);
        return;
      }
      if (carRentalRows.some(rowInvalid)) {
        toast.error("Please fill in all rate grid fields (including Hours)");
        return;
      }
      setLoading(true);
      const response = await axiosInstance.post(
        "/api/SchefferDriverRates/register",
        transformToPayload()
      );
      if (response.data) {
        toast.success("Rate saved successfully!");
        closeModal();
        fetchRatesList(search);
      }
    } catch (error) {
      console.error("Error saving rate:", error);
      toast.error("Failed to save rate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateRate = async () => {
    try {
      const errors = validateForm(formData);
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }
      if (validityDates.some((d) => !d.validityFrom || !d.validityTo)) {
        toast.error("Please fill in all validity date ranges");
        return;
      }
      const vErrs = validateValidityDates();
      if (vErrs.length > 0) {
        toast.error(vErrs[0]);
        return;
      }
      if (carRentalRows.some(rowInvalid)) {
        toast.error("Please fill in all rate grid fields (including Hours)");
        return;
      }
      setLoading(true);
      const response = await axiosInstance.put(
        `/api/SchefferDriverRates/${editing.cabratesId}`,
        transformToPayload()
      );
      if (response.data) {
        toast.success("Rate updated successfully!");
        closeModal();
        fetchRatesList(search);
      }
    } catch (error) {
      console.error("Error updating rate:", error);
      toast.error("Failed to update rate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadMarketTypes = async () => {
    try {
      const r = await axiosInstance.get("/api/marketType");
      setMarketTypeList(r.data || []);
    } catch (e) {
      console.error("Error loading market types:", e);
    }
  };

  const fetchRatesList = async (s = "") => {
    if (!cabProviderId) {
      setRates([]);
      return;
    }
    try {
      setIsLoading(true);
      setRates([]);
      const r = await axiosInstance.get(`/api/SchefferDriverRates`, {
        params: { providerId: cabProviderId, page: 0, limit: 20, search: s || "" },
      });
      setRates(r.data || []);
    } catch (e) {
      console.error("Error loading scheffer rates:", e);
      setRates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const cabsList = async () => {
    if (!cabProviderId) return;
    try {
      const r = await axiosInstance.get(`/api/SchefferDriver/cabs/${cabProviderId}`);
      setCabFullList(r.data || []);
    } catch (e) {
      console.error("cabs list error:", e);
    }
  };

  useEffect(() => {
    loadMarketTypes();
  }, []);

  useEffect(() => {
    const state = location.state;
    const newId =
      state?.cabProviderId ??
      state?.cabProvider?.cabprovider ??
      state?.cabProvider?.cabproviderId ??
      state?.cabProvider?.id ??
      "";
    const newName = state?.cabProviderName || "";
    if (String(newId || "") !== String(cabProviderId || "") && String(newId || "") !== "") {
      setRates([]);
      setCabFullList([]);
      setSearch("");
      setCabProviderId(String(newId));
      setCabProviderName(newName);
    } else if (newName !== cabProviderName) {
      setCabProviderName(newName);
    }
  }, [location.state, location.key, cabProviderId, cabProviderName]);

  useEffect(() => {
    if (cabProviderId) {
      fetchRatesList();
      cabsList();
    } else {
      setRates([]);
      setCabFullList([]);
    }
  }, [cabProviderId]);

  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const t = setTimeout(() => fetchRatesList(search), 500);
    setSearchTimeout(t);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (cabProviderId)
      setFormData((prev) => ({ ...prev, cabProviderId: cabProviderId }));
  }, [cabProviderId]);

  const populateGridsFromRateDetails = (list) => {
    if (!Array.isArray(list) || list.length === 0) {
      setCarRentalRows([newCarRentalRow(1)]);
      return;
    }
    const rows = list.map((detail, index) => ({
      id: index + 1,
      minPax: detail.minpax != null ? detail.minpax.toString() : "",
      maxPax: detail.maxpax != null ? detail.maxpax.toString() : "",
      sicPerWay: detail.sicRate != null ? detail.sicRate.toString() : "",
      privateTotal:
        detail.privateTotalRate != null ? detail.privateTotalRate.toString() : "",
      privatePerPax:
        detail.privatePerPaxRate != null ? detail.privatePerPaxRate.toString() : "",
      luggage: detail.luggage || false,
      pickupZoneLocationId: detail.pickupZoneLocationId
        ? detail.pickupZoneLocationId.toString()
        : "",
      dropoffZoneLocationId: detail.dropoffZoneLocationId
        ? detail.dropoffZoneLocationId.toString()
        : "",
      pickupTime: detail.pickupTime || "",
      dropoffTime: detail.dropoffTime || "",
      cabRatesdetailsId: detail.cabRatesdetailsId || null,
      hours: detail.hourDetails || "",
    }));
    setCarRentalRows(rows.length > 0 ? rows : [newCarRentalRow(1)]);
  };

  const handleEdit = (rate) => {
    setEditing(rate);
    setIsViewMode(false);
    setShowModal(true);
    setFormData({
      cabId: rate.cabId ? rate.cabId.toString() : "",
      rateCode: rate.rateCode || "",
      marketType: rate.marketype || [],
      cabProviderId: rate.cabproviderId || cabProviderId,
      cabratesId: rate.cabratesId ? rate.cabratesId.toString() : "",
    });
    if (rate.cabId) fetchCabZone(rate.cabId);
    if (rate.cabRateValidityDTOList && rate.cabRateValidityDTOList.length > 0) {
      setValidityDates(
        rate.cabRateValidityDTOList.map((date, index) => ({
          id: index + 1,
          validityFrom: date.validityFrom ? convertDateFromAPI(date.validityFrom) : "",
          validityTo: date.validityTo ? convertDateFromAPI(date.validityTo) : "",
        }))
      );
    } else {
      setValidityDates([{ id: 1, validityFrom: "", validityTo: "" }]);
    }
    populateGridsFromRateDetails(rate.cabRateDetailsDTOList);
  };

  const handleView = (rate) => {
    handleEdit(rate);
    setIsViewMode(true);
  };

  const handleDelete = (rate) => {
    Swal.fire({
      title: `Are you sure? You want to delete rate: ${rate.rateCode}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axiosInstance.delete(`/api/SchefferDriverRates/${rate.cabratesId}`);
          toast.success("Rate deleted successfully");
          fetchRatesList(search);
        } catch (e) {
          console.error("Delete error:", e);
          toast.error("Failed to delete rate");
        }
      }
    });
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <div>
                <Button
                  variant="outline-primary"
                  onClick={() => navigate("/registration/schefferDriver")}
                  className="mb-2 me-3"
                  size="sm"
                >
                  <FaBackward className="me-2" />
                  Back to Scheffer Driver & Limousine
                </Button>
                <span className="fw-semibold">
                  <FaDollarSign className="me-2 text-success" />
                  Scheffer Driver & Limousine Rates
                  {cabProviderId ? (
                    <span className="text-muted ms-2">
                      (Provider ID: {cabProviderId})
                    </span>
                  ) : (
                    <span className="text-warning ms-2">(No Provider Selected)</span>
                  )}
                </span>
              </div>
              <div className="d-flex align-items-center gap-3">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search rates..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: "250px" }}
                />
                <Button className="btn-green" onClick={openCreate}>
                  + Create
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Rate Code</th>
                    <th>Provider</th>
                    <th>Cab</th>
                    <th>Market</th>
                    <th>Validity From</th>
                    <th>Validity To</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan="8" className="text-center text-muted py-4">
                        Loading rates...
                      </td>
                    </tr>
                  )}
                  {!isLoading && rates.length === 0 && (
                    <tr>
                      <td colSpan="8" className="text-center text-muted py-4">
                        No rates found. Click "Create" to add new rates.
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    rates.map((rate, index) => (
                      <tr key={rate.cabratesId || index}>
                        <td>{index + 1}</td>
                        <td>{rate.rateCode || "N/A"}</td>
                        <td>{cabProviderName || "N/A"}</td>
                        <td>{rate.cabId || "N/A"}</td>
                        <td>
                          {rate.marketype && rate.marketype.length > 0
                            ? rate.marketype.join(", ")
                            : "N/A"}
                        </td>
                        <td>
                          {rate.cabRateValidityDTOList?.[0]?.validityFrom || "N/A"}
                        </td>
                        <td>
                          {rate.cabRateValidityDTOList?.[0]?.validityTo || "N/A"}
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <FaEdit
                              className="text-primary"
                              style={{ cursor: "pointer", fontSize: "18px" }}
                              onClick={() => handleEdit(rate)}
                              title="Edit"
                            />
                            <FaEye
                              className="text-info"
                              style={{ cursor: "pointer", fontSize: "18px" }}
                              onClick={() => handleView(rate)}
                              title="View"
                            />
                            <FaTrash
                              className="text-danger"
                              style={{ cursor: "pointer", fontSize: "18px" }}
                              onClick={() => handleDelete(rate)}
                              title="Delete"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          <style>{`
            .scheffer-rate-modal-wide { max-width: 95vw; }
            .scheffer-rate-modal-wide .rate-grid-table { min-width: 1500px; }
            .scheffer-rate-modal-wide .rate-grid-table th,
            .scheffer-rate-modal-wide .rate-grid-table td { vertical-align: middle; }
          `}</style>
          <Modal
            show={showModal}
            onHide={closeModal}
            centered
            size="xl"
            dialogClassName="scheffer-rate-modal-wide"
          >
            <Modal.Header closeButton>
              <Modal.Title>
                {isViewMode
                  ? "View Scheffer Driver & Limousine Rate"
                  : editing
                  ? "Edit Scheffer Driver & Limousine Rate"
                  : "Save Scheffer Driver & Limousine Rate"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        Cab <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select
                        value={formData.cabId}
                        onChange={(e) => updateFormData("cabId", e.target.value)}
                        isInvalid={!!validationErrors.cabId}
                        disabled={isViewMode}
                      >
                        <option value="">SELECT</option>
                        {cabFullList.map((cab) => (
                          <option key={cab.cabId} value={cab.cabId}>
                            {cab.cabName}
                          </option>
                        ))}
                      </Form.Select>
                      {validationErrors.cabId && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.cabId}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        Rate code <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter rate code"
                        value={formData.rateCode}
                        onChange={(e) => updateFormData("rateCode", e.target.value)}
                        isInvalid={!!validationErrors.rateCode}
                        disabled={isViewMode}
                      />
                      {validationErrors.rateCode && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.rateCode}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        Market<span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select
                        value={formData.marketType[0] || ""}
                        onChange={(e) =>
                          updateFormData("marketType", [e.target.value])
                        }
                        isInvalid={!!validationErrors.marketType}
                        disabled={isViewMode}
                      >
                        <option value="">Select Market</option>
                        {marketTypeList.map((m) => (
                          <option key={m.marketTypeId} value={m.marketTypeId}>
                            {m.name}
                          </option>
                        ))}
                      </Form.Select>
                      {validationErrors.marketType && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.marketType}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                </Row>

                <div className="mb-3">
                  <h6 className="text-muted mb-3">Validity Periods</h6>
                  {validityDates.map((date) => (
                    <Row key={date.id} className="mb-2">
                      <Col md={5}>
                        <Form.Group>
                          <Form.Label>Validity From </Form.Label>
                          <Form.Control
                            type="date"
                            value={date.validityFrom}
                            onChange={(e) => {
                              updateValidityDate(date.id, "validityFrom", e.target.value);
                              if (date.validityTo && e.target.value && new Date(date.validityTo) <= new Date(e.target.value))
                                updateValidityDate(date.id, "validityTo", "");
                            }}
                            disabled={isViewMode}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={5}>
                        <Form.Group>
                          <Form.Label>Validity To </Form.Label>
                          <Form.Control
                            type="date"
                            value={date.validityTo}
                            min={getMinToDate(date.validityFrom)}
                            onChange={(e) =>
                              updateValidityDate(date.id, "validityTo", e.target.value)
                            }
                            disabled={isViewMode}
                          />
                        </Form.Group>
                      </Col>
                      {!isViewMode && (
                        <Col md={2}>
                          <div className="d-flex gap-1 mt-4">
                            <Button variant="outline-primary" size="sm" onClick={addValidityDate}>
                              <FaPlus size={10} />
                            </Button>
                            {validityDates.length > 1 && (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => removeValidityDate(date.id)}
                              >
                                <FaTrash size={10} />
                              </Button>
                            )}
                          </div>
                        </Col>
                      )}
                    </Row>
                  ))}
                </div>

                {/* ── Rate Grid — Car Rental (daily hours-based) ──────── */}
                <div className="border-top pt-3 mt-3">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="text-muted mb-0">Rate Grid — Car Rental</h6>
                    {!isViewMode && (
                      <Button variant="outline-primary" size="sm" onClick={addCarRentalRow}>
                        <FaPlus className="me-2" />
                        Add Row
                      </Button>
                    )}
                  </div>
                  <div className="table-responsive">
                    <Table striped bordered hover size="sm" className="rate-grid-table">
                      <thead className="table-light">
                        <tr>
                          <th style={{ minWidth: 170 }}>Pickup</th>
                          <th style={{ minWidth: 110 }}>Pickup Time</th>
                          <th style={{ minWidth: 170 }}>Dropoff</th>
                          <th style={{ minWidth: 110 }}>Dropoff Time</th>
                          <th style={{ minWidth: 80 }}>Min Pax</th>
                          <th style={{ minWidth: 80 }}>Max Pax</th>
                          <th style={{ minWidth: 110 }}>SIC</th>
                          <th style={{ minWidth: 130 }}>Private (Total)</th>
                          <th style={{ minWidth: 130 }}>Private Per Pax</th>
                          <th style={{ minWidth: 70 }}>Luggage</th>
                          <th style={{ minWidth: 110 }}>Hours</th>
                          {!isViewMode && <th style={{ minWidth: 90 }}>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {carRentalRows.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <Form.Select
                                size="sm"
                                value={row.pickupZoneLocationId || ""}
                                onChange={(e) =>
                                  updateCarRentalRow(row.id, "pickupZoneLocationId", e.target.value)
                                }
                                disabled={isViewMode || !formData.cabId}
                              >
                                <option value="">
                                  {!formData.cabId
                                    ? "Select cab first"
                                    : cabZonePickup.length === 0
                                    ? "No pickup zones"
                                    : "Select pickup"}
                                </option>
                                {cabZonePickup.map((loc) => (
                                  <option key={loc.id} value={loc.id}>
                                    {loc.locationName}
                                  </option>
                                ))}
                              </Form.Select>
                            </td>
                            <td>
                              <Form.Control
                                type="time"
                                size="sm"
                                value={row.pickupTime || ""}
                                onChange={(e) =>
                                  updateCarRentalRow(row.id, "pickupTime", e.target.value)
                                }
                                disabled={isViewMode}
                              />
                            </td>
                            <td>
                              <Form.Select
                                size="sm"
                                value={row.dropoffZoneLocationId || ""}
                                onChange={(e) =>
                                  updateCarRentalRow(row.id, "dropoffZoneLocationId", e.target.value)
                                }
                                disabled={isViewMode || !formData.cabId}
                              >
                                <option value="">
                                  {!formData.cabId
                                    ? "Select cab first"
                                    : cabZoneDropoff.length === 0
                                    ? "No dropoff zones"
                                    : "Select dropoff"}
                                </option>
                                {cabZoneDropoff.map((loc) => (
                                  <option key={loc.id} value={loc.id}>
                                    {loc.locationName}
                                  </option>
                                ))}
                              </Form.Select>
                            </td>
                            <td>
                              <Form.Control
                                type="time"
                                size="sm"
                                value={row.dropoffTime || ""}
                                onChange={(e) =>
                                  updateCarRentalRow(row.id, "dropoffTime", e.target.value)
                                }
                                disabled={isViewMode}
                              />
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                size="sm"
                                placeholder="Min"
                                value={row.minPax}
                                onChange={(e) =>
                                  updateCarRentalRow(row.id, "minPax", e.target.value)
                                }
                                disabled={isViewMode}
                              />
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                size="sm"
                                placeholder="Max"
                                value={row.maxPax}
                                onChange={(e) =>
                                  updateCarRentalRow(row.id, "maxPax", e.target.value)
                                }
                                disabled={isViewMode}
                              />
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                size="sm"
                                placeholder="SIC"
                                value={row.sicPerWay}
                                onChange={(e) =>
                                  updateCarRentalRow(row.id, "sicPerWay", e.target.value)
                                }
                                disabled={isViewMode}
                              />
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                size="sm"
                                placeholder="Total"
                                value={row.privateTotal || ""}
                                onChange={(e) =>
                                  updateCarRentalRow(row.id, "privateTotal", e.target.value)
                                }
                                disabled={isViewMode}
                              />
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                size="sm"
                                placeholder="Per Pax"
                                value={row.privatePerPax || ""}
                                onChange={(e) =>
                                  updateCarRentalRow(row.id, "privatePerPax", e.target.value)
                                }
                                disabled={isViewMode}
                              />
                            </td>
                            <td>
                              <Form.Check
                                type="checkbox"
                                checked={row.luggage}
                                onChange={(e) =>
                                  updateCarRentalRow(row.id, "luggage", e.target.checked)
                                }
                                disabled={isViewMode}
                              />
                            </td>
                            <td>
                              <Form.Select
                                size="sm"
                                value={row.hours || ""}
                                onChange={(e) =>
                                  updateCarRentalRow(row.id, "hours", e.target.value)
                                }
                                disabled={isViewMode}
                              >
                                <option value="">Select</option>
                                {Array.from({ length: 20 }, (_, i) => i + 1).map((h) => (
                                  <option key={h} value={h}>
                                    {h} Hour{h > 1 ? "s" : ""}
                                  </option>
                                ))}
                              </Form.Select>
                            </td>
                            {!isViewMode && (
                              <td>
                                <div className="d-flex gap-1">
                                  <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={addCarRentalRow}
                                  >
                                    <FaPlus size={10} />
                                  </Button>
                                  {carRentalRows.length > 1 && (
                                    <Button
                                      variant="outline-danger"
                                      size="sm"
                                      onClick={() => removeCarRentalRow(row.id)}
                                    >
                                      <FaTrash size={10} />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="danger" onClick={closeModal}>
                {isViewMode ? "Close" : "Cancel"}
              </Button>
              {!isViewMode && (
                <Button
                  variant="success"
                  onClick={editing ? updateRate : saveRate}
                  disabled={loading}
                >
                  {loading
                    ? editing
                      ? "Updating..."
                      : "Saving..."
                    : editing
                    ? "Update"
                    : "Create"}
                </Button>
              )}
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default SchefferDriverRates;
