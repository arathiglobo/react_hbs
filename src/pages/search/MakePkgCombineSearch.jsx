import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Tabs,
  Tab,
  Spinner,
  Pagination,
  Badge,
  Modal,
  Accordion,
  Table,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import Select from "react-select";
import {
  FaSearch,
  FaHotel,
  FaCar,
  FaTicketAlt,
  FaStar,
  FaBuilding,
  FaGlobe,
  FaSort,
  FaEye,
  FaBed,
  FaUtensils,
  FaInfoCircle,
  FaShieldAlt,
  FaChevronDown
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import { useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import "../../styles/RoomList.css";

// ─────────────────────────────────────────────
// Search Progress Bar (same as HotelSearch)
// ─────────────────────────────────────────────
function SearchProgressBar({ isLoading, pollStatus }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoading || pollStatus === "IN_PROGRESS") {
      setVisible(true);
      setProgress((prev) => Math.min(85, prev + 15));
    } else if (pollStatus === "COMPLETED" || !isLoading) {
      setProgress(100);
      const timer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 900);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      setProgress(0);
    }
  }, [isLoading, pollStatus]);

  if (!visible) return null;

  return (
    <div className="search-progress-bar-wrap mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="search-progress-label">Searching hotels...</span>
        <span className="search-progress-percent">{Math.round(progress)}%</span>
      </div>
      <div className="search-progress-track">
        <div
          className="search-progress-fill"
          style={{ width: `${progress}%`, transition: "width 0.6s ease" }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton Hotel Card
// ─────────────────────────────────────────────
function SkeletonHotelCard() {
  return (
    <Col xs={12}>
      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #dee2e6",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <Row className="g-0">
          <Col md={4} lg={3}>
            <div
              className="skeleton w-100"
              style={{ minHeight: "180px", borderRadius: "0" }}
            />
          </Col>
          <Col md={8} lg={9}>
            <div className="p-3">
              <div
                className="skeleton mb-2"
                style={{ height: "18px", width: "65%", borderRadius: "4px" }}
              />
              <div
                className="skeleton mb-2"
                style={{ height: "13px", width: "45%", borderRadius: "4px" }}
              />
              <div
                className="skeleton mb-3"
                style={{ height: "13px", width: "30%", borderRadius: "4px" }}
              />
              <div style={{ borderTop: "1px solid #eee", paddingTop: "10px" }}>
                <div
                  className="skeleton"
                  style={{ height: "13px", width: "20%", borderRadius: "4px" }}
                />
              </div>
            </div>
          </Col>
        </Row>
      </div>
    </Col>
  );
}

// ─────────────────────────────────────────────
// Lazy Image
// ─────────────────────────────────────────────
function LazyImage({ src, alt, className }) {
  const containerRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        });
      });
      observer.observe(el);
      return () => observer.disconnect();
    } else {
      setInView(true);
    }
  }, []);

  const buildSrcSet = (url) => {
    try {
      const safeUrl = url || "https://via.placeholder.com/480x270";
      const pattern = /\/(\d+)\/(\d+)$/;
      const small = pattern.test(safeUrl)
        ? safeUrl.replace(pattern, "/320/180")
        : `${safeUrl}?w=320&h=180`;
      const medium = pattern.test(safeUrl)
        ? safeUrl.replace(pattern, "/480/270")
        : `${safeUrl}?w=480&h=270`;
      const large = pattern.test(safeUrl)
        ? safeUrl.replace(pattern, "/640/360")
        : `${safeUrl}?w=640&h=360`;
      return `${small} 320w, ${medium} 480w, ${large} 640w`;
    } catch {
      return undefined;
    }
  };

  const imageSrc = src || "https://via.placeholder.com/480x270";

  return (
    <div
      ref={containerRef}
      className={`ratio ratio-16x9 rounded-top overflow-hidden ${className || ""}`}
      style={{ height: "100%" }}
    >
      {!loaded && <div className="skeleton w-100 h-100" />}
      {inView && (
        <img
          src={imageSrc}
          srcSet={buildSrcSet(imageSrc)}
          sizes="(min-width:1200px) 33vw, (min-width:768px) 50vw, 100vw"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          alt={alt}
          onLoad={() => setLoaded(true)}
          className={`img-cover ${loaded ? "img-loaded" : "img-loading"}`}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function MakePkgCombineSearch() {
  const location = useLocation();
  const searchCriteria = location.state;
  const {
    travelDate,
    agent,
    nationality,
    destination,
    adults,
    children,
    childAges: initialChildAges = [],
    nights,
  } = searchCriteria || {};
const [activeAccordion, setActiveAccordion] = useState({});
  const [checkIn, setCheckIn] = useState(travelDate || "");
  const [checkOut, setCheckOut] = useState("");
  const [nightsCount, setNightsCount] = useState(nights || 1);
  const [adultCount, setAdultCount] = useState(adults || 1);
  const [childCount, setChildCount] = useState(children || 0);
  const [destinationLabel] = useState(destination?.label || "");
  const [agentId, setAgentId] = useState(agent || "");
  const [activeTab, setActiveTab] = useState("accommodation");
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [rooms, setRooms] = useState([
    {
      adults: adults || 1,
      children: children || 0,
      childAges: initialChildAges || [],
    },
  ]);
  const [childAges, setChildAges] = useState(initialChildAges || []);
  const [allResults, setAllResults] = useState([]);
  const [hasSearchResult, setHasSearchResult] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pollStatus, setPollStatus] = useState("IDLE");
  const [completedChannels, setCompletedChannels] = useState(new Set());
  const [searchId, setSearchId] = useState(null);
  const resultsRef = useRef(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortBy, setSortBy] = useState("priceAsc");

  // ── FIXED: starRating is now single-select (null | option) ──
  const [starRating, setStarRating] = useState(null);
  const [hotelType, setHotelType] = useState([]);
  const [channelType, setChannelType] = useState([]);
  const [isInitialResultsLoaded, setIsInitialResultsLoaded] = useState(false);
  const [hotelSearchTerm, setHotelSearchTerm] = useState("");
  const [errors, setErrors] = useState({});
  const [clickedHotelIds, setClickedHotelIds] = useState([]);

  // Inline Room View State
  const [hotelRooms, setHotelRooms] = useState({});
  const [expandedHotels, setExpandedHotels] = useState({});
  const [loadingRooms, setLoadingRooms] = useState({});
  const navigate = useNavigate();

  // Transfer search state
  const [transferResults, setTransferResults] = useState([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [hasTransferSearched, setHasTransferSearched] = useState(false);
  const [transferAdults, setTransferAdults] = useState(adults || 1);
  const [transferChildren, setTransferChildren] = useState(children || 0);
  const [transferChildAges, setTransferChildAges] = useState(initialChildAges || []);
  const [transferPickupDate, setTransferPickupDate] = useState(travelDate || "");
  const [transferDropoffDate, setTransferDropoffDate] = useState("");

  // Tours and Activities search state
  const [tourResults, setTourResults] = useState([]);
  const [tourLoading, setTourLoading] = useState(false);
  const [hasTourSearched, setHasTourSearched] = useState(false);
  const [tourAdults, setTourAdults] = useState(adults || 1);
  const [tourChildren, setTourChildren] = useState(children || 0);
  const [tourChildAges, setTourChildAges] = useState(initialChildAges || []);
  const [tourDate, setTourDate] = useState(travelDate || "");
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [addingActivityId, setAddingActivityId] = useState(null);
  const [addingTransferId, setAddingTransferId] = useState(null);
  const [hasHotelInCart, setHasHotelInCart] = useState(false);

  const checkHotelInCart = useCallback(async () => {
    const currentAgentId =
      sessionStorage.getItem("makeYourOwnPackageAgentId") ||
      localStorage.getItem("makeYourOwnPackageAgentId") ||
      agent ||
      agentId ||
      "";

    if (!currentAgentId) {
      setHasHotelInCart(false);
      return;
    }

    try {
      const response = await axiosInstance.post(
        `/api/makeYourOwnPackage/fetchDataFromRedis?userId=${encodeURIComponent(
          currentAgentId
        )}`
      );
      if (Array.isArray(response.data)) {
        const hotelExists = response.data.some((item) => !!item.hotel);
        setHasHotelInCart(hotelExists);
      } else {
        setHasHotelInCart(false);
      }
    } catch (err) {
      console.error("Error checking hotel in cart:", err);
      setHasHotelInCart(false);
    }
  }, [agent, agentId]);

  useEffect(() => {
    checkHotelInCart();
    window.addEventListener("cartUpdated", checkHotelInCart);
    return () => {
      window.removeEventListener("cartUpdated", checkHotelInCart);
    };
  }, [checkHotelInCart]);

  const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return "";
    const parsedDate = new Date(dateString);
    if (Number.isNaN(parsedDate.getTime())) return "";
    const day = String(parsedDate.getDate()).padStart(2, "0");
    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const year = parsedDate.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Filter options
  const starOptions = [
    { value: 5, label: "5 Stars" },
    { value: 4, label: "4 Stars" },
    { value: 3, label: "3 Stars" },
    { value: 2, label: "2 Stars" },
    { value: 1, label: "1 Star" },
  ];

  const hotelTypeOptions = [
    { value: "hotel", label: "Hotel" },
    { value: "villa", label: "Villa" },
    { value: "resort", label: "Resort" },
    { value: "apartment", label: "Apartment" },
  ];

  const channelTypeOptions = [
    { value: "inhouse", label: "Inhouse" },
    // { value: "iwtx", label: "Iwtx" },
    // { value: "x3", label: "x3" },
    // { value: "ratehawk", label: "Ratehawk" },
    // { value: "darina", label: "Darina" },
  ];

  useEffect(() => {
    if (checkIn && nightsCount) {
      const inDate = new Date(checkIn);
      const outDate = new Date(inDate);
      outDate.setDate(inDate.getDate() + parseInt(nightsCount));
      setCheckOut(outDate.toISOString().split("T")[0]);
    }
  }, [checkIn, nightsCount]);

  useEffect(() => {
    if (agentId) {
      sessionStorage.setItem("makeYourOwnPackageAgentId", agentId);
      localStorage.setItem("makeYourOwnPackageAgentId", agentId);
    }
  }, [agentId]);

  useEffect(() => {
    if (travelDate) {
      sessionStorage.setItem("makePkgTravelDate", travelDate);
    }
  }, [travelDate]);

  useEffect(() => {
    if (transferChildren > 0) {
      setTransferChildAges((prevAges) => {
        const currentAges = [...prevAges];
        if (initialChildAges && initialChildAges.length === transferChildren) {
          return [...initialChildAges];
        }
        while (currentAges.length < transferChildren) {
          currentAges.push(
            initialChildAges && currentAges.length < initialChildAges.length
              ? initialChildAges[currentAges.length]
              : 5
          );
        }
        if (currentAges.length > transferChildren) {
          currentAges.splice(transferChildren);
        }
        return currentAges;
      });
    } else {
      setTransferChildAges([]);
    }
  }, [transferChildren, initialChildAges]);

  useEffect(() => {
    if (adults || children) {
      const initialRooms = [
        {
          adults: adults || 1,
          children: children || 0,
          childAges: initialChildAges || [],
        },
      ];
      setRooms(initialRooms);
      if (initialChildAges && initialChildAges.length > 0) {
        setChildAges(initialChildAges);
      }
    }
  }, [adults, children, initialChildAges]);

  useEffect(() => {
    if (tourChildren > 0) {
      setTourChildAges((prevAges) => {
        const currentAges = [...prevAges];
        if (initialChildAges && initialChildAges.length === tourChildren) {
          return [...initialChildAges];
        }
        while (currentAges.length < tourChildren) {
          currentAges.push(
            initialChildAges && currentAges.length < initialChildAges.length
              ? initialChildAges[currentAges.length]
              : 5
          );
        }
        if (currentAges.length > tourChildren) {
          currentAges.splice(tourChildren);
        }
        return currentAges;
      });
    } else {
      setTourChildAges([]);
    }
  }, [tourChildren, initialChildAges]);

  const handleChildAgeChange = (index, value) => {
    const updatedAges = [...childAges];
    updatedAges[index] = value;
    setChildAges(updatedAges);
  };

  const fetchHotels = async (page, sid, agtId) => {
    try {
      const params = {
        agentId: agtId || agent || 1,
        page,
        pageSize,
        sortBy:
          sortBy === "priceAsc" || sortBy === "priceDesc" ? "baseRate" : sortBy,
        sortOrder:
          sortBy === "priceAsc" || sortBy === "ratingAsc" || sortBy === "nameAsc"
            ? "asc"
            : "desc",
        // ── FIXED: single-select star ──
        starRating: starRating ? starRating.value : undefined,
        apiType:
          channelType.map((c) => c.value.toUpperCase()).join(",") || undefined,
      };

      const res = await axiosInstance.get(`/hotel-search/results/${sid}`, { params });

      const mappedResults = Array.isArray(res.data.result)
        ? res.data.result.map((hotel, index) => ({
            id: hotel.hotelCode
              ? `${sid}-${hotel.hotelCode}`
              : `${sid}-h${index + 1}`,
            searchId: sid,
            hotelCode: hotel.hotelCode || null,
            name: hotel.hotelName || "Unknown Hotel",
            address: hotel.hotelAddress || "",
            city: hotel.hotelAddress
              ? hotel.hotelAddress.split(", ").pop() || "Unknown City"
              : "Unknown City",
            price: hotel.baseRate || null,
            badge: hotel.baseRate ? "Rate Available" : "Rate Unavailable",
            image:
              hotel.hotelImage ||
              "https://b2b.choosenfly.com/assets/details/profilepic/hotel/hoteldefault.jpg",
            rating: hotel.starRating || 0,
            hotelType: "hotel",
            channelType: hotel.apiType?.toLowerCase() || "inhouse",
          }))
        : [];

      setAllResults(mappedResults);
      setTotalElements(Number(res.data.totalResults) || mappedResults.length);
      setTotalPages(
        Math.max(
          1,
          Math.ceil(
            (Number(res.data.totalResults) || mappedResults.length) / pageSize
          )
        )
      );
      setHasSearchResult(true);
      return res.data;
    } catch (err) {
      console.error("Fetch hotels failed:", err);
      setPollStatus("ERROR");
      throw err;
    }
  };

  // Filtered results — FIXED: starRating is now single null | option
  const filteredResults = useMemo(() => {
    let results = allResults;

    if (hotelSearchTerm && hotelSearchTerm.trim()) {
      const searchTerm = hotelSearchTerm.trim().toLowerCase();
      results = results.filter((hotel) => {
        const hotelName = (hotel.name || hotel.hotelName || "").trim().toLowerCase();
        return hotelName.includes(searchTerm);
      });
    }

    // ── FIXED: single-select check ──
    if (starRating) {
      results = results.filter(
        (hotel) => Number(hotel.rating) === Number(starRating.value)
      );
    }

    if (hotelType.length > 0) {
      const selectedTypes = hotelType.map((t) => t.value);
      results = results.filter((hotel) => selectedTypes.includes(hotel.hotelType));
    }

    if (channelType.length > 0) {
      const selectedChannels = channelType.map((c) => c.value);
      results = results.filter((hotel) => selectedChannels.includes(hotel.channelType));
    }

    return results;
  }, [allResults, hotelSearchTerm, starRating, hotelType, channelType]);

  const effectiveTotalPages = useMemo(() => Math.max(1, totalPages), [totalPages]);

  const pageNumbers = useMemo(() => {
    const maxPagesToShow = 5;
    const currentPage = pageIndex + 1;
    const start = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    const end = Math.min(totalPages, start + maxPagesToShow - 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [pageIndex, totalPages]);

  const goToPage = (page) => {
    if (page >= 0 && page < totalPages) {
      setPageIndex(page);
      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 0);
    }
  };

  useEffect(() => {
    if (!searchId || !hasSearched) return;
    setIsLoading(true);
    fetchHotels(pageIndex, searchId, agent).finally(() => setIsLoading(false));
  }, [pageIndex, sortBy, starRating, channelType, searchId, agent, hasSearched]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fadeIn { animation: fadeIn 0.5s ease-in; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handleHotelSearchSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);
    setHasSearched(true);
    setHasSearchResult(false);
    setAllResults([]);
    setPollStatus("IDLE");
    setPageIndex(0);
    setTotalElements(0);
    setTotalPages(1);
    setCompletedChannels(new Set());

    try {
      const nationalityId = nationality?.value || "";
      const nationalityCode = nationality?.code || "";
      const destinationCityId = destination?.value || "";
      const destinationCountryId = destination?.countryId || "";
      const noOfRooms = String(rooms.length);

      const roomConfigurations = rooms.map((room, index) => ({
        roomNo: index + 1,
        adultCount: String(room.adults || 1),
        childCount: String(room.children || 0),
        childAges:
          room.childAges && room.childAges.length > 0
            ? room.childAges.map((age) => parseInt(age) || 0)
            : room.children > 0
            ? Array(room.children).fill(0)
            : [0],
        adultAges: room.adultAges?.length ? room.adultAges : [25],
      }));

      const agentIdFinal = agentId || agent || 1;

      const searchPayloadReq = {
        nationalityId,
        nationalityCode,
        destinationCityId,
        destinationCountryId,
        checkIn,
        checkOut,
        noOfRooms,
        roomConfigurations,
        agentId: agentIdFinal,
        apiType: ["INHOUSE"],
      };

      const searchRes = await axiosInstance.post(
        "/api/makeYourOwnPackageHotel/search",
        searchPayloadReq
      );

      const ensureHttpImage = (imageUrl) => {
        if (!imageUrl) {
          return "https://b2b.choosenfly.com/assets/details/profilepic/hotel/hoteldefault.jpg";
        }
        if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
        if (typeof imageUrl === "string") {
          const fileName = imageUrl.split(/[/\\]/).pop();
          if (fileName) {
            return `https://b2b.choosenfly.com/assets/details/profilepic/hotel/${fileName}`;
          }
        }
        return "https://b2b.choosenfly.com/assets/details/profilepic/hotel/hoteldefault.jpg";
      };

      const responseData = Array.isArray(searchRes.data) ? searchRes.data : [];

      const mappedResults = responseData.map((hotel, index) => ({
        id: hotel.hotelCode ? `local-${hotel.hotelCode}` : `local-h${index + 1}`,
        searchId: "local",
        hotelCode: hotel.hotelCode || null,
        name: hotel.hotelName || "Unknown Hotel",
        address: hotel.hotelAddress || "",
        city: hotel.hotelAddress
          ? hotel.hotelAddress.split(", ").pop() || "Unknown City"
          : "Unknown City",
        price: hotel.baseRate ?? null,
        badge: hotel.baseRate ? "Rate Available" : "Rate Unavailable",
        image: ensureHttpImage(hotel.hotelImage),
        rating: hotel.starRating || 0,
        hotelType: "hotel",
        channelType: hotel.apiType?.toLowerCase() || "inhouse",
      }));

      setAllResults(mappedResults);
      setTotalElements(mappedResults.length);
      setTotalPages(Math.max(1, Math.ceil(mappedResults.length / pageSize)));
      setHasSearchResult(true);
      setIsInitialResultsLoaded(true);
      setPollStatus("COMPLETED");
      setSearchId(null);
    } catch (err) {
      console.error("Search failed:", err);
      setHasSearched(false);
      setPollStatus("ERROR");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = async (page) => {
    if (page < 0 || page >= totalPages) return;
    setPageIndex(page);
    setIsLoading(true);
    try {
      await fetchHotels(page, searchId, agentId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransferChildAgeChange = (index, value) => {
    const updatedAges = [...transferChildAges];
    updatedAges[index] = parseInt(value) || 5;
    setTransferChildAges(updatedAges);
  };

  const handleTourChildAgeChange = (index, value) => {
    const updatedAges = [...tourChildAges];
    updatedAges[index] = parseInt(value) || 5;
    setTourChildAges(updatedAges);
  };

  const handleTourSearchSubmit = async (e) => {
    e.preventDefault();
    setTourLoading(true);
    setHasTourSearched(true);
    setTourResults([]);

    try {
      const formatDate = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      };

      const activityPayload = {
        activityDate: formatDate(tourDate || travelDate || checkIn),
        nativeCountryId: nationality?.value ? String(nationality.value) : "",
        destinationCountryId: destination?.countryId || "",
        destinationCityId: destination?.value || "",
        searchCorCtype: destination?.type || "State",
        agentId: String(agentId || agent || 1),
        childAge:
          tourChildAges && tourChildAges.length > 0
            ? tourChildAges.map((age) => String(parseInt(age) || 0))
            : tourChildren > 0
            ? Array(tourChildren).fill("0")
            : [],
        adult: String(tourAdults || adults || 1),
        child: String(tourChildren || children || 0),
      };

      const response = await axiosInstance.post(
        "/api/makeYourOwnPackage/getActivityInhouse",
        activityPayload
      );

      const mappedResults = Array.isArray(response.data)
        ? response.data.map((activity, index) => ({
            id: activity.activityId || `activity-${index}`,
            activityName: activity.activityname || "",
            activityDetails: activity.activityDetails || "",
            starRating: activity.starRating || 0,
            totalRate: activity.totalRate || activity.activityRate || 0,
            totalRateWithoutMrk: activity.totalRateWithoutmrk || activity.activityRate || 0,
            activityImage:
              activity.activityImage ||
              "https://via.placeholder.com/400x225?text=Activity",
            childMax: activity.childMax || 0,
            childMin: activity.childMin || 0,
            adultRate: activity.adultRate || 0,
            childRate: activity.childRate || 0,
            activityType: activity.activityType || 1,
            maxPax: activity.maxPax || 0,
            minPaxsic: activity.minPaxsic || 0,
            currency: activity.currencyCode || "AED",
            duration:
              activity.viatorActivityDurationFrom && activity.viatorActivityDurationTo
                ? `${activity.viatorActivityDurationFrom} - ${activity.viatorActivityDurationTo}`
                : null,
            apiType: activity.apiType || null,
            viatorProductCode: activity.viatorProductCode || null,
          }))
        : [];

      setTourResults(mappedResults);
    } catch (err) {
      console.error("Activity search failed:", err);
      setTourResults([]);
    } finally {
      setTourLoading(false);
    }
  };

  const handleViewRooms = async (hotel) => {
    setExpandedHotels((prev) => ({ ...prev, [hotel.id]: !prev[hotel.id] }));
    if (expandedHotels[hotel.id]) return;
    if (hotelRooms[hotel.id]) return;

    setLoadingRooms((prev) => ({ ...prev, [hotel.id]: true }));

    const nationalityCode =
      (nationality?.code || "").length === 2 ? nationality.code : " ";
    const agentIdToUse = agentId || agent || 1;

    const roomsPayload = rooms.map((r) => ({
      adults: r.adults || 1,
      children: r.children || 0,
      childAges: r.childAges || [],
      adultAges: Array.from({ length: r.adults || 1 }, () => 30),
    }));

    const apiIdMapping = {
      jumeirah: 10,
      iwtx: 12,
      x3: 15,
      inhouse: 1,
      ratehawk: 14,
      darina: 16,
    };

    const apiId = apiIdMapping[hotel.channelType?.toLowerCase()] || 0;

    const payload = {
      checkInDate: checkIn,
      checkOutDate: checkOut,
      hotelCode: hotel.hotelCode || hotel.id?.split("-").slice(1).join("-") || "",
      nationality: nationalityCode,
      agentId: String(agentIdToUse),
      apiId,
      rooms: roomsPayload,
    };

    const meta = {
      hotelName: hotel.name,
      address: hotel.address || hotel.city,
      starRating: hotel.rating || 0,
      phone: "",
      hotelImage: hotel.image,
    };

    try {
      const res = await axiosInstance.post("/api/hotel-rooms/search", payload);

      if (!res.data || res.data.success === false) {
        toast.error(res.data?.message || "Failed to fetch rooms.");
        setLoadingRooms((prev) => ({ ...prev, [hotel.id]: false }));
        return;
      }

      const enriched = {
        ...res.data,
        hotels: (res.data.hotels || []).map((h) => ({
          ...h,
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

      setHotelRooms((prev) => ({ ...prev, [hotel.id]: enriched }));
    } catch (err) {
      console.error("Room search failed:", err);
      toast.error("Failed to fetch rooms. Please try again.");
    } finally {
      setLoadingRooms((prev) => ({ ...prev, [hotel.id]: false }));
    }
  };

  const handleAddToCart = async (hotelId, rate) => {
    const roomData = hotelRooms[hotelId];
    if (!roomData) return;

    const { payload, hotels } = roomData;
    const hotelsdetail = hotels[0];

    console.log("hotels rate::", rate);

    try {
      const searchRoomDTOs = (payload.rooms || []).map((room) => ({
        roomCount: 1,
        adult: String(room.adults || room.adult || 1),
        child: String(room.children || room.child || 0),
        childAge: Array.isArray(room.childAges)
          ? room.childAges.map((age) => Number(age))
          : Array.isArray(room.childAge)
          ? room.childAge.map((age) => Number(age))
          : [],
      }));

      const available = rate.roomStatus === "Available" ? "True" : "False";
      const refundstatus =
        rate.nonRefundable === true ||
        rate.nonRefundable === "true" ||
        String(rate.nonRefundable).toLowerCase() === "true"
          ? "N"
          : "Y";

      const cancellationPolicyList = Array.isArray(hotelsdetail.cancellationPolicies)
        ? hotelsdetail.cancellationPolicies.map((policy) =>
            typeof policy === "string"
              ? policy
              : policy.policyText || policy.text || JSON.stringify(policy)
          )
        : [];

      const cartItem = {
        hotelId: String(hotelsdetail.hotelId || ""),
        hotelName: hotelsdetail.hotelName || "",
        address: hotelsdetail.hotelAddress || "",
        starRating: Number(hotelsdetail.starRating) || 0,
        roomtypeId: String(rate.roomTypeCode || rate.roomtypeId || ""),
        roomcategory: rate.roomCategory || "",
        roomCategory: rate.roomCategory || "",
        roomType: rate.mealPlan || "",
        available,
        api: Number(payload.apiId || payload.api || 0),
        destinationCityId: String(payload.destinationCityId || payload.cityId || ""),
        destinationCountryId: String(payload.destinationCountryId || payload.countryId || ""),
        checkIn: payload.checkInDate || payload.checkIn || "",
        checkOut: payload.checkOutDate || payload.checkOut || "",
        nativeContryId: Number(hotelsdetail.nationalityId) || null,
        nationality: String(payload.nationality || ""),
        noOfRoom: String(hotelsdetail.numberOfRooms || payload.noOfRoom || "1"),
        refundstatus,
        searchRoomDTOs,
        agentId: String(payload.agentId || ""),
        totalRate: Number(rate.totalRate) || 0,
        totalRateWithoutmrk: Number(rate.rateBeforeTax || rate.totalRate) || 0,
        cancellationPolicy: cancellationPolicyList,
      };

      const response = await axiosInstance.post(
        "/api/makeYourOwnPackageHotel/saveHotelDetailsToCart",
        cartItem
      );
      if (response.data && response.data.success !== false) {
        toast.success("Room added to cart successfully!");
        window.dispatchEvent(new CustomEvent("cartUpdated"));
      } else {
        toast.error(response.data?.message || "Failed to add item to cart");
      }
    } catch (err) {
      console.error("Error adding to cart:", err);
      toast.error("Failed to add item to cart. Please try again.");
    }
  };

  const getMealPlanIcon = (mealPlan) => {
    if (!mealPlan) return <FaUtensils className="text-primary" />;
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

  const getRefundStatusBadge = (nonRefundable) => {
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
            <span className="bg-warning text-dark px-2 py-0 rounded">On Request</span>
          </small>
        );
      case "Available":
        return (
          <small>
            This room is{" "}
            <span className="bg-success text-white px-3 py-0 rounded">Available</span>
          </small>
        );
      default:
        return <Badge bg="secondary">{roomStatus}</Badge>;
    }
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(price);

  const handleAddActivityToCart = async (activity) => {
    if (!activity) return;

    const agentValue = String(agentId || agent || 1);
    const activityDateValue =
      formatDateToDDMMYYYY(tourDate) ||
      formatDateToDDMMYYYY(travelDate) ||
      formatDateToDDMMYYYY(checkIn);

    if (!activityDateValue) {
      toast.error("Select a valid activity date before adding to cart.");
      return;
    }
    if (!nationality?.value) {
      toast.error("Select a nationality before adding to cart.");
      return;
    }

    const payload = {
      activityDate: activityDateValue,
      nativeCountryId: String(nationality.value),
      childAge:
        Array.isArray(tourChildAges) && tourChildAges.length > 0
          ? tourChildAges.map((age) => String(age))
          : [],
      adult: String(tourAdults || 1),
      child: String(tourChildren || 0),
      activityId: String(activity.id || activity.activityId || ""),
      activityName: activity.activityName || "",
      agentId: agentValue,
      totalRate: activity.totalRate || 0,
      totalRateWithoutmrk: activity.totalRateWithoutMrk || 0,
    };

    if (!payload.activityId) {
      toast.error("Unable to determine the activity identifier.");
      return;
    }

    setAddingActivityId(activity.id || activity.activityId);

    try {
      const response = await axiosInstance.post(
        "/api/makeYourOwnPackage/saveActivityDetailsToCart",
        payload
      );
      if (response.data === "1" || response.data === 1) {
        toast.success("Activity added to cart successfully.");
        window.dispatchEvent(new Event("cartUpdated"));
      } else {
        throw new Error("Unexpected response");
      }
    } catch (error) {
      console.error("Failed to add activity to cart:", error);
      toast.error("Failed to add activity to cart. Please try again.");
    } finally {
      setAddingActivityId(null);
    }
  };

  const renderStars = (rating) =>
    Array.from({ length: Math.floor(rating || 0) }, (_, i) => (
      <FaStar key={i} className="text-warning" size={14} />
    ));

  const handleTransferSearchSubmit = async (e) => {
    e.preventDefault();
    setTransferLoading(true);
    setHasTransferSearched(true);
    setTransferResults([]);

    try {
      const transferPayload = {
        checkIn: transferPickupDate || travelDate || checkIn,
        checkOut: transferDropoffDate || checkOut,
        nativeCountryId: nationality?.value ? Number(nationality.value) : null,
        destinationCountryId: destination?.countryId || "",
        destinationCityId: destination?.value || "",
        searchCorCtype: "city",
        agentid: String(agentId || agent || 1),
        childAge:
          transferChildAges && transferChildAges.length > 0
            ? transferChildAges.map((age) => parseInt(age) || 0)
            : transferChildren > 0
            ? Array(transferChildren).fill(0)
            : [],
        adult: transferAdults || adults || 1,
        child: transferChildren || children || 0,
      };

      const response = await axiosInstance.post(
        "/api/makeYourOwnPackage/getTransferInhouse",
        transferPayload
      );

      const ensureHttpImage = (imageUrl) => {
        if (!imageUrl) return "https://via.placeholder.com/400x225?text=Transfer";
        if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
        if (typeof imageUrl === "string") {
          const fileName = imageUrl.split(/[/\\]/).pop();
          if (fileName)
            return `https://b2b.choosenfly.com/assets/details/profilepic/hotel/${fileName}`;
        }
        return "https://via.placeholder.com/400x225?text=Transfer";
      };

      const mappedResults = Array.isArray(response.data)
        ? response.data.map((cab, index) => ({
            cabid: cab.cabid || cab.cabId || `cab-${index}`,
            cabname: cab.cabname || cab.cabName || "Transfer Vehicle",
            cabdetails: cab.cabdetails || "",
            cabpic: ensureHttpImage(cab.cabpic || cab.cabPic),
            noOfCabs: cab.noOfCabs || 1,
            searchCabDetailsDTO: Array.isArray(cab.searchCabDetailsDTO)
              ? cab.searchCabDetailsDTO
              : [],
          }))
        : [];

      setTransferResults(mappedResults);
    } catch (err) {
      console.error("Transfer search failed:", err);
      setTransferResults([]);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleAddTransferToCart = async (cab, cabDetail) => {
    if (!cab || !cabDetail) return;

    const agentValue = String(agentId || agent || 1);
    const pickupDateValue = formatDateToDDMMYYYY(transferPickupDate || travelDate || checkIn);
    const dropoffDateValue = formatDateToDDMMYYYY(transferDropoffDate || checkOut);

    if (!pickupDateValue) {
      toast.error("Select a valid pickup date before adding to cart.");
      return;
    }
    if (!nationality?.value) {
      toast.error("Select a nationality before adding to cart.");
      return;
    }

    const rate =
      cabDetail.types === "SIC" ? cabDetail.sicRate || 0 : cabDetail.privateRate || 0;
    const totalRateWithoutMrk =
      cabDetail.totalRateWithoutMrk !== undefined &&
      cabDetail.totalRateWithoutMrk !== null &&
      cabDetail.totalRateWithoutMrk !== 0
        ? cabDetail.totalRateWithoutMrk
        : rate;
    const totalRate =
      cabDetail.totalRate !== undefined &&
      cabDetail.totalRate !== null &&
      cabDetail.totalRate !== 0
        ? cabDetail.totalRate
        : totalRateWithoutMrk;

    const payload = {
      pickupDate: pickupDateValue,
      dropoffDate: dropoffDateValue || pickupDateValue,
      nativeCountryId: String(nationality.value),
      childAge:
        Array.isArray(transferChildAges) && transferChildAges.length > 0
          ? transferChildAges.map((age) => parseInt(age) || 0)
          : [],
      adult: parseInt(transferAdults || adults || 1),
      child: parseInt(transferChildren || children || 0),
      cabId: String(cab.cabid || ""),
      noOfCabs: parseInt(cab.noOfCabs || 1),
      travelType: String(cabDetail.travelType || "1"),
      timeDetails: cabDetail.hourDetails ? String(cabDetail.hourDetails) : "0",
      dropDetails: String(cabDetail.dropDetails || "1"),
      locationId: String(cabDetail.locationId || ""),
      paxDetails: String(cabDetail.paxDetails || "1"),
      luggage: cabDetail.luggage !== undefined ? String(cabDetail.luggage) : "true",
      cabName: cab.cabname || "",
      agentId: parseInt(agentValue) || 1,
      totalRate: totalRate || 0,
      totalRateWithoutmrk: totalRateWithoutMrk || 0,
    };

    if (!payload.cabId) {
      toast.error("Unable to determine the transfer identifier.");
      return;
    }

    setAddingTransferId(
      `${cab.cabid}-${cabDetail.dropDetails}-${cabDetail.paxDetails}-${cabDetail.types}`
    );

    try {
      const response = await axiosInstance.post(
        "/api/makeYourOwnPackage/saveCabDetailsToCart",
        payload
      );
      if (
        response.data === "1" ||
        response.data === 1 ||
        (response.data && response.data.success !== false)
      ) {
        toast.success("Transfer added to cart successfully.");
        window.dispatchEvent(new Event("cartUpdated"));
      } else {
        throw new Error("Unexpected response");
      }
    } catch (error) {
      console.error("Failed to add transfer to cart:", error);
      toast.error("Failed to add transfer to cart. Please try again.");
    } finally {
      setAddingTransferId(null);
    }
  };

  // ── Helper: clear all hotel filters ──
  const clearAllFilters = () => {
    setStarRating(null);
    setHotelType([]);
    setChannelType([]);
    setSortBy("priceAsc");
    setHotelSearchTerm("");
  };

  const hasActiveFilters =
    hotelSearchTerm || starRating || hotelType.length > 0 || channelType.length > 0;

  const startEntry = totalElements === 0 ? 0 : pageIndex * pageSize + 1;
  const endEntry = Math.min((pageIndex + 1) * pageSize, totalElements);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl mb-4">
            <Card.Body>
              <h4 className="fw-bold mb-4">
                Create My Trip{" "}
                <span className="text-muted">- {destinationLabel}</span>
              </h4>

              <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k)}
                className="mb-3 nav-tabs-custom"
              >
                {/* ═══════════════════════════════════════
                    ACCOMMODATION TAB
                ═══════════════════════════════════════ */}
                <Tab
                  eventKey="accommodation"
                  title={
                    <>
                      <FaHotel className="me-2" /> Accommodation
                    </>
                  }
                >
                  <Card className="border-0 shadow-sm">
                    <Card.Body>
                      <h5 className="fw-bold text-primary mb-3">Hotel Search</h5>
                      <Form onSubmit={handleHotelSearchSubmit}>
                        <Row className="g-3">
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label>Check In</Form.Label>
                              <Form.Control
                                type="date"
                                value={checkIn}
                                onChange={(e) => setCheckIn(e.target.value)}
                              />
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label>Check Out</Form.Label>
                              <Form.Control
                                type="date"
                                value={checkOut}
                                onChange={(e) => setCheckOut(e.target.value)}
                                min={checkIn || undefined}
                              />
                            </Form.Group>
                          </Col>
                          <Col md={2}>
                            <Form.Group>
                              <Form.Label>Nights</Form.Label>
                              <Form.Control
                                type="number"
                                min="1"
                                value={nightsCount}
                                onChange={(e) => setNightsCount(e.target.value)}
                              />
                            </Form.Group>
                          </Col>
                          <Col lg={4} md={6}>
                            <Form.Label className="fw-semibold text-dark">
                              👥 Rooms & Guests
                            </Form.Label>
                            <Button
                              variant="outline-primary"
                              className="w-100 text-start"
                              type="button"
                              onClick={() => setRoomsOpen(!roomsOpen)}
                            >
                              {adultCount} adults
                              {childCount ? `, ${childCount} child` : ""} ·{" "}
                              {rooms.length} room
                              <span className="float-end">{roomsOpen ? "▴" : "▾"}</span>
                            </Button>
                          </Col>
                        </Row>

                        <div className="text-center mt-4">
                          <Button
                            type="submit"
                            variant="warning"
                            className="px-4 py-2"
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <>
                                <Spinner animation="border" size="sm" className="me-2" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <FaSearch className="me-2" />
                                Search
                              </>
                            )}
                          </Button>
                        </div>
                      </Form>

                      {/* ── Empty pre-search state ── */}
                      {!hasSearched && !hasSearchResult && (
                        <Card className="shadow-sm rounded-xl mt-4">
                          <Card.Body className="text-center text-muted py-5">
                            <FaSearch className="display-4 text-muted mb-3" />
                            <h4>Ready to Find Your Perfect Stay?</h4>
                            <p>
                              Use the search form above to discover amazing hotels
                              and exclusive deals.
                            </p>
                          </Card.Body>
                        </Card>
                      )}

                      {/* ══════════════════════════════════════════════════
                          RESULTS SECTION — two-column layout
                      ══════════════════════════════════════════════════ */}
                      {hasSearched && (
                        <div ref={resultsRef} className="mt-4">

                          {/* ── Progress bar (visible during loading) ── */}
                          <SearchProgressBar
                            isLoading={isLoading}
                            pollStatus={pollStatus}
                          />

                          <div className="search-layout">
                            <Row className="g-4" style={{ alignItems: "flex-start" }}>

                              {/* ────────────────────────────────────
                                  LEFT SIDEBAR (mirrors HotelSearch)
                              ──────────────────────────────────── */}
                             <Col lg={3} className="leftside d-none d-lg-block" style={{
      position: "sticky",
      top: "90px", // adjust based on TopBar height
      maxHeight: "calc(100vh - 100px)",
      overflowY: "auto",
    }}>
  <div className="left-fixed">
    <Card className="shadow-sm rounded-xl filtersection">
      <Card.Body className="p-2">
        {/* Map Preview */}
        <div className="map-preview-wrapper mb-2">
          <img
            src="/images/map.jpg"
            alt="Map preview"
            className="map-preview-img"
          />
          <button className="map-overlay-btn">
            EXPLORE ON MAP 📍
          </button>
        </div>

        {/* Hotel name search */}
        <Form.Control
          type="text"
          placeholder="Search hotel name..."
          className="mb-3"
          value={hotelSearchTerm}
          onChange={(e) => setHotelSearchTerm(e.target.value)}
        />

        {/* Star Rating */}
        <Form.Group className="mb-3">
          <Form.Label className="fw-semibold small">Star Rating</Form.Label>
          <Select
            options={starOptions}
            value={starRating}
            onChange={setStarRating}
            placeholder="All Stars"
            isClearable
            className="modern-select-sm"
            menuPortalTarget={document.body}
            styles={{
              control: (base) => ({
                ...base,
                height: "36px",
                minHeight: "36px",
                width: "100%",
              }),
              menuPortal: (base) => ({ ...base, zIndex: 9999 }),
              menu: (base) => ({ ...base, zIndex: 9999 }),
            }}
          />
        </Form.Group>

        <hr className="my-2" />

        {/* Sort */}
        <Form.Group className="mb-3">
          <Form.Label className="fw-semibold small">Sort By Price</Form.Label>
          <div className="d-flex gap-2">
            <Button
              size="sm"
              className={`sort-pill w-50 ${sortBy === "priceAsc" ? "active" : ""}`}
              onClick={() => setSortBy("priceAsc")}
            >
              Price ↑
            </Button>
            <Button
              size="sm"
              className={`sort-pill w-50 ${sortBy === "priceDesc" ? "active" : ""}`}
              onClick={() => setSortBy("priceDesc")}
            >
              Price ↓
            </Button>
          </div>
        </Form.Group>

        <hr className="my-2" />

        {/* Hotel Type */}
        <Form.Group className="mb-3">
          <Form.Label className="fw-semibold small">Hotel Type</Form.Label>
          <div className="filter-checkbox-list">
            {hotelTypeOptions.map((item) => (
              <Form.Check
                key={item.value}
                type="checkbox"
                id={`pkg-hotel-type-${item.value}`}
                label={item.label}
                checked={hotelType.some((t) => t.value === item.value)}
                onChange={(e) => {
                  if (e.target.checked)
                    setHotelType([...hotelType, item]);
                  else
                    setHotelType(hotelType.filter((t) => t.value !== item.value));
                }}
              />
            ))}
          </div>
        </Form.Group>

        <hr className="my-2" />

        {/* Channel
        <Form.Group className="mb-3">
          <Form.Label className="fw-semibold small">Channel</Form.Label>
          <div className="filter-checkbox-list">
            {channelTypeOptions.map((item) => (
              <Form.Check
                key={item.value}
                type="checkbox"
                id={`pkg-channel-${item.value}`}
                label={item.label}
                checked={channelType.some((c) => c.value === item.value)}
                onChange={(e) => {
                  if (e.target.checked)
                    setChannelType([...channelType, item]);
                  else
                    setChannelType(channelType.filter((c) => c.value !== item.value));
                }}
              />
            ))}
          </div>
        </Form.Group> */}

        <hr className="my-2" />

        {/* Clear All */}
        <Button
          className="clear-pill w-100"
          variant="outline-primary"
          size="sm"
          onClick={clearAllFilters}
        >
          Clear All Filters
        </Button>

      </Card.Body>
    </Card>
  </div>
</Col>

                              {/* ────────────────────────────────────
                                  RIGHT COLUMN
                              ──────────────────────────────────── */}
                              <Col lg={9}>

                            


                                {/* ── Skeleton cards — first load only ── */}
                                {isLoading && allResults.length === 0 && (
                                  <Row xs={1} className="g-4">
                                    {[1, 2, 3].map((i) => (
                                      <SkeletonHotelCard key={i} />
                                    ))}
                                  </Row>
                                )}

                                {/* ── Hotel result cards ── */}
                                {(!isLoading || allResults.length > 0) && (
                                  <Row xs={1} className="g-4">
                                    {filteredResults.length > 0 ? (
                                      filteredResults.map((hotel) => (
                                        <Col key={hotel.id}>
                                          <div
                                            style={{
                                              backgroundColor: "white",
                                              border: "1px solid #dee2e6",
                                              borderRadius: "12px",
                                              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                              overflow: "hidden",
                                            }}
                                          >
                                            <Row className="g-0">
                                              <Col md={4} lg={3}>
                                                <div
                                                  style={{
                                                    position: "relative",
                                                    height: "100%",
                                                    minHeight: "180px",
                                                    padding: "12px",
                                                  }}
                                                >
                                                  <LazyImage
                                                    src={hotel.image}
                                                    alt={hotel.name}
                                                    style={{
                                                      width: "100%",
                                                      height: "100%",
                                                      objectFit: "cover",
                                                      borderRadius: "8px",
                                                    }}
                                                  />
                                                  {/* Star + channel badge */}
                                                  <div
                                                    style={{
                                                      position: "absolute",
                                                      top: "22px",
                                                      left: "22px",
                                                      backgroundColor: "rgba(0,0,0,0.7)",
                                                      color: "white",
                                                      padding: "4px 8px",
                                                      borderRadius: "15px",
                                                      fontSize: "12px",
                                                      display: "flex",
                                                      alignItems: "center",
                                                      gap: "4px",
                                                    }}
                                                  >
                                                    <FaStar className="text-warning" />
                                                    {hotel.rating}
                                                    <span
                                                      style={{
                                                        marginLeft: "4px",
                                                        backgroundColor: "#6c757d",
                                                        padding: "1px 6px",
                                                        borderRadius: "10px",
                                                      }}
                                                    >
                                                      {(
                                                        hotel.channelType || ""
                                                      ).toUpperCase()}
                                                    </span>
                                                  </div>
                                                </div>
                                              </Col>

                                              <Col md={8} lg={9}>
                                                <div
                                                  style={{
                                                    padding: "16px",
                                                    height: "100%",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    justifyContent: "space-between",
                                                  }}
                                                >
                                                  <div>
                                                    <div className="d-flex align-items-center mb-1 gap-2">
                                                      <h6
                                                        style={{
                                                          fontSize: "1rem",
                                                          fontWeight: "600",
                                                          marginBottom: 0,
                                                          color: "#333",
                                                        }}
                                                      >
                                                        {hotel.name || "Hotel Name Not Available"}
                                                      </h6>
                                                      <div className="d-flex gap-1">
                                                        {renderStars(hotel.rating)}
                                                      </div>
                                                    </div>

                                                    <p
                                                      style={{
                                                        fontSize: "0.85rem",
                                                        color: "#666",
                                                        marginBottom: "6px",
                                                      }}
                                                    >
                                                      📍{" "}
                                                      {hotel.address || "Address Not Available"}
                                                    </p>

                                                    {hotel.badge && (
                                                      <span
                                                        style={{
                                                          backgroundColor: "#28a745",
                                                          color: "white",
                                                          padding: "3px 8px",
                                                          borderRadius: "4px",
                                                          fontSize: "0.72rem",
                                                          fontWeight: "500",
                                                          display: "inline-block",
                                                          marginBottom: "8px",
                                                        }}
                                                      >
                                                        {hotel.badge}
                                                      </span>
                                                    )}
                                                  </div>

                                                  <div
                                                    style={{
                                                      display: "flex",
                                                      justifyContent: "space-between",
                                                      alignItems: "center",
                                                      paddingTop: "10px",
                                                      borderTop: "1px solid #eee",
                                                    }}
                                                  >
                                                    <div
                                                      style={{
                                                        fontSize: "1.1rem",
                                                        fontWeight: "600",
                                                        color: "#333",
                                                      }}
                                                    >
                                                      {hotel.price
                                                        ? `AED ${hotel.price.toLocaleString()}`
                                                        : "Price on request"}
                                                    </div>

                                                    <Button
                                                      className="btn-view-rooms"
                                                      size="sm"
                                                      onClick={() => handleViewRooms(hotel)}
                                                    >
                                                      {expandedHotels[hotel.id]
                                                        ? "Hide Rooms"
                                                        : "View Rooms"}
                                                    </Button>
                                                  </div>
                                                </div>
                                              </Col>
                                            </Row>

                                            {/* ── Inline Room List ── */}
                                            {expandedHotels[hotel.id] && (
                                              <div className="border-top p-3 bg-light">
                                                {loadingRooms[hotel.id] ? (
                                                  <div className="text-center py-4">
                                                    <Spinner
                                                      animation="border"
                                                      variant="primary"
                                                    />
                                                    <p className="mt-2 text-muted">
                                                      Fetching rooms...
                                                    </p>
                                                  </div>
                                                ) : hotelRooms[hotel.id] ? (
                                                  <div className="room-categories-section">
                                                    {(
                                                      hotelRooms[hotel.id].hotels[0]
                                                        .roomCategories || []
                                                    ).map((category, idx) => (
                                                     <Accordion
  activeKey={activeAccordion[hotel.id + "-" + idx] || null}
  onSelect={(eventKey) => {
    const key = hotel.id + "-" + idx;
    setActiveAccordion((prev) => ({
      ...prev,
      [key]: prev[key] === eventKey ? null : eventKey,
    }));
  }}
  className="mb-3"
>
  <Accordion.Item
    eventKey="0"
    className="room-category-item border-0 shadow-sm"
  >
    <Accordion.Header className="room-category-header">
      <div className="d-flex justify-content-between align-items-center w-100">

        {/* LEFT CONTENT */}
        <div>
          <h6 className="mb-1 fw-bold">{category.roomCategory}</h6>
          <p className="mb-0 text-muted small">
            {category.baseRoomType}
          </p>
        </div>

        {/* RIGHT CONTENT WITH ARROW */}
        <div className="d-flex align-items-center gap-3">
          <div className="text-end">
            <span className="fw-bold text-primary">
              From {formatPrice(Math.min(...category.availableRates.map(r => r.rate)))}
            </span>
            <div className="small text-muted">
              {category.availableRates.length} rates
            </div>
          </div>

          {/* 🔥 ARROW ICON */}
          <FaChevronDown
            style={{
              transition: "transform 0.3s ease",
              transform:
                activeAccordion[hotel.id + "-" + idx] === "0"
                  ? "rotate(180deg)"
                  : "rotate(0deg)",
            }}
          />
        </div>
      </div>
    </Accordion.Header>
                                                          <Accordion.Body className="room-rates-section p-3">
                                                            <Row>
                                                              {category.availableRates.map(
                                                                (rate, rIdx) => (
                                                                  <Col
                                                                    key={rIdx}
                                                                  md={6} lg={4} xl={5} className="mb-3"
                                                                  >
                                                                    <Card className="rate-card h-100 border-0 shadow-sm">
                                                                      <Card.Body className="p-3">
                                                                        <div className="rate-header mb-3 pb-2 border-bottom">
                                                                          <div className="d-flex align-items-center gap-2 mb-2">
                                                                            {getMealPlanIcon(
                                                                              rate.mealPlan
                                                                            )}
                                                                            <span className="fw-semibold small">
                                                                              {rate.mealPlan}
                                                                            </span>
                                                                          </div>
                                                                          <div className="mb-1">
                                                                            {getRoomStatusBadge(
                                                                              rate.roomStatus
                                                                            )}
                                                                          </div>
                                                                          <div>
                                                                            {getRefundStatusBadge(
                                                                              rate.nonRefundable
                                                                            )}
                                                                          </div>
                                                                        </div>

                                                                        <div className="rate-pricing mb-3 text-center">
                                                                          <div className="current-price fs-4 fw-bold text-success">
                                                                            {formatPrice(
                                                                              rate.totalRate
                                                                            )}
                                                                          </div>
                                                                          {rate.recommendedRetailPrice >
                                                                            rate.totalRate && (
                                                                            <div className="original-price text-muted text-decoration-line-through small">
                                                                              {formatPrice(
                                                                                rate.recommendedRetailPrice
                                                                              )}
                                                                            </div>
                                                                          )}
                                                                          <div className="price-per-night text-muted small">
                                                                            per night
                                                                          </div>
                                                                        </div>

                                                                        <div className="rate-features mb-3">
                                                                          <div className="feature-item d-flex align-items-start gap-2 mb-1">
                                                                            <FaInfoCircle
                                                                              className="text-muted mt-1"
                                                                              size={12}
                                                                            />
                                                                            <span className="small">
                                                                              {rate.contractLabel}
                                                                            </span>
                                                                          </div>
                                                                          {rate.cancellationPolicies &&
                                                                            rate.cancellationPolicies
                                                                              .length > 0 &&
                                                                            typeof rate
                                                                              .cancellationPolicies[0] ===
                                                                              "object" && (
                                                                              <div className="feature-item d-flex align-items-start gap-2">
                                                                                <FaShieldAlt
                                                                                  className="text-muted mt-1"
                                                                                  size={12}
                                                                                />
                                                                                <span
                                                                                  className="small"
                                                                                  title={
                                                                                    rate
                                                                                      .cancellationPolicies[0]
                                                                                      .policyText
                                                                                  }
                                                                                >
                                                                                  Cancellation Policy
                                                                                  Applies
                                                                                </span>
                                                                              </div>
                                                                            )}
                                                                        </div>

                                                                        <div className="d-grid gap-2">
                                                                          <Button
                                                                            variant="primary"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                              handleAddToCart(
                                                                                hotel.id,
                                                                                rate
                                                                              )
                                                                            }
                                                                          >
                                                                            Add to Package
                                                                          </Button>
                                                                        </div>
                                                                      </Card.Body>
                                                                    </Card>
                                                                  </Col>
                                                                )
                                                              )}
                                                            </Row>
                                                          </Accordion.Body>
                                                        </Accordion.Item>
                                                      </Accordion>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <div className="text-center py-3 text-muted">
                                                    No rooms available.
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </Col>
                                      ))
                                    ) : (
                                      <Col xs={12}>
                                        <Card className="shadow-sm rounded-xl">
                                          <Card.Body className="text-center text-muted py-5">
                                            <FaSearch className="display-4 text-muted mb-3" />
                                            <h5>No results found</h5>
                                            <p>
                                              {channelType.length > 0
                                                ? `No hotels found for selected channel(s): ${channelType
                                                    .map((c) => c.label)
                                                    .join(", ")}`
                                                : hasActiveFilters
                                                ? "No hotels match your current filters. Try adjusting or clearing some filters."
                                                : "Try adjusting your search criteria."}
                                            </p>
                                            {hasActiveFilters && (
                                              <Button
                                                variant="outline-primary"
                                                size="sm"
                                                onClick={clearAllFilters}
                                              >
                                                Clear All Filters
                                              </Button>
                                            )}
                                          </Card.Body>
                                        </Card>
                                      </Col>
                                    )}
                                  </Row>
                                )}

                                {/* ── Bottom pagination ── */}
                                {filteredResults.length > 0 && !hasActiveFilters && (
                                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-4">
                                    <small className="text-muted fw-semibold">
                                      Showing {startEntry}–{endEntry} of {totalElements}{" "}
                                      results
                                    </small>
                                    <Pagination className="mb-0 pagination-modern">
                                      <Pagination.Prev
                                        disabled={pageIndex === 0}
                                        onClick={() => goToPage(pageIndex - 1)}
                                      />
                                      {pageNumbers.map((n) => (
                                        <Pagination.Item
                                          key={n}
                                          active={n === pageIndex + 1}
                                          onClick={() => goToPage(n - 1)}
                                        >
                                          {n}
                                        </Pagination.Item>
                                      ))}
                                      <Pagination.Next
                                        disabled={pageIndex >= effectiveTotalPages - 1}
                                        onClick={() => goToPage(pageIndex + 1)}
                                      />
                                    </Pagination>
                                  </div>
                                )}

                              </Col>
                              {/* end right Col */}
                            </Row>
                          </div>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Tab>

                {/* ═══════════════════════════════════════
                    TRANSFER TAB
                ═══════════════════════════════════════ */}
                <Tab
                  eventKey="transfer"
                  title={
                    <>
                      <FaCar className="me-2" /> Transfer
                    </>
                  }
                >
                  <Card className="border-0 shadow-sm rounded-4">
                    <Card.Body>
                      <h5 className="fw-bold text-primary mb-3">Transfer Search</h5>
                      <Form onSubmit={handleTransferSearchSubmit}>
                        <Row className="g-3">
                          <Col md={2}>
                            <Form.Label>Pickup Date</Form.Label>
                            <Form.Control
                              type="date"
                              value={transferPickupDate}
                              onChange={(e) => setTransferPickupDate(e.target.value)}
                              min={new Date().toISOString().split("T")[0]}
                            />
                          </Col>
                          <Col md={2}>
                            <Form.Label>Dropoff Date</Form.Label>
                            <Form.Control
                              type="date"
                              value={transferDropoffDate}
                              onChange={(e) => setTransferDropoffDate(e.target.value)}
                              min={transferPickupDate || undefined}
                            />
                          </Col>
                          <Col md={2}>
                            <Form.Label>Adults</Form.Label>
                            <Form.Select
                              value={transferAdults}
                              onChange={(e) =>
                                setTransferAdults(parseInt(e.target.value) || 1)
                              }
                            >
                              {Array.from({ length: 9 }, (_, i) => i + 1).map((num) => (
                                <option key={num} value={num}>
                                  {num}
                                </option>
                              ))}
                            </Form.Select>
                          </Col>
                          <Col md={2}>
                            <Form.Label>Children</Form.Label>
                            <Form.Select
                              value={transferChildren}
                              onChange={(e) =>
                                setTransferChildren(parseInt(e.target.value) || 0)
                              }
                            >
                              {Array.from({ length: 6 }, (_, i) => i).map((num) => (
                                <option key={num} value={num}>
                                  {num}
                                </option>
                              ))}
                            </Form.Select>
                          </Col>
                          {transferChildren > 0 && (
                            <Col md={4}>
                              <Form.Label className="mb-2">Child Ages</Form.Label>
                              <Row className="g-2">
                                {transferChildAges.map((age, index) => (
                                  <Col key={index} md={3} sm={4} xs={6}>
                                    <Form.Control
                                      type="number"
                                      min="0"
                                      max="17"
                                      placeholder={`Child ${index + 1} age`}
                                      value={age}
                                      onChange={(e) =>
                                        handleTransferChildAgeChange(index, e.target.value)
                                      }
                                    />
                                  </Col>
                                ))}
                              </Row>
                            </Col>
                          )}
                          <Col md={3} className="d-flex align-items-end cab-search">
                            <Button
                              variant="warning"
                              className="w-100 py-2"
                              type="submit"
                              disabled={transferLoading}
                            >
                              {transferLoading ? (
                                <>
                                  <Spinner animation="border" size="sm" className="me-2" />
                                  Searching...
                                </>
                              ) : (
                                <>
                                  <FaSearch className="me-2" /> Search
                                </>
                              )}
                            </Button>
                          </Col>
                        </Row>
                      </Form>

                      {transferLoading && (
                        <Card className="shadow-sm rounded-xl mb-4 mt-4">
                          <Card.Body className="text-center py-5">
                            <div className="results-loader">
                              <div className="loader-ring">
                                <span></span><span></span><span></span><span></span>
                              </div>
                              <h4 className="text-primary fw-bold mt-3 mb-1">
                                Searching Transfers...
                              </h4>
                              <p className="text-muted small mb-0">
                                Finding available transfer options
                              </p>
                            </div>
                          </Card.Body>
                        </Card>
                      )}

                      {!hasTransferSearched && !transferLoading && (
                        <div className="text-center text-muted mt-5">
                          <FaCar className="fs-1 mb-3 text-secondary" />
                          <h6>
                            No transfer results yet. Run a search to view available
                            transfers.
                          </h6>
                        </div>
                      )}

                      {hasTransferSearched && !transferLoading && transferResults.length > 0 && (
                        <div className="mt-4">
                          <h6 className="fw-bold mb-3">
                            Transfer Results ({transferResults.length})
                          </h6>
                          <Row className="g-4">
                            {transferResults.map((cab) => (
                              <Col key={cab.cabid} lg={10} xl={9} className="mx-auto">
                                <Card className="mb-4 shadow-sm" style={{ borderRadius: "12px" }}>
                                  <Card.Body>
                                    <Row className="mb-3">
                                      <Col md={3} sm={4} xs={12} className="mb-3 mb-md-0">
                                        <div
                                          style={{
                                            width: "100%",
                                            height: "200px",
                                            borderRadius: "8px",
                                            overflow: "hidden",
                                            backgroundColor: "#f5f5f5",
                                          }}
                                        >
                                          <LazyImage src={cab.cabpic} alt={cab.cabname} />
                                        </div>
                                      </Col>
                                      <Col
                                        md={9}
                                        sm={8}
                                        xs={12}
                                        className="d-flex align-items-center"
                                      >
                                        <div>
                                          <h5
                                            className="fw-bold mb-2"
                                            style={{ fontSize: "1.5rem", color: "#333" }}
                                          >
                                            {cab.cabname || "Transfer Vehicle"}
                                          </h5>
                                          {cab.cabdetails && (
                                            <p
                                              className="text-muted mb-0"
                                              style={{ fontSize: "0.9rem" }}
                                            >
                                              {cab.cabdetails}
                                            </p>
                                          )}
                                        </div>
                                      </Col>
                                    </Row>

                                    {cab.searchCabDetailsDTO &&
                                      cab.searchCabDetailsDTO.length > 0 && (
                                        <div className="table-responsive">
                                          <Table striped bordered hover className="mb-0">
                                            <thead style={{ backgroundColor: "#f8f9fa" }}>
                                              <tr>
                                                <th style={{ fontWeight: "600", padding: "12px" }}>
                                                  Transfer Option
                                                </th>
                                                <th style={{ fontWeight: "600", padding: "12px" }}>
                                                  Share Type
                                                </th>
                                                <th style={{ fontWeight: "600", padding: "12px" }}>
                                                  Total Price
                                                </th>
                                                <th
                                                  style={{
                                                    fontWeight: "600",
                                                    padding: "12px",
                                                    width: "150px",
                                                  }}
                                                >
                                                  Action
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {cab.searchCabDetailsDTO.map((detail, idx) => {
                                                const rate =
                                                  detail.types === "SIC"
                                                    ? detail.sicRate
                                                    : detail.privateRate;
                                                const totalRate =
                                                  detail.totalRateWithoutMrk || rate || 0;
                                                const uniqueId = `${cab.cabid}-${detail.dropDetails}-${detail.paxDetails}-${detail.types}`;
                                                const isAdding = addingTransferId === uniqueId;

                                                return (
                                                  <tr key={idx}>
                                                    <td
                                                      style={{
                                                        padding: "12px",
                                                        verticalAlign: "middle",
                                                      }}
                                                    >
                                                      {detail.location || "N/A"} -{" "}
                                                      {detail.dropOff || "N/A"}
                                                    </td>
                                                    <td
                                                      style={{
                                                        padding: "12px",
                                                        verticalAlign: "middle",
                                                      }}
                                                    >
                                                      <span
                                                        style={{
                                                          fontSize: "0.9rem",
                                                          fontWeight: 600,
                                                          color: "#333",
                                                        }}
                                                      >
                                                        {detail.types}
                                                      </span>
                                                    </td>
                                                    <td
                                                      style={{
                                                        padding: "12px",
                                                        verticalAlign: "middle",
                                                      }}
                                                    >
                                                      <span
                                                        style={{
                                                          fontSize: "1rem",
                                                          fontWeight: "600",
                                                          color: "#333",
                                                        }}
                                                      >
                                                        AED {totalRate.toLocaleString()}
                                                      </span>
                                                    </td>
                                                    <td
                                                      style={{
                                                        padding: "12px",
                                                        verticalAlign: "middle",
                                                        textAlign: "center",
                                                      }}
                                                    >
                                                      <OverlayTrigger
                                                        placement="top"
                                                        overlay={
                                                          !hasHotelInCart ? (
                                                            <Tooltip id={`tooltip-transfer-${idx}`}>
                                                              Search and add hotels first, then only these will be enabled
                                                            </Tooltip>
                                                          ) : <></>
                                                        }
                                                      >
                                                        <span className="d-inline-block">
                                                          <Button
                                                            variant="success"
                                                            size="sm"
                                                            className="add-transfer-to-cart"
                                                            onClick={() =>
                                                              handleAddTransferToCart(cab, detail)
                                                            }
                                                            disabled={isAdding || !hasHotelInCart}
                                                            style={{ minWidth: "120px", pointerEvents: !hasHotelInCart ? 'none' : 'auto' }}
                                                          >
                                                            {isAdding ? (
                                                              <>
                                                                <Spinner
                                                                  size="sm"
                                                                  className="me-2"
                                                                />
                                                                Adding...
                                                              </>
                                                            ) : (
                                                              "Add to cart"
                                                            )}
                                                          </Button>
                                                        </span>
                                                      </OverlayTrigger>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </Table>
                                        </div>
                                      )}
                                  </Card.Body>
                                </Card>
                              </Col>
                            ))}
                          </Row>
                        </div>
                      )}

                      {hasTransferSearched && !transferLoading && transferResults.length === 0 && (
                        <div className="text-center text-muted mt-5">
                          <FaCar className="fs-1 mb-3 text-secondary" />
                          <h6>No transfers found for the selected dates.</h6>
                          <p className="small">
                            Please try different dates or contact support.
                          </p>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Tab>

                {/* ═══════════════════════════════════════
                    TOURS & ACTIVITIES TAB
                ═══════════════════════════════════════ */}
                <Tab
                  eventKey="tours"
                  title={
                    <>
                      <FaTicketAlt className="me-2" /> Tours & Activities
                    </>
                  }
                >
                  <Card className="border-0 shadow-sm rounded-4">
                    <Card.Body>
                      <h5 className="fw-bold text-primary mb-3">Activities Search</h5>
                      <Form onSubmit={handleTourSearchSubmit}>
                        <Row className="g-3">
                          <Col md={2}>
                            <Form.Label>Tour Date</Form.Label>
                            <Form.Control
                              type="date"
                              value={tourDate}
                              onChange={(e) => setTourDate(e.target.value)}
                              min={new Date().toISOString().split("T")[0]}
                            />
                          </Col>
                          <Col md={2}>
                            <Form.Label>Adults</Form.Label>
                            <Form.Select
                              value={tourAdults}
                              onChange={(e) =>
                                setTourAdults(parseInt(e.target.value) || 1)
                              }
                            >
                              {Array.from({ length: 9 }, (_, i) => i + 1).map((num) => (
                                <option key={num} value={num}>
                                  {num}
                                </option>
                              ))}
                            </Form.Select>
                          </Col>
                          <Col md={2}>
                            <Form.Label>Children</Form.Label>
                            <Form.Select
                              value={tourChildren}
                              onChange={(e) =>
                                setTourChildren(parseInt(e.target.value) || 0)
                              }
                            >
                              {Array.from({ length: 6 }, (_, i) => i).map((num) => (
                                <option key={num} value={num}>
                                  {num}
                                </option>
                              ))}
                            </Form.Select>
                          </Col>
                          {tourChildren > 0 && (
                            <Col md={4}>
                              <Form.Label className="mb-2">Child Ages</Form.Label>
                              <Row className="g-2">
                                {tourChildAges.map((age, index) => (
                                  <Col key={index} md={3} sm={4} xs={6}>
                                    <Form.Control
                                      type="number"
                                      min="0"
                                      max="17"
                                      placeholder={`Child ${index + 1} age`}
                                      value={age}
                                      onChange={(e) =>
                                        handleTourChildAgeChange(index, e.target.value)
                                      }
                                    />
                                  </Col>
                                ))}
                              </Row>
                            </Col>
                          )}
                          <Col md={3} className="d-flex align-items-end activity-search">
                            <Button
                              variant="warning"
                              className="w-100 py-2"
                              type="submit"
                              disabled={tourLoading}
                            >
                              {tourLoading ? (
                                <>
                                  <Spinner animation="border" size="sm" className="me-2" />
                                  Searching...
                                </>
                              ) : (
                                <>
                                  <FaSearch className="me-2" /> Search
                                </>
                              )}
                            </Button>
                          </Col>
                        </Row>
                      </Form>

                      {tourLoading && (
                        <Card className="shadow-sm rounded-xl mb-4 mt-4">
                          <Card.Body className="text-center py-5">
                            <div className="results-loader">
                              <div className="loader-ring">
                                <span></span><span></span><span></span><span></span>
                              </div>
                              <h4 className="text-primary fw-bold mt-3 mb-1">
                                Searching Activities...
                              </h4>
                              <p className="text-muted small mb-0">
                                Finding available activity options
                              </p>
                            </div>
                          </Card.Body>
                        </Card>
                      )}

                      {!hasTourSearched && !tourLoading && (
                        <div className="text-center text-muted mt-5">
                          <FaTicketAlt className="fs-1 mb-3 text-secondary" />
                          <h6>
                            No activities yet. Run a search to view available activities.
                          </h6>
                        </div>
                      )}

                      {hasTourSearched && !tourLoading && tourResults.length > 0 && (
                        <div className="mt-4">
                          <h6 className="fw-bold mb-3">
                            Tour & Activity Results ({tourResults.length})
                          </h6>
                          <Row xs={1} sm={2} md={3} lg={3} xl={3} className="g-4">
                            {tourResults.map((activity) => (
                              <Col key={activity.id}>
                                <div
                                  style={{
                                    backgroundColor: "white",
                                    border: "1px solid #dee2e6",
                                    borderRadius: "12px",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      position: "relative",
                                      height: "200px",
                                      overflow: "hidden",
                                    }}
                                  >
                                    <LazyImage
                                      src={activity.activityImage}
                                      alt={activity.activityName}
                                    />
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: "10px",
                                        right: "10px",
                                        backgroundColor: "rgba(0,0,0,0.7)",
                                        color: "white",
                                        padding: "4px 8px",
                                        borderRadius: "15px",
                                        fontSize: "12px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                      }}
                                    >
                                      {activity.starRating > 0 && (
                                        <>
                                          <FaStar className="text-warning me-1" />
                                          {activity.starRating}
                                        </>
                                      )}
                                      {activity.apiType && (
                                        <span
                                          style={{
                                            marginLeft: "4px",
                                            backgroundColor: "#6c757d",
                                            padding: "1px 6px",
                                            borderRadius: "10px",
                                          }}
                                        >
                                          {activity.apiType.toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div style={{ padding: "16px", backgroundColor: "white" }}>
                                    <h6
                                      style={{
                                        fontSize: "1rem",
                                        fontWeight: "600",
                                        marginBottom: "8px",
                                        color: "#333",
                                        lineHeight: "1.3",
                                      }}
                                    >
                                      {activity.activityName || "Activity Name Not Available"}
                                    </h6>

                                    {activity.duration && (
                                      <div
                                        style={{
                                          fontSize: "0.875rem",
                                          color: "#666",
                                          marginBottom: "10px",
                                        }}
                                      >
                                        <FaTicketAlt className="text-info me-2" />
                                        Duration: {activity.duration}
                                      </div>
                                    )}

                                    <div
                                      style={{
                                        backgroundColor:
                                          activity.totalRate > 0 ? "#28a745" : "#6c757d",
                                        color: "white",
                                        padding: "3px 8px",
                                        borderRadius: "4px",
                                        fontSize: "0.72rem",
                                        fontWeight: "500",
                                        display: "inline-block",
                                        marginBottom: "10px",
                                      }}
                                    >
                                      {activity.totalRate > 0
                                        ? "Rate Available"
                                        : "Rate on Request"}
                                    </div>

                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginTop: "10px",
                                        paddingTop: "10px",
                                        borderTop: "1px solid #eee",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: "1.2rem",
                                          fontWeight: "600",
                                          color: "#333",
                                        }}
                                      >
                                        {activity.totalRate > 0
                                          ? `${activity.currency} ${activity.totalRate.toLocaleString()}`
                                          : "-"}
                                      </div>

                                      <div className="d-flex gap-2 align-items-center">
                                        <Button
                                          variant="info"
                                          size="sm"
                                          onClick={() => {
                                            setSelectedActivity(activity);
                                            setShowActivityModal(true);
                                          }}
                                          style={{
                                            minWidth: "36px",
                                            padding: "5px 7px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                          }}
                                          title="View Details"
                                        >
                                          <FaEye size={13} />
                                        </Button>
                                          <OverlayTrigger
                                            placement="top"
                                            overlay={
                                              !hasHotelInCart ? (
                                                <Tooltip id={`tooltip-activity-${activity.id}`}>
                                                  Search and add hotels first, then only these will be enabled
                                                </Tooltip>
                                              ) : <></>
                                            }
                                          >
                                            <span className="d-inline-block">
                                              <Button
                                          variant="primary"
                                          size="sm"
                                          className="activity-add-to-cart"
                                          disabled={
                                            addingActivityId ===
                                              (activity.id || activity.activityId) ||
                                            !hasHotelInCart
                                          }
                                          title={!hasHotelInCart ? "Search and add hotels first, then only these will be enabled" : ""}
                                          onClick={() => handleAddActivityToCart(activity)}
                                        >
                                          {addingActivityId ===
                                          (activity.id || activity.activityId) ? (
                                            <>
                                              <Spinner
                                                animation="border"
                                                size="sm"
                                                className="me-2"
                                              />
                                              Adding...
                                            </>
                                          ) : (
                                            "Add to Cart"
                                          )}
                                            </Button>
                                          </span>
                                        </OverlayTrigger>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </Col>
                            ))}
                          </Row>
                        </div>
                      )}

                      {hasTourSearched && !tourLoading && tourResults.length === 0 && (
                        <div className="text-center text-muted mt-5">
                          <FaTicketAlt className="fs-1 mb-3 text-secondary" />
                          <h6>No activities found for the selected date.</h6>
                          <p className="small">
                            Please try different dates or contact support.
                          </p>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>

          {/* ═══════════════════════════════════════
              ACTIVITY DETAILS MODAL
          ═══════════════════════════════════════ */}
          <Modal
            show={showActivityModal}
            onHide={() => {
              setShowActivityModal(false);
              setSelectedActivity(null);
            }}
            size="lg"
            centered
          >
            <Modal.Header closeButton>
              <Modal.Title>Activity Details</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {selectedActivity && (
                <>
                  <div className="mb-4">
                    <img
                      src={selectedActivity.activityImage}
                      alt={selectedActivity.activityName}
                      style={{
                        width: "100%",
                        height: "300px",
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                      onError={(e) => {
                        e.target.src =
                          "https://via.placeholder.com/800x300?text=Activity+Image";
                      }}
                    />
                  </div>

                  <div className="mb-3">
                    <h4 className="fw-bold">
                      {selectedActivity.activityName || "Activity Name"}
                    </h4>
                    {selectedActivity.starRating > 0 && (
                      <div className="d-flex align-items-center mb-2">
                        <FaStar className="text-warning me-1" />
                        <span>{selectedActivity.starRating} Star Rating</span>
                      </div>
                    )}
                  </div>

                  {selectedActivity.activityDetails && (
                    <div className="mb-3">
                      <h6 className="fw-semibold mb-2">Description</h6>
                      <p className="text-muted" style={{ whiteSpace: "pre-wrap" }}>
                        {selectedActivity.activityDetails}
                      </p>
                    </div>
                  )}

                  <Row className="g-3 mb-3">
                    {selectedActivity.minPaxsic > 0 && (
                      <Col md={6}>
                        <div>
                          <strong>Min Pax:</strong> {selectedActivity.minPaxsic}
                        </div>
                      </Col>
                    )}
                    {selectedActivity.maxPax > 0 && (
                      <Col md={6}>
                        <div>
                          <strong>Max Pax:</strong> {selectedActivity.maxPax}
                        </div>
                      </Col>
                    )}
                    {selectedActivity.childMin > 0 && (
                      <Col md={6}>
                        <div>
                          <strong>Child Age Range:</strong> {selectedActivity.childMin} -{" "}
                          {selectedActivity.childMax} years
                        </div>
                      </Col>
                    )}
                    {selectedActivity.duration && (
                      <Col md={6}>
                        <div>
                          <FaTicketAlt className="me-2" />
                          <strong>Duration:</strong> {selectedActivity.duration}
                        </div>
                      </Col>
                    )}
                    {selectedActivity.adultRate > 0 && (
                      <Col md={6}>
                        <div>
                          <strong>Adult Rate:</strong> {selectedActivity.currency}{" "}
                          {selectedActivity.adultRate.toLocaleString()}
                        </div>
                      </Col>
                    )}
                    {selectedActivity.childRate > 0 && (
                      <Col md={6}>
                        <div>
                          <strong>Child Rate:</strong> {selectedActivity.currency}{" "}
                          {selectedActivity.childRate.toLocaleString()}
                        </div>
                      </Col>
                    )}
                    {selectedActivity.apiType && (
                      <Col md={6}>
                        <div>
                          <strong>API Type:</strong> {selectedActivity.apiType}
                        </div>
                      </Col>
                    )}
                  </Row>

                  <div className="mt-4 p-3 bg-light rounded">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h5 className="mb-0">
                          {selectedActivity.totalRate > 0
                            ? `${selectedActivity.currency} ${selectedActivity.totalRate.toLocaleString()}`
                            : "Price on request"}
                        </h5>
                        {selectedActivity.totalRateWithoutMrk > 0 &&
                          selectedActivity.totalRateWithoutMrk !==
                            selectedActivity.totalRate && (
                            <small className="text-muted">
                              Without markup: {selectedActivity.currency}{" "}
                              {selectedActivity.totalRateWithoutMrk.toLocaleString()}
                            </small>
                          )}
                      </div>
                      <Badge bg={selectedActivity.totalRate > 0 ? "success" : "secondary"}>
                        {selectedActivity.totalRate > 0 ? "Rate Available" : "Rate on Request"}
                      </Badge>
                    </div>
                  </div>
                </>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowActivityModal(false);
                  setSelectedActivity(null);
                }}
              >
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setShowActivityModal(false);
                  setSelectedActivity(null);
                }}
              >
                Select Activity
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </div>
  );
}
