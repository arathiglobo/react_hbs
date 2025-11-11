import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
    <div className="position-relative">
      <Form.Control
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

const CabProviderReg = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [countries, setCountries] = useState([]);
  const [places, setPlaces] = useState([]);
  const [cabList, setCabList] = useState([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [pickupDropoffList, setPickupDropoffList] = useState([]);
  const [editingCab, setEditingCab] = useState(null);
  const [placeLookup, setPlaceLookup] = useState({});
  const placeOptions = useMemo(() => {
    return Array.isArray(places) ? places : [];
  }, [places]);
  const getPlaceIdString = (cab) => {
    const rawId =
      cab.placeid ??
      cab.placeId ??
      cab.placeID ??
      cab.place_id ??
      cab.place ??
      "";
    return rawId !== undefined && rawId !== null ? String(rawId) : "";
  };

  const resolvePlaceName = (cab, lookup = placeLookup) => {
    const placeId = getPlaceIdString(cab);
    return (
      cab.placeName ||
      cab.stateName ||
      cab.cityName ||
      cab.place ||
      (placeId ? lookup[placeId] : "") ||
      ""
    );
  };

  const normalizeCab = (cab, lookup = placeLookup) => {
    const placeId = getPlaceIdString(cab);
    return {
      ...cab,
      placeid: placeId,
      placeName: resolvePlaceName({ ...cab, placeid: placeId }, lookup),
    };
  };
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
    cabImage: null,
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
    setPickupDropoffList([]);
    setIsLoadingPlaces(false);
    setValidationErrors({});
    setError("");
    setShowModal(true);
  };

  const openEdit = async (item) => {
    console.log("Editing item:", item); // Debug log to see the structure
    console.log("Item keys:", Object.keys(item)); // Debug log to see available keys
    setEditing(item);
    setIsViewMode(false);

    setFormData({
      cabProviderName: item.providername || "",
      contactPerson: item.contactperson || "",
      contactNumber: item.phonenumber || "",
      email: item.emailid || "",
      cabCode: "",
      cabName: "",
      countryId: "",
      placeId: "",
      pickup: "",
      dropOff: "",
    });

    // First, try to use existing cab data from the item
    if (item.cabList && Array.isArray(item.cabList) && item.cabList.length > 0) {
      console.log("Loading existing cab list from item:", item.cabList);
      const normalized = item.cabList.map((cab) => normalizeCab(cab));
      setCabList(normalized);
    } else {
      console.log("No cab list found in item, attempting to fetch detailed data");
      // Try to fetch detailed cab data for this provider
      try {
        console.log("Attempting to fetch detailed cab data for ID:", item.cabprovider || item.id);
        const detailedResponse = await axiosInstance.get(`/api/cabProvider/${item.cabprovider || item.id}`);
        console.log("Detailed cab provider data:", detailedResponse.data);
        
        if (detailedResponse.data && detailedResponse.data.cabList && Array.isArray(detailedResponse.data.cabList)) {
          console.log("Loading detailed cab list:", detailedResponse.data.cabList);
          const normalized = detailedResponse.data.cabList.map((cab) => normalizeCab(cab));
          setCabList(normalized);
        } else if (detailedResponse.data && Array.isArray(detailedResponse.data)) {
          console.log("Loading cab list from array response:", detailedResponse.data);
          const normalized = detailedResponse.data.map((cab) => normalizeCab(cab));
          setCabList(normalized);
        } else {
          console.log("No cab list found in detailed response, setting empty array");
          setCabList([]);
        }
      } catch (error) {
        console.log("Error fetching detailed data:", error);
        setCabList([]);
      }
    }
    
    setPlaces([]);
    setPickupDropoffList([]);
    setEditingCab(null); // Clear any previous editing cab

    setValidationErrors({});
    setShowModal(true);
    
    // Debug log to show final cabList state
    setTimeout(() => {
      console.log("Final cabList state after opening edit:", cabList);
    }, 100);
  };

  const handleView = async (item) => {
    console.log("Viewing item:", item); // Debug log to see the structure
    console.log("Item keys:", Object.keys(item)); // Debug log to see available keys
    setEditing(item);
    setIsViewMode(true);

    // Get the first cab's data to populate form fields
    const firstCab = item.cabList && item.cabList.length > 0 ? item.cabList[0] : null;
    const firstLocation = firstCab && firstCab.cabLocationDTOList && firstCab.cabLocationDTOList.length > 0 ? firstCab.cabLocationDTOList[0] : null;
    
    setFormData({
      cabProviderName: item.providername || "",
      contactPerson: item.contactperson || "",
      contactNumber: item.phonenumber || "",
      email: item.emailid || "",
      cabCode: firstCab ? firstCab.cabCode || "" : "",
      cabName: firstCab ? firstCab.name || "" : "",
      countryId: firstCab ? String(firstCab.countryid || "") : "",
      placeId: firstCab ? String(firstCab.placeid || "") : "",
      pickup: firstLocation ? firstLocation.pickup || "" : "",
      dropOff: firstLocation ? firstLocation.dropoff || "" : "",
    });

    // Populate pickup/dropoff locations from the first cab
    if (firstCab && firstCab.cabLocationDTOList && firstCab.cabLocationDTOList.length > 0) {
      const locations = firstCab.cabLocationDTOList.map((location, index) => ({
        id: location.cablocationId || Date.now() + index,
        pickup: location.pickup || "",
        dropOff: location.dropoff || "",
      }));
      console.log("Setting pickup/dropoff locations for view:", locations);
      setPickupDropoffList(locations);
    } else {
      console.log("No pickup/dropoff locations found for view");
      setPickupDropoffList([]);
    }

    // Load places for the selected country if available
    if (firstCab && firstCab.countryid) {
      cityList(firstCab.countryid);
    }

    // First, try to use existing cab data from the item
    if (item.cabList && Array.isArray(item.cabList) && item.cabList.length > 0) {
      console.log("Loading existing cab list from item for view:", item.cabList);
      const normalized = item.cabList.map((cab) => normalizeCab(cab));
      setCabList(normalized);
    } else {
      console.log("No cab list found in item for view, attempting to fetch detailed data");
      // Try to fetch detailed cab data for this provider
      try {
        console.log("Attempting to fetch detailed cab data for view, ID:", item.cabprovider || item.id);
        const detailedResponse = await axiosInstance.get(`/api/cabProvider/${item.cabprovider || item.id}`);
        console.log("Detailed cab provider data for view:", detailedResponse.data);
        
        if (detailedResponse.data && detailedResponse.data.cabList && Array.isArray(detailedResponse.data.cabList)) {
          console.log("Loading detailed cab list for view:", detailedResponse.data.cabList);
          const normalized = detailedResponse.data.cabList.map((cab) => normalizeCab(cab));
          setCabList(normalized);
        } else if (detailedResponse.data && Array.isArray(detailedResponse.data)) {
          console.log("Loading cab list from array response for view:", detailedResponse.data);
          const normalized = detailedResponse.data.map((cab) => normalizeCab(cab));
          setCabList(normalized);
        } else {
          console.log("No cab list found in detailed response for view, setting empty array");
          setCabList([]);
        }
      } catch (error) {
        console.log("Error fetching detailed data for view:", error);
        setCabList([]);
      }
    }
    
    setPlaces([]);
    // Don't clear pickupDropoffList here - it's set above

    setValidationErrors({});
    setShowModal(true);
    
    // Debug log to show final cabList state for view
    setTimeout(() => {
      console.log("Final cabList state after opening view:", cabList);
      console.log("Final pickupDropoffList state after opening view:", pickupDropoffList);
    }, 100);
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
      setIsLoadingPlaces(true);

      const response = await axiosInstance.get(
        `/api/province/getByCountryId/${countryId}`
      );

      const provinces = Array.isArray(response.data) ? response.data : [];

      const formattedPlaces = provinces
        .map((province) => {
          const rawId =
            province.id ??
            province.stateId ??
            province.placeId ??
            province.provinceId ??
            "";

          const displayName =
            province.stateName ||
            province.name ||
            province.placeName ||
            province.stateCode ||
            "";

          if (!rawId || !displayName) {
            return null;
          }

          return {
            id: String(rawId),
            name: displayName,
          };
        })
        .filter(Boolean);

      setPlaces(formattedPlaces);
      if (formattedPlaces.length > 0) {
        setPlaceLookup((prev) => {
          const next = { ...prev };
          formattedPlaces.forEach((place) => {
            if (place.id) {
              next[place.id] = place.name;
            }
          });
          return next;
        });
      }
    } catch (error) {
      console.log("axios call error for city list : ", error);
      setPlaces([]);
    } finally {
      setIsLoadingPlaces(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const missingPlaceCabs = cabList.filter((cab) => {
      const placeId = String(cab.placeid || cab.placeId || "");
      if (!placeId) return false;
      return !(cab.placeName || placeLookup[placeId]);
    });

    if (missingPlaceCabs.length === 0) {
      return () => {
        isMounted = false;
      };
    }

    const fetchAndUpdatePlaces = async () => {
      const nameUpdates = {};
      const uniqueCountryIds = [
        ...new Set(
          missingPlaceCabs
            .map((cab) => cab.countryid || cab.countryId)
            .filter(Boolean)
        ),
      ];

      for (const countryId of uniqueCountryIds) {
        try {
          const res = await axiosInstance.get(
            `/api/province/getByCountryId/${countryId}`
          );
          const provinces = Array.isArray(res.data) ? res.data : [];
          provinces.forEach((province) => {
            const rawId =
              province.id ??
              province.stateId ??
              province.placeId ??
              province.provinceId ??
              "";
            const displayName =
              province.stateName ||
              province.name ||
              province.placeName ||
              province.stateCode ||
              "";
            if (rawId && displayName) {
              nameUpdates[String(rawId)] = displayName;
            }
          });
        } catch (error) {
          console.log(
            "Failed to load provinces for country",
            countryId,
            error
          );
        }
      }

      if (!isMounted || Object.keys(nameUpdates).length === 0) {
        return;
      }

      setPlaceLookup((prev) => ({
        ...prev,
        ...nameUpdates,
      }));

      setCabList((prev) =>
        prev.map((cab) => {
          const placeId = String(cab.placeid || cab.placeId || "");
          if (!placeId || cab.placeName) {
            return cab;
          }
          const resolvedName =
            nameUpdates[placeId] ||
            placeLookup[placeId] ||
            cab.stateName ||
            cab.place ||
            cab.placeid;
          if (!resolvedName) {
            return cab;
          }
          return {
            ...cab,
            placeName: resolvedName,
          };
        })
      );
    };

    fetchAndUpdatePlaces();

    return () => {
      isMounted = false;
    };
  }, [cabList, placeLookup]);

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

  // Remove duplicate useEffect hooks - country change is handled in handleCountryChange

  // Add cab to list
  const addCabToList = () => {
    if (!formData.cabCode || !formData.cabName || !formData.countryId || !formData.placeId) {
      toast.error("Please fill cab code, name, country and place before adding to list");
      return;
    }

    if (pickupDropoffList.length === 0) {
      toast.error("Please add at least one pickup and dropoff location");
      return;
    }

    // Validate all pickup/dropoff locations
    const invalidLocations = pickupDropoffList.filter(location => !location.pickup.trim() || !location.dropOff.trim());
    if (invalidLocations.length > 0) {
      toast.error("Please fill all pickup and dropoff locations");
      return;
    }

    const placeIdString = String(formData.placeId);
    const selectedPlaceName =
      placeLookup[placeIdString] ||
      placeOptions.find((place) => String(place.id) === placeIdString)?.name ||
      "";

    const newCab = {
      cabId: editingCab ? editingCab.cabId : Date.now(), // Keep existing ID if editing
      cabCode: formData.cabCode,
      name: formData.cabName, // Use 'name' to match your data structure
      countryid: formData.countryId, // Use 'countryid' to match your data structure
      placeid: formData.placeId, // Use 'placeid' to match your data structure
      placeName: selectedPlaceName,
      cabImage: formData.cabImage, // Include the uploaded image
      cabLocationDTOList: pickupDropoffList.map((location, index) => ({
        cablocationId: location.id || Date.now() + index,
        cabid: null,
        pickup: location.pickup,
        dropoff: location.dropOff
      }))
    };

    const normalizedCab = normalizeCab(newCab);
    setCabList((prev) => [...prev, normalizedCab]);
    
    // Clear cab form fields and pickup/dropoff list
    setFormData(prev => ({
      ...prev,
      cabCode: "",
      cabName: "",
      countryId: "",
      placeId: "",
      pickup: "",
      dropOff: "",
      cabImage: null,
    }));
    setPlaces([]);
    setPickupDropoffList([]); // Clear pickup/dropoff list
    setEditingCab(null); // Clear editing cab
  };

  // Remove cab from list
  const removeCabFromList = (cabId) => {
    setCabList(cabList.filter(cab => (cab.cabId || cab.id) !== cabId));
  };

  // Edit existing cab - populate form fields with cab data
  const editCabFromList = (cab) => {
    console.log("Editing cab:", cab);
    
    // Store the cab being edited
    setEditingCab(cab);
    
    // Populate form fields with existing cab data
    setFormData(prev => ({
      ...prev,
      cabCode: cab.cabCode || "",
      cabName: cab.name || "",
      countryId: String(cab.countryid || ""),
      placeId: String(cab.placeid || ""),
      cabImage: cab.cabImage || null,
    }));

    // Set pickup/dropoff locations for editing
    if (cab.cabLocationDTOList && cab.cabLocationDTOList.length > 0) {
      const locations = cab.cabLocationDTOList.map((location, index) => ({
        id: location.cablocationId || Date.now() + index,
        pickup: location.pickup || "",
        dropOff: location.dropoff || "",
      }));
      setPickupDropoffList(locations);
    } else {
      setPickupDropoffList([]);
    }

    // Load places for the selected country
    if (cab.countryid) {
      cityList(cab.countryid);
    }

    // Remove the cab from the list temporarily while editing
    setCabList(cabList.filter(c => (c.cabId || c.id) !== (cab.cabId || cab.id)));
  };

  // Add pickup/dropoff location
  const addPickupDropoff = () => {
    const newLocation = {
      id: Date.now(),
      pickup: "",
      dropOff: "",
    };
    setPickupDropoffList([...pickupDropoffList, newLocation]);
  };

  // Remove pickup/dropoff location
  const removePickupDropoff = (locationId) => {
    setPickupDropoffList(pickupDropoffList.filter(location => location.id !== locationId));
  };

  // Update pickup/dropoff location
  const updatePickupDropoff = (locationId, field, value) => {
    setPickupDropoffList(pickupDropoffList.map(location => 
      location.id === locationId 
        ? { ...location, [field]: value }
        : location
    ));
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

      // Ensure cabList is an array before mapping
      const safeCabList = Array.isArray(cabList) ? cabList : [];
      console.log("cabList in saveCab:", cabList);
      console.log("safeCabList:", safeCabList);

      // Create FormData for file upload
      const formDataPayload = new FormData();
      formDataPayload.append('cabprovider', '');
      formDataPayload.append('providername', formData.cabProviderName);
      formDataPayload.append('phonenumber', formData.contactNumber);
      formDataPayload.append('emailid', formData.email);
      formDataPayload.append('contactperson', formData.contactPerson);
      
      // Add cab list data
      safeCabList.forEach((cab, index) => {
        const prefix = `cabList[${index}]`;
        formDataPayload.append(`${prefix}.cabId`, '');
        formDataPayload.append(`${prefix}.name`, cab.name || cab.cabName || '');
        formDataPayload.append(`${prefix}.cabprovider`, '');
        formDataPayload.append(`${prefix}.cabCode`, cab.cabCode || '');
        formDataPayload.append(`${prefix}.countryid`, cab.countryid || cab.countryId || '');
        formDataPayload.append(`${prefix}.placeid`, String(cab.placeid || cab.placeId || ''));
        formDataPayload.append(`${prefix}.providername`, '');

        const cabPicName =
          cab.cabpic ||
          (cab.cabImage && cab.cabImage.name) ||
          '';
        formDataPayload.append(`${prefix}.cabpic`, cabPicName);

        const cabImageFile =
          cab.cabImage instanceof File
            ? cab.cabImage
            : cab.cabImage && cab.cabImage instanceof Blob
            ? cab.cabImage
            : null;
        if (cabImageFile) {
          formDataPayload.append(`${prefix}.cabImage`, cabImageFile);
        }
        
        if (cab.cabLocationDTOList && cab.cabLocationDTOList.length > 0) {
          cab.cabLocationDTOList.forEach((location, locIndex) => {
            const locPrefix = `${prefix}.cabLocationDTOList[${locIndex}]`;
            formDataPayload.append(`${locPrefix}.cablocationId`, '');
            formDataPayload.append(`${locPrefix}.cabid`, '');
            formDataPayload.append(`${locPrefix}.pickup`, location.pickup || '');
            formDataPayload.append(`${locPrefix}.dropoff`, location.dropoff || location.dropOff || '');
          });
        }
      });

      console.log("formDataPayload:::", formDataPayload);
      const cabSaveResponse = await axiosInstance.post(
        "/api/cabProvider/register",
        formDataPayload,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
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

    console.log("Current cabList when saving:", cabList); // Debug log
    console.log("Editing item:", editing); // Debug log to see the editing item
    
    // Ensure cabList is an array before mapping
    const safeCabList = Array.isArray(cabList) ? cabList : [];
    console.log("safeCabList for edit:", safeCabList);
    
   
    // Create FormData for file upload
    const formDataPayload = new FormData();
    formDataPayload.append('cabprovider', editing.cabprovider || '');
    formDataPayload.append('providername', formData.cabProviderName);
    formDataPayload.append('phonenumber', formData.contactNumber);
    formDataPayload.append('emailid', formData.email);
    formDataPayload.append('contactperson', formData.contactPerson);
    
    // Add cab list data
    safeCabList.forEach((cab, index) => {
        // Find the corresponding cab in editing.cabList by cabId or index
        console.log("cab.cabId:", cab);
        const editingCab = (editing.cabList || []).find(c => c.cabId === cab.cabId) || (editing.cabList || [])[index] || {};
        
        const prefix = `cabList[${index}]`;
        formDataPayload.append(`${prefix}.cabId`, editingCab.cabId || '');
        formDataPayload.append(`${prefix}.name`, cab.name || cab.cabName || '');
        formDataPayload.append(`${prefix}.cabprovider`, '');
        formDataPayload.append(`${prefix}.cabCode`, cab.cabCode || '');
        formDataPayload.append(`${prefix}.countryid`, cab.countryid || cab.countryId || '');
        formDataPayload.append(`${prefix}.placeid`, String(cab.placeid || cab.placeId || ''));
        formDataPayload.append(`${prefix}.providername`, '');

        const cabPicName =
          cab.cabpic ||
          (cab.cabImage && cab.cabImage.name) ||
          '';
        formDataPayload.append(`${prefix}.cabpic`, cabPicName);

        const cabImageFile =
          cab.cabImage instanceof File
            ? cab.cabImage
            : cab.cabImage && cab.cabImage instanceof Blob
            ? cab.cabImage
            : null;
        if (cabImageFile) {
          formDataPayload.append(`${prefix}.cabImage`, cabImageFile);
        }
        
        if (cab.cabLocationDTOList && cab.cabLocationDTOList.length > 0) {
          cab.cabLocationDTOList.forEach((location, locIndex) => {
            const editingLocation = (editingCab.cabLocationDTOList || [])[locIndex] || {};
            const locPrefix = `${prefix}.cabLocationDTOList[${locIndex}]`;
            formDataPayload.append(`${locPrefix}.cablocationId`, editingLocation.cablocationId || '');
            formDataPayload.append(`${locPrefix}.cabid`, '');
            formDataPayload.append(`${locPrefix}.pickup`, location.pickup || '');
            formDataPayload.append(`${locPrefix}.dropoff`, location.dropoff || location.dropOff || '');
          });
        }
    });

    console.log("FormData prepared for edit:", formDataPayload);

    const editRes = await axiosInstance.put(`/api/cabProvider/${editing.cabprovider}`, formDataPayload, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

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
      cabImage: null,
    });
    setCabList([]);
    setPlaces([]);
    setPickupDropoffList([]);
    setIsLoadingPlaces(false);
    setValidationErrors({});
    setError("");
    setEditingCab(null);
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

      const res = await axiosInstance.get(`/api/cabProvider?${params.toString()}`);
      console.log("cab list :::" , res)

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
      title: `Are you sure? You want to delete ${item.providername}`,
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
          .delete(`/api/cabProvider/${item.id}`)
          .then(() => {
            toast.success("Cab Provider deleted successfully");
            fetchCabList(page, search);
          })
          .catch((error) => {
            console.error("Delete error:", error);
            toast.error(`Failed to delete cab provider: ${error.response?.data?.message || error.message}`);
          });
      }
    });
  };

  const handleCabRates = (item) => {
    // Navigate to CabRates page with the cab provider data
    navigate('/cab-rates', { 
      state: { 
        cabProvider: item,
        cabProviderId: item.cabprovider || item.id,
        cabProviderName: item.providername 
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
                      <td>{item.providername}</td>
                      <td>{item.contactperson}</td>
                      <td>{item.phonenumber}</td>
                      <td>{item.emailid}</td>
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
                          <FaDollarSign
                            className="text-success"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleCabRates(item)}
                            title="Cab Rates"
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
                            <span style={{ color: 'red' }}>*</span>STATE
                          </Form.Label>
                          <SearchableSelect
                            name="placeId"
                            value={formData.placeId}
                            onChange={handlePlaceChange}
                            placeholder={
                              isLoadingPlaces
                                ? "Loading states..."
                                : "Search and select state"
                            }
                            options={placeOptions}
                            isInvalid={!!validationErrors.placeId}
                            disabled={
                              isViewMode || !formData.countryId || isLoadingPlaces
                            }
                            isLoading={isLoadingPlaces}
                          />
                          {validationErrors.placeId && (
                                <Form.Control.Feedback type="invalid">
                              {validationErrors.placeId}
                                </Form.Control.Feedback>
                              )}
                            </Form.Group>
                          </Col>
                    </Row>
                    
                    {/* Cab Image Upload */}
                    <Row>
                      <Col md={12}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Cab Image
                          </Form.Label>
                          <Form.Control
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                // Validate file size (max 5MB)
                                if (file.size > 5 * 1024 * 1024) {
                                  toast.error("Image size should be less than 5MB");
                                  return;
                                }
                                // Validate file type
                                if (!file.type.startsWith('image/')) {
                                  toast.error("Please select a valid image file");
                                  return;
                                }
                                setFormData(prev => ({
                                  ...prev,
                                  cabImage: file
                                }));
                              }
                            }}
                            disabled={isViewMode}
                          />
                          {formData.cabImage && (
                            <div className="mt-2">
                              <small className="text-muted">Selected: {formData.cabImage.name}</small>
                              <div className="mt-1">
                                <img 
                                  src={URL.createObjectURL(formData.cabImage)} 
                                  alt="Cab preview" 
                                  style={{ maxWidth: '150px', maxHeight: '100px', objectFit: 'cover' }}
                                  className="border rounded"
                                />
                              </div>
                            </div>
                          )}
                        </Form.Group>
                      </Col>
                    </Row>
                    
                    {/* Pickup and Dropoff Locations */}
                    <div className="mb-3">
                       <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="mb-0">
                          <span style={{ color: 'red' }}>*</span>Pickup & Dropoff Locations
                        </h6>
                        {!isViewMode && (
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={addPickupDropoff}
                            className="d-flex align-items-center gap-1"
                          >
                            <FaPlus size={12} />
                            Add Location
                          </Button>
                        )}
                      </div>

                      {pickupDropoffList.length === 0 && !isViewMode && (
                        <div className="alert alert-info">
                          <small>
                            <i className="fas fa-info-circle me-2"></i>
                            No pickup/dropoff locations added yet. Click "Add Location" to add your first location.
                          </small>
                        </div>
                      )}

                      {pickupDropoffList.map((location, index) => (
                        <Card key={location.id} className="mb-3">
                          <Card.Header className="d-flex justify-content-between align-items-center py-2">
                            <small className="fw-semibold">Location {index + 1}</small>
                            {!isViewMode && (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => removePickupDropoff(location.id)}
                              >
                                <FaTrash size={10} />
                              </Button>
                            )}
                          </Card.Header>
                          <Card.Body className="py-2">
                            <Row>
                              <Col md={6}>
                                <Form.Group className="mb-2">
                                  <Form.Label>
                                    <span style={{ color: 'red' }}>*</span>Pickup
                                  </Form.Label>
                                  <Form.Control
                                    value={location.pickup}
                                    placeholder="Enter pickup location"
                                    {...getFormControlProps(
                                      "pickup",
                                      (e) => updatePickupDropoff(location.id, 'pickup', e.target.value),
                                      {}
                                    )}
                                  />
                                </Form.Group>
                              </Col>
                              <Col md={6}>
                                <Form.Group className="mb-2">
                                  <Form.Label>
                                    <span style={{ color: 'red' }}>*</span>Drop Off
                                  </Form.Label>
                                  <Form.Control
                                    value={location.dropOff}
                                    placeholder="Enter drop off location"
                                    {...getFormControlProps(
                                      "dropOff",
                                      (e) => updatePickupDropoff(location.id, 'dropOff', e.target.value),
                                      {}
                                    )}
                                  />
                                </Form.Group>
                              </Col>
                            </Row>
                          </Card.Body>
                        </Card>
                      ))}
                    </div>
                    {!isViewMode && (
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
                    )}

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
                                <th>Image</th>
                                <th>Pickup & Dropoff Locations</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cabList.map((cab) => (
                                <tr key={cab.cabId || cab.id}>
                                  <td>{cab.cabCode}</td>
                                  <td>{cab.name}</td>
                                  <td>
                                    {countries.find(c => String(c.id) === String(cab.countryid))?.name || cab.countryid}
                                  </td>
                                  <td>
                                    {cab.placeName ||
                                      placeLookup[
                                        String(cab.placeid || cab.placeId || "")
                                      ] ||
                                      placeOptions.find(
                                        (p) =>
                                          String(p.id) ===
                                          String(cab.placeid || cab.placeId)
                                      )?.name ||
                                      cab.stateName ||
                                      cab.place ||
                                      cab.placeid}
                                  </td>
                                  <td>
                                    {cab.cabImage ? (
                                      <img 
                                        src={URL.createObjectURL(cab.cabImage)} 
                                        alt="Cab" 
                                        style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                                        className="border rounded"
                                      />
                                    ) : (
                                      <div 
                                        className="d-flex align-items-center justify-content-center border rounded bg-light"
                                        style={{ width: '50px', height: '50px' }}
                                      >
                                        <small className="text-muted">No Image</small>
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                      {cab.cabLocationDTOList && cab.cabLocationDTOList.length > 0 ? (
                                        cab.cabLocationDTOList.map((location, index) => (
                                          <div key={location.cablocationId || index} className="mb-1 p-2 border rounded bg-light">
                                            <small>
                                              <strong>Location {index + 1}:</strong><br/>
                                              <span className="text-primary">From:</span> {location.pickup}<br/>
                                              <span className="text-success">To:</span> {location.dropoff}
                                            </small>
                                          </div>
                                        ))
                                      ) : (
                                        <small className="text-muted">No locations added</small>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    {!isViewMode && (
                                      <div className="d-flex gap-1">
                                        <Button
                                          variant="outline-primary"
                                          size="sm"
                                          onClick={() => editCabFromList(cab)}
                                          title="Edit Cab"
                                        >
                                          <FaEdit size={10} />
                                        </Button>
                                        <Button
                                          variant="danger"
                                          size="sm"
                                          onClick={() => removeCabFromList(cab.cabId || cab.id)}
                                          title="Delete Cab"
                                        >
                                          <FaTrash size={10} />
                                        </Button>
                                      </div>
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

export default CabProviderReg;