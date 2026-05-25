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


function AccordionToggleButton({ eventKey, isActive }) {
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

const RoomList = () => {
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRate, setSelectedRate] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [hotelStaticData, setHotelStaticData] = useState(null);
  const [searchPayload, setSearchPayload] = useState(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [policyList, setPolicyList] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [agentBalance, setAgentBalance] = useState(null);

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

        // ── 24 Hour Check-In rate uplift ────────────────────────────────
        // When the search came in with is24HourCheckin=true, apply the
        // configured percentage on every per-rate amount. We multiply the
        // public-facing fields the FE / booking flow consume:
        //   totalRate, rate, roomRateBasedOnRoomCount, recommendedRetailPrice
        // (the *_WithoutMarkup mirrors are left untouched so accounting can
        // still reconstruct the base.) When the flag is false / absent, the
        // helper is a no-op and the original rates flow through unchanged.
        const upliftPct =
          payload?.is24HourCheckin === true
            ? Number(payload?.twentyFourHourPercentage || 0)
            : 0;
        const uplift = (n) =>
          n == null ? n : +(Number(n) * (1 + upliftPct / 100)).toFixed(2);
        const applyMarkupToRate = (r) =>
          upliftPct > 0
            ? {
                ...r,
                totalRate: uplift(r.totalRate),
                rate: uplift(r.rate),
                roomRateBasedOnRoomCount: uplift(r.roomRateBasedOnRoomCount),
                recommendedRetailPrice: uplift(r.recommendedRetailPrice),
                _twentyFourHourMarkupApplied: upliftPct, // diagnostic flag
              }
            : r;

        const enriched = {
          ...res.data,
          hotels: (res.data.hotels || []).map((h) => ({
            ...h,
            // Sort availableRates within each category by totalRate asc.
            // Uplift first (so sort uses the marked-up rate) then sort.
            roomCategories: (h.roomCategories || []).map((c) => ({
              ...c,
              availableRates: (c.availableRates || [])
                .slice()
                .map(applyMarkupToRate)
                .sort((a, b) => (a.totalRate || 0) - (b.totalRate || 0)),
            })),
          })),
          meta: meta || {},
          payload,
        };

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

  const handleBooking = async (rate) => {
    const { payload, hotels } = roomData;
    const hotelsdetail = hotels[0];

    console.log("hotelsdetail::", hotelsdetail);
    // console.log("rate::", rate);

    // For API IDs 12 and 15, fetch accurate rates
    if (payload.apiId === 12 || payload.apiId === 15) {
      setLoadingRate(true);

      setTimeout(async () => {
        try {
          // Build dynamic request body
          let priceCheckReq = {
            searchCriteria: {
              roomConfiguration: {
                room: {
                  adult: {
                    age: payload.rooms[0].adultAges[0].toString(),
                  },
                  roomTypeCode: rate.roomTypeCode,
                  mealPlanCode: rate.mealPlanCode,
                  contractTokenId: rate.contractTokenId || "0",
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

          // console.log("priceCheckReq ::", priceCheckReq);

          // Choose endpoint dynamically
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
          // console.log("Accurate room details::", rooms);

          // Map all rooms to a structured object
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
      // For all other API IDs (including 1), redirect directly to booking page
      try {
        // Create booking data from the current rate
        const bookingData = {
          selectedRate: {
            hotelId: hotelsdetail.hotelId,
            hotelName: hotelsdetail.hotelName,
            roomCategory: rate.roomCategory,
            mealPlan: rate.mealPlan,
            contractLabel: rate.contractLabel,
            nonRefundable: rate.nonRefundable,
            rate: rate.totalRate,
            rateWithoutMarkup: rate.totalRateWithoutMarkup,
            currency: "AED",
            cancellationPolicy: hotelsdetail.cancellationPolicies,
            roomStatus: rate.roomStatus,
            roomRateBasedOnRoomCount: rate.roomRateBasedOnRoomCount,
            roomRateBasedOnRoomCount_WithoutMarkup: rate.roomRateBasedOnRoomCount_WithoutMarkup,
          },
          hotelStaticData: roomData.meta,
          payload: payload,
        };

        // console.log("Booking data for direct redirect:", bookingData);

        // Store booking data in sessionStorage
        sessionStorage.setItem("bookingData", JSON.stringify(bookingData));

        // Redirect to booking page

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
            This room can be booked{" "}
            <Badge bg="warning" text="dark" className="px-2 py-1 ms-1 fw-bold border border-warning shadow-sm">
              On Request
            </Badge>
          </small>
        );
      case "Available":
        return (
          // <small>
          //   {" "}
           
          //   <span className="bg-success text-white px-3 py-0 rounded">
          //     Available{" "}
          //   </span>
          // </small>
          <small>
  <span style={{ color: "#198754", fontWeight: "700" }}>
    Available
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

  // Fetch the agent's available credit balance once roomData/payload is loaded
  useEffect(() => {
    const aId = roomData?.payload?.agentId;
    if (!aId) {
      setAgentBalance(null);
      return;
    }
    let cancelled = false;
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${aId}`)
      .then((res) => {
        if (!cancelled) setAgentBalance(res?.data?.availableCreditLimit ?? null);
      })
      .catch(() => {
        if (!cancelled) setAgentBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [roomData]);

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
     <div className="min-vh-100 bg-light d-flex flex-column">
  {/* TopBar ALWAYS on top */}
  <TopBar />

  {/* Sidebar + Content */}
  <div className="d-flex flex-grow-1">
    <Sidebar />

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
     <div className="min-vh-100 bg-light d-flex flex-column">
  {/* TopBar always full width */}
  <TopBar />

  {/* Sidebar + content */}
  <div className="d-flex flex-grow-1">
    <Sidebar />

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
      <div className="min-vh-100 bg-light d-flex flex-column">
  {/* TopBar – always full width */}
  <TopBar />

  {/* Sidebar + Content */}
  <div className="d-flex flex-grow-1">
    <Sidebar />

    <main className="flex-grow-1 d-flex justify-content-center align-items-center p-3">
      <Alert variant="info" className="text-center" style={{ maxWidth: 480 }}>
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
    <div className= "min-vh-100 bg-light d-flex flex-column room-list-container">
      <TopBar />
      <div className="main-content">
        
        <Sidebar />
        <main
          className="content-wrapper"
        >
          <div className="container-fluid" style={{ paddingTop: "10px" }}>
            {/* Agent available balance — top-right indicator */}
            {agentBalance != null && (
              <div
                className="d-flex justify-content-end mb-2"
                style={{ fontSize: "0.95rem" }}
              >
                <span className="fw-bold" style={{ color: "#dc3545" }}>
                  Available Balance: {Number(agentBalance).toFixed(2)}
                </span>
              </div>
            )}
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

            {/* Room Categories Accordion */}
            <div className="room-categories-section">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="mb-0">Available Room Categories</h4>
                <div className="btn-group shadow-sm gap-1" role="group">
                  <Button
                    variant={viewMode === "grid" ? "primary" : "outline-primary"}
                    onClick={() => setViewMode("grid")}
                    className="d-flex align-items-center gap-2"
                    size="sm"
                  >
                    <span className="fs-5" style={{ lineHeight: 1 }}>⊞</span> 
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "primary" : "outline-primary"}
                    onClick={() => setViewMode("list")}
                    className="d-flex align-items-center gap-2"
                    size="sm"
                  >
                    <span className="fs-5" style={{ lineHeight: 1 }}>☰</span> 
                  </Button>
                </div>
              </div>

              <Accordion
                activeKey={activeAccordion}
                onSelect={(key) => setActiveAccordion(key)}
              >
                {hotel.roomCategories.map((category, index) => {
                  const eventKey = index.toString();
                  const isActive = activeAccordion === eventKey;

                  return (
                    <Accordion.Item
                      key={eventKey}
                      eventKey={eventKey}
                      className="room-category-item"
                    >
                      {/* ✅ Header is NOT clickable */}
                      <Accordion.Header
                        as="div"
                        className="room-category-header"
                      >
                        <div className="d-flex justify-content-between align-items-center w-100">
                          <div className="room-category-info">
                            <h5 className="mb-1">{category.roomCategory}</h5>
                            <p className="mb-0 text-muted small">
                              {category.baseRoomType}
                            </p>
                          </div>

                          <div className="d-flex align-items-center gap-3">
                            <div className="room-category-price text-end">
                              <div className="price-range">
                                From{" "}
                                {formatPrice(
                                  Math.min(
                                    ...category.availableRates.map(
                                      (rate) => rate.rate,
                                    ),
                                  ),
                                )}
                              </div>
                              <div className="rates-count small text-muted">
                                {category.availableRates.length} rate
                                {category.availableRates.length !== 1
                                  ? "s"
                                  : ""}{" "}
                                available
                              </div>
                            </div>

                            {/* ✅ Button toggle */}
                            <AccordionToggleButton
                              eventKey={eventKey}
                              isActive={isActive}
                            />
                          </div>
                        </div>
                      </Accordion.Header>

                      <Accordion.Body className="room-rates-section">
                        <Row>
                          {category.availableRates.map((rate, rateIndex) => (
                            <Col key={rateIndex} lg={viewMode === "grid" ? 6 : 12} xl={viewMode === "grid" ? 4 : 12} className="mb-2">
                              <Card className="rate-card h-100 shadow-sm">
                                {viewMode === "grid" ? (
                                  <Card.Body className="p-3 pb-2 d-flex flex-column gap-2">
                                    {/* Header */}
                                    <div className="rate-header d-flex justify-content-between align-items-start">
                                      <div>
                                        <div className="d-flex align-items-center gap-2">
                                          {getMealPlanIcon(rate.mealPlan)}
                                          <span className="fw-semibold small">
                                            {rate.mealPlan}
                                          </span>
                                        </div>

                                        <div className="mt-1">
                                          {getRoomStatusBadge(rate.roomStatus)}
                                        </div>
                                      </div>

                                      {getRefundStatusBadgeInRoomList(
                                        rate.nonRefundable,
                                      )}
                                    </div>

                                    {/* Pricing */}
                                    <div className="rate-pricing text-center py-2">
                                      <div className="current-price">
                                        {formatPrice(rate.roomRateBasedOnRoomCount)}
                                      </div>

                                      {/* {rate.recommendedRetailPrice >
                                        rate.totalRate && (
                                        <div className="original-price text-decoration-line-through">
                                          {formatPrice(
                                            rate.recommendedRetailPrice,
                                          )}
                                        </div>
                                      )} */}

                                      <div className="indivial-price-per-room-noofroom">
                                        <div className="text-muted small">
                                          {formatPrice(rate.totalRate || 0)} ×{" "}
                                          {rate.numberOfRooms || 1} rooms
                                        </div>
                                      </div>
                                      <div className="price-per-night small text-muted">
                                        per night
                                      </div>
                                    </div>

                                    {/* Features */}
                                    <div className="rate-features small">
                                      <div className="feature-item">
                                        <FaInfoCircle className="me-2 text-muted" />
                                        {rate.contractLabel}
                                      </div>

                                      {rate.cancellationPolicies?.length > 0 && (
                                        <div className="feature-item">
                                          <FaShieldAlt className="me-2 text-muted" />
                                          {
                                            rate.cancellationPolicies[0]
                                              .policyText
                                          }
                                        </div>
                                      )}
                                    </div>

                                    {/* Button */}
                                    <Button
                                      variant="primary"
                                      className="w-100 book-now-btn mt-1 mb-1"
                                      onClick={() => handleBooking(rate)}
                                    >
                                      <FaMoneyBillWave className="me-2" />
                                      View Details / Select
                                    </Button>
                                  </Card.Body>
                                ) : (
                                  <Card.Body className="p-3 py-2 d-flex flex-row justify-content-between align-items-center gap-3">
                                    <div className="d-flex flex-column flex-grow-1">
                                      <div className="d-flex align-items-center gap-3 mb-2">
                                        <div className="d-flex align-items-center gap-2">
                                          {getMealPlanIcon(rate.mealPlan)}
                                          <span className="fw-semibold">{rate.mealPlan}</span>
                                        </div>
                                        {getRefundStatusBadgeInRoomList(rate.nonRefundable)}
                                        <div className="d-flex align-items-center mb-0">
                                          {getRoomStatusBadge(rate.roomStatus)}
                                        </div>
                                      </div>
                                      <div className="rate-features small text-muted d-flex gap-4">
                                        <div className="feature-item d-flex align-items-center">
                                          <FaInfoCircle className="me-2" />
                                          {rate.contractLabel}
                                        </div>
                                        {rate.cancellationPolicies?.length > 0 && (
                                          <div className="feature-item d-flex align-items-center text-truncate" style={{ maxWidth: '350px' }}>
                                            <FaShieldAlt className="me-2" />
                                            {rate.cancellationPolicies[0].policyText}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="text-end px-4 border-start border-end" style={{ minWidth: '220px' }}>
                                      <div className="fs-5 fw-bold text-primary">
                                        {formatPrice(rate.roomRateBasedOnRoomCount)}
                                      </div>
                                      <div className="text-muted small">
                                        {formatPrice(rate.totalRate || 0)} × {rate.numberOfRooms || 1} rooms
                                      </div>
                                      <div className="small text-muted">
                                        per night
                                      </div>
                                    </div>

                                    <div className="ps-2">
                                      <Button
                                        variant="primary"
                                        className="book-now-btn px-4 py-2"
                                        onClick={() => handleBooking(rate)}
                                        style={{ whiteSpace: 'nowrap' }}
                                      >
                                        <FaMoneyBillWave className="me-2" />
                                        View Details
                                      </Button>
                                    </div>
                                  </Card.Body>
                                )}
                              </Card>
                            </Col>
                          ))}
                        </Row>
                      </Accordion.Body>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
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
                sessionStorage.setItem(
                  "bookingData",
                  JSON.stringify({ selectedRate, hotelStaticData, payload }),
                );
              } catch (e) {
                console.error("Error storing bookingData:", e);
              }
              window.open("/hotel-booking-page", "_blank");
            }}
          >
            Confirm Booking
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default RoomList;
