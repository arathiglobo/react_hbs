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
  Form,
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
import { formatFlexibleDate } from "../utils/dateUtils";

/**
 * Builds the "Valid: <from> - <to>" label for a policy validity period.
 * Returns null when NEITHER date is usable so the caller can hide the line
 * entirely instead of rendering "Invalid Date - Invalid Date". When only one
 * side is usable we still show the range with an "N/A" placeholder.
 */
const renderPolicyValidity = (fromDate, toDate) => {
  const from = formatFlexibleDate(fromDate);
  const to = formatFlexibleDate(toDate);
  if (!from && !to) return null;
  return `Valid: ${from || "N/A"} - ${to || "N/A"}`;
};


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

/**
 * Optional `force24Hour` prop — set by the thin RoomList24Hour
 * wrapper. When true, the per-rate Book Now / Confirm Booking actions
 * navigate to /hotel-booking-page-24hr instead of /hotel-booking-page
 * so the dedicated 24-hour Check-In flow can render its own booking
 * page (and redirect to the 24-hour booking list after success).
 * Defaults to false so the legacy /room-list flow is unchanged.
 */
const RoomList = ({ force24Hour = false } = {}) => {
  const bookingPageRoute = force24Hour
    ? "/hotel-booking-page-24hr"
    : "/hotel-booking-page";
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
  // Filter state
  const [refundFilter, setRefundFilter] = useState({
    refundable: false,
    nonRefundable: false,
  });
  const [roomTypeOptions, setRoomTypeOptions] = useState([]);
  const [selectedRoomTypes, setSelectedRoomTypes] = useState([]);

  // ──────────────────────────────────────────────────────────────────────
  // Multi-room selection (per-room slots).
  //
  // Single-room searches (numRooms === 1) keep using the legacy
  // `selectedRate` flow — the "Book Now" buttons render exactly as before,
  // open the existing modal, and navigate to /hotel-booking-page with the
  // single-room bookingData shape the downstream booking page (and backend)
  // already understand.
  //
  // Multi-room searches (numRooms > 1) instead show a per-room Accordion
  // wrapper. Each room slot has its own copy of the categories list with
  // radios in place of "Book Now"; once every slot has a selection, the
  // user clicks "Continue with Booking" which COMBINES the picks into the
  // same legacy single-`selectedRate` shape (summed totals + concatenated
  // room/meal labels), so neither HotelBookingPage nor the backend has to
  // change. The per-room detail also rides along as `roomBreakdown` (an
  // additive field downstream code currently ignores).
  // ──────────────────────────────────────────────────────────────────────
  const [selectedRooms, setSelectedRooms] = useState([]);

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

        window.open(bookingPageRoute, "_blank");
      } catch (err) {
        console.error("Error preparing booking data:", err);
        alert("Unable to proceed with booking. Please try again.");
      }
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // Multi-room helpers. See note above near `selectedRooms`.
  // ──────────────────────────────────────────────────────────────────────
  const numRooms = (roomData?.payload?.rooms || []).length || 1;
  const isMultiRoom = numRooms > 1;
  const allRoomsSelected =
    selectedRooms.length > 0 &&
    selectedRooms.every((r) => r.selectedRate !== null);

  /** Initialise one selection slot per room as soon as the API result
   *  arrives. We re-init only when the slot count changes so the user's
   *  picks survive filter changes / view-mode toggles. */
  useEffect(() => {
    setSelectedRooms((prev) => {
      if (prev.length === numRooms) return prev;
      return Array.from({ length: numRooms }, (_, i) => ({
        roomNo: i + 1,
        selectedRate: null,
        hotelId: null,
        hotelName: null,
      }));
    });
  }, [numRooms]);

  /** Toggle the rate for one room slot. Clicking an already-selected rate
   *  clears that slot (matches the ExternalApi UX). */
  const handleRateSelect = (roomIndex, rate, hotelId, hotelName) => {
    setSelectedRooms((prev) =>
      prev.map((r, i) => {
        if (i !== roomIndex) return r;
        if (r.selectedRate === rate) {
          return { ...r, selectedRate: null, hotelId: null, hotelName: null };
        }
        return { ...r, selectedRate: rate, hotelId, hotelName };
      }),
    );
  };

  /** Combine the per-room picks into the single-`selectedRate` shape the
   *  existing HotelBookingPage expects, then navigate. Adds an additive
   *  `roomBreakdown` array; downstream code ignores unknown fields, so
   *  nothing else needs to change to support multi-room.
   *
   *  For apiId 12 / 15 we don't enter this path — those flows live behind
   *  the legacy single-room `handleBooking` and aren't in scope for this
   *  change. The "Continue with Booking" CTA is only shown in the
   *  multi-room branch, which is currently used by inhouse (apiId 1)
   *  searches. */
  const handleProceedBooking = () => {
    if (!allRoomsSelected || !roomData) return;
    try {
      const { payload, hotels, meta } = roomData;
      const hotelsdetail = hotels?.[0];
      if (!hotelsdetail) {
        alert("Hotel context missing. Please refresh and try again.");
        return;
      }
      const primary = selectedRooms[0].selectedRate;
      const sum = (key) =>
        selectedRooms.reduce(
          (acc, r) => acc + (Number(r.selectedRate?.[key]) || 0),
          0,
        );

      const combinedSelectedRate = {
        hotelId: hotelsdetail.hotelId,
        hotelName: hotelsdetail.hotelName,
        // Concatenated labels so the booking summary shows e.g.
        // "Deluxe + Suite" / "Breakfast + Half Board" without needing
        // any per-room rendering on the booking page.
        roomCategory: selectedRooms
          .map((r) => r.selectedRate?.roomCategory)
          .filter(Boolean)
          .join(" + "),
        mealPlan: selectedRooms
          .map((r) => r.selectedRate?.mealPlan)
          .filter(Boolean)
          .join(" + "),
        contractLabel: primary.contractLabel,
        nonRefundable: primary.nonRefundable,
        rate: sum("totalRate"),
        rateWithoutMarkup: sum("totalRateWithoutMarkup"),
        currency: "AED",
        cancellationPolicy: hotelsdetail.cancellationPolicies,
        roomStatus: primary.roomStatus,
        // IMPORTANT: each rate's `roomRateBasedOnRoomCount` is already
        // (totalRate × numberOfRooms) for the WHOLE search (e.g. 214 × 2
        // = 428 when the user searched for 2 rooms). Summing that across
        // 2 selected slots would give 856 — 2× the real total. The
        // correct multi-room booking total is sum(totalRate) — one
        // per-room rate per slot, summed across slots. Single-room
        // searches keep the original semantics because numberOfRooms = 1
        // there, so totalRate === roomRateBasedOnRoomCount.
        roomRateBasedOnRoomCount: sum("totalRate"),
        roomRateBasedOnRoomCount_WithoutMarkup: sum("totalRateWithoutMarkup"),
      };

      const bookingData = {
        selectedRate: combinedSelectedRate,
        // Additive — HotelBookingPage doesn't read this today, but it's
        // here for any future per-room display work that wants the
        // detail without re-deriving it.
        roomBreakdown: selectedRooms.map((r, i) => ({
          roomNo: i + 1,
          roomCategory: r.selectedRate?.roomCategory,
          mealPlan: r.selectedRate?.mealPlan,
          contractLabel: r.selectedRate?.contractLabel,
          nonRefundable: r.selectedRate?.nonRefundable,
          rate: r.selectedRate?.totalRate,
          rateWithoutMarkup: r.selectedRate?.totalRateWithoutMarkup,
          roomRateBasedOnRoomCount: r.selectedRate?.roomRateBasedOnRoomCount,
          roomRateBasedOnRoomCount_WithoutMarkup:
            r.selectedRate?.roomRateBasedOnRoomCount_WithoutMarkup,
          roomStatus: r.selectedRate?.roomStatus,
        })),
        hotelStaticData: meta,
        payload,
      };

      sessionStorage.setItem("bookingData", JSON.stringify(bookingData));
      window.open(bookingPageRoute, "_blank");
    } catch (err) {
      console.error("Error preparing multi-room bookingData:", err);
      alert("Unable to proceed with booking. Please try again.");
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

  // Fetch room types for the filter sidebar
  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get("/api/roomType?page=0&limit=10")
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.content)
          ? res.data.content
          : [];
        setRoomTypeOptions(list);
      })
      .catch(() => {
        if (!cancelled) setRoomTypeOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleRoomType = (name) => {
    setSelectedRoomTypes((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const matchesFilters = (rate) => {
    const isNonRefundable =
      String(rate.nonRefundable).toLowerCase() === "true";
    if (refundFilter.refundable && refundFilter.nonRefundable) {
      // both checked → no narrowing on refundability
    } else if (refundFilter.refundable && isNonRefundable) {
      return false;
    } else if (refundFilter.nonRefundable && !isNonRefundable) {
      return false;
    }
    if (selectedRoomTypes.length > 0) {
      const mp = String(rate.mealPlan || "").toLowerCase();
      const hit = selectedRoomTypes.some(
        (name) => name && mp === String(name).toLowerCase(),
      );
      if (!hit) return false;
    }
    return true;
  };

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
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main
          className="content-wrapper flex-grow-1"
          style={{ minWidth: 0, overflowX: "hidden" }}
        >
          <div className="container-fluid" style={{ paddingTop: "10px" }}>
            {/* Top toolbar: Back to Search + agent balance */}
            <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => navigate("/new-booking/hotel")}
                className="back-to-search-btn"
              >
                ← Back to Search
              </Button>
              {agentBalance != null && (
                <span
                  className="fw-bold"
                  style={{ color: "#dc3545", fontSize: "0.95rem" }}
                >
                  Available Balance: {Number(agentBalance).toFixed(2)}
                </span>
              )}
            </div>
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
                          <div className="mb-2">
                            <div className="d-flex justify-content-between">
                              <span>
                                <FaUsers className="text-muted me-2" />
                                Guests:
                              </span>
                              {Array.isArray(payload.rooms) &&
                                payload.rooms.length <= 1 && (
                                  <span className="fw-semibold">
                                    {hotel.guestBreakdown}
                                  </span>
                                )}
                            </div>
                            {Array.isArray(payload.rooms) &&
                              payload.rooms.length > 1 && (
                                <div className="mt-1 ps-4 guest-breakdown-list">
                                  {payload.rooms.map((r, i) => {
                                    const a = r.adults || 0;
                                    const c = r.children || 0;
                                    const parts = [];
                                    if (a) parts.push(`${a} adult${a > 1 ? "s" : ""}`);
                                    if (c) parts.push(`${c} child${c > 1 ? "ren" : ""}`);
                                    return (
                                      <div
                                        key={i}
                                        className="d-flex justify-content-between small"
                                      >
                                        <span className="text-muted">
                                          Room {i + 1}:
                                        </span>
                                        <span className="fw-semibold">
                                          {parts.join(", ") || "—"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
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

              <Row className="g-3">
                <Col lg={3} md={4}>
                  <Card className="room-filters-card">
                    <Card.Body className="p-3">
                      <h6 className="filter-title mb-3">Filters</h6>

                      <div className="filter-group mb-3">
                        <div className="filter-group-label">Refund Policy</div>
                        <Form.Check
                          type="checkbox"
                          id="filter-refundable"
                          label="Refundable"
                          checked={refundFilter.refundable}
                          onChange={(e) =>
                            setRefundFilter((p) => ({
                              ...p,
                              refundable: e.target.checked,
                            }))
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          id="filter-nonrefundable"
                          label="Non Refundable"
                          checked={refundFilter.nonRefundable}
                          onChange={(e) =>
                            setRefundFilter((p) => ({
                              ...p,
                              nonRefundable: e.target.checked,
                            }))
                          }
                        />
                      </div>

                      <div className="filter-group">
                        <div className="filter-group-label">Room Type</div>
                        {roomTypeOptions.length === 0 ? (
                          <div className="text-muted small">No options</div>
                        ) : (
                          roomTypeOptions.map((rt) => (
                            <Form.Check
                              key={rt.roomtypeId ?? rt.code ?? rt.name}
                              type="checkbox"
                              id={`filter-rt-${rt.roomtypeId ?? rt.code ?? rt.name}`}
                              label={rt.name}
                              checked={selectedRoomTypes.includes(rt.name)}
                              onChange={() => toggleRoomType(rt.name)}
                            />
                          ))
                        )}
                      </div>

                      {(refundFilter.refundable ||
                        refundFilter.nonRefundable ||
                        selectedRoomTypes.length > 0) && (
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 mt-2"
                          onClick={() => {
                            setRefundFilter({
                              refundable: false,
                              nonRefundable: false,
                            });
                            setSelectedRoomTypes([]);
                          }}
                        >
                          Clear filters
                        </Button>
                      )}
                    </Card.Body>
                  </Card>
                </Col>

                <Col lg={9} md={8}>
              {/* Per-room Accordion wrapper.
                  Single-room mode (numRooms === 1): renders the existing
                  rate Accordion once, unwrapped — identical to legacy
                  behavior, zero regression.
                  Multi-room mode (numRooms > 1): renders the same inner
                  Accordion once PER ROOM SLOT, each wrapped in its own
                  "Room N" Accordion with the slot's current selection
                  shown in the header. Mirrors the ExternalApi pattern. */}
              {(isMultiRoom ? selectedRooms : [null]).map((_slot, roomSlotIndex) => {
                const inner = (
              <Accordion
                activeKey={activeAccordion}
                onSelect={(key) => setActiveAccordion(key)}
              >
                {hotel.roomCategories.map((category, index) => {
                  const eventKey = index.toString();
                  const isActive = activeAccordion === eventKey;
                  const filteredRates = (category.availableRates || []).filter(
                    matchesFilters,
                  );
                  if (filteredRates.length === 0) return null;

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
                                    ...filteredRates.map(
                                      (rate) => rate.rate,
                                    ),
                                  ),
                                )}
                              </div>
                              <div className="rates-count small text-muted">
                                {filteredRates.length} rate
                                {filteredRates.length !== 1
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
                          {filteredRates.map((rate, rateIndex) => (
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

                                    {/* Pricing
                                        Single-room: big price = rate
                                        × numberOfRooms, with "rate × N rooms"
                                        subtitle (legacy display).
                                        Multi-room: each slot is ONE room,
                                        so the big price is the per-room
                                        rate (`totalRate`) and the
                                        "× N rooms" subtitle is dropped —
                                        otherwise every slot would show
                                        the bulk price, which is wrong. */}
                                    <div className="rate-pricing text-center py-2">
                                      <div className="current-price">
                                        {formatPrice(
                                          isMultiRoom
                                            ? rate.totalRate || 0
                                            : rate.roomRateBasedOnRoomCount,
                                        )}
                                      </div>

                                      {/* {rate.recommendedRetailPrice >
                                        rate.totalRate && (
                                        <div className="original-price text-decoration-line-through">
                                          {formatPrice(
                                            rate.recommendedRetailPrice,
                                          )}
                                        </div>
                                      )} */}

                                      {!isMultiRoom && (
                                        <div className="indivial-price-per-room-noofroom">
                                          <div className="text-muted small">
                                            {formatPrice(rate.totalRate || 0)} ×{" "}
                                            {rate.numberOfRooms || 1} rooms
                                          </div>
                                        </div>
                                      )}
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

                                    {/* CTA — in single-room mode behaves
                                        exactly as before (opens the
                                        booking modal). In multi-room mode
                                        becomes a per-room radio toggle
                                        bound to the active room slot;
                                        see `selectedRooms`. */}
                                    {isMultiRoom ? (
                                      <Form.Check
                                        type="radio"
                                        id={`rate-radio-grid-${roomSlotIndex}-${index}-${rateIndex}`}
                                        name={`rate-radio-grid-room-${roomSlotIndex}`}
                                        className="w-100 mt-1 mb-1"
                                        label={
                                          selectedRooms[roomSlotIndex]
                                            ?.selectedRate === rate
                                            ? `Selected for Room ${roomSlotIndex + 1}`
                                            : `Select for Room ${roomSlotIndex + 1}`
                                        }
                                        checked={
                                          selectedRooms[roomSlotIndex]
                                            ?.selectedRate === rate
                                        }
                                        onChange={() =>
                                          handleRateSelect(
                                            roomSlotIndex,
                                            rate,
                                            hotel.hotelId,
                                            hotel.hotelName,
                                          )
                                        }
                                      />
                                    ) : (
                                      <Button
                                        variant="primary"
                                        className="w-100 book-now-btn mt-1 mb-1"
                                        onClick={() => handleBooking(rate)}
                                      >
                                        <FaMoneyBillWave className="me-2" />
                                        View Details / Select
                                      </Button>
                                    )}
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
                                        {formatPrice(
                                          isMultiRoom
                                            ? rate.totalRate || 0
                                            : rate.roomRateBasedOnRoomCount,
                                        )}
                                      </div>
                                      {!isMultiRoom && (
                                        <div className="text-muted small">
                                          {formatPrice(rate.totalRate || 0)} × {rate.numberOfRooms || 1} rooms
                                        </div>
                                      )}
                                      <div className="small text-muted">
                                        per night
                                      </div>
                                    </div>

                                    <div className="ps-2">
                                      {isMultiRoom ? (
                                        <Form.Check
                                          type="radio"
                                          id={`rate-radio-list-${roomSlotIndex}-${index}-${rateIndex}`}
                                          name={`rate-radio-list-room-${roomSlotIndex}`}
                                          label={
                                            selectedRooms[roomSlotIndex]
                                              ?.selectedRate === rate
                                              ? `Selected for Room ${roomSlotIndex + 1}`
                                              : `Select for Room ${roomSlotIndex + 1}`
                                          }
                                          checked={
                                            selectedRooms[roomSlotIndex]
                                              ?.selectedRate === rate
                                          }
                                          onChange={() =>
                                            handleRateSelect(
                                              roomSlotIndex,
                                              rate,
                                              hotel.hotelId,
                                              hotel.hotelName,
                                            )
                                          }
                                          style={{ whiteSpace: "nowrap" }}
                                        />
                                      ) : (
                                        <Button
                                          variant="primary"
                                          className="book-now-btn px-4 py-2"
                                          onClick={() => handleBooking(rate)}
                                          style={{ whiteSpace: 'nowrap' }}
                                        >
                                          <FaMoneyBillWave className="me-2" />
                                          View Details
                                        </Button>
                                      )}
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
                {hotel.roomCategories.every(
                  (c) =>
                    (c.availableRates || []).filter(matchesFilters).length ===
                    0,
                ) && (
                  <Alert variant="info" className="mb-0">
                    No rates match the selected filters.
                  </Alert>
                )}
              </Accordion>
                );
                // Single-room mode: render the inner Accordion directly,
                // unchanged from the legacy layout.
                if (!isMultiRoom) {
                  return (
                    <React.Fragment key="single-room">{inner}</React.Fragment>
                  );
                }
                // Multi-room mode: wrap each room slot in its own
                // "Room N" Accordion item with the current selection
                // shown as a badge in the header.
                const slotSelection = selectedRooms[roomSlotIndex];
                return (
                  <Accordion
                    key={`room-slot-${roomSlotIndex}`}
                    defaultActiveKey={`room-slot-${roomSlotIndex}`}
                    className="mb-3 room-slot-accordion"
                  >
                    <Accordion.Item eventKey={`room-slot-${roomSlotIndex}`}>
                      <Accordion.Header>
                        <div className="d-flex w-100 justify-content-between align-items-center pe-3">
                          <span className="fw-semibold">
                            <FaBed className="me-2 text-primary" />
                            Room {roomSlotIndex + 1}
                          </span>
                          {slotSelection?.selectedRate ? (
                            <Badge bg="success" className="ms-2">
                              {slotSelection.selectedRate.roomCategory}
                              {" — "}
                              {formatPrice(
                                // Per-room rate (not the bulk
                                // numberOfRooms-multiplied figure) so
                                // the slot badge matches the per-room
                                // price shown on the rate card.
                                slotSelection.selectedRate.totalRate || 0,
                              )}
                            </Badge>
                          ) : (
                            <Badge bg="warning" text="dark" className="ms-2">
                              Not selected
                            </Badge>
                          )}
                        </div>
                      </Accordion.Header>
                      <Accordion.Body>{inner}</Accordion.Body>
                    </Accordion.Item>
                  </Accordion>
                );
              })}

              {/* Multi-room "Continue with Booking" CTA. Only shown when
                  the search asked for more than one room. Disabled until
                  every room slot has a rate selection. On click,
                  combines all picks into the single-`selectedRate` shape
                  the existing HotelBookingPage already understands. */}
              {isMultiRoom && (
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mt-3 p-3 border rounded bg-light">
                  <div className="small text-muted">
                    {allRoomsSelected
                      ? `All ${numRooms} room${numRooms === 1 ? "" : "s"} selected. You can continue to booking.`
                      : `Pick a rate for each of the ${numRooms} rooms to continue. ${selectedRooms.filter((r) => r.selectedRate).length}/${numRooms} selected.`}
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    disabled={!allRoomsSelected}
                    onClick={handleProceedBooking}
                  >
                    <FaMoneyBillWave className="me-2" />
                    Continue with Booking
                  </Button>
                </div>
              )}
                </Col>
              </Row>
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
                              (policy, index) => {
                                const validity = renderPolicyValidity(
                                  policy.fromDate,
                                  policy.toDate,
                                );
                                return (
                                  <div key={index} className="policy-item mb-2">
                                    <p className="text-muted mb-1">
                                      {policy.policyText}
                                    </p>
                                    {validity && (
                                      <small
                                        className="text-muted"
                                        style={{
                                          fontWeight: "400",
                                          fontSize: "0.99rem",
                                        }}
                                      >
                                        {validity}
                                      </small>
                                    )}
                                  </div>
                                );
                              },
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
                              (policy, index) => {
                                const validity = renderPolicyValidity(
                                  policy.fromDate,
                                  policy.toDate,
                                );
                                return (
                                  <div key={index} className="policy-item mb-2">
                                    <p className="text-muted mb-1">
                                      {policy.policyText}
                                    </p>
                                    {validity && (
                                      <small
                                        style={{
                                          fontWeight: "400",
                                          fontSize: "0.99rem",
                                        }}
                                        className="text-muted"
                                      >
                                        {validity}
                                      </small>
                                    )}
                                  </div>
                                );
                              },
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
              window.open(bookingPageRoute, "_blank");
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
