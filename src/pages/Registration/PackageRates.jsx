import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Row,
  Col,
  FormCheck,
  Pagination,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { FaEdit, FaTrash, FaPlus, FaBackward, FaCopy } from "react-icons/fa";

const PackageRates = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [countries, setCountries] = useState([]);
  const [places, setPlaces] = useState([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [validityList, setValidityList] = useState([
    {
      id: Date.now(),
      validityFrom: "",
      validityTo: ""
    }
  ]);
  const [occupancyList, setOccupancyList] = useState([
    {
      id: Date.now(),
      minimumPax: "",
      maximumPax: ""
    }
  ]);
  const [selectedSharingTypes, setSelectedSharingTypes] = useState([]);
  const [packageCategories, setPackageCategories] = useState([]);
  const [isLoadingPackageCategories, setIsLoadingPackageCategories] = useState(false);
  const [isAddingValidity, setIsAddingValidity] = useState(false);
  const [isAddingOccupancy, setIsAddingOccupancy] = useState(false);
  
  // Refs to track last execution time
  const lastValidityAddTime = useRef(0);
  const lastOccupancyAddTime = useRef(0);

  const [formData, setFormData] = useState({
    rateCode: "",
    market: "",
    countryId: "",
    placeId: "",
    noOfNights: "",
    sharingTypes: {},
    rates: {}
  });

  // Get package info from navigation state
  const packageInfo = location.state || {};
  const packageId = packageInfo.packageId || 0;
  const packageName = packageInfo.packageName || "Unknown Package";
  const packageCode = packageInfo.packageCode || "Unknown";
  
  // Debug logging
  //console.log("PackageRates - Navigation state:", location.state);
  //console.log("PackageRates - Package info:", packageInfo);
  //console.log("PackageRates - Package ID:", packageId);

  const validateForm = (data) => {
    const errors = {};
    
    if (!data.rateCode?.trim()) errors.rateCode = "Rate code is required";
    if (!data.market?.trim()) errors.market = "Market is required";
    if (!data.countryId?.trim()) errors.countryId = "Country is required";
    if (!data.placeId?.trim()) errors.placeId = "Place is required";
    if (!data.noOfNights?.trim()) errors.noOfNights = "No of nights is required";
    
    // Validate validity list
    const invalidValidity = validityList.some(v => !v.validityFrom || !v.validityTo);
    if (invalidValidity) errors.validityList = "All validity periods must have from and to dates";
    
    // Validate occupancy list
    const invalidOccupancy = occupancyList.some(o => !o.minimumPax || !o.maximumPax);
    if (invalidOccupancy) errors.occupancyList = "All occupancy must have minimum and maximum pax";
    
    // Validate at least one sharing type is selected
    const hasSelectedSharingType = Object.values(data.sharingTypes).some(selected => selected === true);
    if (!hasSelectedSharingType) {
      errors.sharingTypes = "At least one sharing type must be selected";
    }
    
    return errors;
  };

  const handleCreate = () => {
    setEditing(null);
    
    // Initialize dynamic sharing types based on package categories
    const dynamicSharingTypes = {};
    const dynamicRates = {};
    
    packageCategories.forEach(category => {
      const key = category.packageCategoryId.toString();
      dynamicSharingTypes[key] = false;
      dynamicRates[key] = {
        adultRate: "",
        childWithBed: "",
        childWithoutBed: ""
      };
    });
    
    setFormData({
      rateCode: "",
      market: "",
      countryId: "",
      placeId: "",
      noOfNights: "",
      sharingTypes: dynamicSharingTypes,
      rates: dynamicRates
    });
    setValidityList([{
      id: Date.now(),
      validityFrom: "",
      validityTo: ""
    }]);
    setOccupancyList([{
      id: Date.now(),
      minimumPax: "",
      maximumPax: ""
    }]);
    setValidationErrors({});
    setShowModal(true);
  };

  const fetchPackageRatesList = async (pageNum = 0, searchTerm = search) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
        packageId: packageId.toString()
      });

      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      const res = await axiosInstance.get(`/api/PackageRates?${params.toString()}`);
      //console.log("package rates list :::", res);

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
      toast.error("Failed to load package rates");
      setItems([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };

  const countryList = async () => {
    try {
      const response = await axiosInstance.get("/api/country");
      setCountries(response.data);
    } catch (error) {
      //console.log("error for country list :", error);
    }
  };

  const cityList = async (countryId) => {
    try {
      setIsLoadingPlaces(true);
      const response = await axiosInstance.post(`/api/destination/getCitiesByCountryId/${countryId}`);
      setPlaces(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      //console.log("axios call error for city list : ", error);
      setPlaces([]);
    } finally {
      setIsLoadingPlaces(false);
    }
  };

  const fetchPackageDetails = async () => {
    if (!packageId) {
      //console.log("No packageId provided");
      return;
    }
    
    try {
      setIsLoadingPackageCategories(true);
      //console.log("Fetching package details for packageId:", packageId);
      
      const response = await axiosInstance.get(`/api/TravelPackage/${packageId}`);
      //console.log("Package details response:", response.data);
      
      if (response.data) {
        //console.log("Full package data:", response.data);
        
        // Check for packageCategory in different possible formats
        let categoryData = response.data.packageCategory || response.data.packageCategories;
        //console.log("Package category data found:", categoryData);
        
        if (categoryData) {
          // If packageCategory is an array of IDs, we need to fetch the actual category details
          if (Array.isArray(categoryData)) {
            //console.log("Package categories is an array, fetching category details...");
            
            // Fetch all package categories to get their details
            const categoriesResponse = await axiosInstance.get("/api/packageCategory");
            const allCategories = categoriesResponse.data || [];
            //console.log("All available categories:", allCategories);
            
            // Filter to only include categories that belong to this package
            const packageCategories = allCategories.filter(category => {
              // Handle both string and number comparisons
              const categoryId = category.packageCategoryId || category.id;
              return categoryData.includes(categoryId) || categoryData.includes(String(categoryId));
            });
            
            //console.log("Filtered package categories:", packageCategories);
            setPackageCategories(packageCategories);
          } else {
            //console.log("Package categories is not an array:", categoryData);
            setPackageCategories([]);
          }
        } else {
          //console.log("No package category data found in response");
          setPackageCategories([]);
        }
      } else {
        //console.log("No response data found");
        setPackageCategories([]);
      }
    } catch (error) {
      //console.log("Error fetching package details:", error);
      setPackageCategories([]);
      toast.error("Failed to load package categories");
    } finally {
      setIsLoadingPackageCategories(false);
    }
  };

  // Handle country change
  const handleCountryChange = (e) => {
    const value = e.target.value;
    const stringValue = String(value);
    
    setFormData((prev) => ({
      ...prev,
      countryId: stringValue,
      placeId: "", // Clear place selection
    }));
    
    // Clear places and fetch new ones
    setPlaces([]);
    setIsLoadingPlaces(false);
    
    if (value && stringValue.trim() !== "") {
      cityList(value);
    }
    
    // Clear validation errors
    if (validationErrors.countryId) {
      setValidationErrors(prev => ({ ...prev, countryId: "" }));
    }
    if (validationErrors.placeId) {
      setValidationErrors(prev => ({ ...prev, placeId: "" }));
    }
  };

  // Handle place change
  const handlePlaceChange = (e) => {
    const value = e.target.value;
    const stringValue = String(value);
    
    setFormData(prev => ({
      ...prev,
      placeId: stringValue,
    }));
    
    // Clear validation error when user makes selection
    if (validationErrors.placeId) {
      setValidationErrors(prev => ({ ...prev, placeId: "" }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setIsLoading(true);
      
      const payload = {
        rateCode: formData.rateCode,
        market: formData.market,
        packageId: packageId,
        countryId: formData.countryId,
        placeId: formData.placeId,
        noOfNights: formData.noOfNights,
        validityList: validityList,
        occupancyList: occupancyList,
        sharingTypes: formData.sharingTypes,
        rates: formData.rates
      };

      //console.log("package rates save payload::", payload);
      
      let response;
      if (editing) {
        response = await axiosInstance.put(`/api/PackageRates/${editing.id}`, payload);
      } else {
        response = await axiosInstance.post("/api/PackageRates/save", payload);
      }
      
      if (response.data) {
        toast.success(editing ? "Package rate updated successfully!" : "Package rate added successfully!");
        setValidationErrors({});
        setEditing(null);
        await fetchPackageRatesList(page, search);
        closeModal();
      } else {
        toast.error("Failed to save data!!");
      }
      
    } catch(error) {
      toast.error(`Error!! Something went wrong: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setValidationErrors({});
    setEditing(null);
    setIsAddingValidity(false);
    setIsAddingOccupancy(false);
  };

  // CRUD Operations
  const openEdit = (item) => {
    setEditing(item);
    
    // Initialize dynamic sharing types based on package categories
    const dynamicSharingTypes = {};
    const dynamicRates = {};
    
    packageCategories.forEach(category => {
      const key = category.packageCategoryId.toString();
      dynamicSharingTypes[key] = item.sharingTypes?.[key] || false;
      dynamicRates[key] = item.rates?.[key] || {
        adultRate: "",
        childWithBed: "",
        childWithoutBed: ""
      };
    });
    
    setFormData({
      rateCode: item.rateCode || "",
      market: item.market || "",
      countryId: item.countryId || "",
      placeId: item.placeId || "",
      noOfNights: item.noOfNights || "",
      sharingTypes: dynamicSharingTypes,
      rates: dynamicRates
    });
    setValidityList(item.validityList || []);
    setOccupancyList(item.occupancyList || []);
    setValidationErrors({});
    setShowModal(true);
  };

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete rate code "${item.rateCode}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        setIsLoading(true);
        const response = await axiosInstance.delete(`/api/PackageRates/${item.id}`);
        if (response.data) {
          toast.success('Package rate deleted successfully!');
          await fetchPackageRatesList(page, search);
        }
      } catch (error) {
        toast.error(`Failed to delete package rate: ${error.response?.data?.message || error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCopy = (item) => {
    setEditing(null);
    
    // Initialize dynamic sharing types based on package categories
    const dynamicSharingTypes = {};
    const dynamicRates = {};
    
    packageCategories.forEach(category => {
      const key = category.packageCategoryId.toString();
      dynamicSharingTypes[key] = item.sharingTypes?.[key] || false;
      dynamicRates[key] = item.rates?.[key] || {
        adultRate: "",
        childWithBed: "",
        childWithoutBed: ""
      };
    });
    
    setFormData({
      rateCode: `${item.rateCode}_COPY`,
      market: item.market || "",
      countryId: item.countryId || "",
      placeId: item.placeId || "",
      noOfNights: item.noOfNights || "",
      sharingTypes: dynamicSharingTypes,
      rates: dynamicRates
    });
    setValidityList(item.validityList || []);
    setOccupancyList(item.occupancyList || []);
    setValidationErrors({});
    setShowModal(true);
  };

  // Validity list management
  const addValidityPeriod = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Prevent multiple rapid clicks
    if (isAddingValidity) {
      //console.log("Already adding validity period, ignoring click");
      return;
    }
    
    const currentTime = Date.now();
    const timeSinceLastAdd = currentTime - lastValidityAddTime.current;
    
    // Prevent execution if called within 1000ms of last execution
    if (timeSinceLastAdd < 1000) {
      //console.log("Debouncing validity add - too soon:", timeSinceLastAdd, "ms");
      return;
    }
    
    lastValidityAddTime.current = currentTime;
    setIsAddingValidity(true);
    
    //console.log("Adding validity period");
    
    const newValidity = {
      id: `validity_${currentTime}_${Math.random().toString(36).substr(2, 9)}`,
      validityFrom: "",
      validityTo: ""
    };
    
    setValidityList(prevList => {
      //console.log("Previous validity list length:", prevList.length);
      const newList = [...prevList, newValidity];
      //console.log("New validity list length:", newList.length);
      
      // Reset adding state after a short delay
      setTimeout(() => {
        setIsAddingValidity(false);
      }, 100);
      
      return newList;
    });
  }, [isAddingValidity]);

  const removeValidityPeriod = (id) => {
    if (validityList.length > 1) {
      setValidityList(validityList.filter(v => v.id !== id));
    }
  };

  const updateValidityPeriod = (id, field, value) => {
    setValidityList(validityList.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    ));
  };

  // Occupancy list management
  const addOccupancy = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Prevent multiple rapid clicks
    if (isAddingOccupancy) {
      //console.log("Already adding occupancy, ignoring click");
      return;
    }
    
    const currentTime = Date.now();
    const timeSinceLastAdd = currentTime - lastOccupancyAddTime.current;
    
    // Prevent execution if called within 1000ms of last execution
    if (timeSinceLastAdd < 1000) {
      //console.log("Debouncing occupancy add - too soon:", timeSinceLastAdd, "ms");
      return;
    }
    
    lastOccupancyAddTime.current = currentTime;
    setIsAddingOccupancy(true);
    
    //console.log("Adding occupancy");
    
    const newOccupancy = {
      id: `occupancy_${currentTime}_${Math.random().toString(36).substr(2, 9)}`,
      minimumPax: "",
      maximumPax: ""
    };
    
    setOccupancyList(prevList => {
      //console.log("Previous occupancy list length:", prevList.length);
      const newList = [...prevList, newOccupancy];
      //console.log("New occupancy list length:", newList.length);
      
      // Reset adding state after a short delay
      setTimeout(() => {
        setIsAddingOccupancy(false);
      }, 100);
      
      return newList;
    });
  }, [isAddingOccupancy]);

  const removeOccupancy = (id) => {
    if (occupancyList.length > 1) {
      setOccupancyList(occupancyList.filter(o => o.id !== id));
    }
  };

  const updateOccupancy = (id, field, value) => {
    setOccupancyList(occupancyList.map(o => 
      o.id === id ? { ...o, [field]: value } : o
    ));
  };

  // Sharing type change
  const handleSharingTypeChange = (type, checked) => {
    setFormData(prev => ({
      ...prev,
      sharingTypes: {
        ...prev.sharingTypes,
        [type]: checked
      }
    }));
  };

  // Rate change
  const handleRateChange = (sharingType, rateType, value) => {
    setFormData(prev => ({
      ...prev,
      rates: {
        ...prev.rates,
        [sharingType]: {
          ...prev.rates[sharingType],
          [rateType]: value
        }
      }
    }));
  };

  useEffect(() => {
    //console.log("PackageRates useEffect - Component mounted");
    fetchPackageRatesList();
    countryList();
    fetchPackageDetails();
  }, []);

  // Debug useEffect to track packageId changes
  useEffect(() => {
    //console.log("PackageRates useEffect - packageId changed:", packageId);
    if (packageId && packageId !== 0) {
      fetchPackageDetails();
    }
  }, [packageId]);

  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      fetchPackageRatesList(0, search);
    }, 500);
    setSearchTimeout(timeout);

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  const [searchTimeout, setSearchTimeout] = useState(null);

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
                  onClick={() => navigate("/registration/package")}
                  className="mb-2 me-3"
                  size="sm"
                >
                  <FaBackward className="me-2" />
                  Back to Registration
                </Button>
                <span className="fw-semibold">
                  <FaPlus className="me-2 text-success" />
                  Package Rates - {packageName} ({packageCode})
                </span>
              </div>
              <Button className="btn-green" onClick={handleCreate}>
                + Create
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Rate Code</th>
                    <th>Market</th>
                    <th>No of Nights</th>
                    <th>Status</th>
                    <th style={{ width: 200 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1 + page * 10}</td>
                      <td>{item.rateCode || 'N/A'}</td>
                      <td>{item.market || 'N/A'}</td>
                      <td>{item.noOfNights || 'N/A'}</td>
                      <td>
                        <span className={`badge ${item.status === 'Active' ? 'bg-success' : 'bg-danger'}`}>
                          {item.status || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <FaEdit
                            className="text-primary edit"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => openEdit(item)}
                            title="Edit"
                          />
                          <FaCopy
                            className="text-warning copy"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleCopy(item)}
                            title="Copy"
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
                        Loading package rates...
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        No package rates found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <div>
                    <small className="text-muted">
                      Showing {items.length} of {totalPages * 10} package rates
                    </small>
                  </div>
                  <div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 0}
                        onClick={() => fetchPackageRatesList(page - 1, search)}
                      />
                      {[...Array(totalPages).keys()].map((num) => (
                        <Pagination.Item
                          key={num}
                          active={num === page}
                          onClick={() => fetchPackageRatesList(num, search)}
                        >
                          {num + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page === totalPages - 1}
                        onClick={() => fetchPackageRatesList(page + 1, search)}
                      />
                    </Pagination>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          <Modal show={showModal} onHide={closeModal} centered size="xl" backdrop="static" keyboard={false}>
            <Modal.Header closeButton>
              <Modal.Title>{editing ? 'Edit Package Rate' : 'Create Package Rate'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form onSubmit={handleSave}>
                {/* Top Section - Rate Code and Market */}
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Rate Code <span className="text-danger">*</span></Form.Label>
                      <Form.Control 
                        type="text" 
                        placeholder="Enter rate code"
                        value={formData.rateCode}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, rateCode: e.target.value }));
                          if (validationErrors.rateCode) {
                            setValidationErrors(prev => ({ ...prev, rateCode: undefined }));
                          }
                        }}
                        isInvalid={!!validationErrors.rateCode}
                      />
                      {validationErrors.rateCode && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.rateCode}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Market <span className="text-danger">*</span></Form.Label>
                      <Form.Control 
                        type="text" 
                        placeholder="Click to Choose..."
                        value={formData.market}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, market: e.target.value }));
                          if (validationErrors.market) {
                            setValidationErrors(prev => ({ ...prev, market: undefined }));
                          }
                        }}
                        isInvalid={!!validationErrors.market}
                      />
                      {validationErrors.market && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.market}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                </Row>

                {/* Middle Section - Validity Dates (Left) and Occupancy (Right) */}
                <Row>
                  {/* Left Side - Validity Dates Clone */}
                  <Col md={6}>
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6>Validity List</h6>
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          onClick={addValidityPeriod}
                          disabled={isAddingValidity}
                        >
                          <FaPlus className="me-2" />
                          {isAddingValidity ? "Adding..." : "Add Period"}
                        </Button>
                      </div>
                      {validityList.map((validity, index) => (
                        <Card key={validity.id} className="mb-3">
                          <Card.Header className="d-flex justify-content-between align-items-center">
                            <h6 className="mb-0">Validity Period {index + 1}</h6>
                            {validityList.length > 1 && (
                              <Button 
                                variant="outline-danger" 
                                size="sm" 
                                onClick={() => removeValidityPeriod(validity.id)}
                              >
                                <FaTrash className="me-1" />
                                Remove
                              </Button>
                            )}
                          </Card.Header>
                          <Card.Body>
                            <Row>
                              <Col md={6}>
                                <Form.Group className="mb-3">
                                  <Form.Label>Validity From</Form.Label>
                                  <Form.Control 
                                    type="date"
                                    value={validity.validityFrom}
                                    onChange={(e) => updateValidityPeriod(validity.id, 'validityFrom', e.target.value)}
                                  />
                                </Form.Group>
                              </Col>
                              <Col md={6}>
                                <Form.Group className="mb-3">
                                  <Form.Label>Validity To</Form.Label>
                                  <Form.Control 
                                    type="date"
                                    value={validity.validityTo}
                                    onChange={(e) => updateValidityPeriod(validity.id, 'validityTo', e.target.value)}
                                  />
                                </Form.Group>
                              </Col>
                            </Row>
                          </Card.Body>
                        </Card>
                      ))}
                      {validationErrors.validityList && (
                        <div className="text-danger small">{validationErrors.validityList}</div>
                      )}
                    </div>
                  </Col>

                  {/* Right Side - Occupancy */}
                  <Col md={6}>
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6>Occupancy List</h6>
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          onClick={addOccupancy}
                          disabled={isAddingOccupancy}
                        >
                          <FaPlus className="me-2" />
                          {isAddingOccupancy ? "Adding..." : "Add Occupancy"}
                        </Button>
                      </div>
                      {occupancyList.map((occupancy, index) => (
                        <Card key={occupancy.id} className="mb-3">
                          <Card.Header className="d-flex justify-content-between align-items-center">
                            <h6 className="mb-0">Occupancy {index + 1}</h6>
                            {occupancyList.length > 1 && (
                              <Button 
                                variant="outline-danger" 
                                size="sm" 
                                onClick={() => removeOccupancy(occupancy.id)}
                              >
                                <FaTrash className="me-1" />
                                Remove
                              </Button>
                            )}
                          </Card.Header>
                          <Card.Body>
                            <Row>
                              <Col md={6}>
                                <Form.Group className="mb-3">
                                  <Form.Label>Minimum Pax</Form.Label>
                                  <Form.Control 
                                    type="number"
                                    placeholder="Enter minimum pax"
                                    value={occupancy.minimumPax}
                                    onChange={(e) => updateOccupancy(occupancy.id, 'minimumPax', e.target.value)}
                                  />
                                </Form.Group>
                              </Col>
                              <Col md={6}>
                                <Form.Group className="mb-3">
                                  <Form.Label>Maximum Pax</Form.Label>
                                  <Form.Control 
                                    type="number"
                                    placeholder="Enter maximum pax"
                                    value={occupancy.maximumPax}
                                    onChange={(e) => updateOccupancy(occupancy.id, 'maximumPax', e.target.value)}
                                  />
                                </Form.Group>
                              </Col>
                            </Row>
                          </Card.Body>
                        </Card>
                      ))}
                      {validationErrors.occupancyList && (
                        <div className="text-danger small">{validationErrors.occupancyList}</div>
                      )}
                      {/* <div className="d-flex justify-content-end mb-3">
                        <Button variant="primary" size="sm">
                          Show Grid
                        </Button>
                      </div> */}
                    </div>
                  </Col>
                </Row>

                {/* Bottom Section - Rate Details */}
                <div className="mb-3">
                  <h6 className="border-bottom pb-2 mb-3">RATE DETAILS</h6>
                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Country <span className="text-danger">*</span></Form.Label>
                        <Form.Select
                          value={formData.countryId}
                          onChange={handleCountryChange}
                          isInvalid={!!validationErrors.countryId}
                        >
                          <option value="">SELECT</option>
                          {countries.map(country => (
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
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Place <span className="text-danger">*</span></Form.Label>
                        <Form.Select
                          value={formData.placeId}
                          onChange={handlePlaceChange}
                          disabled={!formData.countryId || isLoadingPlaces}
                          isInvalid={!!validationErrors.placeId}
                        >
                          <option value="">SELECT</option>
                          {places.map(place => (
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
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>No of nights <span className="text-danger">*</span></Form.Label>
                        <Form.Select
                          value={formData.noOfNights}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, noOfNights: e.target.value }));
                            if (validationErrors.noOfNights) {
                              setValidationErrors(prev => ({ ...prev, noOfNights: undefined }));
                            }
                          }}
                          isInvalid={!!validationErrors.noOfNights}
                        >
                          <option value="">SELECT</option>
                          {[...Array(15)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                          ))}
                        </Form.Select>
                        {validationErrors.noOfNights && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.noOfNights}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                  </Row>
                </div>

                {/* Sharing Options */}
                <div className="mb-3">
                  <h6>Sharing Options</h6>
                  {isLoadingPackageCategories ? (
                    <div className="text-center py-3">
                      <div className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      Loading package categories...
                    </div>
                  ) : packageCategories.length > 0 ? (
                      packageCategories.map((category) => {
                      const categoryKey = category.packageCategoryId.toString();
                      return (
                        <Card key={category.packageCategoryId} className="mb-3">
                    <Card.Header>
                      <FormCheck 
                        type="checkbox" 
                              label={category.name.toUpperCase()} 
                              checked={formData.sharingTypes[categoryKey] || false}
                              onChange={(e) => handleSharingTypeChange(categoryKey, e.target.checked)}
                      />
                    </Card.Header>
                    <Card.Body>
                      <Row>
                        <Col md={12}>
                          <p className="mb-2">Occupancy Type: Select Hotel or Similar</p>
                        </Col>
                      </Row>
                      <Row>
                        <Col md={4}>
                          <Form.Group className="mb-3">
                            <Form.Label>Adult Rate per person</Form.Label>
                            <Form.Control 
                              type="number"
                              placeholder="Enter rate"
                                    value={formData.rates[categoryKey]?.adultRate || ""}
                                    onChange={(e) => handleRateChange(categoryKey, 'adultRate', e.target.value)}
                                    disabled={!formData.sharingTypes[categoryKey]}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={4}>
                          <Form.Group className="mb-3">
                            <Form.Label>Child With Bed Rate per person</Form.Label>
                            <Form.Control 
                              type="number"
                              placeholder="Enter rate"
                                    value={formData.rates[categoryKey]?.childWithBed || ""}
                                    onChange={(e) => handleRateChange(categoryKey, 'childWithBed', e.target.value)}
                                    disabled={!formData.sharingTypes[categoryKey]}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={4}>
                          <Form.Group className="mb-3">
                            <Form.Label>Child Without Bed Rate per person</Form.Label>
                            <Form.Control 
                              type="number"
                              placeholder="Enter rate"
                                    value={formData.rates[categoryKey]?.childWithoutBed || ""}
                                    onChange={(e) => handleRateChange(categoryKey, 'childWithoutBed', e.target.value)}
                                    disabled={!formData.sharingTypes[categoryKey]}
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                      );
                    })
                  ) : (
                    <div className="text-center py-3 text-muted">
                      <p>No package categories found for this package.</p>
                      <small>Please ensure the package has categories defined in Package Registration.</small>
                    </div>
                  )}
                  {validationErrors.sharingTypes && (
                    <div className="text-danger small mt-2">
                      {validationErrors.sharingTypes}
                    </div>
                  )}
                </div>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="danger" onClick={closeModal}>
                <i className="fas fa-times me-2"></i>
                Cancel
              </Button>
              <Button variant="success" onClick={handleSave}>
                <i className="fas fa-arrow-right me-2"></i>
                {editing ? 'Update' : 'Create'}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default PackageRates;
