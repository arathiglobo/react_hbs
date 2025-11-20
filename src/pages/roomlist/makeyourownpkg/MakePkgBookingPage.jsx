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
} from "react-icons/fa";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import toast from "react-hot-toast";
import "../../../styles/HotelBookingPage.css";
import "../../../styles/MakePkgBookingPage.css";

const MakePkgBookingPage = () => {
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
  const [bookingConfirmation, setBookingConfirmation] = useState("Book & Voucher");
  const [remarks, setRemarks] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [tourismDirhams, setTourismDirhams] = useState("0");
  const [totalPrice, setTotalPrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  
  // Itinerary state
  const [itineraryList, setItineraryList] = useState([]);
  const [selectedItineraries, setSelectedItineraries] = useState([]);
  const [loadingItinerary, setLoadingItinerary] = useState(false);
  const [itineraryExpanded, setItineraryExpanded] = useState(false);

  // Guest details for each room
  const [roomGuests, setRoomGuests] = useState({});

  // Transfer/Cab details state
  const [transferDetails, setTransferDetails] = useState({});

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState({});

  // Initialize guest details for rooms
  const initializeRoomGuests = (cartItems) => {
    const guests = {};
    cartItems.forEach((item, hotelIndex) => {
      if (item.hotel) {
        const hotel = item.hotel || {};
        const searchRoomDTOs = hotel.searchRoomDTOs || [];
        searchRoomDTOs.forEach((room, roomIndex) => {
          const adults = parseInt(room.adult || room.adults || 1);
          const children = parseInt(room.child || room.children || 0);
          const totalGuests = adults + children;
          
          const key = `${hotelIndex}-${roomIndex}`;
          guests[key] = Array.from({ length: totalGuests }, (_, guestIndex) => ({
            salutation: "",
            firstName: "",
            lastName: "",
            gender: "",
            isChild: guestIndex >= adults,
            age: guestIndex >= adults ? (room.childAge?.[guestIndex - adults] || "") : "",
          }));
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
          transporterName: cab.transporter || cab.transporterName || cabDetails.transporter || cabDetails.transporterName || "",
          contactNumber: cab.contactNumber || cabDetails.contactNumber || "",
          driverName: cab.driverName || cabDetails.driverName || "",
          driverContact: cab.driverContact || cabDetails.driverContact || "",
        };
      }
    });
    setTransferDetails(details);
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
  const handleGuestChange = (hotelIndex, roomIndex, guestIndex, field, value) => {
    const key = `${hotelIndex}-${roomIndex}`;
    setRoomGuests((prev) => {
      const updated = { ...prev };
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
      return updated;
    });

    // Clear validation error when user starts typing
    const errorKey = `hotel_${hotelIndex}_room_${roomIndex}_guest_${guestIndex}_${field}`;
    if (validationErrors[errorKey]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[errorKey];
        return updated;
      });
    }
  };

  // Handle primary guest change
  const handlePrimaryGuestChange = (field, value) => {
    setPrimaryGuest((prev) => ({ ...prev, [field]: value }));

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
  };

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

  // Handle itinerary selection
  const handleItineraryToggle = (itineraryId) => {
    setSelectedItineraries((prev) => {
      if (prev.includes(itineraryId)) {
        return prev.filter((id) => id !== itineraryId);
      } else {
        return [...prev, itineraryId];
      }
    });
  };

  // Calculate total and selling prices
  const calculatePrices = (cartItems) => {
    let total = 0;
    let selling = 0;

    cartItems.forEach((item) => {
      if (item.hotel) {
        const hotel = item.hotel;
        const details = hotel.details || {};
        const price = parseFloat(
          hotel.totalRate || 
          hotel.totalPrice || 
          details.totalRate || 
          details.totalPrice || 
          hotel.rate || 
          0
        );
        const sellPrice = parseFloat(
          hotel.sellingPrice || 
          hotel.totalRate || 
          details.sellingPrice || 
          price || 
          0
        );
        total += price;
        selling += sellPrice || price;
      } else if (item.activity) {
        const activity = item.activity;
        const details = activity.details || {};
        const price = parseFloat(
          activity.totalPrice || 
          activity.price || 
          details.totalPrice || 
          details.price || 
          0
        );
        const sellPrice = parseFloat(
          activity.sellingPrice || 
          activity.totalPrice || 
          details.sellingPrice || 
          price || 
          0
        );
        total += price;
        selling += sellPrice || price;
      } else if (item.cab) {
        const cab = item.cab;
        const details = cab.details || {};
        const price = parseFloat(
          cab.totalPrice || 
          cab.totalRate || 
          cab.price || 
          details.totalPrice || 
          details.totalRate || 
          0
        );
        const sellPrice = parseFloat(
          cab.totalRate || 
          cab.totalPrice || 
          details.totalRate || 
          price || 
          0
        );
        total += price;
        selling += sellPrice || price;
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
    if (!primaryGuest.contactNumber || primaryGuest.contactNumber.trim() === "") {
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
              
              if (!guest.salutation || (typeof guest.salutation === 'string' && guest.salutation.trim() === "")) {
                errors[`${errorPrefix}_salutation`] = "Salutation is required";
                hasErrors = true;
              }
              if (!guest.firstName || (typeof guest.firstName === 'string' && guest.firstName.trim() === "")) {
                errors[`${errorPrefix}_firstName`] = "First Name is required";
                hasErrors = true;
              }
              if (!guest.lastName || (typeof guest.lastName === 'string' && guest.lastName.trim() === "")) {
                errors[`${errorPrefix}_lastName`] = "Last Name is required";
                hasErrors = true;
              }
              if (!guest.gender || (typeof guest.gender === 'string' && guest.gender.trim() === "")) {
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
        const firstErrorField = document.querySelector('.is-invalid');
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    // Clear validation errors before submission
    setValidationErrors({});

    try {
      const hotels = getHotels();
      const activities = getActivities();
      const transfers = getTransfers();
      
      // Find hotel index in cartData
      const hotelIndexInCart = hotels.length > 0 
        ? cartData.findIndex((item) => item.hotel)
        : -1;

      // Prepare booking payload
      const firstHotel = hotels.length > 0 ? hotels[0].hotel : null;
      const checkIn = firstHotel?.checkIn || firstHotel?.checkInDate || "";
      const checkOut = firstHotel?.checkOut || firstHotel?.checkOutDate || "";
      const nights = calculateNights(checkIn, checkOut);
      
      // Get first activity date for tourDate
      const firstActivity = activities.length > 0 ? activities[0].activity : null;
      const tourDate = firstActivity?.activityDate 
        ? formatDateToDDMMYYYY(firstActivity.activityDate) 
        : (activities.length > 0 ? formatDateToDDMMYYYY(checkIn) : "");

      const bookingPayload = {
        customPackageId: "",
        sellingPrice: String(sellingPrice.toFixed(2)),
        totalPrice: String(totalPrice.toFixed(2)),
        tourDate: tourDate,
        visaStatus: visaRequired,
        visaAdult: String(visaDetails.visaAdult || "0"),
        visaAdultRate: String(visaDetails.visaAdultRate || "0"),
        visaChild: String(visaDetails.visaChild || "0"),
        visaChildRate: String(visaDetails.visaChildRate || "0"),
        visaInfant: String(visaDetails.visaInfant || "0"),
        visaInfantRate: String(visaDetails.visaInfantRate || "0"),
        hotelBookingRequest: hotels.length > 0 && firstHotel ? {
          agentId: String(sessionStorage.getItem("makePkgAgentId") || "1"),
          apiId: String(firstHotel.api || firstHotel.apiId || "INHOUSE"),
          hotelId: String(firstHotel.hotelId || ""),
          hotelName: firstHotel.hotelName || "",
          address: firstHotel.hotelAddress || firstHotel.address || "",
          starRating: parseInt(firstHotel.starRating || 0),
          checkInDate: formatDateToYYYYMMDD(checkIn),
          checkOutDate: formatDateToYYYYMMDD(checkOut),
          nights: nights,
          employeeId: "1",
          roomStatus: firstHotel.roomStatus || "Available",
          cancellationPolicy: Array.isArray(firstHotel.cancellationPolicy) 
            ? firstHotel.cancellationPolicy 
            : [],
          deadlineDate: firstHotel.deadlineDate || "",
          isBookandVoucher: bookingConfirmation === "Book & Voucher",
          primaryGuest: {
            firstName: primaryGuest.firstName || "",
            middleName: primaryGuest.middleName || "",
            lastName: primaryGuest.lastName || "",
            nativeCountry: primaryGuest.nativeCountry || "",
            email: primaryGuest.emailId || "",
            phone: primaryGuest.contactNumber || "",
            passportNo: primaryGuest.passportNumber || "",
            salutaion: primaryGuest.salutation || "",
            agentlpo: primaryGuest.lpo || "",
          },
          rooms: firstHotel?.searchRoomDTOs?.map((room, idx) => {
            const guestKey = `${hotelIndexInCart}-${idx}`;
            const guests = roomGuests[guestKey] || [];
            
            // Get room rate from hotel data
            const roomRate = parseFloat(firstHotel.totalRate || firstHotel.rate || 0);
            const roomRateWithoutMarkup = parseFloat(firstHotel.totalPrice || firstHotel.rateWithoutMarkup || roomRate);
            
            return {
              roomNo: idx + 1,
              roomCategory: firstHotel.roomCategory || "",
              mealPlan: firstHotel.roomType || "",
              nonRefundable: firstHotel.nonRefundable === true || firstHotel.nonRefundable === "true" || firstHotel.refundstatus === "N",
              currency: firstHotel.currency || "AED",
              rate: roomRate,
              rateWithoutMarkup: roomRateWithoutMarkup,
              adults: parseInt(room.adult || room.adults || 1),
              children: parseInt(room.child || room.children || 0),
              childAges: Array.isArray(room.childAge) 
                ? room.childAge.map(age => parseInt(age) || 0)
                : (room.childAge ? [parseInt(room.childAge) || 0] : []),
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
          remarks: remarks || "",
          specialRequests: specialRequest || "",
          tourismDirhams: parseFloat(tourismDirhams) || 0,
          bookingConfirmation: bookingConfirmation || "Book & Voucher",
        } : null,
        customBookingActivityDTO: activities.map((item) => {
          const activity = item.activity || {};
          const details = activity.details || {};
          const activitySellingPrice = parseFloat(activity.totalRate || activity.sellingPrice || details.totalRate || 0);
          const activityTotalPrice = parseFloat(activity.totalRateWithoutmrk || activity.totalPrice || details.totalPrice || 0);
          
          return {
            activityId: String(activity.activityId || ""),
            tourDate: formatDateToDDMMYYYY(activity.activityDate || ""),
            noOfAdult: String(activity.adult || activity.noOfAdult || "1"),
            noOfChild: String(activity.child || activity.noOfChild || "0"),
            childAgeArray: Array.isArray(activity.childAge) 
              ? activity.childAge.map(age => String(age))
              : (activity.childAge ? [String(activity.childAge)] : []),
            sellingPrice: String(activitySellingPrice.toFixed(2)),
            totalPrice: String(activityTotalPrice.toFixed(2)),
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
          const actualIndex = transferIndexInCart >= 0 ? transferIndexInCart : 0;
          const transferDetail = transferDetails[actualIndex] || {};
          const cab = item.cab || {};
          const details = cab.details || {};
          const cabTotalRate = parseFloat(cab.totalRate || cab.totalPrice || details.totalRate || 0);
          const cabTotalRateWithoutMrk = parseFloat(cab.totalRateWithoutmrk || cab.totalPrice || details.totalRateWithoutmrk || 0);

          return {
            cabId: String(cab.cabId || ""),
            noOfCabs: "1",
            pickupDate: formatDateToDDMMYYYY(cab.pickupDate || ""),
            dropOffDate: formatDateToDDMMYYYY(cab.dropDate || cab.dropOffDate || ""),
            travelType: String(cab.travelType || "1"),
            hourDetails: "0",
            dropDetails: "3",
            paxDetails: "1",
            luggage: true,
            locationId: String(cab.locationId || ""),
            noOfAdult: String(cab.adult || cab.noOfAdult || "1"),
            noOfChild: String(cab.child || cab.noOfChild || "0"),
            childAgeArray: Array.isArray(cab.childAge) 
              ? cab.childAge.map(age => String(age))
              : (cab.childAge ? [String(cab.childAge)] : []),
            totalRate: String(cabTotalRate.toFixed(2)),
            totalRateWithoutmrk: String(cabTotalRateWithoutMrk.toFixed(2)),
            transporter: transferDetail.transporterName || cab.transporter || "",
            contactNumber: transferDetail.contactNumber || cab.contactNumber || "",
            driverName: transferDetail.driverName || cab.driverName || "",
            driverContact: transferDetail.driverContact || cab.driverContact || "",
          };
        }),
        customBookingItinearyDTO: selectedItineraries.map((itineraryId) => ({
          itinearyId: String(itineraryId),
          days: 1,
        })),
        paymentApiId: "",
        agentId: String(sessionStorage.getItem("makePkgAgentId") || "1"),
        isCartBooking: true,
      };

      console.log("Booking payload:", bookingPayload);

      const response = await axiosInstance.post(
        "/api/makeYourOwnPackage/saveMakeYourOwnPackageBooking",
        bookingPayload
      );

      // Check booking response structure
      if (
        response.data &&
        response.data.bookingId != null &&
        response.data.bookingId != 0 &&
        response.data.message === "Booking completed successfully"
      ) {
        toast.success(response.data.message || "Booking submitted successfully!");
        navigate("/booking-details/custom-booking-list");
      } else {
        toast.error(response.data?.message || "Failed to submit booking.");
      }
    } catch (err) {
      console.error("Error submitting booking:", err);
      toast.error("Failed to submit booking. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="d-flex" style={{ minHeight: "100vh" }}>
        <Sidebar />
        <div className="flex-grow-1 d-flex flex-column">
          <TopBar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <div className="loading-container text-center">
              <Spinner animation="border" variant="primary" size="lg" />
              <p className="mt-3 text-muted fw-semibold">Loading booking details...</p>
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
              <p className="text-muted mb-4">Your cart is empty. Please add items to cart first.</p>
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

  return (
    <div className="hotel-booking-container make-pkg-booking-container">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <main className="content-wrapper py-4">
          <Container fluid>
            <div className="booking-page-header mb-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h2 className="mb-1">Confirm Booking</h2>
                </div>
                <div className="d-flex align-items-center gap-4">
                  <div className="text-end">
                    <div className="text-muted small mb-1">Selling Price</div>
                    <div className="h4 mb-0 fw-bold text-primary">{sellingPrice.toFixed(2)}</div>
                  </div>
                  <div className="text-end">
                    <div className="text-muted small mb-1">Total Price</div>
                    <div className="h4 mb-0 fw-bold text-primary">{totalPrice.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>

            <Row>
              <Col lg={12}>
                <Accordion defaultActiveKey={["0", "5"]} alwaysOpen className="booking-accordion">
                  {/* Itinerary Option Section */}
                  <Accordion.Item eventKey="0" className="mb-2">
                    <Accordion.Header onClick={fetchItineraryDetails}>
                      <h5 className="mb-0 fw-bold">Itinerary option</h5>
                    </Accordion.Header>
                    <Accordion.Body>
                      {loadingItinerary ? (
                        <div className="text-center py-3">
                          <Spinner animation="border" size="sm" variant="primary" />
                          <p className="mt-2 text-muted small">Loading itinerary details...</p>
                        </div>
                      ) : itineraryList.length > 0 ? (
                        <div>
                          {itineraryList.map((itinerary) => (
                            <div key={itinerary.itineraryId} className="itinerary-checkbox">
                              <Form.Check
                                type="checkbox"
                                id={`itinerary-${itinerary.itineraryId}`}
                                label={itinerary.itineraryHeading}
                                checked={selectedItineraries.includes(itinerary.itineraryId)}
                                onChange={() => handleItineraryToggle(itinerary.itineraryId)}
                                className="mb-0"
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted">No itinerary details available.</p>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>

                  {/* Hotel Option Section */}
                  {hotels.length > 0 && (
                    <Accordion.Item eventKey="1" className="mb-2">
                      <Accordion.Header>
                        <h5 className="mb-0 fw-bold">Hotel option</h5>
                      </Accordion.Header>
                      <Accordion.Body>
                        {hotels.map((item, hotelIndex) => {
                          const hotel = item.hotel || {};
                          const details = hotel.details || {};
                          const checkIn = hotel.checkIn || hotel.checkInDate || details.checkInDate || "";
                          const checkOut = hotel.checkOut || hotel.checkOutDate || details.checkOutDate || "";
                          const searchRoomDTOs = hotel.searchRoomDTOs || details.searchRoomDTOs || [];
                          
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
                          const hotelTotalPrice = parseFloat(hotel.totalPrice || hotel.totalRate || details.totalPrice || details.totalRate || 0);
                          const hotelSellingPrice = parseFloat(hotel.sellingPrice || hotel.totalRate || details.sellingPrice || hotelTotalPrice || 0);
                          const pricePerNight = dateRange.length > 0 ? hotelTotalPrice / dateRange.length : hotelTotalPrice;

                          return (
                            <Card key={hotelIndex} className="mb-3 hotel-item-card">
                              <Card.Header className="hotel-section-header">
                                <div className="d-flex align-items-center gap-2">
                                  <FaBed className="text-primary" size={20} />
                                  <h6 className="mb-0 fw-bold">
                                    {hotels.length > 1 ? `Hotel ${hotelIndex + 1}: ` : ""}
                                    {hotel.hotelName || "Hotel"}
                                  </h6>
                                </div>
                              </Card.Header>
                              <Card.Body>
                              
                              <div className="date-display">
                                <FaCalendarAlt className="text-primary me-2" />
                                <strong>Checkin :</strong> {formatDate(checkIn)} <strong className="ms-3">Checkout :</strong> {formatDate(checkOut)}
                              </div>

                              {searchRoomDTOs.length > 0 && (
                                <>
                                  <Table striped bordered hover responsive size="sm" className="mb-3 room-table">
                                    <thead>
                                      <tr>
                                        <th>No.</th>
                                        <th>Room Category</th>
                                        <th>Adult Count</th>
                                        <th>Child Count</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {searchRoomDTOs.map((room, roomIndex) => {
                                        let childAges = [];
                                        if (room.childAge) {
                                          childAges = Array.isArray(room.childAge) ? room.childAge : [room.childAge];
                                        } else if (room.childAges) {
                                          childAges = Array.isArray(room.childAges) ? room.childAges : [room.childAges];
                                        }

                                        const childCount = parseInt(room.child || room.children || 0);

                                        return (
                                          <tr key={roomIndex}>
                                            <td>{roomIndex + 1}</td>
                                            <td>
                                              {hotel.roomCategory || "-"}
                                              {hotel.roomType && ` - ${hotel.roomType}`}
                                            </td>
                                            <td>{room.adult || room.adults || "-"}</td>
                                            <td>
                                              {childCount > 0 ? (
                                                <>
                                                  {childCount}
                                                  {childAges.length > 0 && childAges.length === 1 && (
                                                    <small className="text-muted d-block mt-1">
                                                      {childCount} Child : {childAges[0]} Age
                                                    </small>
                                                  )}
                                                  {childAges.length > 1 && (
                                                    <small className="text-muted d-block mt-1">
                                                      {childAges.map((age, idx) => (
                                                        <span key={idx}>
                                                          {idx + 1} Child : {age} Age{idx < childAges.length - 1 ? ", " : ""}
                                                        </span>
                                                      ))}
                                                    </small>
                                                  )}
                                                </>
                                              ) : (
                                                "-"
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </Table>

                                  {/* Guest Details for each room */}
                                  {searchRoomDTOs.map((room, roomIndex) => {
                                    const adults = parseInt(room.adult || room.adults || 1);
                                    const children = parseInt(room.child || room.children || 0);
                                    const totalGuests = adults + children;
                                    
                                    // Find hotel index in cartData to match validation
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
                                    
                                    const guestKey = hotelIndexInCart >= 0 ? `${hotelIndexInCart}-${roomIndex}` : `${hotelIndex}-${roomIndex}`;
                                    const guests = roomGuests[guestKey] || [];
                                    const actualHotelIndex = hotelIndexInCart >= 0 ? hotelIndexInCart : hotelIndex;

                                    if (totalGuests === 0) return null;

                                    return (
                                      <Card key={`guest-${roomIndex}`} className="mb-2 guest-details-card">
                                        <Card.Header>
                                          <h6 className="mb-0">
                                            Room {roomIndex + 1} - Guest Details
                                          </h6>
                                        </Card.Header>
                                        <Card.Body>
                                          {Array.from({ length: totalGuests }, (_, guestIndex) => {
                                            const isChild = guestIndex >= adults;
                                            const guest = guests[guestIndex] || {
                                              salutation: "",
                                              firstName: "",
                                              lastName: "",
                                              gender: "",
                                              isChild: isChild,
                                            };

                                            return (
                                              <div key={guestIndex} className="guest-row-item">
                                                <h6 className="mb-2">
                                                  {isChild
                                                    ? `Child ${guestIndex - adults + 1}${guest.age ? ` (Age: ${guest.age})` : ""}`
                                                    : `Adult ${guestIndex + 1}`}
                                                </h6>
                                                <Row className="g-2">
                                                  <Col md={3}>
                                                    <Form.Label className="small">
                                                      Salutation <span className="text-danger">*</span>
                                                    </Form.Label>
                                                    <Form.Select
                                                      size="sm"
                                                      value={guest.salutation}
                                                      onChange={(e) =>
                                                        handleGuestChange(
                                                          actualHotelIndex,
                                                          roomIndex,
                                                          guestIndex,
                                                          "salutation",
                                                          e.target.value
                                                        )
                                                      }
                                                      required
                                                      isInvalid={!!validationErrors[`hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_salutation`]}
                                                    >
                                                      <option value="">Select</option>
                                                      <option value="Mr">Mr</option>
                                                      <option value="Mrs">Mrs</option>
                                                      <option value="Ms">Ms</option>
                                                      <option value="Miss">Miss</option>
                                                      <option value="Dr">Dr</option>
                                                    </Form.Select>
                                                    <Form.Control.Feedback type="invalid">
                                                      {validationErrors[`hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_salutation`]}
                                                    </Form.Control.Feedback>
                                                  </Col>
                                                  <Col md={4}>
                                                    <Form.Label className="small">
                                                      First Name <span className="text-danger">*</span>
                                                    </Form.Label>
                                                    <Form.Control
                                                      type="text"
                                                      size="sm"
                                                      value={guest.firstName || ""}
                                                      onChange={(e) =>
                                                        handleGuestChange(
                                                          actualHotelIndex,
                                                          roomIndex,
                                                          guestIndex,
                                                          "firstName",
                                                          e.target.value
                                                        )
                                                      }
                                                      required
                                                      placeholder="First Name"
                                                      isInvalid={!!validationErrors[`hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_firstName`]}
                                                    />
                                                    <Form.Control.Feedback type="invalid">
                                                      {validationErrors[`hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_firstName`]}
                                                    </Form.Control.Feedback>
                                                  </Col>
                                                  <Col md={5}>
                                                    <Form.Label className="small">
                                                      Last Name <span className="text-danger">*</span>
                                                    </Form.Label>
                                                    <Form.Control
                                                      type="text"
                                                      size="sm"
                                                      value={guest.lastName || ""}
                                                      onChange={(e) =>
                                                        handleGuestChange(
                                                          actualHotelIndex,
                                                          roomIndex,
                                                          guestIndex,
                                                          "lastName",
                                                          e.target.value
                                                        )
                                                      }
                                                      required
                                                      placeholder="Last Name"
                                                      isInvalid={!!validationErrors[`hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_lastName`]}
                                                    />
                                                    <Form.Control.Feedback type="invalid">
                                                      {validationErrors[`hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_lastName`]}
                                                    </Form.Control.Feedback>
                                                  </Col>
                                                  <Col md={4}>
                                                    <Form.Label className="small">
                                                      Gender <span className="text-danger">*</span>
                                                    </Form.Label>
                                                    <Form.Select
                                                      size="sm"
                                                      value={guest.gender || ""}
                                                      onChange={(e) =>
                                                        handleGuestChange(
                                                          actualHotelIndex,
                                                          roomIndex,
                                                          guestIndex,
                                                          "gender",
                                                          e.target.value
                                                        )
                                                      }
                                                      required
                                                      isInvalid={!!validationErrors[`hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_gender`]}
                                                    >
                                                      <option value="">Select</option>
                                                      <option value="Male">Male</option>
                                                      <option value="Female">Female</option>
                                                    </Form.Select>
                                                    <Form.Control.Feedback type="invalid">
                                                      {validationErrors[`hotel_${actualHotelIndex}_room_${roomIndex}_guest_${guestIndex}_gender`]}
                                                    </Form.Control.Feedback>
                                                  </Col>
                                                </Row>
                                              </div>
                                            );
                                          })}
                                        </Card.Body>
                                      </Card>
                                    );
                                  })}
                                </>
                              )}

                              {/* Date-wise Pricing Table */}
                              {dateRange.length > 0 && (
                                <Table striped bordered hover responsive size="sm" className="mb-2 date-pricing-table">
                                  <thead>
                                    <tr>
                                      <th>Date</th>
                                      <th>Total Price</th>
                                      <th>Selling Price</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dateRange.map((date, dateIndex) => {
                                      const dateStr = date.toLocaleDateString("en-GB");
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
                                  <Form.Label>Tourism Dirhams (AED)</Form.Label>
                                  <Form.Control
                                    type="number"
                                    value={tourismDirhams}
                                    onChange={(e) => setTourismDirhams(e.target.value)}
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
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
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
                                    value={specialRequest}
                                    onChange={(e) => setSpecialRequest(e.target.value)}
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
                                    name="bookingConfirmation"
                                    value="Book & Voucher"
                                    checked={bookingConfirmation === "Book & Voucher"}
                                    onChange={(e) => setBookingConfirmation(e.target.value)}
                                    inline
                                    className="me-3"
                                  />
                                  <Form.Check
                                    type="radio"
                                    label="Book Now & Voucher later"
                                    name="bookingConfirmation"
                                    value="Book Now & Voucher later"
                                    checked={bookingConfirmation === "Book Now & Voucher later"}
                                    onChange={(e) => setBookingConfirmation(e.target.value)}
                                    inline
                                  />
                                </div>
                              </div>
                              </Card.Body>
                            </Card>
                          );
                        })}
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Activity Option Section */}
                  {activities.length > 0 && (
                    <Accordion.Item eventKey="2" className="mb-2">
                      <Accordion.Header>
                        <h5 className="mb-0 fw-bold">Tour option</h5>
                      </Accordion.Header>
                      <Accordion.Body>
                        {activities.map((item, activityIndex) => {
                          const activity = item.activity || {};
                          const details = activity.details || {};
                          const activityName = activity.activityName || details.activityName || "Activity";
                          const activityDate = activity.activityDate || details.activityDate || "";
                          const adult = activity.adult || details.adult || activity.noOfAdult || "0";
                          const child = activity.child || details.child || activity.noOfChild || "0";

                          let childAges = [];
                          if (activity.childAge) {
                            childAges = Array.isArray(activity.childAge) ? activity.childAge : [activity.childAge];
                          } 

                          const sellingPrice = parseFloat(activity.totalRate || 0);
                          const totalPrice = parseFloat(activity.totalRateWithoutmrk || 0);

                          return (
                            <Card key={activityIndex} className="mb-3 activity-item-card">
                              <Card.Header className="activity-header">
                                <div className="d-flex align-items-center gap-2">
                                  <FaTicketAlt className="text-primary" size={20} />
                                  <h6 className="mb-0 fw-bold">
                                    {activities.length > 1 ? `Activity ${activityIndex + 1}: ` : ""}
                                    {activityName}
                                  </h6>
                                </div>
                              </Card.Header>
                              <Card.Body>

                              <div className="date-display">
                                <FaCalendarAlt className="text-primary me-2" />
                                <strong>Tour date:</strong> {formatDate(activityDate)}
                              </div>

                              <Row className="g-3 mb-3">
                                <Col md={6}>
                                  <div>
                                    <strong>Adult Count</strong>
                                    <div className="mt-1">
                                      <Form.Control
                                        type="text"
                                        value={adult}
                                        readOnly
                                        className="bg-light"
                                      />
                                    </div>
                                  </div>
                                </Col>
                                <Col md={6}>
                                  <div>
                                    <strong>Child Count</strong>
                                    <div className="mt-1">
                                      <Form.Control
                                        type="text"
                                        value={child}
                                        readOnly
                                        className="bg-light"
                                      />
                                    </div>
                                    {childAges.length > 0 && childAges.length === 1 && (
                                      <small className="text-muted d-block mt-1">
                                        {child} Child : {childAges[0]} Age
                                      </small>
                                    )}
                                    {childAges.length > 1 && (
                                      <small className="text-muted d-block mt-1">
                                        {childAges.map((age, idx) => (
                                          <span key={idx}>
                                            {idx + 1} Child : {age} Age{idx < childAges.length - 1 ? ", " : ""}
                                          </span>
                                        ))}
                                      </small>
                                    )}
                                  </div>
                                </Col>
                              </Row>

                              <Row className="g-3 mb-3">
                                <Col md={6}>
                                  <div className="d-flex align-items-center justify-content-between">
                                    <strong>Selling Price</strong>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="text-success fw-bold">{sellingPrice.toFixed(2)}</span>
                                      {/* <FaEdit className="text-success" style={{ cursor: "pointer" }} /> */}
                                    </div>
                                  </div>
                                </Col>
                                <Col md={6}>
                                  <div className="d-flex align-items-center justify-content-between">
                                    <strong>Total Price</strong>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="text-primary fw-bold">{totalPrice.toFixed(2)}</span>
                                      {/* <FaEdit className="text-success" style={{ cursor: "pointer" }} /> */}
                                    </div>
                                  </div>
                                </Col>
                              </Row>
                              </Card.Body>
                            </Card>
                          );
                        })}
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Transfer Option Section */}
                  {transfers.length > 0 && (
                    <Accordion.Item eventKey="3" className="mb-2">
                      <Accordion.Header>
                        <h5 className="mb-0 fw-bold">Transfer option</h5>
                      </Accordion.Header>
                      <Accordion.Body>
                        {transfers.map((item, transferIndex) => {
                          const cab = item.cab || {};
                          const details = cab.details || {};
                          const vehicleName = cab.vehicleName || details.vehicleName || "Transfer";
                          const capacity = cab.capacity || details.capacity || "";
                          const pickupDate = cab.pickupDate || details.pickupDate || "";
                          const dropDate = cab.dropDate || details.dropDate || details.dropOffDate || "";
                          const adult = cab.adult || details.adult || cab.noOfAdult || "0";
                          const child = cab.child || details.child || cab.noOfChild || "0";
                          const travelType = cab.travelType || details.travelType || "1";
                          const shareType = cab.shareType || details.shareType || "Private";

                          // Handle childAge
                          let childAges = [];
                          if (cab.childAge) {
                            childAges = Array.isArray(cab.childAge) ? cab.childAge : [cab.childAge];
                          } else if (cab.childAges) {
                            childAges = Array.isArray(cab.childAges) ? cab.childAges : [cab.childAges];
                          } else if (cab.childAgeArray) {
                            childAges = Array.isArray(cab.childAgeArray) ? cab.childAgeArray : [cab.childAgeArray];
                          } else if (details.childAge) {
                            childAges = Array.isArray(details.childAge) ? details.childAge : [details.childAge];
                          } else if (details.childAgeArray) {
                            childAges = Array.isArray(details.childAgeArray) ? details.childAgeArray : [details.childAgeArray];
                          }

                          const transferDetail = transferDetails[transferIndex] || {};
                          const sellingPrice = parseFloat(cab.totalRate || cab.totalPrice || details.totalRate || details.totalPrice || 0);
                          const totalPrice = parseFloat(cab.totalRateWithoutmrk || cab.totalPrice || details.totalRateWithoutmrk || details.totalPrice || 0);

                          // Get travel type label
                          const getTravelTypeLabel = (type) => {
                            if (type === "1") return "Arrival & Departure";
                            if (type === "2") return "Arrival";
                            if (type === "3") return "Departure";
                            return type;
                          };

                          return (
                            <Card key={transferIndex} className="mb-3 transfer-item-card">
                              <Card.Header className="transfer-header">
                                <div className="d-flex align-items-center gap-2">
                                  <FaCar className="text-primary" size={20} />
                                  <h6 className="mb-0 fw-bold">
                                    {transfers.length > 1 ? `Transfer ${transferIndex + 1}: ` : ""}
                                    {capacity ? `${capacity} Seater` : vehicleName}
                                  </h6>
                                </div>
                              </Card.Header>
                              <Card.Body>

                              <div className="date-display">
                                <FaCalendarAlt className="text-primary me-2" />
                                <strong>Pickup date :</strong> {formatDate(pickupDate)} <strong className="ms-3">Drop date :</strong> {formatDate(dropDate)}
                              </div>

                              {/* Transfer Option/Share type Table */}
                              <Table striped bordered hover responsive size="sm" className="mb-3 transfer-table">
                                <thead>
                                  <tr>
                                    <th>Transfer Option/Share type</th>
                                    <th>Adult Count</th>
                                    <th>Child Count</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td>{getTravelTypeLabel(travelType)} / {shareType}</td>
                                    <td>{adult}</td>
                                    <td>
                                      {child}
                                      {childAges.length > 0 && childAges.length === 1 && (
                                        <small className="text-muted d-block">
                                          {child} Child : {childAges[0]} Age
                                        </small>
                                      )}
                                      {childAges.length > 1 && (
                                        <small className="text-muted d-block">
                                          {childAges.map((age, idx) => (
                                            <span key={idx}>
                                              {idx + 1} Child : {age} Age{idx < childAges.length - 1 ? ", " : ""}
                                            </span>
                                          ))}
                                        </small>
                                      )}
                                    </td>
                                  </tr>
                                </tbody>
                              </Table>

                              {/* Transporter and Driver Details */}
                              <div className="mb-3 p-3 bg-light rounded">
                                <h6 className="mb-3 fw-bold text-primary">Transporter & Driver Details</h6>
                                <Row className="g-3">
                                <Col md={6}>
                                  <Form.Label>Transporter Name</Form.Label>
                                  <Form.Control
                                    type="text"
                                    value={transferDetail.transporterName || ""}
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
                                <Col md={6}>
                                  <Form.Label>Contact Number</Form.Label>
                                  <Form.Control
                                    type="text"
                                    value={transferDetail.contactNumber || ""}
                                    onChange={(e) =>
                                      setTransferDetails({
                                        ...transferDetails,
                                        [transferIndex]: {
                                          ...transferDetail,
                                          contactNumber: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="Enter contact number"
                                  />
                                </Col>
                                <Col md={6}>
                                  <Form.Label>Driver Name</Form.Label>
                                  <Form.Control
                                    type="text"
                                    value={transferDetail.driverName || ""}
                                    onChange={(e) =>
                                      setTransferDetails({
                                        ...transferDetails,
                                        [transferIndex]: {
                                          ...transferDetail,
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
                                    value={transferDetail.driverContact || ""}
                                    onChange={(e) =>
                                      setTransferDetails({
                                        ...transferDetails,
                                        [transferIndex]: {
                                          ...transferDetail,
                                          driverContact: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="Enter driver contact"
                                  />
                                </Col>
                                </Row>
                              </div>

                              {/* Selling Price and Total Price */}
                              <Row className="g-3">
                                <Col md={6}>
                                  <div className="d-flex align-items-center justify-content-between">
                                    <strong>Selling Price</strong>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="text-success fw-bold">{sellingPrice.toFixed(2)}</span>
                                      <FaEdit className="text-success edit-icon" />
                                    </div>
                                  </div>
                                </Col>
                                <Col md={6}>
                                  <div className="d-flex align-items-center justify-content-between">
                                    <strong>Total Price</strong>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="text-primary fw-bold">{totalPrice.toFixed(2)}</span>
                                      <FaEdit className="text-success edit-icon" />
                                    </div>
                                  </div>
                                </Col>
                              </Row>
                              </Card.Body>
                            </Card>
                          );
                        })}
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Visa Information Section */}
                  <Accordion.Item eventKey="4" className="mb-2">
                    <Accordion.Header>
                      <h5 className="mb-0 fw-bold">Visa Information</h5>
                    </Accordion.Header>
                    <Accordion.Body>
                      <Form.Check
                        type="checkbox"
                        label="Visa Required"
                        checked={visaRequired}
                        onChange={(e) => setVisaRequired(e.target.checked)}
                        className="mb-2"
                      />
                      
                      {visaRequired && (
                        <div className="visa-section">
                          <h6 className="mb-3 fw-bold text-warning">Visa Details</h6>
                          <Row className="g-3 visa-form-row">
                          <Col md={6}>
                            <Form.Label>Visa Adult</Form.Label>
                            <Form.Control
                              type="number"
                              value={visaDetails.visaAdult}
                              onChange={(e) =>
                                setVisaDetails({ ...visaDetails, visaAdult: e.target.value })
                              }
                              min="0"
                            />
                          </Col>
                          <Col md={6}>
                            <Form.Label>Visa Adult Rate</Form.Label>
                            <Form.Control
                              type="number"
                              value={visaDetails.visaAdultRate}
                              onChange={(e) =>
                                setVisaDetails({ ...visaDetails, visaAdultRate: e.target.value })
                              }
                              min="0"
                              step="0.01"
                            />
                          </Col>
                          <Col md={6}>
                            <Form.Label>Visa Child</Form.Label>
                            <Form.Control
                              type="number"
                              value={visaDetails.visaChild}
                              onChange={(e) =>
                                setVisaDetails({ ...visaDetails, visaChild: e.target.value })
                              }
                              min="0"
                            />
                          </Col>
                          <Col md={6}>
                            <Form.Label>Visa Child Rate</Form.Label>
                            <Form.Control
                              type="number"
                              value={visaDetails.visaChildRate}
                              onChange={(e) =>
                                setVisaDetails({ ...visaDetails, visaChildRate: e.target.value })
                              }
                              min="0"
                              step="0.01"
                            />
                          </Col>
                          <Col md={6}>
                            <Form.Label>Visa Infant</Form.Label>
                            <Form.Control
                              type="number"
                              value={visaDetails.visaInfant}
                              onChange={(e) =>
                                setVisaDetails({ ...visaDetails, visaInfant: e.target.value })
                              }
                              min="0"
                            />
                          </Col>
                          <Col md={6}>
                            <Form.Label>Visa Infant Rate</Form.Label>
                            <Form.Control
                              type="number"
                              value={visaDetails.visaInfantRate}
                              onChange={(e) =>
                                setVisaDetails({ ...visaDetails, visaInfantRate: e.target.value })
                              }
                              min="0"
                              step="0.01"
                            />
                          </Col>
                          </Row>
                        </div>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>

                  {/* Guest Details Section - Always Open */}
                  <Accordion.Item eventKey="5" className="mb-2">
                    <Accordion.Header 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      style={{ cursor: 'default' }}
                    >
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
                                handlePrimaryGuestChange("salutation", e.target.value)
                              }
                              isInvalid={!!validationErrors.primaryGuest_salutation}
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
                                handlePrimaryGuestChange("firstName", e.target.value)
                              }
                              isInvalid={!!validationErrors.primaryGuest_firstName}
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
                                handlePrimaryGuestChange("lastName", e.target.value)
                              }
                              isInvalid={!!validationErrors.primaryGuest_lastName}
                              required
                            />
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.primaryGuest_lastName}
                            </Form.Control.Feedback>
                          </Col>
                          <Col md={4}>
                            <Form.Label>
                              Contact Number <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="tel"
                              value={primaryGuest.contactNumber}
                              onChange={(e) =>
                                handlePrimaryGuestChange("contactNumber", e.target.value)
                              }
                              isInvalid={!!validationErrors.primaryGuest_contactNumber}
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
                                handlePrimaryGuestChange("emailId", e.target.value)
                              }
                              isInvalid={!!validationErrors.primaryGuest_emailId}
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
                </Accordion>
              </Col>
            </Row>

            {/* Action Buttons at the end of page */}
            <Row className="mt-4">
              <Col lg={12}>
                <div className="d-flex gap-2 justify-content-end">
                  <Button
                    type="button"
                    variant="danger"
                    size="lg"
                    className="btn-booking btn-booking-danger"
                    onClick={() => navigate(-1)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    variant="primary" 
                    size="lg"
                    className="btn-booking btn-booking-primary"
                    onClick={handleSubmit}
                  >
                    <FaCheckCircle className="me-2" />
                    Book
                  </Button>
                </div>
              </Col>
            </Row>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default MakePkgBookingPage;
