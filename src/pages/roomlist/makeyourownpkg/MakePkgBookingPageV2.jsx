import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Accordion,
  Table,
  Badge,
  Alert,
  Spinner,
  Modal,
} from "react-bootstrap";
import {
  FaHotel,
  FaCalendarAlt,
  FaUsers,
  FaBed,
  FaMapMarkerAlt,
  FaCar,
  FaTicketAlt,
  FaChevronDown,
  FaChevronUp,
  FaCheckCircle,
  FaEdit,
  FaShoppingCart,
  FaPlus,
  FaRoute,
  FaClock,
} from "react-icons/fa";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import AgentBalanceDisplay from "../../../components/AgentBalanceDisplay";
import AddOnServicesPanel, {
  ADDON_SERVICES_CATALOG,
  collectEnabledAddOnServices,
  readAddOnServices,
} from "../../../components/AddOnServicesPanel";
import axiosInstance from "../../../components/AxiosInstance";
import toast from "react-hot-toast";
import "../../../styles/HotelBookingPage.css";
import "../../../styles/MakePkgBookingPage.css";

// v2 helpers — read the choice made on the /addons step. Visa is just
// YES/NO in v2; the legacy adult/child/infant rate inputs are removed.
const readV2VisaRequired = () => {
  try {
    return sessionStorage.getItem("makePkgV2VisaRequired") === "YES" ? "YES" : "NO";
  } catch {
    return "NO";
  }
};
const V2_SUPPORT_EMAIL = "support@yourdomain.com";
const V2_SUPPORT_PHONE = "+971-XX-XXXXXXX";

const MakePkgBookingPageV2 = () => {
  const v2VisaRequired = readV2VisaRequired();
  const navigate = useNavigate();
  const [cartData, setCartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [primaryGuest, setPrimaryGuest] = useState({
    salutation: "Mr",
    firstName: "",
    middleName: "",
    lastName: "",
    contactNumber: "",
    emailId: "",
    passportNumber: "",
    lpo: "",
  });
  const [visaRequired, setVisaRequired] = useState(false);
  const [visaDetails, setVisaDetails] = useState({
    visaAdult: "0",
    visaAdultRate: "0",
    visaChild: "0",
    visaChildRate: "0",
    visaInfant: "0",
    visaInfantRate: "0",
  });
  // Per-hotel state for Tourism Dirhams, Remarks, Special Request, and Booking Confirmation
  const [hotelTourismDirhams, setHotelTourismDirhams] = useState({});
  const [hotelRemarks, setHotelRemarks] = useState({});
  const [hotelSpecialRequests, setHotelSpecialRequests] = useState({});
  const [hotelBookingConfirmation, setHotelBookingConfirmation] = useState({});
  const [totalPrice, setTotalPrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [tourismDirham, setTourismDirham] = useState("");

  // ── Add-On Services badge counter ──────────────────────────────────
  // The actual selections live in sessionStorage (driven by the
  // AddOnServicesPanel) — we just track the count locally so the
  // accordion header can show "(N on)" without re-reading storage on
  // every render. Refreshed when the header is clicked / the inner
  // panel loses focus.
  const [addOnsCount, setAddOnsCount] = useState(() => {
    try {
      const all = readAddOnServices();
      return Object.values(all).filter((v) => v && v.enabled).length;
    } catch {
      return 0;
    }
  });
  const refreshAddOnsCount = () => {
    try {
      const all = readAddOnServices();
      setAddOnsCount(Object.values(all).filter((v) => v && v.enabled).length);
    } catch {
      // ignore — sessionStorage rejected in private mode etc.
    }
  };

  // Itinerary state
  const [itineraryList, setItineraryList] = useState([]);
  const [selectedItineraries, setSelectedItineraries] = useState({});
  const [loadingItinerary, setLoadingItinerary] = useState(false);
  const [itineraryExpanded, setItineraryExpanded] = useState(false);

  // Itinerary modal state
  const [showItineraryModal, setShowItineraryModal] = useState(false);
  const [currentDay, setCurrentDay] = useState(null); // stores the activity date string
  const [itinerarySearchTerm, setItinerarySearchTerm] = useState("");
  const [filteredItineraryList, setFilteredItineraryList] = useState([]);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});

  // Guest details for each room
  const [roomGuests, setRoomGuests] = useState({});

  // Transfer/Cab details state
  const [transferDetails, setTransferDetails] = useState({});

  // Activity/Tour details state
  const [activityDetails, setActivityDetails] = useState({});

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState({});

  // Order summary modal state
  const [showOrderSummaryModal, setShowOrderSummaryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize guest details for rooms
  const initializeRoomGuests = (cartItems) => {
    const guests = {};
    const firstHotelIndex = cartItems.findIndex((i) => i.hotel);

    cartItems.forEach((item, hotelIndex) => {
      if (item.hotel) {
        const hotel = item.hotel || {};
        const searchRoomDTOs = hotel.searchRoomDTOs || [];
        searchRoomDTOs.forEach((room, roomIndex) => {
          const adults = parseInt(room.adult || room.adults || 1);
          const children = parseInt(room.child || room.children || 0);
          const totalGuests = adults + children;

          const key = `${hotelIndex}-${roomIndex}`;
          guests[key] = Array.from({ length: totalGuests }, (_, guestIndex) => {
            // Master Guest: First guest of the first room in the first hotel
            const isMasterGuest =
              hotelIndex === firstHotelIndex &&
              roomIndex === 0 &&
              guestIndex === 0;

            if (isMasterGuest) {
              return {
                salutation: primaryGuest.salutation || "Mr",
                firstName: primaryGuest.firstName || "",
                lastName: primaryGuest.lastName || "",
                gender: "Male", // Default for master guest
                isChild: false,
                age: "",
              };
            } else {
              // Dummy data for all other guests (temporary/testing purposes)
              const isChild = guestIndex >= adults;
              return {
                salutation: isChild ? "Master" : "Mr",
                firstName: "",
                lastName: "",
                gender: "Male",
                isChild: isChild,
                age: isChild ? room.childAge?.[guestIndex - adults] || "5" : "",
              };
            }
          });
        });
      }
    });
    setRoomGuests(guests);
  };

  // Initialize transfer details
  const initializeTransferDetails = (cartItems) => {
    const details = {};
    cartItems.forEach((item, index) => {
      if (item.cab) {
        const cab = item.cab || {};
        const cabDetails = cab.details || {};
        details[index] = {
          transporterName:
            cab.transporter ||
            cab.transporterName ||
            cabDetails.transporter ||
            cabDetails.transporterName ||
            "",
          contactNumber: cab.contactNumber || cabDetails.contactNumber || "",
          driverName: cab.driverName || cabDetails.driverName || "",
          driverContact: cab.driverContact || cabDetails.driverContact || "",
        };
      }
    });
    setTransferDetails(details);
  };

  // Initialize activity details
  const initializeActivityDetails = (cartItems) => {
    const details = {};
    cartItems.forEach((item, index) => {
      if (item.activity) {
        const activity = item.activity || {};
        const activityData = activity.details || {};
        details[index] = {
          driverName: activity.driverName || activityData.driverName || "",
          driverContact: activity.driverContact || activityData.driverContact || "",
        };
      }
    });
    setActivityDetails(details);
  };

  // Initialize hotel-specific fields (Tourism Dirhams, Remarks, Special Request, Booking Confirmation)
  const initializeHotelFields = (cartItems) => {
    const tourismDirhams = {};
    const remarks = {};
    const specialRequests = {};
    const bookingConfirmations = {};

    let hotelIndex = 0;
    cartItems.forEach((item) => {
      if (item.hotel) {
        tourismDirhams[hotelIndex] = "0";
        remarks[hotelIndex] = "";
        specialRequests[hotelIndex] = "";
        bookingConfirmations[hotelIndex] = "Book & Voucher";
        hotelIndex++;
      }
    });

    setHotelTourismDirhams(tourismDirhams);
    setHotelRemarks(remarks);
    setHotelSpecialRequests(specialRequests);
    setHotelBookingConfirmation(bookingConfirmations);
  };

  // Load cart data on mount
  useEffect(() => {
    const loadCartData = () => {
      try {
        const stored = sessionStorage.getItem("makePkgCartData");
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log("Cart data loaded:", parsed);
          setCartData(parsed);
          calculatePrices(parsed);
          initializeRoomGuests(parsed);
          initializeTransferDetails(parsed);
          initializeActivityDetails(parsed);
          initializeHotelFields(parsed);
        } else {
          toast.error("No cart data found. Please add items to cart first.");
          navigate("/new-booking/make-your-own-package");
        }
      } catch (err) {
        console.error("Error loading cart data:", err);
        toast.error("Failed to load cart data.");
        navigate("/new-booking/make-your-own-package");
      } finally {
        setLoading(false);
      }
    };

    loadCartData();
  }, [navigate]);

  // Handle guest detail change
  const handleGuestChange = (
    hotelIndex,
    roomIndex,
    guestIndex,
    field,
    value,
  ) => {
    const firstHotelIndex = cartData.findIndex((item) => item.hotel);
    const isFirstHotel = hotelIndex === firstHotelIndex;
    const isMasterGuest =
      isFirstHotel && roomIndex === 0 && guestIndex === 0;

    // 1. Sync to primaryGuest state if Master Guest is edited (First Hotel, Room 1, Adult 1)
    if (isMasterGuest) {
      if (field === "firstName" || field === "lastName") {
        setPrimaryGuest((prev) => ({ ...prev, [field]: value }));
      } else if (field === "gender" || field === "salutation") {
        // Sync salutation directly, or map gender to title (salutation)
        let mappedSalutation = value;
        if (field === "gender") {
          if (value === "Male") mappedSalutation = "Mr";
          else if (value === "Female") mappedSalutation = "Mrs";
        }
        setPrimaryGuest((prev) => ({
          ...prev,
          salutation: mappedSalutation || prev.salutation,
        }));
      }
    }

    setRoomGuests((prev) => {
      const updated = { ...prev };

      // 2. Identify all keys to update. If editing the first hotel, sync across ALL hotels.
      const targetHotelIndices = isFirstHotel
        ? cartData
            .map((item, idx) => (item.hotel ? idx : -1))
            .filter((idx) => idx !== -1)
        : [hotelIndex];

      targetHotelIndices.forEach((idx) => {
        const key = `${idx}-${roomIndex}`;
        if (!updated[key]) {
          updated[key] = [];
        }
        const guests = [...updated[key]];

        // Ensure guest object exists, create if it doesn't
        if (!guests[guestIndex]) {
          guests[guestIndex] = {
            salutation: "",
            firstName: "",
            lastName: "",
            gender: "",
            isChild: false,
            age: "",
          };
        }

        // Update the guest field
        guests[guestIndex] = {
          ...guests[guestIndex],
          [field]: value,
        };

        updated[key] = guests;
      });

      return updated;
    });

    // Clear validation errors for all affected fields
    const targetHotelIndices = isFirstHotel
      ? cartData
          .map((item, idx) => (item.hotel ? idx : -1))
          .filter((idx) => idx !== -1)
      : [hotelIndex];

    setValidationErrors((prev) => {
      const updated = { ...prev };
      targetHotelIndices.forEach((idx) => {
        const errorKey = `hotel_${idx}_room_${roomIndex}_guest_${guestIndex}_${field}`;
        delete updated[errorKey];
      });
      if (isMasterGuest) {
        const primaryPrefix = `primaryGuest_${field === 'gender' ? 'salutation' : field}`;
        delete updated[primaryPrefix];
      }
      return updated;
    });
  };

  // Handle primary guest change
   const handlePrimaryGuestChange = (field, value) => {
    setPrimaryGuest((prev) => ({ ...prev, [field]: value }));

    // Sync Master Guest automatically if primary fields are edited
    const syncFields = ["salutation", "firstName", "lastName"];
    if (syncFields.includes(field)) {
      const firstHotelIndex = cartData.findIndex((item) => item.hotel);
      if (firstHotelIndex !== -1) {
        const guestKey = `${firstHotelIndex}-0`; // Master Guest Key
        setRoomGuests((prevGuests) => {
          if (!prevGuests[guestKey] || prevGuests[guestKey].length === 0)
            return prevGuests;

          const updatedGuests = { ...prevGuests };
          const roomGuestsArray = [...updatedGuests[guestKey]];
          roomGuestsArray[0] = { ...roomGuestsArray[0], [field]: value };
          updatedGuests[guestKey] = roomGuestsArray;
          return updatedGuests;
        });
      }
    }

    // Real-time validation for email format
    if (field === "emailId" && value.trim() !== "") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        setValidationErrors((prev) => ({
          ...prev,
          primaryGuest_emailId: "Please enter a valid email address",
        }));
        return;
      }
    }

    // Clear validation error when user starts typing
    const errorKey = `primaryGuest_${field}`;
    if (validationErrors[errorKey]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[errorKey];
        return updated;
      });
    }

    // NEW: Sync primary guest name to the first transfer's driver name
    if (field === "firstName" || field === "lastName") {
      syncGuestToDriver();
    }
  };

  // Helper to sync guest names to driver names
  const syncGuestToDriver = (updatedRoomGuests = null) => {
    const guestsToUse = updatedRoomGuests || roomGuests;
    const hotelIndices = cartData
      .map((item, idx) => (item.hotel ? idx : -1))
      .filter((idx) => idx !== -1);
    const transferIndices = cartData
      .map((item, idx) => (item.cab ? idx : -1))
      .filter((idx) => idx !== -1);

    setTransferDetails((prev) => {
      const updated = { ...prev };
      transferIndices.forEach((tIdx, i) => {
        const hIdx = hotelIndices[i];
        if (hIdx !== undefined) {
          const guestKey = `${hIdx}-0`;
          const firstGuest = guestsToUse[guestKey]?.[0];
          if (firstGuest && (firstGuest.firstName || firstGuest.lastName)) {
            const fullName = `${firstGuest.firstName || ""} ${firstGuest.lastName || ""}`.trim();
            if (!updated[tIdx]) updated[tIdx] = {};
            updated[tIdx] = {
              ...updated[tIdx],
              driverName: fullName,
            };
          }
        }
      });
      return updated;
    });

    // NEW: Sync guest name to activity's driver name
    const activityIndices = cartData
      .map((item, idx) => (item.activity ? idx : -1))
      .filter((idx) => idx !== -1);

    setActivityDetails((prev) => {
      const updated = { ...prev };
      activityIndices.forEach((aIdx, i) => {
        const hIdx = hotelIndices[i];
        if (hIdx !== undefined) {
          const guestKey = `${hIdx}-0`;
          const firstGuest = guestsToUse[guestKey]?.[0];
          if (firstGuest && (firstGuest.firstName || firstGuest.lastName)) {
            const fullName = `${firstGuest.firstName || ""} ${firstGuest.lastName || ""}`.trim();
            if (!updated[aIdx]) updated[aIdx] = {};
            updated[aIdx] = {
              ...updated[aIdx],
              driverName: fullName,
            };
          }
        }
      });
      return updated;
    });
  };

  // UseEffect to sync when cartData or roomGuests changes initially
  useEffect(() => {
    if (cartData.length > 0 && Object.keys(roomGuests).length > 0) {
      syncGuestToDriver();
    }
  }, [cartData, roomGuests]);

  // Fetch itinerary details
  const fetchItineraryDetails = async () => {
    if (itineraryList.length > 0) {
      setItineraryExpanded(true);
      return; // Already loaded
    }

    try {
      setLoadingItinerary(true);
      const response = await axiosInstance.get("/api/master/itenaryDetails");
      if (Array.isArray(response.data)) {
        setItineraryList(response.data);
        setFilteredItineraryList(response.data);
        setItineraryExpanded(true);
      } else {
        toast.error("Failed to load itinerary details.");
      }
    } catch (err) {
      console.error("Error fetching itinerary:", err);
      toast.error("Failed to load itinerary details.");
    } finally {
      setLoadingItinerary(false);
    }
  };

  useEffect(() => {
    fetchItineraryDetails();
  }, []);

  // Filter itinerary list based on search term
  useEffect(() => {
    if (itinerarySearchTerm.trim().length >= 4) {
      const filtered = itineraryList.filter((item) => {
        const heading = (item.itineraryHeading || "").toLowerCase();
        const desc = (item.itineraryDesc || "").toLowerCase();
        const search = itinerarySearchTerm.toLowerCase();
        return heading.includes(search) || desc.includes(search);
      });
      setFilteredItineraryList(filtered);
    } else if (itinerarySearchTerm.trim().length === 0) {
      setFilteredItineraryList(itineraryList);
    } else {
      setFilteredItineraryList([]);
    }
  }, [itinerarySearchTerm, itineraryList]);

  // Handle opening itinerary modal for a specific day
  const handleOpenItineraryModal = (day) => {
    setCurrentDay(day);
    setItinerarySearchTerm("");
    setFilteredItineraryList(itineraryList);
    setShowItineraryModal(true);
  };

  // Handle closing itinerary modal
  const handleCloseItineraryModal = () => {
    setShowItineraryModal(false);
    setCurrentDay(null);
    setItinerarySearchTerm("");
    setExpandedDescriptions({});
  };

  // Handle itinerary selection in modal
  const handleItineraryToggle = (itineraryId) => {
    if (!currentDay) return;

    setSelectedItineraries((prev) => {
      const dayItineraries = prev[currentDay] || [];
      if (dayItineraries.includes(itineraryId)) {
        return {
          ...prev,
          [currentDay]: dayItineraries.filter((id) => id !== itineraryId),
        };
      } else {
        return {
          ...prev,
          [currentDay]: [...dayItineraries, itineraryId],
        };
      }
    });
  };

  // Calculate total and selling prices
  const calculatePrices = (cartItems) => {
    let total = 0; // Total Price (without markup) - sum of totalRateWithoutmrk
    let selling = 0; // Selling Price (with markup) - sum of totalRate

    cartItems.forEach((item) => {
      if (item.hotel) {
        const hotel = item.hotel;
        // Selling Price = totalRate (with markup)
        const sellPrice = parseFloat(hotel.totalRate || 0);
        // Total Price = totalRateWithoutmrk (without markup)
        const price = parseFloat(
          hotel.totalRateWithoutmrk || hotel.totalRate || 0,
        );
        total += price;
        selling += sellPrice;
      } else if (item.activity) {
        const activity = item.activity;
        // Selling Price = totalRate (with markup)
        const sellPrice = parseFloat(activity.totalRate || 0);
        // Total Price = totalRateWithoutmrk (without markup)
        const price = parseFloat(
          activity.totalRateWithoutmrk || activity.totalRate || 0,
        );
        total += price;
        selling += sellPrice;
      } else if (item.cab) {
        const cab = item.cab;
        // Selling Price = totalRate (with markup)
        const sellPrice = parseFloat(cab.totalRate || 0);
        // Total Price = totalRateWithoutmrk (without markup)
        const price = parseFloat(cab.totalRateWithoutmrk || cab.totalRate || 0);
        total += price;
        selling += sellPrice;
      }
    });

    setTotalPrice(total);
    setSellingPrice(selling);
  };

  // Get hotels from cart
  const getHotels = () => {
    return cartData.filter((item) => item.hotel);
  };

  // Get activities from cart
  const getActivities = () => {
    return cartData.filter((item) => item.activity);
  };

  // Get transfers from cart
  const getTransfers = () => {
    return cartData.filter((item) => item.cab);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      if (dateString.includes("/")) {
        return dateString;
      }
      const date = new Date(dateString);
      return date.toLocaleDateString("en-GB");
    } catch {
      return dateString;
    }
  };

  // Format activity date for accordion header (e.g., 25 Mar 2026)
  const formatActivityDateHeader = (dateString) => {
    if (!dateString) return "";
    try {
      let date;
      if (dateString.includes("/")) {
        const [day, month, year] = dateString.split("/");
        date = new Date(year, month - 1, day);
      } else {
        date = new Date(dateString);
      }
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Format date to YYYY-MM-DD for backend
  const formatDateToYYYYMMDD = (dateString) => {
    if (!dateString) return "";
    try {
      let date;
      if (dateString.includes("/")) {
        // Handle DD/MM/YYYY format
        const [day, month, year] = dateString.split("/");
        date = new Date(year, month - 1, day);
      } else {
        date = new Date(dateString);
      }
      if (isNaN(date.getTime())) return "";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch {
      return dateString;
    }
  };

  // Format date to DD-MM-YYYY for backend (for tourDate, pickupDate, dropOffDate)
  const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return "";
    try {
      let date;
      if (dateString.includes("/")) {
        // Already in DD/MM/YYYY format, convert to DD-MM-YYYY
        return dateString.replace(/\//g, "-");
      } else {
        date = new Date(dateString);
      }
      if (isNaN(date.getTime())) return "";
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateString;
    }
  };

  // Calculate nights between two dates
  const calculateNights = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return 1;
    try {
      let start, end;
      if (checkIn.includes("/")) {
        const [day, month, year] = checkIn.split("/");
        start = new Date(year, month - 1, day);
      } else {
        start = new Date(checkIn);
      }

      if (checkOut.includes("/")) {
        const [day, month, year] = checkOut.split("/");
        end = new Date(year, month - 1, day);
      } else {
        end = new Date(checkOut);
      }

      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(1, diffDays);
    } catch {
      return 1;
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    let hasErrors = false;

    // Validate primary guest details
    if (!primaryGuest.salutation || primaryGuest.salutation.trim() === "") {
      errors.primaryGuest_salutation = "Salutation is required";
      hasErrors = true;
    }
    if (!primaryGuest.firstName || primaryGuest.firstName.trim() === "") {
      errors.primaryGuest_firstName = "First Name is required";
      hasErrors = true;
    }
    if (!primaryGuest.lastName || primaryGuest.lastName.trim() === "") {
      errors.primaryGuest_lastName = "Last Name is required";
      hasErrors = true;
    }
    if (
      !primaryGuest.contactNumber ||
      primaryGuest.contactNumber.trim() === ""
    ) {
      errors.primaryGuest_contactNumber = "Contact Number is required";
      hasErrors = true;
    }
    if (!primaryGuest.emailId || primaryGuest.emailId.trim() === "") {
      errors.primaryGuest_emailId = "Email Id is required";
      hasErrors = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryGuest.emailId)) {
      errors.primaryGuest_emailId = "Please enter a valid email address";
      hasErrors = true;
    }
    if (!primaryGuest.lpo || primaryGuest.lpo.trim() === "") {
      errors.primaryGuest_lpo = "LPO is required";
      hasErrors = true;
    }

    // Validate hotel room guest details
   const hotels = getHotels();
    if (hotels.length > 0) {
      hotels.forEach((item, hotelIndex) => {
        const hotel = item.hotel || {};
        const searchRoomDTOs = hotel.searchRoomDTOs || [];

        // Find hotel index in cartData
        let hotelIndexInCart = -1;
        let hotelCount = 0;
        for (let i = 0; i < cartData.length; i++) {
          if (cartData[i].hotel) {
            if (hotelCount === hotelIndex) {
              hotelIndexInCart = i;
              break;
            }
            hotelCount++;
          }
        }

        if (hotelIndexInCart >= 0) {
          searchRoomDTOs.forEach((room, roomIndex) => {
            const guestKey = `${hotelIndexInCart}-${roomIndex}`;
            const guests = roomGuests[guestKey] || [];

            guests.forEach((guest, guestIndex) => {
              // Use hotelIndexInCart for error key to match the guestKey used in rendering
              const errorPrefix = `hotel_${hotelIndexInCart}_room_${roomIndex}_guest_${guestIndex}`;

              if (
                !guest.salutation ||
                (typeof guest.salutation === "string" &&
                  guest.salutation.trim() === "")
              ) {
                errors[`${errorPrefix}_salutation`] = "Salutation is required";
                hasErrors = true;
              }
              if (
                !guest.firstName ||
                (typeof guest.firstName === "string" &&
                  guest.firstName.trim() === "")
              ) {
                errors[`${errorPrefix}_firstName`] = "First Name is required";
                hasErrors = true;
              }
              if (
                !guest.lastName ||
                (typeof guest.lastName === "string" &&
                  guest.lastName.trim() === "")
              ) {
                errors[`${errorPrefix}_lastName`] = "Last Name is required";
                hasErrors = true;
              }
              if (
                !guest.gender ||
                (typeof guest.gender === "string" && guest.gender.trim() === "")
              ) {
                errors[`${errorPrefix}_gender`] = "Gender is required";
                hasErrors = true;
              }
            });
          });
        }
      });
    } 

    return { errors, hasErrors };
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    // Validate form
    const { errors, hasErrors } = validateForm();

    if (hasErrors) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields correctly.");
      // Scroll to first error
      setTimeout(() => {
        const firstErrorField = document.querySelector(".is-invalid");
        if (firstErrorField) {
          firstErrorField.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 100);
      return;
    }

    // Clear validation errors before submission
    setValidationErrors({});

    // Show order summary modal
    setShowOrderSummaryModal(true);
  };

  // Confirm and submit booking
  const confirmBooking = async () => {
    setIsSubmitting(true);
    try {
      const hotels = getHotels();
      const activities = getActivities();
      const transfers = getTransfers();

      // Find hotel index in cartData
      const hotelIndexInCart =
        hotels.length > 0 ? cartData.findIndex((item) => item.hotel) : -1;

      // Prepare booking payload
      const firstHotel = hotels.length > 0 ? hotels[0].hotel : null;
      const checkIn = firstHotel?.checkIn || firstHotel?.checkInDate || "";
      const checkOut = firstHotel?.checkOut || firstHotel?.checkOutDate || "";
      const nights = calculateNights(checkIn, checkOut);

      console.log("firstHotel:", firstHotel);

      // Get travel date from sessionStorage (selected in search page)
      // Priority: sessionStorage travelDate > first activity date > hotel checkIn date
      const storedTravelDate = sessionStorage.getItem("makePkgTravelDate");
      const firstActivity =
        activities.length > 0 ? activities[0].activity : null;

      let tourDate = "";
      if (storedTravelDate) {
        // Use the travel date from sessionStorage (selected in search page)
        tourDate = formatDateToDDMMYYYY(storedTravelDate);
      } else if (firstActivity?.activityDate) {
        // Fallback to first activity date
        tourDate = formatDateToDDMMYYYY(firstActivity.activityDate);
      } else if (checkIn) {
        // Fallback to hotel checkIn date
        tourDate = formatDateToDDMMYYYY(checkIn);
      }

      // Get quoteId if booking is from converted quotation
      const quoteId = sessionStorage.getItem("makePkgQuoteId");

      // Build hotel booking requests for all hotels
      const hotelBookingRequests = hotels.map((item, hotelIndex) => {
        const hotel = item.hotel || {};
        const checkIn = hotel.checkIn || hotel.checkInDate || "";
        const checkOut = hotel.checkOut || hotel.checkOutDate || "";
        const nights = calculateNights(checkIn, checkOut);

        // Find hotel index in cartData to use for per-hotel state and room guests
        let hotelIndexInCart = -1;
        let hotelCount = 0;
        for (let i = 0; i < cartData.length; i++) {
          if (cartData[i].hotel) {
            if (hotelCount === hotelIndex) {
              hotelIndexInCart = i;
              break;
            }
            hotelCount++;
          }
        }
        // Fallback to hotelIndex if not found in cartData
        const actualHotelIndexInCart =
          hotelIndexInCart >= 0 ? hotelIndexInCart : hotelIndex;

        return {
          agentId: String(sessionStorage.getItem("makePkgAgentId") || "0"),
          apiId: String("INHOUSE"),
          hotelId: String(hotel.hotelId || ""),
          hotelName: hotel.hotelName || "",
          address: hotel.hotelAddress || hotel.address || "",
          starRating: parseInt(hotel.starRating || 0),
          checkInDate: formatDateToYYYYMMDD(checkIn),
          checkOutDate: formatDateToYYYYMMDD(checkOut),
          nights: nights,
          employeeId: "1",
          roomStatus:
            hotel.available === false ||
            hotel.available === "False" ||
            hotel.available === "false"
              ? "On Request"
              : "Available",
          cancellationPolicy: (() => {
            const policies = hotel.cancellationPolicy || [];
            if (Array.isArray(policies) && policies.length > 0) {
              // If policies are objects, extract policyText; otherwise use as-is
              return policies.map((p) =>
                typeof p === "string"
                  ? p
                  : p.policyText || p.text || JSON.stringify(p),
              );
            }
            return [];
          })(),
          // Calculate deadlineDate based on nonRefundable and cancellationPolicy
          deadlineDate: (() => {
            const nonRefundable =
              hotel.refundstatus === "N" ||
              hotel.nonRefundable === true ||
              hotel.nonRefundable === "true";

            if (nonRefundable === true || nonRefundable === "true") {
              // Non-refundable: 2 days before current date
              const today = new Date();
              const deadline = new Date(today);
              deadline.setDate(today.getDate() - 2);
              deadline.setHours(0, 0, 0, 0); // Set to midnight
              const year = deadline.getFullYear();
              const month = String(deadline.getMonth() + 1).padStart(2, "0");
              const day = String(deadline.getDate()).padStart(2, "0");
              return `${year}-${month}-${day}T00:00:00`;
            } else {
              // Refundable: 2 days before earliest fromDate from cancellationPolicy
              const policies = hotel.cancellationPolicy || [];
              if (policies.length === 0) {
                return null;
              }

              // Find earliest fromDate
              const dates = policies
                .map((p) => {
                  // Handle both object and string formats
                  if (typeof p === "object" && p.fromDate) {
                    return new Date(p.fromDate);
                  }
                  return null;
                })
                .filter((date) => date !== null && !isNaN(date.getTime()));

              if (dates.length === 0) {
                return null;
              }

              const earliestDate = new Date(
                Math.min(...dates.map((d) => d.getTime())),
              );
              const deadline = new Date(earliestDate);
              deadline.setDate(earliestDate.getDate() - 2);
              deadline.setHours(0, 0, 0, 0); // Set to midnight
              const year = deadline.getFullYear();
              const month = String(deadline.getMonth() + 1).padStart(2, "0");
              const day = String(deadline.getDate()).padStart(2, "0");
              return `${year}-${month}-${day}T00:00:00`;
            }
          })(),
          isBookandVoucher:
            (hotelBookingConfirmation[hotelIndex] || "Book & Voucher") ===
            "Book & Voucher",
          primaryGuest: {
            firstName: primaryGuest.firstName || "",
            middleName: primaryGuest.middleName || "",
            lastName: primaryGuest.lastName || "",
            nativeCountry: hotel.nationality || "",
            email: primaryGuest.emailId || "",
            phone: primaryGuest.contactNumber || "",
            passportNo: primaryGuest.passportNumber || "",
            salutaion: primaryGuest.salutation || "",
            agentlpo: primaryGuest.lpo || "",
          },
          rooms:
            hotel?.searchRoomDTOs?.map((room, idx) => {
              const guestKey = `${actualHotelIndexInCart}-${idx}`;
              const guests = roomGuests[guestKey] || [];

              // Calculate room rate - divide total hotel rate by number of rooms
              const totalRooms = hotel.searchRoomDTOs?.length || 1;
              // Selling Price = totalRate (with markup)
              const hotelTotalRate = parseFloat(hotel.totalRate || 0);
              const roomRate =
                totalRooms > 0 ? hotelTotalRate / totalRooms : hotelTotalRate;
              // Total Price = totalRateWithoutmrk (without markup)
              const hotelTotalRateWithoutMarkup = parseFloat(
                hotel.totalRateWithoutmrk || hotel.totalRate || 0,
              );
              const roomRateWithoutMarkup =
                totalRooms > 0
                  ? hotelTotalRateWithoutMarkup / totalRooms
                  : hotelTotalRateWithoutMarkup;

              return {
                roomNo: idx + 1,
                roomCategory: hotel.roomCategory || "",
                mealPlan: hotel.roomType || "",
                nonRefundable:
                  hotel.refundstatus === "N" ||
                  hotel.nonRefundable === true ||
                  hotel.nonRefundable === "true",
                currency: hotel.currency || "AED",
                rate: roomRate,
                rateWithoutMarkup: roomRateWithoutMarkup,
                adults: parseInt(room.adult || room.adults || 1),
                children: parseInt(room.child || room.children || 0),
                childAges: Array.isArray(room.childAge)
                  ? room.childAge.map((age) => parseInt(age) || 0)
                  : room.childAge
                    ? [parseInt(room.childAge) || 0]
                    : [],
                guests: guests.map((guest) => ({
                  salutation: guest.salutation || "",
                  firstName: guest.firstName || "",
                  middleName: guest.middleName || "",
                  lastName: guest.lastName || "",
                  gender: guest.gender || "",
                  isChild: guest.isChild || false,
                })),
              };
            }) || [],
          remarks: hotelRemarks[hotelIndex] || "",
          specialRequests: hotelSpecialRequests[hotelIndex] || "",
          tourismDirhams:
            parseFloat(hotelTourismDirhams[hotelIndex] || "0") || 0,
          bookingConfirmation:
            hotelBookingConfirmation[hotelIndex] || "Book & Voucher",
        };
      });

      const tdNumber =
        tourismDirham !== "" && !isNaN(Number(tourismDirham))
          ? Number(tourismDirham)
          : 0;
      const bookingPayload = {
        customPackageId: "",
        quoteId: quoteId ? parseInt(quoteId) : null, // Include quoteId if booking is from quotation
        sellingPrice: String((sellingPrice + tdNumber).toFixed(2)),
        totalPrice: String((totalPrice + tdNumber).toFixed(2)),
        tourismDirham: tdNumber > 0 ? tdNumber : null,
        tourDate: tourDate,
        visaStatus: visaRequired,
        visaAdult: parseInt(visaDetails.visaAdult || "0") || 0,
        visaAdultRate: parseFloat(visaDetails.visaAdultRate || "0") || 0,
        visaChild: parseInt(visaDetails.visaChild || "0") || 0,
        visaChildRate: parseFloat(visaDetails.visaChildRate || "0") || 0,
        visaInfant: parseInt(visaDetails.visaInfant || "0") || 0,
        visaInfantRate: parseFloat(visaDetails.visaInfantRate || "0") || 0,
        hotelBookingRequest:
          hotelBookingRequests.length > 0 ? hotelBookingRequests : [],
        customBookingActivityDTO: activities.map((item, activityArrayIndex) => {
          const activity = item.activity || {};
          const details = activity.details || {};
          // Selling Price = totalRate (with markup)
          const activitySellingPrice = parseFloat(activity.totalRate || 0);
          // Total Price = totalRateWithoutmrk (without markup)
          const activityTotalPrice = parseFloat(
            activity.totalRateWithoutmrk || activity.totalRate || 0,
          );

          // Find actual index in cartData
          let activityIndexInCart = -1;
          let activityCount = 0;
          for (let i = 0; i < cartData.length; i++) {
            if (cartData[i].activity) {
              if (activityCount === activityArrayIndex) {
                activityIndexInCart = i;
                break;
              }
              activityCount++;
            }
          }
          const actualIndex = activityIndexInCart >= 0 ? activityIndexInCart : 0;
          const activityDetail = activityDetails[actualIndex] || {};

          return {
            activityId: parseInt(activity.activityId || "0") || 0,
            tourDate: formatDateToDDMMYYYY(activity.activityDate || ""),
            noOfAdult:
              parseInt(activity.adult || activity.noOfAdult || "1") || 1,
            noOfChild:
              parseInt(activity.child || activity.noOfChild || "0") || 0,
            childAgeArray: Array.isArray(activity.childAge)
              ? activity.childAge.map((age) => String(age))
              : activity.childAge
                ? [String(activity.childAge)]
                : [],
            sellingPrice: String(activitySellingPrice.toFixed(2)),
            totalPrice: String(activityTotalPrice.toFixed(2)),
            driverName: activityDetail.driverName || "",
            driverContact: activityDetail.driverContact || "",
          };
        }),
        customBookingCabDTO: transfers.map((item, transferArrayIndex) => {
          // Find the actual index in cartData for this transfer
          let transferIndexInCart = -1;
          let cabCount = 0;
          for (let i = 0; i < cartData.length; i++) {
            if (cartData[i].cab) {
              if (cabCount === transferArrayIndex) {
                transferIndexInCart = i;
                break;
              }
              cabCount++;
            }
          }
          const actualIndex =
            transferIndexInCart >= 0 ? transferIndexInCart : 0;
          const transferDetail = transferDetails[actualIndex] || {};
          console.log("transferDetail::", transferDetail);
          const cab = item.cab || {};
          const details = cab.details || {};
          // Selling Price = totalRate (with markup)
          const cabTotalRate = parseFloat(cab.totalRate || 0);
          // Total Price = totalRateWithoutmrk (without markup)
          const cabTotalRateWithoutMrk = parseFloat(
            cab.totalRateWithoutmrk || cab.totalRate || 0,
          );

          return {
            cabId: parseInt(cab.cabId || "0") || 0,
            noOfCabs: parseInt(cab.noOfCabs || "1") || 1,
            pickupDate: formatDateToDDMMYYYY(cab.pickupDate || ""),
            dropOffDate: formatDateToDDMMYYYY(
              cab.dropDate || cab.dropOffDate || "",
            ),
            travelType: parseInt(cab.travelType || "1") || 1,
            hourDetails:
              parseInt(cab.hourDetails || cab.timeDetails || "0") || 0,
            dropDetails: parseInt(cab.dropDetails || "1") || 1,
            paxDetails: parseInt(cab.paxDetails || "1") || 1,
            luggage:
              cab.luggage === true ||
              cab.luggage === "true" ||
              String(cab.luggage).toLowerCase() === "true",
            locationId: parseInt(cab.locationId || "0") || 0,
            noOfAdult: parseInt(cab.adult || cab.noOfAdult || "1") || 1,
            noOfChild: parseInt(cab.child || cab.noOfChild || "0") || 0,
            childAgeArray: Array.isArray(cab.childAge)
              ? cab.childAge.map((age) => parseInt(age) || 0)
              : cab.childAge
                ? [parseInt(cab.childAge) || 0]
                : [],
            totalRate: cabTotalRate || 0,
            totalRateWithoutmrk: cabTotalRateWithoutMrk || 0,
            transporter:
              transferDetail.transporterName || cab.transporter || "",
            contactNumber:
              transferDetail.contactNumber || cab.contactNumber || "",
            driverName: transferDetail.driverName || cab.driverName || "",
            driverContact:
              transferDetail.driverContact || cab.driverContact || "",
          };
        }),
        customBookingItinearyDTO: (function () {
          const uniqueDates = [
            ...new Set(
              activities
                .map((item) => {
                  const act = item.activity || {};
                  return (
                    act.activityDate ||
                    (act.details && act.details.activityDate) ||
                    ""
                  );
                })
                .filter(Boolean),
            ),
          ].sort((a, b) => {
            const parse = (d) =>
              d.includes("/")
                ? new Date(
                    d.split("/")[2],
                    d.split("/")[1] - 1,
                    d.split("/")[0],
                  )
                : new Date(d);
            return parse(a) - parse(b);
          });
          const dtos = [];
          uniqueDates.forEach((date, index) => {
            const itins = selectedItineraries[date] || [];
            itins.forEach((itineraryId) => {
              dtos.push({
                itinearyId: parseInt(itineraryId) || 0,
                days: index + 1,
              });
            });
          });
          return dtos;
        })(),
        paymentApiId: null,
        agentId: parseInt(sessionStorage.getItem("makePkgAgentId") || "0"),
        isCartBooking: true,
        // Add-on services captured in the sticky side-panel (Visa, Meet &
        // Greet, transfers, optional tours, rentals, etc.). Only services
        // toggled ON are forwarded; null when none → backend persists
        // null and the booking-details view simply skips the section.
        addOnServices: collectEnabledAddOnServices(),
      };

      console.log("Makepkg Booking payload (legacy shape):", bookingPayload);

      // ── v2: transform the legacy payload into the v2 wire format ──
      // The v2 backend stores hotels / cabs / activities as flat lists and
      // visa as YES/NO; we keep the legacy bookingPayload assembly above
      // intact so all the nested calculations still run, then project the
      // pieces into the v2 shape here. Sends to /api/makeYourOwnPackageV2.
      // Primary guest + per-room guests are mirrored from HotelBookingPage.jsx
      // so the backend receives the same manifest shape it already understands.
      const firstHotelNationality = (() => {
        const firstHotel = (cartData || []).find((it) => it && it.hotel)?.hotel;
        return firstHotel?.nationality || "";
      })();

      const primaryGuestPayload = {
        salutation: primaryGuest.salutation || "",
        firstName: primaryGuest.firstName || "",
        middleName: primaryGuest.middleName || "",
        lastName: primaryGuest.lastName || "",
        email: primaryGuest.emailId || "",
        phone: primaryGuest.contactNumber || "",
        passportNo: primaryGuest.passportNumber || "",
        agentLpo: primaryGuest.lpo || "",
        nativeCountry: firstHotelNationality,
      };

      // Flat list of every guest captured across all hotels/rooms. The
      // master guest (first room, first guest of the first hotel) IS the
      // primary guest — we don't ship a duplicate entry for the lead
      // traveller. The master row is tagged `primaryGuest: true` and
      // carries the booking-owner contact info (email / phone /
      // agentLpo / nativeCountry); every other row is `primaryGuest:
      // false`. Total entries == real pax count (adults + children).
      const flatGuests = [];
      const firstHotelIdx = (cartData || []).findIndex(
        (it) => it && it.hotel
      );
      (cartData || []).forEach((cartItem, hotelIdx) => {
        if (!cartItem || !cartItem.hotel) return;
        const hotel = cartItem.hotel || {};
        const rooms = hotel.searchRoomDTOs || [];
        rooms.forEach((room, roomIdx) => {
          const guestKey = `${hotelIdx}-${roomIdx}`;
          const guests = roomGuests[guestKey] || [];
          guests.forEach((guest, guestIdx) => {
            const isMaster =
              hotelIdx === firstHotelIdx &&
              roomIdx === 0 &&
              guestIdx === 0;
            const row = {
              hotelIndex: hotelIdx,
              roomIndex: roomIdx,
              guestIndex: guestIdx,
              primaryGuest: isMaster,
              salutation: guest.salutation || "",
              firstName: guest.firstName || "",
              middleName: guest.middleName || "",
              lastName: guest.lastName || "",
              gender: guest.gender || "",
              isChild: !!guest.isChild,
              age: guest.age || "",
            };
            if (isMaster) {
              row.email = primaryGuest.emailId || "";
              row.phone = primaryGuest.contactNumber || "";
              row.passportNo = primaryGuest.passportNumber || "";
              row.nativeCountry = firstHotelNationality;
              row.agentLpo = primaryGuest.lpo || "";
            }
            flatGuests.push(row);
          });
        });
      });

      const v2Payload = {
        agentId: bookingPayload.agentId || null,
        agentName: sessionStorage.getItem("makePkgAgentName") || "",
        userId: bookingPayload.agentId || null,
        salutation: primaryGuest.salutation || null,
        customerFirstName: primaryGuest.firstName || null,
        customerLastName: primaryGuest.lastName || null,
        customerEmail: primaryGuest.emailId || null,
        customerPhone: primaryGuest.contactNumber || null,
        customerPassport: primaryGuest.passportNumber || null,
        customerNationality: firstHotelNationality || null,
        agentLpo: primaryGuest.lpo || null,
        sellingPrice: bookingPayload.sellingPrice || null,
        totalPrice: bookingPayload.totalPrice || null,
        tourismDirham: bookingPayload.tourismDirham || null,
        paymentMode: null,
        visaRequired: v2VisaRequired,
        serviceFlags: (() => {
          try {
            return JSON.parse(
              sessionStorage.getItem("makePkgV2Services") || "{}"
            );
          } catch {
            return {};
          }
        })(),
        addOnServices: bookingPayload.addOnServices || null,
        // Primary guest mirrors HotelBookingPage.jsx so the backend gets the
        // same lead-traveller block it already knows how to persist.
        primaryGuest: primaryGuestPayload,
        // Hotels carry the per-room guests[] inline (same shape used by
        // HotelBookingPage.jsx). Falls back to the raw cart shape for any
        // hotel that doesn't have per-room guest entries yet.
        hotels: (cartData || [])
          .filter((it) => it && it.hotel)
          .map((cartItem, hotelIdx) => {
            const hotel = cartItem.hotel || {};
            const searchRooms = hotel.searchRoomDTOs || [];
            const rooms = searchRooms.map((room, roomIdx) => {
              const guestKey = `${hotelIdx}-${roomIdx}`;
              const guests = (roomGuests[guestKey] || []).map((guest) => ({
                salutation: guest.salutation || "",
                firstName: guest.firstName || "",
                middleName: guest.middleName || "",
                lastName: guest.lastName || "",
                gender: guest.gender || "",
                isChild: !!guest.isChild,
                age: guest.age || "",
              }));
              return {
                roomNo: roomIdx + 1,
                adults: parseInt(room.adult || room.adults || 1) || 1,
                children: parseInt(room.child || room.children || 0) || 0,
                childAges: Array.isArray(room.childAge)
                  ? room.childAge.map((a) => parseInt(a) || 0)
                  : room.childAge
                  ? [parseInt(room.childAge) || 0]
                  : [],
                guests,
              };
            });
            return {
              ...hotel,
              rooms,
              tourismDirhams:
                parseFloat(hotelTourismDirhams[hotelIdx] || "0") || 0,
              remarks: hotelRemarks[hotelIdx] || "",
              specialRequests: hotelSpecialRequests[hotelIdx] || "",
              bookingConfirmation:
                hotelBookingConfirmation[hotelIdx] || "Book & Voucher",
            };
          }),
        cabs: Array.isArray(cartData)
          ? cartData
              .filter((it) => it && it.cab)
              .map((it, idx) => {
                const cab = it.cab || {};
                const td = transferDetails[idx] || {};
                return {
                  ...cab,
                  transporter: td.transporterName || cab.transporter || "",
                  driverName: td.driverName || cab.driverName || "",
                  driverContact: td.driverContact || cab.driverContact || "",
                };
              })
          : [],
        activities: Array.isArray(cartData)
          ? cartData
              .filter((it) => it && it.activity)
              .map((it) => it.activity)
          : [],
        // Flat guest manifest — every traveller across every room, keyed by
        // hotelIndex/roomIndex so the backend can rebuild the matrix.
        guests: flatGuests,
      };
      console.log("Makepkg Booking payload (v2 shape):", v2Payload);
      const response = await axiosInstance.post(
        "/api/makeYourOwnPackageV2/booking/save",
        v2Payload,
      );

      // v2 response shape: { id: <Long>, status: "SUCCESS" }
      if (
        response.data &&
        response.data.status === "SUCCESS" &&
        response.data.id != null
      ) {
        if (quoteId) sessionStorage.removeItem("makePkgQuoteId");
        // Clear the v2 flow flag so subsequent legacy bookings work as
        // before. Cart was already cleared server-side after save.
        sessionStorage.removeItem("makePkgFlow");
        sessionStorage.removeItem("makePkgV2Services");
        sessionStorage.removeItem("makePkgV2VisaRequired");
        setShowOrderSummaryModal(false);
        toast.success(`Booking saved (id ${response.data.id}).`);
        navigate("/booking-details/make-your-own-package-v2-list");
      } else {
        toast.error(response.data?.message || "Failed to submit booking.");
      }
    } catch (err) {
      console.error("Error submitting booking:", err);
      toast.error("Failed to submit booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex" style={{ minHeight: "100vh" }}>
        
        <div className="flex-grow-1 d-flex flex-column">
          <TopBar />
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <div className="loading-container text-center">
              <Spinner animation="border" variant="primary" size="lg" />
              <p className="mt-3 text-muted fw-semibold">
                Loading booking details...
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!cartData || cartData.length === 0) {
    return (
      <div className="d-flex" style={{ minHeight: "100vh" }}>
        <Sidebar />
        <div className="flex-grow-1 d-flex flex-column">
          <TopBar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center p-4">
            <div className="empty-state">
              <FaShoppingCart size={64} className="text-muted mb-3" />
              <Alert.Heading className="mb-3">No Items in Cart</Alert.Heading>
              <p className="text-muted mb-4">
                Your cart is empty. Please add items to cart first.
              </p>
              <Button
                variant="primary"
                size="lg"
                className="btn-booking btn-booking-primary"
                onClick={() => navigate("/new-booking/make-your-own-package")}
              >
                Go to Search
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const hotels = getHotels();
  const activities = getActivities();
  const transfers = getTransfers();

  const uniqueActivityDates = [
    ...new Set(
      activities
        .map((item) => {
          const act = item.activity || {};
          return (
            act.activityDate || (act.details && act.details.activityDate) || ""
          );
        })
        .filter(Boolean),
    ),
  ].sort((a, b) => {
    const parse = (d) =>
      d.includes("/")
        ? new Date(d.split("/")[2], d.split("/")[1] - 1, d.split("/")[0])
        : new Date(d);
    return parse(a) - parse(b);
  });

  return (
    <div className="hotel-booking-container make-pkg-booking-container">

      {/* ── Booking page visual overhaul ──
          One injected stylesheet that modernises every existing card,
          accordion, form input, table and button on this page. Targets
          existing classes so no JSX needs to change — pure UI polish. */}
      <style>{`
        .make-pkg-booking-container .content-wrapper {
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          min-height: 100vh;
        }
        .make-pkg-booking-container h4,
        .make-pkg-booking-container h5,
        .make-pkg-booking-container h6 {
          color: #1f2937;
          letter-spacing: -0.01em;
        }

        /* ── Accordion (the main form container) ───────────────────── */
        .booking-accordion .accordion-item {
          border: 1px solid #e5e7eb !important;
          border-radius: 16px !important;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
          margin-bottom: 14px !important;
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .booking-accordion .accordion-item:hover {
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.07);
        }
        .booking-accordion .accordion-header { margin: 0; }
        .booking-accordion .accordion-button {
          background: #ffffff !important;
          border: none !important;
          padding: 18px 22px !important;
          font-weight: 600 !important;
          color: #1f2937 !important;
          box-shadow: none !important;
          font-size: 1rem;
        }
        .booking-accordion .accordion-button:not(.collapsed) {
          background: linear-gradient(135deg, #f5f7ff 0%, #faf5ff 100%) !important;
          color: #4f46e5 !important;
          border-bottom: 1px solid #e5e7eb;
        }
        .booking-accordion .accordion-button:not(.collapsed) h5,
        .booking-accordion .accordion-button:not(.collapsed) h6,
        .booking-accordion .accordion-button:not(.collapsed) svg {
          color: #4f46e5 !important;
        }
        .booking-accordion .accordion-button:focus { box-shadow: none !important; }
        .booking-accordion .accordion-button::after {
          background-size: 1rem;
          opacity: 0.6;
          transition: transform 0.25s ease;
        }
        .booking-accordion .accordion-body {
          padding: 22px !important;
          background: #ffffff;
        }

        /* ── Form inputs ───────────────────────────────────────────── */
        .make-pkg-booking-container .form-control,
        .make-pkg-booking-container .form-select {
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          padding: 9px 13px;
          font-size: 0.92rem;
          background-color: #ffffff;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .make-pkg-booking-container .form-control:hover,
        .make-pkg-booking-container .form-select:hover {
          border-color: #cbd5e1;
        }
        .make-pkg-booking-container .form-control:focus,
        .make-pkg-booking-container .form-select:focus {
          border-color: #818cf8;
          box-shadow: 0 0 0 4px rgba(99,102,241,0.10);
          outline: none;
        }
        .make-pkg-booking-container .form-control.is-invalid,
        .make-pkg-booking-container .form-select.is-invalid {
          border-color: #ef4444;
        }
        .make-pkg-booking-container .form-label {
          font-weight: 600;
          font-size: 0.74rem;
          color: #4b5563;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }
        .make-pkg-booking-container .form-check-input:checked {
          background-color: #6366f1;
          border-color: #6366f1;
        }
        .make-pkg-booking-container .input-group-text {
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          color: #6b7280;
        }

        /* ── Tables ────────────────────────────────────────────────── */
        .make-pkg-booking-container .table {
          border-collapse: separate;
          border-spacing: 0;
          border-radius: 12px;
          overflow: hidden;
          background: #ffffff;
        }
        .make-pkg-booking-container .table thead th {
          background: linear-gradient(135deg, #f5f7ff 0%, #faf5ff 100%);
          color: #4b5563;
          font-weight: 600;
          font-size: 0.74rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #e5e7eb;
          padding: 14px 12px;
          vertical-align: middle;
        }
        .make-pkg-booking-container .table tbody td {
          padding: 14px 12px;
          vertical-align: middle;
          border-color: #f1f5f9;
          background: #ffffff;
        }
        .make-pkg-booking-container .table tbody tr:hover td {
          background: #fafbff;
        }

        /* ── Nested cards inside accordion bodies ─────────────────── */
        .make-pkg-booking-container .accordion-body .card {
          border: 1px solid #e5e7eb !important;
          border-radius: 12px !important;
          box-shadow: none !important;
          background: #fafbff;
        }
        .make-pkg-booking-container .accordion-body .card .card-header {
          background: transparent !important;
          border-bottom: 1px solid #eef0f4 !important;
          font-weight: 600;
          color: #1f2937;
        }

        /* ── Buttons ───────────────────────────────────────────────── */
        .make-pkg-booking-container .btn:not(.btn-link) {
          border-radius: 10px;
          font-weight: 500;
          transition: transform 0.1s ease, box-shadow 0.15s ease;
        }
        .make-pkg-booking-container .btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          border: none;
        }
        .make-pkg-booking-container .btn-primary:hover,
        .make-pkg-booking-container .btn-primary:focus {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          box-shadow: 0 4px 12px rgba(99,102,241,0.25);
        }
        .make-pkg-booking-container .btn-outline-primary {
          color: #6366f1;
          border-color: #6366f1;
        }
        .make-pkg-booking-container .btn-outline-primary:hover {
          background: #6366f1;
          border-color: #6366f1;
        }

        /* ── Badges ────────────────────────────────────────────────── */
        .make-pkg-booking-container .badge {
          font-weight: 600;
          padding: 5px 10px;
          border-radius: 999px;
          letter-spacing: 0.01em;
        }

        /* ── Itinerary day boxes ───────────────────────────────────── */
        .make-pkg-booking-container .itinerary-day-box {
          background: linear-gradient(135deg, #f5f7ff 0%, #faf5ff 100%);
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 16px 18px;
        }
        .make-pkg-booking-container .itinerary-plus-btn {
          width: 34px; height: 34px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        /* ── Validation error text ─────────────────────────────────── */
        .make-pkg-booking-container .invalid-feedback,
        .make-pkg-booking-container .text-danger {
          font-size: 0.78rem;
        }
      `}</style>

      <div className="main-content">
        <TopBar />
        <Sidebar />
        <main className="content-wrapper py-4">
          <Container fluid>
            <div className="d-flex justify-content-end mb-2">
              <AgentBalanceDisplay
                agentId={sessionStorage.getItem("makePkgAgentId")}
              />
            </div>

            {/* ── Top header strip: back arrow + title + step pill ── */}
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="d-flex align-items-center">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="btn btn-link p-0 me-3"
                  style={{ color: "#1f2937", fontSize: "1.4rem", textDecoration: "none" }}
                  aria-label="Back"
                >
                  ‹
                </button>
                <h3 className="fw-bold m-0" style={{ color: "#111827", letterSpacing: "-0.01em" }}>
                  Make Your Own Package
                </h3>
              </div>
            </div>

            {/* ── Inline wizard step indicator (image-style: clean, flat) ── */}
            {(() => {
              const steps = [
                { label: "Accommodation" },
                { label: "Transfers" },
                { label: "Tours & Activities" },
                { label: "Add-on Services" },
                { label: "Summary & Payment" },
              ];
              const currentIdx = steps.length - 1; // booking page = last step
              return (
                <div className="d-flex align-items-center mb-4 px-1">
                  {steps.map((step, idx) => {
                    const done = idx < currentIdx;
                    const active = idx === currentIdx;
                    return (
                      <React.Fragment key={step.label}>
                        <div className="d-flex align-items-center" style={{ flexShrink: 0 }}>
                          <div
                            style={{
                              width: 28, height: 28,
                              borderRadius: "50%",
                              background: done ? "#22c55e" : active ? "#3b82f6" : "#ffffff",
                              color: done || active ? "#fff" : "#9ca3af",
                              border: done || active ? "none" : "1.5px solid #d1d5db",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 600,
                              fontSize: "0.8rem",
                              flexShrink: 0,
                            }}
                          >
                            {done ? "✓" : idx + 1}
                          </div>
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: "0.88rem",
                              fontWeight: active ? 600 : 500,
                              color: done ? "#1f2937" : active ? "#1f2937" : "#9ca3af",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {step.label}
                          </span>
                        </div>
                        {idx < steps.length - 1 && (
                          <div
                            style={{
                              flex: 1,
                              height: 1,
                              background: idx < currentIdx ? "#22c55e" : "#e5e7eb",
                              margin: "0 12px",
                            }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}

            {/* (Old "Confirm Booking" totals card removed — the same
                breakdown now lives in the sticky Package Summary
                sidebar on the right so the operator always sees it
                while filling the form, instead of needing to scroll
                back to the top.) */}

            <Row>
              <Col lg={8}>
                {/* v2: default-open the two sections the operator
                    actually has to fill out — Guest Details (5) and
                    Add-Ons (6). The cart-line accordions
                    (0 Itinerary / 1 Hotel / 2 Tour / 3 Transfer)
                    start collapsed so the page opens compact; each
                    header surfaces a quick summary chip so the
                    operator can scan without expanding. */}
                <Accordion
                  defaultActiveKey={["5", "6"]}
                  alwaysOpen
                  className="booking-accordion"
                >
                  {/* Itinerary Option Section */}
                  <Accordion.Item eventKey="0" className="mb-2">
                    <Accordion.Header>
                      <h5 className="mb-0 fw-bold d-flex align-items-center">
                        Itinerary
                        {uniqueActivityDates.length > 0 && (
                          <span className="badge bg-info-subtle text-info ms-2">
                            {uniqueActivityDates.length} day
                            {uniqueActivityDates.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </h5>
                    </Accordion.Header>
                    <Accordion.Body>
                      <div className="itinerary-days-container">
                        {uniqueActivityDates.map((dateString, index) => (
                          <div className="itinerary-day-box mb-3" key={index}>
                            <div className="d-flex justify-content-between align-items-center">
                               <h6 className="mb-0 fw-bold">
                                <small className="fw-normal text-muted">
                                  Itinerary for activity on
                                </small>{" "}
                                {formatActivityDateHeader(dateString)}
                              </h6>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                className="rounded-circle itinerary-plus-btn"
                                onClick={() =>
                                  handleOpenItineraryModal(dateString)
                                }
                              >
                                <FaPlus />
                              </Button>
                            </div>
                            {/* Selected Itineraries Preview */}
                            {(selectedItineraries[dateString] || []).length >
                              0 && (
                              <div className="mt-3 pt-3 border-top">
                                {(selectedItineraries[dateString] || []).map(
                                  (itineraryId) => {
                                    const itinerary = itineraryList.find(
                                      (item) =>
                                        item.itineraryId === itineraryId,
                                    );
                                    if (!itinerary) return null;
                                    return (
                                      <div
                                        key={itineraryId}
                                        className="d-flex justify-content-between align-items-center mb-2 itinerary-preview-item"
                                      >
                                        <div className="d-flex align-items-center flex-grow-1">
                                          <FaCheckCircle
                                            className="text-success me-2"
                                            size={14}
                                          />
                                          <span className="small">
                                            {itinerary.itineraryHeading ||
                                              "Untitled"}
                                          </span>
                                        </div>
                                        <Button
                                          variant="link"
                                          size="sm"
                                          className="text-danger p-0 ms-2"
                                          style={{
                                            fontSize: "0.75rem",
                                            minWidth: "auto",
                                          }}
                                          onClick={() => {
                                            setSelectedItineraries((prev) => ({
                                              ...prev,
                                              [dateString]: prev[
                                                dateString
                                              ].filter(
                                                (id) => id !== itineraryId,
                                              ),
                                            }));
                                          }}
                                        >
                                          ×
                                        </Button>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {uniqueActivityDates.length === 0 && (
                          <div className="text-muted small">
                            No activities found to generate itinerary days.
                          </div>
                        )}
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>

                  {/* Hotel Option Section */}
                  {hotels.length > 0 && (
                    <Accordion.Item eventKey="1" className="mb-2">
                      <Accordion.Header>
                        <h5 className="mb-0 fw-bold d-flex align-items-center">
                          Hotels
                          <span className="badge bg-primary-subtle text-primary ms-2">
                            {hotels.length}
                          </span>
                        </h5>
                      </Accordion.Header>
                      <Accordion.Body>
                        {hotels.map((item, hotelIndex) => {
                          const hotel = item.hotel || {};
                          const details = hotel.details || {};
                          const checkIn =
                            hotel.checkIn ||
                            hotel.checkInDate ||
                            details.checkInDate ||
                            "";
                          const checkOut =
                            hotel.checkOut ||
                            hotel.checkOutDate ||
                            details.checkOutDate ||
                            "";
                          const searchRoomDTOs =
                            hotel.searchRoomDTOs ||
                            details.searchRoomDTOs ||
                            [];

                          // Calculate date range for pricing table
                          const getDateRange = (startDate, endDate) => {
                            if (!startDate || !endDate) return [];
                            try {
                              // Handle DD/MM/YYYY format
                              let start, end;
                              if (startDate.includes("/")) {
                                const [day, month, year] = startDate.split("/");
                                start = new Date(year, month - 1, day);
                              } else {
                                start = new Date(startDate);
                              }

                              if (endDate.includes("/")) {
                                const [day, month, year] = endDate.split("/");
                                end = new Date(year, month - 1, day);
                              } else {
                                end = new Date(endDate);
                              }

                              const dates = [];
                              const current = new Date(start);
                              while (current < end) {
                                dates.push(new Date(current));
                                current.setDate(current.getDate() + 1);
                              }
                              return dates;
                            } catch {
                              return [];
                            }
                          };

                          const dateRange = getDateRange(checkIn, checkOut);
                          // Total Price = totalRateWithoutmrk (without markup)
                          const hotelTotalPrice = parseFloat(
                            hotel.totalRateWithoutmrk || hotel.totalRate || 0,
                          );
                          // Selling Price = totalRate (with markup)
                          const hotelSellingPrice = parseFloat(
                            hotel.totalRate || 0,
                          );
                          const pricePerNight =
                            dateRange.length > 0
                              ? hotelTotalPrice / dateRange.length
                              : hotelTotalPrice;

                          return (
                            <div
                              key={hotelIndex}
                              className="simple-section-row"
                            >
                              <div className="simple-section-row-title">
                                <FaBed className="text-primary me-2" />
                                <span className="fw-bold">
                                  {hotels.length > 1
                                    ? `Hotel ${hotelIndex + 1}: `
                                    : ""}
                                  {hotel.hotelName || "Hotel"}
                                </span>
                              </div>
                              <div className="simple-section-row-body">
                                <div className="small mb-2">
                                  <FaCalendarAlt className="text-primary me-1" />
                                  <strong>Checkin:</strong>{" "}
                                  {formatDate(checkIn)}
                                  {" / "}
                                  <strong>Checkout:</strong>{" "}
                                  {formatDate(checkOut)}
                                </div>

                                {searchRoomDTOs.length > 0 && (
                                  <>
                                    <Table
                                      striped
                                      bordered
                                      hover
                                      responsive
                                      size="sm"
                                      className="mb-3 room-table"
                                    >
                                      <thead>
                                        <tr>
                                          <th>No.</th>
                                          <th>Room Category</th>
                                          <th>Adult Count</th>
                                          <th>Child Count</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {searchRoomDTOs.map(
                                          (room, roomIndex) => {
                                            let childAges = [];
                                            if (room.childAge) {
                                              childAges = Array.isArray(
                                                room.childAge,
                                              )
                                                ? room.childAge
                                                : [room.childAge];
                                            } else if (room.childAges) {
                                              childAges = Array.isArray(
                                                room.childAges,
                                              )
                                                ? room.childAges
                                                : [room.childAges];
                                            }

                                            const childCount = parseInt(
                                              room.child || room.children || 0,
                                            );

                                            return (
                                              <tr key={roomIndex}>
                                                <td>{roomIndex + 1}</td>
                                                <td>
                                                  {hotel.roomCategory || "-"}
                                                  {hotel.roomType &&
                                                    ` - ${hotel.roomType}`}
                                                </td>
                                                <td>
                                                  {room.adult ||
                                                    room.adults ||
                                                    "-"}
                                                </td>
                                                <td>
                                                  {childCount > 0 ? (
                                                    <>
                                                      {childCount}
                                                      {childAges.length > 0 &&
                                                        childAges.length ===
                                                          1 && (
                                                          <small className="text-muted d-block mt-1">
                                                            {childCount} Child :{" "}
                                                            {childAges[0]} Age
                                                          </small>
                                                        )}
                                                      {childAges.length > 1 && (
                                                        <small className="text-muted d-block mt-1">
                                                          {childAges.map(
                                                            (age, idx) => (
                                                              <span key={idx}>
                                                                {idx + 1} Child
                                                                : {age} Age
                                                                {idx <
                                                                childAges.length -
                                                                  1
                                                                  ? ", "
                                                                  : ""}
                                                              </span>
                                                            ),
                                                          )}
                                                        </small>
                                                      )}
                                                    </>
                                                  ) : (
                                                    "-"
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          },
                                        )}
                                      </tbody>
                                    </Table>
                                    {/* Guest Details for each room */}
                                    {searchRoomDTOs.map((room, roomIndex) => {
                                      const adults = parseInt(
                                        room.adult || room.adults || 1,
                                      );
                                      const children = parseInt(
                                        room.child || room.children || 0,
                                      );
                                      const totalGuests = adults + children;

                                      // Find hotel index in cartData to match validation
                                      let hotelIndexInCart = -1;
                                      let hotelCount = 0;
                                      for (
                                        let i = 0;
                                        i < cartData.length;
                                        i++
                                      ) {
                                        if (cartData[i].hotel) {
                                          if (hotelCount === hotelIndex) {
                                            hotelIndexInCart = i;
                                            break;
                                          }
                                          hotelCount++;
                                        }
                                      }

                                      const guestKey =
                                        hotelIndexInCart >= 0
                                          ? `${hotelIndexInCart}-${roomIndex}`
                                          : `${hotelIndex}-${roomIndex}`;
                                      const guests = roomGuests[guestKey] || [];
                                      const actualHotelIndex =
                                        hotelIndexInCart >= 0
                                          ? hotelIndexInCart
                                          : hotelIndex;

                                      if (totalGuests === 0) return null;

                                      return (
                                        <Card
                                          key={`guest-${roomIndex}`}
                                          className="mb-2 guest-details-card"
                                        >
                                          <Card.Header>
                                            <h6 className="mb-0">
                                              Room {roomIndex + 1} - Guest
                                              Details
                                            </h6>
                                          </Card.Header>
                                          <Card.Body>
                                            {Array.from(
                                              { length: totalGuests },
                                              (_, guestIndex) => {
                                                const isChild =
                                                  guestIndex >= adults;
                                                const guest = guests[
                                                  guestIndex
                                                ] || {
                                                  salutation: "",
                                                  firstName: "",
                                                  lastName: "",
                                                  gender: "",
                                                  isChild: isChild,
                                                };

                                                return (
                                                  <div
                                                    key={guestIndex}
                                                    className="guest-row-item"
                                                  >
                                                    <h6 className="mb-2">
                                                      {isChild
                                                        ? `Child ${guestIndex - adults + 1}${guest.age ? ` (Age: ${guest.age})` : ""}`
                                                        : `Adult ${guestIndex + 1}`}
                                                    </h6>
                                                    <Row className="g-2">
                                                      <Col md={3}>
                                                        <Form.Label className="small">
                                                          Salutation{" "}
                                                          <span className="text-danger">
                                                            *
                                                          </span>
                                                        </Form.Label>
                                                        <Form.Select
                                                          size="sm"
                                                          value={
                                                            guest.salutation
                                                          }
                                                          onChange={(e) =>
                                                            handleGuestChange(
                                                              actualHotelIndex,
                                                              roomIndex,
                                                              guestIndex,
                                                              "salutation",
                                                              e.target.value,
                                                            )
                                                          }
                                                          required
                                                          isInvalid={
                                                            !!validationErrors[
                                                              `hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_salutation`
                                                            ]
                                                          }
                                                        >
                                                          <option value="">
                                                            Select
                                                          </option>
                                                          <option value="Mr">
                                                            Mr
                                                          </option>
                                                          <option value="Mrs">
                                                            Mrs
                                                          </option>
                                                          <option value="Ms">
                                                            Ms
                                                          </option>
                                                          <option value="Miss">
                                                            Miss
                                                          </option>
                                                          <option value="Dr">
                                                            Dr
                                                          </option>
                                                        </Form.Select>
                                                        <Form.Control.Feedback type="invalid">
                                                          {
                                                            validationErrors[
                                                              `hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_salutation`
                                                            ]
                                                          }
                                                        </Form.Control.Feedback>
                                                      </Col>
                                                      <Col md={4}>
                                                        <Form.Label className="small">
                                                          First Name{" "}
                                                          <span className="text-danger">
                                                            *
                                                          </span>
                                                        </Form.Label>
                                                        <Form.Control
                                                          type="text"
                                                          size="sm"
                                                          value={
                                                            guest.firstName ||
                                                            ""
                                                          }
                                                          onChange={(e) =>
                                                            handleGuestChange(
                                                              actualHotelIndex,
                                                              roomIndex,
                                                              guestIndex,
                                                              "firstName",
                                                              e.target.value,
                                                            )
                                                          }
                                                          required
                                                          placeholder="First Name"
                                                          isInvalid={
                                                            !!validationErrors[
                                                              `hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_firstName`
                                                            ]
                                                          }
                                                        />
                                                        <Form.Control.Feedback type="invalid">
                                                          {
                                                            validationErrors[
                                                              `hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_firstName`
                                                            ]
                                                          }
                                                        </Form.Control.Feedback>
                                                      </Col>
                                                      <Col md={5}>
                                                        <Form.Label className="small">
                                                          Last Name{" "}
                                                          <span className="text-danger">
                                                            *
                                                          </span>
                                                        </Form.Label>
                                                        <Form.Control
                                                          type="text"
                                                          size="sm"
                                                          value={
                                                            guest.lastName || ""
                                                          }
                                                          onChange={(e) =>
                                                            handleGuestChange(
                                                              actualHotelIndex,
                                                              roomIndex,
                                                              guestIndex,
                                                              "lastName",
                                                              e.target.value,
                                                            )
                                                          }
                                                          required
                                                          placeholder="Last Name"
                                                          isInvalid={
                                                            !!validationErrors[
                                                              `hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_lastName`
                                                            ]
                                                          }
                                                        />
                                                        <Form.Control.Feedback type="invalid">
                                                          {
                                                            validationErrors[
                                                              `hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_lastName`
                                                            ]
                                                          }
                                                        </Form.Control.Feedback>
                                                      </Col>
                                                      <Col md={4}>
                                                        <Form.Label className="small">
                                                          Gender{" "}
                                                          <span className="text-danger">
                                                            *
                                                          </span>
                                                        </Form.Label>
                                                        <Form.Select
                                                          size="sm"
                                                          value={
                                                            guest.gender || ""
                                                          }
                                                          onChange={(e) =>
                                                            handleGuestChange(
                                                              actualHotelIndex,
                                                              roomIndex,
                                                              guestIndex,
                                                              "gender",
                                                              e.target.value,
                                                            )
                                                          }
                                                          required
                                                          isInvalid={
                                                            !!validationErrors[
                                                              `hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_gender`
                                                            ]
                                                          }
                                                        >
                                                          <option value="">
                                                            Select
                                                          </option>
                                                          <option value="Male">
                                                            Male
                                                          </option>
                                                          <option value="Female">
                                                            Female
                                                          </option>
                                                        </Form.Select>
                                                        <Form.Control.Feedback type="invalid">
                                                          {
                                                            validationErrors[
                                                              `hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_gender`
                                                            ]
                                                          }
                                                        </Form.Control.Feedback>
                                                      </Col>
                                                    </Row>
                                                  </div>
                                                );
                                              },
                                            )}
                                          </Card.Body>
                                        </Card>
                                      );
                                    })}
                                  </>
                                )}

                                {/* Date-wise Pricing Table */}
                                {dateRange.length > 0 && (
                                  <Table
                                    striped
                                    bordered
                                    hover
                                    responsive
                                    size="sm"
                                    className="mb-2 date-pricing-table"
                                  >
                                    <thead>
                                      <tr>
                                        <th>Date</th>
                                        <th>Total Price</th>
                                        <th>Selling Price</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {dateRange.map((date, dateIndex) => {
                                        const dateStr =
                                          date.toLocaleDateString("en-GB");
                                        return (
                                          <tr key={dateIndex}>
                                            <td>{dateStr}</td>
                                            <td>{pricePerNight.toFixed(2)}</td>
                                            <td>{pricePerNight.toFixed(2)}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </Table>
                                )}

                                {/* Selling Price and Total Price */}
                                {/* <div className="mb-3">
                                <Row className="g-2">
                                  <Col sm={6}>
                                    <div className="d-flex justify-content-between align-items-center">
                                      <strong>Selling Price:</strong>
                                      <span className="text-success fw-bold">
                                        {hotelSellingPrice.toFixed(2)}
                                      </span>
                                    </div>
                                  </Col>
                                  <Col sm={6}>
                                    <div className="d-flex justify-content-between align-items-center">
                                      <strong>Total Price:</strong>
                                      <span className="text-primary fw-bold">
                                        {hotelTotalPrice.toFixed(2)}
                                      </span>
                                    </div>
                                  </Col>
                                </Row>
                              </div> */}

                                {/* Tourism Dirhams */}
                                <Row className="mb-2">
                                  <Col md={6}>
                                    <Form.Label>
                                      Tourism Dirhams (AED)
                                    </Form.Label>
                                    <Form.Control
                                      type="number"
                                      value={
                                        hotelTourismDirhams[hotelIndex] || "0"
                                      }
                                      onChange={(e) =>
                                        setHotelTourismDirhams({
                                          ...hotelTourismDirhams,
                                          [hotelIndex]: e.target.value,
                                        })
                                      }
                                      min="0"
                                    />
                                  </Col>
                                </Row>

                                {/* Remarks */}
                                <Row className="mb-2">
                                  <Col>
                                    <Form.Label>Remarks</Form.Label>
                                    <Form.Control
                                      as="textarea"
                                      rows={3}
                                      value={hotelRemarks[hotelIndex] || ""}
                                      onChange={(e) =>
                                        setHotelRemarks({
                                          ...hotelRemarks,
                                          [hotelIndex]: e.target.value,
                                        })
                                      }
                                      placeholder="Enter any remarks..."
                                    />
                                  </Col>
                                </Row>

                                {/* Special Request */}
                                <Row className="mb-2">
                                  <Col>
                                    <Form.Label>Special Request</Form.Label>
                                    <Form.Control
                                      as="textarea"
                                      rows={3}
                                      value={
                                        hotelSpecialRequests[hotelIndex] || ""
                                      }
                                      onChange={(e) =>
                                        setHotelSpecialRequests({
                                          ...hotelSpecialRequests,
                                          [hotelIndex]: e.target.value,
                                        })
                                      }
                                      placeholder="Enter any special requests..."
                                    />
                                  </Col>
                                </Row>

                                {/* Booking Confirmation */}
                                <div className="mb-3">
                                  <Form.Label className="mb-2">
                                    Are you sure to continue booking?
                                  </Form.Label>
                                  <div>
                                    <Form.Check
                                      type="radio"
                                      label="Book & Voucher"
                                      name={`bookingConfirmation-${hotelIndex}`}
                                      value="Book & Voucher"
                                      checked={
                                        hotelBookingConfirmation[hotelIndex] ===
                                        "Book & Voucher"
                                      }
                                      onChange={(e) =>
                                        setHotelBookingConfirmation({
                                          ...hotelBookingConfirmation,
                                          [hotelIndex]: e.target.value,
                                        })
                                      }
                                      inline
                                      className="me-3"
                                    />
                                    <Form.Check
                                      type="radio"
                                      label="Book Now & Voucher later"
                                      name={`bookingConfirmation-${hotelIndex}`}
                                      value="Book Now & Voucher later"
                                      checked={
                                        hotelBookingConfirmation[hotelIndex] ===
                                        "Book Now & Voucher later"
                                      }
                                      onChange={(e) =>
                                        setHotelBookingConfirmation({
                                          ...hotelBookingConfirmation,
                                          [hotelIndex]: e.target.value,
                                        })
                                      }
                                      inline
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Activity Option Section */}
                  {activities.length > 0 && (
                    <Accordion.Item eventKey="2" className="mb-2">
                      <Accordion.Header>
                        <h5 className="mb-0 fw-bold d-flex align-items-center">
                          Tours &amp; Activities
                          <span className="badge bg-warning-subtle text-warning ms-2">
                            {activities.length}
                          </span>
                        </h5>
                      </Accordion.Header>
                      <Accordion.Body>
                        {activities.map((item, activityIndex) => {
                          const activity = item.activity || {};
                          const details = activity.details || {};
                          const activityName =
                            activity.activityName ||
                            details.activityName ||
                            "Activity";
                          const activityDate =
                            activity.activityDate || details.activityDate || "";
                          const adult =
                            activity.adult ||
                            details.adult ||
                            activity.noOfAdult ||
                            "0";
                          const child =
                            activity.child ||
                            details.child ||
                            activity.noOfChild ||
                            "0";

                          let childAges = [];
                          if (activity.childAge) {
                            childAges = Array.isArray(activity.childAge)
                              ? activity.childAge
                              : [activity.childAge];
                          }

                          // Selling Price = totalRate (with markup)
                          const sellingPrice = parseFloat(
                            activity.totalRate || 0,
                          );
                          // Total Price = totalRateWithoutmrk (without markup)
                          const totalPrice = parseFloat(
                            activity.totalRateWithoutmrk ||
                              activity.totalRate ||
                              0,
                          );

                          // Find actual index in cartData for activityDetails
                          let activityIndexInCart = -1;
                          let activityCount = 0;
                          for (let i = 0; i < cartData.length; i++) {
                            if (cartData[i].activity) {
                              if (activityCount === activityIndex) {
                                activityIndexInCart = i;
                                break;
                              }
                              activityCount++;
                            }
                          }
                          const actualIndex = activityIndexInCart >= 0 ? activityIndexInCart : 0;
                          const activityDetail = activityDetails[actualIndex] || {};

                          return (
                            <div
                              key={activityIndex}
                              className="simple-section-row"
                            >
                              <div className="simple-section-row-title">
                                <FaTicketAlt className="text-primary me-2" />
                                <span className="fw-bold">
                                  {activities.length > 1
                                    ? `Activity ${activityIndex + 1}: `
                                    : ""}
                                  {activityName}
                                </span>
                              </div>
                              <div className="simple-section-row-body">
                                <Row className="g-2 align-items-center small">
                                  <Col md={4}>
                                    <FaCalendarAlt className="text-primary me-1" />
                                    <strong>Tour date:</strong>{" "}
                                    {formatDate(activityDate)}
                                  </Col>
                                  <Col md={2}>
                                    <span className="text-muted">Adults: </span>
                                    <strong>{adult}</strong>
                                  </Col>
                                  <Col md={2}>
                                    <span className="text-muted">Children: </span>
                                    <strong>{child}</strong>
                                    {childAges.length > 0 && (
                                      <span className="text-muted ms-1">
                                        ({childAges.join(", ")})
                                      </span>
                                    )}
                                  </Col>
                                  <Col md={2} className="text-md-end">
                                    <span className="text-muted">Selling: </span>
                                    <strong className="text-success">
                                      AED {sellingPrice.toFixed(2)}
                                    </strong>
                                  </Col>
                                  <Col md={2} className="text-md-end">
                                    <span className="text-muted">Total: </span>
                                    <strong className="text-primary">
                                      AED {totalPrice.toFixed(2)}
                                    </strong>
                                  </Col>
                                </Row>

                                {/* <div className="mb-3 p-3 bg-light rounded mt-3">
                                  <h6 className="mb-3 fw-bold text-primary">
                                    Driver Details
                                  </h6>
                                  <Row className="g-3">
                                    <Col md={6}>
                                      <Form.Label>Driver Name</Form.Label>
                                      <Form.Control
                                        type="text"
                                        value={activityDetail.driverName || ""}
                                        onChange={(e) =>
                                          setActivityDetails({
                                            ...activityDetails,
                                            [actualIndex]: {
                                              ...activityDetail,
                                              driverName: e.target.value,
                                            },
                                          })
                                        }
                                        placeholder="Enter driver name"
                                      />
                                    </Col>
                                    <Col md={6}>
                                      <Form.Label>Driver Contact</Form.Label>
                                      <Form.Control
                                        type="text"
                                        value={activityDetail.driverContact || ""}
                                        onChange={(e) =>
                                          setActivityDetails({
                                            ...activityDetails,
                                            [actualIndex]: {
                                              ...activityDetail,
                                              driverContact: e.target.value,
                                            },
                                          })
                                        }
                                        placeholder="Enter driver contact"
                                      />
                                    </Col>
                                  </Row>
                                </div> */}
                              </div>
                            </div>
                          );
                        })}
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Transfer Option Section */}
                  {transfers.length > 0 && (
                    <Accordion.Item eventKey="3" className="mb-2">
                      <Accordion.Header>
                        <h5 className="mb-0 fw-bold d-flex align-items-center">
                          Transfers
                          <span className="badge bg-info-subtle text-info ms-2">
                            {transfers.length}
                          </span>
                        </h5>
                      </Accordion.Header>
                      <Accordion.Body>
                        {transfers.map((item, transferIndex) => {
                          const cab = item.cab || {};
                          const details = cab.details || {};
                          const vehicleName =
                            cab.vehicleName ||
                            details.vehicleName ||
                            "Transfer";
                          const capacity =
                            cab.capacity || details.capacity || "";
                          const pickupDate = cab.pickupDate || "";
                          const dropDate = cab.dropoffDate || "";
                          const adult =
                            cab.adult || details.adult || cab.noOfAdult || "0";
                          const child =
                            cab.child || details.child || cab.noOfChild || "0";
                          const travelType =
                            cab.travelType || details.travelType || "1";
                          const shareType =
                            cab.shareType || details.shareType || "Private";

                          // Handle childAge
                          let childAges = [];
                          if (cab.childAge) {
                            childAges = Array.isArray(cab.childAge)
                              ? cab.childAge
                              : [cab.childAge];
                          } else if (cab.childAges) {
                            childAges = Array.isArray(cab.childAges)
                              ? cab.childAges
                              : [cab.childAges];
                          } else if (cab.childAgeArray) {
                            childAges = Array.isArray(cab.childAgeArray)
                              ? cab.childAgeArray
                              : [cab.childAgeArray];
                          } else if (details.childAge) {
                            childAges = Array.isArray(details.childAge)
                              ? details.childAge
                              : [details.childAge];
                          } else if (details.childAgeArray) {
                            childAges = Array.isArray(details.childAgeArray)
                              ? details.childAgeArray
                              : [details.childAgeArray];
                          }

                          const transferDetail =
                            transferDetails[transferIndex] || {};
                          // Selling Price = totalRate (with markup)
                          const sellingPrice = parseFloat(cab.totalRate || 0);
                          // Total Price = totalRateWithoutmrk (without markup)
                          const totalPrice = parseFloat(
                            cab.totalRateWithoutmrk || cab.totalRate || 0,
                          );

                          // Get travel type label
                          const getTravelTypeLabel = (type) => {
                            if (type === "1") return "Arrival & Departure";
                            if (type === "2") return "Arrival";
                            if (type === "3") return "Departure";
                            return type;
                          };

                          return (
                            <div
                              key={transferIndex}
                              className="simple-section-row"
                            >
                              <div className="simple-section-row-title">
                                <FaCar className="text-primary me-2" />
                                <span className="fw-bold">
                                  {transfers.length > 1
                                    ? `Transfer ${transferIndex + 1}: `
                                    : ""}
                                  {capacity
                                    ? `${capacity} Seater`
                                    : vehicleName}
                                </span>
                              </div>
                              <div className="simple-section-row-body">
                                <Row className="g-2 align-items-center small mb-2">
                                  <Col md={4}>
                                    <FaCalendarAlt className="text-primary me-1" />
                                    <strong>Pickup:</strong>{" "}
                                    {formatDate(pickupDate)}
                                    {" / "}
                                    <strong>Drop:</strong>{" "}
                                    {formatDate(dropDate)}
                                  </Col>
                                  <Col md={3}>
                                    <span className="text-muted">Type: </span>
                                    <strong>
                                      {getTravelTypeLabel(travelType)} /{" "}
                                      {shareType}
                                    </strong>
                                  </Col>
                                  <Col md={2}>
                                    <span className="text-muted">Adults: </span>
                                    <strong>{adult}</strong>
                                  </Col>
                                  <Col md={3}>
                                    <span className="text-muted">Children: </span>
                                    <strong>{child}</strong>
                                    {childAges.length > 0 && (
                                      <span className="text-muted ms-1">
                                        ({childAges.join(", ")})
                                      </span>
                                    )}
                                  </Col>
                                </Row>
                                <Row className="g-2 align-items-end mb-2">
                                  <Col md={6}>
                                    <Form.Label className="small mb-1">
                                      Transporter Name
                                    </Form.Label>
                                    <Form.Control
                                      size="sm"
                                      type="text"
                                      value={
                                        transferDetails[transferIndex]
                                          ?.transporterName !== undefined
                                          ? transferDetails[transferIndex]
                                              .transporterName
                                          : primaryGuest.firstName || ""
                                      }
                                      onChange={(e) =>
                                        setTransferDetails({
                                          ...transferDetails,
                                          [transferIndex]: {
                                            ...transferDetail,
                                            transporterName: e.target.value,
                                          },
                                        })
                                      }
                                      placeholder="Enter transporter name"
                                    />
                                  </Col>
                                  <Col md={3} className="text-md-end">
                                    <span className="text-muted small">
                                      Selling:{" "}
                                    </span>
                                    <strong className="text-success">
                                      AED {sellingPrice.toFixed(2)}
                                    </strong>
                                  </Col>
                                  <Col md={3} className="text-md-end">
                                    <span className="text-muted small">
                                      Total:{" "}
                                    </span>
                                    <strong className="text-primary">
                                      AED {totalPrice.toFixed(2)}
                                    </strong>
                                  </Col>
                                </Row>
                              </div>
                            </div>
                          );
                        })}
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Visa Information accordion removed in v2 — the
                      Visa YES/NO + support contact is captured on the
                      /addons step and surfaced in the "Selected Add-On
                      Services" panel below alongside the other add-ons,
                      so duplicating it as its own accordion here was
                      redundant. */}

                  {/* Guest Details Section - Always Open */}
                  <Accordion.Item eventKey="5" className="mb-2">
                    <Accordion.Header>
                      <h5 className="mb-0 fw-bold">Guest Details</h5>
                    </Accordion.Header>
                    <Accordion.Body>
                      <Form className="booking-form">
                        <Row className="g-2">
                          <Col md={3}>
                            <Form.Label>
                              Title <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Select
                              value={primaryGuest.salutation}
                              onChange={(e) =>
                                handlePrimaryGuestChange(
                                  "salutation",
                                  e.target.value,
                                )
                              }
                              isInvalid={
                                !!validationErrors.primaryGuest_salutation
                              }
                              required
                            >
                              <option value="">Select</option>
                              <option value="Mr">Mr</option>
                              <option value="Mrs">Mrs</option>
                              <option value="Ms">Ms</option>
                              <option value="Dr">Dr</option>
                            </Form.Select>
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.primaryGuest_salutation}
                            </Form.Control.Feedback>
                          </Col>
                          <Col md={4}>
                            <Form.Label>
                              First Name <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              value={primaryGuest.firstName}
                              onChange={(e) =>
                                handlePrimaryGuestChange(
                                  "firstName",
                                  e.target.value,
                                )
                              }
                              isInvalid={
                                !!validationErrors.primaryGuest_firstName
                              }
                              required
                            />
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.primaryGuest_firstName}
                            </Form.Control.Feedback>
                          </Col>
                          <Col md={5}>
                            <Form.Label>Middle Name</Form.Label>
                            <Form.Control
                              type="text"
                              value={primaryGuest.middleName}
                              onChange={(e) =>
                                setPrimaryGuest({
                                  ...primaryGuest,
                                  middleName: e.target.value,
                                })
                              }
                            />
                          </Col>
                          <Col md={4}>
                            <Form.Label>
                              Last Name <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              value={primaryGuest.lastName}
                              onChange={(e) =>
                                handlePrimaryGuestChange(
                                  "lastName",
                                  e.target.value,
                                )
                              }
                              isInvalid={
                                !!validationErrors.primaryGuest_lastName
                              }
                              required
                            />
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.primaryGuest_lastName}
                            </Form.Control.Feedback>
                          </Col>
                          <Col md={4}>
                            <Form.Label>
                              Contact Number{" "}
                              <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="tel"
                              value={primaryGuest.contactNumber}
                              onChange={(e) =>
                                handlePrimaryGuestChange(
                                  "contactNumber",
                                  e.target.value,
                                )
                              }
                              isInvalid={
                                !!validationErrors.primaryGuest_contactNumber
                              }
                              required
                            />
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.primaryGuest_contactNumber}
                            </Form.Control.Feedback>
                          </Col>
                          <Col md={4}>
                            <Form.Label>
                              Email Id <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="email"
                              value={primaryGuest.emailId}
                              onChange={(e) =>
                                handlePrimaryGuestChange(
                                  "emailId",
                                  e.target.value,
                                )
                              }
                              isInvalid={
                                !!validationErrors.primaryGuest_emailId
                              }
                              required
                            />
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.primaryGuest_emailId}
                            </Form.Control.Feedback>
                          </Col>
                          <Col md={4}>
                            <Form.Label>Passport Number</Form.Label>
                            <Form.Control
                              type="text"
                              value={primaryGuest.passportNumber}
                              onChange={(e) =>
                                setPrimaryGuest({
                                  ...primaryGuest,
                                  passportNumber: e.target.value,
                                })
                              }
                            />
                          </Col>
                          <Col md={4}>
                            <Form.Label>
                              LPO <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              value={primaryGuest.lpo}
                              onChange={(e) =>
                                handlePrimaryGuestChange("lpo", e.target.value)
                              }
                              isInvalid={!!validationErrors.primaryGuest_lpo}
                              required
                            />
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.primaryGuest_lpo}
                            </Form.Control.Feedback>
                          </Col>
                        </Row>
                      </Form>
                    </Accordion.Body>
                  </Accordion.Item>

                  {/* ── Add-On Services accordion ──────────────────
                       Lives alongside Itinerary / Hotel / Activity /
                       Cab / Visa / Primary-Guest so the operator can
                       expand it from the booking page just like any
                       other section. The inner panel manages its own
                       sessionStorage; on close we refresh the count
                       badge in the header. */}
                  {/* v2: Add-Ons accordion REMOVED — replaced by a
                       read-only "Selected Add-On Services" panel below
                       so the operator can verify what they picked on
                       /addons before confirming the booking. Selections
                       still live in sessionStorage and are picked up by
                       the save handler via collectEnabledAddOnServices(). */}
                  <Accordion.Item eventKey="6" className="mb-2">
                    <Accordion.Header>
                      <h5 className="mb-0 fw-bold d-flex align-items-center">
                        Selected Add-On Services
                        <span
                          className={`badge ms-2 bg-${
                            addOnsCount > 0 ? "success" : "secondary"
                          }`}
                        >
                          {addOnsCount > 0 ? `${addOnsCount} on` : "None"}
                        </span>
                      </h5>
                    </Accordion.Header>
                    <Accordion.Body>
                      {(() => {
                        const all = readAddOnServices() || {};
                        const enabled = ADDON_SERVICES_CATALOG.filter(
                          (svc) => all[svc.key]?.enabled
                        );
                        if (enabled.length === 0) {
                          return (
                            <div className="text-muted small fst-italic">
                              No add-on services selected on the /addons step.
                              Go back to the Add-Ons page to pick services for
                              this booking.
                            </div>
                          );
                        }
                        return (
                          <Row className="g-3">
                            {enabled.map((svc) => {
                              const data = all[svc.key] || {};
                              const filled = (svc.fields || []).filter((f) => {
                                const v = data[f.name];
                                return v !== undefined && v !== "" && v !== null;
                              });
                              return (
                                <Col md={6} key={svc.key}>
                                  <Card className="h-100 border-success-subtle">
                                    <Card.Header className="bg-success-subtle py-2">
                                      <strong className="small">
                                        {svc.label}
                                      </strong>
                                    </Card.Header>
                                    <Card.Body className="p-2">
                                      {filled.length === 0 ? (
                                        <span className="small text-muted fst-italic">
                                          Enabled (no extra details captured)
                                        </span>
                                      ) : (
                                        <table className="table table-sm mb-0">
                                          <tbody>
                                            {filled.map((f) => (
                                              <tr key={f.name}>
                                                <td
                                                  className="small text-muted fw-semibold"
                                                  style={{ width: "45%" }}
                                                >
                                                  {f.label}
                                                </td>
                                                <td className="small">
                                                  {String(data[f.name])}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </Card.Body>
                                  </Card>
                                </Col>
                              );
                            })}
                          </Row>
                        );
                      })()}
                    </Accordion.Body>
                  </Accordion.Item>
                </Accordion>
              </Col>

              {/* ── Right-side Package Summary sidebar (image-style) ── */}
              <Col lg={4}>
                <div style={{ position: "sticky", top: 90 }}>
                  <Card
                    className="border-0 rounded-3"
                    style={{
                      background: "#ffffff",
                      boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <Card.Body className="px-4 pt-4 pb-3">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="fw-bold m-0" style={{ color: "#111827", letterSpacing: "-0.01em", fontSize: "1.05rem" }}>
                          Package Summary
                        </h5>
                        <button
                          type="button"
                          className="btn btn-link p-0 fw-semibold"
                          style={{
                            color: "#3b82f6",
                            textDecoration: "none",
                            fontSize: "0.85rem",
                          }}
                          onClick={() => navigate(-1)}
                        >
                          Edit
                        </button>
                      </div>
                      <div style={{ maxHeight: "50vh", overflowY: "auto", marginLeft: -4, marginRight: -4 }}>
                        {(() => {
                          const hotels    = cartData.filter((it) => it.hotel);
                          const transfers = cartData.filter((it) => it.cab);
                          const activities = cartData.filter((it) => it.activity);
                          const addons = (() => {
                            try {
                              const all = readAddOnServices();
                              return Object.entries(all || {})
                                .filter(([, v]) => v && v.enabled)
                                .map(([k]) => {
                                  const meta = ADDON_SERVICES_CATALOG.find((s) => s.key === k);
                                  return meta ? meta.label : k;
                                });
                            } catch {
                              return [];
                            }
                          })();
                          const SummaryRow = ({ Icon, iconBg, iconColor, title, lines, price, muted }) => (
                            <div
                              className="d-flex align-items-start"
                              style={{ gap: 12, padding: "14px 4px" }}
                            >
                              <span
                                style={{
                                  width: 34, height: 34, borderRadius: 8,
                                  background: iconBg,
                                  color: iconColor,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                  fontSize: "0.9rem",
                                }}
                              >
                                <Icon />
                              </span>
                              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                <div
                                  className="fw-bold"
                                  style={{ fontSize: "0.92rem", color: "#111827", marginBottom: 2 }}
                                >
                                  {title}
                                </div>
                                {lines.length > 0 ? (
                                  lines.map((line, i) => (
                                    <div
                                      key={i}
                                      style={{
                                        fontSize: "0.78rem",
                                        color: "#6b7280",
                                        lineHeight: 1.45,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                      title={line}
                                    >
                                      {line}
                                    </div>
                                  ))
                                ) : (
                                  <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                                    Not Selected
                                  </div>
                                )}
                              </div>
                              <div
                                className="fw-bold text-end"
                                style={{
                                  fontSize: "0.92rem",
                                  color: muted ? "#9ca3af" : "#111827",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {price}
                              </div>
                            </div>
                          );
                          return (
                            <>
                              <SummaryRow
                                Icon={FaHotel}
                                iconBg="#eef2ff"
                                iconColor="#6366f1"
                                title="Accommodation"
                                lines={hotels.map((it) => it.hotel?.hotelName || it.hotel?.name || "Hotel")}
                                price={
                                  hotels.length > 0
                                    ? `AED ${hotels.reduce((s, it) => s + Number(it.hotel?.totalRate || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                    : "—"
                                }
                                muted={hotels.length === 0}
                              />
                              <SummaryRow
                                Icon={FaCar}
                                iconBg="#ecfdf5"
                                iconColor="#059669"
                                title="Transfers"
                                lines={transfers.map((it) => it.cab?.cabName || it.cab?.cabname || "Transfer")}
                                price={
                                  transfers.length > 0
                                    ? `AED ${transfers.reduce((s, it) => s + Number(it.cab?.totalRate || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                    : "—"
                                }
                                muted={transfers.length === 0}
                              />
                              <SummaryRow
                                Icon={FaTicketAlt}
                                iconBg="#fef3c7"
                                iconColor="#d97706"
                                title="Tours & Activities"
                                lines={activities.map((it) => it.activity?.activityName || it.activity?.activityname || "Activity")}
                                price={
                                  activities.length > 0
                                    ? `AED ${activities.reduce((s, it) => s + Number(it.activity?.totalRate || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                    : "—"
                                }
                                muted={activities.length === 0}
                              />
                              <SummaryRow
                                Icon={FaPlus}
                                iconBg="#fce7f3"
                                iconColor="#db2777"
                                title="Add-on Services"
                                lines={addons.length > 0 ? addons : []}
                                price={addons.length > 0 ? `${addons.length} on` : "AED 0"}
                                muted={addons.length === 0}
                              />
                            </>
                          );
                        })()}
                      </div>
                      {(() => {
                        const tdNum =
                          tourismDirham !== "" && !isNaN(Number(tourismDirham))
                            ? Number(tourismDirham)
                            : 0;
                        const totalWithTd = totalPrice + tdNum;
                        return (
                          <>
                            <div
                              className="d-flex justify-content-between align-items-center pt-3 mt-2"
                              style={{ borderTop: "1px solid #e5e7eb" }}
                            >
                              <div>
                                <div
                                  className="fw-bold"
                                  style={{ color: "#111827", fontSize: "0.95rem" }}
                                >
                                  Total Package Price
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: 2 }}>
                                  (All prices are in AED)
                                </div>
                              </div>
                              <div
                                className="fw-bold"
                                style={{ fontSize: "1.3rem", color: "#111827" }}
                              >
                                AED {totalWithTd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>
                            </div>
                            <div className="mt-3">
                              <button
                                type="button"
                                className="btn btn-link p-0 fw-semibold"
                                style={{
                                  color: "#3b82f6",
                                  textDecoration: "none",
                                  fontSize: "0.85rem",
                                }}
                              >
                                View Price Breakup
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </Card.Body>
                  </Card>
                </div>
              </Col>
            </Row>

            {/* ── Bottom action bar (image-style) ── */}
            <Row className="mt-4">
              <Col lg={12}>
                <div className="d-flex justify-content-between align-items-center">
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="btn fw-semibold d-flex align-items-center"
                    style={{
                      background: "#ffffff",
                      border: "1px solid #d1d5db",
                      color: "#374151",
                      padding: "9px 22px",
                      borderRadius: 10,
                      fontSize: "0.95rem",
                    }}
                  >
                    ‹ Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="btn fw-semibold d-flex align-items-center"
                    style={{
                      background: "#111827",
                      border: "none",
                      color: "#ffffff",
                      padding: "11px 26px",
                      borderRadius: 10,
                      fontSize: "0.95rem",
                      boxShadow: "0 2px 6px rgba(17,24,39,0.18)",
                    }}
                  >
                    Confirm Booking
                    <span className="ms-2">›</span>
                  </button>
                </div>
              </Col>
            </Row>
          </Container>
        </main>
      </div>

      {/* Order Summary Modal - Industry Standard Design */}
      <Modal
        show={showOrderSummaryModal}
        onHide={() => !isSubmitting && setShowOrderSummaryModal(false)}
        size="lg"
        centered
        backdrop="static"
        keyboard={false}
        className="order-summary-modal"
      >
        <Modal.Header
          closeButton={!isSubmitting}
          style={{
            borderBottom: "2px solid #e9ecef",
            padding: "1.25rem 1.5rem",
          }}
        >
          <Modal.Title
            className="d-flex align-items-center"
            style={{ fontSize: "1.5rem", fontWeight: "600" }}
          >
            <div
              className="d-flex align-items-center justify-content-center me-3"
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "#e7f5ff",
                color: "#0d6efd",
              }}
            >
              <FaCheckCircle size={24} />
            </div>
            <div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "600",
                  color: "#212529",
                }}
              >
                Order Summary
              </div>
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "#6c757d",
                  fontWeight: "400",
                }}
              >
                Please review your booking details
              </div>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body
          style={{ maxHeight: "70vh", overflowY: "auto", padding: "1.5rem" }}
        >
          <div className="order-summary">
            {/* Guest Information Section */}
            <div className="mb-4">
              <div className="d-flex align-items-center mb-3">
                <FaUsers className="me-2 text-primary" size={18} />
                <h6
                  className="mb-0 fw-bold"
                  style={{ fontSize: "1rem", color: "#212529" }}
                >
                  Guest Information
                </h6>
              </div>
              <div
                className="p-3 rounded"
                style={{
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #e9ecef",
                }}
              >
                <Row className="g-3">
                  <Col md={6}>
                    <div className="mb-2">
                      <small
                        className="text-muted d-block mb-1"
                        style={{ fontSize: "0.75rem", fontWeight: "500" }}
                      >
                        Full Name
                      </small>
                      <div
                        style={{
                          fontSize: "0.9375rem",
                          fontWeight: "500",
                          color: "#212529",
                        }}
                      >
                        {primaryGuest.salutation} {primaryGuest.firstName}{" "}
                        {primaryGuest.lastName}
                      </div>
                    </div>
                    <div className="mb-2">
                      <small
                        className="text-muted d-block mb-1"
                        style={{ fontSize: "0.75rem", fontWeight: "500" }}
                      >
                        Email Address
                      </small>
                      <div style={{ fontSize: "0.9375rem", color: "#495057" }}>
                        {primaryGuest.emailId}
                      </div>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="mb-2">
                      <small
                        className="text-muted d-block mb-1"
                        style={{ fontSize: "0.75rem", fontWeight: "500" }}
                      >
                        Contact Number
                      </small>
                      <div style={{ fontSize: "0.9375rem", color: "#495057" }}>
                        {primaryGuest.contactNumber}
                      </div>
                    </div>
                    <div className="mb-2">
                      <small
                        className="text-muted d-block mb-1"
                        style={{ fontSize: "0.75rem", fontWeight: "500" }}
                      >
                        LPO Number
                      </small>
                      <div style={{ fontSize: "0.9375rem", color: "#495057" }}>
                        {primaryGuest.lpo || "N/A"}
                      </div>
                    </div>
                  </Col>
                  {primaryGuest.passportNumber && (
                    <Col md={12}>
                      <div>
                        <small
                          className="text-muted d-block mb-1"
                          style={{ fontSize: "0.75rem", fontWeight: "500" }}
                        >
                          Passport Number
                        </small>
                        <div
                          style={{ fontSize: "0.9375rem", color: "#495057" }}
                        >
                          {primaryGuest.passportNumber}
                        </div>
                      </div>
                    </Col>
                  )}
                </Row>
              </div>
            </div>

            {/* Booking Items Section */}
            <div className="mb-4">
              <h6
                className="mb-3 fw-bold"
                style={{ fontSize: "1rem", color: "#212529" }}
              >
                Booking Details
              </h6>

              {/* Hotel Details */}
              {hotels.length > 0 && (
                <div
                  className="mb-3 p-3 rounded"
                  style={{
                    backgroundColor: "#fff",
                    border: "1px solid #e9ecef",
                    borderLeft: "4px solid #0dcaf0",
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center">
                      <FaHotel className="me-2 text-info" size={18} />
                      <strong style={{ fontSize: "0.9375rem" }}>
                        Accommodation
                      </strong>
                    </div>
                    <Badge bg="info">
                      {hotels.length} {hotels.length === 1 ? "Hotel" : "Hotels"}
                    </Badge>
                  </div>
                  {hotels.map((item, idx) => {
                    const hotel = item.hotel || {};
                    const checkIn = hotel.checkIn || hotel.checkInDate || "";
                    const checkOut = hotel.checkOut || hotel.checkOutDate || "";
                    const hotelSellingPrice = parseFloat(hotel.totalRate || 0);
                    const hotelTotalPrice = parseFloat(
                      hotel.totalRateWithoutmrk || hotel.totalRate || 0,
                    );

                    return (
                      <div
                        key={idx}
                        className={idx > 0 ? "mt-3 pt-3 border-top" : ""}
                      >
                        <div className="mb-2">
                          <strong
                            style={{ fontSize: "0.9375rem", color: "#212529" }}
                          >
                            {hotel.hotelName || "Hotel"}
                          </strong>
                        </div>
                        <div
                          className="d-flex flex-wrap gap-3 mb-2"
                          style={{ fontSize: "0.8125rem", color: "#6c757d" }}
                        >
                          <span>
                            <FaCalendarAlt className="me-1" />
                            Check-in: {formatDate(checkIn)}
                          </span>
                          <span>
                            <FaCalendarAlt className="me-1" />
                            Check-out: {formatDate(checkOut)}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span
                            style={{ fontSize: "0.8125rem", color: "#6c757d" }}
                          >
                            Selling Price
                          </span>
                          <strong
                            style={{ fontSize: "0.9375rem", color: "#198754" }}
                          >
                            AED {hotelSellingPrice.toFixed(2)}
                          </strong>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span
                            style={{ fontSize: "0.8125rem", color: "#6c757d" }}
                          >
                            Total Price
                          </span>
                          <strong
                            style={{ fontSize: "0.9375rem", color: "#0d6efd" }}
                          >
                            AED {hotelTotalPrice.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Activity Details */}
              {activities.length > 0 && (
                <div
                  className="mb-3 p-3 rounded"
                  style={{
                    backgroundColor: "#fff",
                    border: "1px solid #e9ecef",
                    borderLeft: "4px solid #198754",
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center">
                      <FaTicketAlt className="me-2 text-success" size={18} />
                      <strong style={{ fontSize: "0.9375rem" }}>
                        Tours & Activities
                      </strong>
                    </div>
                    <Badge bg="success">
                      {activities.length}{" "}
                      {activities.length === 1 ? "Activity" : "Activities"}
                    </Badge>
                  </div>
                  {activities.map((item, idx) => {
                    const activity = item.activity || {};
                    const activitySellingPrice = parseFloat(
                      activity.totalRate || 0,
                    );
                    const activityTotalPrice = parseFloat(
                      activity.totalRateWithoutmrk || activity.totalRate || 0,
                    );

                    return (
                      <div
                        key={idx}
                        className={idx > 0 ? "mt-3 pt-3 border-top" : ""}
                      >
                        <div className="mb-2">
                          <strong
                            style={{ fontSize: "0.9375rem", color: "#212529" }}
                          >
                            {activity.activityName || "Activity"}
                          </strong>
                        </div>
                        <div
                          className="d-flex flex-wrap gap-3 mb-2"
                          style={{ fontSize: "0.8125rem", color: "#6c757d" }}
                        >
                          <span>
                            <FaCalendarAlt className="me-1" />
                            Date: {formatDate(activity.activityDate || "")}
                          </span>
                          <span>
                            <FaUsers className="me-1" />
                            Adults: {activity.adult || 0} | Children:{" "}
                            {activity.child || 0}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span
                            style={{ fontSize: "0.8125rem", color: "#6c757d" }}
                          >
                            Selling Price
                          </span>
                          <strong
                            style={{ fontSize: "0.9375rem", color: "#198754" }}
                          >
                            AED {activitySellingPrice.toFixed(2)}
                          </strong>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span
                            style={{ fontSize: "0.8125rem", color: "#6c757d" }}
                          >
                            Total Price
                          </span>
                          <strong
                            style={{ fontSize: "0.9375rem", color: "#0d6efd" }}
                          >
                            AED {activityTotalPrice.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Transfer Details */}
              {transfers.length > 0 && (
                <div
                  className="mb-3 p-3 rounded"
                  style={{
                    backgroundColor: "#fff",
                    border: "1px solid #e9ecef",
                    borderLeft: "4px solid #ffc107",
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center">
                      <FaCar className="me-2 text-warning" size={18} />
                      <strong style={{ fontSize: "0.9375rem" }}>
                        Transfers
                      </strong>
                    </div>
                    <Badge bg="warning" text="dark">
                      {transfers.length}{" "}
                      {transfers.length === 1 ? "Transfer" : "Transfers"}
                    </Badge>
                  </div>
                  {transfers.map((item, idx) => {
                    const cab = item.cab || {};
                    const cabSellingPrice = parseFloat(cab.totalRate || 0);
                    const cabTotalPrice = parseFloat(
                      cab.totalRateWithoutmrk || cab.totalRate || 0,
                    );

                    return (
                      <div
                        key={idx}
                        className={idx > 0 ? "mt-3 pt-3 border-top" : ""}
                      >
                        <div className="mb-2">
                          <strong
                            style={{ fontSize: "0.9375rem", color: "#212529" }}
                          >
                            {cab.cabName || "Transfer"}
                          </strong>
                        </div>
                        <div
                          className="d-flex flex-wrap gap-3 mb-2"
                          style={{ fontSize: "0.8125rem", color: "#6c757d" }}
                        >
                          <span>
                            <FaCalendarAlt className="me-1" />
                            Pickup: {formatDate(cab.pickupDate || "")}
                          </span>
                          <span>
                            <FaCalendarAlt className="me-1" />
                            Dropoff: {formatDate(cab.dropoffDate || "")}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span
                            style={{ fontSize: "0.8125rem", color: "#6c757d" }}
                          >
                            Selling Price
                          </span>
                          <strong
                            style={{ fontSize: "0.9375rem", color: "#198754" }}
                          >
                            AED {cabSellingPrice.toFixed(2)}
                          </strong>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span
                            style={{ fontSize: "0.8125rem", color: "#6c757d" }}
                          >
                            Total Price
                          </span>
                          <strong
                            style={{ fontSize: "0.9375rem", color: "#0d6efd" }}
                          >
                            AED {cabTotalPrice.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Price Summary Section */}
            <div
              className="p-4 rounded"
              style={{
                backgroundColor: "#f8f9fa",
                border: "2px solid #0d6efd",
              }}
            >
              <h6
                className="mb-3 fw-bold"
                style={{ fontSize: "1rem", color: "#212529" }}
              >
                Price Summary
              </h6>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span style={{ fontSize: "0.9375rem", color: "#495057" }}>
                    Subtotal (Selling Price)
                  </span>
                  <strong style={{ fontSize: "1.125rem", color: "#198754" }}>
                    AED {(
                      sellingPrice +
                      (tourismDirham !== "" && !isNaN(Number(tourismDirham))
                        ? Number(tourismDirham)
                        : 0)
                    ).toFixed(2)}
                  </strong>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <span style={{ fontSize: "0.9375rem", color: "#495057" }}>
                    Subtotal (Without Markup)
                  </span>
                  <strong style={{ fontSize: "1.125rem", color: "#0d6efd" }}>
                    AED {(
                      totalPrice +
                      (tourismDirham !== "" && !isNaN(Number(tourismDirham))
                        ? Number(tourismDirham)
                        : 0)
                    ).toFixed(2)}
                  </strong>
                </div>
              </div>

              <div className="mb-3 pt-3 border-top">
                <label
                  className="form-label fw-semibold"
                  style={{ fontSize: "0.875rem" }}
                >
                  Tourism Dirham
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  placeholder="0.00"
                  value={tourismDirham}
                  onChange={(e) => setTourismDirham(e.target.value)}
                />
                <small className="text-muted">
                  Optional — added to both subtotals above.
                </small>
              </div>

              {/* v2 Add-Ons summary — each enabled service expanded
                  with the field-level details the operator captured on
                  /addons. Visa is just one of the catalogue entries, so
                  no separate "Visa Required" row is needed up top. */}
              {(() => {
                let svcMap = {};
                try {
                  svcMap = JSON.parse(
                    sessionStorage.getItem("mypkg_addon_services") || "{}"
                  );
                } catch {
                  svcMap = {};
                }
                const enabled = ADDON_SERVICES_CATALOG.filter(
                  (svc) => svcMap[svc.key]?.enabled
                );
                if (enabled.length === 0) return null;
                return (
                  <div className="pt-3 mt-3 border-top">
                    <h6
                      className="mb-2 fw-semibold"
                      style={{ fontSize: "0.875rem", color: "#495057" }}
                    >
                      Addons
                    </h6>
                    <div className="d-flex flex-column gap-2">
                      {enabled.map((svc) => {
                        const data = svcMap[svc.key] || {};
                        const filled = (svc.fields || []).filter((f) => {
                          const v = data[f.name];
                          return v !== undefined && v !== "" && v !== null;
                        });
                        return (
                          <div
                            key={svc.key}
                            className="p-2 rounded border bg-light"
                            style={{ fontSize: "0.8125rem" }}
                          >
                            <div className="fw-semibold text-success mb-1">
                              {svc.label}
                            </div>
                            {filled.length === 0 ? (
                              <span className="text-muted fst-italic">
                                Enabled (no extra details captured)
                              </span>
                            ) : (
                              <div className="d-flex flex-column gap-1">
                                {filled.map((f) => (
                                  <div
                                    key={f.name}
                                    className="d-flex justify-content-between"
                                  >
                                    <span className="text-muted">
                                      {f.label}
                                    </span>
                                    <span>{String(data[f.name])}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div
                className="mt-3 pt-3 border-top d-flex justify-content-between align-items-center"
                style={{ borderColor: "#0d6efd !important" }}
              >
                <span
                  className="fw-bold"
                  style={{ fontSize: "1.125rem", color: "#212529" }}
                >
                  Total Amount
                </span>
                <span
                  className="fw-bold"
                  style={{
                    fontSize: "1.5rem",
                    color: "#0d6efd",
                  }}
                >
                  AED {sellingPrice.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer
          style={{
            borderTop: "2px solid #e9ecef",
            padding: "1.25rem 1.5rem",
            justifyContent: "space-between",
          }}
        >
          <Button
            variant="outline-secondary"
            onClick={() => setShowOrderSummaryModal(false)}
            disabled={isSubmitting}
            style={{
              minWidth: "120px",
              fontWeight: "500",
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={confirmBooking}
            disabled={isSubmitting}
            style={{
              minWidth: "160px",
              fontWeight: "600",
              fontSize: "1rem",
            }}
          >
            {isSubmitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Processing...
              </>
            ) : (
              <>
                <FaCheckCircle className="me-2" />
                Confirm Booking
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Detailed Itinerary Modal */}
      <Modal
        show={showItineraryModal}
        onHide={handleCloseItineraryModal}
        size="lg"
        centered
        className="itinerary-modal"
      >
        <Modal.Header
          closeButton
          className="itinerary-modal-header"
          style={{
            background: "linear-gradient(135deg, #0d6efd 0%, #0056b3 100%)",
            color: "white",
            border: "none",
            padding: "1.25rem 1.5rem",
          }}
        >
          <Modal.Title className="fw-bold d-flex align-items-center gap-2">
            <FaRoute />
            Detailed Itinerary
            {currentDay && (
              <Badge bg="light" text="dark" className="ms-2">
                {currentDay === "day1" ? "Day 1" : "Day 2"}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body
          style={{ maxHeight: "70vh", overflowY: "auto", padding: "1.5rem" }}
        >
          {/* Search Bar */}
          <Form.Group className="mb-4">
            <div className="position-relative">
              <Form.Control
                type="text"
                placeholder="Search by terms (Type atleast 4 letters)"
                value={itinerarySearchTerm}
                onChange={(e) => setItinerarySearchTerm(e.target.value)}
                className="itinerary-search-input"
                style={{
                  padding: "0.875rem 1rem 0.875rem 2.75rem",
                  borderRadius: "8px",
                  border: "2px solid #dee2e6",
                  fontSize: "0.9rem",
                }}
              />
              <FaClock
                className="position-absolute"
                style={{
                  left: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#6c757d",
                  fontSize: "0.9rem",
                }}
              />
            </div>
            {itinerarySearchTerm.trim().length > 0 &&
              itinerarySearchTerm.trim().length < 4 && (
                <small className="text-muted mt-2 d-block">
                  <FaClock className="me-1" />
                  Type at least 4 letters to search
                </small>
              )}
          </Form.Group>

          {/* Itinerary List */}
          {loadingItinerary ? (
            <div className="text-center py-5">
              <Spinner animation="border" size="sm" variant="primary" />
              <p className="mt-2 text-muted small">
                Loading itinerary details...
              </p>
            </div>
          ) : filteredItineraryList.length > 0 ? (
            <div className="itinerary-modal-list">
              {filteredItineraryList.map((itinerary) => {
                const isSelected =
                  currentDay &&
                  selectedItineraries[currentDay]?.includes(
                    itinerary.itineraryId,
                  );
                const description = itinerary.itineraryDesc || "";
                const shortDesc =
                  description.length > 100
                    ? description.substring(0, 100) + "..."
                    : description;
                const showFullDesc =
                  expandedDescriptions[itinerary.itineraryId] || false;

                return (
                  <div
                    key={itinerary.itineraryId}
                    className={`itinerary-modal-item mb-3 ${isSelected ? "itinerary-modal-item-selected" : ""}`}
                    style={{
                      backgroundColor: isSelected ? "#e7f3ff" : "white",
                      border: `2px solid ${isSelected ? "#0d6efd" : "#dee2e6"}`,
                      borderRadius: "12px",
                      padding: "1.25rem",
                      transition: "all 0.3s ease",
                      cursor: "pointer",
                    }}
                    onClick={() => handleItineraryToggle(itinerary.itineraryId)}
                  >
                    <div className="d-flex align-items-start">
                      <Form.Check
                        type="checkbox"
                        id={`modal-itinerary-${itinerary.itineraryId}`}
                        checked={isSelected || false}
                        onChange={() =>
                          handleItineraryToggle(itinerary.itineraryId)
                        }
                        className="me-3 mt-1"
                        style={{ flexShrink: 0 }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <h6
                            className="mb-0 fw-bold"
                            style={{
                              color: isSelected ? "#0d6efd" : "#212529",
                            }}
                          >
                            {itinerary.itineraryHeading || "Untitled"}
                          </h6>
                          {isSelected && (
                            <Badge bg="success" className="ms-auto">
                              <FaCheckCircle className="me-1" />
                              Selected
                            </Badge>
                          )}
                        </div>
                        <p
                          className="mb-0 text-muted"
                          style={{ fontSize: "0.875rem", lineHeight: "1.6" }}
                        >
                          {showFullDesc ? description : shortDesc}
                          {description.length > 100 && (
                            <button
                              className="btn btn-link p-0 ms-2 text-primary"
                              style={{
                                fontSize: "0.875rem",
                                textDecoration: "none",
                                fontWeight: "500",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedDescriptions((prev) => ({
                                  ...prev,
                                  [itinerary.itineraryId]: !showFullDesc,
                                }));
                              }}
                            >
                              {showFullDesc ? "Show Less" : "Read More"}
                            </button>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : itinerarySearchTerm.trim().length > 0 &&
            itinerarySearchTerm.trim().length < 4 ? (
            <div className="text-center py-5">
              <FaClock size={48} className="text-muted mb-3" />
              <p className="text-muted fw-semibold">
                Please type at least 4 letters to search
              </p>
            </div>
          ) : (
            <div className="text-center py-5">
              <FaRoute size={48} className="text-muted mb-3" />
              <p className="text-muted fw-semibold">
                No itinerary details found.
              </p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer
          style={{ borderTop: "2px solid #dee2e6", padding: "1rem 1.5rem" }}
        >
          <div className="d-flex justify-content-between align-items-center w-100">
            <small className="text-muted">
              {currentDay && selectedItineraries[currentDay]?.length > 0 && (
                <>
                  <FaCheckCircle className="text-success me-1" />
                  {selectedItineraries[currentDay].length} item(s) selected
                </>
              )}
            </small>
            <Button
              variant="primary"
              onClick={handleCloseItineraryModal}
              style={{ minWidth: "120px" }}
            >
              Done
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

    </div>
  );
};

export default MakePkgBookingPageV2;
