import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  Button,
  Row,
  Col,
  Form,
  Badge,
  Pagination,
  ButtonGroup,
  ToggleButton,
  Spinner,
  ProgressBar,
} from "react-bootstrap";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import Select from "react-select";
import axiosInstance from "../components/AxiosInstance";
import {
  FaLightbulb,
  FaSearch,
  FaSort,
  FaStar,
  FaBuilding,
  FaGlobe,
} from "react-icons/fa";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/HotelSearch.css";



function RoomGuestSelector({ value, onChange }) {
  const [rooms, setRooms] = useState(value);

  const update = (next) => {
    setRooms(next);
    onChange && onChange(next);
  };

  const addRoom = () =>
    update([...rooms, { adults: 2, children: 0, childAges: [] }]);
  const removeRoom = (index) => update(rooms.filter((_, i) => i !== index));

  const setAdults = (index, adults) => {
    const next = rooms.map((r, i) => (i === index ? { ...r, adults } : r));
    update(next);
  };
  const setChildren = (index, children) => {
    const next = rooms.map((r, i) =>
      i === index
        ? {
          ...r,
          children,
          childAges: Array.from(
            { length: children },
            (_, j) => r.childAges[j] || 5
          ),
        }
        : r
    );
    update(next);
  };
  const setChildAge = (roomIdx, childIdx, age) => {
    const next = rooms.map((r, i) => {
      if (i !== roomIdx) return r;
      const ages = [...r.childAges];
      ages[childIdx] = age;
      return { ...r, childAges: ages };
    });
    update(next);
  };

  return (
    <div className="room-guest-selector">
      {rooms.map((room, i) => (
        <Card key={i} className="mb-2 shadow-sm">
          <Card.Body className="py-2">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="fw-semibold">Room {i + 1}</div>
              {rooms.length > 1 && (
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => removeRoom(i)}
                >
                  Remove
                </Button>
              )}
            </div>
            <div className="d-flex flex-wrap gap-3 align-items-end">
              <Form.Group>
                <Form.Label>Adults</Form.Label>
                <Form.Select
                  value={room.adults}
                  onChange={(e) => setAdults(i, parseInt(e.target.value))}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label>Children</Form.Label>
                <Form.Select
                  value={room.children}
                  onChange={(e) => setChildren(i, parseInt(e.target.value))}
                >
                  {[0, 1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              {Array.from({ length: room.children }).map((_, idx) => (
                <Form.Group key={idx}>
                  <Form.Label>Child {idx + 1} Age</Form.Label>
                  <Form.Select
                    value={room.childAges[idx] || 5}
                    onChange={(e) =>
                      setChildAge(i, idx, parseInt(e.target.value))
                    }
                  >
                    {Array.from({ length: 17 }).map((__, age) => (
                      <option key={age} value={age}>
                        {age}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              ))}
            </div>
          </Card.Body>
        </Card>
      ))}
      <Button variant="outline-primary" size="sm" onClick={addRoom}>
        + Add Room
      </Button>
    </div>
  );
}

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
      className={`ratio  rounded-xl overflow-hidden ${className || ""
        }`}
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



export default function HotelSearch() {

  const [isSticky, setIsSticky] = useState(false);
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

  // Filter states
  const [starRating, setStarRating] = useState(null);
  const [hotelType, setHotelType] = useState([]);
  const [channelType, setChannelType] = useState([]);
  const [sortBy, setSortBy] = useState("priceAsc");
  const [hotelSearchTerm, setHotelSearchTerm] = useState("");
  const [errors, setErrors] = useState({});
  const [clickedHotelIds, setClickedHotelIds] = useState([]); // New state to track clicked hotels

  const [allResults, setAllResults] = useState([]);
  const [agents, setAgents] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState("card");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasSearchResult, setHasSearchResult] = useState(false);
  const [pollStatus, setPollStatus] = useState("IDLE");
  const [completedChannels, setCompletedChannels] = useState(new Set()); // Track completed channels
  const [searchId, setSearchId] = useState(null);
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);
  const resultsRef = useRef(null);
  const [isInitialResultsLoaded, setIsInitialResultsLoaded] = useState(false);

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
    { value: "iwtx", label: "Iwtx" },
    { value: "x3", label: "x3" },
    { value: "ratehawk", label: "Ratehawk" },
    { value: "darina", label: "Darina" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 120); // adjust threshold
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let index = 0;
    let isDeleting = false;

    const interval = setInterval(() => {
      if (!isDeleting) {
        setPlaceholder(fullText.slice(0, index + 1));
        index++;

        if (index === fullText.length) {
          setTimeout(() => (isDeleting = true), 900);
        }
      } else {
        setPlaceholder(fullText.slice(0, index - 1));
        index--;

        if (index === 0) {
          isDeleting = false;
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Debounce utility function
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

  // Debounced city search function
  const debouncedCitySearch = useRef(
    debounce(async (searchText = "") => {
      if (!searchText || searchText.length < 2) {
        setDestinationOptions([]);
        return;
      }

      setIsDestinationLoading(true);
      try {
        const response = await axiosInstance.get(
          `/api/province?search=${searchText}`
        );
        const cityApiRes = Array.isArray(response.data) ? response.data : [];
        const options = cityApiRes.slice(0, 50).map((city) => ({
          value: city.id,
          label: `${city.stateName}, ${city.country}`,
          countryId: city.countryId,
        }));
        setDestinationOptions(options);
      } catch (error) {
        // console.log("axios call error for city list:", error);
        setDestinationOptions([]);
      } finally {
        setIsDestinationLoading(false);
      }
    }, 300)
  ).current;

  useEffect(() => {
    if (checkIn && checkOut) {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      const diff = Math.max(
        1,
        Math.ceil((end - start) / (1000 * 60 * 60 * 24))
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

    // Debug: Log all hotel names
    if (results.length > 0) {
      // console.log('All hotel names:', results.map(hotel => hotel.name || hotel.hotelName || 'NO NAME'));
    }

    // Filter by hotel name search
    if (hotelSearchTerm) {
      // console.log('Filtering by hotel search term:', hotelSearchTerm);
      // console.log('Available hotels before filtering:', results.length);
      results = results.filter((hotel) => {
        const hotelName = hotel.name || hotel.hotelName || '';
        const matches = hotelName.toLowerCase().includes(hotelSearchTerm.toLowerCase());
        // console.log(`Hotel: ${hotelName}, Search: ${hotelSearchTerm}, Matches: ${matches}`);
        return matches;
      });
      // console.log('Filtered results after hotel name search:', results.length);
    }

    // Filter by star rating
    // if (starRating.length > 0) {
    //   const selectedStars = starRating.map((s) => s.value);
    //   results = results.filter((hotel) => selectedStars.includes(hotel.rating));
    // }
    if (starRating) {
      results = results.filter(
        (hotel) => Number(hotel.rating) === Number(starRating.value)
      );
    }


    // Filter by hotel type
    if (hotelType.length > 0) {
      const selectedTypes = hotelType.map((t) => t.value);
      results = results.filter((hotel) =>
        selectedTypes.includes(hotel.hotelType)
      );
    }

    // Filter by channel type
    if (channelType.length > 0) {
      const selectedChannels = channelType.map((c) => c.value);
      results = results.filter((hotel) =>
        selectedChannels.includes(hotel.channelType)
      );
    }

    return results;
  }, [allResults, hotelSearchTerm, starRating, hotelType, channelType]);

  // const pageItems = useMemo(() => {
  //   return filteredResults;
  // }, [filteredResults, pageIndex]);

  const pageItems = useMemo(() => {
    // console.log("Page items:", filteredResults.length);
    return filteredResults;
  }, [filteredResults]);

  const effectiveTotalPages = useMemo(
    () => Math.max(1, totalPages),
    [totalPages]
  );

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
    } catch (error) {
      // console.log("error for country list:", error);
      setNationalityList([]);
    }
  };

  const cityList = (searchText = "") => {
    debouncedCitySearch(searchText);
  };

  const loadPopularDestinations = async () => {
    if (destinationOptions.length > 0) return;

    try {
      setIsDestinationLoading(true);
      const response = await axiosInstance.get("/api/province?limit=20");
      const cityApiRes = Array.isArray(response.data) ? response.data : [];
      const options = cityApiRes.map((city) => ({
        value: city.id,
        label: `${city.stateName}, ${city.country}`,
        countryId: city.countryId,
      }));
      setDestinationOptions(options);
    } catch (error) {
      // console.log("Error loading popular destinations:", error);
    } finally {
      setIsDestinationLoading(false);
    }
  };

  const agentList = async () => {
    try {
      const response = await axiosInstance.get("/api/agent");

      setAgents(response.data);
    } catch (error) {
      // console.log("error for agent axios list:", error);
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
  }, [hotelSearchTerm, starRating, hotelType, channelType, sortBy]);

  const formatDate = (date) => date.toISOString().split("T")[0];

  const getTomorrow = (date = new Date()) => {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  };

  const today = formatDate(new Date());

  let minCheckOutDate;
  if (checkIn) {
    minCheckOutDate = formatDate(getTomorrow(new Date(checkIn)));
  } else {
    minCheckOutDate = formatDate(getTomorrow());
  }

  const validateForm = () => {
    const newErrors = {};

    if (!selectedNationality) {
      newErrors.nationality = "Nationality is required";
    }

    if (!selectedDestination) {
      newErrors.destination = "Destination is required";
    }

    if (!checkIn) {
      newErrors.checkIn = "Check-in date is required";
    }

    if (!checkOut) {
      newErrors.checkOut = "Check-out date is required";
    }

    if (!agent) {
      newErrors.agent = "Agent is required";
    }

    return newErrors;
  };

  const clearError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _omit, ...rest } = prev;
      return rest;
    });
  };

  const fetchHotels = async (page, searchId, agentId) => {
    try {
      const params = {
        agentId: agentId || agent || 1, // Use passed agentId, or state agent, or default to 1
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
        // starRating: starRating.map((s) => s.value).join(",") || undefined,
        starRating: starRating ? starRating.value : undefined,
        apiType:
          channelType.map((c) => c.value.toUpperCase()).join(",") || undefined,
      };

      const res = await axiosInstance.get(`/api/hotel-search/results/${searchId}`, {
        params,
      });

      const mappedResults = Array.isArray(res.data.result)
        ? res.data.result.map((hotel, index) => ({
          id: hotel.hotelCode
            ? `${searchId}-${hotel.hotelCode}`
            : `${searchId}-h${index + 1}`,
          searchId,
          hotelCode: hotel.hotelCode || null,
          name: hotel.hotelName || "Unknown Hotel",
          address: hotel.hotelAddress || "",
          city: hotel.hotelAddress
            ? hotel.hotelAddress.split(", ").pop() || "Unknown City"
            : "Unknown City",
          price: hotel.baseRate || null,
          // badge: hotel.baseRate ? "Rate Available" : "Rate Unavailable",
          image:
            hotel.hotelImage ||
            "https://b2b.choosenfly.com/assets/details/profilepic/hotel/hoteldefault.jpg",
          rating: hotel.starRating || 0,
          hotelType: "hotel",
          channelType: hotel.apiType?.toLowerCase() || "inhouse",
        }))
        : [];

      // Clear previous results and set new results for the current page
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
      console.log("hotelType:", hotelType);
      console.log("channelType:", channelType);
      setPollStatus("ERROR");
      throw err;
    }
  };

  const pollUntilComplete = async (
    url,
    params,
    checkComplete,
    onUpdate,
    intervalMs = 4000,
    timeoutMs = 20000,
    initialDelay = 2000
  ) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let localPollCount = 0;

      const poll = async () => {
        try {
          localPollCount++;
          const res = await axiosInstance.get(url, { params });

          if (onUpdate) {
            onUpdate(res.data, localPollCount);
          }

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

  // const fetchHotels = async (page, searchId, agentId) => {
  //   try {
  //     const params = {
  //       agentId: agentId,
  //       page,
  //       pageSize,
  //       sortBy:
  //         sortBy === "priceAsc" || sortBy === "priceDesc" ? "baseRate" : sortBy,
  //       sortOrder:
  //         sortBy === "priceAsc" ||
  //         sortBy === "ratingAsc" ||
  //         sortBy === "nameAsc"
  //           ? "asc"
  //           : "desc",
  //       starRating: starRating.map((s) => s.value).join(",") || undefined,
  //       apiType:
  //         channelType.map((c) => c.value.toUpperCase()).join(",") || undefined,
  //     };

  //     const res = await axiosInstance.get(`/api/hotel-search/results/${searchId}`, {
  //       params,
  //     });

  //     const mappedResults = Array.isArray(res.data.result)
  //       ? res.data.result.map((hotel, index) => ({
  //           id: hotel.hotelCode
  //             ? `${searchId}-${hotel.hotelCode}`
  //             : `${searchId}-h${index + 1}`,
  //           searchId,
  //           hotelCode: hotel.hotelCode || null,
  //           name: hotel.hotelName || "Unknown Hotel",
  //           address: hotel.hotelAddress || "",
  //           city: hotel.hotelAddress
  //             ? hotel.hotelAddress.split(", ").pop() || "Unknown City"
  //             : "Unknown City",
  //           price: hotel.baseRate || null,
  //           badge: hotel.baseRate ? "Rate Available" : "Rate Unavailable",
  //           image:
  //             hotel.hotelImage ||
  //             "https://b2b.choosenfly.com/assets/details/profilepic/hotel/hoteldefault.jpg",
  //           rating: hotel.starRating || 0,
  //           hotelType: "hotel",
  //           channelType: hotel.apiType?.toLowerCase() || "inhouse",
  //         }))
  //       : [];

  //     setAllResults((prevResults) => {
  //       const existingMap = new Map(prevResults.map((h) => [h.id, h]));
  //       const newResults = [...prevResults];
  //       for (const hotel of mappedResults) {
  //         if (!existingMap.has(hotel.id)) {
  //           newResults.push(hotel);
  //         }
  //       }
  //       return newResults;
  //     });

  //     setTotalElements(Number(res.data.totalResults) || mappedResults.length);
  //     setTotalPages(
  //       Math.max(
  //         1,
  //         Math.ceil(
  //           (Number(res.data.totalResults) || mappedResults.length) / pageSize
  //         )
  //       )
  //     );
  //     setHasSearchResult(true);
  //     return res.data;
  //   } catch (err) {
  //     console.error("Fetch hotels failed:", err);
  //     setPollStatus("ERROR");
  //     throw err;
  //   }
  // };

  // const pollUntilComplete = async (
  //   url,
  //   params,
  //   checkComplete,
  //   onUpdate,
  //   intervalMs = 4000,
  //   timeoutMs = 20000,
  //   initialDelay = 2000
  // ) => {
  //   return new Promise((resolve, reject) => {
  //     const startTime = Date.now();
  //     let localPollCount = 0;

  //     const poll = async () => {
  //       try {
  //         localPollCount++;
  //         const res = await axiosInstance.get(url, { params });

  //         // console.log(
  //           `Poll ${localPollCount} received ${
  //             res.data.result?.length || 0
  //           } hotels`
  //         );
  //         // console.log("Full response:", res.data); // For debugging channel statuses

  //         if (onUpdate) {
  //           onUpdate(res.data, localPollCount);
  //         }

  //         if (checkComplete(res.data)) {
  //           setPollStatus("COMPLETED");
  //           return resolve(res.data);
  //         }

  //         if (Date.now() - startTime >= timeoutMs) {
  //           setPollStatus("TIMEOUT");
  //           return reject(new Error("Polling timed out"));
  //         }

  //         setTimeout(poll, intervalMs);
  //       } catch (err) {
  //         console.error("Poll failed:", err);
  //         setPollStatus("ERROR");
  //         reject(err);
  //       }
  //     };

  //     setPollStatus("IN_PROGRESS");
  //     setTimeout(poll, initialDelay);
  //   });
  // };

  const resetForm = () => {
    setSelectedNationality(null);
    setSelectedDestination(null);
    setCheckIn("");
    setCheckOut("");
    setNights(1);
    setAgent("");
    setRooms([{ adults: 1, children: 0, childAges: [] }]);
    setRoomsOpen(false);
    setStarRating(null);
    setHotelType([]);
    setChannelType([]);
    setSortBy("priceAsc");
    setHotelSearchTerm("");
    setErrors({});
    setAllResults([]);
    setHasSearched(false);
    setHasSearchResult(false);
    setPageIndex(0);
    setTotalElements(0);
    setTotalPages(1);
    setPollStatus("IDLE");
    setSearchId(null);
    setCompletedChannels(new Set());
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

      const agentId = agent || 1; // Use selected agent or default to 1

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
        searchPayloadReq
      );
      const searchId = searchKeyRes.data.searchId;
      if (!searchId) throw new Error("No searchId returned");
      setSearchId(searchId);

      const params = {
        agentId: agentId, // Use the dynamic agentId
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
        // starRating: starRating.map((s) => s.value).join(",") || undefined,
        starRating: starRating ? starRating.value : undefined,
        apiType:
          channelType.map((c) => c.value.toUpperCase()).join(",") || undefined,
      };

      const expectedChannels = ["inhouse", "iwtx", "x3", "ratehawk"];

      await pollUntilComplete(
        `/api/hotel-search/results/${searchId}`,
        params,
        (data) => {
          // Check if any individual API is completed OR if finalStatus is completed
          const currentStatuses = data.status || {};
          const hasAnyCompleted = expectedChannels.some(ch => currentStatuses[ch] === "COMPLETED");
          return hasAnyCompleted || data.finalStatus === "COMPLETED";
        },
        (data, pollCount) => {

          const mappedResults = Array.isArray(data.result)
            ? data.result.map((hotel, index) => ({
              id: hotel.hotelCode
                ? `${searchId}-${hotel.hotelCode}`
                : `${searchId}-h${index + 1}`,
              searchId,
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
              channelType: hotel.apiType?.toLowerCase(),
            }))
            : [];

          // Update results for the current page
          setAllResults(mappedResults);

          const currentStatuses = data.status || {};
          const newCompleted = new Set(completedChannels);
          expectedChannels.forEach((ch) => {
            if (
              currentStatuses[ch] === "COMPLETED" &&
              !completedChannels.has(ch)
            ) {
              newCompleted.add(ch);
              // console.log(`Channel ${ch} completed at poll ${pollCount}`);
            }
          });
          setCompletedChannels(newCompleted);

          // Show results immediately if any channel is completed or we have results
          if (pollCount === 1 || mappedResults.length > 0) {
            setHasSearchResult(true);
            // Show results as soon as any channel completes or we have data
            if (newCompleted.size >= 1 || mappedResults.length > 0) {
              setIsInitialResultsLoaded(true);
            }
          }

          setTotalElements(
            Number(data.totalResults) || mappedResults.length
          );
          setTotalPages(
            Math.max(
              1,
              Math.ceil(
                (Number(data.totalResults) || mappedResults.length) / pageSize
              )
            )
          );
        },
        4000,
        20000,
        2000
      );
    } catch (err) {
      console.error("Search failed:", err);
      setHasSearched(false);
      setPollStatus("ERROR");
    } finally {
      setIsLoading(false);
    }
  };
  // const handleSearchSubmit = async (e) => {
  //   e.preventDefault();
  //   const formErrors = validateForm();
  //   if (Object.keys(formErrors).length > 0) {
  //     setErrors(formErrors);
  //     setHasSearched(false);
  //     return;
  //   }
  //   setErrors({});
  //   setIsLoading(true);
  //   setHasSearched(true);
  //   setHasSearchResult(false); // Initial
  //   setAllResults([]);
  //   setPollStatus("IDLE");
  //   setPageIndex(0);
  //   setTotalElements(0);
  //   setTotalPages(1);
  //   setCompletedChannels(new Set());

  //   try {
  //     const nationalityId = selectedNationality.value;
  //     const nationalityCode = selectedNationality.code;
  //     const destinationCityId = selectedDestination.value;
  //     const destinationCountryId = selectedDestination.countryId;
  //     const noOfRooms = String(rooms.length);

  //     const roomConfigurations = rooms.map((room, index) => ({
  //       roomNo: index + 1,
  //       adultCount: String(room.adults || 1),
  //       childCount: String(room.children || 0),
  //       childAges: room.childAges?.length ? room.childAges : [0],
  //       adultAges: room.adultAges?.length ? room.adultAges : [25],
  //     }));

  //     const agentId = 1;

  //     const searchPayloadReq = {
  //       nationalityId,
  //       nationalityCode,
  //       destinationCityId,
  //       destinationCountryId,
  //       checkIn,
  //       checkOut,
  //       noOfRooms,
  //       roomConfigurations,
  //       agentId,
  //     };

  //     const searchKeyRes = await axiosInstance.post(
  //       "/api/hotel-search/search",
  //       searchPayloadReq
  //     );
  //     const searchId = searchKeyRes.data.searchId;
  //     if (!searchId) throw new Error("No searchId returned");
  //     setSearchId(searchId);

  //     const params = {
  //       agentId: 1,
  //       page: 0,
  //       pageSize,
  //       sortBy:
  //         sortBy === "priceAsc" || sortBy === "priceDesc" ? "baseRate" : sortBy,
  //       sortOrder:
  //         sortBy === "priceAsc" ||
  //         sortBy === "ratingAsc" ||
  //         sortBy === "nameAsc"
  //           ? "asc"
  //           : "desc",
  //       starRating: starRating.map((s) => s.value).join(",") || undefined,
  //       apiType:
  //         channelType.map((c) => c.value.toUpperCase()).join(",") || undefined,
  //     };

  //     // Expected channels (adjust based on your API)
  //     const expectedChannels = ["inhouse", "iwtx", "x3", "ratehawk"];

  //     await pollUntilComplete(
  //       `/api/hotel-search/results/${searchId}`,
  //       params,
  //       (data) => data.finalStatus === "COMPLETED", // Stop when all channels complete
  //       (data, pollCount) => {
  //         // console.log(`Poll ${pollCount} data:`, data);

  //         // Map hotels and group by channel
  //         const mappedResults = Array.isArray(data.result)
  //           ? data.result.map((hotel, index) => ({
  //               id: hotel.hotelCode
  //                 ? `${searchId}-${hotel.hotelCode}`
  //                 : `${searchId}-h${index + 1}`,
  //               searchId,
  //               hotelCode: hotel.hotelCode || null,
  //               name: hotel.hotelName || "Unknown Hotel",
  //               address: hotel.hotelAddress || "",
  //               city: hotel.hotelAddress
  //                 ? hotel.hotelAddress.split(", ").pop() || "Unknown City"
  //                 : "Unknown City",
  //               price: hotel.baseRate || null,
  //               badge: hotel.baseRate ? "Rate Available" : "Rate Unavailable",
  //               image:
  //                 hotel.hotelImage ||
  //                 "https://b2b.choosenfly.com/assets/details/profilepic/hotel/hoteldefault.jpg",
  //               rating: hotel.starRating || 0,
  //               hotelType: "hotel",
  //               channelType: hotel.apiType?.toLowerCase() || "inhouse",
  //             }))
  //           : [];

  //         // Incremental merge: Add only new hotels, preserving order
  //         setAllResults((prevResults) => {
  //           const existingMap = new Map(prevResults.map((h) => [h.id, h]));
  //           const newResults = [...prevResults];
  //           mappedResults.forEach((hotel) => {
  //             if (!existingMap.has(hotel.id)) {
  //               newResults.push(hotel);
  //             }
  //           });
  //           return newResults;
  //         });

  //         // Check and update completed channels (adjust 'data.status' path if different)
  //         const currentStatuses = data.status || {}; // e.g., {iwtx: "COMPLETED", x3: "PROCESSING"}
  //         const newCompleted = new Set(completedChannels);
  //         expectedChannels.forEach((ch) => {
  //           if (
  //             currentStatuses[ch] === "COMPLETED" &&
  //             !completedChannels.has(ch)
  //           ) {
  //             newCompleted.add(ch);
  //             // console.log(`Channel ${ch} completed at poll ${pollCount}`);
  //           }
  //         });
  //         setCompletedChannels(newCompleted);

  //         // Show partial results after first poll with data
  //         if (pollCount === 1 || mappedResults.length > 0) {
  //           setHasSearchResult(true);
  //           // Show results only if at least one channel is complete or enough results are fetched
  //           if (newCompleted.size >= 1 || mappedResults.length >= 10) {
  //             setIsInitialResultsLoaded(true);
  //           }
  //         }

  //         // Update totals (cumulative as channels complete)
  //         setTotalElements(
  //           Number(data.totalResults) ||
  //             allResults.length + mappedResults.length
  //         );
  //         setTotalPages(
  //           Math.max(
  //             1,
  //             Math.ceil(
  //               (Number(data.totalResults) ||
  //                 allResults.length + mappedResults.length) / pageSize
  //             )
  //           )
  //         );

  //         // Log progress
  //         // console.log(
  //           `Completed channels: ${Array.from(newCompleted).join(", ")} (${
  //             newCompleted.size
  //           }/${expectedChannels.length})`
  //         );
  //       },
  //       4000,
  //       20000,
  //       2000
  //     );
  //   } catch (err) {
  //     console.error("Search failed:", err);
  //     setHasSearched(false);
  //     setPollStatus("ERROR");
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  // Show results during polling if we have partial data
  const showResultsDuringPolling =
    hasSearchResult &&
    isInitialResultsLoaded &&
    (pollStatus === "IN_PROGRESS" || pollStatus === "COMPLETED");

  useEffect(() => {
    if (!searchId || !hasSearched) return;

    setIsLoading(true);
    fetchHotels(pageIndex, searchId, agent).finally(() => setIsLoading(false));
  }, [
    pageIndex,
    sortBy,
    starRating,
    channelType,
    searchId,
    agent,
    hasSearched,
  ]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fadeIn {
        animation: fadeIn 0.5s ease-in;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // // Progress message for partial results
  // const progressMessage = pollStatus === "IN_PROGRESS"
  //   ? `Showing results from ${completedChannels.size} channel(s). More coming...`
  //   : null;

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4">
          <Card className={`shadow-sm rounded-xl mb-4 search-card-modern bg-white ${isSticky ? "search-card-sticky" : ""}`}>
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
                          if (destinationOptions.length === 0) {
                            loadPopularDestinations();
                          }
                        }}
                        onInputChange={(inputValue, { action }) => {
                          if (action === "input-change") {
                            cityList(inputValue);
                          }
                        }}
                        menuPortalTarget={document.body}   // 👈 force portal
                        styles={{
                          menuPortal: base => ({ ...base, zIndex: 9999 }),
                          control: (base) => ({
                            ...base,
                            minHeight: "42px",
                            border: "1px solid #dee2e6",
                            "&:hover": {
                              borderColor: "#86b7fe",
                            },
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
                            "&:active": {
                              backgroundColor: "#0d6efd",
                            },
                          }),
                          clearIndicator: (base) => ({
                            ...base,
                            color: "#6c757d",
                            "&:hover": {
                              color: "#dc3545",
                            },
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
                        menuPortalTarget={document.body}   // 👈 force portal
                        styles={{
                          menuPortal: base => ({ ...base, zIndex: 9999 }), // 👈 keep menu on top
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
                        onClick={(e) => {
                          e.target.showPicker && e.target.showPicker();
                        }}
                        onChange={(e) => {
                          const newCheckIn = e.target.value;
                          setCheckIn(newCheckIn);
                          if (newCheckIn) clearError("checkIn");

                          if (newCheckIn) {
                            const nextDay = formatDate(getTomorrow(new Date(newCheckIn)));
                            setCheckOut(nextDay);
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
                        onClick={(e) => {
                          e.target.showPicker && e.target.showPicker();
                        }}
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

                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.companyName}
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

          {hasSearched && !showResultsDuringPolling && (
            <Card className="shadow-sm rounded-xl mb-4">
              <Card.Body className="text-center py-5">
                <div className="results-loader">
                  <div className="loader-ring">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
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
          )}

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

          {hasSearched && (
            <div ref={resultsRef}>
              {/* Progress bar for channels */}
              {/* {pollStatus === "IN_PROGRESS" && (
                <Card className="shadow-sm rounded-xl mb-3">
                  <Card.Body className="p-3">
                    <div className="d-flex align-items-center">
                      <ProgressBar
                        now={(completedChannels.size / 4) * 100} // Assuming 4 channels
                        className="flex-grow-1 me-3"
                        variant="primary"
                      />
                      <small className="text-muted">
                        {progressMessage}
                      </small>
                    </div>
                  </Card.Body>
                </Card>
              )} */}

              <div className="search-layout">
                <Row className="g-4">

                  {/* ================= LEFT SIDEBAR ================= */}
                  <Col lg={3} className="leftside  d-none d-lg-block">
                    <div className="left-fixed" style={{ maxWidth: "250px" }} >
                      <Card className=" shadow-sm rounded-xl filtersection " >
                        <Card.Body className=" p-3 ">

                          {/* MAP */}
                          <div className="map-preview-wrapper mb-3">
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
                            className="ps-3"
                            value={hotelSearchTerm}
                            onChange={(e) => setHotelSearchTerm(e.target.value)}
                          /><br />

                          {/* HOTEL TYPE */}
                          <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold small">Hotel Type</Form.Label>

                            <div className="filter-checkbox-list">
                              {hotelTypeOptions.map((item) => {
                                const isChecked = hotelType.some(
                                  (t) => t.value === item.value
                                );

                                return (
                                  <Form.Check
                                    key={item.value}
                                    type="checkbox"
                                    id={`hotel-type-${item.value}`}
                                    label={item.label}
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setHotelType([...hotelType, item]); // ✅ store object
                                      } else {
                                        setHotelType(
                                          hotelType.filter(
                                            (t) => t.value !== item.value
                                          )
                                        );
                                      }
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </Form.Group>

                          <hr />

                          {/* CHANNEL */}
                          <Form.Group>
                            <Form.Label className="fw-semibold small">Channel</Form.Label>

                            <div className="filter-checkbox-list">
                              {channelTypeOptions.map((item) => {
                                const isChecked = channelType.some(
                                  (c) => c.value === item.value
                                );

                                return (
                                  <Form.Check
                                    key={item.value}
                                    type="checkbox"
                                    id={`channel-${item.value}`}
                                    label={item.label}
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setChannelType([...channelType, item]); // ✅ store object
                                      } else {
                                        setChannelType(
                                          channelType.filter(
                                            (c) => c.value !== item.value
                                          )
                                        );
                                      }
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </Form.Group>


                        </Card.Body>
                      </Card>
                    </div>
                  </Col>

                  {/* ================= RIGHT CONTENT ================= */}
                  <Col lg={9} className="position:relative">

                    {/* ===== HORIZONTAL FILTER / SORT BAR ===== */}
                    <Card className="shadow-sm rounded-xl mb-3 filtersection">
                      <Card.Body className="p-2">
                        <div className="d-flex align-items-center gap-3 flex-wrap">

                          {/* STAR RATING */}
                          <Select
                            // isMulti
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
                              menuPortal: (base) => ({
                                ...base,
                                zIndex: 9999, // 🔥 THIS IS THE KEY
                              }),
                              menu: (base) => ({
                                ...base,
                                zIndex: 9999,
                              }),
                            }}
                          />



                          {/* SORT */}
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

                          {/* CLEAR */}
                          <Button
                            className="clear-pill"
                            variant="outline-primary"
                            size="sm"
                            onClick={() => {
                              setStarRating([]);
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

                    {/* ===== PAGINATION INFO ===== */}
                    {hasSearched && (
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <small className="text-muted fw-semibold">
                          Showing {filteredResults.length} results
                        </small>
                      </div>
                    )}

                    {isLoading && (
                      <Card className="shadow-sm rounded-xl mb-4">
                        <Card.Body className="text-center py-5">
                          <div className="loading-animation mb-3">
                            <Spinner animation="border" variant="primary" size="lg" />
                          </div>
                          <h4 className="text-primary fw-bold">
                            Searching the Best Results...
                          </h4>
                          <p className="text-muted">
                            Please wait while we find the perfect hotels for you
                          </p>
                        </Card.Body>
                      </Card>
                    )}


                    <div>
                      {view === "card" && (
                        <Row xs={1} sm={1} md={1} lg={1} xl={1} className="">
                          {filteredResults.length > 0 ? (
                            filteredResults.map((hotel) => {
                              return (
                                <Col key={hotel.id}>

                                </Col>
                              );
                            })
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
                                      setStarRating([]);
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

                      )}

                    </div>


                    {/* ===== RESULT CARDS ===== */}
                    <Row className="g-4">
                      {filteredResults.map((hotel) => (
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
                              {/* ================= LEFT IMAGE ================= */}
                              <Col md={4}>
                                <div
                                  style={{
                                    position: "relative",
                                    height: "100%",
                                    padding: "15px"
                                  }}
                                >
                                  <LazyImage
                                    src={hotel.image}
                                    alt={hotel.name}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                      borderRadius: "9px"

                                    }}
                                  />

                                  {/* Rating & Channel */}
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
                                      {hotel.channelType.toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                              </Col>

                              {/* ================= RIGHT CONTENT ================= */}
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
                                    📍 {hotel.address || hotel.city || "Address Not Available"}
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
                                        setClickedHotelIds((prev) => [...prev, hotel.id]);

                                        const nationalityCode =
                                          (selectedNationality?.code || "").length === 2
                                            ? selectedNationality.code
                                            : " ";

                                        const roomsPayload = rooms.map((r) => ({
                                          adults: r.adults || 1,
                                          children: r.children || 0,
                                          childAges: r.childAges || [],
                                          adultAges: Array.from(
                                            { length: r.adults || 1 },
                                            () => 30
                                          ),
                                        }));

                                        const apiIdMapping = {
                                          jumeirah: 10,
                                          iwtx: 12,
                                          x3: 15,
                                          inhouse: 1,
                                          ratehawk: 14,
                                          darina: 16,
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
                                          address: hotel.address || hotel.city,
                                          starRating: hotel.rating || 0,
                                          phone: "",
                                          hotelImage: hotel.image,
                                        };

                                        sessionStorage.setItem(
                                          "roomListPayload",
                                          JSON.stringify({ payload, meta })
                                        );

                                        setTimeout(() => {
                                          const route = apiId === 1 ? "/room-list" : "/api-room-list";
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
                      ))}
                    </Row>

                  </Col>


                  {/* New Pagination Section After Filters */}
                  {hasSearched && (
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
                      <small className="text-muted fw-semibold">
                        {filteredResults.length > 0 ? (
                          <>

                          </>
                        ) : (
                          <>
                            No results found{" "}
                            {pollStatus === "IN_PROGRESS" ? "(updating...)" : ""}
                          </>
                        )}
                      </small>
                      {filteredResults.length > 0 && !(hotelSearchTerm || hotelType.length > 0) && (
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
                            )
                          )}
                          <Pagination.Next
                            disabled={pageIndex >= effectiveTotalPages - 1}
                            onClick={() => goToPage(pageIndex + 1)}
                          />
                        </Pagination>
                      )}
                    </div>
                  )}
                </Row>

              </div>


            </div>
          )}
        </main>
      </div>
    </div>
  );
}
