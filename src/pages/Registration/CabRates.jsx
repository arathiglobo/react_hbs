import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Pagination,
  Row,
  Col,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import axios from "axios";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import {
  FaEdit,
  FaTrash,
  FaEye,
  FaPlus,
  FaDollarSign,
  FaLock,
  FaBackward,
} from "react-icons/fa";

const CabRates = () => {
  const navigate = useNavigate();
  const location = useLocation();
  console.log("location state:::", location.state);

  // Get cabProviderId from navigation state - make it reactive
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
  const [cabProviderName, setCabProviderName] = useState(() => {
    return location.state?.cabProviderName || "";
  });
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [marketTypeList, setMarketTypeList] = useState([]);
  const [cabFullList, setCabFullList] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});

  // Form state for modal
  const [formData, setFormData] = useState({
    cabId: "",
    rateCode: "",
    marketType: [],
    cabProviderId: cabProviderId,
    cabratesId: "",
  });

  // Rate Grid state
  const [rateGridRows, setRateGridRows] = useState([
    {
      id: 1,
      minPax: "",
      maxPax: "",
      location: "",
      sicPerWay: "",
      privatePerWay: "",
      luggage: false,
      type: "",
      hours: "",
    },
  ]);

  // Validity dates state
  const [validityDates, setValidityDates] = useState([
    {
      id: 1,
      validityFrom: "",
      validityTo: "",
    },
  ]);

  const openCreate = () => {
    setEditing(null);
    setIsViewMode(false);
    setValidationErrors({}); // Clear any existing validation errors
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setIsViewMode(false);
    // Clear validation errors
    setValidationErrors({});
    // Reset form data
    setFormData({
      cabId: "",
      rateCode: "",
      marketType: [],
      cabProviderId: cabProviderId,
      cabratesId: "",
    });
    // Reset rate grid
    setRateGridRows([
      {
        id: 1,
        minPax: "",
        maxPax: "",
        location: "",
        sicPerWay: "",
        privatePerWay: "",
        luggage: false,
        type: "",
        hours: "",
      },
    ]);
    // Reset validity dates
    setValidityDates([
      {
        id: 1,
        validityFrom: "",
        validityTo: "",
      },
    ]);
  };

  // Add new rate grid row
  const addRateGridRow = () => {
    const newRow = {
      id: Date.now(),
      minPax: "",
      maxPax: "",
      location: "",
      sicPerWay: "",
      privatePerWay: "",
      luggage: false,
      type: "",
      hours: "",
    };
    setRateGridRows([...rateGridRows, newRow]);
  };

  // Remove rate grid row
  const removeRateGridRow = (id) => {
    if (rateGridRows.length > 1) {
      setRateGridRows(rateGridRows.filter((row) => row.id !== id));
    }
  };

  // Update rate grid row
  const updateRateGridRow = (id, field, value) => {
    setRateGridRows(
      rateGridRows.map((row) => {
        if (row.id === id) {
          // If type is changed to Airport, clear the hours field
          if (field === "type" && value === "Airport") {
            return { ...row, [field]: value, hours: "" };
          }
          return { ...row, [field]: value };
        }
        return row;
      })
    );
  };

  // Add new validity date range
  const addValidityDate = () => {
    const newDate = {
      id: Date.now(),
      validityFrom: "",
      validityTo: "",
    };
    setValidityDates([...validityDates, newDate]);
  };

  // Remove validity date range
  const removeValidityDate = (id) => {
    if (validityDates.length > 1) {
      setValidityDates(validityDates.filter((date) => date.id !== id));
    }
  };

  // Update validity date
  const updateValidityDate = (id, field, value) => {
    setValidityDates(
      validityDates.map((date) =>
        date.id === id ? { ...date, [field]: value } : date
      )
    );
  };

  // Update form data
  const updateFormData = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear validation error when user makes changes
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  // Validation function
  const validateCabRateForm = (data) => {
    const newErrors = {};

    const getStringValue = (value) => {
      return value ? String(value).trim() : "";
    };

    // Required field validations
    if (!getStringValue(data.cabId)) newErrors.cabId = "Cab is required";
    if (!getStringValue(data.rateCode))
      newErrors.rateCode = "Rate code is required";
    if (!data.marketType || data.marketType.length === 0)
      newErrors.marketType = "Market is required";

    return newErrors;
  };

  // Validation function for validity dates
  const validateValidityDates = () => {
    const errors = [];
    
    validityDates.forEach((date, index) => {
      if (date.validityFrom && date.validityTo) {
        const fromDate = new Date(date.validityFrom);
        const toDate = new Date(date.validityTo);
        
        if (toDate <= fromDate) {
          errors.push(`Validity period ${index + 1}: "To" date must be after "From" date`);
        }
      }
    });
    
    return errors;
  };

  // Helper function to convert date from YYYY-MM-DD to DD/MM/YYYY
  const formatDateForAPI = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Helper function to convert date from DD/MM/YYYY to YYYY-MM-DD for form inputs
  const convertDateFromAPI = (dateString) => {
    if (!dateString) return "";
    // Split DD/MM/YYYY format
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return dateString;
  };

  // Helper function to get minimum date for "To" date (next day after "From" date)
  const getMinToDate = (fromDate) => {
    if (!fromDate) return "";
    const date = new Date(fromDate);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  };

  // Transform data to match API payload
  const transformToPayload = () => {
    const payload = {
      marketype: formData.marketType,
      cabId: parseInt(formData.cabId) || 0,
      cabratesId: editing ? parseInt(editing.cabratesId) : null,
      rateCode: formData.rateCode,
      cabproviderId: formData.cabProviderId ? parseInt(formData.cabProviderId) : null,
      cabRateValidityDTOList: validityDates.map((date) => ({
        cabValidityId: editing ? (date.cabValidityId || null) : null,
        validityFrom: formatDateForAPI(date.validityFrom),
        validityTo: formatDateForAPI(date.validityTo)
      })),
      cabRateDetailsDTOList: rateGridRows.map((row) => ({
        minpax: parseInt(row.minPax) || 0,
        maxpax: parseInt(row.maxPax) || 0,
        locationId: parseInt(row.location) || 0,
        sicRate: parseFloat(row.sicPerWay) || 0,
        privateRate: parseFloat(row.privatePerWay) || 0,
        luggage: Boolean(row.luggage),
        hourDetails: row.hours || "",
        cabRatesdetailsId: editing ? (row.cabRatesdetailsId || null) : null,
        travelType: row.type === "Daily" ? "2" : "1", // Daily = 2, Airport = 1
      })),
    };
    return payload;
  };

  // Save cab rate
  const saveCabRate = async () => {
    try {
      // Form validation
      const errors = validateCabRateForm(formData);
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      if (!formData.cabProviderId) {
        toast.error(
          "No Cab Provider selected. Please navigate from Cab Provider page."
        );
        return;
      }

      if (
        validityDates.some((date) => !date.validityFrom || !date.validityTo)
      ) {
        toast.error("Please fill in all validity date ranges");
        return;
      }

      // Validate validity dates
      const validityErrors = validateValidityDates();
      if (validityErrors.length > 0) {
        toast.error(validityErrors[0]);
        return;
      }

      if (
        rateGridRows.some(
          (row) =>
            !row.minPax ||
            !row.maxPax ||
            !row.location ||
            !row.sicPerWay ||
            !row.privatePerWay ||
            !row.type
        )
      ) {
        toast.error("Please fill in all rate grid fields");
        return;
      }

      const payload = transformToPayload();
      console.log("Payload:", JSON.stringify(payload, null, 2));
      console.log("Date format examples:");
      console.log(
        "validityFrom:",
        payload.cabRateValidityDTOList[0]?.validityFrom
      );
      console.log("validityTo:", payload.cabRateValidityDTOList[0]?.validityTo);

      setLoading(true);
      const response = await axiosInstance.post(
        "/api/cabRates/register",
        payload
      );

      if (response.data) {
        toast.success("Cab rate saved successfully!");
        closeModal();
        fetchCabRatesList(search);
      }
    } catch (error) {
      console.error("Error saving cab rate:", error);
      toast.error("Failed to save cab rate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadMarketTypes = async () => {
    try {
      const response = await axiosInstance.get("/api/marketType");
      setMarketTypeList(response.data || []);
    } catch (error) {
      console.error("Error loading market types:", error);
      // toast.error("Failed to load countries");
    }
  };

  // Fetch cab rates list
  const fetchCabRatesList = async (searchTerm = "") => {
  if (!cabProviderId) {
    setRates([]);
    return;
  }

  try {
    setIsLoading(true);
    setRates([]);

    const response = await axiosInstance.get(`/api/cabRates`, {
      params: {
        providerId: cabProviderId,
        page: 0,
        limit: 20,
        search: searchTerm || ""
      }
    });

    setRates(response.data || []);
    console.log("cab rates list ::", response.data);

  } catch (error) {
    console.error("Error loading cab rates:", error);
    setRates([]);
  } finally {
    setIsLoading(false);
  }
};


  
  //cab list 
  const cabsList = async () => {
    if (!cabProviderId) return;
    try {
   const cabList = await axiosInstance.get(`/api/cabProvider/cabs/${cabProviderId}`);
   console.log("cab list::", cabList.data);
   setCabFullList(cabList.data);
      
    } catch (error) {
      console.error("cab list error:", error);
     
    }
  };

  useEffect(() => {
    loadMarketTypes();
  }, []);

  // Update cabProviderId and cabProviderName when location.state changes
  useEffect(() => {
    const state = location.state;
    const newProviderId =
      state?.cabProviderId ??
      state?.cabProvider?.cabprovider ??
      state?.cabProvider?.cabproviderId ??
      state?.cabProvider?.id ??
      "";
    const newProviderName = state?.cabProviderName || "";

    // Normalize IDs to strings for comparison
    const normalizedNewId = String(newProviderId || "");
    const normalizedCurrentId = String(cabProviderId || "");

    // If provider ID changed, clear rates immediately and update state
    if (normalizedNewId !== normalizedCurrentId && normalizedNewId !== "") {
      setRates([]); // Clear rates immediately to prevent showing stale data
      setCabFullList([]); // Clear cab list as well
      setSearch(""); // Clear search term
      setCabProviderId(normalizedNewId);
      setCabProviderName(newProviderName);
    } else if (newProviderName !== cabProviderName) {
      setCabProviderName(newProviderName);
    }
  }, [location.state, location.key, cabProviderId, cabProviderName]);

  useEffect(() => {
    if (cabProviderId) {
      fetchCabRatesList();
      cabsList();
    } else {
      setRates([]);
      setCabFullList([]);
    }
  }, [cabProviderId]);

  // Search functionality
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      fetchCabRatesList(search);
    }, 500);

    setSearchTimeout(timeout);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [search]);

  // Update formData when cabProviderId changes
  useEffect(() => {
    if (cabProviderId) {
      console.log("Received cabProviderId:", cabProviderId);
      setFormData((prev) => ({ ...prev, cabProviderId: cabProviderId }));
    }
  }, [cabProviderId]);

  // Edit cab rate
  const handleEdit = (rate) => {
    console.log("Edit rate data:", rate);
    setEditing(rate);
    setIsViewMode(false);
    setShowModal(true);
    
    // Populate form with existing data - mapping API structure
    setFormData({
      cabId: rate.cabId ? rate.cabId.toString() : "",
      rateCode: rate.rateCode || "",
      marketType: rate.marketype || [],
      cabProviderId: rate.cabproviderId || cabProviderId,
      cabratesId: rate.cabratesId ? rate.cabratesId.toString() : ""
    });
    
    // Populate validity dates - mapping API structure
    if (rate.cabRateValidityDTOList && rate.cabRateValidityDTOList.length > 0) {
      const mappedValidityDates = rate.cabRateValidityDTOList.map((date, index) => ({
        id: index + 1,
        validityFrom: date.validityFrom ? convertDateFromAPI(date.validityFrom) : "",
        validityTo: date.validityTo ? convertDateFromAPI(date.validityTo) : ""
      }));
      setValidityDates(mappedValidityDates);
    } else {
      // Reset to default if no validity dates
      setValidityDates([{
        id: 1,
        validityFrom: "",
        validityTo: "",
      }]);
    }
    
    // Populate rate grid - mapping API structure
    if (rate.cabRateDetailsDTOList && rate.cabRateDetailsDTOList.length > 0) {
      const mappedRateGrid = rate.cabRateDetailsDTOList.map((detail, index) => ({
        id: index + 1,
        minPax: detail.minpax ? detail.minpax.toString() : "",
        maxPax: detail.maxpax ? detail.maxpax.toString() : "",
        location: detail.locationId ? detail.locationId.toString() : "",
        sicPerWay: detail.sicRate ? detail.sicRate.toString() : "",
        privatePerWay: detail.privateRate ? detail.privateRate.toString() : "",
        luggage: detail.luggage || false,
        type: detail.travelType === "2" ? "Daily" : "Airport",
        hours: detail.hourDetails || ""
      }));
      setRateGridRows(mappedRateGrid);
    } else {
      // Reset to default if no rate details
      setRateGridRows([{
        id: 1,
        minPax: "",
        maxPax: "",
        location: "",
        sicPerWay: "",
        privatePerWay: "",
        luggage: false,
        type: "",
        hours: "",
      }]);
    }
  };

  // View cab rate
  const handleView = (rate) => {
    setEditing(rate);
    setIsViewMode(true);
    setShowModal(true);
    
    // Populate form with existing data - mapping API structure (same as edit)
    setFormData({
      cabId: rate.cabId ? rate.cabId.toString() : "",
      rateCode: rate.rateCode || "",
      marketType: rate.marketype || [],
      cabProviderId: rate.cabproviderId || cabProviderId,
      cabratesId: rate.cabratesId ? rate.cabratesId.toString() : ""
    });
    
    // Populate validity dates - mapping API structure
    if (rate.cabRateValidityDTOList && rate.cabRateValidityDTOList.length > 0) {
      const mappedValidityDates = rate.cabRateValidityDTOList.map((date, index) => ({
        id: index + 1,
        validityFrom: date.validityFrom ? convertDateFromAPI(date.validityFrom) : "",
        validityTo: date.validityTo ? convertDateFromAPI(date.validityTo) : ""
      }));
      setValidityDates(mappedValidityDates);
    } else {
      setValidityDates([{
        id: 1,
        validityFrom: "",
        validityTo: "",
      }]);
    }
    
    // Populate rate grid - mapping API structure
    if (rate.cabRateDetailsDTOList && rate.cabRateDetailsDTOList.length > 0) {
      const mappedRateGrid = rate.cabRateDetailsDTOList.map((detail, index) => ({
        id: index + 1,
        minPax: detail.minpax ? detail.minpax.toString() : "",
        maxPax: detail.maxpax ? detail.maxpax.toString() : "",
        location: detail.locationId ? detail.locationId.toString() : "",
        sicPerWay: detail.sicRate ? detail.sicRate.toString() : "",
        privatePerWay: detail.privateRate ? detail.privateRate.toString() : "",
        luggage: detail.luggage || false,
        type: detail.travelType === "2" ? "Daily" : "Airport",
        hours: detail.hourDetails || ""
      }));
      setRateGridRows(mappedRateGrid);
    } else {
      setRateGridRows([{
        id: 1,
        minPax: "",
        maxPax: "",
        location: "",
        sicPerWay: "",
        privatePerWay: "",
        luggage: false,
        type: "",
        hours: "",
      }]);
    }
  };

  // Delete cab rate
  const handleDelete = (rate) => {

     Swal.fire({
      title: `Are you sure? You want to delete rate: ${rate.rateCode}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      customClass: {
        popup: "swal-small",
        title: "swal-small-title",
        htmlContainer: "swal-small-text",
      },
    }).then((result) => {
      if (result.isConfirmed) {
        deleteCabRate(rate.cabratesId);
      }
    });
  };

  // Delete API call
  const deleteCabRate = async (id) => {
    try {
      await axiosInstance.delete(`/api/cabRates/${id}`);
      toast.success("Cab rate deleted successfully");
      fetchCabRatesList(search);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(
        `Failed to delete cab rate: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  };

  // Update cab rate
  const updateCabRate = async () => {
    try {
      // Form validation
      const errors = validateCabRateForm(formData);
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      if (!formData.cabProviderId) {
        toast.error(
          "No Cab Provider selected. Please navigate from Cab Provider page."
        );
        return;
      }

      if (
        validityDates.some((date) => !date.validityFrom || !date.validityTo)
      ) {
        toast.error("Please fill in all validity date ranges");
        return;
      }

      // Validate validity dates
      const validityErrors = validateValidityDates();
      if (validityErrors.length > 0) {
        toast.error(validityErrors[0]);
        return;
      }

      if (
        rateGridRows.some(
          (row) =>
            !row.minPax ||
            !row.maxPax ||
            !row.location ||
            !row.sicPerWay ||
            !row.privatePerWay ||
            !row.type
        )
      ) {
        toast.error("Please fill in all rate grid fields");
        return;
      }

      const payload = transformToPayload();
      console.log("Update Payload:", JSON.stringify(payload, null, 2));

      setLoading(true);
      const response = await axiosInstance.put(
        `/api/cabRates/${editing.cabratesId}`,
        payload
      );

      if (response.data) {
        toast.success("Cab rate updated successfully!");
        closeModal();
        fetchCabRatesList(search);
      }
    } catch (error) {
      console.error("Error updating cab rate:", error);
      toast.error("Failed to update cab rate. Please try again.");
    } finally {
      setLoading(false);
    }
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
                  onClick={() => navigate("/registration/cabProvider")}
                  className="mb-2 me-3"
                  size="sm"
                >
                  <FaBackward className="me-2" />
                  Back to Cab Providers
                </Button>
                <span className="fw-semibold">
                  <FaDollarSign className="me-2 text-success" />
                  Cab Rates
                  {cabProviderId ? (
                    <span className="text-muted ms-2">
                      (Provider ID: {cabProviderId})
                    </span>
                  ) : (
                    <span className="text-warning ms-2">
                      (No Provider Selected)
                    </span>
                  )}
                </span>
              </div>
              <div className="d-flex align-items-center gap-3">
                <div className="position-relative">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search rates..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: "250px" }}
                  />
                  <i className="fas fa-search position-absolute top-50 end-0 translate-middle-y me-2 text-muted"></i>
                </div>
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
                    <th>Cab Provider</th>
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
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Loading cab rates...
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
                  {console.log("Rates:", rates)}
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
                          {rate.cabRateValidityDTOList?.[0]?.validityFrom ||
                            "N/A"}
                        </td>
                        <td>
                          {rate.cabRateValidityDTOList?.[0]?.validityTo ||
                            "N/A"}
                        </td>

                        <td>
                          <div className="d-flex gap-2">
                            <FaEdit
                              className="text-primary edit"
                              style={{ cursor: "pointer", fontSize: "18px" }}
                              onClick={() => handleEdit(rate)}
                              title="Edit"
                            />
                            <FaEye
                              className="text-info view"
                              style={{ cursor: "pointer", fontSize: "18px" }}
                              onClick={() => handleView(rate)}
                              title="View"
                            />
                            <FaTrash
                              className="text-danger delete"
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

          {/* Modal with exact fields from screenshot */}
          <Modal show={showModal} onHide={closeModal} centered size="xl">
            <Modal.Header closeButton>
              <Modal.Title>
                {isViewMode
                  ? "View Cab Rate"
                  : editing
                  ? "Edit Cab Rate"
                  : "Save Cab Rate"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                {/* Main Form Fields - Matching Screenshot */}
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        Cab <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select
                        value={formData.cabId}
                        onChange={(e) =>
                          updateFormData("cabId", e.target.value)
                        }
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
                        onChange={(e) =>
                          updateFormData("rateCode", e.target.value)
                        }
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
                        {marketTypeList.map((market) => (
                          <option
                            key={market.marketTypeId}
                            value={market.marketTypeId}
                          >
                            {market.name}
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

                {/* Multiple Validity Date Ranges */}
                <div className="mb-3">
                  <h6 className="text-muted mb-3">Validity Periods</h6>
                  {validityDates.map((date, index) => (
                    <Row key={date.id} className="mb-2">
                      <Col md={5}>
                        <Form.Group>
                          <Form.Label>Validity From </Form.Label>
                          <Form.Control
                            type="date"
                            value={date.validityFrom}
                            onChange={(e) => {
                              updateValidityDate(
                                date.id,
                                "validityFrom",
                                e.target.value
                              );
                              // Clear "To" date if it's before the new "From" date
                              if (date.validityTo && e.target.value && new Date(date.validityTo) <= new Date(e.target.value)) {
                                updateValidityDate(date.id, "validityTo", "");
                              }
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
                              updateValidityDate(
                                date.id,
                                "validityTo",
                                e.target.value
                              )
                            }
                            disabled={isViewMode}
                            placeholder={!date.validityFrom ? "Select From date first" : ""}
                          />
                          {!date.validityFrom && (
                            <Form.Text className="text-muted">
                              Please select "From" date first
                            </Form.Text>
                          )}
                        </Form.Group>
                      </Col>
                      {!isViewMode && (
                        <Col md={2}>
                          <div className="d-flex gap-1 mt-4">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={addValidityDate}
                              title="Add Validity Period"
                            >
                              <FaPlus size={10} />
                            </Button>
                            {validityDates.length > 1 && (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => removeValidityDate(date.id)}
                                title="Remove Validity Period"
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

                {/* Rate Grid Section */}
                <div className="border-top pt-3 mt-3">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="text-muted mb-0">Rate Grid</h6>
                    {!isViewMode && (
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={addRateGridRow}
                        title="Add Rate Grid Row"
                      >
                        <FaPlus className="me-2" />
                        Add Row
                      </Button>
                    )}
                  </div>
                  <div className="table-responsive">
                    <Table striped bordered hover size="sm">
                      <thead className="table-light">
                        <tr>
                          <th>Min Pax</th>
                          <th>Max Pax</th>
                          <th>Location</th>
                          <th>SIC (Per Way)</th>
                          <th>Private (Per Way)</th>
                          <th>Luggage</th>
                          <th>Type</th>
                          <th>Hours</th>
                          {!isViewMode && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {rateGridRows.map((row, index) => (
                          <tr key={row.id}>
                            <td>
                              <Form.Control
                                type="number"
                                size="sm"
                                placeholder="Min"
                                value={row.minPax}
                                onChange={(e) =>
                                  updateRateGridRow(
                                    row.id,
                                    "minPax",
                                    e.target.value
                                  )
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
                                  updateRateGridRow(
                                    row.id,
                                    "maxPax",
                                    e.target.value
                                  )
                                }
                                disabled={isViewMode}
                              />
                            </td>
                            <td>
                              <Form.Select
                                size="sm"
                                value={row.location}
                                onChange={(e) =>
                                  updateRateGridRow(
                                    row.id,
                                    "location",
                                    e.target.value
                                  )
                                }
                                disabled={isViewMode}
                              >
                                <option value="">Select an Option</option>
                                <option value="1">Airport to Hotel</option>
                                <option value="2">Hotel to Airport</option>
                              </Form.Select>
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                size="sm"
                                placeholder="SIC Rate"
                                value={row.sicPerWay}
                                onChange={(e) =>
                                  updateRateGridRow(
                                    row.id,
                                    "sicPerWay",
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                size="sm"
                                placeholder="Private Rate"
                                value={row.privatePerWay}
                                onChange={(e) =>
                                  updateRateGridRow(
                                    row.id,
                                    "privatePerWay",
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                            <td>
                              <Form.Check
                                type="checkbox"
                                checked={row.luggage}
                                onChange={(e) =>
                                  updateRateGridRow(
                                    row.id,
                                    "luggage",
                                    e.target.checked
                                  )
                                }
                                disabled={isViewMode}
                              />
                            </td>
                            <td>
                              <Form.Select
                                size="sm"
                                value={row.type}
                                onChange={(e) =>
                                  updateRateGridRow(
                                    row.id,
                                    "type",
                                    e.target.value
                                  )
                                }
                                disabled={isViewMode}
                              >
                                <option value="">Select Type</option>
                                <option value="Airport">Airport</option>
                                <option value="Daily">Daily</option>
                              </Form.Select>
                            </td>
                            <td>
                              <div className="position-relative">
                                <Form.Select
                                  size="sm"
                                  value={row.hours}
                                  disabled={row.type !== "Daily" || isViewMode}
                                  onChange={(e) =>
                                    updateRateGridRow(
                                      row.id,
                                      "hours",
                                      e.target.value
                                    )
                                  }
                                  className={
                                    row.type !== "Daily" ? "text-muted" : ""
                                  }
                                >
                                  <option value="">SELEC</option>
                                  <option value="1">1 Hour</option>
                                  <option value="2">2 Hours</option>
                                  <option value="3">3 Hours</option>
                                  <option value="4">4 Hours</option>
                                  <option value="5">5 Hours</option>
                                  <option value="6">6 Hours</option>
                                  <option value="7">7 Hours</option>
                                  <option value="8">8 Hours</option>
                                  <option value="9">9 Hours</option>
                                  <option value="10">10 Hours</option>
                                  <option value="11">11 Hours</option>
                                  <option value="12">12 Hours</option>
                                  <option value="13">13 Hours</option>
                                  <option value="14">14 Hours</option>
                                  <option value="15">15 Hours</option>
                                  <option value="16">16 Hours</option>
                                  <option value="17">17 Hours</option>
                                  <option value="18">18 Hours</option>
                                  <option value="19">19 Hours</option>
                                  <option value="20">20 Hours</option>
                                </Form.Select>
                                {row.type !== "Daily" && (
                                  <FaLock
                                    className="position-absolute top-50 end-0 translate-middle-y me-2 text-muted"
                                    size={12}
                                    style={{ pointerEvents: "none" }}
                                  />
                                )}
                              </div>
                            </td>
                            {!isViewMode && (
                              <td>
                                <div className="d-flex gap-1">
                                  <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={addRateGridRow}
                                    title="Clone Row"
                                  >
                                    <FaPlus size={10} />
                                  </Button>
                                  {rateGridRows.length > 1 && (
                                    <Button
                                      variant="outline-danger"
                                      size="sm"
                                      onClick={() => removeRateGridRow(row.id)}
                                      title="Remove Row"
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
                <i className="fas fa-times me-2"></i>
                {isViewMode ? "Close" : "Cancel"}
              </Button>
              {!isViewMode && (
                <Button
                  variant="success"
                  onClick={editing ? updateCabRate : saveCabRate}
                  disabled={loading}
                >
                  <i className="fas fa-arrow-right me-2"></i>
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

export default CabRates;
