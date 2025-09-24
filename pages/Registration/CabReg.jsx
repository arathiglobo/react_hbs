import React, { useEffect, useState } from "react";
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
} from "react-icons/fa";

// SearchableSelect Component (reused from AgentReg.jsx)
const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  className,
  isInvalid,
  name,
  disabled = false,
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
        // Handle different possible data structures
        const optionName =
          option.name ||
          option.countryName ||
          option.stateName ||
          option.placeName ||
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
      onChange({
        target: {
          name: name,
          value: option.id,
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
              selectedOption?.stateName ||
              selectedOption?.placeName ||
              ""
        }
        onChange={(e) => {
          if (disabled) return;
          if (isOpen) {
            setSearchTerm(e.target.value);
          } else {
            // If not open, open dropdown and set search term
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
          {filteredOptions.length > 0 ? (
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

const CabReg = () => {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [countries, setCountries] = useState([]);
  const [places, setPlaces] = useState([]);
  const [cabList, setCabList] = useState([]);
  const [formData, setFormData] = useState({
    cabProviderName: "",
    contactPerson: "",
    contactNumber: "",
    email: "",
    cabCode: "",
    cabName: "",
    countryId: "",
    placeId: "",
    pickup: "",
    dropOff: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Helper function to get form control props based on view mode
  const getFormControlProps = (
    fieldName,
    onChangeHandler,
    additionalProps = {}
  ) => {
    return {
      ...additionalProps,
      readOnly: isViewMode,
      onChange: isViewMode ? undefined : onChangeHandler,
      className: `${additionalProps.className || ""} ${
        isViewMode ? "bg-light" : ""
      }`.trim(),
      autoFocus: isViewMode ? false : additionalProps.autoFocus,
    };
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({
      cabProviderName: "",
      contactPerson: "",
      contactNumber: "",
        email: "",
      cabCode: "",
      cabName: "",
      countryId: "",
      placeId: "",
      pickup: "",
      dropOff: "",
    });
    setCabList([]);
    setPlaces([]);
    setValidationErrors({});
    setError("");
    setShowModal(true);
  };

  const openEdit = async (item) => {
    setEditing(item);
    setIsViewMode(false);

    setFormData({
      cabProviderName: item.cabProviderName || "",
      contactPerson: item.contactPerson || "",
      contactNumber: item.contactNumber || "",
      email: item.email || "",
      cabCode: item.cabCode || "",
      cabName: item.cabName || "",
      countryId: String(item.countryId || ""),
      placeId: String(item.placeId || ""),
      pickup: item.pickup || "",
      dropOff: item.dropOff || "",
    });

    setCabList(item.cabList || []);
    setPlaces([]);

    // Fetch cities for the selected country
    if (item.countryId) {
      try {
        await cityList(item.countryId);
      } catch (error) {
        console.error("Error loading cities:", error);
      }
    }

    setValidationErrors({});
    setShowModal(true);
  };

  const handleView = async (item) => {
    setEditing(item);
    setIsViewMode(true);

    setFormData({
      cabProviderName: item.cabProviderName || "",
      contactPerson: item.contactPerson || "",
      contactNumber: item.contactNumber || "",
      email: item.email || "",
      cabCode: item.cabCode || "",
      cabName: item.cabName || "",
      countryId: String(item.countryId || ""),
      placeId: String(item.placeId || ""),
      pickup: item.pickup || "",
      dropOff: item.dropOff || "",
    });

    setCabList(item.cabList || []);
    setPlaces([]);

    if (item.countryId) {
      try {
        await cityList(item.countryId);
      } catch (error) {
        console.error("Error loading cities:", error);
      }
    }

    setValidationErrors({});
    setShowModal(true);
  };

  const countryList = async () => {
    try {
      const response = await axios.get("/api/country");
      setCountries(response.data);
    } catch (error) {
      console.log("error for country list :", error);
    }
  };


  const cityList = async (countryId) => {
    try {
      const response = await axiosInstance.post(`/api/destination/getCitiesByCountryId/${countryId}`);
      setPlaces(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log("axios call error for city list : ", error);
    }
  };

  // Handle country change
  const handleCountryChange = (e) => {
    try {
      const value = e.target.value;
      const selectedCountry = countries.find(country => String(country.id) === String(value));
      const countryName = selectedCountry?.name || selectedCountry?.countryName || "Unknown";
      
      console.log(
        "Country selected:",
        value,
        "Country name:",
        countryName
      );
      
      setFormData((prev) => ({
        ...prev,
        countryId: String(value),
        placeId: "",
      }));
      
      setPlaces([]);
      
      if (value) {
        cityList(value);
      }
      
      // Clear validation error when user makes selection
      if (validationErrors.countryId) {
        setValidationErrors(prev => ({
          ...prev,
          countryId: ""
        }));
      }
    } catch (error) {
      console.error("Error in handleCountryChange:", error);
    }
  };

  // Handle place change
  const handlePlaceChange = (e) => {
    setFormData({
      ...formData,
      placeId: e.target.value,
    });
    // Clear validation error when user makes selection
    if (validationErrors.placeId) {
      setValidationErrors(prev => ({
        ...prev,
        placeId: ""
      }));
    }
  };

  useEffect(() => {
    if (formData.countryId) {
      if (!editing) {
        setPlaces([]);
        setFormData((prev) => ({
          ...prev,
          placeId: "",
        }));
      }
      cityList(formData.countryId);
    } else {
      setPlaces([]);
      setFormData((prev) => ({
        ...prev,
        placeId: "",
      }));
    }
  }, [formData.countryId]);

  useEffect(() => {
    if (formData.placeId) {
      if (!editing) {
        setPlaces([]);
        setFormData((prev) => ({
          ...prev,
          placeId: "",
        }));
      }
      cityList(formData.placeId);
    } else {
      setPlaces([]);
      setFormData((prev) => ({
        ...prev,
        placeId: "",
      }));
    }
  }, [formData.placeId]);

  // Add cab to list
  const addCabToList = () => {
    if (!formData.cabCode || !formData.cabName || !formData.countryId || !formData.placeId || !formData.pickup || !formData.dropOff) {
      toast.error("Please fill all cab details before adding to list");
      return;
    }

    const newCab = {
      id: Date.now(),
      cabCode: formData.cabCode,
      cabName: formData.cabName,
      countryId: formData.countryId,
      placeId: formData.placeId,
      pickup: formData.pickup,
      dropOff: formData.dropOff,
    };

    setCabList([...cabList, newCab]);
    
    // Clear cab form fields
    setFormData(prev => ({
      ...prev,
      cabCode: "",
      cabName: "",
      countryId: "",
      placeId: "",
      pickup: "",
      dropOff: "",
    }));
    setPlaces([]);
  };

  // Remove cab from list
  const removeCabFromList = (cabId) => {
    setCabList(cabList.filter(cab => cab.id !== cabId));
  };

  // Validation function
  const validateCabForm = (data) => {
    const newErrors = {};

    const getStringValue = (value) => {
      return value ? String(value).trim() : "";
    };

    // Required field validations
    if (!getStringValue(data.cabProviderName))
      newErrors.cabProviderName = "Cab Provider Name is required";
    if (!getStringValue(data.contactNumber))
      newErrors.contactNumber = "Contact Number is required";
    if (!getStringValue(data.email))
      newErrors.email = "Email ID is required";

    // Additional format validations
    const emailValue = getStringValue(data.email);
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue))
      newErrors.email = "Invalid email format";

    const mobileValue = getStringValue(data.contactNumber);
    if (mobileValue && !/^\+?\d{10,15}$/.test(mobileValue.replace(/\s/g, "")))
      newErrors.contactNumber = "Contact Number must be 10-15 digits";

    return newErrors;
  };

  const saveCab = async (e) => {
    e.preventDefault();
    const errors = validateCabForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (cabList.length === 0) {
      toast.error("Please add at least one cab to the list");
      return;
    }

    try {
      setIsLoading(true);

      const cabPayload = {
        cabProviderName: formData.cabProviderName,
        contactPerson: formData.contactPerson,
        contactNumber: formData.contactNumber,
        email: formData.email,
        cabList: cabList,
      };

      console.log("cabPayload:::", cabPayload);
      const cabSaveResponse = await axiosInstance.post(
        "/api/cab/register",
        cabPayload
      );

      if (cabSaveResponse.data) {
        toast.success("Cab Provider added Successfully!");
        setValidationErrors({});
        await fetchCabList(page, search);
        closeModal();
      }
    } catch (error) {
      console.error("Save cab error:", error);
      setError("Sorry! Data not saved to db..");
      toast.error(
        `Failed to save cab data: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async () => {
    const errors = validateCabForm(formData);
  if (Object.keys(errors).length > 0) {
    setValidationErrors(errors);
    return;
  }

  if (!editing) return;

  try {
    setIsLoading(true);

    const payload = {
        cabProviderName: formData.cabProviderName,
        contactPerson: formData.contactPerson,
        contactNumber: formData.contactNumber,
        email: formData.email,
        cabList: cabList,
    };

    console.log("Payload prepared for edit:", payload);

    const editRes = await axiosInstance.put(
        `/api/cab/${editing.id}`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (editRes.data) {
        toast.success("Cab Provider Updated Successfully!");
      setValidationErrors({});
        await fetchCabList(page, search);
      closeModal();
    }
  } catch (error) {
      console.error("Edit cab error:", error);
      setError("Failed to update cab provider");
    toast.error(
        `Failed to update cab provider: ${
        error.response?.data?.message || error.message
      }`
    );
  } finally {
    setIsLoading(false);
  }
};

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setIsViewMode(false);
    setFormData({
      cabProviderName: "",
      contactPerson: "",
      contactNumber: "",
        email: "",
      cabCode: "",
      cabName: "",
      countryId: "",
      placeId: "",
      pickup: "",
      dropOff: "",
    });
    setCabList([]);
    setPlaces([]);
    setValidationErrors({});
    setError("");
  };

  const fetchCabList = async (pageNum = 0, searchTerm = search) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });

      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      const res = await axiosInstance.get(`/api/cab?${params.toString()}`);

      if (res.data && Array.isArray(res.data)) {
        setItems(res.data);
        if (res.data.length < 10) {
          setTotalPages(pageNum + 1);
        } else {
          setTotalPages(Math.max(totalPages, pageNum + 2));
        }
        setPage(pageNum);
      } else {
        setItems([]);
        setTotalPages(0);
        setPage(0);
      }
    } catch (err) {
      toast.error("Failed to load cab providers");
      setItems([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCabList();
    countryList();
  }, []);

  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      fetchCabList(0, search);
    }, 500);
    setSearchTimeout(timeout);

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const handleDelete = (item) => {
    Swal.fire({
      title: `Are you sure? You want to delete ${item.cabProviderName}`,
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
          .delete(`/api/cab/${item.id}`)
          .then(() => {
            toast.success("Cab Provider deleted successfully");
            fetchCabList(page, search);
          })
          .catch(() => {
            toast.error("Sorry!! Cab Provider not deleted");
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
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Cab Providers</span>
              <Form.Group className="hotel-search-bar position-relative">
                <Form.Control
                  type="text"
                  placeholder="Search cab provider by name..."
                  className="form-control-modern-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchTerm(value);
                    setSearch(value);
                    setPage(0);
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y"
                    style={{
                      border: "none",
                      background: "none",
                      color: "#6c757d",
                      padding: "0 12px",
                      zIndex: 10,
                    }}
                    onClick={() => {
                      setSearchTerm("");
                      setSearch("");
                      setPage(0);
                    }}
                    title="Clear search"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </Form.Group>
              <Button className="btn-green" onClick={openCreate}>
                + Create
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Cab Provider Name</th>
                    <th>Contact Person</th>
                    <th>Contact Number</th>
                    <th>Email</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1 + page * 10}</td>
                      <td>{item.cabProviderName}</td>
                      <td>{item.contactPerson}</td>
                      <td>{item.contactNumber}</td>
                      <td>{item.email}</td>
                      <td>
                        <div className="d-flex gap-2">
                          <FaEdit
                            className="text-primary edit"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => openEdit(item)}
                            title="Edit"
                          />
                          <FaEye
                            className="text-info view"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleView(item)}
                            title="View"
                          />
                          <FaTrash
                            className="text-danger delete"
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
                      <td colSpan={6} className="text-center text-muted py-4">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Loading available cab providers...
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        No cab providers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <div>
                    <small className="text-muted">
                      Showing {items.length} of {totalPages * 10} cab providers
                    </small>
                  </div>
                  <div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 0}
                        onClick={() => fetchCabList(page - 1, search)}
                      />
                      {[...Array(totalPages).keys()].map((num) => (
                        <Pagination.Item
                          key={num}
                          active={num === page}
                          onClick={() => fetchCabList(num, search)}
                        >
                          {num + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page === totalPages - 1}
                        onClick={() => fetchCabList(page + 1, search)}
                      />
                    </Pagination>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          <Modal show={showModal} onHide={closeModal} centered size="lg">
            <Modal.Header closeButton={!isLoading}>
              <Modal.Title>
                {isViewMode
                  ? "View Details"
                  : editing
                  ? "Update Cab Provider"
                  : "Create Cab"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Card className="mb-3">
                  <Card.Header>Cab Provider Details</Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            <span style={{ color: 'red' }}>*</span>Cab Provider Name
                          </Form.Label>
                          <Form.Control
                            value={formData.cabProviderName}
                            placeholder="Enter cab provider name"
                            isInvalid={!!validationErrors.cabProviderName}
                            {...getFormControlProps(
                              "cabProviderName",
                              (e) => {
                                setFormData({
                                  ...formData,
                                  cabProviderName: e.target.value,
                                });
                                if (validationErrors.cabProviderName) {
                                  setValidationErrors(prev => ({
                                    ...prev,
                                    cabProviderName: ""
                                  }));
                                }
                              },
                              {
                                className: `form-input ${
                                  validationErrors.cabProviderName ? "is-invalid" : ""
                                }`,
                                autoFocus: true,
                              }
                            )}
                          />
                          {validationErrors.cabProviderName && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.cabProviderName}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Contact Person</Form.Label>
                          <Form.Control
                            value={formData.contactPerson}
                            placeholder="Enter contact person"
                            {...getFormControlProps(
                              "contactPerson",
                              (e) =>
                                setFormData({
                                  ...formData,
                                  contactPerson: e.target.value,
                                }),
                              {}
                            )}
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            <span style={{ color: 'red' }}>*</span>Contact Number
                          </Form.Label>
                          <Form.Control
                            value={formData.contactNumber}
                            placeholder="Enter contact number"
                            isInvalid={!!validationErrors.contactNumber}
                            {...getFormControlProps(
                              "contactNumber",
                              (e) => {
                                setFormData({
                                  ...formData,
                                  contactNumber: e.target.value,
                                });
                                if (validationErrors.contactNumber) {
                                  setValidationErrors(prev => ({
                                    ...prev,
                                    contactNumber: ""
                                  }));
                                }
                              },
                              {
                                className: `form-input ${
                                  validationErrors.contactNumber ? "is-invalid" : ""
                                }`,
                              }
                            )}
                          />
                          {validationErrors.contactNumber && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.contactNumber}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                          <Form.Label>
                            <span style={{ color: 'red' }}>*</span>Email
                          </Form.Label>
                              <Form.Control
                                value={formData.email}
                                placeholder="Enter email"
                                isInvalid={!!validationErrors.email}
                                {...getFormControlProps(
                                  "email",
                                  (e) => {
                                    setFormData({
                                      ...formData,
                                      email: e.target.value,
                                    });
                                    if (validationErrors.email) {
                                      setValidationErrors(prev => ({
                                        ...prev,
                                        email: ""
                                      }));
                                    }
                                  },
                                  {
                                    className: `form-input ${
                                      validationErrors.email ? "is-invalid" : ""
                                    }`,
                                  }
                                )}
                              />
                              {validationErrors.email && (
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors.email}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                    <Card className="mb-3">
                  <Card.Header>Cab List</Card.Header>
                      <Card.Body>
                        <Row>
                      <Col md={3}>
                            <Form.Group className="mb-3">
                          <Form.Label>
                            <span style={{ color: 'red' }}>*</span>Cab Code
                          </Form.Label>
                              <Form.Control
                            value={formData.cabCode}
                            placeholder="Enter cab code"
                                {...getFormControlProps(
                              "cabCode",
                              (e) =>
                                    setFormData({
                                      ...formData,
                                  cabCode: e.target.value,
                                }),
                              {}
                            )}
                          />
                            </Form.Group>
                          </Col>
                      <Col md={3}>
                            <Form.Group className="mb-3">
                          <Form.Label>
                            <span style={{ color: 'red' }}>*</span>Cab Name
                          </Form.Label>
                              <Form.Control
                            value={formData.cabName}
                            placeholder="Enter cab name"
                                {...getFormControlProps(
                              "cabName",
                                  (e) =>
                                    setFormData({
                                      ...formData,
                                  cabName: e.target.value,
                                    }),
                                  {}
                                )}
                              />
                            </Form.Group>
                          </Col>
                      <Col md={3}>
                            <Form.Group className="mb-3">
                          <Form.Label>
                            <span style={{ color: 'red' }}>*</span>Country
                          </Form.Label>
                          <SearchableSelect
                            name="countryId"
                            value={formData.countryId}
                            onChange={handleCountryChange}
                            placeholder="Search and select country"
                            options={countries}
                            isInvalid={!!validationErrors.countryId}
                            disabled={isViewMode}
                          />
                          {validationErrors.countryId && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.countryId}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            <span style={{ color: 'red' }}>*</span>Place
                          </Form.Label>
                          <SearchableSelect
                            name="placeId"
                            value={formData.placeId}
                            onChange={handlePlaceChange}
                            placeholder="Search and select place"
                            options={Array.isArray(places) ? places.map(place => ({ id: place.id, name: place.name })) : []}
                            isInvalid={!!validationErrors.placeId}
                            disabled={isViewMode || !formData.countryId}
                          />
                          {validationErrors.placeId && (
                                <Form.Control.Feedback type="invalid">
                              {validationErrors.placeId}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                    </Row>
                    <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                          <Form.Label>
                            <span style={{ color: 'red' }}>*</span>Pickup
                          </Form.Label>
                              <Form.Control
                            value={formData.pickup}
                            placeholder="Enter pickup location"
                                {...getFormControlProps(
                              "pickup",
                                  (e) =>
                                    setFormData({
                                      ...formData,
                                  pickup: e.target.value,
                                    }),
                                  {}
                                )}
                              />
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                          <Form.Label>
                            <span style={{ color: 'red' }}>*</span>Drop Off
                          </Form.Label>
                              <Form.Control
                            value={formData.dropOff}
                            placeholder="Enter drop off location"
                                {...getFormControlProps(
                              "dropOff",
                                  (e) =>
                                    setFormData({
                                      ...formData,
                                  dropOff: e.target.value,
                                    }),
                                  {}
                                )}
                              />
                            </Form.Group>
                          </Col>
                        </Row>
                    <div className="d-flex justify-content-end">
                      <Button
                        variant="primary"
                        onClick={addCabToList}
                        disabled={isViewMode}
                        className="d-flex align-items-center gap-2"
                      >
                        <FaPlus />
                        Add Cab
                      </Button>
                    </div>

                    {/* Display added cabs */}
                    {cabList.length > 0 && (
                      <div className="mt-3">
                        <h6>Added Cabs:</h6>
                        <div className="table-responsive">
                          <Table striped hover size="sm">
                            <thead>
                              <tr>
                                <th>Cab Code</th>
                                <th>Cab Name</th>
                                <th>Country</th>
                                <th>Place</th>
                                <th>Pickup</th>
                                <th>Drop Off</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cabList.map((cab) => (
                                <tr key={cab.id}>
                                  <td>{cab.cabCode}</td>
                                  <td>{cab.cabName}</td>
                                  <td>
                                    {countries.find(c => String(c.id) === String(cab.countryId))?.name || cab.countryId}
                                  </td>
                                  <td>
                                    {places.find(p => String(p.id) === String(cab.placeId))?.name || cab.placeId}
                                  </td>
                                  <td>{cab.pickup}</td>
                                  <td>{cab.dropOff}</td>
                                  <td>
                                    {!isViewMode && (
                                      <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => removeCabFromList(cab.id)}
                                      >
                                        <FaTrash />
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </div>
                    )}
                      </Card.Body>
                    </Card>
                {error && (
                  <Form.Control.Feedback type="invalid">
                    {error}
                  </Form.Control.Feedback>
                )}
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={closeModal}
                disabled={isLoading}
              >
                {isViewMode ? "Close" : "Cancel"}
              </Button>
              {!isViewMode && (
                <Button
                  className="btn-indigo"
                  onClick={editing ? handleEdit : saveCab}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      {editing ? "Updating..." : "Saving..."}
                    </>
                  ) : editing ? (
                    "Update"
                  ) : (
                    "Create"
                  )}
                </Button>
              )}
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default CabReg;