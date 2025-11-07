import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  FaBackward,
  FaCog,
  FaTimes,
} from "react-icons/fa";

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
  const [inputRef, setInputRef] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

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
          String(option);
        return optionName.toLowerCase().includes(searchTerm.toLowerCase());
      });
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [searchTerm, options]);

  useEffect(() => {
    if (isOpen && inputRef) {
      const rect = inputRef.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 200; // max height
      
      // Check if dropdown would go below viewport
      let top = rect.bottom + window.scrollY;
      if (rect.bottom + dropdownHeight > viewportHeight) {
        // Position above the input if not enough space below
        top = rect.top + window.scrollY - dropdownHeight;
      }
      
      setDropdownPosition({
        top: top,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen, inputRef]);

  const handleSelect = (option) => {
    try {
      console.log("Selecting option:", option);
      // Ensure we pass a proper value
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
    <div className="position-relative" style={{ zIndex: 1, overflow: "visible", isolation: "isolate", position: "relative" }}>
      <Form.Control
        ref={setInputRef}
        type="text"
        value={
          isOpen
            ? searchTerm
            : selectedOption?.name ||
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

      {isOpen && !disabled && createPortal(
        <div
          className="dropdown-menu show"
          style={{
            position: "fixed",
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 999999,
            maxHeight: "200px",
            overflowY: "auto",
            display: "block",
            backgroundColor: "white",
            border: "1px solid #dee2e6",
            borderRadius: "0.375rem",
            boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)",
            padding: 0,
            margin: 0,
            transition: "none",
            animation: "none",
          }}
        >
          {isLoading ? (
            <div className="dropdown-item text-center" style={{ padding: "0.75rem 1rem" }}>
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
                className="dropdown-item"
                style={{
                  cursor: "pointer",
                  fontSize: "14px",
                  lineHeight: "1.4",
                  color: "#212529",
                  padding: "0.5rem 1rem",
                  borderBottom: "1px solid #f8f9fa",
                  transition: "none",
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#f8f9fa";
                  e.target.style.color = "#0d6efd";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "white";
                  e.target.style.color = "#212529";
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
            <div className="dropdown-item text-muted" style={{ padding: "0.5rem 1rem", fontStyle: "italic" }}>
              No options found
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && createPortal(
        <div
          className="position-fixed"
          style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999998,
          }}
          onClick={() => {
            setIsOpen(false);
            setSearchTerm("");
          }}
        />,
        document.body
      )}
    </div>
  );
};

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
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsActivityRateId, setSettingsActivityRateId] = useState(null);
  const [inclusions, setInclusions] = useState([{ id: 1, value: "" }]);
  const [termsAndConditions, setTermsAndConditions] = useState([{ id: 1, value: "" }]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsFetching, setSettingsFetching] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Dropdown data
  const [countries, setCountries] = useState([]);
  const [places, setPlaces] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [marketTypes, setMarketTypes] = useState([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);

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
    adultRate: "",
    childRate: "",
    minPax: "",
    activityType: "",
    countryId: "",
    placeId: "",
    durationHr: "",
    durationMin: "",
    reportingPoint: "",
    rating: "",
    marketType: "",
    activityImage: null,
    activityImagePreview: null,
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
  // Load countries
  const countryList = async () => {
    try {
      const response = await axios.get("/api/country");
      setCountries(response.data);
    } catch (error) {
      console.log("error for country list :", error);
    }
  };

  // Load market types
  const loadMarketTypes = async () => {
    try {
      const response = await axiosInstance.get("/api/marketType");
      console.log("Market types response:", response.data);
      setMarketTypes(response.data || []);
    } catch (error) {
      console.error("Error loading market types:", error);
      toast.error("Failed to load market types");
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
      const stringValue = String(value); // Convert to string to avoid trim error
      const selectedCountry = countries.find(country => String(country.id) === String(value));
      const countryName = selectedCountry?.name || selectedCountry?.countryName || "Unknown";
      
      console.log(
        "Country selected:",
        value,
        "Country name:",
        countryName
      );
      
      // Clear places and place selection when country changes
      setPlaces([]);
      setIsLoadingPlaces(false);
      
      setFormData((prev) => ({
        ...prev,
        countryId: stringValue,
        placeId: "", // Clear place selection
      }));
      
      // Fetch cities for the selected country
      if (value && stringValue.trim() !== "") {
        cityList(value);
      }
      
      // Clear validation errors
      if (validationErrors.countryId) {
        setValidationErrors(prev => ({
          ...prev,
          countryId: ""
        }));
      }
      if (validationErrors.placeId) {
        setValidationErrors(prev => ({
          ...prev,
          placeId: ""
        }));
      }
    } catch (error) {
      console.error("Error in handleCountryChange:", error);
    }
  };

  // Handle place change
  const handlePlaceChange = (e) => {
    const value = e.target.value;
    const stringValue = String(value); // Convert to string for consistency
    console.log("Place selected:", value);
    
    setFormData(prev => ({
      ...prev,
      placeId: stringValue,
    }));
    
    // Clear validation error when user makes selection
    if (validationErrors.placeId) {
      setValidationErrors(prev => ({
        ...prev,
        placeId: ""
      }));
    }
  };

  // Fetch activity rates list
  const fetchActivityRatesList = async (pageNum = 0, searchTerm = search) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });

      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      const response = await axiosInstance.get(`/api/activityRate?${params.toString()}`);
      console.log("Activity rates list:", response.data);

      if (response.data && Array.isArray(response.data)) {
        setRates(response.data);
        if (response.data.length < 10) {
          setTotalPages(pageNum + 1);
        } else {
          setTotalPages(Math.max(totalPages, pageNum + 2));
        }
        setPage(pageNum);
      } else {
        setRates([]);
        setTotalPages(0);
        setPage(0);
      }
    } catch (error) {
      console.error("Error fetching activity rates:", error);
      // toast.error("Failed to fetch activity rates");
      setRates([]);
      setTotalPages(0);
      setPage(0);
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    fetchActivityRatesList();
  }, [providerId]);

  useEffect(() => {
    countryList();
    loadMarketTypes();
  }, []);

  // Handle search with debounce
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    const timeout = setTimeout(() => {
      fetchActivityRatesList(0, search);
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
      adultRate: "",
      childRate: "",
      minPax: "",
      activityType: "",
      countryId: "",
      placeId: "",
      durationHr: "",
      durationMin: "",
      reportingPoint: "",
      rating: "",
      marketType: "",
      activityImage: null,
      activityImagePreview: null,
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
      adultRate: "",
      childRate: "",
      minPax: "",
      activityType: "",
      countryId: "",
      placeId: "",
      durationHr: "",
      durationMin: "",
      reportingPoint: "",
      rating: "",
      marketType: "",
      activityImage: null,
      activityImagePreview: null,
    });
    setValidityDates([
      {
        id: 1,
        validityFrom: "",
        validityTo: "",
      },
    ]);
  };

  // Settings modal handlers
  const handleOpenSettings = async (rate) => {
    const activityRateId = rate.activityRateId;
    setSettingsActivityRateId(activityRateId);
    setSettingsFetching(true);
    setShowSettingsModal(true);
    
    try {
      // Fetch existing inclusions and terms from API
      const response = await axiosInstance.get(
        `/api/activityRate/inclutionAndTerms/${activityRateId}`
      );
      
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        // Separate inclusions (type: 1) and terms (type: 2)
        const inclusionsData = response.data
          .filter(item => item.type === 1)
          .map((item, idx) => ({ id: idx + 1, value: item.data || "" }));
        
        const termsData = response.data
          .filter(item => item.type === 2)
          .map((item, idx) => ({ id: idx + 1, value: item.data || "" }));
        
        // Set the data if it exists, otherwise use empty array with one empty item
        setInclusions(inclusionsData.length > 0 
          ? inclusionsData 
          : [{ id: 1, value: "" }]);
        setTermsAndConditions(termsData.length > 0
          ? termsData
          : [{ id: 1, value: "" }]);
      } else {
        // No data found, initialize with empty arrays
        setInclusions([{ id: 1, value: "" }]);
        setTermsAndConditions([{ id: 1, value: "" }]);
      }
    } catch (error) {
      console.error("Error fetching inclusions and terms:", error);
      // If error (like 404), initialize with empty arrays
      setInclusions([{ id: 1, value: "" }]);
      setTermsAndConditions([{ id: 1, value: "" }]);
    } finally {
      setSettingsFetching(false);
    }
  };

  const handleCloseSettings = () => {
    setShowSettingsModal(false);
    setSettingsActivityRateId(null);
    setInclusions([{ id: 1, value: "" }]);
    setTermsAndConditions([{ id: 1, value: "" }]);
    setSettingsFetching(false);
  };

  const handleAddInclusion = () => {
    const newId = Math.max(...inclusions.map(i => i.id), 0) + 1;
    setInclusions([...inclusions, { id: newId, value: "" }]);
  };

  const handleRemoveInclusion = (id) => {
    if (inclusions.length > 1) {
      setInclusions(inclusions.filter(item => item.id !== id));
    }
  };

  const handleInclusionChange = (id, value) => {
    setInclusions(inclusions.map(item => 
      item.id === id ? { ...item, value } : item
    ));
  };

  const handleAddTerm = () => {
    const newId = Math.max(...termsAndConditions.map(t => t.id), 0) + 1;
    setTermsAndConditions([...termsAndConditions, { id: newId, value: "" }]);
  };

  const handleRemoveTerm = (id) => {
    if (termsAndConditions.length > 1) {
      setTermsAndConditions(termsAndConditions.filter(item => item.id !== id));
    }
  };

  const handleTermChange = (id, value) => {
    setTermsAndConditions(termsAndConditions.map(item => 
      item.id === id ? { ...item, value } : item
    ));
  };

  const handleSaveSettings = async () => {
    // Validate that all fields are filled
    const emptyInclusions = inclusions.filter(inc => !inc.value.trim());
    const emptyTerms = termsAndConditions.filter(term => !term.value.trim());

    if (emptyInclusions.length > 0) {
      toast.error("Please fill all inclusion fields");
      return;
    }

    if (emptyTerms.length > 0) {
      toast.error("Please fill all terms and condition fields");
      return;
    }

    try {
      setSettingsLoading(true);
      
      // Transform data to match API payload structure
      // type: 1 = Inclusion, type: 2 = Terms and condition
      const payload = [
        // Add all inclusions with type 1
        ...inclusions
          .filter(inc => inc.value.trim())
          .map(inc => ({
            activityRateId: String(settingsActivityRateId),
            data: inc.value.trim(),
            type: 1
          })),
        // Add all terms and conditions with type 2
        ...termsAndConditions
          .filter(term => term.value.trim())
          .map(term => ({
            activityRateId: String(settingsActivityRateId),
            data: term.value.trim(),
            type: 2
          }))
      ];

      const response = await axiosInstance.post(
        "/api/activityRate/inclutionAndTerms/save",
        payload
      );

      toast.success("Settings saved successfully!");
      handleCloseSettings();
      // Optionally refresh the rates list
      // loadRates();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(error.response?.data?.message || "Failed to save settings");
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleResetSettings = () => {
    setInclusions([{ id: 1, value: "" }]);
    setTermsAndConditions([{ id: 1, value: "" }]);
  };

  const activityTypeValue = String(formData.activityType || "");
  const isPrivateActivity = activityTypeValue === "1";
  const isSicActivity = activityTypeValue === "2";

  const handleEdit = (item) => {
    console.log("Edit item data:", item);
    
    setEditing(item);
    setIsViewMode(false);
    setFormData({
      activityName: item.activityName || "",
      activityCode: item.activityCode || "",
      activityDetails: item.activityDetails || "",
      childAgeMin: item.childAgeMin !== undefined && item.childAgeMin !== null ? item.childAgeMin : "",
      childAgeMax: item.childAgeMax !== undefined && item.childAgeMax !== null ? item.childAgeMax : "",
      totalUsersAllowed: item.totalUsersAllowed || item.total_users_allowed || "",
      activityRate: item.activityRate || item.activity_rate || "",
      maxPax: item.maxPax || item.max_pax || "",
      adultRate: item.adultRate || item.adult_rate || "",
      childRate: item.childRate || item.child_rate || "",
      minPax:
        item.minPax || item.min_pax || item.minPaxsic || item.min_pax_sic || "",
      activityType:
        item.activityType !== undefined && item.activityType !== null
          ? String(item.activityType)
          : item.activity_type !== undefined && item.activity_type !== null
          ? String(item.activity_type)
          : "",
      countryId: item.countryId || item.country_id || "",
      placeId: item.placeId || item.place_id || "",
      durationHr: item.durationHr || item.duration_hr || "",
      durationMin: item.durationMin || item.duration_min || "",
      reportingPoint: item.reportingPoint || item.reporting_point || "", 
      rating: item.rating || "",
      marketType: item.marketType || item.market_type || "",
      activityImage: null,
      activityImagePreview: item.imagePath || item.activityImage || item.activity_image || null,
    });
    
    // Handle validity dates - check for different possible field names
    const validityData = item.validity || item.validityDates || item.validity_periods || item.validityPeriods || [];
    console.log("Validity data found:", validityData);
    
    if (validityData && Array.isArray(validityData) && validityData.length > 0) {
      console.log("Processing validity data:", validityData);
      setValidityDates(validityData.map((validity, index) => ({
        id: validity.validityId || validity.id || Date.now() + index,
        validityFrom: formatDateForInput(validity.validityFrom) || "",
        validityTo: formatDateForInput(validity.validityTo) || "",
      })));
    } else {
      console.log("No validity data found, using default");
      setValidityDates([
        {
          id: 1,
          validityFrom: "",
          validityTo: "",
        },
      ]);
    }
    
    setValidationErrors({});
    
    // Load places for the selected country when editing
    if (item.countryId) {
      cityList(item.countryId);
    }
    
    setShowModal(true);
  };

  const handleView = (item) => {
    console.log("View item data:", item);
    console.log("All item keys:", Object.keys(item));
    console.log("Child Age Min:", item.childAgeMin);
    console.log("Child Age Max:", item.childAgeMax);
    console.log("Child age min (snake):", item.child_age_min);
    console.log("Child age max (snake):", item.child_age_max);
    console.log("Validity data:", item.validity);
    console.log("Validity periods:", item.validity_periods);
    console.log("Validity dates:", item.validityDates);
    
    setEditing(item);
    setIsViewMode(true);
    setFormData({
      activityName: item.activityName || "",
      activityCode: item.activityCode || "",
      activityDetails: item.activityDetails || "",
      childAgeMin: item.childAgeMin !== undefined && item.childAgeMin !== null ? item.childAgeMin : "",
      childAgeMax: item.childAgeMax !== undefined && item.childAgeMax !== null ? item.childAgeMax : "",
      totalUsersAllowed: item.totalUsersAllowed || item.total_users_allowed || "",
      activityRate: item.activityRate || item.activity_rate || "",
      maxPax: item.maxPax || item.max_pax || "",
      adultRate: item.adultRate || item.adult_rate || "",
      childRate: item.childRate || item.child_rate || "",
      minPax:
        item.minPax || item.min_pax || item.minPaxsic || item.min_pax_sic || "",
      activityType:
        item.activityType !== undefined && item.activityType !== null
          ? String(item.activityType)
          : item.activity_type !== undefined && item.activity_type !== null
          ? String(item.activity_type)
          : "",
      countryId: item.countryId || item.country_id || "",
      placeId: item.placeId || item.place_id || "",
      durationHr: item.durationHr || item.duration_hr || "",
      durationMin: item.durationMin || item.duration_min || "",
      reportingPoint: item.reportingPoint || item.reporting_point || "",
      rating: item.rating || "",
      marketType: item.marketType || item.market_type || "",
      activityImage: null,
      activityImagePreview: item.imagePath || item.activityImage || item.activity_image || null,
    });
    
    // Handle validity dates - check for different possible field names
    const validityData = item.validity || item.validityDates || item.validity_periods || item.validityPeriods || [];
    console.log("Validity data found:", validityData);
    
    if (validityData && Array.isArray(validityData) && validityData.length > 0) {
      console.log("Processing validity data:", validityData);
      setValidityDates(validityData.map((validity, index) => ({
        id: validity.validityId || validity.id || Date.now() + index,
        validityFrom: formatDateForInput(validity.validityFrom) || "",
        validityTo: formatDateForInput(validity.validityTo) || "",
      })));
    } else {
      console.log("No validity data found, using default");
      setValidityDates([
        {
          id: 1,
          validityFrom: "",
          validityTo: "",
        },
      ]);
    }
    
    setValidationErrors({});
    
    // Load places for the selected country when viewing
    if (item.countryId) {
      cityList(item.countryId);
    }
    
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
          .delete(`/api/activityRate/${item.activityRateId}`)
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

  const handleMarketChange = (e) => {
    const value = e.target.value;
    
    setFormData(prev => ({
      ...prev,
      marketType: value
    }));

    // Clear validation error when user starts typing
    if (validationErrors.marketType) {
      setValidationErrors(prev => ({
        ...prev,
        marketType: ""
      }));
    }
  };

  // Handle image file selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error("Please select an image file");
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }

      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          activityImage: file,
          activityImagePreview: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Generic function to handle form field changes and clear validation errors
  const handleFieldChange = (fieldName, value) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        [fieldName]: value,
      };

      if (fieldName === "activityType") {
        const selectedType = String(value || "");
        if (selectedType === "1") {
          next.adultRate = "";
          next.childRate = "";
          next.minPax = "";
        } else if (selectedType === "2") {
          next.activityRate = "";
          next.maxPax = "";
        }
      }

      return next;
    });

    setValidationErrors((prev) => {
      if (!prev || (!prev[fieldName] && fieldName !== "activityType")) {
        if (fieldName !== "activityType") {
          return prev;
        }
      }

      if (fieldName === "activityType") {
        return {
          ...prev,
          activityType: "",
          activityRate: "",
          maxPax: "",
          adultRate: "",
          childRate: "",
          minPax: "",
        };
      }

      return {
        ...prev,
        [fieldName]: "",
      };
    });
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
    setValidityDates(validityDates.map(date => {
      if (date.id === id) {
        const updatedDate = { ...date, [field]: value };
        
        // If updating validityFrom and it's after the current validityTo, clear validityTo
        if (field === 'validityFrom' && value && date.validityTo) {
          const fromDate = new Date(value);
          const toDate = new Date(date.validityTo);
          if (fromDate >= toDate) {
            updatedDate.validityTo = "";
          }
        }
        
        return updatedDate;
      }
      return date;
    }));
  };

  // Get minimum date for validity to based on validity from
  const getMinValidityToDate = (validityFrom) => {
    if (!validityFrom) return "";
    const fromDate = new Date(validityFrom);
    fromDate.setDate(fromDate.getDate() + 1); // Add 1 day to make it the next day
    return fromDate.toISOString().split('T')[0]; // Return in YYYY-MM-DD format
  };

  const validateForm = (data) => {
    const errors = {};
    const activityTypeValue = String(data.activityType || "");
    const isPrivate = activityTypeValue === "1";
    const isSic = activityTypeValue === "2";
    
    if (!data.activityName?.trim()) errors.activityName = "Activity Name is required";
    if (!data.activityCode?.trim()) errors.activityCode = "Activity Code is required";
    if (!data.activityDetails?.trim()) errors.activityDetails = "Activity Details is required";
    if (!data.activityType) errors.activityType = "Activity Type is required";
    if (!data.countryId) errors.countryId = "Country is required";
    if (!data.placeId) errors.placeId = "Place is required";
    if (!data.durationHr) errors.durationHr = "Duration Hours is required";
    if (!data.durationMin) errors.durationMin = "Duration Minutes is required";
    if (!data.reportingPoint?.trim()) errors.reportingPoint = "Reporting Point is required";
    if (!data.rating) errors.rating = "Rating is required";
    if (!data.marketType || (typeof data.marketType === 'string' && !data.marketType.trim())) errors.marketType = "Market Type is required";

    if (isPrivate) {
      if (!data.activityRate || (typeof data.activityRate === "string" && !data.activityRate.trim())) {
        errors.activityRate = "Activity Rate is required for private activities";
      }
      if (!data.maxPax || (typeof data.maxPax === "string" && !data.maxPax.trim())) {
        errors.maxPax = "Maximum pax is required for private activities";
      }
    }

    if (isSic) {
      if (!data.adultRate || (typeof data.adultRate === "string" && !data.adultRate.trim())) {
        errors.adultRate = "Adult rate is required for SIC activities";
      }
      if (!data.childRate || (typeof data.childRate === "string" && !data.childRate.trim())) {
        errors.childRate = "Child rate is required for SIC activities";
      }
      if (!data.minPax || (typeof data.minPax === "string" && !data.minPax.trim())) {
        errors.minPax = "Minimum pax is required for SIC activities";
      }
    }
    
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

  // Convert DD/MM/YYYY to YYYY-MM-DD for date input
  const formatDateForInput = (dateString) => {
    if (!dateString) return "";
    // Check if date is in DD/MM/YYYY format
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateString;
  };

  const saveActivityRate = async (e) => {
    e.preventDefault();
    console.log("Form data for validation:", formData);
    console.log("Activity Rate type:", typeof formData.activityRate, "Value:", formData.activityRate);
    console.log("Max Pax type:", typeof formData.maxPax, "Value:", formData.maxPax);
    console.log("Market Type type:", typeof formData.marketType, "Value:", formData.marketType);
    
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setIsLoading(true);
      
      const activityTypeValue = String(formData.activityType || "");
      const isPrivate = activityTypeValue === "1";
      const isSic = activityTypeValue === "2";

      const formDataPayload = new FormData();
      formDataPayload.append('providerId', providerId);
      formDataPayload.append('activityRateId', '');
      formDataPayload.append('activityName', formData.activityName);
      formDataPayload.append('activityCode', formData.activityCode);
      formDataPayload.append('activityDetails', formData.activityDetails);
      formDataPayload.append('childAgeMin', formData.childAgeMin);
      formDataPayload.append('childAgeMax', formData.childAgeMax);
      formDataPayload.append('totalUsersAllowed', formData.totalUsersAllowed);
      formDataPayload.append('activityRate', isPrivate ? formData.activityRate : "0");
      formDataPayload.append('maxPax', isPrivate ? formData.maxPax : "0");
      formDataPayload.append('adultRate', isSic ? formData.adultRate : "0");
      formDataPayload.append('adult_rate', isSic ? formData.adultRate : "0");
      formDataPayload.append('childRate', isSic ? formData.childRate : "0");
      formDataPayload.append('child_rate', isSic ? formData.childRate : "0");
      formDataPayload.append('minPax', isSic ? formData.minPax : "0");
      formDataPayload.append('minPaxsic', isSic ? formData.minPax : "0");
      formDataPayload.append('minPaxsic', isSic ? formData.minPax : "0");
      formDataPayload.append('activityType', formData.activityType);
      formDataPayload.append('countryId', formData.countryId);
      formDataPayload.append('placeId', formData.placeId);
      formDataPayload.append('durationHr', formData.durationHr);
      formDataPayload.append('durationMin', formData.durationMin);
      formDataPayload.append('reportingPoint', formData.reportingPoint);
      formDataPayload.append('rating', formData.rating);
      
      // Add market type
      formDataPayload.append('marketType', formData.marketType);

      // Add activity image if provided
      if (formData.activityImage) {
        formDataPayload.append('activityImage', formData.activityImage);
      }

      // Add validity dates
      validityDates.forEach((validity, index) => {
        formDataPayload.append(`validity[${index}].validityFrom`, formatDateForAPI(validity.validityFrom));
        formDataPayload.append(`validity[${index}].validityTo`, formatDateForAPI(validity.validityTo));
      });

      console.log("formDataPayload:::" , formDataPayload)
      const response = await axiosInstance.post(
        "/api/activityRate/save",
        formDataPayload,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log("response data for save ::" , response.data)
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
    console.log("Form data for validation:", formData);
    console.log("Activity Rate type:", typeof formData.activityRate, "Value:", formData.activityRate);
    console.log("Max Pax type:", typeof formData.maxPax, "Value:", formData.maxPax);
    console.log("Market Type type:", typeof formData.marketType, "Value:", formData.marketType);
    
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (!editing) return;

    try {
      setIsLoading(true);
      
      const activityTypeValue = String(formData.activityType || "");
      const isPrivate = activityTypeValue === "1";
      const isSic = activityTypeValue === "2";

      const formDataPayload = new FormData();
      formDataPayload.append('providerId', providerId);
      formDataPayload.append('activityRateId', editing.activityRateId || '');
      formDataPayload.append('activityName', formData.activityName);
      formDataPayload.append('activityCode', formData.activityCode);
      formDataPayload.append('activityDetails', formData.activityDetails);
      formDataPayload.append('childAgeMin', formData.childAgeMin);
      formDataPayload.append('childAgeMax', formData.childAgeMax);
      formDataPayload.append('totalUsersAllowed', formData.totalUsersAllowed);
      formDataPayload.append('activityRate', isPrivate ? formData.activityRate : "0");
      formDataPayload.append('maxPax', isPrivate ? formData.maxPax : "0");
      formDataPayload.append('adultRate', isSic ? formData.adultRate : "0");
      formDataPayload.append('adult_rate', isSic ? formData.adultRate : "0");
      formDataPayload.append('childRate', isSic ? formData.childRate : "0");
      formDataPayload.append('child_rate', isSic ? formData.childRate : "0");
      formDataPayload.append('minPax', isSic ? formData.minPax : "0");
      formDataPayload.append('activityType', formData.activityType);
      formDataPayload.append('countryId', formData.countryId);
      formDataPayload.append('placeId', formData.placeId);
      formDataPayload.append('durationHr', formData.durationHr);
      formDataPayload.append('durationMin', formData.durationMin);
      formDataPayload.append('reportingPoint', formData.reportingPoint);
      formDataPayload.append('rating', formData.rating);
      
      // Add market type
      formDataPayload.append('marketType', formData.marketType);

      // Add activity image if provided
      if (formData.activityImage) {
        formDataPayload.append('activityImage', formData.activityImage);
      }

      // Add validity dates
      validityDates.forEach((validity, index) => {
        formDataPayload.append(`validity[${index}].validityFrom`, formatDateForAPI(validity.validityFrom));
        formDataPayload.append(`validity[${index}].validityTo`, formatDateForAPI(validity.validityTo));
      });

      const response = await axiosInstance.put(
        `/api/activityRate/${editing.activityRateId}`,
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
                <Form.Group className="position-relative">
                  <Form.Control
                    type="text"
                    placeholder="Search activity rates by name..."
                    className="form-control-modern-sm"
                    value={searchTerm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchTerm(value);
                      setSearch(value);
                      setPage(0);
                    }}
                    style={{ width: "250px" }}
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
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover striped className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>S/N</th>
                    <th>Activity Name</th>
                    <th>Activity Code</th>
                    <th>Rate</th>
                    <th>Allowed Users</th>
                    <th>Duration</th>
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
                          <FaCog
                            className="text-secondary"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleOpenSettings(rate)}
                            title="Settings"
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

              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <div>
                    <small className="text-muted">
                      Showing {rates.length} of {totalPages * 10} activity rates
                    </small>
                  </div>
                  <div>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={page === 0}
                        onClick={() => fetchActivityRatesList(page - 1, search)}
                      />
                      {[...Array(totalPages).keys()].map((num) => (
                        <Pagination.Item
                          key={num}
                          active={num === page}
                          onClick={() => fetchActivityRatesList(num, search)}
                        >
                          {num + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page === totalPages - 1}
                        onClick={() => fetchActivityRatesList(page + 1, search)}
                      />
                    </Pagination>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Modal */}
          <Modal show={showModal} onHide={closeModal} centered size="xl">
            <Modal.Header closeButton={!isLoading}>
              <Modal.Title>
                {isViewMode
                  ? "View Activity"  
                  : editing
                  ? "Edit Activity"
                  : "Create Activity"}
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
                        onChange={(e) => handleFieldChange('activityName', e.target.value)}
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
                        onChange={(e) => handleFieldChange('activityCode', e.target.value)}
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
                        onChange={(e) => handleFieldChange('activityDetails', e.target.value)}
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
                            onChange={(e) => handleFieldChange('childAgeMin', e.target.value)}
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
                            onChange={(e) => handleFieldChange('childAgeMax', e.target.value)}
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
                        onChange={(e) => handleFieldChange('totalUsersAllowed', e.target.value)}
                        disabled={isViewMode}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        Activity Type <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select
                        value={formData.activityType}
                        onChange={(e) => handleFieldChange('activityType', e.target.value)}
                        disabled={isViewMode}
                        isInvalid={!!validationErrors.activityType}
                      >
                        <option value="">SELECT</option>
                        <option value="1">Private</option>
                        <option value="2">SIC</option>
                       
                      </Form.Select>
                      {validationErrors.activityType && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.activityType}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>

                    {isPrivateActivity && (
                      <>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Activity Rate <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Control
                            type="number"
                            value={formData.activityRate}
                            onChange={(e) => handleFieldChange('activityRate', e.target.value)}
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
                            Maximum Pax <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Control
                            type="number"
                            value={formData.maxPax}
                            onChange={(e) => handleFieldChange('maxPax', e.target.value)}
                            disabled={isViewMode}
                            isInvalid={!!validationErrors.maxPax}
                          />
                          {validationErrors.maxPax && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.maxPax}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </>
                    )}

                    {isSicActivity && (
                      <>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Adult Rate <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Control
                            type="number"
                            value={formData.adultRate}
                            onChange={(e) => handleFieldChange('adultRate', e.target.value)}
                            disabled={isViewMode}
                            isInvalid={!!validationErrors.adultRate}
                          />
                          {validationErrors.adultRate && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.adultRate}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>
                            Child Rate <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Control
                            type="number"
                            value={formData.childRate}
                            onChange={(e) => handleFieldChange('childRate', e.target.value)}
                            disabled={isViewMode}
                            isInvalid={!!validationErrors.childRate}
                          />
                          {validationErrors.childRate && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.childRate}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>
                            Minimum Pax <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Control
                            type="number"
                            value={formData.minPax}
                            onChange={(e) => handleFieldChange('minPax', e.target.value)}
                            disabled={isViewMode}
                            isInvalid={!!validationErrors.minPax}
                          />
                          {validationErrors.minPax && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.minPax}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                      </>
                    )}

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

                    <Form.Group className="mb-3">
                      <Form.Label>
                        <span style={{ color: 'red' }}>*</span>Place
                      </Form.Label>
                      <SearchableSelect
                        name="placeId"
                        value={formData.placeId}
                        onChange={handlePlaceChange}
                        placeholder={isLoadingPlaces ? "Loading places..." : "Search and select place"}
                        options={Array.isArray(places) ? places.map(place => ({ id: place.id, name: place.name })) : []}
                        isInvalid={!!validationErrors.placeId}
                        disabled={isViewMode || !formData.countryId || isLoadingPlaces}
                        isLoading={isLoadingPlaces}
                      />
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
                            onChange={(e) => handleFieldChange('durationHr', e.target.value)}
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
                            onChange={(e) => handleFieldChange('durationMin', e.target.value)}
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
                        Activity Image
                      </Form.Label>
                      <Form.Control
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        disabled={isViewMode}
                      />
                      {formData.activityImagePreview && (
                        <div className="mt-2">
                          <img
                            src={formData.activityImagePreview}
                            alt="Activity preview"
                            style={{
                              maxWidth: "200px",
                              maxHeight: "200px",
                              objectFit: "contain",
                              border: "1px solid #dee2e6",
                              borderRadius: "4px",
                              padding: "4px",
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          {!isViewMode && (
                            <div className="mt-2">
                              <small className="text-muted">
                                Selected image will replace the existing one
                              </small>
                            </div>
                          )}
                        </div>
                      )}
                      {!formData.activityImagePreview && isViewMode && (
                        <div className="mt-2">
                          <small className="text-muted">No image available</small>
                        </div>
                      )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        Reporting Point <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.reportingPoint}
                        onChange={(e) => handleFieldChange('reportingPoint', e.target.value)}
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
                        onChange={(e) => handleFieldChange('rating', e.target.value)}
                        disabled={isViewMode}
                        isInvalid={!!validationErrors.rating}
                      >
                        <option value="">SELECT</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                       
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
                      <Form.Select
                        value={formData.marketType || ""}
                        onChange={handleMarketChange}
                        disabled={isViewMode}
                        isInvalid={!!validationErrors.marketType}
                      >
                       <option value="">Select Market Type</option>
                        {marketTypes.map((market) => (
                          <option key={market.marketTypeId} value={market.marketTypeId}>
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
                              <Form.Label>
                                Validity To
                               
                              </Form.Label>
                              <div className="d-flex gap-2">
                                <Form.Control
                                  type="date"
                                  value={date.validityTo}
                                  onChange={(e) => updateValidityDate(date.id, 'validityTo', e.target.value)}
                                  disabled={isViewMode}
                                  min={getMinValidityToDate(date.validityFrom)}
                                  placeholder={date.validityFrom ? "Select date after " + new Date(date.validityFrom).toLocaleDateString() : "Select end date"}
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

          {/* Settings Modal */}
          <Modal
            show={showSettingsModal}
            onHide={handleCloseSettings}
            size="lg"
            centered
          >
            <Modal.Header 
              style={{ 
                backgroundColor: "#28a745", 
                color: "white",
                borderBottom: "none"
              }}
            >
              <Modal.Title className="w-100 text-center">Inclusion Settings</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ padding: "20px" }}>
              {settingsFetching ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2 text-muted">Loading settings...</p>
                </div>
              ) : (
                <>
              {/* Inclusion Section */}
              <Form.Group className="mb-4">
                <div className="d-flex align-items-center mb-2">
                  <Form.Label className="mb-0 me-2" style={{ color: "#0d6efd", fontWeight: "bold" }}>
                    <span className="text-danger">*</span> INCLUSION
                  </Form.Label>
                  <Button
                    variant="success"
                    size="sm"
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#28a745",
                      borderColor: "#28a745",
                      minWidth: "32px",
                    }}
                    onClick={handleAddInclusion}
                    title="Add Inclusion"
                  >
                    <FaPlus size={18} style={{ color: "white" }} />
                  </Button>
                </div>
                {inclusions.map((inclusion, index) => (
                  <div key={inclusion.id} className="d-flex align-items-start mb-2">
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={inclusion.value}
                      onChange={(e) => handleInclusionChange(inclusion.id, e.target.value)}
                      placeholder="Enter inclusion..."
                      className="me-2"
                    />
                    {inclusions.length > 1 && (
                      <Button
                        variant="danger"
                        size="sm"
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          padding: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          backgroundColor: "#dc3545",
                          borderColor: "#dc3545",
                          minWidth: "32px",
                        }}
                        onClick={() => handleRemoveInclusion(inclusion.id)}
                        title="Remove Inclusion"
                      >
                        <FaTimes size={18} style={{ color: "white" }} />
                      </Button>
                    )}
                  </div>
                ))}
              </Form.Group>

              {/* Terms and Condition Section */}
              <Form.Group className="mb-4">
                <div className="d-flex align-items-center mb-2">
                  <Form.Label className="mb-0 me-2" style={{ color: "#dc3545", fontWeight: "bold" }}>
                    <span className="text-danger">*</span> TERMS AND CONDITION
                  </Form.Label>
                  <Button
                    variant="success"
                    size="sm"
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#28a745",
                      borderColor: "#28a745",
                      minWidth: "32px",
                    }}
                    onClick={handleAddTerm}
                    title="Add Terms and Condition"
                  >
                    <FaPlus size={18} style={{ color: "white" }} />
                  </Button>
                </div>
                {termsAndConditions.map((term, index) => (
                  <div key={term.id} className="d-flex align-items-start mb-2">
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={term.value}
                      onChange={(e) => handleTermChange(term.id, e.target.value)}
                      placeholder="Enter terms and condition..."
                      className="me-2"
                    />
                    {termsAndConditions.length > 1 && (
                      <Button
                        variant="danger"
                        size="sm"
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          padding: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          backgroundColor: "#dc3545",
                          borderColor: "#dc3545",
                          minWidth: "32px",
                        }}
                        onClick={() => handleRemoveTerm(term.id)}
                        title="Remove Terms and Condition"
                      >
                        <FaTimes size={18} style={{ color: "white" }} />
                      </Button>
                    )}
                  </div>
                ))}
              </Form.Group>
              </>
              )}
            </Modal.Body>
            <Modal.Footer style={{ borderTop: "none", padding: "15px 20px" }}>
              <Button
                variant="danger"
                onClick={handleCloseSettings}
                disabled={settingsLoading || settingsFetching}
                style={{ minWidth: "100px" }}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                onClick={handleSaveSettings}
                disabled={settingsLoading || settingsFetching}
                style={{ minWidth: "100px" }}
              >
                {settingsLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Saving...
                  </>
                ) : (
                  <>
                    Create <i className="fas fa-arrow-right ms-2"></i>
                  </>
                )}
              </Button>
              <Button
                variant="primary"
                onClick={handleResetSettings}
                disabled={settingsLoading || settingsFetching}
                style={{ minWidth: "100px" }}
              >
                Reset <i className="fas fa-redo ms-2"></i>
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default ActivityRates;