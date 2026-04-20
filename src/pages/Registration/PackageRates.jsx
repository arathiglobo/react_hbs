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
import Select from "react-select";
import {
  FaEdit,
  FaTrash,
  FaPlus,
  FaBackward,
  FaCopy,
  FaEye,
} from "react-icons/fa";

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
  const [viewMode, setViewMode] = useState(false);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [countries, setCountries] = useState([]);
  const [places, setPlaces] = useState([]);
  const [marketTypes, setMarketTypes] = useState([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [validityList, setValidityList] = useState([
    {
      id: Date.now(),
      validityFrom: "",
      validityTo: "",
    },
  ]);
  const [occupancyList, setOccupancyList] = useState([
    {
      id: Date.now(),
      minimumPax: "",
      maximumPax: "",
    },
  ]);
  const [packageCategories, setPackageCategories] = useState([]);
  const [isLoadingPackageCategories, setIsLoadingPackageCategories] = useState(false);
  const [isAddingValidity, setIsAddingValidity] = useState(false);
  const [isAddingOccupancy, setIsAddingOccupancy] = useState(false);
  const [showRateDetails, setShowRateDetails] = useState(false);
  const [hotelOptions, setHotelOptions] = useState([]);
  const [hotelCache, setHotelCache] = useState({});
  const [isHotelsLoading, setIsHotelsLoading] = useState(false);

  // Refs to track last execution time
  const lastValidityAddTime = useRef(0);
  const lastOccupancyAddTime = useRef(0);
  const countryDebounceRef = useRef(null);
  const placeDebounceRef = useRef(null);
  const hotelDebounceRef = useRef(null);

  const [selectedCountryOption, setSelectedCountryOption] = useState(null);
  const [isCountryLoading, setIsCountryLoading] = useState(false);

  // Get package info from navigation state
  const packageInfo = location.state || {};
  const packageId = packageInfo.package?.packageId || 0;
  const packageName = packageInfo.packageName || "Unknown Package";
  const packageCode = packageInfo.packageCode || "Unknown";

  const [formData, setFormData] = useState({
    packageratesId: "",
    packageId: packageId,
    markettypeId: null,
    packagerateCode: "",
    packageRateValidityDTO: [],
    packageAccommodationrateDTO: [],
    rates: {},
    countryId: "",
    placeId: "",
    noOfNights: "",
  });

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
      console.log(`SearchableSelect (${name}) - value:`, value);
      console.log(`SearchableSelect (${name}) - options:`, options);

      if (!options || !Array.isArray(options)) {
        setFilteredOptions([]);
        return;
      }

      if (searchTerm) {
        const filtered = options.filter((option) => {
          const optionName =
            option.name ||
            option.countryName ||
            option.placeName ||
            option.marketTypeName ||
            String(option);
          return optionName.toLowerCase().includes(searchTerm.toLowerCase());
        });
        setFilteredOptions(filtered);
      } else {
        setFilteredOptions(options);
      }
    }, [searchTerm, options, name]);

    const handleSelect = (option) => {
      try {
        console.log(`SearchableSelect (${name}) - Selecting option:`, option);
        const optionValue = option.id !== undefined ? option.id : option;
        onChange({
          target: {
            name: name,
            value: optionValue,
          },
        });
        setIsOpen(false);
        setSearchTerm("");
        if (onInputChange) onInputChange("");
      } catch (error) {
        console.error(`Error in handleSelect (${name}):`, error);
      }
    };

    const selectedOption = options?.find(
      (option) => String(option.id) === String(value)
    );

    console.log(`SearchableSelect (${name}) - selectedOption:`, selectedOption);

    const displayValue =
      selectedOption?.name ||
      selectedOption?.countryName ||
      selectedOption?.placeName ||
      selectedOption?.marketTypeName ||
      (value ? `Place ID: ${value}` : "");

    return (
      <div className="position-relative">
        <Form.Control
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={(e) => {
            if (disabled) return;
            const val = e.target.value;
            if (isOpen) {
              setSearchTerm(val);
            } else {
              setIsOpen(true);
              setSearchTerm(val);
            }
            if (onInputChange) onInputChange(val);
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          className={`${className || ""} ${isInvalid ? "is-invalid" : ""}`}
          disabled={disabled}
          readOnly={disabled}
          autoComplete="off"
        />

        <div
          className="position-absolute top-50 end-0 translate-middle-y pe-3"
          style={{ pointerEvents: "none" }}
        >
          {isLoading ? (
            <div
              className="spinner-border spinner-border-sm text-muted"
              role="status"
            >
              <span className="visually-hidden">Loading...</span>
            </div>
          ) : (
            <i
              className={`fas fa-chevron-down text-muted ${
                isOpen ? "fa-rotate-180" : ""
              }`}
            ></i>
          )}
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
                    option.placeName ||
                    option.marketTypeName ||
                    String(option)}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-muted">No options found</div>
            )}
          </div>
        )}

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

  const validateForm = (data) => {
    const errors = {};

    if (!data.packagerateCode?.trim())
      errors.packagerateCode = "Rate code is required";
    if (!data.markettypeId) errors.markettypeId = "Market type is required";
    if (!data.countryId) errors.countryId = "Country is required";
    if (!data.placeId) errors.placeId = "Place is required";
    if (!data.noOfNights) errors.noOfNights = "Number of nights is required";

    const invalidValidity = validityList.some(
      (v) => !v.validityFrom || !v.validityTo
    );
    if (invalidValidity)
      errors.validityList = "All validity periods must have from and to dates";

    const invalidOccupancy = occupancyList.some(
      (o) => !o.minimumPax || !o.maximumPax
    );
    if (invalidOccupancy)
      errors.occupancyList = "All occupancy must have minimum and maximum pax";

    const hasEnabledCategory = Object.values(data.rates || {}).some(
      (rate) => rate.enabled === true
    );
    if (!hasEnabledCategory) {
      errors.packageAccommodationrateDTO =
        "At least one package category must be selected";
    }

    return errors;
  };

  const handleCreate = () => {
    setEditing(null);

    const rates = {};
    packageCategories.forEach((category) => {
      const key = (category.packageCategoryId || category.id).toString();
      rates[key] = {
        enabled: false,
        occupancyRates: {}
      };
    });

    setFormData({
      packageratesId: "",
      packageId: packageId,
      markettypeId: null,
      packagerateCode: "",
      packageRateValidityDTO: [],
      packageAccommodationrateDTO: [],
      rates: rates,
      countryId: "",
      placeId: "",
      noOfNights: "",
    });
    setCountries([]);
    setSelectedCountryOption(null);
    setValidityList([
      {
        id: Date.now(),
        validityFrom: "",
        validityTo: "",
      },
    ]);
    setOccupancyList([
      {
        id: Date.now(),
        minimumPax: "",
        maximumPax: "",
      },
    ]);
    setValidationErrors({});
    setShowRateDetails(false);
    setShowModal(true);
    
    // Fetch data on modal open
    fetchCountries("");
    marketTypeList();
    fetchPackageDetails();
    fetchHotels("");
  };

  const fetchPackageRatesList = async (pageNum = 0, searchTerm = search) => {
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
        `/api/packageRates/fullList/${packageId}`
      );
      console.log("package rates list :::", res);

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

  const fetchCountries = async (searchTerm = "") => {
    setIsCountryLoading(true);
    try {
      const res = await axiosInstance.get(
        `/api/country?page=0&limit=20&search=${encodeURIComponent(searchTerm)}`
      );
      if (Array.isArray(res.data)) {
        const options = res.data.map((country) => ({
          value: country.id,
          label: country.name,
        }));
        setCountries(options);
        return options;
      }
      return [];
    } catch (error) {
      console.error("Error fetching countries:", error);
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
      console.log("cityList response:", response.data);
      setPlaces(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log("axios call error for city list : ", error);
      setPlaces([]);
    } finally {
      setIsLoadingPlaces(false);
    }
  };

  const fetchHotels = async (searchTerm = "") => {
    setIsHotelsLoading(true);
    try {
      const res = await axiosInstance.get(
        `/api/hotels?page=0&limit=20&search=${encodeURIComponent(searchTerm)}`
      );
      if (Array.isArray(res.data)) {
        const options = res.data.map((hotel) => ({
          value: hotel.id,
          label: hotel.hotelName || hotel.name || "Unknown Hotel",
        }));
        
        // Update cache
        setHotelCache(prev => {
          const newCache = { ...prev };
          options.forEach(opt => {
            newCache[opt.value] = opt.label;
          });
          return newCache;
        });

        setHotelOptions(options);
        return options;
      }
      return [];
    } catch (error) {
      console.error("Error fetching hotels:", error);
      return [];
    } finally {
      setIsHotelsLoading(false);
    }
  };

  const marketTypeList = async () => {
    try {
      const response = await axiosInstance.get("/api/marketType");
      console.log("Market types API response:", response.data);
      setMarketTypes(response.data);
    } catch (error) {
      console.log("error for market type list :", error);
    }
  };

  const fetchPackageDetails = async () => {
    try {
      setIsLoadingPackageCategories(true);
      const categoriesResponse = await axiosInstance.get(
        `/api/TravelPackage/packageCategories/${packageId}`
      );

      const allCategories = categoriesResponse.data || [];
      console.log("All available package categories:", allCategories);
      setPackageCategories(allCategories);
    } catch (error) {
      console.log("Error fetching package categories:", error);
      setPackageCategories([]);
      toast.error("Failed to load package categories");
    } finally {
      setIsLoadingPackageCategories(false);
    }
  };

  const handleCountryChange = (option) => {
    const value = option ? String(option.value) : "";
    setSelectedCountryOption(option);

    setFormData((prev) => ({
      ...prev,
      countryId: value,
      placeId: "",
    }));

    setPlaces([]);
    setIsLoadingPlaces(false);

    if (value) {
      cityList(value);
    }

    if (validationErrors.countryId) {
      setValidationErrors((prev) => ({ ...prev, countryId: "" }));
    }
    if (validationErrors.placeId) {
      setValidationErrors((prev) => ({ ...prev, placeId: "" }));
    }
  };

  const handlePlaceChange = (e) => {
    const value = e.target.value;
    const stringValue = String(value);

    setFormData((prev) => ({
      ...prev,
      placeId: stringValue,
    }));

    if (validationErrors.placeId) {
      setValidationErrors((prev) => ({ ...prev, placeId: "" }));
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

      const packageRateValidityDTO = validityList.map((validity) => ({
        validityfrom: validity.validityFrom,
        validityto: validity.validityTo,
      }));

      const packageAccommodationrateDTO = occupancyList.map((occupancy) => {
        const enabledCategories = packageCategories.filter((category) => {
          const categoryKey = (category.packageCategoryId || category.id).toString();
          return formData.rates?.[categoryKey]?.enabled === true;
        });

        return {
          countryId: formData.countryId || "",
          placeId: formData.placeId ? [parseInt(formData.placeId)] : [],
          noofnight: formData.noOfNights || "",
          packageAccommodationrateDetailsDTO: enabledCategories.map(
            (category) => {
              const categoryKey = (category.packageCategoryId || category.id).toString();
              const occRate = formData.rates?.[categoryKey]?.occupancyRates?.[occupancy.id] || {};
              return {
                packagecategoryId: categoryKey,
                minpax: occupancy.minimumPax,
                maxpax: occupancy.maximumPax,
                hotelId: occRate.hotelIds || [],
                adultRate: occRate.adultRate || "",
                childRate: occRate.childWithBed || "",
                childRateWithoutbed: occRate.childWithoutBed || "",
              };
            }
          ),
        };
      });

      const payload = {
        packageratesId: "",
        packageId: packageId,
        markettypeId: formData.markettypeId ? [formData.markettypeId] : [],
        packagerateCode: formData.packagerateCode,
        packageRateValidityDTO: packageRateValidityDTO,
        packageAccommodationrateDTO: packageAccommodationrateDTO,
      };

      console.log("package rates save payload::", payload);

      const response = await axiosInstance.post(
        "/api/packageRates/save",
        payload
      );

      if (response.data) {
        toast.success("Package rate added successfully!");
        setValidationErrors({});
        await fetchPackageRatesList(page, search);
        closeModal();
      } else {
        toast.error("Failed to save data!!");
      }
    } catch (error) {
      toast.error(
        `Error!! Something went wrong: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setIsLoading(true);

      const packageRateValidityDTO = validityList.map((validity) => ({
        packagerateValidityId: validity.id || "",
        validityfrom: validity.validityFrom,
        validityto: validity.validityTo,
      }));

      const packageAccommodationrateDTO = occupancyList.map((occupancy) => {
        const enabledCategories = packageCategories.filter((category) => {
          const categoryKey = (category.packageCategoryId || category.id).toString();
          return formData.rates?.[categoryKey]?.enabled === true;
        });

        return {
          packageaccommodationrateId: occupancy.id || "",
          countryId: formData.countryId || "",
          placeId: formData.placeId ? [parseInt(formData.placeId)] : [],
          noofnight: formData.noOfNights || "",
          packageAccommodationrateDetailsDTO: enabledCategories.map(
            (category) => {
              const categoryKey = (category.packageCategoryId || category.id).toString();
              const occRate = formData.rates?.[categoryKey]?.occupancyRates?.[occupancy.id] || {};
              return {
                packagecategoryId: categoryKey,
                minpax: occupancy.minimumPax,
                maxpax: occupancy.maximumPax,
                hotelId: occRate.hotelIds || [],
                adultRate: occRate.adultRate || "",
                childRate: occRate.childWithBed || "",
                childRateWithoutbed: occRate.childWithoutBed || "",
              };
            }
          ),
        };
      });

      const payload = {
        packageratesId: editing.packageratesId,
        packageId: packageId,
        markettypeId: formData.markettypeId ? [formData.markettypeId] : [],
        packagerateCode: formData.packagerateCode,
        packageRateValidityDTO: packageRateValidityDTO,
        packageAccommodationrateDTO: packageAccommodationrateDTO,
      };

      console.log("package rates edit payload::", payload);

      const response = await axiosInstance.put(
        `/api/packageRates/${editing.packageratesId}`,
        payload
      );

      if (response.data) {
        toast.success("Package rate updated successfully!");
        setValidationErrors({});
        setEditing(null);
        await fetchPackageRatesList(page, search);
        closeModal();
      } else {
        toast.error("Failed to update data!!");
      }
    } catch (error) {
      toast.error(
        `Error!! Something went wrong: ${
          error.response?.data?.message || error.message
        }`
      );
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
    setViewMode(false);
    setShowRateDetails(false);
  };

  const openEdit = (item) => {
    setEditing(item);

    // Update hotel cache from the response
    if (item.packageAccommodationrateDTO) {
      const newCache = { ...hotelCache };
      item.packageAccommodationrateDTO.forEach(acc => {
        if (acc.packageAccommodationrateDetailsDTO) {
          acc.packageAccommodationrateDetailsDTO.forEach(detail => {
            if (detail.hotels && Array.isArray(detail.hotels)) {
              detail.hotels.forEach(h => {
                newCache[h.id] = h.name;
              });
            }
          });
        }
      });
      setHotelCache(newCache);
    }

    const rates = {};
    packageCategories.forEach((category) => {
      const key = (category.packageCategoryId || category.id).toString();
      rates[key] = {
        enabled: false,
        occupancyRates: {}
      };
    });

    if (
      item.packageAccommodationrateDTO &&
      item.packageAccommodationrateDTO.length > 0
    ) {
      item.packageAccommodationrateDTO.forEach((accommodation) => {
        const occupancyId = accommodation.packageaccommodationrateId;
        if (accommodation.packageAccommodationrateDetailsDTO) {
           accommodation.packageAccommodationrateDetailsDTO.forEach((detail) => {
            const categoryKey = detail.packagecategoryId.toString();
            if (!rates[categoryKey]) {
              rates[categoryKey] = { enabled: true, occupancyRates: {} };
            }
            rates[categoryKey].enabled = true;
            rates[categoryKey].occupancyRates[occupancyId] = {
              hotelIds: detail.hotelId || [],
              adultRate: detail.adultRate || "",
              childWithBed: detail.childRate || "",
              childWithoutBed: detail.childRateWithoutbed || "",
            };
          });
        }
      });
    }

    const firstAcc = item.packageAccommodationrateDTO?.[0];
    const countryId = firstAcc?.countryId || "";
    const placeId = Array.isArray(firstAcc?.placeId) ? firstAcc.placeId[0] : (firstAcc?.placeId || "");

    console.log("openEdit formData conversion:", { countryId, placeId });

    setFormData({
      packageratesId: item.packageratesId || "",
      packageId: item.packageId || packageId,
      markettypeId: Array.isArray(item.markettypeId) ? item.markettypeId[0] : (item.markettypeId || null),
      packagerateCode: item.packagerateCode || "",
      packageRateValidityDTO: item.packageRateValidityDTO || [],
      packageAccommodationrateDTO: item.packageAccommodationrateDTO || [],
      rates: rates,
      countryId: countryId,
      placeId: placeId,
      noOfNights: firstAcc?.noofnight || "",
    });

    const validityList = item.packageRateValidityDTO?.map((validity) => ({
      id: validity.packagerateValidityId,
      validityFrom: validity.validityfrom,
      validityTo: validity.validityto,
    })) || [{ id: Date.now(), validityFrom: "", validityTo: "" }];

    const occupancyList = item.packageAccommodationrateDTO?.map(
      (accommodation) => {
        // Find first detail to get min/max pax for this occupancy level
        const firstDetail = accommodation.packageAccommodationrateDetailsDTO?.[0];
        return {
          id: accommodation.packageaccommodationrateId,
          minimumPax: firstDetail?.minpax || "",
          maximumPax: firstDetail?.maxpax || "",
        };
      }
    ) || [{ id: Date.now(), minimumPax: "", maximumPax: "" }];

    setValidityList(validityList);
    setOccupancyList(occupancyList);
    setValidationErrors({});

    // Fetch places for the countryId
    if (countryId) {
      cityList(countryId);
      fetchCountries("").then((options) => {
        const matched = (options || []).find(
          (c) => String(c.value) === String(countryId)
        );
        if (matched) {
          setSelectedCountryOption(matched);
        }
      });
    } else {
      setSelectedCountryOption(null);
      fetchCountries("");
    }

    setShowModal(true);
    setShowRateDetails(true);

    // Fetch data on modal open
    marketTypeList();
    fetchPackageDetails();
    fetchHotels("");
  };

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Do you want to delete rate code "${item.packagerateCode}"?`,
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
          `/api/packageRates/${item.packageratesId}`
        );
        if (response.data) {
          toast.success("Package rate deleted successfully!");
          await fetchPackageRatesList(page, search);
        }
      } catch (error) {
        toast.error(
          `Failed to delete package rate: ${
            error.response?.data?.message || error.message
          }`
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleView = async (item) => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get(
        `/api/packageRates/${item.packageratesId}`
      );

      if (response.data) {
        setViewMode(true);
        openEdit(response.data);
        toast.success("Package rate details loaded successfully!");
      }
    } catch (error) {
      toast.error(
        `Failed to fetch package rate details: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = async (item) => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get(
        `/api/packageRates/${item.packageratesId}`
      );

      if (response.data) {
        setViewMode(false);
        openEdit(response.data);
        toast.success("Package rate details loaded successfully!");
      }
    } catch (error) {
      toast.error(
        `Failed to fetch package rate details: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (item) => {
    setEditing(null);

    const rates = {};
    packageCategories.forEach((category) => {
      const key = (category.packageCategoryId || category.id).toString();
      rates[key] = {
        enabled: false,
        occupancyRates: {}
      };
    });

    if (
      item.packageAccommodationrateDTO &&
      item.packageAccommodationrateDTO.length > 0
    ) {
      item.packageAccommodationrateDTO.forEach((accommodation) => {
        const occupancyId = `copy_${Math.random()}`; // Use random ID for copy
        if (accommodation.packageAccommodationrateDetailsDTO) {
          accommodation.packageAccommodationrateDetailsDTO.forEach((detail) => {
            const categoryKey = detail.packagecategoryId.toString();
            if (!rates[categoryKey]) {
              rates[categoryKey] = { enabled: true, occupancyRates: {} };
            }
            rates[categoryKey].enabled = true;
            rates[categoryKey].occupancyRates[occupancyId] = {
              hotelIds: detail.hotelId || [],
              adultRate: detail.adultRate || "",
              childWithBed: detail.childRate || "",
              childWithoutBed: detail.childRateWithoutbed || "",
            };
          });
        }
      });
    }

    setFormData({
      packageratesId: "",
      packageId: packageId,
      markettypeId: item.markettypeId?.[0] || null,
      packagerateCode: `${item.packagerateCode}_COPY`,
      packageRateValidityDTO: [],
      packageAccommodationrateDTO: [],
      rates: rates,
      countryId: item.packageAccommodationrateDTO?.[0]?.countryId || "",
      placeId: item.packageAccommodationrateDTO?.[0]?.placeId?.[0] || "",
      noOfNights: item.packageAccommodationrateDTO?.[0]?.noofnight || "",
    });

    const validityList = item.packageRateValidityDTO?.map((validity) => ({
      id: Date.now() + Math.random(),
      validityFrom: validity.validityfrom,
      validityTo: validity.validityto,
    })) || [{ id: Date.now(), validityFrom: "", validityTo: "" }];

    const occupancyList = item.packageAccommodationrateDTO?.map(
      (accommodation) => ({
        id: Date.now() + Math.random(),
        minimumPax:
          accommodation.packageAccommodationrateDetailsDTO?.[0]?.minpax || "",
        maximumPax:
          accommodation.packageAccommodationrateDetailsDTO?.[0]?.maxpax || "",
      })
    ) || [{ id: Date.now(), minimumPax: "", maximumPax: "" }];

    setValidityList(validityList);
    setOccupancyList(occupancyList);
    setValidationErrors({});
    setShowRateDetails(false);
    setShowModal(true);

    // Fetch data on modal open
    fetchCountries("");
    marketTypeList();
    fetchPackageDetails();
    fetchHotels("");
  };

  const addValidityPeriod = useCallback(
    (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (isAddingValidity) {
        return;
      }

      const currentTime = Date.now();
      const timeSinceLastAdd = currentTime - lastValidityAddTime.current;

      if (timeSinceLastAdd < 1000) {
        return;
      }

      lastValidityAddTime.current = currentTime;
      setIsAddingValidity(true);

      const newValidity = {
        id: `validity_${currentTime}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        validityFrom: "",
        validityTo: "",
      };

      setValidityList((prevList) => {
        const newList = [...prevList, newValidity];
        setTimeout(() => {
          setIsAddingValidity(false);
        }, 100);
        return newList;
      });
    },
    [isAddingValidity]
  );

  const removeValidityPeriod = (id) => {
    if (validityList.length > 1) {
      setValidityList(validityList.filter((v) => v.id !== id));
    }
  };

  const updateValidityPeriod = (id, field, value) => {
    setValidityList(
      validityList.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const addOccupancy = useCallback(
    (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (isAddingOccupancy) {
        return;
      }

      const currentTime = Date.now();
      const timeSinceLastAdd = currentTime - lastOccupancyAddTime.current;

      if (timeSinceLastAdd < 1000) {
        return;
      }

      lastOccupancyAddTime.current = currentTime;
      setIsAddingOccupancy(true);

      const newOccupancy = {
        id: `occupancy_${currentTime}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        minimumPax: "",
        maximumPax: "",
      };

      setOccupancyList((prevList) => {
        const newList = [...prevList, newOccupancy];
        setTimeout(() => {
          setIsAddingOccupancy(false);
        }, 100);
        return newList;
      });
    },
    [isAddingOccupancy]
  );

  const removeOccupancy = (id) => {
    if (occupancyList.length > 1) {
      setOccupancyList(occupancyList.filter((o) => o.id !== id));
    }
  };

  const updateOccupancy = (id, field, value) => {
    setOccupancyList(
      occupancyList.map((o) => (o.id === id ? { ...o, [field]: value } : o))
    );
  };

  const handleSharingTypeChange = (categoryId, checked) => {
    setFormData((prev) => {
      const newRates = { ...prev.rates };
      if (!newRates[categoryId]) {
        newRates[categoryId] = { enabled: false, occupancyRates: {} };
      }
      
      newRates[categoryId] = {
        ...newRates[categoryId],
        enabled: checked,
      };

      // Initialize occupancyRates for this category if not exists
      occupancyList.forEach(occ => {
        if (!newRates[categoryId].occupancyRates[occ.id]) {
          newRates[categoryId].occupancyRates[occ.id] = {
            hotelIds: [],
            adultRate: "",
            childWithBed: "",
            childWithoutBed: ""
          };
        }
      });

      return { ...prev, rates: newRates };
    });
  };

  const handleOccupancyRateChange = (categoryId, occupancyId, field, value) => {
    setFormData((prev) => {
      const newRates = { ...prev.rates };
      if (!newRates[categoryId]) {
        newRates[categoryId] = { enabled: false, occupancyRates: {} };
      }
      if (!newRates[categoryId].occupancyRates[occupancyId]) {
        newRates[categoryId].occupancyRates[occupancyId] = {
          hotelIds: [],
          adultRate: "",
          childWithBed: "",
          childWithoutBed: ""
        };
      }
      
      newRates[categoryId].occupancyRates[occupancyId][field] = value;
      return { ...prev, rates: newRates };
    });
  };

  const handleHotelChange = (categoryId, occupancyId, selectedOptions) => {
    const hotelIds = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
    
    // Ensure selected hotels are in cache
    if (selectedOptions) {
      setHotelCache(prev => {
        const newCache = { ...prev };
        selectedOptions.forEach(opt => {
          newCache[opt.value] = opt.label;
        });
        return newCache;
      });
    }

    handleOccupancyRateChange(categoryId, occupancyId, "hotelIds", hotelIds);
  };

  useEffect(() => {
    // API calls moved to action buttons (Create/Edit) as per requirement
  }, []);

  useEffect(() => {
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

  useEffect(() => {
    if (packageCategories.length > 0 && !editing && !showModal) {
      const rates = {};
      packageCategories.forEach((category) => {
        const key = category.packageCategoryId || category.id;
        rates[key] = {
          enabled: false,
          adultRate: "",
          childWithBed: "",
          childWithoutBed: "",
        };
      });

      setFormData((prev) => ({
        ...prev,
        rates: rates,
      }));
    }
  }, [packageCategories, editing, showModal]);

  useEffect(() => {
    if (showModal && formData.countryId && !places.length && !isLoadingPlaces) {
      cityList(formData.countryId);
    }
  }, [showModal, formData.countryId, places, isLoadingPlaces]);

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
              <Button className="btn-green" onClick={handleCreate} disabled={viewMode}>
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
                    <th style={{ width: 200 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.packageratesId}>
                      <td>{index + 1 + page * 10}</td>
                      <td>{item.packagerateCode || "N/A"}</td>
                      <td>{item.markettypeId?.join(", ") || "N/A"}</td>
                      <td>
                        {item.packageAccommodationrateDTO?.[0]?.noofnight ||
                          "N/A"}
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <FaEye
                            className="text-info view"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleView(item)}
                            title="View"
                          />
                          <FaEdit
                            className="text-primary edit"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleEditClick(item)}
                            title="Edit"
                          />
                          <FaCopy
                            className="text-warning copy"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleCopy(item)}
                            title="Copy"
                            disabled={viewMode}
                          />
                          <FaTrash
                            className="text-danger delete"
                            style={{ cursor: "pointer", fontSize: "18px" }}
                            onClick={() => handleDelete(item)}
                            title="Delete"
                            disabled={viewMode}
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
                {viewMode
                  ? "View Package Rate"
                  : editing
                  ? "Edit Package Rate"
                  : "Create Package Rate"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form onSubmit={editing ? handleEdit : handleSave}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        Rate Code <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter rate code"
                        value={formData.packagerateCode}
                        onChange={(e) => {
                          setFormData((prev) => ({
                            ...prev,
                            packagerateCode: e.target.value,
                          }));
                          if (validationErrors.packagerateCode) {
                            setValidationErrors((prev) => ({
                              ...prev,
                              packagerateCode: undefined,
                            }));
                          }
                        }}
                        isInvalid={!!validationErrors.packagerateCode}
                        readOnly={viewMode}
                      />
                      {validationErrors.packagerateCode && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.packagerateCode}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        Market Type <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select
                        value={formData.markettypeId}
                        onChange={(e) => {
                          const selectedValue = parseInt(e.target.value);
                          setFormData((prev) => ({
                            ...prev,
                            markettypeId: selectedValue,
                          }));
                          if (validationErrors.markettypeId) {
                            setValidationErrors((prev) => ({
                              ...prev,
                              markettypeId: undefined,
                            }));
                          }
                        }}
                        isInvalid={!!validationErrors.markettypeId}
                        disabled={viewMode}
                        readOnly={viewMode}
                      >
                        <option value="">Select Market</option>
                        {marketTypes.map((market) => (
                          <option
                            key={market.marketTypeId}
                            value={market.marketTypeId}
                          >
                            {market.name}
                          </option>
                        ))}
                      </Form.Select>
                      {validationErrors.markettypeId && (
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.markettypeId}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6>Validity List</h6>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={addValidityPeriod}
                          disabled={isAddingValidity || viewMode}
                        >
                          <FaPlus className="me-2" />
                          {isAddingValidity ? "Adding..." : "Add Period"}
                        </Button>
                      </div>
                      {validityList.map((validity, index) => (
                        <Card key={validity.id} className="mb-3">
                          <Card.Header className="d-flex justify-content-between align-items-center">
                            <h6 className="mb-0">
                              Validity Period {index + 1}
                            </h6>
                            {validityList.length > 1 && (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() =>
                                  removeValidityPeriod(validity.id)
                                }
                                disabled={viewMode}
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
                                    onChange={(e) =>
                                      updateValidityPeriod(
                                        validity.id,
                                        "validityFrom",
                                        e.target.value
                                      )
                                    }
                                    readOnly={viewMode}
                                    disabled={viewMode}
                                  />
                                </Form.Group>
                              </Col>
                              <Col md={6}>
                                <Form.Group className="mb-3">
                                  <Form.Label>Validity To</Form.Label>
                                  <Form.Control
                                    type="date"
                                    value={validity.validityTo}
                                    onChange={(e) =>
                                      updateValidityPeriod(
                                        validity.id,
                                        "validityTo",
                                        e.target.value
                                      )
                                    }
                                    readOnly={viewMode}
                                    disabled={viewMode}
                                  />
                                </Form.Group>
                              </Col>
                            </Row>
                          </Card.Body>
                        </Card>
                      ))}
                      {validationErrors.validityList && (
                        <div className="text-danger small">
                          {validationErrors.validityList}
                        </div>
                      )}
                    </div>
                  </Col>

                  <Col md={6}>
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6>Occupancy List</h6>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={addOccupancy}
                          disabled={isAddingOccupancy || viewMode}
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
                                disabled={viewMode}
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
                                    onChange={(e) =>
                                      updateOccupancy(
                                        occupancy.id,
                                        "minimumPax",
                                        e.target.value
                                      )
                                    }
                                    readOnly={viewMode}
                                    disabled={viewMode}
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
                                    onChange={(e) =>
                                      updateOccupancy(
                                        occupancy.id,
                                        "maximumPax",
                                        e.target.value
                                      )
                                    }
                                    readOnly={viewMode}
                                    disabled={viewMode}
                                  />
                                </Form.Group>
                              </Col>
                            </Row>
                          </Card.Body>
                        </Card>
                      ))}
                      {validationErrors.occupancyList && (
                        <div className="text-danger small">
                          {validationErrors.occupancyList}
                        </div>
                      )}
                      
                      {!showRateDetails && (
                        <div className="d-flex justify-content-end mt-4">
                          <Button 
                            variant="primary" 
                            onClick={() => {
                              // Optional: validate top sections before showing details
                              setShowRateDetails(true);
                            }}
                          >
                            Add Rates
                          </Button>
                        </div>
                      )}
                    </div>
                  </Col>
                </Row>

                {showRateDetails && (
                  <>

                <div className="mb-3">
                  <h6 className="border-bottom pb-2 mb-3">RATE DETAILS</h6>
                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Country <span className="text-danger">*</span>
                        </Form.Label>
                        <Select
                          value={selectedCountryOption}
                          onChange={handleCountryChange}
                          onInputChange={(inputValue) => {
                            if (countryDebounceRef.current) {
                              clearTimeout(countryDebounceRef.current);
                            }
                            countryDebounceRef.current = setTimeout(() => {
                              fetchCountries(inputValue);
                            }, 400);
                          }}
                          filterOption={() => true} // Server-side filtering
                          placeholder="Search and select country"
                          isSearchable
                          isClearable
                          isLoading={isCountryLoading}
                          options={countries}
                          isDisabled={viewMode}
                          className={`react-select-container ${
                            validationErrors.countryId ? "is-invalid" : ""
                          }`}
                          classNamePrefix="react-select"
                        />
                        {validationErrors.countryId && (
                          <div className="text-danger small mt-1">
                            {validationErrors.countryId}
                          </div>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Place <span className="text-danger">*</span>
                        </Form.Label>
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
                            !formData.countryId
                              ? "Select country first"
                              : "Search and select place"
                          }
                          options={Array.isArray(places) ? places.map(p => ({ id: p.id, name: p.name || p.stateName })) : []}
                          disabled={!formData.countryId || viewMode}
                          isLoading={isLoadingPlaces}
                          isInvalid={!!validationErrors.placeId}
                        />
                        {validationErrors.placeId && (
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.placeId}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>
                    </Col>
                    <Col md={4}>
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
                          disabled={viewMode}
                          readOnly={viewMode}
                        >
                          <option value="">SELECT</option>
                          {[1, 2, 3, 4].map((val) => (
                            <option key={val} value={val}>
                              {val}
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
                </div>

                <div className="mb-3">
                  <h6>Sharing Options</h6>
                  {isLoadingPackageCategories ? (
                    <div className="text-center py-3">
                      <div
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                      >
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      Loading package categories...
                    </div>
                  ) : Array.isArray(packageCategories) &&
                    packageCategories.length > 0 ? (
                    packageCategories.map((category) => {
                      const categoryKey = (
                        category.packageCategoryId ||
                        category.id ||
                        ""
                      ).toString();
                      return (
                        <Card
                          key={
                            category.packageCategoryId ||
                            category.id ||
                            Math.random()
                          }
                          className="mb-3"
                        >
                          <Card.Header>
                            <FormCheck
                              type="checkbox"
                              label={(
                                category.name ||
                                category.categoryName ||
                                "Unknown"
                              ).toUpperCase()}
                              checked={
                                formData.rates?.[categoryKey]?.enabled || false
                              }
                              onChange={(e) =>
                                handleSharingTypeChange(
                                  categoryKey,
                                  e.target.checked
                                )
                              }
                              disabled={viewMode}
                            />
                          </Card.Header>
                          <Card.Body>
                            {formData.rates?.[categoryKey]?.enabled && (
                              <div className="table-responsive">
                                <Table bordered hover size="sm" className="mb-0">
                                  <thead>
                                    <tr className="bg-light">
                                      {/* <th style={{ minWidth: "100px" }}>Occupancy Type</th> */}
                                      <th style={{ minWidth: "250px" }}>Select Hotel or Similar</th>
                                      <th>Per Adult Rate</th>
                                      <th>Per Child With Bed</th>
                                      <th>Per Child Without Bed</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {occupancyList.map((occ) => {
                                      const occRate = formData.rates?.[categoryKey]?.occupancyRates?.[occ.id] || {};
                                      return (
                                        <tr key={occ.id}>
                                          {/* <td className="align-middle fw-semibold">
                                            {occ.minimumPax} - {occ.maximumPax}
                                          </td> */}
                                          <td className="align-middle">
                                            <Select
                                              isMulti
                                              options={hotelOptions}
                                              value={(occRate.hotelIds || []).map(id => ({
                                                value: id,
                                                label: hotelCache[id] || (isHotelsLoading ? "Loading..." : `Hotel #${id}`)
                                              }))}
                                              onChange={(selectedOptions) => handleHotelChange(categoryKey, occ.id, selectedOptions)}
                                              onInputChange={(inputValue) => {
                                                if (hotelDebounceRef.current) clearTimeout(hotelDebounceRef.current);
                                                hotelDebounceRef.current = setTimeout(() => {
                                                  fetchHotels(inputValue);
                                                }, 400);
                                              }}
                                              filterOption={() => true}
                                              isLoading={isHotelsLoading}
                                              placeholder="Click to Choose..."
                                              isDisabled={viewMode}
                                              className="react-select-container"
                                              classNamePrefix="react-select"
                                              menuPortalTarget={document.body}
                                              styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                                            />
                                          </td>
                                          <td className="align-middle">
                                            <Form.Control
                                              type="number"
                                              value={occRate.adultRate || ""}
                                              onChange={(e) => handleOccupancyRateChange(categoryKey, occ.id, "adultRate", e.target.value)}
                                              placeholder="0"
                                              disabled={viewMode}
                                              readOnly={viewMode}
                                            />
                                          </td>
                                          <td className="align-middle">
                                            <Form.Control
                                              type="number"
                                              value={occRate.childWithBed || ""}
                                              onChange={(e) => handleOccupancyRateChange(categoryKey, occ.id, "childWithBed", e.target.value)}
                                              placeholder="0"
                                              disabled={viewMode}
                                              readOnly={viewMode}
                                            />
                                          </td>
                                          <td className="align-middle">
                                            <Form.Control
                                              type="number"
                                              value={occRate.childWithoutBed || ""}
                                              onChange={(e) => handleOccupancyRateChange(categoryKey, occ.id, "childWithoutBed", e.target.value)}
                                              placeholder="0"
                                              disabled={viewMode}
                                              readOnly={viewMode}
                                            />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </Table>
                              </div>
                            )}
                            {!formData.rates?.[categoryKey]?.enabled && (
                              <div className="text-muted text-center py-2 italic text-sm">
                                Enable sharing option above to enter rates.
                              </div>
                            )}
                          </Card.Body>
                        </Card>
                      );
                    })
                  ) : (
                    <div className="text-center py-3 text-muted">
                      <p>No package categories found for this package.</p>
                      <small>
                        Please ensure the package has categories defined in
                        Package Registration.
                      </small>
                    </div>
                  )}
                  {validationErrors.sharingTypes && (
                    <div className="text-danger small mt-2">
                      {validationErrors.sharingTypes}
                    </div>
                  )}
                </div>
              </>
            )}
            </Form>
            </Modal.Body>
            <Modal.Footer>
              {!viewMode && (
                <>
                  <Button variant="danger" onClick={closeModal}>
                    <i className="fas fa-times me-2"></i>
                    Cancel
                  </Button>
                  <Button
                    variant="success"
                    onClick={editing ? handleEdit : handleSave}
                  >
                    <i className="fas fa-arrow-right me-2"></i>
                    {editing ? "Update" : "Create"}
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default PackageRates;