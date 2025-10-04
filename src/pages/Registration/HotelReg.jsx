import React, { useEffect, useState } from "react";
import {
  Card,
  Button,
  Form,
  Row,
  Col,
  Tabs,
  Tab,
  Badge,
  Alert,
  Container,
  ProgressBar,
  Spinner,
} from "react-bootstrap";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { 
  FaPlus, 
  FaTrash, 
  FaSave, 
  FaHotel, 
  FaMapMarkerAlt, 
  FaPhone, 
  FaUniversity, 
  FaCalendarAlt, 
  FaSwimmingPool, 
  FaBed, 
  FaFileContract,
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle
} from "react-icons/fa";

const HotelReg = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;
  
  // Master data states
  const [currencies, setCurrencies] = useState([]);
  const [hotelCategories, setHotelCategories] = useState([]);
  const [hotelTypes, setHotelTypes] = useState([]);
  const [markupTypes, setMarkupTypes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [countries, setCountries] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [places, setPlaces] = useState([]);
  const [contactTypes, setContactTypes] = useState([]);
  const [banks, setBanks] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [roomCategories, setRoomCategories] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [filteredRoomTypes, setFilteredRoomTypes] = useState({});

  // Form data state
  const [formData, setFormData] = useState({
    hotelName: "",
    hotelDescription: "",
    image360: "",
    address: "",
    zipcode: "",
    latitude: "",
    longitude: "",
    childComAgeMin: "",
    childComAgeMax: "",
    childChargeableAgeMin: "",
    childChargeableAgeMax: "",
    hotelCurrencyId: "",
    hotelCategoryId: "",
    hotelTypeId: "",
    markupTypeId: "",
    regionId: "",
    countryId: "",
    stateId: "",
    placeId: "",
    isDeleted: false,
    contactDetails: [],
    bankDetails: [],
    weekDays: {
      wdSunday: false,
      wdMonday: false,
      wdTuesday: false,
      wdWednesday: false,
      wdThursday: false,
      wdFriday: false,
      wdSaturday: false,
      wedSunday: false,
      wedMonday: false,
      wedTuesday: false,
      wedWednesday: false,
      wedThursday: false,
      wedFriday: false,
      wedSaturday: false,
    },
    rooms: [],
    termsAndConditions: [],
    amenityIds: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isLoadingHotelData, setIsLoadingHotelData] = useState(false);

  // Weekdays configuration
  const weekdays = [
    { key: "wdSunday", label: "Sunday" },
    { key: "wdMonday", label: "Monday" },
    { key: "wdTuesday", label: "Tuesday" },
    { key: "wdWednesday", label: "Wednesday" },
    { key: "wdThursday", label: "Thursday" },
    { key: "wdFriday", label: "Friday" },
    { key: "wdSaturday", label: "Saturday" },
  ];

  // Load hotel data for edit mode
  const loadHotelData = async () => {
    if (!isEditMode) return;
    
    try {
      setIsLoadingHotelData(true);
      const response = await axiosInstance.get(`/api/hotels/${id}`);
      const hotelData = response.data;
      
      console.log("Loaded hotel data for edit:", hotelData);
      
      // Pre-fill form data
      setFormData({
        hotelName: hotelData.hotelName || "",
        hotelDescription: hotelData.hotelDescription || "",
        image360: hotelData.image360 || "",
        address: hotelData.address || "",
        zipcode: hotelData.zipcode || "",
        latitude: hotelData.latitude || "",
        longitude: hotelData.longitude || "",
        childComAgeMin: hotelData.childComAgeMin || "",
        childComAgeMax: hotelData.childComAgeMax || "",
        childChargeableAgeMin: hotelData.childChargeableAgeMin || "",
        childChargeableAgeMax: hotelData.childChargeableAgeMax || "",
        hotelCurrencyId: hotelData.hotelCurrencyId || "",
        hotelCategoryId: hotelData.hotelCategoryId || "",
        hotelTypeId: hotelData.hotelTypeId || "",
        markupTypeId: hotelData.markupTypeId || "",
        regionId: hotelData.regionId || "",
        countryId: hotelData.countryId || "",
        stateId: hotelData.stateId || "",
        placeId: hotelData.placeId || "",
        isDeleted: hotelData.isDeleted || false,
        contactDetails: hotelData.contactDetails || [],
        bankDetails: hotelData.bankDetails || [],
        weekDays: hotelData.weekDays || {
          wdSunday: false,
          wdMonday: false,
          wdTuesday: false,
          wdWednesday: false,
          wdThursday: false,
          wdFriday: false,
          wdSaturday: false,
          wedSunday: false,
          wedMonday: false,
          wedTuesday: false,
          wedWednesday: false,
          wedThursday: false,
          wedFriday: false,
          wedSaturday: false,
        },
        rooms: hotelData.rooms ? hotelData.rooms.map(room => ({
          ...room,
          roomTypes: room.roomTypes || []
        })) : [],
        termsAndConditions: hotelData.termsAndConditions || [],
        amenityIds: hotelData.amenityIds || [],
      });
      
      // Load dependent data for location
      if (hotelData.countryId) {
        await loadProvinces(hotelData.countryId);
      }
      if (hotelData.stateId) {
        await loadPlaces(hotelData.stateId);
      }
      
    } catch (error) {
      console.error("Error loading hotel data:", error);
      toast.error("Failed to load hotel data for editing");
      navigate("/registration/hotel");
    } finally {
      setIsLoadingHotelData(false);
    }
  };

  // Load master data on component mount
  useEffect(() => {
    loadCurrencies();
    loadHotelCategories();
    loadHotelTypes();
    loadMarkupTypes();
    loadRegions();
    loadCountries();
    loadContactTypes();
    loadBanks();
    loadAmenities();
    loadRoomCategories();
    loadRoomTypes();
  }, []);

  // Load hotel data for edit mode
  useEffect(() => {
    if (isEditMode) {
      loadHotelData();
    }
  }, [isEditMode, id]);

  // Load dependent data when country/province changes
  useEffect(() => {
    if (formData.countryId) {
      loadProvinces(formData.countryId);
      setPlaces([]);
      setFormData(prev => ({ ...prev, stateId: "", placeId: "" }));
    }
  }, [formData.countryId]);

  useEffect(() => {
    if (formData.stateId) {
      loadPlaces(formData.stateId);
      setFormData(prev => ({ ...prev, placeId: "" }));
    }
  }, [formData.stateId]);

  // Load currencies
  const loadCurrencies = async () => {
    try {
      const response = await axiosInstance.get("/api/currency");
      console.log("Currencies response:", response.data);
      setCurrencies(response.data || []);
    } catch (error) {
      console.error("Error loading currencies:", error);
      toast.error("Failed to load currencies");
    }
  };

  // Load hotel categories
  const loadHotelCategories = async () => {
    try {
      const response = await axiosInstance.get("/api/hotelcategory");
      console.log("Hotel Categories response:", response.data);
      setHotelCategories(response.data || []);
    } catch (error) {
      console.error("Error loading hotel categories:", error);
      toast.error("Failed to load hotel categories");
    }
  };

  // Load hotel types
  const loadHotelTypes = async () => {
    try {
      const response = await axiosInstance.get("/api/hotelType");
      console.log("Hotel Types response:", response.data);
      setHotelTypes(response.data || []);
    } catch (error) {
      console.error("Error loading hotel types:", error);
      toast.error("Failed to load hotel types");
    }
  };

  // Load markup types
  const loadMarkupTypes = async () => {
    try {
      const response = await axiosInstance.get("/api/markupType");
      console.log("Markup Types response:", response.data);
      setMarkupTypes(response.data || []);
    } catch (error) {
      console.error("Error loading markup types:", error);
      toast.error("Failed to load markup types");
    }
  };

  // Load regions
  const loadRegions = async () => {
    try {
      const response = await axiosInstance.get("/api/region");
      console.log("Regions response:", response.data);
      setRegions(response.data || []);
    } catch (error) {
      console.error("Error loading regions:", error);
      toast.error("Failed to load regions");
    }
  };

  // Load countries
  const loadCountries = async () => {
    try {
      const response = await axiosInstance.get("/api/country");
      console.log("Countries response:", response.data);
      setCountries(response.data || []);
    } catch (error) {
      console.error("Error loading countries:", error);
      toast.error("Failed to load countries");
    }
  };

  // Load contact types
  const loadContactTypes = async () => {
    try {
      const response = await axiosInstance.get("/api/contacttype");
      console.log("Contact Types response:", response.data);
      setContactTypes(response.data || []);
    } catch (error) {
      console.error("Error loading contact types:", error);
      toast.error("Failed to load contact types");
    }
  };

  // Load banks
  const loadBanks = async () => {
    try {
      const response = await axiosInstance.get("/api/bank");
      console.log("Banks response:", response.data);
      setBanks(response.data || []);
    } catch (error) {
      console.error("Error loading banks:", error);
      toast.error("Failed to load banks");
    }
  };

  // Load amenities
  const loadAmenities = async () => {
    try {
      const response = await axiosInstance.get("/api/hotelAmenity");
      console.log("Amenities response:", response.data);
      setAmenities(response.data || []);
    } catch (error) {
      console.error("Error loading amenities:", error);
      toast.error("Failed to load amenities");
    }
  };

  // Load room categories
  const loadRoomCategories = async () => {
    try {
      const response = await axiosInstance.get("/api/roomCategory");
      console.log("Room Categories response:", response.data);
      setRoomCategories(response.data || []);
    } catch (error) {
      console.error("Error loading room categories:", error);
      toast.error("Failed to load room categories");
    }
  };

  // Load room types
  const loadRoomTypes = async () => {
    try {
      const response = await axiosInstance.get("/api/roomType");
      console.log("Room Types response:", response.data);
      setRoomTypes(response.data || []);
    } catch (error) {
      console.error("Error loading room types:", error);
      toast.error("Failed to load room types");
    }
  };

  const loadProvinces = async (countryId) => {
    try {
      const response = await axiosInstance.get(`/api/province/getByCountryId/${countryId}`);
      setProvinces(response.data || []);
    } catch (error) {
      console.error("Error loading provinces:", error);
      toast.error("Failed to load provinces");
    }
  };

  const loadPlaces = async (stateId) => {
    try {
      const response = await axiosInstance.get(`/api/destination/getplaces/${stateId}`);
      setPlaces(response.data || []);
    } catch (error) {
      console.error("Error loading places:", error);
      toast.error("Failed to load places");
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleWeekdayChange = (e) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      weekDays: {
        ...prev.weekDays,
        [name]: checked
      }
    }));
  };

  const handleWeekEndDayChange = (e) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      weekDays: {
        ...prev.weekDays,
        [name]: checked
      }
    }));
  };

  const handleAmenityChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      amenityIds: checked
        ? [...prev.amenityIds, parseInt(value)]
        : prev.amenityIds.filter(id => id !== parseInt(value))
    }));
  };

  // Contact Details Management
  const addContactDetail = () => {
    setFormData(prev => ({
      ...prev,
      contactDetails: [
        ...prev.contactDetails,
        {
          contactTypeId: "",
          contactPerson: "",
          personalEmail: "",
          teleNumber: "",
          mobileNumber: "",
        }
      ]
    }));
  };

  const removeContactDetail = (index) => {
    setFormData(prev => ({
      ...prev,
      contactDetails: prev.contactDetails.filter((_, i) => i !== index)
    }));
  };

  const updateContactDetail = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      contactDetails: prev.contactDetails.map((contact, i) =>
        i === index ? { ...contact, [field]: value } : contact
      )
    }));
  };

  // Bank Details Management
  const addBankDetail = () => {
    setFormData(prev => ({
      ...prev,
      bankDetails: [
        ...prev.bankDetails,
        {
          bankId: "",
          accountNo: "",
          iban: "",
          swiftCode: "",
          bankAddress: "",
          telephone: "",
          faxNumber: "",
          contactPerson: "",
        }
      ]
    }));
  };

  const removeBankDetail = (index) => {
    setFormData(prev => ({
      ...prev,
      bankDetails: prev.bankDetails.filter((_, i) => i !== index)
    }));
  };

  const updateBankDetail = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      bankDetails: prev.bankDetails.map((bank, i) =>
        i === index ? { ...bank, [field]: value } : bank
      )
    }));
  };

  // Rooms Management
  const addRoom = () => {
    setFormData(prev => ({
      ...prev,
      rooms: [
        ...prev.rooms,
        {
          roomCategoryId: "",
          roomTypes: [],
          roomName: "",
        }
      ]
    }));
  };

  const removeRoom = (index) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.filter((_, i) => i !== index)
    }));
  };

  const updateRoom = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.map((room, i) => {
        if (i === index) {
          const updatedRoom = { ...room, [field]: value };
          
          if (field === 'roomCategoryId' && value) {
            loadRoomTypesForCategory(value, index);
            updatedRoom.roomTypes = [];
          }
          
          return updatedRoom;
        }
        return room;
      })
    }));
  };

  // Load room types for a specific room category
  const loadRoomTypesForCategory = async (roomCategoryId, roomIndex) => {
    try {
      const response = await axiosInstance.get(`/api/roomType?roomCategoryId=${roomCategoryId}`);
      setFilteredRoomTypes(prev => ({
        ...prev,
        [roomIndex]: response.data || []
      }));
    } catch (error) {
      console.error("Error loading room types for category:", error);
      toast.error("Failed to load room types for selected category");
    }
  };

  // Room Type Management within a room category
  const addRoomType = (roomIndex) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.map((room, i) =>
        i === roomIndex 
          ? { ...room, roomTypes: [...room.roomTypes, { roomTypeId: "", roomName: "" }] }
          : room
      )
    }));
  };

  const removeRoomType = (roomIndex, roomTypeIndex) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.map((room, i) =>
        i === roomIndex 
          ? { ...room, roomTypes: room.roomTypes.filter((_, j) => j !== roomTypeIndex) }
          : room
      )
    }));
  };

  const updateRoomType = (roomIndex, roomTypeIndex, field, value) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.map((room, i) =>
        i === roomIndex 
          ? { 
              ...room, 
              roomTypes: room.roomTypes.map((roomType, j) =>
                j === roomTypeIndex ? { ...roomType, [field]: value } : roomType
              )
            }
          : room
      )
    }));
  };

  // Terms and Conditions Management
  const addTermAndCondition = () => {
    setFormData(prev => ({
      ...prev,
      termsAndConditions: [...prev.termsAndConditions, ""]
    }));
  };

  const removeTermAndCondition = (index) => {
    setFormData(prev => ({
      ...prev,
      termsAndConditions: prev.termsAndConditions.filter((_, i) => i !== index)
    }));
  };

  const updateTermAndCondition = (index, value) => {
    setFormData(prev => ({
      ...prev,
      termsAndConditions: prev.termsAndConditions.map((term, i) =>
        i === index ? value : term
      )
    }));
  };

  // Form validation
  const validateForm = () => {
    const errors = {};

    // Basic hotel information validation
    if (!formData.hotelName.trim()) errors.hotelName = "Hotel name is required";
    if (!formData.hotelDescription.trim()) errors.hotelDescription = "Hotel description is required";
    if (!formData.address.trim()) errors.address = "Address is required";
    if (!formData.zipcode.trim()) errors.zipcode = "Zipcode is required";
    if (!formData.hotelCurrencyId) errors.hotelCurrencyId = "Currency is required";
    if (!formData.hotelCategoryId) errors.hotelCategoryId = "Hotel category is required";
    if (!formData.hotelTypeId) errors.hotelTypeId = "Hotel type is required";
    if (!formData.markupTypeId) errors.markupTypeId = "Markup type is required";
    if (!formData.regionId) errors.regionId = "Region is required";
    if (!formData.countryId) errors.countryId = "Country is required";
    if (!formData.stateId) errors.stateId = "State/Province is required";
    if (!formData.placeId) errors.placeId = "City is required";

    // Age validation
    if (!formData.childComAgeMin) errors.childComAgeMin = "Child complimentary age minimum is required";
    if (!formData.childComAgeMax) errors.childComAgeMax = "Child complimentary age maximum is required";
    if (!formData.childChargeableAgeMin) errors.childChargeableAgeMin = "Child chargeable age minimum is required";
    if (!formData.childChargeableAgeMax) errors.childChargeableAgeMax = "Child chargeable age maximum is required";

    // Contact details validation
    if (formData.contactDetails.length === 0) {
      errors.contactDetails = "At least one contact detail is required";
    }

    // Bank details validation - only bank name and address are required
    if (formData.bankDetails.length === 0) {
      errors.bankDetails = "At least one bank detail is required";
    } else {
      formData.bankDetails.forEach((bank, index) => {
        if (!bank.bankId) {
          errors[`bank_${index}_bankId`] = "Bank name is required";
        }
        if (!bank.bankAddress) {
          errors[`bank_${index}_bankAddress`] = "Bank address is required";
        }
      });
    }

    // Rooms validation
    if (formData.rooms.length === 0) {
      errors.rooms = "At least one room category is required";
    } else {
      formData.rooms.forEach((room, roomIndex) => {
        if (!room.roomCategoryId) {
          errors[`room_${roomIndex}_category`] = "Room category is required";
        }
        if (room.roomTypes.length === 0) {
          errors[`room_${roomIndex}_types`] = "At least one room type is required for this category";
        }
        room.roomTypes.forEach((roomType, typeIndex) => {
          if (!roomType.roomTypeId) {
            errors[`room_${roomIndex}_type_${typeIndex}`] = "Room type is required";
          }
        });
      });
    }

    // Terms and conditions validation
    if (formData.termsAndConditions.length === 0) {
      errors.termsAndConditions = "At least one term and condition is required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error("Please fix the validation errors");
      return;
    }

    try {
      setIsLoading(true);
      
      const payload = {
        ...formData,
        childComAgeMin: parseInt(formData.childComAgeMin),
        childComAgeMax: parseInt(formData.childComAgeMax),
        childChargeableAgeMin: parseInt(formData.childChargeableAgeMin),
        childChargeableAgeMax: parseInt(formData.childChargeableAgeMax),
        hotelCurrencyId: parseInt(formData.hotelCurrencyId),
        hotelCategoryId: parseInt(formData.hotelCategoryId),
        hotelTypeId: parseInt(formData.hotelTypeId),
        markupTypeId: parseInt(formData.markupTypeId),
        regionId: parseInt(formData.regionId),
        countryId: parseInt(formData.countryId),
        stateId: parseInt(formData.stateId),
        placeId: parseInt(formData.placeId),
        latitude: parseFloat(formData.latitude) || 0,
        longitude: parseFloat(formData.longitude) || 0,
      };

      let response;
      if (isEditMode) {
        response = await axiosInstance.put(`/api/hotels/${id}`, payload);
        toast.success("Hotel updated successfully!");
      } else {
        response = await axiosInstance.post("/api/hotels", payload);
        toast.success("Hotel registered successfully!");
      }
      
      if (response.data) {
        if (!isEditMode) {
          setFormData({
            hotelName: "",
            hotelDescription: "",
            image360: "",
            address: "",
            zipcode: "",
            latitude: "",
            longitude: "",
            childComAgeMin: "",
            childComAgeMax: "",
            childChargeableAgeMin: "",
            childChargeableAgeMax: "",
            hotelCurrencyId: "",
            hotelCategoryId: "",
            hotelTypeId: "",
            markupTypeId: "",
            regionId: "",
            countryId: "",
            stateId: "",
            placeId: "",
            isDeleted: false,
            contactDetails: [],
            bankDetails: [],
            weekDays: {
              wdSunday: false,
              wdMonday: false,
              wdTuesday: false,
              wdWednesday: false,
              wdThursday: false,
              wdFriday: false,
              wdSaturday: false,
              wedSunday: false,
              wedMonday: false,
              wedTuesday: false,
              wedWednesday: false,
              wedThursday: false,
              wedFriday: false,
              wedSaturday: false,
            },
            rooms: [],
            termsAndConditions: [],
            amenityIds: [],
          });
        }
        setValidationErrors({});
        navigate("/registration/hotel");
      }
    } catch (error) {
      console.error("Error submitting hotel:", error);
      toast.error(isEditMode ? "Failed to update hotel" : "Failed to register hotel");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate form completion percentage
  const calculateCompletion = () => {
    const totalFields = 12;
    let completedFields = 0;
    
    if (formData.hotelName) completedFields++;
    if (formData.hotelDescription) completedFields++;
    if (formData.address) completedFields++;
    if (formData.zipcode) completedFields++;
    if (formData.hotelCurrencyId) completedFields++;
    if (formData.hotelCategoryId) completedFields++;
    if (formData.hotelTypeId) completedFields++;
    if (formData.markupTypeId) completedFields++;
    if (formData.regionId) completedFields++;
    if (formData.countryId) completedFields++;
    if (formData.stateId) completedFields++;
    if (formData.placeId) completedFields++;
    
    return Math.round((completedFields / totalFields) * 100);
  };

  // Show loading state when loading hotel data for edit
  if (isLoadingHotelData) {
    return (
      <div className="min-vh-100 bg-gradient-light d-flex flex-column" style={{
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
      }}>
        <Topbar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <div className="text-center">
              <Spinner animation="border" variant="primary" size="lg" />
              <p className="mt-3 text-muted">Loading hotel data for editing...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-gradient-light d-flex flex-column" style={{
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      <style>
        {`
          .weekday-checkbox .form-check-input:checked {
            background-color: #fd7e14 !important;
            border-color: #fd7e14 !important;
          }
          .weekday-checkbox .form-check-input:focus {
            box-shadow: 0 0 0 0.25rem rgba(253, 126, 20, 0.25);
          }
          .week-days-container {
            background-color: #f8f9fa !important;
            border: 1px solid #dee2e6 !important;
          }
          .nav-tabs .nav-link {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-bottom: none;
            margin-right: 4px;
            border-radius: 0.375rem 0.375rem 0 0;
            color: #495057;
            font-weight: 500;
            padding: 0.75rem 1.5rem;
          }
          .nav-tabs .nav-link.active {
            background-color: #fff;
            border-color: #dee2e6 #dee2e6 #fff;
            color: #007bff;
            font-weight: 600;
          }
          .nav-tabs .nav-link:hover {
            border-color: #dee2e6 #dee2e6 #fff;
            background-color: #e9ecef;
          }
          .tab-content {
            background-color: #fff;
            border: 1px solid #dee2e6;
            border-top: none;
            border-radius: 0 0 0.375rem 0.375rem;
            padding: 1.5rem;
          }
        `}
      </style>
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            {/* Header Section */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="text-primary mb-1">
                  <FaHotel className="me-2" />
                  {isEditMode ? 'Edit Hotel' : 'Hotel Registration'}
                </h2>
                <p className="text-muted mb-0">
                  {isEditMode ? 'Update hotel information and details' : 'Register a new hotel with complete details'}
                </p>
              </div>
              <div className="text-end">
                <Badge bg={isEditMode ? "info" : "success"} className="fs-6 px-3 py-2">
                  <FaCheckCircle className="me-1" />
                  {isEditMode ? 'Edit Mode' : 'New Hotel'}
                </Badge>
                <div className="mt-2">
                  <small className="text-muted">Form Completion</small>
                  <ProgressBar 
                    now={calculateCompletion()} 
                    variant="success" 
                    className="mt-1" 
                    style={{ height: '8px', borderRadius: '4px' }}
                  />
                  <small className="text-muted d-block mt-1">{calculateCompletion()}% Complete</small>
                </div>
              </div>
            </div>

            <Card className="shadow-lg border-0 rounded-4" style={{
              boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
              backdropFilter: 'blur(10px)',
              backgroundColor: 'rgba(255,255,255,0.95)'
            }}>
              <Card.Header className="text-white border-0 rounded-top-4" style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              }}>
                <div className="d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">
                    <FaHotel className="me-2" />
                    Hotel Registration Form
                  </h4>
                  <div className="d-flex gap-2">
                    <Badge bg="light" text="dark" className="px-3 py-2">
                      <FaInfoCircle className="me-1" />
                      All fields marked with * are required
                    </Badge>
                  </div>
                </div>
              </Card.Header>
              <Card.Body>
                <Form onSubmit={handleSubmit}>
                  <Tabs defaultActiveKey="hotel-info" id="hotel-tabs" className="mb-2">
                    {/* Hotel Information Tab */}
                    <Tab eventKey="hotel-info" title={
                      <span>
                        <FaHotel className="me-1" /> Hotel Information
                      </span>
                    }>
                      <div className="p-4">
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Hotel Name <span className="text-danger">*</span></Form.Label>
                              <Form.Control
                                type="text"
                                name="hotelName"
                                value={formData.hotelName}
                                onChange={handleInputChange}
                                placeholder="Enter hotel name"
                                isInvalid={!!validationErrors.hotelName}
                              />
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.hotelName}
                              </Form.Control.Feedback>
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>360° Image URL</Form.Label>
                              <Form.Control
                                type="url"
                                name="image360"
                                value={formData.image360}
                                onChange={handleInputChange}
                                placeholder="https://example.com/hotel360.jpg"
                              />
                            </Form.Group>
                          </Col>
                        </Row>

                        <Form.Group className="mb-3">
                          <Form.Label>Hotel Description <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={3}
                            name="hotelDescription"
                            value={formData.hotelDescription}
                            onChange={handleInputChange}
                            placeholder="Enter hotel description"
                            isInvalid={!!validationErrors.hotelDescription}
                          />
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.hotelDescription}
                          </Form.Control.Feedback>
                        </Form.Group>

                        <Row>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label>Currency <span className="text-danger">*</span></Form.Label>
                              <Form.Select
                                name="hotelCurrencyId"
                                value={formData.hotelCurrencyId}
                                onChange={handleInputChange}
                                isInvalid={!!validationErrors.hotelCurrencyId}
                              >
                                <option value="">Select Currency</option>
                                {currencies.map(currency => (
                                  <option key={currency.currencyId} value={currency.currencyId}>
                                    {currency.name}
                                  </option>
                                ))}
                              </Form.Select>
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.hotelCurrencyId}
                              </Form.Control.Feedback>
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label>Hotel Category <span className="text-danger">*</span></Form.Label>
                              <Form.Select
                                name="hotelCategoryId"
                                value={formData.hotelCategoryId}
                                onChange={handleInputChange}
                                isInvalid={!!validationErrors.hotelCategoryId}
                              >
                                <option value="">Select Category</option>
                                {hotelCategories.map(category => (
                                  <option key={category.hotelCategoryId} value={category.hotelCategoryId}>
                                    {category.hotelCategory}
                                  </option>
                                ))}
                              </Form.Select>
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.hotelCategoryId}
                              </Form.Control.Feedback>
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label>Hotel Type <span className="text-danger">*</span></Form.Label>
                              <Form.Select
                                name="hotelTypeId"
                                value={formData.hotelTypeId}
                                onChange={handleInputChange}
                                isInvalid={!!validationErrors.hotelTypeId}
                              >
                                <option value="">Select Type</option>
                                {hotelTypes.map(type => (
                                  <option key={type.hotelTypeId} value={type.hotelTypeId}>
                                    {type.name}
                                  </option>
                                ))}
                              </Form.Select>
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.hotelTypeId}
                              </Form.Control.Feedback>
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label>Markup Type <span className="text-danger">*</span></Form.Label>
                              <Form.Select
                                name="markupTypeId"
                                value={formData.markupTypeId}
                                onChange={handleInputChange}
                                isInvalid={!!validationErrors.markupTypeId}
                              >
                                <option value="">Select Markup Type</option>
                                {markupTypes.map(markup => (
                                  <option key={markup.id} value={markup.id}>
                                    {markup.name}
                                  </option>
                                ))}
                              </Form.Select>
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.markupTypeId}
                              </Form.Control.Feedback>
                            </Form.Group>
                          </Col>
                        </Row>

                        <Row>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label>Child Complimentary Age Min <span className="text-danger">*</span></Form.Label>
                              <Form.Control
                                type="number"
                                name="childComAgeMin"
                                value={formData.childComAgeMin}
                                onChange={handleInputChange}
                                placeholder="5"
                                isInvalid={!!validationErrors.childComAgeMin}
                              />
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.childComAgeMin}
                              </Form.Control.Feedback>
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label>Child Complimentary Age Max <span className="text-danger">*</span></Form.Label>
                              <Form.Control
                                type="number"
                                name="childComAgeMax"
                                value={formData.childComAgeMax}
                                onChange={handleInputChange}
                                placeholder="10"
                                isInvalid={!!validationErrors.childComAgeMax}
                              />
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.childComAgeMax}
                              </Form.Control.Feedback>
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label>Child Chargeable Age Min <span className="text-danger">*</span></Form.Label>
                              <Form.Control
                                type="number"
                                name="childChargeableAgeMin"
                                value={formData.childChargeableAgeMin}
                                onChange={handleInputChange}
                                placeholder="11"
                                isInvalid={!!validationErrors.childChargeableAgeMin}
                              />
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.childChargeableAgeMin}
                              </Form.Control.Feedback>
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label>Child Chargeable Age Max <span className="text-danger">*</span></Form.Label>
                              <Form.Control
                                type="number"
                                name="childChargeableAgeMax"
                                value={formData.childChargeableAgeMax}
                                onChange={handleInputChange}
                                placeholder="17"
                                isInvalid={!!validationErrors.childChargeableAgeMax}
                              />
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.childChargeableAgeMax}
                              </Form.Control.Feedback>
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Tab>

                    {/* Location Information Tab */}
                    <Tab eventKey="location-info" title={
                      <span>
                        <FaMapMarkerAlt className="me-2" /> Location Information
                      </span>
                    }>
                      <div className="p-4">
                        <Row>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label>Region <span className="text-danger">*</span></Form.Label>
                              <Form.Select
                                name="regionId"
                                value={formData.regionId}
                                onChange={handleInputChange}
                                isInvalid={!!validationErrors.regionId}
                              >
                                <option value="">Select Region</option>
                                {regions.map(region => (
                                  <option key={region.id} value={region.id}>
                                    {region.name}
                                  </option>
                                ))}
                              </Form.Select>
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.regionId}
                              </Form.Control.Feedback>
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label>Country <span className="text-danger">*</span></Form.Label>
                              <Form.Select
                                name="countryId"
                                value={formData.countryId}
                                onChange={handleInputChange}
                                isInvalid={!!validationErrors.countryId}
                              >
                                <option value="">Select Country</option>
                                {countries.map(country => (
                                  <option key={country.id} value={country.id}>
                                    {country.name}
                                  </option>
                                ))}
                              </Form.Select>
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.countryId}
                              </Form.Control.Feedback>
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label>State/Province <span className="text-danger">*</span></Form.Label>
                              <Form.Select
                                name="stateId"
                                value={formData.stateId}
                                onChange={handleInputChange}
                                disabled={!formData.countryId}
                                isInvalid={!!validationErrors.stateId}
                              >
                                <option value="">Select State/Province</option>
                                {provinces.map(province => (
                                  <option key={province.id} value={province.id}>
                                    {province.stateName}
                                  </option>
                                ))}
                              </Form.Select>
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.stateId}
                              </Form.Control.Feedback>
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label>City <span className="text-danger">*</span></Form.Label>
                              <Form.Select
                                name="placeId"
                                value={formData.placeId}
                                onChange={handleInputChange}
                                disabled={!formData.stateId}
                                isInvalid={!!validationErrors.placeId}
                              >
                                <option value="">Select City</option>
                                {places.map(place => (
                                  <option key={place.id} value={place.id}>
                                    {place.name}
                                  </option>
                                ))}
                              </Form.Select>
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.placeId}
                              </Form.Control.Feedback>
                            </Form.Group>
                          </Col>
                        </Row>

                        <Form.Group className="mb-3">
                          <Form.Label>Address <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            name="address"
                            value={formData.address}
                            onChange={handleInputChange}
                            placeholder="Enter complete address"
                            isInvalid={!!validationErrors.address}
                          />
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.address}
                          </Form.Control.Feedback>
                        </Form.Group>

                        <Row>
                          <Col md={4}>
                            <Form.Group className="mb-3">
                              <Form.Label>Zipcode <span className="text-danger">*</span></Form.Label>
                              <Form.Control
                                type="text"
                                name="zipcode"
                                value={formData.zipcode}
                                onChange={handleInputChange}
                                placeholder="123456"
                                isInvalid={!!validationErrors.zipcode}
                              />
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.zipcode}
                              </Form.Control.Feedback>
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group className="mb-3">
                              <Form.Label>Latitude</Form.Label>
                              <Form.Control
                                type="number"
                                step="any"
                                name="latitude"
                                value={formData.latitude}
                                onChange={handleInputChange}
                                placeholder="37.7749"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group className="mb-3">
                              <Form.Label>Longitude</Form.Label>
                              <Form.Control
                                type="number"
                                step="any"
                                name="longitude"
                                value={formData.longitude}
                                onChange={handleInputChange}
                                placeholder="-122.4194"
                              />
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Tab>

                    {/* Contact Details Tab */}
                    <Tab eventKey="contact-details" title={
                      <span>
                        <FaPhone className="me-2" /> Contact Details
                        <Badge bg="info" className="ms-2">{formData.contactDetails.length}</Badge>
                      </span>
                    }>
                      <div className="p-4">
                        {validationErrors.contactDetails && (
                          <Alert variant="danger" className="mb-3">
                            {validationErrors.contactDetails}
                          </Alert>
                        )}
                        
                        {formData.contactDetails && formData.contactDetails.map((contact, index) => (
                          <Card key={index} className="mb-3">
                            <Card.Header className="d-flex justify-content-between align-items-center">
                              <h6 className="mb-0">Contact {index + 1}</h6>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => removeContactDetail(index)}
                              >
                                <FaTrash />
                              </Button>
                            </Card.Header>
                            <Card.Body>
                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Contact Type</Form.Label>
                                    <Form.Select
                                      value={contact.contactTypeId}
                                      onChange={(e) => updateContactDetail(index, 'contactTypeId', e.target.value)}
                                    >
                                      <option value="">Select Contact Type</option>
                                      {contactTypes.map(type => (
                                        <option key={type.contacttypeId} value={type.contacttypeId}>
                                          {type.name}
                                        </option>
                                      ))}
                                    </Form.Select>
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Contact Person</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={contact.contactPerson}
                                      onChange={(e) => updateContactDetail(index, 'contactPerson', e.target.value)}
                                      placeholder="Enter contact person name"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>
                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Personal Email</Form.Label>
                                    <Form.Control
                                      type="email"
                                      value={contact.personalEmail}
                                      onChange={(e) => updateContactDetail(index, 'personalEmail', e.target.value)}
                                      placeholder="Enter email address"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={3}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Telephone</Form.Label>
                                    <Form.Control
                                      type="tel"
                                      value={contact.teleNumber}
                                      onChange={(e) => updateContactDetail(index, 'teleNumber', e.target.value)}
                                      placeholder="Enter telephone"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={3}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Mobile</Form.Label>
                                    <Form.Control
                                      type="tel"
                                      value={contact.mobileNumber}
                                      onChange={(e) => updateContactDetail(index, 'mobileNumber', e.target.value)}
                                      placeholder="Enter mobile"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>
                            </Card.Body>
                          </Card>
                        ))}

                        <Button
                          variant="outline-primary"
                          onClick={addContactDetail}
                          className="d-flex align-items-center gap-2"
                        >
                          <FaPlus /> Add Contact Detail
                        </Button>
                      </div>
                    </Tab>

                    {/* Bank Details Tab */}
                    <Tab eventKey="bank-details" title={
                      <span>
                        <FaUniversity className="me-2" /> Bank Details
                        <Badge bg="dark" className="ms-2">{formData.bankDetails.length}</Badge>
                      </span>
                    }>
                      <div className="p-4">
                        {validationErrors.bankDetails && (
                          <Alert variant="danger" className="mb-3">
                            {validationErrors.bankDetails}
                          </Alert>
                        )}
                        
                        {formData.bankDetails && formData.bankDetails.map((bank, index) => (
                          <Card key={index} className="mb-3">
                            <Card.Header className="d-flex justify-content-between align-items-center">
                              <h6 className="mb-0">Bank {index + 1}</h6>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => removeBankDetail(index)}
                              >
                                <FaTrash />
                              </Button>
                            </Card.Header>
                            <Card.Body>
                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Bank <span className="text-danger">*</span></Form.Label>
                                    <Form.Select
                                      value={bank.bankId}
                                      onChange={(e) => updateBankDetail(index, 'bankId', e.target.value)}
                                      isInvalid={!!validationErrors[`bank_${index}_bankId`]}
                                    >
                                      <option value="">Select Bank</option>
                                      {banks.map(bankItem => (
                                        <option key={bankItem.bankId} value={bankItem.bankId}>
                                          {bankItem.name}
                                        </option>
                                      ))}
                                    </Form.Select>
                                    <Form.Control.Feedback type="invalid">
                                      {validationErrors[`bank_${index}_bankId`]}
                                    </Form.Control.Feedback>
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Account Number</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={bank.accountNo}
                                      onChange={(e) => updateBankDetail(index, 'accountNo', e.target.value)}
                                      placeholder="Enter account number"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>
                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>IBAN</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={bank.iban}
                                      onChange={(e) => updateBankDetail(index, 'iban', e.target.value)}
                                      placeholder="Enter IBAN"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>SWIFT Code</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={bank.swiftCode}
                                      onChange={(e) => updateBankDetail(index, 'swiftCode', e.target.value)}
                                      placeholder="Enter SWIFT code"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>
                              <Form.Group className="mb-3">
                                <Form.Label>Bank Address <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                  as="textarea"
                                  rows={2}
                                  value={bank.bankAddress}
                                  onChange={(e) => updateBankDetail(index, 'bankAddress', e.target.value)}
                                  placeholder="Enter bank address"
                                  isInvalid={!!validationErrors[`bank_${index}_bankAddress`]}
                                />
                                <Form.Control.Feedback type="invalid">
                                  {validationErrors[`bank_${index}_bankAddress`]}
                                </Form.Control.Feedback>
                              </Form.Group>
                              <Row>
                                <Col md={4}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Telephone</Form.Label>
                                    <Form.Control
                                      type="tel"
                                      value={bank.telephone}
                                      onChange={(e) => updateBankDetail(index, 'telephone', e.target.value)}
                                      placeholder="Enter telephone"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={4}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Fax Number</Form.Label>
                                    <Form.Control
                                      type="tel"
                                      value={bank.faxNumber}
                                      onChange={(e) => updateBankDetail(index, 'faxNumber', e.target.value)}
                                      placeholder="Enter fax number"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={4}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Contact Person</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={bank.contactPerson}
                                      onChange={(e) => updateBankDetail(index, 'contactPerson', e.target.value)}
                                      placeholder="Enter contact person"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>
                            </Card.Body>
                          </Card>
                        ))}

                        <Button
                          variant="outline-primary"
                          onClick={addBankDetail}
                          className="d-flex align-items-center gap-2"
                        >
                          <FaPlus /> Add Bank Detail
                        </Button>
                      </div>
                    </Tab>

                    {/* Week Days Tab */}
                    <Tab eventKey="week-days" title={
                      <span>
                        <FaCalendarAlt className="me-2" /> Working Days
                      </span>
                    }>
                      <div className="p-4">
                        <div className="week-days-container p-4 bg-light rounded-3 border">
                          <h6 className="text-danger fw-bold mb-3">Week Details</h6>
                          
                          {/* Week Days Row */}
                          <div className="mb-4">
                            <div className="d-flex align-items-center mb-2">
                              <span className="text-danger fw-bold me-3" style={{ minWidth: '120px' }}>Week Days</span>
                              <div className="d-flex gap-4">
                                {weekdays.map(day => (
                                  <Form.Check
                                    key={day.key}
                                    type="checkbox"
                                    id={`wd-${day.key}`}
                                    name={day.key}
                                    label={day.label}
                                    checked={formData.weekDays[day.key]}
                                    onChange={handleWeekdayChange}
                                    className="weekday-checkbox"
                                    style={{ 
                                      '--bs-form-check-input-checked-bg-color': '#fd7e14',
                                      '--bs-form-check-input-checked-border-color': '#fd7e14'
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Week End Days Row */}
                          <div>
                            <div className="d-flex align-items-center">
                              <span className="text-danger fw-bold me-3" style={{ minWidth: '120px' }}>Week End Days</span>
                              <div className="d-flex gap-4">
                                {weekdays.map(day => (
                                  <Form.Check
                                    key={`wed-${day.key}`}
                                    type="checkbox"
                                    id={`wed-${day.key}`}
                                    name={`wed${day.key.charAt(0).toUpperCase() + day.key.slice(1)}`}
                                    label={day.label}
                                    checked={formData.weekDays[`wed${day.key.charAt(0).toUpperCase() + day.key.slice(1)}`]}
                                    onChange={handleWeekEndDayChange}
                                    className="weekday-checkbox"
                                    style={{ 
                                      '--bs-form-check-input-checked-bg-color': '#fd7e14',
                                      '--bs-form-check-input-checked-border-color': '#fd7e14'
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Tab>

                    {/* Amenities Tab */}
                    <Tab eventKey="amenities" title={
                      <span>
                        <FaSwimmingPool className="me-2" /> Amenities
                        <Badge bg="info" className="ms-2">{formData.amenityIds.length}</Badge>
                      </span>
                    }>
                      <div className="p-4">
                        <Row>
                          {amenities.map(amenity => (
                            <Col md={4} key={amenity.amenitiesId} className="mb-3">
                              <Form.Check
                                type="checkbox"
                                id={`amenity-${amenity.amenitiesId}`}
                                value={amenity.amenitiesId}
                                label={amenity.amenityName}
                                checked={formData.amenityIds.includes(amenity.amenitiesId)}
                                onChange={handleAmenityChange}
                              />
                            </Col>
                          ))}
                        </Row>
                      </div>
                    </Tab>

                    {/* Rooms Tab */}
                    <Tab eventKey="rooms" title={
                      <span>
                        <FaBed className="me-2" /> Room Configuration
                        <Badge bg="warning" className="ms-2">{formData.rooms.length}</Badge>
                      </span>
                    }>
                      <div className="p-4">
                        {validationErrors.rooms && (
                          <Alert variant="danger" className="mb-3">
                            <FaExclamationTriangle className="me-2" />
                            {validationErrors.rooms}
                          </Alert>
                        )}
                        
                        {formData.rooms && formData.rooms.map((room, roomIndex) => (
                          <Card key={roomIndex} className="mb-4 border-0 shadow-sm">
                            <Card.Header className="bg-light border-0">
                              <div className="d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center">
                                  <div className="bg-warning text-white rounded-circle p-2 me-3">
                                    <FaBed size={16} />
                                  </div>
                                  <div>
                                    <h6 className="mb-0 text-primary">Room Category {roomIndex + 1}</h6>
                                    <small className="text-muted">Configure room types for this category</small>
                                  </div>
                                </div>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => removeRoom(roomIndex)}
                                  className="rounded-pill"
                                >
                                  <FaTrash className="me-1" />
                                  Remove Category
                                </Button>
                              </div>
                            </Card.Header>
                            <Card.Body>
                              <Row className="mb-3">
                                <Col md={6}>
                                  <Form.Group>
                                    <Form.Label>Room Category <span className="text-danger">*</span></Form.Label>
                                    <Form.Select
                                      value={room.roomCategoryId}
                                      onChange={(e) => updateRoom(roomIndex, 'roomCategoryId', e.target.value)}
                                      isInvalid={!!validationErrors[`room_${roomIndex}_category`]}
                                    >
                                      <option value="">Select Room Category (e.g., Junior Suite)</option>
                                      {roomCategories.map(category => (
                                        <option key={category.roomCategoryId} value={category.roomCategoryId}>
                                          {category.roomCategory}
                                        </option>
                                      ))}
                                    </Form.Select>
                                    <Form.Control.Feedback type="invalid">
                                      {validationErrors[`room_${roomIndex}_category`]}
                                    </Form.Control.Feedback>
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group>
                                    <Form.Label>Category Name</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={room.roomName}
                                      onChange={(e) => updateRoom(roomIndex, 'roomName', e.target.value)}
                                      placeholder="Enter category name (optional)"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>

                              <div className="border-top pt-3">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                  <h6 className="mb-0 text-secondary">
                                    <FaBed className="me-2" />
                                    Room Types for this Category
                                  </h6>
                                  <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={() => addRoomType(roomIndex)}
                                    className="rounded-pill"
                                  >
                                    <FaPlus className="me-1" />
                                    Add Room Type
                                  </Button>
                                </div>

                                {validationErrors[`room_${roomIndex}_types`] && (
                                  <Alert variant="warning" className="mb-3">
                                    <FaExclamationTriangle className="me-2" />
                                    {validationErrors[`room_${roomIndex}_types`]}
                                  </Alert>
                                )}

                                {room.roomTypes && room.roomTypes.map((roomType, typeIndex) => (
                                  <Card key={typeIndex} className="mb-3 border-start border-primary border-3">
                                    <Card.Body className="py-3">
                                      <Row>
                                        <Col md={8}>
                                          <Form.Group className="mb-2">
                                            <Form.Label>Room Type <span className="text-danger">*</span></Form.Label>
                                            <Form.Select
                                              value={roomType.roomTypeId}
                                              onChange={(e) => updateRoomType(roomIndex, typeIndex, 'roomTypeId', e.target.value)}
                                              isInvalid={!!validationErrors[`room_${roomIndex}_type_${typeIndex}`]}
                                            >
                                              <option value="">Select Room Type (e.g., Room Only, Room with Breakfast)</option>
                                              {(filteredRoomTypes[roomIndex] || []).map(type => (
                                                <option key={type.roomTypeId} value={type.roomTypeId}>
                                                  {type.roomTypeName}
                                                </option>
                                              ))}
                                            </Form.Select>
                                            <Form.Control.Feedback type="invalid">
                                              {validationErrors[`room_${roomIndex}_type_${typeIndex}`]}
                                            </Form.Control.Feedback>
                                          </Form.Group>
                                        </Col>
                                        <Col md={3}>
                                          <Form.Group className="mb-2">
                                            <Form.Label>Type Name</Form.Label>
                                            <Form.Control
                                              type="text"
                                              value={roomType.roomName}
                                              onChange={(e) => updateRoomType(roomIndex, typeIndex, 'roomName', e.target.value)}
                                              placeholder="Enter type name"
                                            />
                                          </Form.Group>
                                        </Col>
                                        <Col md={1} className="d-flex align-items-end">
                                          <Button
                                            variant="outline-danger"
                                            size="sm"
                                            onClick={() => removeRoomType(roomIndex, typeIndex)}
                                            className="rounded-circle"
                                            title="Remove this room type"
                                          >
                                            <FaTrash size={12} />
                                          </Button>
                                        </Col>
                                      </Row>
                                    </Card.Body>
                                  </Card>
                                ))}

                                {room.roomTypes.length === 0 && (
                                  <div className="text-center py-4 text-muted">
                                    <FaBed size={48} className="mb-3 opacity-50" />
                                    <p className="mb-0">No room types added yet. Click "Add Room Type" to get started.</p>
                                  </div>
                                )}
                              </div>
                            </Card.Body>
                          </Card>
                        ))}

                        {formData.rooms.length === 0 && (
                          <div className="text-center py-5 text-muted">
                            <FaBed size={64} className="mb-3 opacity-50" />
                            <h5 className="mb-2">No Room Categories Added</h5>
                            <p className="mb-4">Start by adding a room category and then configure its room types.</p>
                          </div>
                        )}

                        <div className="text-center">
                          <Button
                            variant="outline-primary"
                            onClick={addRoom}
                            className="d-flex align-items-center gap-2 mx-auto px-4 py-2 rounded-pill"
                            size="lg"
                          >
                            <FaPlus />
                            Add Room Category
                          </Button>
                        </div>
                      </div>
                    </Tab>

                    {/* Terms and Conditions Tab */}
                    <Tab eventKey="terms-conditions" title={
                      <span>
                        <FaFileContract className="me-2" /> Terms and Conditions
                        <Badge bg="danger" className="ms-2">{formData.termsAndConditions.length}</Badge>
                      </span>
                    }>
                      <div className="p-4">
                        {validationErrors.termsAndConditions && (
                          <Alert variant="danger" className="mb-3">
                            {validationErrors.termsAndConditions}
                          </Alert>
                        )}
                        
                        {formData.termsAndConditions && formData.termsAndConditions.map((term, index) => (
                          <Card key={index} className="mb-3">
                            <Card.Header className="d-flex justify-content-between align-items-center">
                              <h6 className="mb-0">Term {index + 1}</h6>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => removeTermAndCondition(index)}
                              >
                                <FaTrash />
                              </Button>
                            </Card.Header>
                            <Card.Body>
                              <Form.Group className="mb-3">
                                <Form.Label>Term and Condition</Form.Label>
                                <Form.Control
                                  as="textarea"
                                  rows={3}
                                  value={term}
                                  onChange={(e) => updateTermAndCondition(index, e.target.value)}
                                  placeholder="Enter term and condition"
                                />
                              </Form.Group>
                            </Card.Body>
                          </Card>
                        ))}

                        <Button
                          variant="outline-primary"
                          onClick={addTermAndCondition}
                          className="d-flex align-items-center gap-2"
                        >
                          <FaPlus /> Add Term and Condition
                        </Button>
                      </div>
                    </Tab>
                  </Tabs>

                  {/* Submit Button Section */}
                  <div className="bg-light rounded-4 p-4 mt-4">
                    <Row className="align-items-center">
                      <Col md={8}>
                        <div className="d-flex align-items-center">
                          <div className="bg-success text-white rounded-circle p-3 me-3">
                            <FaCheckCircle size={24} />
                          </div>
                          <div>
                            <h5 className="mb-1 text-success">Ready to Register Hotel</h5>
                            <p className="text-muted mb-0">
                              Review all information and click the button below to register your hotel.
                            </p>
                          </div>
                        </div>
                      </Col>
                      <Col md={4} className="text-end">
                        <Button
                          type="submit"
                          variant="success"
                          size="lg"
                          disabled={isLoading}
                          className="d-flex align-items-center gap-2 px-4 py-3 rounded-pill shadow"
                        >
                          {isLoading ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm me-2"
                                role="status"
                                aria-hidden="true"
                              ></span>
                              {isEditMode ? 'Updating Hotel...' : 'Registering Hotel...'}
                            </>
                          ) : (
                            <>
                              <FaSave />
                              {isEditMode ? 'Update Hotel' : 'Register Hotel'}
                            </>
                          )}
                        </Button>
                      </Col>
                    </Row>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default HotelReg;