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
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import {
  FaEdit,
  FaTrash,
  FaEye,
  FaPlus,
  FaDollarSign,
  FaBackward,
  FaCog,
} from "react-icons/fa";

const ActivityRates = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get providerId from navigation state
  const providerId = location.state?.activityProviderId || "";
  const providerName = location.state?.activityProviderName || "";

  console.log("providerId::" , providerId)
  console.log("providerName::" , providerName)
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [validationErrors, setValidationErrors] = useState({});

  // Dropdown data
  const [countries, setCountries] = useState([]);
  const [places, setPlaces] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [marketTypes, setMarketTypes] = useState([]);

  // Form state for modal
  const [formData, setFormData] = useState({
    activityName: "",
    activityCode: "",
    activityDetails: "",
    childAgeMin: "",
    childAgeMax: "",
    totalUsersAllowed: "",
    activityRate: "",
    maxPax: "",
    activityType: "",
    countryId: "",
    placeId: "",
    durationHr: "",
    durationMin: "",
    reportingPoint: "",
    rating: "",
    marketType: [],
  });

  // Validity dates state
  const [validityDates, setValidityDates] = useState([
    {
      id: 1,
      validityFrom: "",
      validityTo: "",
    },
  ]);

  // Fetch dropdown data
  const fetchDropdownData = async () => {
    try {
      const [countriesRes, placesRes, activityTypesRes, ratingsRes, marketTypesRes] = await Promise.all([
        axiosInstance.get("/api/country"),
        axiosInstance.get("/api/place"),
        axiosInstance.get("/api/activityType"),
        axiosInstance.get("/api/rating"),
        axiosInstance.get("/api/marketType"),
      ]);
      
      setCountries(countriesRes.data || []);
      setPlaces(placesRes.data || []);
      setActivityTypes(activityTypesRes.data || []);
      setRatings(ratingsRes.data || []);
      setMarketTypes(marketTypesRes.data || []);
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    }
  };

  // Fetch activity rates list
  const fetchActivityRatesList = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get(`/api/activityRates?providerId=${providerId}`);
      setRates(response.data || []);
    } catch (error) {
      console.error("Error fetching activity rates:", error);
      toast.error("Failed to fetch activity rates");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch places based on country
  const fetchPlaces = async (countryId) => {
    if (!countryId) {
      setPlaces([]);
      return;
    }
    
    try {
      const response = await axiosInstance.get(`/api/place?countryId=${countryId}`);
      setPlaces(response.data || []);
    } catch (error) {
      console.error("Error fetching places:", error);
      setPlaces([]);
    }
  };

  useEffect(() => {
    fetchActivityRatesList();
    fetchDropdownData();
  }, [providerId]);

  // Handle search with debounce
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    const timeout = setTimeout(() => {
      fetchActivityRatesList();
    }, 500);
    setSearchTimeout(timeout);
    return () => clearTimeout(timeout);
  }, [search]);

  const openCreate = () => {
    setEditing(null);
    setIsViewMode(false);
    setValidationErrors({});
    setFormData({
      activityName: "",
      activityCode: "",
      activityDetails: "",
      childAgeMin: "",
      childAgeMax: "",
      totalUsersAllowed: "",
      activityRate: "",
      maxPax: "",
      activityType: "",
      countryId: "",
      placeId: "",
      durationHr: "",
      durationMin: "",
      reportingPoint: "",
      rating: "",
      marketType: [],
    });
    setValidityDates([
      {
        id: 1,
        validityFrom: "",
        validityTo: "",
      },
    ]);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setIsViewMode(false);
    setValidationErrors({});
    setFormData({
      activityName: "",
      activityCode: "",
      activityDetails: "",
      childAgeMin: "",
      childAgeMax: "",
      totalUsersAllowed: "",
      activityRate: "",
      maxPax: "",
      activityType: "",
      countryId: "",
      placeId: "",
      durationHr: "",
      durationMin: "",
      reportingPoint: "",
      rating: "",
      marketType: [],
    });
    setValidityDates([
      {
        id: 1,
        validityFrom: "",
        validityTo: "",
      },
    ]);
  };

  const handleEdit = (item) => {
    setEditing(item);
    setIsViewMode(false);
    setFormData({
      activityName: item.activityName || "",
      activityCode: item.activityCode || "",
      activityDetails: item.activityDetails || "",
      childAgeMin: item.childAgeMin || "",
      childAgeMax: item.childAgeMax || "",
      totalUsersAllowed: item.totalUsersAllowed || "",
      activityRate: item.activityRate || "",
      maxPax: item.maxPax || "",
      activityType: item.activityType || "",
      countryId: item.countryId || "",
      placeId: item.placeId || "",
      durationHr: item.durationHr || "",
      durationMin: item.durationMin || "",
      reportingPoint: item.reportingPoint || "",
      rating: item.rating || "",
      marketType: item.marketType || [],
    });
    setValidityDates(item.validity || [
      {
        id: 1,
        validityFrom: "",
        validityTo: "",
      },
    ]);
    setValidationErrors({});
    setShowModal(true);
  };

  const handleView = (item) => {
    setEditing(item);
    setIsViewMode(true);
    setFormData({
      activityName: item.activityName || "",
      activityCode: item.activityCode || "",
      activityDetails: item.activityDetails || "",
      childAgeMin: item.childAgeMin || "",
      childAgeMax: item.childAgeMax || "",
      totalUsersAllowed: item.totalUsersAllowed || "",
      activityRate: item.activityRate || "",
      maxPax: item.maxPax || "",
      activityType: item.activityType || "",
      countryId: item.countryId || "",
      placeId: item.placeId || "",
      durationHr: item.durationHr || "",
      durationMin: item.durationMin || "",
      reportingPoint: item.reportingPoint || "",
      rating: item.rating || "",
      marketType: item.marketType || [],
    });
    setValidityDates(item.validity || [
      {
        id: 1,
        validityFrom: "",
        validityTo: "",
      },
    ]);
    setValidationErrors({});
    setShowModal(true);
  };

  const handleDelete = (item) => {
    Swal.fire({
      title: `Are you sure? You want to delete ${item.activityName}`,
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
        axiosInstance
          .delete(`/api/activityRates/${item.activityRateId}`)
          .then(() => {
            toast.success("Activity Rate deleted successfully");
            fetchActivityRatesList();
          })
          .catch((error) => {
            console.error("Delete error:", error);
            toast.error(`Failed to delete activity rate: ${error.response?.data?.message || error.message}`);
          });
      }
    });
  };

  const handleCountryChange = (e) => {
    const countryId = e.target.value;
    setFormData(prev => ({
      ...prev,
      countryId: countryId,
      placeId: ""
    }));
    if (countryId) {
      fetchPlaces(countryId);
    } else {
      setPlaces([]);
    }
  };

  const handleMarketChange = (e) => {
    const value = e.target.value;
    const checked = e.target.checked;
    
    setFormData(prev => ({
      ...prev,
      marketType: checked 
        ? [...prev.marketType, value]
        : prev.marketType.filter(m => m !== value)
    }));
  };

  const addValidityDate = () => {
    const newDate = {
      id: Date.now(),
      validityFrom: "",
      validityTo: "",
    };
    setValidityDates([...validityDates, newDate]);
  };

  const removeValidityDate = (id) => {
    if (validityDates.length > 1) {
      setValidityDates(validityDates.filter(date => date.id !== id));
    }
  };

  const updateValidityDate = (id, field, value) => {
    setValidityDates(validityDates.map(date => 
      date.id === id ? { ...date, [field]: value } : date
    ));
  };

  const validateForm = (data) => {
    const errors = {};
    
    if (!data.activityName?.trim()) errors.activityName = "Activity Name is required";
    if (!data.activityCode?.trim()) errors.activityCode = "Activity Code is required";
    if (!data.activityDetails?.trim()) errors.activityDetails = "Activity Details is required";
    if (!data.activityRate?.trim()) errors.activityRate = "Activity Rate is required";
    if (!data.maxPax?.trim()) errors.maxPax = "Max Pax is required";
    if (!data.activityType) errors.activityType = "Activity Type is required";
    if (!data.countryId) errors.countryId = "Country is required";
    if (!data.placeId) errors.placeId = "Place is required";
    if (!data.durationHr) errors.durationHr = "Duration Hours is required";
    if (!data.durationMin) errors.durationMin = "Duration Minutes is required";
    if (!data.reportingPoint?.trim()) errors.reportingPoint = "Reporting Point is required";
    if (!data.rating) errors.rating = "Rating is required";
    if (!data.marketType || data.marketType.length === 0) errors.marketType = "Market Type is required";
    
    return errors;
  };

  const formatDateForAPI = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const saveActivityRate = async (e) => {
    e.preventDefault();
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setIsLoading(true);
      
      const formDataPayload = new FormData();
      formDataPayload.append('providerId', providerId);
      formDataPayload.append('activityRateId', '');
      formDataPayload.append('activityName', formData.activityName);
      formDataPayload.append('activityCode', formData.activityCode);
      formDataPayload.append('activityDetails', formData.activityDetails);
      formDataPayload.append('childAgeMin', formData.childAgeMin);
      formDataPayload.append('childAgeMax', formData.childAgeMax);
      formDataPayload.append('totalUsersAllowed', formData.totalUsersAllowed);
      formDataPayload.append('activityRate', formData.activityRate);
      formDataPayload.append('maxPax', formData.maxPax);
      formDataPayload.append('activityType', formData.activityType);
      formDataPayload.append('countryId', formData.countryId);
      formDataPayload.append('placeId', formData.placeId);
      formDataPayload.append('durationHr', formData.durationHr);
      formDataPayload.append('durationMin', formData.durationMin);
      formDataPayload.append('reportingPoint', formData.reportingPoint);
      formDataPayload.append('rating', formData.rating);
      
      // Add market types
      formData.marketType.forEach((market, index) => {
        formDataPayload.append('marketType', market);
      });

      // Add validity dates
      validityDates.forEach((validity, index) => {
        formDataPayload.append(`validity[${index}].validityFrom`, formatDateForAPI(validity.validityFrom));
        formDataPayload.append(`validity[${index}].validityTo`, formatDateForAPI(validity.validityTo));
      });

      const response = await axiosInstance.post(
        "/api/activityRates/register",
        formDataPayload,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data) {
        toast.success("Activity Rate added successfully!");
        setValidationErrors({});
        await fetchActivityRatesList();
        closeModal();
      }
    } catch (error) {
      console.error("Save activity rate error:", error);
      toast.error(`Failed to save activity rate: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const updateActivityRate = async (e) => {
    e.preventDefault();
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (!editing) return;

    try {
      setIsLoading(true);
      
      const formDataPayload = new FormData();
      formDataPayload.append('providerId', providerId);
      formDataPayload.append('activityRateId', editing.activityRateId || '');
      formDataPayload.append('activityName', formData.activityName);
      formDataPayload.append('activityCode', formData.activityCode);
      formDataPayload.append('activityDetails', formData.activityDetails);
      formDataPayload.append('childAgeMin', formData.childAgeMin);
      formDataPayload.append('childAgeMax', formData.childAgeMax);
      formDataPayload.append('totalUsersAllowed', formData.totalUsersAllowed);
      formDataPayload.append('activityRate', formData.activityRate);
      formDataPayload.append('maxPax', formData.maxPax);
      formDataPayload.append('activityType', formData.activityType);
      formDataPayload.append('countryId', formData.countryId);
      formDataPayload.append('placeId', formData.placeId);
      formDataPayload.append('durationHr', formData.durationHr);
      formDataPayload.append('durationMin', formData.durationMin);
      formDataPayload.append('reportingPoint', formData.reportingPoint);
      formDataPayload.append('rating', formData.rating);
      
      // Add market types
      formData.marketType.forEach((market, index) => {
        formDataPayload.append('marketType', market);
      });

      // Add validity dates
      validityDates.forEach((validity, index) => {
        formDataPayload.append(`validity[${index}].validityFrom`, formatDateForAPI(validity.validityFrom));
        formDataPayload.append(`validity[${index}].validityTo`, formatDateForAPI(validity.validityTo));
      });

      const response = await axiosInstance.put(
        `/api/activityRates/${editing.activityRateId}`,
        formDataPayload,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data) {
        toast.success("Activity Rate updated successfully!");
        setValidationErrors({});
        await fetchActivityRatesList();
        closeModal();
      }
    } catch (error) {
      console.error("Update activity rate error:", error);
      toast.error(`Failed to update activity rate: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
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
                  onClick={() => navigate("/registration/activityProvider")}
                  className="mb-2 me-3"
                  size="sm"
                >
                  <FaBackward className="me-2" />
                  Back to Activity Providers
                </Button>
                <span className="fw-semibold">
                  <FaDollarSign className="me-2 text-success" />
                  Activity Rates
                  {providerId ? (
                    <span className="text-muted ms-2">
                      (Provider ID: {providerId})
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
                    <th>Activity Name</th>
                    <th>Activity Code</th>
                    <th style={{ width: 200 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate, index) => (
                    <tr key={rate.activityRateId || index}>
                      <td>{index + 1}</td>
                      <td>{rate.activityName}</td>
                      <td>{rate.activityCode}</td>
                      <td>{rate.activityRate}</td>
                      <td>{rate.maxPax}</td>
                      <td>{rate.durationHr}h {rate.durationMin}m</td>
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
                  {isLoading && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-4">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Loading activity rates...
                      </td>
                    </tr>
                  )}
                  {rates.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-4">
                        No activity rates found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {/* Modal */}
          <Modal show={showModal} onHide={closeModal} centered size="xl">
            <Modal.Header closeButton={!isLoading}>
              <Modal.Title>
                {isViewMode
                  ? "View Activity Rate"  
                  : editing
                  ? "Edit Activity Rate"
                  : "Create Activity Rate"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Row>
                  {/* Left Column */}
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        Activity Name <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.activityName}
                        onChange={(e) => setFormData(prev => ({ ...prev, activityName: e.target.value }))}
                        disabled={isViewMode}
                        isInvalid={!!validationErrors.activityName}
                      />
                      {validationErrors.activityName && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.activityName}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        Activity Code <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.activityCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, activityCode: e.target.value }))}
                        disabled={isViewMode}
                        isInvalid={!!validationErrors.activityCode}
                      />
                      {validationErrors.activityCode && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.activityCode}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        Activity Details <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={formData.activityDetails}
                        onChange={(e) => setFormData(prev => ({ ...prev, activityDetails: e.target.value }))}
                        disabled={isViewMode}
                        isInvalid={!!validationErrors.activityDetails}
                      />
                      {validationErrors.activityDetails && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.activityDetails}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>

                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Child Age Min</Form.Label>
                          <Form.Control
                            type="number"
                            value={formData.childAgeMin}
                            onChange={(e) => setFormData(prev => ({ ...prev, childAgeMin: e.target.value }))}
                            disabled={isViewMode}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Child Age Max</Form.Label>
                          <Form.Control
                            type="number"
                            value={formData.childAgeMax}
                            onChange={(e) => setFormData(prev => ({ ...prev, childAgeMax: e.target.value }))}
                            disabled={isViewMode}
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    <Form.Group className="mb-3">
                      <Form.Label>Total Users Allowed</Form.Label>
                      <Form.Control
                        type="number"
                        value={formData.totalUsersAllowed}
                        onChange={(e) => setFormData(prev => ({ ...prev, totalUsersAllowed: e.target.value }))}
                        disabled={isViewMode}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        Activity Rate <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="number"
                        value={formData.activityRate}
                        onChange={(e) => setFormData(prev => ({ ...prev, activityRate: e.target.value }))}
                        disabled={isViewMode}
                        isInvalid={!!validationErrors.activityRate}
                      />
                      {validationErrors.activityRate && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.activityRate}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        Max Pax <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="number"
                        value={formData.maxPax}
                        onChange={(e) => setFormData(prev => ({ ...prev, maxPax: e.target.value }))}
                        disabled={isViewMode}
                        isInvalid={!!validationErrors.maxPax}
                      />
                      {validationErrors.maxPax && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.maxPax}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        Activity Type <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select
                        value={formData.activityType}
                        onChange={(e) => setFormData(prev => ({ ...prev, activityType: e.target.value }))}
                        disabled={isViewMode}
                        isInvalid={!!validationErrors.activityType}
                      >
                        <option value="">SELECT</option>
                        {activityTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </Form.Select>
                      {validationErrors.activityType && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.activityType}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        Country <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select
                        value={formData.countryId}
                        onChange={handleCountryChange}
                        disabled={isViewMode}
                        isInvalid={!!validationErrors.countryId}
                      >
                        <option value="">SELECT</option>
                        {countries.map((country) => (
                          <option key={country.id} value={country.id}>
                            {country.name}
                          </option>
                        ))}
                      </Form.Select>
                      {validationErrors.countryId && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.countryId}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        Place <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select
                        value={formData.placeId}
                        onChange={(e) => setFormData(prev => ({ ...prev, placeId: e.target.value }))}
                        disabled={isViewMode || !formData.countryId}
                        isInvalid={!!validationErrors.placeId}
                      >
                        <option value="">SELECT</option>
                        {places.map((place) => (
                          <option key={place.id} value={place.id}>
                            {place.name}
                          </option>
                        ))}
                      </Form.Select>
                      {validationErrors.placeId && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.placeId}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>

                  {/* Right Column */}
                  <Col md={6}>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Duration Hours <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Select
                            value={formData.durationHr}
                            onChange={(e) => setFormData(prev => ({ ...prev, durationHr: e.target.value }))}
                            disabled={isViewMode}
                            isInvalid={!!validationErrors.durationHr}
                          >
                            <option value="">SELECT</option>
                            {[...Array(25)].map((_, i) => (
                              <option key={i} value={i}>{i}</option>
                            ))}
                          </Form.Select>
                          {validationErrors.durationHr && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.durationHr}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Duration Min <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Select
                            value={formData.durationMin}
                            onChange={(e) => setFormData(prev => ({ ...prev, durationMin: e.target.value }))}
                            disabled={isViewMode}
                            isInvalid={!!validationErrors.durationMin}
                          >
                            <option value="">SELECT</option>
                            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((min) => (
                              <option key={min} value={min}>{min}</option>
                            ))}
                          </Form.Select>
                          {validationErrors.durationMin && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.durationMin}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                    </Row>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        Reporting Point <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.reportingPoint}
                        onChange={(e) => setFormData(prev => ({ ...prev, reportingPoint: e.target.value }))}
                        disabled={isViewMode}
                        isInvalid={!!validationErrors.reportingPoint}
                      />
                      {validationErrors.reportingPoint && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.reportingPoint}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        Rating <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select
                        value={formData.rating}
                        onChange={(e) => setFormData(prev => ({ ...prev, rating: e.target.value }))}
                        disabled={isViewMode}
                        isInvalid={!!validationErrors.rating}
                      >
                        <option value="">SELECT</option>
                        {ratings.map((rating) => (
                          <option key={rating.id} value={rating.id}>
                            {rating.name}
                          </option>
                        ))}
                      </Form.Select>
                      {validationErrors.rating && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.rating}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        Market Type <span className="text-danger">*</span>
                      </Form.Label>
                      <div className="border rounded p-2" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                        {marketTypes.map((market) => (
                          <Form.Check
                            key={market.id}
                            type="checkbox"
                            id={`market-${market.id}`}
                            label={market.name}
                            value={market.id}
                            checked={formData.marketType.includes(String(market.id))}
                            onChange={handleMarketChange}
                            disabled={isViewMode}
                          />
                        ))}
                      </div>
                      {validationErrors.marketType && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.marketType}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Validity Periods</Form.Label>
                      <div className="d-flex gap-2 mb-2">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={addValidityDate}
                          disabled={isViewMode}
                        >
                          <FaPlus size={12} />
                          Add Validity Period
                        </Button>
                      </div>
                      {validityDates.map((date) => (
                        <div key={date.id} className="border rounded p-2 mb-2">
                          <Row>
                            <Col md={6}>
                              <Form.Label>Validity From</Form.Label>
                              <Form.Control
                                type="date"
                                value={date.validityFrom}
                                onChange={(e) => updateValidityDate(date.id, 'validityFrom', e.target.value)}
                                disabled={isViewMode}
                              />
                            </Col>
                            <Col md={6}>
                              <Form.Label>Validity To</Form.Label>
                              <div className="d-flex gap-2">
                                <Form.Control
                                  type="date"
                                  value={date.validityTo}
                                  onChange={(e) => updateValidityDate(date.id, 'validityTo', e.target.value)}
                                  disabled={isViewMode}
                                />
                                {!isViewMode && validityDates.length > 1 && (
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => removeValidityDate(date.id)}
                                  >
                                    <FaTrash size={10} />
                                  </Button>
                                )}
                              </div>
                            </Col>
                          </Row>
                        </div>
                      ))}
                    </Form.Group>
                  </Col>
                </Row>
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
                  onClick={editing ? updateActivityRate : saveActivityRate}
                  disabled={isLoading}
                >
                  <i className="fas fa-arrow-right me-2"></i>
                  {isLoading
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

export default ActivityRates;