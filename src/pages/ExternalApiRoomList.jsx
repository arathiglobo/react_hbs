import React, { useState, useEffect } from "react";
import { useAccordionButton } from "react-bootstrap/AccordionButton";
import {
  Card,
  Button,
  Row,
  Col,
  Badge,
  Accordion,
  Spinner,
  Alert,
  Modal,
} from "react-bootstrap";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import {
  FaBed,
  FaUtensils,
  FaStar,
  FaMapMarkerAlt,
  FaPhone,
  FaCalendarAlt,
  FaUsers,
  FaInfoCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaChevronDown,
  FaChevronUp,
  FaHotel,
  FaMoneyBillWave,
  FaShieldAlt,
  FaGlobe,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/RoomList.css";
import axiosInstance from "../components/AxiosInstance";

// Toggle button for inner category accordion
function CategoryToggleButton({ eventKey, isActive }) {
  const decoratedOnClick = useAccordionButton(eventKey);
  return (
    <Button
      variant="outline-primary"
      size="sm"
      onClick={decoratedOnClick}
      className="d-flex align-items-center gap-1"
    >
      {isActive ? "Hide Details/Book" : "View Details/Book"}
      {isActive ? <FaChevronUp /> : <FaChevronDown />}
    </Button>
  );
}




const ExternalApiRoomList = () => {
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Per-room selection: [{ roomNo, selectedRate }, ...]
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  // Track which outer room accordion is open
  const [activeOuterAccordion, setActiveOuterAccordion] = useState("room-0");
  const location = useLocation();
  const navigate = useNavigate();
  const [hotelStaticData, setHotelStaticData] = useState(null);
  const [searchPayload, setSearchPayload] = useState(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [policyList, setPolicyList] = useState(null);
  const [selectedRate, setSelectedRate] = useState(null);

  let activeUserRole = localStorage.getItem("currentActiveRole");
  // console.log("currentActiveRole::", activeUserRole);

  // Trigger API call on page load with state passed from HotelSearch
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        setError(null);

        let payload = location.state?.payload;
        let meta = location.state?.meta;

        // Fallback to sessionStorage if location.state is null (e.g., via window.open)
        if (!payload) {
          try {
            const stored = sessionStorage.getItem("roomListPayload");
            if (stored) {
              const parsed = JSON.parse(stored);
              payload = parsed.payload;
              meta = parsed.meta;
              setHotelStaticData(meta);
              setSearchPayload(payload);
              // console.log("Retrieved payload from sessionStorage:", payload);
              // console.log("Retrieved meta from sessionStorage:", meta);
            }
          } catch (e) {
            console.error("Error parsing sessionStorage:", e);
          }
        }

        // console.log("payload::", payload);
        if (!payload) {
          setError("Missing search context. Please go back and try again.");
          setLoading(false);
          return;
        }

        const res = await axiosInstance.post(
          "/api/hotel-rooms/search",
          payload,
        );

        // console.log("room search res::", res);

        // Check for no availability or failed search
        if (!res.data || res.data.success === false) {
          const message =
            res.data?.message || "Search failed. Please try again.";
          // console.log("API error message:", message);

          if (message.toLowerCase().includes("no availability found")) {
            // console.log("Triggering no availability modal");
            setShowUnavailableModal(true);
          } else {
            setError(message);
          }
          setLoading(false);
          return;
        }

        const enriched = {
          ...res.data,
          hotels: (res.data.hotels || []).map((h) => ({
            ...h,
            // Sort availableRates within each category by totalRate asc
            roomCategories: (h.roomCategories || []).map((c) => ({
              ...c,
              availableRates: (c.availableRates || [])
                .slice()
                .sort((a, b) => (a.totalRate || 0) - (b.totalRate || 0)),
            })),
          })),
          meta: meta || {},
          payload,
        };

        // Initialise per-room selection array based on number of rooms requested
        const numRooms = (payload?.rooms || []).length || 1;
        setSelectedRooms(
          Array.from({ length: numRooms }, (_, i) => ({ roomNo: i + 1, selectedRate: null }))
        );
        setRoomData(enriched);
      } catch (err) {
        console.error("Room search failed:", err);
        setError("Search failed. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, [location.state]);

  // Handle per-room rate radio selection
  const handleRateSelect = (roomIndex, rate) => {
    setSelectedRooms((prev) =>
      prev.map((r, i) => (i === roomIndex ? { ...r, selectedRate: rate } : r))
    );
  };

  // All rooms have a selection?
  const allRoomsSelected = selectedRooms.length > 0 && selectedRooms.every((r) => r.selectedRate !== null);

  const handleBooking = async () => {
    const { payload, hotels } = roomData;
    const hotelsdetail = hotels[0];
    // Use first room's rate as the primary rate (for API-specific flows)
    const primaryRate = selectedRooms[0]?.selectedRate;

    // For API IDs 12 and 15, fetch accurate rates
    if (payload.apiId === 12 || payload.apiId === 15) {
      setLoadingRate(true);
      setTimeout(async () => {
        try {
          // Build one room entry per selected room
          // console.log("selectedRooms::", selectedRooms);
          // const roomsArray = selectedRooms.map((r, i) => ({
          //   adult: {
          //     age: (payload.rooms[i]?.adultAges?.[0] ?? payload.rooms[0]?.adultAges?.[0] ?? 30).toString(),
          //   },
          //   roomTypeCode: r.selectedRate?.roomTypeCode,
          //   mealPlanCode: r.selectedRate?.mealPlanCode,
          //   contractTokenId: r.selectedRate?.contractTokenId || "0",
          //   roomConfigurationId: i + 1,
          // }));

          // Always send `room` as an array — required by the backend for both single and multiple rooms
          // const roomConfiguration = { room: roomsArray };



          let priceCheckReq = {
            searchCriteria: {
              // roomConfiguration,
              roomConfiguration: {
                room: {
                  adult: {
                    age: payload.rooms[0].adultAges[0].toString(),
                  },
                  roomTypeCode: primaryRate.roomTypeCode,
                  mealPlanCode: primaryRate.mealPlanCode,
                  contractTokenId: primaryRate.contractTokenId || "0",
                  roomConfigurationId: payload.rooms.length,
                },
              },
              startDate: payload.checkInDate,
              endDate: payload.checkOutDate,
              hotelCode: payload.hotelCode,
              nationality: payload.nationality,
              includeRateDetails: "Y",
              cancellationPolicy: "Y",
              groupByRooms: "Y",
            },
          };

          console.log("priceCheckReq (multi-room):", JSON.stringify(priceCheckReq, null, 2));

          let endpoint = "";
          switch (payload.apiId) {
            case 12:
              endpoint = "/api/iwtx/hotel/availability";
              break;
            case 15:
              endpoint = "/api/x3/hotel/availability";
              break;
          }

          const response = await axiosInstance.post(endpoint, priceCheckReq);
          const hotel = response.data.hotels.hotel[0];
          const rooms = hotel.roomTypeDetails.rooms.room;

          const accurateRates = rooms
            .filter((room) => room != null)
            .map((room) => ({
              hotelId: hotel.hotelId,
              hotelName: hotel.hotelName,
              roomCategory: room.roomType,
              mealPlan: room.mealPlan,
              contractLabel: room.contractLabel,
              nonRefundable: room.nonRefundable,
              rate: room.rateDetails.rate,
              currency: room.currCode,
            }));

          console.log("accurateRate:", accurateRates);
          setSelectedRate(accurateRates[0]);
          setLoadingRate(false);
          setShowBookingModal(true);
        } catch (err) {
          console.error("Accurate rate fetch failed:", err);
          setLoadingRate(false);
          alert("Unable to fetch accurate rate. Please try again.");
        }
      }, 3000);
    } else {
      // All other API IDs — store all selected rooms and redirect
      try {
        const bookingData = {
          // selectedRate: {
          //   hotelId: hotelsdetail.hotelId,
          //   hotelName: hotelsdetail.hotelName,
          //   roomCategory: primaryRate.roomCategory,
          //   mealPlan: primaryRate.mealPlan,
          //   contractLabel: primaryRate.contractLabel,
          //   nonRefundable: primaryRate.nonRefundable,
          //   rate: primaryRate.totalRate,
          //   rateWithoutMarkup: primaryRate.totalRateWithoutMarkup,
          //   currency: "AED",
          //   cancellationPolicy: hotelsdetail.cancellationPolicies,
          //   roomStatus: primaryRate.roomStatus,
          //   roomRateBasedOnRoomCount: primaryRate.roomRateBasedOnRoomCount,
          //   roomRateBasedOnRoomCount_WithoutMarkup: primaryRate.roomRateBasedOnRoomCount_WithoutMarkup,
          // },
          // Full per-room selections for multi-room booking
          selectedRate: selectedRooms.map((r, i) => ({
            roomNo: i + 1,
            roomCategory: r.selectedRate?.roomCategory,
            mealPlan: r.selectedRate?.mealPlan,
            contractLabel: r.selectedRate?.contractLabel,
            nonRefundable: r.selectedRate?.nonRefundable,
            rate: r.selectedRate?.totalRate,
            rateWithoutMarkup: r.selectedRate?.totalRateWithoutMarkup,
            roomRateBasedOnRoomCount: r.selectedRate?.roomRateBasedOnRoomCount,
            roomRateBasedOnRoomCount_WithoutMarkup: primaryRate.roomRateBasedOnRoomCount_WithoutMarkup,
            roomStatus: r.selectedRate?.roomStatus,
            currency: "AED",
            hotelId: hotelsdetail.hotelId,
            hotelName: hotelsdetail.hotelName,
            cancellationPolicy: hotelsdetail.cancellationPolicies,
          })),
          hotelStaticData: roomData.meta,
          payload: payload,
        };

        console.log("bookingData::", bookingData);
        sessionStorage.setItem("bookingData", JSON.stringify(bookingData));
        window.open("/hotel-booking-page", "_blank");
      } catch (err) {
        console.error("Error preparing booking data:", err);
        alert("Unable to proceed with booking. Please try again.");
      }
    }
  };

  const sampleGallery = [
    "/images/01.png",
    "/images/02.png",
    "/images/03.png",
    "/images/04.jpg",
    "/images/04.png",
    "/images/05.jpg",
    "/images/06.png",
    "/images/07.png",
    "/images/main-slider.jpg",
    "/images/small-img.jpg",
  ];

  const getMealPlanIcon = (mealPlan) => {
    switch (mealPlan.toLowerCase()) {
      case "room only":
        return <FaBed className="text-muted" />;
      case "breakfast":
        return <FaUtensils className="text-warning" />;
      case "full board":
        return <FaUtensils className="text-success" />;
      default:
        return <FaUtensils className="text-primary" />;
    }
  };

  const getRefundStatusBadgeInRoomList = (nonRefundable) => {
    const value = String(nonRefundable).toLowerCase();
    switch (value) {
      case "false":
        return <Badge bg="success">Flexible</Badge>;
      case "true":
        return <Badge bg="danger">Non-Refundable</Badge>;
      default:
        return <Badge bg="secondary">{String(nonRefundable)}</Badge>;
    }
  };

  const getRoomStatusBadge = (roomStatus) => {
    switch (roomStatus) {
      case "On Request":
        return (
          <small>
            {" "}
            This room can be booked{" "}
            <span className="text-dark px-2 py-0 rounded">On Request </span>
          </small>
        );
      case "Available":
        return (
          <small>
            {" "}
            This room is{" "}
            <span className="bg-success text-white px-3 py-0 rounded">
              Available{" "}
            </span>
          </small>
        );
      default:
        return (
          <small>
            {" "}
            This room is Available{" "}

          </small>
        );
    }
  };

  const getRefundStatusBadge = (refundStatus) => {
    // console.log("SELECTED refundStatus:::", refundStatus);
    switch (refundStatus) {
      case "FLEXIBLE":
        return <Badge bg="success">Flexible</Badge>;
      case "NON REFUNDABLE":
        return <Badge bg="danger">Non-Refundable</Badge>;
      default:
        return <Badge bg="secondary">{refundStatus}</Badge>;
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
    }).format(price);
  };

  const renderStars = (rating) => {
    return Array.from({ length: rating }, (_, i) => (
      <FaStar key={i} className="text-warning" />
    ));
  };

  // Second useEffect to fetch policy details when roomData is available
  useEffect(() => {
    const fetchInhousePolicyDetails = async () => {
      if (!roomData || !roomData.hotels || roomData.hotels.length === 0) {
        return;
      }

      // Only call the API if apiId is equal to 1
      if (roomData.payload?.apiId !== 1) {
        return;
      }

      try {
        const hotelsdetail = roomData.hotels[0];
        const response = await axiosInstance.get(
          `/api/hotels/${hotelsdetail.hotelId}/policies`,
        );
        console.log("response for policy list:", response.data);
        setPolicyList(response.data);
      } catch (error) {
        // console.log("error for policy list :", error);
      }
    };

    fetchInhousePolicyDetails();
  }, [roomData]);

  if (loading) {
    return (
      <div className="d-flex" style={{ minHeight: "100vh" }}>
        <Sidebar />
        <div className="flex-grow-1 d-flex flex-column">
          <TopBar style={{ marginLeft: "-200px" }} />

          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <div className="text-center results-loader">
              <div className="loader-ring">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
              <h4 className="text-primary fw-bold mt-3 mb-1">
                Fetching Best Room Options...
              </h4>
              <p className="text-muted small mb-0">
                Comparing rates across providers
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="d-flex" style={{ minHeight: "100vh" }}>
        <Sidebar />
        <div className="flex-grow-1 d-flex flex-column">
          <TopBar style={{ marginLeft: "-200px" }} />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center p-3">
            <div className="w-100" style={{ maxWidth: 480 }}>
              <Alert variant="danger" className="mb-3">
                <Alert.Heading>Error</Alert.Heading>
                <p className="mb-0">{error}</p>
              </Alert>
              <Button
                variant="primary"
                onClick={() => navigate("/new-booking/hotel")}
              >
                Back to Search
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!roomData || !roomData.hotels || roomData.hotels.length === 0) {
    return (
      <div className="d-flex" style={{ minHeight: "100vh" }}>
        <Sidebar />
        <div className="flex-grow-1 d-flex flex-column">
          <TopBar style={{ marginLeft: "-200px" }} />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center p-3">
            <Alert variant="info">
              <Alert.Heading>No Rooms Available</Alert.Heading>
              <p>No room data found for this hotel.</p>
              <Button
                variant="primary"
                onClick={() => navigate("/new-booking/hotel")}
              >
                Back to Search
              </Button>
            </Alert>
          </main>
        </div>
      </div>
    );
  }

  // console.log("roomdata ::::::::::::::::::", roomData);
  const hotel = roomData.hotels[0];
  const payload = roomData.payload || {};
  // console.log("selectedRate before bookingmodal:::", selectedRate);

  return (
    <div className="room-list-container">
      <div className="main-content">
        <TopBar className="toproomlist" />
        <Sidebar />
        <main
          className="content-wrapper"
        >
          <div className="container-fluid" style={{ paddingTop: "10px" }}>
            {/* Loader Modal */}
            <Modal
              show={loadingRate}
              centered
              backdrop="static"
              keyboard={false}
            >
              <Modal.Body className="text-center p-4">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3 mb-0 fw-bold text-primary">
                  Fetching accurate rate...
                </p>
              </Modal.Body>
            </Modal>
            {/* No Availability Modal */}
            <Modal
              show={showUnavailableModal}
              onHide={() => {
                setShowUnavailableModal(false);
                navigate("/new-booking/hotel");
              }}
              centered
              backdrop="static"
              keyboard={false}
            >
              <Modal.Header closeButton>
                <Modal.Title>No Rooms Available</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <p className="mb-0">
                  Rooms not available for the selected dates.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="primary"
                  onClick={() => {
                    setShowUnavailableModal(false);
                    navigate("/new-booking/hotel");
                  }}
                >
                  Back to Search
                </Button>
              </Modal.Footer>
            </Modal>
            {/* Hotel Header */}
            <Card className="hotel-header-card mb-4">
              <Card.Body className="p-4">
                <Row>
                  <Col md={8}>
                    <div className="d-flex align-items-start gap-3">
                      <div className="hotel-icon">
                        <FaHotel size={40} className="text-primary" />
                      </div>
                      <div className="hotel-info">
                        <h2 className="hotel-name mb-2">{hotel.hotelName}</h2>
                        <div className="d-flex align-items-center gap-3 mb-2">
                          <div className="star-rating">
                            {renderStars(hotel.starRating)}
                          </div>
                          <Badge bg="primary">{hotel.propertyType}</Badge>
                          <Badge bg="info">{hotel.chain}</Badge>
                        </div>
                        <div className="hotel-details">
                          <p className="mb-1">
                            <FaMapMarkerAlt className="text-muted me-2" />
                            {hotel.hotelAddress}
                          </p>
                          <p className="mb-0">
                            <FaPhone className="text-muted me-2" />
                            {hotel.hotelPhoneNumber}
                          </p>
                          <div className="mt-2">
                            <small className="text-muted">
                              <strong>Please note:</strong>{" "}
                              <p className="someproperties">
                                {" "}
                                Some properties may collect additional charges
                                such as city tax, resort fees, or security
                                deposits during check-in. Policies such as
                                check-in time, child accommodation, and
                                cancellation rules can vary by room and
                                provider.
                              </p>
                            </small>
                          </div>
                        </div>
                        <div className="mt-3">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => navigate(-1)}
                          >
                            Back to Search
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Col>
                  {console.log("hotel::", hotel)}
                  <Col md={4}>
                    <Card className="booking-summary">
                      <Card.Body className="p-3">
                        <h6 className="mb-3">Booking Summary</h6>
                        <div className="booking-details">
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaCalendarAlt className="text-muted me-2" />
                              Check-in:
                            </span>
                            <span className="fw-semibold">
                              {payload.checkInDate || hotel.checkInDate}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaCalendarAlt className="text-muted me-2" />
                              Check-out:
                            </span>
                            <span className="fw-semibold">
                              {payload.checkOutDate || hotel.checkOutDate}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaUsers className="text-muted me-2" />
                              Guests:
                            </span>
                            <span className="fw-semibold">
                              {hotel.guestBreakdown}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span>
                              <FaBed className="text-muted me-2" />
                              Rooms:
                            </span>
                            <span className="fw-semibold">
                              {hotel.numberOfRooms}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span>
                              <FaGlobe className="text-muted me-2" />
                              Nationality:
                            </span>
                            <span className="fw-semibold">
                              {hotel.nationality}
                            </span>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* ===== Per-Room Accordion Section ===== */}
            <div className="room-categories-section">
              <h4 className="mb-3">Select Rooms</h4>
              <p className="text-muted small mb-4">
                Please select one rate for each room. You can choose different meal plans per room.
              </p>

              {/* Outer accordion — one item per requested room */}
              <Accordion
                activeKey={activeOuterAccordion}
                onSelect={(key) => setActiveOuterAccordion(key)}
              >
                {selectedRooms.map((roomSlot, roomIndex) => {
                  const roomEventKey = `room-${roomIndex}`;
                  const roomLabel = `Room ${roomIndex + 1}`;
                  const roomSelection = selectedRooms[roomIndex]?.selectedRate;

                  return (
                    <Accordion.Item
                      key={roomEventKey}
                      eventKey={roomEventKey}
                      className="room-category-item mb-3"
                    >
                      <Accordion.Header className="room-category-header">
                        <div className="d-flex align-items-center justify-content-between w-100 pe-3">
                          <div className="d-flex align-items-center gap-3">
                            <FaBed className="text-primary" />
                            <span className="fw-bold">{roomLabel}</span>
                            {roomSelection ? (
                              <Badge bg="success" className="ms-2">
                                Selected: {roomSelection.mealPlan} —{" "}
                                {formatPrice(roomSelection.roomRateBasedOnRoomCount || roomSelection.totalRate || 0)}
                              </Badge>
                            ) : (
                              <Badge bg="warning" text="dark" className="ms-2">
                                No selection yet
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill"
                            style={{ fontWeight: "600", fontSize: "0.85rem" }}
                          >
                            {activeOuterAccordion === roomEventKey ? "Hide Details/Book" : "View Details/Book"}
                            <FaChevronDown
                              className="accordion-arrow"
                              style={{
                                transform: activeOuterAccordion === roomEventKey ? "rotate(180deg)" : "none",
                                transition: "transform 0.3s ease"
                              }}
                            />
                          </Button>
                        </div>
                      </Accordion.Header>

                      <Accordion.Body className="p-3">
                        <Accordion>
                          {hotel.roomCategories.map((category, catIndex) => {
                            const innerKey = `${roomIndex}-${catIndex}`;
                            const minRate = Math.min(
                              ...category.availableRates.map(
                                (r) => r.roomRateBasedOnRoomCount || r.totalRate || 0
                              )
                            );

                            return (
                              <Accordion.Item
                                key={innerKey}
                                eventKey={innerKey}
                                className="room-category-item mb-3"
                              >
                                {/* Inner header — matches original design */}
                                <Accordion.Header className="room-category-header">
                                  <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                                    <div className="room-category-info">
                                      <h5 className="mb-1">{category.roomCategory}</h5>
                                      <p className="mb-0 text-muted small">
                                        {category.baseRoomType}
                                      </p>
                                    </div>
                                    <div className="d-flex align-items-center gap-3">
                                      <div className="room-category-price text-end me-3">
                                        <div className="price-range">From {formatPrice(minRate)}</div>
                                        <div className="rates-count small text-muted">
                                          {category.availableRates.length} rate
                                          {category.availableRates.length !== 1 ? "s" : ""} available
                                        </div>
                                      </div>
                                      <Button
                                        variant="outline-primary"
                                        size="sm"
                                        className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill"
                                        style={{ fontWeight: "600", fontSize: "0.85rem" }}
                                      >
                                        {/* Since inner is uncontrolled, we'll use a simpler approach or CSS to toggle text if possible, but let's stick to simple arrow text for now as uncontrolled doesn't easily expose state to parent without extra hooks */}
                                        View Details/Book
                                        <FaChevronDown className="accordion-arrow" />
                                      </Button>
                                    </div>
                                  </div>
                                </Accordion.Header>

                                {/* Inner body — rate rows with radio buttons */}
                                <Accordion.Body className="room-rates-section p-3">
                                  <Row className="g-3">
                                    {category.availableRates.map((rate, rateIndex) => {
                                      const radioId = `room${roomIndex}_cat${catIndex}_rate${rateIndex}`;
                                      const isChecked = selectedRooms[roomIndex]?.selectedRate === rate;

                                      return (
                                        <Col md={6} key={rateIndex}>
                                          <Card
                                            className={`rate-selection-card h-100 ${isChecked ? "selected-rate-card" : ""}`}
                                            onClick={() => handleRateSelect(roomIndex, rate)}
                                            style={{ cursor: "pointer", border: "1px solid #e0e0e0", borderRadius: "12px" }}
                                          >
                                            <Card.Body className="p-4 d-flex flex-column">
                                              <div className="d-flex justify-content-between align-items-start mb-3">
                                                <div className="rate-info-main">
                                                  <div className="d-flex align-items-center gap-2 mb-2">
                                                    <FaBed className="text-secondary" />
                                                    <span className="fw-bold fs-5">{rate.mealPlan}</span>
                                                    {getRefundStatusBadgeInRoomList(rate.nonRefundable)}
                                                  </div>
                                                  <p className="text-muted small mb-0">This room can be booked On Request</p>
                                                </div>
                                                <input
                                                  type="radio"
                                                  name={`roomSelection_${roomIndex}`}
                                                  id={radioId}
                                                  checked={isChecked}
                                                  onChange={() => handleRateSelect(roomIndex, rate)}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="rate-radio-input"
                                                  style={{ transform: "scale(1.2)" }}
                                                />
                                              </div>

                                              <div className="rate-price-section mt-auto pt-4">
                                                <div className="price-display mb-2">
                                                  <span className="text-success fw-bold fs-3">
                                                    {formatPrice(rate.roomRateBasedOnRoomCount)}
                                                  </span>
                                                  <div className="text-muted extra-small">
                                                    {formatPrice(rate.totalRate || 0)} × {rate.numberOfRooms} rooms
                                                  </div>
                                                  <div className="price-label small text-muted">per night</div>
                                                </div>

                                                <div className="contract-preview mb-3 small text-muted mt-3">
                                                  <FaInfoCircle className="me-1" />
                                                  {rate.contractLabel}
                                                </div>

                                                <Button
                                                  variant={isChecked ? "primary" : "outline-primary"}
                                                  className="w-100 py-2 fw-bold"
                                                  style={{ borderRadius: "8px" }}
                                                >
                                                  {isChecked ? "Selected" : "View Details / Select"}
                                                </Button>
                                              </div>
                                            </Card.Body>
                                          </Card>
                                        </Col>
                                      );
                                    })}
                                  </Row>
                                </Accordion.Body>
                              </Accordion.Item>
                            );
                          })}
                        </Accordion>
                      </Accordion.Body>
                    </Accordion.Item>
                  );
                })}
              </Accordion>

              {/* Book button — shown once all rooms are selected */}
              <div className="mt-4 text-end">
                {allRoomsSelected ? (
                  <Button
                    variant="success"
                    size="lg"
                    className="px-5"
                    onClick={handleBooking}
                  >
                    <FaMoneyBillWave className="me-2" />
                    Book Selected Rooms ({selectedRooms.length})
                  </Button>
                ) : (
                  <div className="text-muted small">
                    Please select a rate for each room to continue.
                  </div>
                )}
              </div>
            </div>

            {/* Additional Information Section */}
            <div className="mt-4">
              <Card className="mb-4">
                <Card.Header as="h6">Additional Information</Card.Header>
                <Card.Body>
                  {payload.apiId === 1 && policyList && policyList.policies ? (
                    <div className="policy-details">
                      {/* Child Policy */}
                      {policyList.policies?.childPolicy &&
                        policyList.policies.childPolicy.length > 0 && (
                          <div className="mb-3">
                            <h6 className="text-primary mb-2">
                              <FaUsers className="me-2" />
                              Child Policy
                            </h6>
                            {policyList.policies.childPolicy.map(
                              (policy, index) => (
                                <p key={index} className="mb-2 text-muted">
                                  {policy.policyText}
                                </p>
                              ),
                            )}
                          </div>
                        )}
                    </div>
                  ) : (
                    <ul className="mb-0 text-muted">
                      <li>
                        Mandatory gala dinner fees may apply on certain dates.
                        Please contact the hotel directly for more information.
                      </li>
                      <li>
                        Additional taxes or resort fees may be collected at the
                        property during check-in.
                      </li>
                      <li>
                        Special requests are subject to availability and may
                        incur additional charges.
                      </li>
                      <li>
                        Photo identification and a credit card or cash deposit
                        may be required at check-in for incidental charges.
                      </li>
                    </ul>
                  )}
                </Card.Body>
              </Card>

              <Card className="mb-4">
                <Card.Header as="h6">Policies</Card.Header>
                <Card.Body>
                  {payload.apiId === 1 && policyList && policyList.policies ? (
                    <div className="policies-dynamic">
                      {/* Cancellation Policy */}
                      {policyList.policies?.cancellationPolicy &&
                        policyList.policies.cancellationPolicy.length > 0 && (
                          <div className="mb-3">
                            <h6 className="text-danger mb-2">
                              <FaTimesCircle className="me-2" />
                              Cancellation Policy
                            </h6>
                            {policyList.policies.cancellationPolicy.map(
                              (policy, index) => (
                                <div key={index} className="policy-item mb-2">
                                  <p className="text-muted mb-1">
                                    {policy.policyText}
                                  </p>
                                  <small
                                    className="text-muted"
                                    style={{
                                      fontWeight: "400",
                                      fontSize: "0.99rem",
                                    }}
                                  >
                                    Valid:{" "}
                                    {new Date(
                                      policy.fromDate,
                                    ).toLocaleDateString()}{" "}
                                    -{" "}
                                    {new Date(
                                      policy.toDate,
                                    ).toLocaleDateString()}
                                  </small>
                                </div>
                              ),
                            )}
                          </div>
                        )}

                      {/* Amendment Policy */}
                      {policyList.policies?.amendmentPolicy &&
                        policyList.policies.amendmentPolicy.length > 0 && (
                          <div className="mb-3">
                            <h6 className="text-warning mb-2">
                              <FaInfoCircle className="me-2" />
                              Amendment Policy
                            </h6>
                            {policyList.policies.amendmentPolicy.map(
                              (policy, index) => (
                                <div key={index} className="policy-item mb-2">
                                  <p className="text-muted mb-1">
                                    {policy.policyText}
                                  </p>
                                  <small
                                    style={{
                                      fontWeight: "400",
                                      fontSize: "0.99rem",
                                    }}
                                    className="text-muted"
                                  >
                                    Valid:{" "}
                                    {new Date(
                                      policy.fromDate,
                                    ).toLocaleDateString()}{" "}
                                    -{" "}
                                    {new Date(
                                      policy.toDate,
                                    ).toLocaleDateString()}
                                  </small>
                                </div>
                              ),
                            )}
                          </div>
                        )}

                      {/* General Policies */}
                      <Row className="g-3 mt-3">
                        <Col md={6}>
                          <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                            <span className="text-muted">Check-in</span>
                            <span className="fw-semibold">After 14:00</span>
                          </div>
                          <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                            <span className="text-muted">Check-out</span>
                            <span className="fw-semibold">Before 12:00</span>
                          </div>
                        </Col>
                        <Col md={6}>
                          <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                            <span className="text-muted">Deposit</span>
                            <span className="fw-semibold">May be required</span>
                          </div>
                          <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                            <span className="text-muted">Additional Bed</span>
                            <span className="fw-semibold">
                              Subject to availability
                            </span>
                          </div>
                        </Col>
                      </Row>
                    </div>
                  ) : (
                    <Row className="g-3">
                      <Col md={6}>
                        <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                          <span className="text-muted">Check-in</span>
                          <span className="fw-semibold">After 14:00</span>
                        </div>
                        <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                          <span className="text-muted">Check-out</span>
                          <span className="fw-semibold">Before 12:00</span>
                        </div>
                        <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                          <span className="text-muted">Children</span>
                          <span className="fw-semibold">
                            Policies vary by room
                          </span>
                        </div>
                      </Col>
                      <Col md={6}>
                        <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                          <span className="text-muted">Deposit</span>
                          <span className="fw-semibold">May be required</span>
                        </div>
                        <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                          <span className="text-muted">Additional Bed</span>
                          <span className="fw-semibold">
                            Subject to availability
                          </span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span className="text-muted">Cancellation</span>
                          <span className="fw-semibold">
                            See rate conditions
                          </span>
                        </div>
                      </Col>
                    </Row>
                  )}
                </Card.Body>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Booking Modal */}
      <Modal
        show={showBookingModal}
        onHide={() => setShowBookingModal(false)}
        size="xl"
        aria-labelledby="room-detail-modal"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title id="room-detail-modal">Room Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRate && (
            <Row className="g-4">
              <Col md={6}>
                <div
                  id="roomGallery"
                  className="carousel slide"
                  data-bs-ride="carousel"
                >
                  <div className="carousel-inner rounded">
                    {sampleGallery.map((img, idx) => (
                      <div
                        key={idx}
                        className={`carousel-item ${idx === 0 ? "active" : ""}`}
                      >
                        <img src={img} className="d-block w-100" alt="Room" />
                      </div>
                    ))}
                  </div>
                  <button
                    className="carousel-control-prev"
                    type="button"
                    data-bs-target="#roomGallery"
                    data-bs-slide="prev"
                    aria-label="Previous image"
                  >
                    <span
                      className="carousel-control-prev-icon"
                      aria-hidden="true"
                    ></span>
                    <span className="visually-hidden">Previous</span>
                  </button>
                  <button
                    className="carousel-control-next"
                    type="button"
                    data-bs-target="#roomGallery"
                    data-bs-slide="next"
                    aria-label="Next image"
                  >
                    <span
                      className="carousel-control-next-icon"
                      aria-hidden="true"
                    ></span>
                    <span className="visually-hidden">Next</span>
                  </button>
                </div>
              </Col>
              <Col md={6}>
                <h5 className="mb-2">{selectedRate.roomCategory}</h5>
                <p className="text-muted">{selectedRate.roomTypeDescription}</p>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <Badge bg="secondary">High speed internet</Badge>
                  <Badge bg="secondary">Private bathroom</Badge>
                  <Badge bg="secondary">Kitchen</Badge>
                  <Badge bg="secondary">TV</Badge>
                </div>
                <div className="booking-details-modal">
                  <div className="d-flex justify-content-between mb-2">
                    <span>Meal Plan:</span>
                    <span className="fw-semibold">{selectedRate.mealPlan}</span>
                  </div>
                  {activeUserRole === "ADMIN" && (
                    <div className="d-flex justify-content-between mb-2">
                      <span>Selling Price:</span>
                      <span className="fw-semibold text-primary">
                        {formatPrice(selectedRate.rate)}
                      </span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mb-2">
                    <span>Total Rate:</span>
                    <span className="fw-semibold text-primary">
                      {formatPrice(selectedRate.rate)}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span>Refund Status:</span>
                    <span>
                      {getRefundStatusBadge(
                        selectedRate.nonRefundable === "Y"
                          ? "NON REFUNDABLE"
                          : "FLEXIBLE",
                      )}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>Contract:</span>
                    <span className="small text-muted">
                      {selectedRate.contractLabel}
                    </span>
                  </div>
                </div>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowBookingModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="btn-confirm-booking"
            size="sm"
            onClick={() => {
              try {
                const { payload } = roomData;
                sessionStorage.setItem(
                  "bookingData",
                  JSON.stringify({ selectedRate, hotelStaticData, payload }),
                );
              } catch (e) {
                console.error("Error storing bookingData:", e);
              }
              window.open("/api-booking-page-hotels", "_blank");
            }}
          >
            Confirm Booking
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ExternalApiRoomList;
