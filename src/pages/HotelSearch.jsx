import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  Button,
  Row,
  Col,
  Form,
  Pagination,
  Spinner,
} from "react-bootstrap";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import Select from "react-select";
import axiosInstance from "../components/AxiosInstance";
import { FaSearch, FaStar } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "../styles/HotelSearch.css";

// ─────────────────────────────────────────────
// Search Progress Bar
// ─────────────────────────────────────────────
function SearchProgressBar({ pollStatus, completedChannels }) {
  const channels = [
    "inhouse",
    // "iwtx",
    // "x3",
    // "ratehawk",
    // "darina",
    // "atharva",
    // "jumeirah",
  ];
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pollStatus === "IN_PROGRESS") {
      setVisible(true);
      const done = completedChannels.size;
      const target =
        done === 0 ? 12 : Math.min(90, 12 + (done / channels.length) * 78);
      setProgress(target);
    } else if (pollStatus === "COMPLETED") {
      setProgress(100);
      const timer = setTimeout(() => setVisible(false), 900);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      setProgress(0);
    }
  }, [pollStatus, completedChannels]);

  if (!visible) return null;

  return (
    <div className="search-progress-bar-wrap">
      {/* Label row */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="search-progress-label">Searching hotels...</span>
        <span className="search-progress-percent">{Math.round(progress)}%</span>
      </div>

      {/* Bar */}
      <div className="search-progress-track">
        <div
          className="search-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Channel pills */}
      {/* <div className="search-progress-channels">
        {channels.map((ch) => {
          const done = completedChannels.has(ch);
          return (
            <span key={ch} className={`channel-pill ${done ? "done" : "pending"}`}>
              {done ? "✓" : <span className="pill-dot" />}
              {ch}
            </span>
          );
        })}
      </div> */}
    </div>
  );
}

// ─────────────────────────────────────────────
// Counter Button helper
// ─────────────────────────────────────────────
function Counter({ value, min, max, onChange }) {
  return (
    <div className="rgs-counter">
      <button
        type="button"
        className="rgs-counter-btn"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        −
      </button>
      <span className="rgs-counter-val">{value}</span>
      <button
        type="button"
        className="rgs-counter-btn"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Room Guest Selector
// ─────────────────────────────────────────────
function RoomGuestSelector({ value, onChange }) {
  const [rooms, setRooms] = useState(value);

  const update = (next) => {
    setRooms(next);
    onChange && onChange(next);
  };

  const addRoom = () =>
    update([...rooms, { adults: 1, children: 0, childAges: [] }]);
  const removeRoom = (index) => update(rooms.filter((_, i) => i !== index));

  const setAdults = (index, adults) =>
    update(rooms.map((r, i) => (i === index ? { ...r, adults } : r)));

  const setChildren = (index, children) =>
    update(
      rooms.map((r, i) =>
        i === index
          ? {
              ...r,
              children,
              childAges: Array.from(
                { length: children },
                (_, j) => r.childAges[j] || 5,
              ),
            }
          : r,
      ),
    );

  const setChildAge = (roomIdx, childIdx, age) =>
    update(
      rooms.map((r, i) => {
        if (i !== roomIdx) return r;
        const ages = [...r.childAges];
        ages[childIdx] = age;
        return { ...r, childAges: ages };
      }),
    );

  return (
    <div className="rgs-wrap">
      <div className="rgs-grid">
        {rooms.map((room, i) => (
          <div key={i} className="rgs-room-card">
            <div className="rgs-room-header">
              <span className="rgs-room-label">🛏 Room {i + 1}</span>
              {rooms.length > 1 && (
                <button
                  type="button"
                  className="rgs-remove-btn"
                  onClick={() => removeRoom(i)}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="rgs-counters-col">
              <div className="rgs-counter-row">
                <div className="rgs-counter-info">
                  <span className="rgs-counter-title">Adults</span>
                  <span className="rgs-counter-sub">Age 18+</span>
                </div>
                <Counter
                  value={room.adults}
                  min={1}
                  max={6}
                  onChange={(v) => setAdults(i, v)}
                />
              </div>
              <div className="rgs-counter-row">
                <div className="rgs-counter-info">
                  <span className="rgs-counter-title">Children</span>
                  <span className="rgs-counter-sub">Age 0–17</span>
                </div>
                <Counter
                  value={room.children}
                  min={0}
                  max={4}
                  onChange={(v) => setChildren(i, v)}
                />
              </div>
            </div>

            {room.children > 0 && (
              <div className="rgs-child-ages">
                <span className="rgs-child-ages-label">Child ages</span>
                <div className="rgs-child-ages-row">
                  {Array.from({ length: room.children }).map((_, idx) => (
                    <div key={idx} className="rgs-child-age-select">
                      <label className="rgs-child-age-label">
                        Child {idx + 1}
                      </label>
                      <Form.Select
                        size="sm"
                        value={room.childAges[idx] || 5}
                        onChange={(e) =>
                          setChildAge(i, idx, parseInt(e.target.value))
                        }
                        className="rgs-age-dropdown"
                      >
                        {Array.from({ length: 18 }).map((__, age) => (
                          <option key={age} value={age}>
                            {age} {age === 1 ? "yr" : "yrs"}
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        <button type="button" className="rgs-add-room-btn" onClick={addRoom}>
          <span className="rgs-add-icon">+</span>
          <span>Add Room</span>
        </button>
      </div>
    </div>
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
      className={`ratio rounded-xl overflow-hidden ${className || ""}`}
      style={{ "--bs-aspect-ratio": "66.25%" }}
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
        />
      )}
    </div>
  );
}

const fullText = "Search Hotel Name...";

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function HotelSearch() {
  const [placeholder, setPlaceholder] = useState("");
  const navigate = useNavigate();
  const [nationalityList, setNationalityList] = useState([]);
  const [selectedNationality, setSelectedNationality] = useState(null);
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [nights, setNights] = useState(1);
  const [agent, setAgent] = useState("");
  const [rooms, setRooms] = useState([
    { adults: 1, children: 0, childAges: [] },
  ]);
  const [roomsOpen, setRoomsOpen] = useState(false);

  const [starRating, setStarRating] = useState(null);
  const [hotelType, setHotelType] = useState([]);
  const [channelType, setChannelType] = useState([]);
  const [sortBy, setSortBy] = useState("priceAsc");
  const [hotelSearchTerm, setHotelSearchTerm] = useState("");
  const [errors, setErrors] = useState({});
  const [clickedHotelIds, setClickedHotelIds] = useState([]);

  const [allResults, setAllResults] = useState([]);
  const [finalHotelSearchTerm, setFinalHotelSearchTerm] = useState("");
  const [agents, setAgents] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasSearchResult, setHasSearchResult] = useState(false);
  const [pollStatus, setPollStatus] = useState("IDLE");
  const completedChannelsRef = useRef(new Set());
  const [completedChannels, setCompletedChannels] = useState(new Set());
  const [searchId, setSearchId] = useState(null);
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);
  const resultsRef = useRef(null);
  const [isInitialResultsLoaded, setIsInitialResultsLoaded] = useState(false);

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
    // { value: "atharva", label: "Atharva" },
    // { value: "jumeirah", label: "Jumeirah" },
    // { value: "ratehawk", label: "Ratehawk" },
    // { value: "darina", label: "Darina" },
  ];

  useEffect(() => {
    let index = 0;
    let isDeleting = false;
    const interval = setInterval(() => {
      if (!isDeleting) {
        setPlaceholder(fullText.slice(0, index + 1));
        index++;
        if (index === fullText.length)
          setTimeout(() => (isDeleting = true), 900);
      } else {
        setPlaceholder(fullText.slice(0, index - 1));
        index--;
        if (index === 0) isDeleting = false;
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const debouncedCitySearch = useRef(
    debounce(async (searchText = "") => {
      if (!searchText || searchText.length < 2) {
        setDestinationOptions([]);
        return;
      }
      setIsDestinationLoading(true);
      try {
        const response = await axiosInstance.get(
          `/api/province?search=${searchText}`,
        );
        const cityApiRes = Array.isArray(response.data) ? response.data : [];
        const options = cityApiRes.slice(0, 50).map((city) => ({
          value: city.id,
          label: `${city.stateName}, ${city.country}`,
          countryId: city.countryId,
        }));
        setDestinationOptions(options);
      } catch {
        setDestinationOptions([]);
      } finally {
        setIsDestinationLoading(false);
      }
    }, 300),
  ).current;

  const debouncedSetFinalTerm = useRef(
    debounce((term) => {
      setFinalHotelSearchTerm(term);
    }, 500),
  ).current;

  useEffect(() => {
    if (checkIn && checkOut) {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      const diff = Math.max(
        1,
        Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
      );
      setNights(diff);
    }
  }, [checkIn, checkOut]);

  const handleNightsChange = (value) => {
    const val = Math.max(1, Number(value) || 1);
    setNights(val);
    if (checkIn) {
      const start = new Date(checkIn);
      const out = new Date(start);
      out.setDate(start.getDate() + val);
      const iso = new Date(out.getTime() - out.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
      setCheckOut(iso);
    }
  };

  const filteredResults = useMemo(() => {
    let results = allResults;

    if (starRating) {
      results = results.filter(
        (hotel) => Number(hotel.rating) === Number(starRating.value),
      );
    }
    if (hotelType.length > 0) {
      const selectedTypes = hotelType.map((t) => t.value);
      results = results.filter((hotel) =>
        selectedTypes.includes(hotel.hotelType),
      );
    }
    if (channelType.length > 0) {
      const selectedChannels = channelType.map((c) => c.value);
      results = results.filter((hotel) =>
        selectedChannels.includes(hotel.channelType),
      );
    }
    return results;
  }, [allResults, hotelSearchTerm, starRating, hotelType, channelType]);

  const effectiveTotalPages = useMemo(
    () => Math.max(1, totalPages),
    [totalPages],
  );

  const startEntry = totalElements === 0 ? 0 : pageIndex * pageSize + 1;
  const endEntry = Math.min((pageIndex + 1) * pageSize, totalElements);

  const pageNumbers = useMemo(() => {
    const current = pageIndex + 1;
    const total = effectiveTotalPages;
    const nums = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) nums.push(i);
    } else {
      nums.push(1);
      const left = Math.max(2, current - 1);
      const right = Math.min(total - 1, current + 1);
      if (left > 2) nums.push("ellipsis-left");
      for (let i = left; i <= right; i++) nums.push(i);
      if (right < total - 1) nums.push("ellipsis-right");
      nums.push(total);
    }
    return nums;
  }, [pageIndex, effectiveTotalPages]);

  const goToPage = (idx) => {
    const total = effectiveTotalPages;
    if (idx < 0 || idx >= total) return;
    setPageIndex(idx);
    setTimeout(() => {
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 0);
  };

  const countryList = async () => {
    try {
      const response = await axiosInstance.get("/api/country");
      const options = Array.isArray(response.data)
        ? response.data.map((country) => ({
            value: country.id,
            label: country.name,
            code: country.countryCode,
          }))
        : [];
      setNationalityList(options);
    } catch {
      setNationalityList([]);
    }
  };

  const cityList = (searchText = "") => debouncedCitySearch(searchText);

  const loadPopularDestinations = async () => {
    if (destinationOptions.length > 0) return;
    try {
      setIsDestinationLoading(true);
      const response = await axiosInstance.get("/api/province?limit=50");
      const cityApiRes = Array.isArray(response.data) ? response.data : [];
      const options = cityApiRes.map((city) => ({
        value: city.id,
        // label: `${city.name}, ${city.state} , ${city.country}`,
         label: `${city.stateName},${city.country}`,
        countryId: city.countryId,
      }));
      setDestinationOptions(options);
    } catch {
      // silently fail
    } finally {
      setIsDestinationLoading(false);
    }
  };

  const agentList = async () => {
    try {
      const response = await axiosInstance.get("/api/agent");
      setAgents(response.data);
    } catch {
      setAgents([]);
    }
  };

  useEffect(() => {
    countryList();
    agentList();
  }, []);

  useEffect(() => {
    setPageIndex(0);
    if (hasSearchResult && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [starRating, hotelType, channelType, sortBy]);

  const formatDate = (date) => date.toISOString().split("T")[0];
  const getTomorrow = (date = new Date()) => {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  };

  const today = formatDate(new Date());
  const minCheckOutDate = checkIn
    ? formatDate(getTomorrow(new Date(checkIn)))
    : formatDate(getTomorrow());

  const validateForm = () => {
    const newErrors = {};
    if (!selectedNationality) newErrors.nationality = "Nationality is required";
    if (!selectedDestination) newErrors.destination = "Destination is required";
    if (!checkIn) newErrors.checkIn = "Check-in date is required";
    if (!checkOut) newErrors.checkOut = "Check-out date is required";
    if (!agent) newErrors.agent = "Agent is required";
    return newErrors;
  };

  const clearError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _omit, ...rest } = prev;
      return rest;
    });
  };

  const fetchHotels = async (page, sid, agentId, nameSearch = "") => {
    try {
      const isNameSearching = !!nameSearch.trim();
      const endpoint = isNameSearching
        ? `/api/hotel-search/results/${sid}/filter-by-name`
        : `/api/hotel-search/results/${sid}`;

      const params = {
        agentId: agentId || agent || 1,
        page,
        pageSize,
        sortBy:
          sortBy === "priceAsc" || sortBy === "priceDesc" ? "baseRate" : sortBy,
        sortOrder:
          sortBy === "priceAsc" ||
          sortBy === "ratingAsc" ||
          sortBy === "nameAsc"
            ? "asc"
            : "desc",
        starRating: starRating ? starRating.value : undefined,
        apiType:
          channelType.map((c) => c.value.toUpperCase()).join(",") || undefined,
      };

      if (isNameSearching) {
        params.hotelName = nameSearch.trim();
      }

      const res = await axiosInstance.get(endpoint, {
        params,
      });

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
              "https://details/assets/details/profilepic/hotel/hoteldefault.jpg",
            rating: hotel.starRating || 0,
            hotelType: "hotel",
            channelType: hotel.apiType?.toLowerCase() || "inhouse",
          }))
        : [];

      if (mappedResults.length > 0 || isNameSearching) {
        if (pollStatus === "IN_PROGRESS" && !isNameSearching) {
          setAllResults((prev) => {
            const map = new Map(prev.map((h) => [h.id, h]));
            mappedResults.forEach((h) => map.set(h.id, h));
            return Array.from(map.values());
          });
        } else {
          setAllResults(mappedResults);
        }
      } else if (!isNameSearching && pollStatus !== "IN_PROGRESS") {
        setAllResults([]);
      }

      setTotalElements(Number(res.data.totalResults) || mappedResults.length);
      setTotalPages(
        Math.max(
          1,
          Math.ceil(
            (Number(res.data.totalResults) || mappedResults.length) / pageSize,
          ),
        ),
      );
      setHasSearchResult(true);
      return res.data;
    } catch (err) {
      console.error("Fetch hotels failed:", err);
      if (!nameSearch) setPollStatus("ERROR");
      throw err;
    }
  };

  const pollUntilComplete = async (
    url,
    params,
    checkComplete,
    onUpdate,
    intervalMs = 2000,
    timeoutMs = 20000,
    initialDelay = 2000,
  ) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let localPollCount = 0;

      const poll = async () => {
        try {
          localPollCount++;
          const res = await axiosInstance.get(url, { params });
          if (onUpdate) onUpdate(res.data, localPollCount);
          if (checkComplete(res.data)) {
            setPollStatus("COMPLETED");
            return resolve(res.data);
          }
          if (Date.now() - startTime >= timeoutMs) {
            setPollStatus("TIMEOUT");
            return reject(new Error("Polling timed out"));
          }
          setTimeout(poll, intervalMs);
        } catch (err) {
          console.error("Poll failed:", err);
          setPollStatus("ERROR");
          reject(err);
        }
      };

      setPollStatus("IN_PROGRESS");
      setTimeout(poll, initialDelay);
    });
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      setHasSearched(false);
      return;
    }

    setErrors({});
    setIsLoading(true);
    setHasSearched(true);
    setHasSearchResult(false);
    setAllResults([]);
    setPollStatus("IDLE");
    setPageIndex(0);
    setTotalElements(0);
    setTotalPages(1);
    setIsInitialResultsLoaded(false);
    completedChannelsRef.current = new Set();
    setCompletedChannels(new Set());

    try {
      const nationalityId = selectedNationality.value;
      const nationalityCode = selectedNationality.code;
      const destinationCityId = selectedDestination.value;
      const destinationCountryId = selectedDestination.countryId;
      const noOfRooms = String(rooms.length);

      const roomConfigurations = rooms.map((room, index) => ({
        roomNo: index + 1,
        adultCount: String(room.adults || 1),
        childCount: String(room.children || 0),
        childAges: room.childAges?.length ? room.childAges : [0],
        adultAges: room.adultAges?.length ? room.adultAges : [25],
      }));

      const agentId = agent || 1;

      const searchPayloadReq = {
        nationalityId,
        nationalityCode,
        destinationCityId,
        destinationCountryId,
        checkIn,
        checkOut,
        noOfRooms,
        roomConfigurations,
        agentId,
      };

      const searchKeyRes = await axiosInstance.post(
        "/api/hotel-search/search",
        searchPayloadReq,
      );
      const newSearchId = searchKeyRes.data.searchId;
      if (!newSearchId) throw new Error("No searchId returned");
      setSearchId(newSearchId);

      const params = {
        agentId,
        page: 0,
        pageSize,
        sortBy:
          sortBy === "priceAsc" || sortBy === "priceDesc" ? "baseRate" : sortBy,
        sortOrder:
          sortBy === "priceAsc" ||
          sortBy === "ratingAsc" ||
          sortBy === "nameAsc"
            ? "asc"
            : "desc",
        starRating: starRating ? starRating.value : undefined,
        apiType:
          channelType.map((c) => c.value.toUpperCase()).join(",") || undefined,
      };

      const expectedChannels = [
        "inhouse",
        // "iwtx",
        // "x3",
        // "ratehawk",
        // "darina",
        // "atharva",
        // "jumeirah",
      ];

      await pollUntilComplete(
        `/api/hotel-search/results/${newSearchId}`,
        params,
        (data) => data.finalStatus === "COMPLETED",
        (data, pollCount) => {
          const mappedResults = Array.isArray(data.result)
            ? data.result.map((hotel, index) => ({
                id: hotel.hotelCode
                  ? `${newSearchId}-${hotel.hotelCode}`
                  : `${newSearchId}-h${index + 1}`,
                searchId: newSearchId,
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
                  "https://details/assets/details/profilepic/hotel/hoteldefault.jpg",
                rating: hotel.starRating || 0,
                hotelType: "hotel",
                channelType: hotel.apiType?.toLowerCase() || "inhouse",
              }))
            : [];

          setAllResults((prev) => {
            const map = new Map(prev.map((h) => [h.id, h]));
            mappedResults.forEach((h) => map.set(h.id, h));
            return Array.from(map.values());
          });

          const currentStatuses = data.status || {};
          expectedChannels.forEach((ch) => {
            if (
              currentStatuses[ch] === "COMPLETED" &&
              !completedChannelsRef.current.has(ch)
            ) {
              completedChannelsRef.current.add(ch);
            }
          });
          setCompletedChannels(new Set(completedChannelsRef.current));

          if (pollCount === 1 || mappedResults.length > 0) {
            setHasSearchResult(true);
            if (
              completedChannelsRef.current.size >= 1 ||
              mappedResults.length > 0
            ) {
              setIsInitialResultsLoaded(true);
            }
          }

          setTotalElements(Number(data.totalResults) || mappedResults.length);
          setTotalPages(
            Math.max(
              1,
              Math.ceil(
                (Number(data.totalResults) || mappedResults.length) / pageSize,
              ),
            ),
          );
        },
        2000,
        20000,
        2000,
      );
    } catch (err) {
      console.error("Search failed:", err);
      setHasSearched(false);
      setPollStatus("ERROR");
    } finally {
      setIsLoading(false);
    }
  };

  // const showResultsDuringPolling =
  //   hasSearchResult &&
  //   isInitialResultsLoaded &&
  //   (pollStatus === "IN_PROGRESS" || pollStatus === "COMPLETED");

  const showResultsDuringPolling = hasSearchResult || allResults.length > 0;

  useEffect(() => {
    if (!searchId || !hasSearched) return;
    if (pollStatus === "IN_PROGRESS") return;
    setIsLoading(true);
    fetchHotels(pageIndex, searchId, agent, finalHotelSearchTerm).finally(() =>
      setIsLoading(false),
    );
  }, [
    pageIndex,
    sortBy,
    starRating,
    channelType,
    searchId,
    agent,
    hasSearched,
    pollStatus,
    finalHotelSearchTerm,
  ]);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4">
          {/* ── Search Card ── */}
          <Card className="shadow-sm rounded-xl mb-4 search-card-modern bg-white">
            <Card.Body className="p-4">
              <div className="mb-4 text-start">
                <h2 className="fw-semibold text-primary mb-1">
                  Find Your Perfect Stay
                </h2>
                <p className="text-muted">
                  Discover amazing hotels and exclusive deals
                </p>
              </div>

              <Form onSubmit={handleSearchSubmit}>
                <Row className="g-4">
                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Destination
                      </Form.Label>
                      <Select
                        options={destinationOptions}
                        value={selectedDestination}
                        onChange={(option) => {
                          setSelectedDestination(option);
                          if (option) clearError("destination");
                        }}
                        placeholder="Where do you want to go?"
                        isSearchable
                        isClearable
                        className="modern-select"
                        isLoading={isDestinationLoading}
                        noOptionsMessage={() =>
                          isDestinationLoading
                            ? "Searching destinations..."
                            : "Type to search destinations..."
                        }
                        onMenuOpen={() => {
                          if (destinationOptions.length === 0)
                            loadPopularDestinations();
                        }}
                        onInputChange={(inputValue, { action }) => {
                          if (action === "input-change") cityList(inputValue);
                        }}
                        menuPortalTarget={document.body}
                        styles={{
                          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          control: (base) => ({
                            ...base,
                            minHeight: "42px",
                            border: "1px solid #dee2e6",
                            "&:hover": { borderColor: "#86b7fe" },
                          }),
                          menu: (base) => ({
                            ...base,
                            zIndex: 9999,
                            maxHeight: "200px",
                          }),
                          option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isFocused
                              ? "#f8f9fa"
                              : "white",
                            color: state.isSelected ? "white" : "#212529",
                            "&:active": { backgroundColor: "#0d6efd" },
                          }),
                          clearIndicator: (base) => ({
                            ...base,
                            color: "#6c757d",
                            "&:hover": { color: "#dc3545" },
                          }),
                        }}
                      />
                      {errors.destination && (
                        <div className="text-danger small mt-1">
                          {errors.destination}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Nationality
                      </Form.Label>
                      <Select
                        options={nationalityList}
                        value={selectedNationality}
                        onChange={(option) => {
                          setSelectedNationality(option);
                          if (option) clearError("nationality");
                        }}
                        placeholder="Select nationality"
                        isSearchable
                        isClearable
                        className="modern-select"
                        menuPortalTarget={document.body}
                        styles={{
                          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          control: (base) => ({
                            ...base,
                            minHeight: "42px",
                            border: "1px solid #dee2e6",
                            "&:hover": { borderColor: "#86b7fe" },
                          }),
                        }}
                      />
                      {errors.nationality && (
                        <div className="text-danger small mt-1">
                          {errors.nationality}
                        </div>
                      )}
                    </Form.Group>
                  </Col>
                     <Col lg={3} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Agent
                      </Form.Label>
                      <Form.Select
                        style={{ height: "42px" }}
                        className="form-control-modern"
                        value={agent}
                        onChange={(e) => {
                          setAgent(e.target.value);
                          if (e.target.value) clearError("agent");
                        }}
                      >
                        <option value="">Select Agent</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.companyName}
                          </option>
                        ))}
                      </Form.Select>
                      {errors.agent && (
                        <div className="text-danger small mt-1">
                          {errors.agent}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                

                    <Col lg={2} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Nights
                      </Form.Label>
                      <Form.Control
                        style={{ height: "42px" }}
                        className="form-control-modern"
                        type="number"
                        min={1}
                        max={60}
                        value={nights}
                        onChange={(e) => handleNightsChange(e.target.value)}
                      />
                    </Form.Group>
                  </Col>

                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Check-in
                      </Form.Label>
                      <Form.Control
                        style={{ height: "42px" }}
                        className="form-control-modern"
                        type="date"
                        value={checkIn}
                        min={today}
                        onClick={(e) =>
                          e.target.showPicker && e.target.showPicker()
                        }
                        onChange={(e) => {
                          const newCheckIn = e.target.value;
                          setCheckIn(newCheckIn);
                          if (newCheckIn) {
                            clearError("checkIn");
                            setCheckOut(
                              formatDate(getTomorrow(new Date(newCheckIn))),
                            );
                            clearError("checkOut");
                          }
                        }}
                      />
                      {errors.checkIn && (
                        <div className="text-danger small mt-1">
                          {errors.checkIn}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                    <Col lg={3} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Check-out
                      </Form.Label>
                      <Form.Control
                        style={{ height: "42px" }}
                        className="form-control-modern"
                        type="date"
                        value={checkOut}
                        min={minCheckOutDate}
                        onClick={(e) =>
                          e.target.showPicker && e.target.showPicker()
                        }
                        onChange={(e) => {
                          setCheckOut(e.target.value);
                          if (e.target.value) clearError("checkOut");
                        }}
                      />
                      {errors.checkOut && (
                        <div className="text-danger small mt-1">
                          {errors.checkOut}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  <Col lg={4} md={6}>
                    <Form.Label className="fw-semibold text-dark">
                      Rooms & Guests
                    </Form.Label>
                    <Button
                      variant="outline-primary"
                      className="w-100 text-start rooms-summary-btn-modern"
                      type="button"
                      onClick={() => setRoomsOpen((o) => !o)}
                    >
                      {rooms.reduce((a, r) => a + r.adults, 0)} adults
                      {rooms.reduce((a, r) => a + r.children, 0)
                        ? `, ${rooms.reduce((a, r) => a + r.children, 0)} child`
                        : ""}{" "}
                      · {rooms.length} room{rooms.length > 1 ? "s" : ""}
                      <span className="float-end">{roomsOpen ? "▴" : "▾"}</span>
                    </Button>
                  </Col>

               
                </Row>

                {roomsOpen && (
                  <Row className="g-3 mt-3">
                    <Col md={12}>
                      <RoomGuestSelector value={rooms} onChange={setRooms} />
                    </Col>
                  </Row>
                )}

                <Row className="mt-3">
                  <Col className="d-flex justify-content-center gap-3">
                    <Button
                      type="submit"
                      className="btn-search-modern"
                      disabled={isLoading}
                      size="lg"
                    >
                      {isLoading ? (
                        <>
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Searching...
                        </>
                      ) : (
                        <>
                          <FaSearch className="me-2" />
                          SEARCH HOTELS
                        </>
                      )}
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>

          {/* ── Progress Bar ── */}
          <SearchProgressBar
            pollStatus={pollStatus}
            completedChannels={completedChannels}
          />

          {/* ── Loading skeleton ──
          {hasSearched && !showResultsDuringPolling && (
            <Card className="shadow-sm rounded-xl mb-4">
              <Card.Body className="text-center py-5">
                <div className="results-loader">
                  <div className="loader-ring">
                    <span></span><span></span><span></span><span></span>
                  </div>
                  <h4 className="text-primary fw-bold mt-3 mb-1">
                    Fetching Best Results...
                  </h4>
                  <p className="text-muted small mb-0">
                    Comparing rates across multiple providers
                  </p>
                </div>
              </Card.Body>
            </Card>
          )} */}

          {/* ── Empty state ── */}
          {!hasSearched && !hasSearchResult && (
            <Card className="shadow-sm rounded-xl">
              <Card.Body className="text-center text-muted py-5">
                <FaSearch className="display-4 text-muted mb-3" />
                <h4>Ready to Find Your Perfect Stay?</h4>
                <p>
                  Use the search form above to discover amazing hotels and
                  exclusive deals.
                </p>
              </Card.Body>
            </Card>
          )}

          {/* ── Results section ── */}
          {/* {hasSearched && ( */}
          {(hasSearchResult || allResults.length > 0) && (
            <div ref={resultsRef}>
              <div className="search-layout">
                <Row className="g-4">
                  {/* Left Sidebar */}
                  <Col lg={3} className="leftside d-none d-lg-block">
                    <div className="left-fixed">
                      <Card className="shadow-sm rounded-xl filtersection">
                        <Card.Body className="p-2">
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

                          <Form.Control
                            type="text"
                            placeholder={placeholder}
                            className="ps-3 mb-2"
                            value={hotelSearchTerm}
                            onChange={(e) => {
                              const val = e.target.value;
                              setHotelSearchTerm(val);
                              setPageIndex(0);
                              debouncedSetFinalTerm(val);
                            }}
                          />

                          <Form.Group className="mb-2">
                            <Form.Label className="fw-semibold small">
                              Hotel Type
                            </Form.Label>
                            <div className="filter-checkbox-list">
                              {hotelTypeOptions.map((item) => (
                                <Form.Check
                                  key={item.value}
                                  type="checkbox"
                                  id={`hotel-type-${item.value}`}
                                  label={item.label}
                                  checked={hotelType.some(
                                    (t) => t.value === item.value,
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked)
                                      setHotelType([...hotelType, item]);
                                    else
                                      setHotelType(
                                        hotelType.filter(
                                          (t) => t.value !== item.value,
                                        ),
                                      );
                                  }}
                                />
                              ))}
                            </div>
                          </Form.Group>

                          <hr />

                          <Form.Group>
                            <Form.Label className="fw-semibold small">
                              Channel
                            </Form.Label>
                            <div className="filter-checkbox-list">
                              {channelTypeOptions.map((item) => (
                                <Form.Check
                                  key={item.value}
                                  type="checkbox"
                                  id={`channel-${item.value}`}
                                  label={item.label}
                                  checked={channelType.some(
                                    (c) => c.value === item.value,
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked)
                                      setChannelType([...channelType, item]);
                                    else
                                      setChannelType(
                                        channelType.filter(
                                          (c) => c.value !== item.value,
                                        ),
                                      );
                                  }}
                                />
                              ))}
                            </div>
                          </Form.Group>
                        </Card.Body>
                      </Card>
                    </div>
                  </Col>

                  {/* Right Content */}
                  <Col lg={9}>
                    <Card className="shadow-sm rounded-xl mb-3 filtersection">
                      <Card.Body className="p-2">
                        <div className="d-flex align-items-center gap-3 flex-wrap">
                          <Select
                            options={starOptions}
                            value={starRating}
                            onChange={setStarRating}
                            placeholder="All Stars"
                            className="modern-select-sm"
                            menuPortalTarget={document.body}
                            styles={{
                              control: (base) => ({
                                ...base,
                                height: "36px",
                                minHeight: "36px",
                                width: "180px",
                                background: "#ffffff",
                                color: "#000000",
                                marginLeft: "30px",
                              }),
                              menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                              menu: (base) => ({ ...base, zIndex: 9999 }),
                            }}
                          />

                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              className={`sort-pill ${sortBy === "priceAsc" ? "active" : ""}`}
                              onClick={() => setSortBy("priceAsc")}
                            >
                              Low to High
                            </Button>
                            <Button
                              size="sm"
                              className={`sort-pill ${sortBy === "priceDesc" ? "active" : ""}`}
                              onClick={() => setSortBy("priceDesc")}
                            >
                              High to Low
                            </Button>
                          </div>

                          <Button
                            className="clear-pill"
                            variant="outline-primary"
                            size="sm"
                            onClick={() => {
                              setStarRating(null);
                              setHotelType([]);
                              setChannelType([]);
                              setSortBy("priceAsc");
                              setHotelSearchTerm("");
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>

                    {/* {hasSearched && ( */}
                    {(hasSearchResult || allResults.length > 0) && (
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <small className="text-muted fw-semibold">
                          Showing {startEntry} to {endEntry} of {totalElements}{" "}
                          entries
                          {pollStatus === "IN_PROGRESS" && (
                            <span className="ms-1 text-primary">
                              (updating…)
                            </span>
                          )}
                        </small>
                      </div>
                    )}

                    {isLoading && pollStatus !== "IN_PROGRESS" && (
                      <Card className="shadow-sm rounded-xl mb-4">
                        <Card.Body className="text-center py-4">
                          <Spinner animation="border" variant="primary" />
                          <p className="text-muted mt-2 mb-0">
                            Loading results…
                          </p>
                        </Card.Body>
                      </Card>
                    )}

                    <Row className="g-4">
                      {filteredResults.length > 0 ? (
                        filteredResults.map((hotel) => (
                          <Col xs={12} key={hotel.id}>
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
                                <Col md={4}>
                                  <div
                                    style={{
                                      position: "relative",
                                      height: "100%",
                                      padding: "15px",
                                    }}
                                  >
                                    <LazyImage
                                      src={hotel.image}
                                      alt={hotel.name}
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        borderRadius: "9px",
                                      }}
                                    />
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: "25px",
                                        left: "25px",
                                        backgroundColor: "rgba(0,0,0,0.7)",
                                        color: "white",
                                        padding: "5px 10px",
                                        borderRadius: "15px",
                                        fontSize: "12px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "5px",
                                      }}
                                    >
                                      <FaStar className="text-warning" />
                                      {hotel.rating}
                                      <span
                                        style={{
                                          marginLeft: "5px",
                                          backgroundColor: "#6c757d",
                                          padding: "2px 6px",
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

                                <Col md={8}>
                                  <div style={{ padding: "16px" }}>
                                    <h6
                                      style={{
                                        fontSize: "1.0rem",
                                        fontWeight: "600",
                                        marginBottom: "8px",
                                        color: "#333",
                                      }}
                                    >
                                      {hotel.name || "Hotel Name Not Available"}
                                    </h6>

                                    <p
                                      style={{
                                        fontSize: "0.875rem",
                                        color: "#666",
                                        marginBottom: "8px",
                                      }}
                                    >
                                      📍{" "}
                                      {hotel.address ||
                                        hotel.city ||
                                        "Address Not Available"}
                                    </p>

                                    {hotel.badge && (
                                      <span
                                        style={{
                                          backgroundColor: "#28a745",
                                          color: "white",
                                          padding: "4px 8px",
                                          borderRadius: "4px",
                                          fontSize: "0.75rem",
                                          display: "inline-block",
                                          marginBottom: "12px",
                                        }}
                                      >
                                        {hotel.badge}
                                      </span>
                                    )}

                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginTop: "16px",
                                        paddingTop: "12px",
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
                                        size="sm"
                                        variant={
                                          clickedHotelIds.includes(hotel.id)
                                            ? "secondary"
                                            : "primary"
                                        }
                                        onClick={() => {
                                          setClickedHotelIds((prev) => [
                                            ...prev,
                                            hotel.id,
                                          ]);
                                          const nationalityCode =
                                            (selectedNationality?.code || "")
                                              .length === 2
                                              ? selectedNationality.code
                                              : " ";
                                          const roomsPayload = rooms.map(
                                            (r) => ({
                                              adults: r.adults || 1,
                                              children: r.children || 0,
                                              childAges: r.childAges || [],
                                              adultAges: Array.from(
                                                { length: r.adults || 1 },
                                                () => 30,
                                              ),
                                            }),
                                          );
                                          const apiIdMapping = {
                                            jumeirah: 10,
                                            iwtx: 12,
                                            x3: 15,
                                            inhouse: 1,
                                            ratehawk: 14,
                                            darina: 16,
                                            atharva: 3,
                                          };
                                          const apiId =
                                            apiIdMapping[
                                              hotel.channelType?.toLowerCase()
                                            ] || 0;
                                         
                                          const payload = {
                                            checkInDate: checkIn,
                                            checkOutDate: checkOut,
                                            hotelCode:
                                              hotel.hotelCode ||
                                              hotel.id
                                                ?.split("-")
                                                .slice(1)
                                                .join("-") ||
                                              "",
                                            nationality: nationalityCode,
                                            agentId: String(agent),
                                            apiId,
                                            rooms: roomsPayload,
                                          };
                                          const meta = {
                                            hotelName: hotel.name,
                                            address:
                                              hotel.address || hotel.city,
                                            starRating: hotel.rating || 0,
                                            phone: "",
                                            hotelImage: hotel.image,
                                          };
                                          sessionStorage.setItem(
                                            "roomListPayload",
                                            JSON.stringify({ payload, meta }),
                                          );
                                          setTimeout(() => {
                                            const route =
                                              apiId === 1
                                                ? "/room-list"
                                                : "/api-room-list";
                                            window.open(route, "_blank");
                                          }, 50);
                                        }}
                                      >
                                        View Rooms
                                      </Button>
                                    </div>
                                  </div>
                                </Col>
                              </Row>
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
                                  : "Try adjusting your filters or search criteria."}
                              </p>
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => {
                                  setStarRating(null);
                                  setHotelType([]);
                                  setChannelType([]);
                                  setSortBy("priceAsc");
                                  setHotelSearchTerm("");
                                }}
                              >
                                Clear All Filters
                              </Button>
                            </Card.Body>
                          </Card>
                        </Col>
                      )}
                    </Row>

                    {/* {hasSearched && */}
                    {filteredResults.length > 0 &&
                      totalElements > 0 &&
                      !(hotelSearchTerm || hotelType.length > 0) && (
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4 mt-3">
                          <small className="text-muted fw-semibold"></small>
                          <Pagination className="mb-0 pagination-modern">
                            <Pagination.Prev
                              disabled={pageIndex === 0}
                              onClick={() => goToPage(pageIndex - 1)}
                            />
                            {pageNumbers.map((n) =>
                              typeof n === "number" ? (
                                <Pagination.Item
                                  key={n}
                                  active={n === pageIndex + 1}
                                  onClick={() => goToPage(n - 1)}
                                >
                                  {n}
                                </Pagination.Item>
                              ) : (
                                <Pagination.Ellipsis key={n} disabled />
                              ),
                            )}
                            <Pagination.Next
                              disabled={pageIndex >= effectiveTotalPages - 1}
                              onClick={() => goToPage(pageIndex + 1)}
                            />
                          </Pagination>
                        </div>
                      )}
                  </Col>
                </Row>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
