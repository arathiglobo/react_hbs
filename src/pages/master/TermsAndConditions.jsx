import React, { useEffect, useMemo, useState } from "react";
import { Card, Button, Table, Modal, Form, Pagination, Row, Col } from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import axios from "axios";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { FaEdit, FaTrash, FaTimes, FaCheck, FaUndo, FaEye } from "react-icons/fa";

// Enhanced SearchableSelect Component with loading support
const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  className,
  isInvalid,
  name,
  disabled = false,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOptions, setFilteredOptions] = useState(options || []);

  useEffect(() => {
    if (!options || !Array.isArray(options)) {
      setFilteredOptions([]);
      return;
    }

    if (searchTerm) {
      const filtered = options.filter((option) => {
        const optionName =
          option.name ||
          String(option);
        return optionName.toLowerCase().includes(searchTerm.toLowerCase());
      });
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [searchTerm, options]);

  const handleSelect = (option) => {
    try {
      console.log("Selecting option:", option);
      const value = option.id !== undefined ? option.id : option;
      onChange({
        target: {
          name: name,
          value: value,
        },
      });
      setIsOpen(false);
      setSearchTerm("");
    } catch (error) {
      console.error("Error in handleSelect:", error);
    }
  };

  const selectedOption = options?.find(
    (option) => String(option.id) === String(value)
  );

  return (
    <div className="position-relative">
      <Form.Control
        type="text"
        value={
          isOpen
            ? searchTerm
            : selectedOption?.name ||
             selectedOption?.countryName ||
             ""
        }
        onChange={(e) => {
          if (disabled) return;
          if (isOpen) {
            setSearchTerm(e.target.value);
          } else {
            setIsOpen(true);
            setSearchTerm(e.target.value);
          }
        }}
        onFocus={() => !disabled && setIsOpen(true)}
        placeholder={placeholder}
        className={`form-input ${isInvalid ? "is-invalid" : ""}`}
        disabled={disabled}
        readOnly={disabled}
        autoComplete="off"
      />

      {isOpen && !disabled && (
        <div
          className="position-absolute w-100 bg-white border border-top-0 rounded-bottom shadow-lg"
          style={{
            zIndex: 1050,
            maxHeight: "200px",
            overflowY: "auto",
            top: "100%",
          }}
        >
          {isLoading ? (
            <div className="px-3 py-2 text-center">
              <div
                className="spinner-border spinner-border-sm me-2"
                role="status"
              >
                <span className="visually-hidden">Loading...</span>
              </div>
              Loading...
            </div>
          ) : filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option.id}
                className="px-3 py-2 cursor-pointer"
                style={{
                  cursor: "pointer",
                  borderBottom: "1px solid #eee",
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#f8f9fa";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "white";
                }}
                onClick={() => handleSelect(option)}
              >
                {option.name ||
                  option.countryName ||
                  option.stateName ||
                  option.placeName ||
                  String(option)}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-muted">No options found</div>
          )}
        </div>
      )}

      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="position-fixed"
          style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1040,
          }}
          onClick={() => {
            setIsOpen(false);
            setSearchTerm("");
          }}
        />
      )}
    </div>
  );
};

export default function TermsAndConditions() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [countries, setCountries] = useState([]);
  const [places, setPlaces] = useState([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [formData, setFormData] = useState({
    descriptionType: "",
    termsCode: "",
    description: "",
    countryId: "",
    stateId: "",
    tagline: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState(null);

  // Description Type options
  const descriptionTypeOptions = [
    { id: 1, name: "Inclusion" },
    { id: 2, name: "Exclusion" },
    { id: 3, name: "Terms and Condition" }
  ];

  // Validation functions
  const validateForm = () => {
    const newErrors = {};

    // Description Type validation
    const descriptionTypeStr = String(formData.descriptionType || "");
    if (!formData.descriptionType || descriptionTypeStr.trim() === "") {
      newErrors.descriptionType = "Description Type is required";
    }

    // Terms Code validation
    const termsCodeStr = String(formData.termsCode || "");
    if (!formData.termsCode || termsCodeStr.trim() === "") {
      newErrors.termsCode = "Terms Code is required";
    } else if (termsCodeStr.trim().length < 2) {
      newErrors.termsCode = "Terms Code must be at least 2 characters long";
    } else if (termsCodeStr.trim().length > 20) {
      newErrors.termsCode = "Terms Code must not exceed 20 characters";
    }

    // Description validation
    const descriptionStr = String(formData.description || "");
    if (!formData.description || descriptionStr.trim() === "") {
      newErrors.description = "Description is required";
    } else if (descriptionStr.trim().length < 10) {
      newErrors.description = "Description must be at least 10 characters long";
    } else if (descriptionStr.trim().length > 500) {
      newErrors.description = "Description must not exceed 500 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearError = (fieldName) => {
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const nextId = useMemo(
    () => Math.max(0, ...items.map((i) => i.id)) + 1,
    [items]
  );

  const openCreate = () => {
    setEditing(null);
    setIsViewMode(false);
    setFormData({
      descriptionType: "",
      termsCode: "",
      description: "",
      countryId: "",
      stateId: "",
      tagline: ""
    });
    setPlaces([]);
    setError("");
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setIsViewMode(false);
    
    // Map backend data to form fields
    const descriptionTypeId = item.descriptionType || item.descriptionTypeId;
    const countryId = item.countryId || item.country;
    const stateId = item.stateId || item.state;
    
    setFormData({
      descriptionType: descriptionTypeId || "",
      termsCode: item.termsCode || "",
      description: item.description || "",
      countryId: countryId || "",
      stateId: stateId || "",
      tagline: item.tagline || ""
    });
    
    // Load places for the selected country if available
    if (countryId) {
      cityList(countryId);
    }
    
    setError("");
    setErrors({});
    setShowModal(true);
  };

  const openView = (item) => {
    setEditing(item);
    setIsViewMode(true);
    
    // Map backend data to form fields
    const descriptionTypeId = item.descriptionType || item.descriptionTypeId;
    const countryId = item.countryId || item.country;
    const stateId = item.stateId || item.state;
    
    setFormData({
      descriptionType: descriptionTypeId || "",
      termsCode: item.termsCode || "",
      description: item.description || "",
      countryId: countryId || "",
      stateId: stateId || "",
      tagline: item.tagline || ""
    });
    
    // Load places for the selected country if available
    if (countryId) {
      cityList(countryId);
    }
    
    setError("");
    setErrors({});
    setShowModal(true);
  };

  const handleEdit = async () => {
    if (!editing) return;

    // Validate form before submitting
    if (!validateForm()) {
      toast.error("Please fix the validation errors");
      return;
    }

    try {
      setIsLoading(true);
      
      const termsAndConditionPayload = {
        descriptionType: parseInt(formData.descriptionType),
        termsCode: String(formData.termsCode).trim(),
        description: String(formData.description).trim(),
        countryId: formData.countryId ? parseInt(formData.countryId) : null,
        stateId: formData.stateId ? parseInt(formData.stateId) : null,
        tagline: String(formData.tagline).trim()
      };

      const editRes = await axiosInstance.put(
        `/api/master/termsAndCondition/${editing.termsAndConditionsId}`,
        termsAndConditionPayload
      );

     if (editRes.data) {
        toast.success("Terms and Conditions Updated Successfully!");
        // First refresh the list
        await fetchTermsAndConditionsList(page, search);
        // Then close modal and reset state
        closeModal();
      }
    } catch (error) {
      setError("Failed to update terms and conditions");
      toast.error("Failed to update terms and conditions");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setIsViewMode(false);
    setFormData({
      descriptionType: "",
      termsCode: "",
      description: "",
      countryId: "",
      stateId: "",
      tagline: ""
    });
    setPlaces([]);
    setError("");
    setErrors({});
  };

  const fetchTermsAndConditionsList = async (pageNum = 0, searchTerm = search) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });

      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      const res = await axiosInstance.get(
        `/api/master/termsAndCondition?${params.toString()}`
      );
     
     // Check if response has data and pagination info
     if (res.data && Array.isArray(res.data)) {
        setItems(res.data);
        // Since backend doesn't return totalPages, we'll calculate it based on data length
        // If we get less than 10 items, it's likely the last page
        if (res.data.length < 10) {
          setTotalPages(pageNum + 1);
        } else {
          // If we get exactly 10 items, there might be more pages
          // We'll set a reasonable total or keep the current totalPages
          setTotalPages(Math.max(totalPages, pageNum + 2));
        }

        setPage(pageNum);
      } else {
        setItems([]);
        setTotalPages(0);
        setPage(0);
      }
    } catch (err) {
      toast.error("Failed to load terms and conditions");
      setItems([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTermsAndConditions = async () => {
    // Validate form before submitting
    if (!validateForm()) {
      toast.error("Please fix the validation errors");
      return;
    }

    try {
      setIsLoading(true);
      
      const termsAndConditionPayload = {
        descriptionType: parseInt(formData.descriptionType),
        termsCode: String(formData.termsCode).trim(),
        description: String(formData.description).trim(),
        countryId: formData.countryId ? parseInt(formData.countryId) : null,
        stateId: formData.stateId ? parseInt(formData.stateId) : null,
        tagline: String(formData.tagline).trim()
      };

      const termsAndConditionSaveRes = await axiosInstance.post(
        "/api/master/termsAndCondition/save",
        termsAndConditionPayload
      );
      if (termsAndConditionSaveRes.data) {
        toast.success("Terms and Conditions added Successfully!");
        // First refresh the list
        await fetchTermsAndConditionsList(page, search);
        // Then close modal
        closeModal();
      }
    } catch (error) {
      setError("Sorry! Data not saved to db..");
      toast.error("Failed to save terms and conditions data");
    } finally {
      setIsLoading(false);
    }
  };

  // Load countries list
  const countryList = async () => {
    try {
      const response = await axiosInstance.get("/api/country");
      setCountries(response.data);
    } catch (error) {
      console.log("error for country list :", error);
    }
  };

  const cityList = async (countryId) => {
    try {
      setIsLoadingPlaces(true);
      const response = await axiosInstance.post(`/api/destination/getCitiesByCountryId/${countryId}`);
      setPlaces(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log("axios call error for city list : ", error);
      setPlaces([]);
    } finally {
      setIsLoadingPlaces(false);
    }
  };

  // Handle country change
  const handleCountryChange = (e) => {
    try {
      const value = e.target.value;
      const stringValue = String(value);
      
      // Clear places and place selection when country changes
      setPlaces([]);
      setIsLoadingPlaces(false);
      
      setFormData((prev) => ({
        ...prev,
        countryId: stringValue,
        stateId: "", // Clear place selection
      }));
      
      // Fetch cities for the selected country
      if (value && stringValue.trim() !== "") {
        cityList(value);
      }
      
      // Clear validation errors
      if (errors.countryId) {
        setErrors(prev => ({
          ...prev,
          countryId: ""
        }));
      }
      if (errors.stateId) {
        setErrors(prev => ({
          ...prev,
          stateId: ""
        }));
      }
    } catch (error) {
      console.error("Error in handleCountryChange:", error);
    }
  };

  // Handle place change
  const handlePlaceChange = (e) => {
    const value = e.target.value;
    const stringValue = String(value);
    
    setFormData(prev => ({
      ...prev,
      stateId: stringValue,
    }));
    
    // Clear validation error when user makes selection
    if (errors.stateId) {
      setErrors(prev => ({
        ...prev,
        stateId: ""
      }));
    }
  };

  useEffect(() => {
    fetchTermsAndConditionsList();
    countryList();
  }, []);

  // Debounced search effect
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for search
    if (search !== "") {
      const timeout = setTimeout(() => {
        fetchTermsAndConditionsList(0, search);
      }, 500); // 500ms delay
      setSearchTimeout(timeout);
    } else if (search === "") {
      // If search is cleared, fetch all data
      fetchTermsAndConditionsList(0, "");
    }

    // Cleanup timeout on unmount
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const handleDelete = (item) => {
    console.log("delete item :::" , item);
    Swal.fire({
      title: `Are you sure? You want to delete ${item.termsCode} Terms and Conditions`,
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
          .delete(`/api/master/termsAndCondition/${item.termsAndConditionsId}`)
          .then(() => {
            toast.success("Terms and Conditions deleted successfully");
            fetchTermsAndConditionsList(page, search);
          })
          .catch(() => {
            toast.error("Sorry!! Terms and Conditions not deleted");
          });
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
            <Card.Header className="d-flex flex-column flex-sm-row gap-2 justify-content-between align-items-stretch align-items-sm-center">
              <div>
                <h4 className="fw-bold text-primary mb-0">Terms and Conditions</h4>
              </div>
              <div className="d-flex align-items-center gap-3">
               
                <Form.Group className="mb-0">
                  <Form.Control
                    type="text"
                    placeholder="Search"
                    className="form-control-sm"
                    value={searchTerm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchTerm(value);
                      fetchTermsAndConditionsList(0, value);
                    }}
                  />
                </Form.Group>
                <Button className="btn btn-success" onClick={openCreate}>
                  Create +
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S.N</th>
                    <th>Description</th>
                    <th>For</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.termsAndConditionsId}>
                      <td>{index + 1 + page * 10}</td>
                      <td>
                        <div>
                          <div className="fw-semibold">{item.termsCode}</div>
                          {item.description && (
                            <div className="text-muted small">
                              {item.description.length > 100 
                                ? `${item.description.substring(0, 100)}...` 
                                : item.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="fw-semibold">
                          {descriptionTypeOptions.find(dt => dt.id === item.descriptionType)?.name || 
                           'Unknown Type'}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <FaEye
                            className="text-info"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => openView(item)}
                            title="View"
                          />
                          <FaEdit
                            className="text-success"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => openEdit(item)}
                            title="Edit"
                          />
                          <FaTrash
                            className="text-danger"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleDelete(item)}
                            title="Delete"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {isLoading && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Loading available terms and conditions...
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        No terms and conditions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <div>
                    <small className="text-muted">
                      Showing {items.length} of {totalPages * 10} terms and conditions
                    </small>
                  </div>
                  <div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 0}
                        onClick={() => fetchTermsAndConditionsList(page - 1, search)}
                      />
                      {[...Array(totalPages).keys()].map((num) => (
                        <Pagination.Item
                          key={num}
                          active={num === page}
                          onClick={() => fetchTermsAndConditionsList(num, search)}
                        >
                          {num + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page === totalPages - 1}
                        onClick={() => fetchTermsAndConditionsList(page + 1, search)}
                      />
                    </Pagination>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          <Modal show={showModal} onHide={() => {}} centered backdrop="static" keyboard={false} size="lg">
            <Modal.Header className="bg-primary text-white">
              <Modal.Title className="fw-bold">
                {isViewMode ? "View Terms and Conditions" : editing ? "Edit Terms and Conditions" : "Save Terms and Conditions"}
              </Modal.Title>
              {!isViewMode && <div className="text-danger small">* mandatory fields</div>}
            </Modal.Header>
            <Modal.Body className="p-4">
              {isViewMode ? (
                <div>
                  <Row>
                    <Col md={6}>
                      <div className="mb-4">
                        <h6 className="fw-bold text-primary mb-2">Description Type</h6>
                        <div className="p-3 bg-light rounded border">
                          <span className="fw-semibold">
                            {descriptionTypeOptions.find(option => option.id === formData.descriptionType)?.name || 'Not specified'}
                          </span>
                        </div>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-4">
                        <h6 className="fw-bold text-primary mb-2">Terms Code</h6>
                        <div className="p-3 bg-light rounded border">
                          <span className="fw-semibold">
                            {formData.termsCode || 'Not specified'}
                          </span>
                        </div>
                      </div>
                    </Col>
                  </Row>
                  
                  <Row>
                    <Col md={6}>
                      <div className="mb-4">
                        <h6 className="fw-bold text-primary mb-2">Country</h6>
                        <div className="p-3 bg-light rounded border">
                          <span className="fw-semibold">
                            {countries.find(c => String(c.id) === String(formData.countryId))?.name || 
                             countries.find(c => String(c.id) === String(formData.countryId))?.countryName || 
                             'Not specified'}
                          </span>
                        </div>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-4">
                        <h6 className="fw-bold text-primary mb-2">Place</h6>
                        <div className="p-3 bg-light rounded border">
                          <span className="fw-semibold">
                            {places.find(p => String(p.id) === String(formData.stateId))?.name || 
                             places.find(p => String(p.id) === String(formData.stateId))?.cityName || 
                             'Not specified'}
                          </span>
                        </div>
                      </div>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={12}>
                      <div className="mb-4">
                        <h6 className="fw-bold text-primary mb-2">Tagline</h6>
                        <div className="p-3 bg-light rounded border">
                          <span className="fw-semibold">
                            {formData.tagline || 'Not specified'}
                          </span>
                        </div>
                      </div>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={12}>
                      <div className="mb-4">
                        <h6 className="fw-bold text-primary mb-2">Description</h6>
                        <div className="p-3 bg-light rounded border" style={{ minHeight: '120px' }}>
                          <span className="fw-semibold">
                            {formData.description || 'Not specified'}
                          </span>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              ) : (
                <Form>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold">
                          * Description Type
                        </Form.Label>
                        <Form.Select
                          value={formData.descriptionType}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, descriptionType: e.target.value }));
                            clearError('descriptionType');
                          }}
                          isInvalid={!!errors.descriptionType}
                        >
                          <option value="">SELECT</option>
                          {descriptionTypeOptions.map(option => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </Form.Select>
                        {errors.descriptionType && (
                          <Form.Control.Feedback type="invalid">
                            {errors.descriptionType}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold">
                          * Terms Code
                        </Form.Label>
                        <Form.Control
                          value={formData.termsCode}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, termsCode: e.target.value }));
                            clearError('termsCode');
                          }}
                          placeholder="Enter terms code"
                          autoFocus
                          isInvalid={!!errors.termsCode}
                          maxLength={20}
                        />
                        <Form.Text className="text-muted">
                          {formData.termsCode.length}/20 characters
                        </Form.Text>
                        {errors.termsCode && (
                          <Form.Control.Feedback type="invalid">
                            {errors.termsCode}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">
                      * Description
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      value={formData.description}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, description: e.target.value }));
                        clearError('description');
                      }}
                      placeholder="Enter terms and conditions description"
                      isInvalid={!!errors.description}
                      maxLength={500}
                    />
                    <Form.Text className="text-muted">
                      {formData.description.length}/500 characters
                    </Form.Text>
                    {errors.description && (
                      <Form.Control.Feedback type="invalid">
                        {errors.description}
                      </Form.Control.Feedback>
                    )}
                  </Form.Group>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold">
                          Country
                        </Form.Label>
                        <SearchableSelect
                          name="countryId"
                          value={formData.countryId}
                          onChange={handleCountryChange}
                          placeholder="SELECT"
                          options={countries}
                          isInvalid={!!errors.countryId}
                        />
                        {errors.countryId && (
                          <Form.Control.Feedback type="invalid">
                            {errors.countryId}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold">
                          Place
                        </Form.Label>
                        <SearchableSelect
                          name="stateId"
                          value={formData.stateId}
                          onChange={handlePlaceChange}
                          placeholder={isLoadingPlaces ? "Loading places..." : "SELECT"}
                          options={Array.isArray(places) ? places.map(place => ({ id: place.id, name: place.name })) : []}
                          isInvalid={!!errors.stateId}
                          disabled={!formData.countryId || isLoadingPlaces}
                          isLoading={isLoadingPlaces}
                        />
                        {errors.stateId && (
                          <Form.Control.Feedback type="invalid">
                            {errors.stateId}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">
                      Tagline
                    </Form.Label>
                    <Form.Control
                      value={formData.tagline}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, tagline: e.target.value }));
                        clearError('tagline');
                      }}
                      placeholder="Enter tagline (optional)"
                      maxLength={100}
                    />
                    <Form.Text className="text-muted">
                      {formData.tagline.length}/100 characters
                    </Form.Text>
                  </Form.Group>

                  {error && (
                    <div className="alert alert-danger" role="alert">
                      {error}
                    </div>
                  )}
                </Form>
              )}
            </Modal.Body>
            <Modal.Footer className="d-flex justify-content-between">
              {isViewMode ? (
                <Button
                  variant="secondary"
                  onClick={closeModal}
                  className="d-flex align-items-center gap-2"
                >
                  <FaTimes />
                  Close
                </Button>
              ) : (
                <>
                  <Button
                    variant="danger"
                    onClick={closeModal}
                    disabled={isLoading}
                    className="d-flex align-items-center gap-2"
                  >
                    <FaTimes />
                    Cancel
                  </Button>
                  <div className="d-flex gap-2">
                    <Button
                      variant="success"
                      onClick={editing ? handleEdit : saveTermsAndConditions}
                      disabled={isLoading}
                      className="d-flex align-items-center gap-2"
                    >
                      <FaCheck />
                      {isLoading ? (editing ? "Updating..." : "Saving...") : (editing ? "Update" : "Create")}
                    </Button>
                    <Button
                      variant="info"
                      onClick={() => {
                        setFormData({
                          descriptionType: "",
                          termsCode: "",
                          description: "",
                          countryId: "",
                          stateId: "",
                          tagline: ""
                        });
                        setPlaces([]);
                        setErrors({});
                      }}
                      disabled={isLoading}
                      className="d-flex align-items-center gap-2"
                    >
                      <FaUndo />
                      Reset
                    </Button>
                  </div>
                </>
              )}
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
