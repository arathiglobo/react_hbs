import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Row,
  Col,
  Tab,
  Tabs,
  FormCheck,
  Pagination,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import axios from "axios";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import Select from "react-select";
import {
  FaEdit,
  FaTrash,
  FaEye,
  FaPlus,
  FaBackward,
  FaDollarSign,
  FaCopy,
  FaChevronDown,
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
  onInputChange,
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
        const optionName = option.name || String(option);
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
      if (onInputChange) onInputChange("");
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
        value={isOpen ? searchTerm : selectedOption?.name || ""}
        onChange={(e) => {
          if (disabled) return;
          const val = e.target.value;
          if (isOpen) {
            setSearchTerm(val);
          } else {
            // If not open, open dropdown and set search term
            setIsOpen(true);
            setSearchTerm(val);
          }
          if (onInputChange) onInputChange(val);
        }}
        onFocus={() => !disabled && setIsOpen(true)}
        placeholder={placeholder}
        className={`form-input pe-5 ${isInvalid ? "is-invalid" : ""}`}
        disabled={disabled}
        readOnly={disabled}
        autoComplete="off"
      />
      <div
        className="position-absolute end-0 top-50 translate-middle-y pe-3"
        style={{ pointerEvents: "none" }}
      >
        <FaChevronDown className="text-muted small" />
      </div>

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

const PackageReg = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currencies, setCurrencies] = useState([]);
  const [formData, setFormData] = useState({
    packageName: "",
    packageCode: "",
    packageBasicRate: "",
    currencyId: "",
    packageType: "",
    packageCategory: [],
    packageImage: null,
    containHotel: false,
    containCab: false,
    containActivity: false,
    status: "Enable",
    arriveCountry: "",
    arrivePlace: [],
    overview: "",
    noOfNights: "1",
  });

  // Additional state for itinerary and others
  const [packageItinearyDTOList, setPackageItinearyDTOList] = useState([
    {
      day: 1,
      heading: "",
      placeId: "",
      dayActivities: "",
      packageItinearyImage: null,
    },
  ]);

  const [packageOthersDTOList, setPackageOthersDTOList] = useState([]);

  const [selectedOthers, setSelectedOthers] = useState([]);
  const [countries, setCountries] = useState([]);
  const [places, setPlaces] = useState([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [allDestinations, setAllDestinations] = useState([]);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [termsAndConditions, setTermsAndConditions] = useState([]);
  const [isLoadingTerms, setIsLoadingTerms] = useState(false);
  const [packageCategories, setPackageCategories] = useState([]);
  const [packageCategoryDropdownOpen, setPackageCategoryDropdownOpen] = useState(false);
  const [packageTypes, setPackageTypes] = useState([]);
  const [isLoadingPackageTypes, setIsLoadingPackageTypes] = useState(false);
  const [isCountryLoading, setIsCountryLoading] = useState(false);
  const countryDebounceRef = useRef(null);
  const placeDebounceRef = useRef(null);
  const itineraryPlaceDebounceRef = useRef(null);
  const [selectedCountryOption, setSelectedCountryOption] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);


  // Helper function to get image URL from path
  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';

    // If it's already a URL, return as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    // If it's a local Windows path, extract filename and convert to web URL
    if (imagePath.includes('\\') || imagePath.includes(':')) {
      // Extract just the filename from the Windows path
      const filename = imagePath.split('\\').pop();

      // Try different possible endpoints - prioritize the most likely ones
      const possibleUrls = [
        `${process.env.REACT_APP_API_BASE_URL}/api/files/${filename}`,
        `${process.env.REACT_APP_API_BASE_URL}/filesSave/details/imageDir/${filename}`,
        `${process.env.REACT_APP_API_BASE_URL}/details/imageDir/${filename}`,
        `${process.env.REACT_APP_API_BASE_URL}/api/TravelPackage/image/${filename}`,
        `${process.env.REACT_APP_API_BASE_URL}/images/${filename}`,
        `${process.env.REACT_APP_API_BASE_URL}/static/images/${filename}`,
        `${process.env.REACT_APP_API_BASE_URL}/uploads/${filename}`,
        `${process.env.REACT_APP_API_BASE_URL}/file/${filename}`,
        `${process.env.REACT_APP_API_BASE_URL}/download/${filename}`,
      ];

      // Log for debugging
      console.log('🔍 Image Debug Info:');
      console.log('📁 Original path:', imagePath);
      console.log('📄 Extracted filename:', filename);
      console.log('🌐 Trying URL:', possibleUrls[0]);
      console.log('📋 All possible URLs:', possibleUrls);

      // Test if the URL is accessible
      fetch(possibleUrls[0])
        .then(response => {
          console.log('✅ URL Response Status:', response.status);
          console.log('✅ URL Response OK:', response.ok);
        })
        .catch(error => {
          console.log('❌ URL Fetch Error:', error);
        });

      // Return the first URL - this is the most common pattern
      return possibleUrls[0];
    }

    // If it's not a Windows path, treat it as a filename
    return `${process.env.REACT_APP_API_BASE_URL}/api/files/${imagePath}`;
  };

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
      className: `${additionalProps.className || ""} ${isViewMode ? "bg-light" : ""
        }`.trim(),
      autoFocus: isViewMode ? false : additionalProps.autoFocus,
    };
  };

  const validateForm = (data) => {
    const errors = {};

    // Basic field validations
    if (!data.packageName?.trim())
      errors.packageName = "Package Name is required";
    if (!data.packageCode?.trim())
      errors.packageCode = "Package Code is required";
    if (!data.packageBasicRate?.trim())
      errors.packageBasicRate = "Package Basic Rate is required";
    if (!data.currencyId || (typeof data.currencyId === 'string' && !data.currencyId.trim()))
      errors.currencyId = "Currency is required";
    if (!data.packageType?.trim())
      errors.packageType = "Package Type is required";
    if (!data.packageCategory?.length)
      errors.packageCategory = "Package Category is required";
    if (!data.countryId || (typeof data.countryId === 'string' && !data.countryId.trim()))
      errors.countryId = "Country is required";
    if (!data.placeId || (typeof data.placeId === 'string' && !data.placeId.trim()))
      errors.placeId = "Place is required";
    if (!data.noOfNights?.trim())
      errors.noOfNights = "No of nights is required";

    // Itinerary validation - at least one day must have data
    const hasItineraryData = packageItinearyDTOList.some(
      (day) =>
        day.heading?.trim() ||
        (day.placeId && (typeof day.placeId === 'string' ? day.placeId.trim() : day.placeId)) ||
        day.dayActivities?.trim()
    );
    if (!hasItineraryData) {
      errors.itinerary =
        "Please enter at least one itinerary day with heading, place, or activities";
    }

    // Others validation - at least one item must be selected (not deleted)
    const hasOthersData = packageOthersDTOList.some(
      (other) => !other.isDeleted
    );
    if (!hasOthersData) {
      errors.others =
        "Please select at least one item in Inclusion, Exclusion, or Terms & Conditions";
    }

    return errors;
  };

  const handleCreate = () => {
    setIsViewMode(false);
    setFormData({
      packageName: "",
      packageCode: "",
      packageBasicRate: "",
      currencyId: "",
      packageType: "",
      packageCategory: [],
      packageImage: null,
      containHotel: false,
      containCab: false,
      containActivity: false,
      status: "Enable",
      countryId: "",
      placeId: "",
      overview: "",
      noOfNights: "1",
    });
    setPackageItinearyDTOList([
      {
        day: 1,
        heading: "",
        placeId: "",
        dayActivities: "",
        packageItinearyImage: null,
      },
    ]);
    setSelectedOthers([]);
    setPlaces([]);

    // Reset packageOthersDTOList to all items selected (not deleted)
    if (termsAndConditions.length > 0) {
      const resetOthersList = termsAndConditions.map((term) => ({
        otherId: term.termsAndConditionsId,
        type: term.description,
        descriptionType: term.descriptionType,
        termsCode: term.termsCode,
        isDeleted: false,
      }));
      setPackageOthersDTOList(resetOthersList);
    }
    setCountries([]); // Clear previous country options
    setSelectedCountryOption(null); // Reset selection
    fetchCountries(""); // Load initial countries
    setValidationErrors({});
    setShowModal(true);
  };

  const fetchPackageList = async (pageNum = 0, searchTerm = search) => {
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
        `/api/TravelPackage?${params.toString()}`
      );
      console.log("package  list :::", res);

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
    fetchPackageList();
    fetchCountries("", 250);
    loadCurrencies();
    loadAllDestinations();
    loadTermsAndConditions();
    packageCategoryList();
    fetchPackageTypes();
  }, []);

  const prepareFormDataPayload = () => {
    const formDataPayload = new FormData();
    formDataPayload.append("packageName", formData.packageName);
    formDataPayload.append("packageType", formData.packageType);
    formDataPayload.append("packageCode", formData.packageCode);
    formDataPayload.append("noOfNights", formData.noOfNights);
    formDataPayload.append("overview", formData.overview || "");
    formDataPayload.append("packageBasicRate", formData.packageBasicRate);
    formDataPayload.append("currencyId", formData.currencyId);
    formDataPayload.append("arriveCountry", formData.countryId);

    if (formData.placeId) {
      formDataPayload.append("arrivePlace", formData.placeId);
    }

    formDataPayload.append("containHotel", formData.containHotel ? 1 : 0);
    formDataPayload.append("containCab", formData.containCab ? 1 : 0);
    formDataPayload.append("containActivity", formData.containActivity ? 1 : 0);

    formData.packageCategory.forEach((category, index) => {
      formDataPayload.append(`packageCategory[${index}]`, String(category));
    });

    packageItinearyDTOList.forEach((itinerary, index) => {
      formDataPayload.append(`packageItinearyDTOList[${index}].day`, itinerary.day);
      formDataPayload.append(`packageItinearyDTOList[${index}].heading`, itinerary.heading || "");
      formDataPayload.append(`packageItinearyDTOList[${index}].placeId`, itinerary.placeId);
      formDataPayload.append(`packageItinearyDTOList[${index}].dayActivities`, itinerary.dayActivities || "");
      if (itinerary.packageItinearyImage) {
        formDataPayload.append(`packageItinearyDTOList[${index}].packageItinearyImage`, itinerary.packageItinearyImage);
      }
    });

    packageOthersDTOList.forEach((other, index) => {
      formDataPayload.append(`packageOthersDTOList[${index}].otherId`, other.otherId);
      formDataPayload.append(`packageOthersDTOList[${index}].type`, other.type || "");
      formDataPayload.append(`packageOthersDTOList[${index}].isDeleted`, other.isDeleted ? "true" : "false");
    });

    formDataPayload.append("liveStatus", formData.status === "true" ? 1 : 0);

    if (formData.packageImage) {
      formDataPayload.append("packageImageFile", formData.packageImage);
    }

    return formDataPayload;
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    const formDataPayload = prepareFormDataPayload();

    try {
      setIsLoading(true);
      const res = await axiosInstance.post("/api/TravelPackage/save", formDataPayload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data) {
        toast.success("Package added successfully!");
        setValidationErrors({});
        await fetchPackageList(page, search);
        closeModal();
      } else {
        toast.error("Failed to save data!!");
      }
    } catch (error) {
      toast.error(`Error!! Something went wrong: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePackage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    const formDataPayload = prepareFormDataPayload();

    try {
      setIsLoading(true);
      const res = await axiosInstance.put(`/api/TravelPackage/${editing.packageId}`, formDataPayload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data) {
        toast.success("Package updated successfully!");
        setValidationErrors({});
        setEditing(null);
        await fetchPackageList(page, search);
        closeModal();
      } else {
        toast.error("Failed to update data!!");
      }
    } catch (error) {
      toast.error(`Error!! Something went wrong: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCountries = async (searchTerm = "", limit = 20) => {
    setIsCountryLoading(true);
    try {
      const res = await axiosInstance.get(
        `/api/country?page=0&limit=${limit}&search=${encodeURIComponent(searchTerm)}`
      );
      if (Array.isArray(res.data)) {
        setCountries(res.data);
        return res.data;
      } else {
        setCountries([]);
        return [];
      }
    } catch (error) {
      console.error("Error fetching countries:", error);
      setCountries([]);
      return [];
    } finally {
      setIsCountryLoading(false);
    }
  };

  const cityList = async (countryId, searchTerm = "") => {
    try {
      setIsLoadingPlaces(true);
      const response = await axiosInstance.get(
        `/api/province?countryId=${countryId}&page=0&limit=50&search=${encodeURIComponent(searchTerm)}`
      );
      setPlaces(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log("axios call error for city list : ", error);
      setPlaces([]);
    } finally {
      setIsLoadingPlaces(false);
    }
  };

  const loadCurrencies = async () => {
    try {
      const response = await axiosInstance.get("/api/currency");

      setCurrencies(response.data || []);
    } catch (error) {

      toast.error("Failed to load currencies");
    }
  };

  const loadAllDestinations = async () => {
    try {
      setIsLoadingDestinations(true);
      const response = await axiosInstance.get(`/api/destination`);
      setAllDestinations(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log("axios call error for all destinations : ", error);
      setAllDestinations([]);
    } finally {
      setIsLoadingDestinations(false);
    }
  };

  const loadTermsAndConditions = async () => {
    try {
      setIsLoadingTerms(true);
      const response = await axiosInstance.get(`/api/master/termsAndCondition`);
      const termsData = Array.isArray(response.data) ? response.data : [];
      setTermsAndConditions(termsData);

      // Initialize packageOthersDTOList with the fetched data
      const initialOthersList = termsData.map((term, index) => ({
        otherId: term.termsAndConditionsId,
        type: term.description,
        descriptionType: term.descriptionType,
        termsCode: term.termsCode,
        isDeleted: false,
      }));
      setPackageOthersDTOList(initialOthersList);
    } catch (error) {
      console.log("axios call error for terms and conditions : ", error);
      setTermsAndConditions([]);
      setPackageOthersDTOList([]);
    } finally {
      setIsLoadingTerms(false);
    }
  };

  const packageCategoryList = async () => {
    try {
      const response = await axiosInstance.get("/api/packageCategory");
      setPackageCategories(response.data);
    } catch (error) {
      console.log("error for package category  list :", error);
    }
  };

  const fetchPackageTypes = async () => {
    try {
      setIsLoadingPackageTypes(true);
      const response = await axiosInstance.get("/api/packageType");
      setPackageTypes(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching package types:", error);
      toast.error("Failed to load package types");
    } finally {
      setIsLoadingPackageTypes(false);
    }
  };

  // Handle country change
  const handleCountryChange = (option) => {
    try {
      const value = option ? option.value : "";
      const selectedCountryName = option ? option.label : "";
      
      setSelectedCountryOption(option);
      
      console.log("Country selected:", value, "Country name:", selectedCountryName);

      // Clear places and place selection when country changes
      setPlaces([]);
      setIsLoadingPlaces(false);

      setFormData((prev) => ({
        ...prev,
        countryId: value,
        placeId: "", // Clear place selection
      }));

      // Fetch cities for the selected country
      if (value) {
        cityList(value);
      }

      // Clear validation errors
      if (validationErrors.countryId) {
        setValidationErrors((prev) => ({
          ...prev,
          countryId: "",
        }));
      }
      if (validationErrors.placeId) {
        setValidationErrors((prev) => ({
          ...prev,
          placeId: "",
        }));
      }
    } catch (error) {
      console.error("Error in handleCountryChange:", error);
    }
  };

  // Handle status toggle
  const handleStatusToggle = (pkg) => {
    setSelectedPackage(pkg);
    setShowStatusModal(true);
  };

  const updatePackageStatus = async () => {
    if (!selectedPackage) return;
    try {
      setIsLoading(true);
      // Determine the new status (if liveStatus is false, it's currently Active, so toggle to true for InActive)
      const newStatus = !selectedPackage.liveStatus;
      
      const res = await axiosInstance.patch(
        `/api/TravelPackage/status/${selectedPackage.packageId}`,
        { liveStatus: newStatus }
      );

      if (res.data) {
        toast.success(`Package ${newStatus ? 'deactivated' : 'activated'} successfully`);
      }

      await fetchPackageList(page, search);
      setShowStatusModal(false);
      setSelectedPackage(null);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(
        `Failed to update status: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle place change
  const handlePlaceChange = (e) => {
    const value = e.target.value;
    const stringValue = String(value); // Convert to string for consistency
    console.log("Place selected:", value);

    setFormData((prev) => ({
      ...prev,
      placeId: stringValue,
    }));

    // Clear validation error when user makes selection
    if (validationErrors.placeId) {
      setValidationErrors((prev) => ({
        ...prev,
        placeId: "",
      }));
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setValidationErrors({});
    setEditing(null);
    setIsViewMode(false);
    setPackageCategoryDropdownOpen(false);
  };

  // CRUD Operations
  const fetchAndShowDetail = async (item, viewMode = false) => {
    try {
      setIsLoading(true);
      const res = await axiosInstance.get(`/api/TravelPackage/${item.packageId}`);
      if (!res.data) throw new Error("No data received from server");
      
      const data = res.data;
      setEditing(data);
      setIsViewMode(viewMode);
      
      setFormData({
        packageName: data.packageName || "",
        packageCode: data.packageCode || "",
        packageBasicRate: data.packageBasicRate || "",
        currencyId: data.currencyId || "",
        packageType: data.packageType || "",
        packageCategory: Array.isArray(data.packageCategory) ? data.packageCategory : (data.packageCategory ? [data.packageCategory] : []),
        packageImage: data.packageImagePath || null,
        containHotel: data.containHotel === 1 || data.containHotel === true,
        containCab: data.containCab === 1 || data.containCab === true,
        containActivity: data.containActivity === 1 || data.containActivity === true,
        status: data.liveStatus === true ? "true" : "false",
        countryId: data.arriveCountry || data.countryId || "",
        placeId: Array.isArray(data.arrivePlace) && data.arrivePlace.length > 0 ? data.arrivePlace[0] : (data.placeId || ""),
        overview: data.overview || "",
        noOfNights: data.noOfNights || "1",
      });

      // Load places for the selected country
      const countryId = data.arriveCountry || data.countryId;
      if (countryId) {
        cityList(countryId);
        fetchCountries("", 250).then((options) => {
          const matched = (options || []).find(c => String(c.id) === String(countryId));
          if (matched) {
            setSelectedCountryOption({ value: matched.id, label: matched.name });
          }
        });
      } else {
        setSelectedCountryOption(null);
      }

      // Load itinerary data
      if (data.packageItinearyDTOList && Array.isArray(data.packageItinearyDTOList)) {
        const updatedItinerary = data.packageItinearyDTOList.map((itinerary) => ({
          day: itinerary.day,
          heading: itinerary.heading || "",
          placeId: itinerary.placeId || "",
          dayActivities: itinerary.dayActivities || "",
          packageItinearyImage: itinerary.packageItinearyImagePath || itinerary.packageItinearyImage || null,
        }));
        setPackageItinearyDTOList(updatedItinerary);
      } else {
        setPackageItinearyDTOList([{ day: 1, heading: "", placeId: "", dayActivities: "", packageItinearyImage: null }]);
      }

      // Load others data
      if (data.packageOthersDTOList && Array.isArray(data.packageOthersDTOList) && termsAndConditions.length > 0) {
        const mergedOthersList = termsAndConditions.map((term) => {
          const backendItem = data.packageOthersDTOList.find((backend) => backend.otherId === term.termsAndConditionsId);
          return {
            otherId: term.termsAndConditionsId,
            type: term.description,
            descriptionType: term.descriptionType,
            termsCode: term.termsCode,
            isDeleted: backendItem ? (backendItem.isDeleted === true || backendItem.isDeleted === "true") : true,
          };
        });
        setPackageOthersDTOList(mergedOthersList);
      }

      setValidationErrors({});
      setShowModal(true);
    } catch (error) {
      console.error("Error fetching package details:", error);
      toast.error("Failed to load package details");
    } finally {
      setIsLoading(false);
    }
  };


  const handleDelete = async (item) => {
    // console.log("Deleting item:", item);
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Do you want to delete "${item.packageName}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        setIsLoading(true);
        const response = await axiosInstance.delete(
          `/api/TravelPackage/${item.packageId}`
        );
        if (response.data) {
          toast.success("Package deleted successfully!");
          await fetchPackageList(page, search);
        }
      } catch (error) {
        toast.error(
          `Failed to delete package: ${error.response?.data?.message || error.message
          }`
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handlePackageRates = (item) => {
    // Navigate to Package Rates page
    // console.log("Navigating to Package Rates for package:", item);
    navigate("/package-rates", {
      state: {
        package: item,
        packageId: item.packageId,
        packageName: item.packageName,
        packageCode: item.packageCode,
      },
    });
  };

  const handleCopy = async (item) => {
    try {
      setIsLoading(true);

      // Prepare form data payload for the copy
      const formDataPayload = new FormData();

      // Basic package details with copied data
      formDataPayload.append("packageName", `${item.packageName} (Copy)`);
      formDataPayload.append("packageType", item.packageType || "");
      formDataPayload.append("packageCode", `${item.packageCode}_COPY`);
      formDataPayload.append("noOfNights", item.noOfNights || "1");
      formDataPayload.append("overview", item.overview || "");
      formDataPayload.append("packageBasicRate", item.packageBasicRate || "");
      formDataPayload.append("currencyId", item.currencyId || "");
      formDataPayload.append(
        "arriveCountry",
        item.arriveCountry || item.countryId || ""
      );

      // Arrive places as array of Long values
      const placeId =
        Array.isArray(item.arrivePlace) && item.arrivePlace.length > 0
          ? item.arrivePlace[0]
          : item.placeId || "";
      if (placeId) {
        formDataPayload.append("arrivePlace", placeId);
      }

      // Include flags as Integer values
      formDataPayload.append(
        "containHotel",
        item.containHotel === 1 || item.containHotel === true ? 1 : 0
      );
      formDataPayload.append(
        "containCab",
        item.containCab === 1 || item.containCab === true ? 1 : 0
      );
      formDataPayload.append(
        "containActivity",
        item.containActivity === 1 || item.containActivity === true ? 1 : 0
      );

      // Package categories as array with proper indexing
      if (item.packageCategory && Array.isArray(item.packageCategory)) {
        item.packageCategory.forEach((category, index) => {
          formDataPayload.append(`packageCategory[${index}]`, String(category));
        });
      }

      // Package itinerary with proper structure (without images for copy)
      if (
        item.packageItinearyDTOList &&
        Array.isArray(item.packageItinearyDTOList)
      ) {
        item.packageItinearyDTOList.forEach((itinerary, index) => {
          formDataPayload.append(
            `packageItinearyDTOList[${index}].day`,
            itinerary.day
          );
          formDataPayload.append(
            `packageItinearyDTOList[${index}].heading`,
            itinerary.heading || ""
          );
          formDataPayload.append(
            `packageItinearyDTOList[${index}].placeId`,
            itinerary.placeId || ""
          );
          formDataPayload.append(
            `packageItinearyDTOList[${index}].dayActivities`,
            itinerary.dayActivities || ""
          );
          // No image for copy - user needs to select new images
        });
      }

      // Package others with proper structure
      if (
        item.packageOthersDTOList &&
        Array.isArray(item.packageOthersDTOList)
      ) {
        item.packageOthersDTOList.forEach((other, index) => {
          formDataPayload.append(
            `packageOthersDTOList[${index}].otherId`,
            other.otherId
          );
          formDataPayload.append(
            `packageOthersDTOList[${index}].type`,
            other.type || ""
          );
          formDataPayload.append(
            `packageOthersDTOList[${index}].isDeleted`,
            other.isDeleted === true || other.isDeleted === "true"
              ? "true"
              : "false"
          );
        });
      }

      // No package image for copy - user needs to select new image

      console.log("package copy payload::", formDataPayload);

      // Create new package
      const packageCopyRes = await axiosInstance.post(
        "/api/TravelPackage/save",
        formDataPayload,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (packageCopyRes.data) {
        toast.success("Package copied successfully!");
        await fetchPackageList(page, search); // Refresh the list
      } else {
        toast.error("Failed to copy package!!");
      }
    } catch (error) {
      toast.error(
        `Error!! Something went wrong: ${error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Itinerary management functions
  const addItineraryDay = () => {
    const newDay = packageItinearyDTOList.length + 1;
    setPackageItinearyDTOList([
      ...packageItinearyDTOList,
      {
        day: newDay,
        heading: "",
        placeId: "",
        dayActivities: "",
        packageItinearyImage: null,
      },
    ]);

    // Clear itinerary validation error when user adds a new day
    if (validationErrors.itinerary) {
      setValidationErrors((prev) => ({ ...prev, itinerary: undefined }));
    }
  };

  const removeItineraryDay = (index) => {
    if (packageItinearyDTOList.length > 1) {
      const updatedItinerary = packageItinearyDTOList.filter(
        (_, i) => i !== index
      );
      // Renumber the days
      const renumberedItinerary = updatedItinerary.map((item, i) => ({
        ...item,
        day: i + 1,
      }));
      setPackageItinearyDTOList(renumberedItinerary);
    }
  };

  const updateItineraryDay = (index, field, value) => {
    const updatedItinerary = packageItinearyDTOList.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    setPackageItinearyDTOList(updatedItinerary);

    // Clear itinerary validation error when user enters data
    if (validationErrors.itinerary) {
      setValidationErrors((prev) => ({ ...prev, itinerary: undefined }));
    }
  };

  const handleItineraryImageUpload = (index, file) => {
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please select a valid image file");
        return;
      }
      updateItineraryDay(index, "packageItinearyImage", file);
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
                {/* <Button
                  variant="outline-primary"
                  onClick={() => navigate(-1)}
                  className="mb-2 me-3"
                  size="sm"
                >
                  <FaBackward className="me-2" />
                  Back to Registration
                </Button> */}
                <span className="fw-semibold">
                  <FaPlus className="me-2 text-success" />
                  Packages
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
                    <th>Package Name</th>
                    <th>Package Code</th>
                    <th>Basic Rate</th>
                    <th>No of Nights</th>
                    <th>Status</th>
                    <th style={{ width: 200 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {console.log("items list:::package cat::", items)}
                  {items.map((item, index) => (
                    <tr key={item.packageId}>
                      <td>{index + 1 + page * 10}</td>
                      <td>{item.packageName || "N/A"}</td>
                      <td>{item.packageCode || "N/A"}</td>
                      <td>{item.packageBasicRate || "N/A"}</td>
                      <td>{item.noOfNights || "N/A"}</td>
                      <td>
                        <span
                          className={`badge ${item.liveStatus === true
                              ? "bg-success"
                              : "bg-danger"
                            }`}
                          style={{ cursor: "pointer" }}
                          onClick={() => handleStatusToggle(item)}
                          title={`Click to ${item.liveStatus === true ? "deactivate" : "activate"} package`}
                        >
                          {item.liveStatus === true ? "Active" : "InActive"}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <FaEdit
                            className="text-primary edit"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => fetchAndShowDetail(item, false)}
                            title="Edit"
                          />
                          <FaEye
                            className="text-info view"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => fetchAndShowDetail(item, true)}
                            title="View"
                          />
                          <FaCopy
                            className="text-warning copy"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleCopy(item)}
                            title="Copy"
                          />
                          <FaDollarSign
                            className="text-success"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handlePackageRates(item)}
                            title="Package Rates"
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
                      <td colSpan={7} className="text-center text-muted py-4">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Loading available packages ....
                      </td>
                    </tr>
                  )}
                  {items.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-4">
                        No packages found.
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
                        onClick={() => fetchPackageList(page - 1, search)}
                      />
                      {[...Array(totalPages).keys()].map((num) => (
                        <Pagination.Item
                          key={num}
                          active={num === page}
                          onClick={() => fetchPackageList(num, search)}
                        >
                          {num + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next
                        disabled={page === totalPages - 1}
                        onClick={() => fetchPackageList(page + 1, search)}
                      />
                    </Pagination>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          <Modal
            show={showModal}
            onHide={closeModal}
            centered
            size="xl"
            backdrop="static"
            keyboard={false}
          >
            <Modal.Header closeButton>
              <Modal.Title>
                {isViewMode
                  ? "View Package Details"
                  : editing
                    ? "Edit Package"
                    : "Create Package"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Tabs defaultActiveKey="basic" id="package-tabs" className="mb-3">
                <Tab eventKey="basic" title="Basic Details">
                  <Form onSubmit={handleSave}>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Package Name <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Enter package name"
                            value={formData.packageName}
                            isInvalid={!!validationErrors.packageName}
                            {...getFormControlProps(
                              "packageName",
                              (e) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  packageName: e.target.value,
                                }));
                                if (validationErrors.packageName) {
                                  setValidationErrors((prev) => ({
                                    ...prev,
                                    packageName: undefined,
                                  }));
                                }
                              },
                              {
                                className: `form-input ${validationErrors.packageName
                                    ? "is-invalid"
                                    : ""
                                  }`,
                                autoFocus: true,
                              }
                            )}
                          />
                          {validationErrors.packageName && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.packageName}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Package Code <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Enter package code"
                            value={formData.packageCode}
                            onChange={(e) => {
                              setFormData((prev) => ({
                                ...prev,
                                packageCode: e.target.value,
                              }));
                              if (validationErrors.packageCode) {
                                setValidationErrors((prev) => ({
                                  ...prev,
                                  packageCode: undefined,
                                }));
                              }
                            }}
                            isInvalid={!!validationErrors.packageCode}
                          />
                          {validationErrors.packageCode && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.packageCode}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Package Basic Rate{" "}
                            <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Control
                            type="number"
                            placeholder="Enter basic rate"
                            value={formData.packageBasicRate}
                            onChange={(e) => {
                              setFormData((prev) => ({
                                ...prev,
                                packageBasicRate: e.target.value,
                              }));
                              if (validationErrors.packageBasicRate) {
                                setValidationErrors((prev) => ({
                                  ...prev,
                                  packageBasicRate: undefined,
                                }));
                              }
                            }}
                            isInvalid={!!validationErrors.packageBasicRate}
                          />
                          {validationErrors.packageBasicRate && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.packageBasicRate}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Currency <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Select
                            value={formData.currencyId}
                            onChange={(e) => {
                              setFormData((prev) => ({
                                ...prev,
                                currencyId: e.target.value,
                              }));
                              if (validationErrors.currencyId) {
                                setValidationErrors((prev) => ({
                                  ...prev,
                                  currencyId: undefined,
                                }));
                              }
                            }}
                            isInvalid={!!validationErrors.currencyId}
                          >
                            <option value="">Select Currency</option>
                            {currencies.map((currency) => (
                              <option
                                key={currency.currencyId}
                                value={currency.currencyId}
                              >
                                {currency.name}
                              </option>
                            ))}
                          </Form.Select>
                          {validationErrors.currencyId && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.currencyId}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Package Type <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Select
                            value={formData.packageType}
                            onChange={(e) => {
                              setFormData((prev) => ({
                                ...prev,
                                packageType: e.target.value,
                              }));
                              if (validationErrors.packageType) {
                                setValidationErrors((prev) => ({
                                  ...prev,
                                  packageType: undefined,
                                }));
                              }
                            }}
                            isInvalid={!!validationErrors.packageType}
                          >
                            <option value="">SELECT</option>
                            {isLoadingPackageTypes ? (
                              <option disabled>Loading...</option>
                            ) : (
                              packageTypes.map((type) => (
                                <option
                                  key={type.packageTypeId}
                                  value={type.packageTypeId}
                                >
                                  {type.name}
                                </option>
                              ))
                            )}
                          </Form.Select>
                          {validationErrors.packageType && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.packageType}
                            </Form.Control.Feedback>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Package Category{" "}
                            <span className="text-danger">*</span>
                          </Form.Label>
                          <div className="position-relative">
                            <Form.Control
                              type="text"
                              value={
                                formData.packageCategory.length > 0
                                  ? `${formData.packageCategory.length} category(ies) selected`
                                  : "Select Package Categories"
                              }
                              onClick={() => {
                                if (!isViewMode) {
                                  setPackageCategoryDropdownOpen(!packageCategoryDropdownOpen);
                                }
                              }}
                              readOnly
                              className={`form-input pe-5 ${validationErrors.packageCategory ? "is-invalid" : ""} ${isViewMode ? "bg-light" : ""}`}
                              style={{ cursor: isViewMode ? "default" : "pointer" }}
                              placeholder="Select Package Categories"
                            />
                            <div
                              className="position-absolute end-0 top-50 translate-middle-y pe-3"
                              style={{ pointerEvents: "none" }}
                            >
                              <FaChevronDown className="text-muted small" />
                            </div>

                            {packageCategoryDropdownOpen && !isViewMode && (
                              <div
                                className="position-absolute w-100 bg-white border border-top-0 rounded-bottom shadow-lg"
                                style={{
                                  zIndex: 1050,
                                  maxHeight: "200px",
                                  overflowY: "auto",
                                  top: "100%",
                                }}
                              >
                                {packageCategories.length > 0 ? (
                                  packageCategories.map((pkgCat) => {
                                    const isSelected = formData.packageCategory.includes(pkgCat.packageCategoryId);
                                    return (
                                      <div
                                        key={pkgCat.packageCategoryId}
                                        className="px-3 py-2"
                                        style={{
                                          cursor: "pointer",
                                          borderBottom: "1px solid #eee",
                                          backgroundColor: isSelected ? "#e3f2fd" : "white",
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isSelected) {
                                            e.target.style.backgroundColor = "#f8f9fa";
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          if (!isSelected) {
                                            e.target.style.backgroundColor = "white";
                                          }
                                        }}
                                        onClick={() => {
                                          setFormData((prev) => {
                                            const newCategories = isSelected
                                              ? prev.packageCategory.filter(id => id !== pkgCat.packageCategoryId)
                                              : [...prev.packageCategory, pkgCat.packageCategoryId];

                                            return {
                                              ...prev,
                                              packageCategory: newCategories,
                                            };
                                          });

                                          // Clear validation error when user makes selection
                                          if (validationErrors.packageCategory) {
                                            setValidationErrors((prev) => ({
                                              ...prev,
                                              packageCategory: undefined,
                                            }));
                                          }
                                        }}
                                      >
                                        <div className="d-flex align-items-center justify-content-between">
                                          <span>{pkgCat.name}</span>
                                          {isSelected && (
                                            <span className="text-primary">✓</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="px-3 py-2 text-muted">No categories available</div>
                                )}
                              </div>
                            )}

                            {/* Overlay to close dropdown when clicking outside */}
                            {packageCategoryDropdownOpen && (
                              <div
                                className="position-fixed"
                                style={{
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  zIndex: 1040,
                                }}
                                onClick={() => setPackageCategoryDropdownOpen(false)}
                              />
                            )}
                          </div>
                          {validationErrors.packageCategory && (
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.packageCategory}
                            </Form.Control.Feedback>
                          )}
                          {formData.packageCategory.length > 0 && (
                            <div className="mt-2">
                              <small className="text-muted">
                                Selected: {formData.packageCategory.map(id => {
                                  const category = packageCategories.find(cat => cat.packageCategoryId === id);
                                  return category ? category.name : `ID: ${id}`;
                                }).join(", ")}
                              </small>
                            </div>
                          )}
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Package Image</Form.Label>
                          <Form.Control
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                packageImage: e.target.files[0],
                              }))
                            }
                            disabled={isViewMode}
                          />
                          {/* Show existing image preview when editing */}
                          {formData.packageImage &&
                            typeof formData.packageImage === "string" && (
                              <div className="mt-2">
                                <small className="text-muted">
                                  Current Image:
                                </small>
                                <div className="mt-1">
                                  <img
                                    src={getImageUrl(formData.packageImage)}
                                    alt="Package preview"
                                    style={{
                                      maxWidth: "200px",
                                      maxHeight: "150px",
                                      objectFit: "cover",
                                    }}
                                    className="border rounded"
                                    onLoad={(e) => {
                                      console.log("Package image loaded successfully:", e.target.src);
                                    }}
                                    onError={(e) => {
                                      console.log("Package image load error:");
                                      console.log("Original path:", formData.packageImage);
                                      console.log("Constructed URL:", e.target.src);
                                      console.log("Error details:", e);
                                      e.target.style.display = "none";
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          {/* Show new image preview when file is selected */}
                          {formData.packageImage &&
                            typeof formData.packageImage === "object" && (
                              <div className="mt-2">
                                <small className="text-muted">
                                  Selected: {formData.packageImage.name}
                                </small>
                                <div className="mt-1">
                                  <img
                                    src={URL.createObjectURL(
                                      formData.packageImage
                                    )}
                                    alt="Package preview"
                                    style={{
                                      maxWidth: "200px",
                                      maxHeight: "150px",
                                      objectFit: "cover",
                                    }}
                                    className="border rounded"
                                  />
                                </div>
                              </div>
                            )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Include</Form.Label>
                          <FormCheck
                            type="checkbox"
                            label="Hotel"
                            checked={formData.containHotel}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                containHotel: e.target.checked,
                              }))
                            }
                          />
                          <FormCheck
                            type="checkbox"
                            label="Cab"
                            checked={formData.containCab}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                containCab: e.target.checked,
                              }))
                            }
                          />
                          <FormCheck
                            type="checkbox"
                            label="Activity"
                            checked={formData.containActivity}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                containActivity: e.target.checked,
                              }))
                            }
                          />
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>Status</Form.Label>
                          <Form.Select
                            value={formData.status}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                status: e.target.value,
                              }))
                            }
                          >
                            <option value="false">Disable</option>
                            <option value="true">Enable</option>
                          </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Arrive Country{" "}
                            <span className="text-danger">*</span>
                          </Form.Label>
                          <Select
                            options={Array.isArray(countries) ? countries.map(c => ({ value: c.id, label: c.name })) : []}
                            value={selectedCountryOption}
                            onChange={handleCountryChange}
                            onInputChange={(inputValue) => {
                              clearTimeout(countryDebounceRef.current);
                              countryDebounceRef.current = setTimeout(() => {
                                fetchCountries(inputValue);
                              }, 400);
                            }}
                            filterOption={() => true} // Server-side filtering
                            placeholder="Search and select country"
                            isSearchable
                            isClearable
                            isLoading={isCountryLoading}
                            readOnly={isViewMode}
                            isDisabled={isViewMode}
                            className={`react-select-container ${validationErrors.countryId ? "is-invalid" : ""}`}
                            classNamePrefix="react-select"
                          />
                          {validationErrors.countryId && (
                            <div className="text-danger small mt-1">
                              {validationErrors.countryId}
                            </div>
                          )}
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Arrive Place <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Group className="mb-3">
                            <SearchableSelect
                              name="placeId"
                              value={formData.placeId}
                              onChange={handlePlaceChange}
                              onInputChange={(inputValue) => {
                                if (placeDebounceRef.current) {
                                  clearTimeout(placeDebounceRef.current);
                                }
                                placeDebounceRef.current = setTimeout(() => {
                                  if (formData.countryId) {
                                    cityList(formData.countryId, inputValue);
                                  }
                                }, 400);
                              }}
                              placeholder={
                                isLoadingPlaces
                                  ? "Loading places..."
                                  : "Search and select place"
                              }
                              options={
                                Array.isArray(places)
                                  ? places.map((place) => ({
                                    id: place.id,
                                    name: place.name || place.stateName,
                                  }))
                                  : []
                              }
                              isInvalid={!!validationErrors.placeId}
                              disabled={
                                isViewMode ||
                                !formData.countryId ||
                                isLoadingPlaces
                              }
                              isLoading={isLoadingPlaces}
                            />
                            {validationErrors.placeId && (
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.placeId}
                              </Form.Control.Feedback>
                            )}
                          </Form.Group>
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>Overview</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={4}
                            placeholder="Enter package overview"
                            value={formData.overview}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                overview: e.target.value,
                              }))
                            }
                          />
                        </Form.Group>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            No of nights <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Select
                            value={formData.noOfNights}
                            onChange={(e) => {
                              setFormData((prev) => ({
                                ...prev,
                                noOfNights: e.target.value,
                              }));
                              if (validationErrors.noOfNights) {
                                setValidationErrors((prev) => ({
                                  ...prev,
                                  noOfNights: undefined,
                                }));
                              }
                            }}
                            isInvalid={!!validationErrors.noOfNights}
                          >
                            {[...Array(15)].map((_, i) => (
                              <option key={i + 1} value={i + 1}>
                                {i + 1}
                              </option>
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
                  </Form>
                </Tab>

                <Tab eventKey="itinerary" title="Itinerary">
                  {validationErrors.itinerary && (
                    <div className="alert alert-danger mb-3">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      {validationErrors.itinerary}
                    </div>
                  )}
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6>Itinerary Details</h6>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={addItineraryDay}
                    >
                      <FaPlus className="me-2" />
                      Add Day
                    </Button>
                  </div>
                  {console.log("packageItinearyDTOList::" , packageItinearyDTOList)}
                  {packageItinearyDTOList.map((day, index) => (
                    <Card key={index} className="mb-3">
                      <Card.Header className="d-flex justify-content-between align-items-center">
                        <h6 className="mb-0">Day {day.day}</h6>
                        {packageItinearyDTOList.length > 1 && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => removeItineraryDay(index)}
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
                              <Form.Label>Place</Form.Label>
                              <SearchableSelect
                                name={`placeId_${index}`}
                                value={day.placeId}
                                onChange={(e) =>
                                  updateItineraryDay(
                                    index,
                                    "placeId",
                                    e.target.value
                                  )
                                }
                                onInputChange={(inputValue) => {
                                  if (itineraryPlaceDebounceRef.current) {
                                    clearTimeout(itineraryPlaceDebounceRef.current);
                                  }
                                  itineraryPlaceDebounceRef.current = setTimeout(() => {
                                    if (formData.countryId) {
                                      cityList(formData.countryId, inputValue);
                                    }
                                  }, 400);
                                }}
                                placeholder={
                                  isLoadingPlaces
                                    ? "Loading places..."
                                    : "Search and select destination"
                                }
                                options={
                                  Array.isArray(places)
                                    ? places.map((place) => ({
                                      id: place.id,
                                      name: place.name || place.stateName,
                                    }))
                                    : []
                                }
                                disabled={isViewMode || !formData.countryId || isLoadingPlaces}
                                isLoading={isLoadingPlaces}
                              />
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Heading</Form.Label>
                              <Form.Control
                                type="text"
                                placeholder="Enter heading"
                                value={day.heading}
                                onChange={(e) =>
                                  updateItineraryDay(
                                    index,
                                    "heading",
                                    e.target.value
                                  )
                                }
                              />
                            </Form.Group>
                          </Col>
                        </Row>
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Day Activities</Form.Label>
                              <Form.Control
                                as="textarea"
                                rows={3}
                                placeholder="Enter day activities"
                                value={day.dayActivities}
                                onChange={(e) =>
                                  updateItineraryDay(
                                    index,
                                    "dayActivities",
                                    e.target.value
                                  )
                                }
                              />
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Day Image</Form.Label>
                              <Form.Control
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleItineraryImageUpload(
                                    index,
                                    e.target.files[0]
                                  )
                                }
                                disabled={isViewMode}
                              />
                              {day.packageItinearyImage && (
                                <div className="mt-2">
                                  <small className="text-muted">
                                    {typeof day.packageItinearyImage ===
                                      "object"
                                      ? `Selected: ${day.packageItinearyImage.name}`
                                      : "Current Image:"}
                                  </small>
                                  <div className="mt-1">
                                    <img
                                      src={
                                        typeof day.packageItinearyImage === "object"
                                          ? URL.createObjectURL(day.packageItinearyImage)
                                          : getImageUrl(day.packageItinearyImage)
                                      }
                                      alt="Day preview"
                                      style={{
                                        maxWidth: "150px",
                                        maxHeight: "100px",
                                        objectFit: "cover",
                                      }}
                                      className="border rounded"
                                      onLoad={(e) => {
                                        console.log("Itinerary image loaded successfully:", e.target.src);
                                      }}
                                      onError={(e) => {
                                        console.log("Itinerary image load error:");
                                        console.log("Original path:", day.packageItinearyImage);
                                        console.log("Constructed URL:", e.target.src);
                                        console.log("Error details:", e);
                                        e.target.style.display = "none";
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </Form.Group>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  ))}
                </Tab>

                <Tab eventKey="others" title="Others">
                  {validationErrors.others && (
                    <div className="alert alert-danger mb-3">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      {validationErrors.others}
                    </div>
                  )}
                  <Row>
                    <Col md={4}>
                      <h6>Inclusion</h6>
                      <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                        {isLoadingTerms ? (
                          <div className="text-center text-muted">
                            Loading inclusions...
                          </div>
                        ) : (
                          packageOthersDTOList
                            .filter((other) => other.descriptionType === 1)
                            .map((other, index) => (
                              <FormCheck
                                key={other.otherId}
                                type="checkbox"
                                label={other.type || `Inclusion ${index + 1}`}
                                checked={!other.isDeleted}
                                onChange={(e) => {
                                  const updatedOthers =
                                    packageOthersDTOList.map((item) =>
                                      item.otherId === other.otherId
                                        ? {
                                          ...item,
                                          isDeleted: !e.target.checked,
                                        }
                                        : item
                                    );
                                  setPackageOthersDTOList(updatedOthers);

                                  // Clear others validation error when user selects items
                                  if (validationErrors.others) {
                                    setValidationErrors((prev) => ({
                                      ...prev,
                                      others: undefined,
                                    }));
                                  }
                                }}
                                disabled={isViewMode}
                              />
                            ))
                        )}
                      </div>
                    </Col>
                    <Col md={4}>
                      <h6>Exclusion</h6>
                      <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                        {isLoadingTerms ? (
                          <div className="text-center text-muted">
                            Loading exclusions...
                          </div>
                        ) : (
                          packageOthersDTOList
                            .filter((other) => other.descriptionType === 2)
                            .map((other, index) => (
                              <FormCheck
                                key={other.otherId}
                                type="checkbox"
                                label={other.type || `Exclusion ${index + 1}`}
                                checked={!other.isDeleted}
                                onChange={(e) => {
                                  const updatedOthers =
                                    packageOthersDTOList.map((item) =>
                                      item.otherId === other.otherId
                                        ? {
                                          ...item,
                                          isDeleted: !e.target.checked,
                                        }
                                        : item
                                    );
                                  setPackageOthersDTOList(updatedOthers);

                                  // Clear others validation error when user selects items
                                  if (validationErrors.others) {
                                    setValidationErrors((prev) => ({
                                      ...prev,
                                      others: undefined,
                                    }));
                                  }
                                }}
                                disabled={isViewMode}
                              />
                            ))
                        )}
                      </div>
                    </Col>
                    <Col md={4}>
                      <h6>Terms and Conditions</h6>
                      <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                        {isLoadingTerms ? (
                          <div className="text-center text-muted">
                            Loading terms & conditions...
                          </div>
                        ) : (
                          packageOthersDTOList
                            .filter((other) => other.descriptionType === 3)
                            .map((other, index) => (
                              <FormCheck
                                key={other.otherId}
                                type="checkbox"
                                label={other.type || `Terms ${index + 1}`}
                                checked={!other.isDeleted}
                                onChange={(e) => {
                                  const updatedOthers =
                                    packageOthersDTOList.map((item) =>
                                      item.otherId === other.otherId
                                        ? {
                                          ...item,
                                          isDeleted: !e.target.checked,
                                        }
                                        : item
                                    );
                                  setPackageOthersDTOList(updatedOthers);

                                  // Clear others validation error when user selects items
                                  if (validationErrors.others) {
                                    setValidationErrors((prev) => ({
                                      ...prev,
                                      others: undefined,
                                    }));
                                  }
                                }}
                                disabled={isViewMode}
                              />
                            ))
                        )}
                      </div>
                    </Col>
                  </Row>
                </Tab>
              </Tabs>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="danger" onClick={closeModal}>
                <i className="fas fa-times me-2"></i>
                {isViewMode ? "Close" : "Cancel"}
              </Button>
              {!isViewMode && (
                <Button variant="success" onClick={editing ? handleUpdatePackage : handleSave}>
                  <i className="fas fa-arrow-right me-2"></i>
                  {editing ? "Update" : "Create"}
                </Button>
              )}
            </Modal.Footer>
          </Modal>

          {/* Status Toggle Modal */}
          <Modal
            show={showStatusModal}
            onHide={() => !isLoading && setShowStatusModal(false)}
            centered
            size="sm"
            backdrop="static"
            keyboard={false}
          >
            <Modal.Header closeButton={!isLoading}>
              <Modal.Title>Confirm Status Change</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p>
                Are you sure you want to{" "}
                {selectedPackage?.liveStatus === true ? "deactivate" : "activate"} this package?
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => setShowStatusModal(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={updatePackageStatus}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Processing...
                  </>
                ) : (
                  "Confirm"
                )}
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default PackageReg;
