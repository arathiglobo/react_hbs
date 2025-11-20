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
} from "react-icons/fa";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import toast from "react-hot-toast";
import "../../../styles/HotelBookingPage.css";

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
      if (guests[guestIndex]) {
        guests[guestIndex] = {
          ...guests[guestIndex],
          [field]: value,
        };
      }
      updated[key] = guests;
      return updated;
    });
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

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!primaryGuest.firstName || !primaryGuest.lastName) {
      toast.error("Please fill in all required guest details.");
      return;
    }

    if (!primaryGuest.lpo) {
      toast.error("LPO is required.");
      return;
    }

    // Validate room guest details
    const hotels = getHotels();
    if (hotels.length > 0) {
      // Find hotel index in cartData
      const hotelIndexInCart = cartData.findIndex((item) => item.hotel);
      
      if (hotelIndexInCart >= 0) {
        const hotel = hotels[0].hotel || {};
        const searchRoomDTOs = hotel.searchRoomDTOs || [];
        
        for (let roomIndex = 0; roomIndex < searchRoomDTOs.length; roomIndex++) {
          const guestKey = `${hotelIndexInCart}-${roomIndex}`;
          const guests = roomGuests[guestKey] || [];
          
          for (let guestIndex = 0; guestIndex < guests.length; guestIndex++) {
            const guest = guests[guestIndex];
            if (!guest.salutation || !guest.firstName || !guest.lastName || !guest.gender) {
              toast.error(`Please fill in all guest details for Room ${roomIndex + 1}, Guest ${guestIndex + 1}.`);
              return;
            }
          }
        }
      }
    }

    try {
      const activities = getActivities();
      const transfers = getTransfers();
      
      // Find hotel index in cartData
      const hotelIndexInCart = cartData.findIndex((item) => item.hotel);

      // Prepare booking payload
      const bookingPayload = {
        customPackageId: "",
        sellingPrice: sellingPrice.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        tourDate: activities.length > 0 ? formatDate(activities[0].activity?.activityDate) : "",
        visaStatus: visaRequired,
        visaAdult: visaDetails.visaAdult,
        visaAdultRate: visaDetails.visaAdultRate,
        visaChild: visaDetails.visaChild,
        visaChildRate: visaDetails.visaChildRate,
        visaInfant: visaDetails.visaInfant,
        visaInfantRate: visaDetails.visaInfantRate,
        hotelBookingRequest: hotels.length > 0 ? {
          agentId: sessionStorage.getItem("makePkgAgentId") || "1",
          apiId: hotels[0].hotel?.api || "INHOUSE",
          hotelId: hotels[0].hotel?.hotelId || "",
          hotelName: hotels[0].hotel?.hotelName || "",
          address: hotels[0].hotel?.hotelAddress || "",
          starRating: hotels[0].hotel?.starRating || 0,
          checkInDate: hotels[0].hotel?.checkIn || hotels[0].hotel?.checkInDate || "",
          checkOutDate: hotels[0].hotel?.checkOut || hotels[0].hotel?.checkOutDate || "",
          nights: 1,
          employeeId: "1",
          roomStatus: "Available",
          cancellationPolicy: [],
          deadlineDate: "",
          isBookandVoucher: bookingConfirmation === "Book & Voucher",
          primaryGuest: {
            firstName: primaryGuest.firstName,
            middleName: primaryGuest.middleName || "",
            lastName: primaryGuest.lastName,
            nativeCountry: "",
            email: primaryGuest.emailId || "",
            phone: primaryGuest.contactNumber || "",
            passportNo: primaryGuest.passportNumber || "",
            salutaion: primaryGuest.salutation,
            agentlpo: primaryGuest.lpo,
          },
          rooms: hotels[0].hotel?.searchRoomDTOs?.map((room, idx) => {
            const guestKey = `${hotelIndexInCart}-${idx}`;
            const guests = roomGuests[guestKey] || [];
            
            return {
              roomNo: idx + 1,
              roomCategory: hotels[0].hotel?.roomCategory || "",
              mealPlan: hotels[0].hotel?.roomType || "",
              nonRefundable: false,
              currency: "AED",
              rate: 0,
              rateWithoutMarkup: 0,
              adults: parseInt(room.adult || 1),
              children: parseInt(room.child || 0),
              childAges: Array.isArray(room.childAge) ? room.childAge : [],
              guests: guests.map((guest) => ({
                salutation: guest.salutation || "",
                firstName: guest.firstName || "",
                middleName: "",
                lastName: guest.lastName || "",
                gender: guest.gender || "",
                isChild: guest.isChild || false,
              })),
            };
          }) || [],
          remarks: remarks,
          specialRequests: specialRequest,
          tourismDirhams: parseFloat(tourismDirhams) || 0,
          bookingConfirmation: bookingConfirmation,
        } : null,
        customBookingActivityDTO: activities.map((item) => ({
          activityId: item.activity?.activityId || "",
          tourDate: item.activity?.activityDate || "",
          noOfAdult: item.activity?.adult || "1",
          noOfChild: item.activity?.child || "0",
          childAgeArray: Array.isArray(item.activity?.childAge) 
            ? item.activity.childAge.map(String)
            : item.activity?.childAge ? [String(item.activity.childAge)] : [],
          sellingPrice: "0",
          totalPrice: "0",
        })),
        customBookingCabDTO: transfers.map((item) => ({
          cabId: item.cab?.cabId || "",
          noOfCabs: "1",
          pickupDate: item.cab?.pickupDate || "",
          dropOffDate: item.cab?.dropDate || "",
          travelType: item.cab?.travelType || "1",
          hourDetails: "0",
          dropDetails: "3",
          paxDetails: "1",
          luggage: true,
          locationId: item.cab?.locationId || "",
          noOfAdult: item.cab?.adult || "1",
          noOfChild: item.cab?.child || "0",
          childAgeArray: Array.isArray(item.cab?.childAge) 
            ? item.cab.childAge.map(String)
            : item.cab?.childAge ? [String(item.cab.childAge)] : [],
          totalRate: "0",
          totalRateWithoutmrk: "0",
          transporter: item.cab?.transporter || "",
          contactNumber: item.cab?.contactNumber || "",
          driverName: item.cab?.driverName || "",
          driverContact: item.cab?.driverContact || "",
        })),
        customBookingItinearyDTO: selectedItineraries.map((itineraryId) => ({
          itinearyId: String(itineraryId),
          days: 1,
        })),
        paymentApiId: "",
        agentId: sessionStorage.getItem("makePkgAgentId") || "1",
        isCartBooking: true,
      };

      console.log("Booking payload:", bookingPayload);

      const response = await axiosInstance.post(
        "/api/makeYourOwnPackage/saveMakeYourOwnPackageBooking",
        bookingPayload
      );

      if (response.data && response.data.success !== false) {
        toast.success("Booking submitted successfully!");
        navigate("/booking-details/hotel-booking-list");
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
            <div className="text-center">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3 text-muted">Loading booking details...</p>
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
          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <Alert variant="warning" className="text-center">
              <Alert.Heading>No Items in Cart</Alert.Heading>
              <p>Your cart is empty. Please add items to cart first.</p>
              <Button
                variant="primary"
                onClick={() => navigate("/new-booking/make-your-own-package")}
              >
                Go to Search
              </Button>
            </Alert>
          </main>
        </div>
      </div>
    );
  }

  const hotels = getHotels();
  const activities = getActivities();
  const transfers = getTransfers();

  return (
    <div className="hotel-booking-container">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <main className="content-wrapper py-4">
          <Container fluid>
            <Row>
              <Col lg={8}>
                <h2 className="mb-4 text-primary fw-bold">Confirm Booking</h2>

                <Accordion defaultActiveKey="0">
                  {/* Itinerary Option Section */}
                  <Accordion.Item eventKey="0" className="mb-3">
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
                            <Form.Check
                              key={itinerary.itineraryId}
                              type="checkbox"
                              id={`itinerary-${itinerary.itineraryId}`}
                              label={itinerary.itineraryHeading}
                              checked={selectedItineraries.includes(itinerary.itineraryId)}
                              onChange={() => handleItineraryToggle(itinerary.itineraryId)}
                              className="mb-3 p-2 border rounded"
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted">No itinerary details available.</p>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>

                  {/* Hotel Option Section */}
                  {hotels.length > 0 && (
                    <Accordion.Item eventKey="1" className="mb-3">
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
                            <div key={hotelIndex} className="mb-4">
                              <div className="d-flex align-items-center gap-2 mb-3">
                                <FaBed className="text-primary" size={20} />
                                <h6 className="mb-0 fw-bold">
                                  {hotel.hotelName || "Hotel"}
                                </h6>
                              </div>
                              
                              <p className="text-muted mb-3">
                                <strong>Checkin :</strong> {formatDate(checkIn)} <strong>Checkout :</strong> {formatDate(checkOut)}
                              </p>

                              {searchRoomDTOs.length > 0 && (
                                <>
                                  <Table striped bordered hover responsive size="sm" className="mb-3">
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

                                        return (
                                          <tr key={roomIndex}>
                                            <td>{roomIndex + 1}</td>
                                            <td>
                                              {hotel.roomCategory || "-"}
                                              {hotel.roomType && ` - ${hotel.roomType}`}
                                            </td>
                                            <td>{room.adult || room.adults || "-"}</td>
                                            <td>{room.child || room.children || "-"}</td>
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
                                    const guestKey = `${hotelIndex}-${roomIndex}`;
                                    const guests = roomGuests[guestKey] || [];

                                    if (totalGuests === 0) return null;

                                    return (
                                      <Card key={`guest-${roomIndex}`} className="mb-3">
                                        <Card.Header className="bg-primary text-white">
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
                                              <div key={guestIndex} className="mb-3 pb-3 border-bottom">
                                                <h6 className="mb-2 text-muted">
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
                                                          hotelIndex,
                                                          roomIndex,
                                                          guestIndex,
                                                          "salutation",
                                                          e.target.value
                                                        )
                                                      }
                                                      required
                                                    >
                                                      <option value="">Select</option>
                                                      <option value="Mr">Mr</option>
                                                      <option value="Mrs">Mrs</option>
                                                      <option value="Ms">Ms</option>
                                                      <option value="Miss">Miss</option>
                                                      <option value="Dr">Dr</option>
                                                    </Form.Select>
                                                  </Col>
                                                  <Col md={4}>
                                                    <Form.Label className="small">
                                                      First Name <span className="text-danger">*</span>
                                                    </Form.Label>
                                                    <Form.Control
                                                      type="text"
                                                      size="sm"
                                                      value={guest.firstName}
                                                      onChange={(e) =>
                                                        handleGuestChange(
                                                          hotelIndex,
                                                          roomIndex,
                                                          guestIndex,
                                                          "firstName",
                                                          e.target.value
                                                        )
                                                      }
                                                      required
                                                      placeholder="First Name"
                                                    />
                                                  </Col>
                                                  <Col md={5}>
                                                    <Form.Label className="small">
                                                      Last Name <span className="text-danger">*</span>
                                                    </Form.Label>
                                                    <Form.Control
                                                      type="text"
                                                      size="sm"
                                                      value={guest.lastName}
                                                      onChange={(e) =>
                                                        handleGuestChange(
                                                          hotelIndex,
                                                          roomIndex,
                                                          guestIndex,
                                                          "lastName",
                                                          e.target.value
                                                        )
                                                      }
                                                      required
                                                      placeholder="Last Name"
                                                    />
                                                  </Col>
                                                  <Col md={4}>
                                                    <Form.Label className="small">
                                                      Gender <span className="text-danger">*</span>
                                                    </Form.Label>
                                                    <Form.Select
                                                      size="sm"
                                                      value={guest.gender}
                                                      onChange={(e) =>
                                                        handleGuestChange(
                                                          hotelIndex,
                                                          roomIndex,
                                                          guestIndex,
                                                          "gender",
                                                          e.target.value
                                                        )
                                                      }
                                                      required
                                                    >
                                                      <option value="">Select</option>
                                                      <option value="Male">Male</option>
                                                      <option value="Female">Female</option>
                                                    </Form.Select>
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
                                <Table striped bordered hover responsive size="sm" className="mb-3">
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
                              <Row className="mb-3">
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
                              <Row className="mb-3">
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
                              <Row className="mb-3">
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
                            </div>
                          );
                        })}
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Activity Option Section */}
                  {activities.length > 0 && (
                    <Accordion.Item eventKey="2" className="mb-3">
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
                          } else if (activity.childAges) {
                            childAges = Array.isArray(activity.childAges) ? activity.childAges : [activity.childAges];
                          } else if (activity.childAgeArray) {
                            childAges = Array.isArray(activity.childAgeArray) ? activity.childAgeArray : [activity.childAgeArray];
                          }

                          const sellingPrice = parseFloat(activity.sellingPrice || activity.totalPrice || details.sellingPrice || details.totalPrice || 0);
                          const totalPrice = parseFloat(activity.totalPrice || activity.price || details.totalPrice || details.price || 0);

                          return (
                            <div key={activityIndex} className="mb-4">
                              <div className="d-flex align-items-center gap-2 mb-3">
                                <FaTicketAlt className="text-primary" size={20} />
                                <h6 className="mb-0 fw-bold">{activityName}</h6>
                              </div>

                              <div className="mb-3">
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
                                      <FaEdit className="text-success" style={{ cursor: "pointer" }} />
                                    </div>
                                  </div>
                                </Col>
                                <Col md={6}>
                                  <div className="d-flex align-items-center justify-content-between">
                                    <strong>Total Price</strong>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="text-primary fw-bold">{totalPrice.toFixed(2)}</span>
                                      <FaEdit className="text-success" style={{ cursor: "pointer" }} />
                                    </div>
                                  </div>
                                </Col>
                              </Row>
                            </div>
                          );
                        })}
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Transfer Option Section */}
                  {transfers.length > 0 && (
                    <Accordion.Item eventKey="3" className="mb-3">
                      <Accordion.Header>
                        <h5 className="mb-0 fw-bold">Transfer option</h5>
                      </Accordion.Header>
                      <Accordion.Body>
                        {transfers.map((item, transferIndex) => {
                          const cab = item.cab || {};
                          const details = cab.details || {};
                          const vehicleName = cab.vehicleName || details.vehicleName || "Transfer";
                          const pickupDate = cab.pickupDate || details.pickupDate || "";
                          const dropDate = cab.dropDate || details.dropDate || details.dropOffDate || "";
                          const pickupLocation = cab.pickupLocation || details.pickupLocation || "";
                          const dropoffLocation = cab.dropoffLocation || details.dropoffLocation || "";
                          const adult = cab.adult || details.adult || cab.noOfAdult || "";
                          const child = cab.child || details.child || cab.noOfChild || "";

                          return (
                            <div key={transferIndex} className="mb-3">
                              <div className="d-flex align-items-center gap-2 mb-2">
                                <FaCar className="text-warning" size={20} />
                                <strong>{vehicleName}</strong>
                              </div>
                              <Row className="g-2 small text-muted">
                                {pickupDate && (
                                  <Col sm={6}>
                                    <strong>Pickup date:</strong> {formatDate(pickupDate)}
                                  </Col>
                                )}
                                {dropDate && (
                                  <Col sm={6}>
                                    <strong>Drop date:</strong> {formatDate(dropDate)}
                                  </Col>
                                )}
                                {pickupLocation && (
                                  <Col sm={6}>
                                    <strong>Pickup:</strong> {pickupLocation}
                                  </Col>
                                )}
                                {dropoffLocation && (
                                  <Col sm={6}>
                                    <strong>Dropoff:</strong> {dropoffLocation}
                                  </Col>
                                )}
                                {adult && (
                                  <Col sm={6}>
                                    <strong>Adult Count:</strong> {adult}
                                  </Col>
                                )}
                                {child && (
                                  <Col sm={6}>
                                    <strong>Child Count:</strong> {child}
                                  </Col>
                                )}
                              </Row>
                            </div>
                          );
                        })}
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Visa Information Section */}
                  <Accordion.Item eventKey="4" className="mb-3">
                    <Accordion.Header>
                      <h5 className="mb-0 fw-bold">Visa Information</h5>
                    </Accordion.Header>
                    <Accordion.Body>
                      <Form.Check
                        type="checkbox"
                        label="Visa Required"
                        checked={visaRequired}
                        onChange={(e) => setVisaRequired(e.target.checked)}
                        className="mb-3"
                      />
                      
                      {visaRequired && (
                        <Row className="g-3">
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
                      )}
                    </Accordion.Body>
                  </Accordion.Item>

                  {/* Guest Details Section */}
                  <Accordion.Item eventKey="5" className="mb-3">
                    <Accordion.Header>
                      <h5 className="mb-0 fw-bold">Guest Details</h5>
                    </Accordion.Header>
                    <Accordion.Body>
                      <Form onSubmit={handleSubmit}>
                        <Row className="g-3">
                          <Col md={3}>
                            <Form.Label>
                              Title <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Select
                              value={primaryGuest.salutation}
                              onChange={(e) =>
                                setPrimaryGuest({
                                  ...primaryGuest,
                                  salutation: e.target.value,
                                })
                              }
                              required
                            >
                              <option value="Mr">Mr</option>
                              <option value="Mrs">Mrs</option>
                              <option value="Ms">Ms</option>
                              <option value="Dr">Dr</option>
                            </Form.Select>
                          </Col>
                          <Col md={4}>
                            <Form.Label>
                              First Name <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              value={primaryGuest.firstName}
                              onChange={(e) =>
                                setPrimaryGuest({
                                  ...primaryGuest,
                                  firstName: e.target.value,
                                })
                              }
                              required
                            />
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
                                setPrimaryGuest({
                                  ...primaryGuest,
                                  lastName: e.target.value,
                                })
                              }
                              required
                            />
                          </Col>
                          <Col md={4}>
                            <Form.Label>Contact Number</Form.Label>
                            <Form.Control
                              type="tel"
                              value={primaryGuest.contactNumber}
                              onChange={(e) =>
                                setPrimaryGuest({
                                  ...primaryGuest,
                                  contactNumber: e.target.value,
                                })
                              }
                            />
                          </Col>
                          <Col md={4}>
                            <Form.Label>Email Id</Form.Label>
                            <Form.Control
                              type="email"
                              value={primaryGuest.emailId}
                              onChange={(e) =>
                                setPrimaryGuest({
                                  ...primaryGuest,
                                  emailId: e.target.value,
                                })
                              }
                            />
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
                                setPrimaryGuest({
                                  ...primaryGuest,
                                  lpo: e.target.value,
                                })
                              }
                              required
                            />
                          </Col>
                        </Row>

                        {/* Submit Buttons */}
                        <div className="mt-4 d-flex gap-2">
                          <Button type="submit" variant="primary" size="lg">
                            BOOK →
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="lg"
                            onClick={() => navigate(-1)}
                          >
                            × Cancel
                          </Button>
                        </div>
                      </Form>
                    </Accordion.Body>
                  </Accordion.Item>
                </Accordion>
              </Col>

              {/* Price Summary Sidebar */}
              <Col lg={4}>
                <Card className="sticky-top shadow-sm" style={{ top: "20px" }}>
                  <Card.Body className="text-center">
                    <div className="mb-3">
                      <h3 className="text-primary fw-bold mb-1">
                        {sellingPrice.toFixed(2)}
                      </h3>
                      <small className="text-muted">(Selling Price)</small>
                    </div>
                    <hr />
                    <div className="mt-3">
                      <h3 className="text-primary fw-bold mb-1">
                        {totalPrice.toFixed(2)}
                      </h3>
                      <small className="text-muted">(Total Price)</small>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Container>
        </main>
      </div>
    </div>
  );
};

export default MakePkgBookingPage;
