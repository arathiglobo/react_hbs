import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Row, Col, Form, Button, Spinner } from "react-bootstrap";
import Select from "react-select";
import toast from "react-hot-toast";
import { FaSearch, FaStar, FaTag } from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import AgentSelect from "../../components/AgentSelect";
import MapModal from "../../components/map/MapModal";
import { ENABLE_MAP_PREVIEW } from "../../config/featureFlags";
import axiosInstance from "../../components/AxiosInstance";
import "../../styles/HotelSearch.css";

// ─────────────────────────────────────────────
// Rooms & Guests helpers (duplicated from HotelSearch.jsx so the
// Promotion search page stays self-contained without triggering a
// refactor of that 3k-line component). Keep behaviour aligned with
// the source of truth there — every change here needs a matching one
// in HotelSearch.jsx.
// ─────────────────────────────────────────────
const MAX_ROOMS = 5;
const MAX_NIGHTS = 15;
const NIGHTS_LIMIT_MESSAGE = `Maximum stay allowed is ${MAX_NIGHTS} nights.`;

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

function RoomGuestSelector({ value, onChange }) {
  const [rooms, setRooms] = useState(value);
  useEffect(() => setRooms(value), [value]);

  const update = (next) => {
    setRooms(next);
    onChange && onChange(next);
  };

  const addRoom = () => {
    if (rooms.length >= MAX_ROOMS) return;
    update([...rooms, { adults: 1, children: 0, childAges: [] }]);
  };
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
        <button
          type="button"
          className="rgs-add-room-btn"
          onClick={addRoom}
          disabled={rooms.length >= MAX_ROOMS}
        >
          <span className="rgs-add-icon">+</span>
          <span>Add Room</span>
        </button>
        {rooms.length >= MAX_ROOMS && (
          <div className="text-danger small mt-2">
            A maximum of {MAX_ROOMS} rooms can be added per booking.
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Local formatting helpers
// ─────────────────────────────────────────────
const formatIsoDate = (d) => {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  const iso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  return iso;
};
const addDays = (d, n) => {
  const dt = d instanceof Date ? new Date(d) : new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
};

/**
 * Sidebar "Promotion" search page.
 *
 * Filter surface mirrors /new-booking/hotel (Agent, Destination/City,
 * Nationality, Booking-Done-By Employee, Check-In, Nights, Check-Out,
 * Rooms & Guests) — but on submit the results come from the promotion
 * endpoint {@code POST /api/hotelPromotions/search-hotels}, which
 * returns only in-house hotels that have at least one live promotion
 * (Special Rate / Discount / Stay-Pay) whose validity covers the
 * requested nights. Hotels with no active promotions are dropped.
 *
 * Result rows deep-link into /hotel-actions/{id}/promotions.
 */
export default function PromotionHotelSearch() {
  // ── Role detection (same rule HotelSearch.jsx uses) ────────────
  const activeRole = (localStorage.getItem("currentActiveRole") || "")
    .trim()
    .toUpperCase();
  const storedRoles = (localStorage.getItem("userRole") || "").toUpperCase();
  const isAgentRole = activeRole
    ? activeRole === "AGENT"
    : storedRoles.includes("AGENT") && !storedRoles.includes("ADMIN");
  const loggedInAgentName =
    localStorage.getItem("UserName") ||
    sessionStorage.getItem("UserName") ||
    "";

  // ── Filter state ───────────────────────────────────────────────
  const [agents, setAgents] = useState([]);
  const [agent, setAgent] = useState("");
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [nationalityList, setNationalityList] = useState([]);
  const [selectedNationality, setSelectedNationality] = useState(null);
  const [isNationalityLoading, setIsNationalityLoading] = useState(false);
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [nights, setNights] = useState(1);
  const [rooms, setRooms] = useState([
    { adults: 1, children: 0, childAges: [] },
  ]);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [errors, setErrors] = useState({});

  const isAutoCorrectingNights = useRef(false);
  const today = formatIsoDate(new Date());
  const minCheckOutDate = checkIn ? formatIsoDate(addDays(checkIn, 1)) : today;

  const clearError = (key) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  // ── Results state ──────────────────────────────────────────────
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  // Once we have results the big filter form collapses into a compact
  // summary strip (mirrors HotelSearch's `collapseSearch` behaviour).
  // "Modify Search" flips this true to re-expand the form.
  const [isEditingSearch, setIsEditingSearch] = useState(false);
  // Sort matches the hotel-search "Low to High / High to Low" strip;
  // since promotion results carry no room price we sort by star rating.
  const [sortBy, setSortBy] = useState("starDesc");
  const collapseSearch = hasSearched && !isEditingSearch;

  // ── Sidebar filters (mirror HotelSearch.jsx) ───────────────────
  const [hotelSearchTerm, setHotelSearchTerm] = useState("");
  const [starFilter, setStarFilter] = useState(null);
  const [hotelType, setHotelType] = useState([]);
  const [channelType, setChannelType] = useState([]);
  const [availableDeals, setAvailableDeals] = useState([]);
  // Loaded from /api/currency the same way HotelSearch does. Each option
  // carries a numeric `rate` (multiplier vs AED), so the "starting-from"
  // rate on each result card can be displayed in the operator's picked
  // currency using the same conversion the hotel-search results use.
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);

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
  // Available Deals — shown for uniformity with HotelSearch's sidebar.
  // The three promotion families this page actually filters on (Special
  // Rates / Discount / Stay Pay) are wired below; the remaining options
  // are display-only for now.
  const availableDealsOptions = [
    { value: "specialRates", label: "Special Rates" },
    { value: "discount", label: "Discount" },
    { value: "stayPay", label: "Stay Pay" },
    { value: "flashSale", label: "Flash Sale" },
    { value: "longStay", label: "Long Stay" },
    { value: "twentyFourHour", label: "24 Hour Check-In" },
    { value: "lastMinute", label: "Last Minute" },
    { value: "dayStay", label: "Day Stay" },
    { value: "meetingSpace", label: "Meeting & Space" },
    { value: "govEmployee", label: "Govt Employee Discount" },
    { value: "studentDiscount", label: "Student Discount" },
    { value: "seniorCitizen", label: "Senior Citizen" },
    { value: "destinationSales", label: "Destination Sales" },
  ];

  // Filter + sort applied to the fetched promotion `results`. Hoisted out
  // of the results-render IIFE below so the "Explore on Map" modal can
  // reuse the same sorted list (and same filter state) — pins on the map
  // then react to the star / sort / clear controls exactly the way the
  // hotel cards do.
  const filteredSortedResults = useMemo(() => {
    const nameNeedle = hotelSearchTerm.trim().toLowerCase();
    const dealValues = new Set(availableDeals.map((d) => d.value));
    const typeValues = new Set(hotelType.map((t) => t.value));
    const channelValues = new Set(channelType.map((c) => c.value));
    const filtered = results.filter((h) => {
      if (nameNeedle && !(h.hotelName || "").toLowerCase().includes(nameNeedle)) {
        return false;
      }
      if (starFilter && Number(h.starRating) !== starFilter.value) {
        return false;
      }
      if (channelValues.size > 0 && !channelValues.has("inhouse")) {
        return false;
      }
      if (typeValues.size > 0) {
        const t = (h.hotelType || "").trim().toLowerCase();
        if (!t || !typeValues.has(t)) return false;
      }
      if (dealValues.size > 0) {
        const promoTypes = (h.promotionTypes || []).map((t) =>
          (t || "").toLowerCase(),
        );
        const hasSpecial = promoTypes.some((t) => t.includes("special"));
        const hasDiscount = promoTypes.some((t) => t.includes("discount"));
        const hasStayPay = promoTypes.some((t) => t.includes("stay"));
        let matchesADeal = false;
        if (dealValues.has("specialRates") && hasSpecial) matchesADeal = true;
        if (dealValues.has("discount") && hasDiscount) matchesADeal = true;
        if (dealValues.has("stayPay") && hasStayPay) matchesADeal = true;
        if (!matchesADeal) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      const sa = Number(a.starRating) || 0;
      const sb = Number(b.starRating) || 0;
      return sortBy === "starAsc" ? sa - sb : sb - sa;
    });
  }, [
    results,
    hotelSearchTerm,
    starFilter,
    hotelType,
    channelType,
    availableDeals,
    sortBy,
  ]);

  const clearAllFilters = () => {
    setStarFilter(null);
    setHotelType([]);
    setChannelType([]);
    setAvailableDeals([]);
    setSortBy("starDesc");
    setHotelSearchTerm("");
  };

  // ── Initial data loads (agents, employees, destinations, nationality,
  //     currency) ── Intentional mount-only effect. loadPopular* are
  // stable closures over setState only; adding them to the deps array
  // (or wrapping in useCallback) would just re-fetch the same master
  // lists on every render for no benefit.
  useEffect(() => {
    axiosInstance
      .get("/api/agent?activeOnly=true")
      .then((r) => setAgents(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAgents([]));
    axiosInstance
      .get("/api/employee?page=0&limit=1000")
      .then((r) => setEmployees(Array.isArray(r.data) ? r.data : []))
      .catch(() => setEmployees([]));
    loadPopularDestinations();
    loadPopularCountries();
    // Currency options + AED-normalised rate factor — same source and
    // shape HotelSearch uses at /api/currency, so the rate we display
    // on each promotion card is converted identically.
    (async () => {
      try {
        const res = await axiosInstance.get("/api/currency?page=0");
        const rows = Array.isArray(res.data) ? res.data : [];
        const options = rows
          .filter((c) => c && c.currencyCode)
          .map((c) => ({
            value: c.currencyId,
            label: c.currencyCode,
            code: c.currencyCode,
            rate: Number(c.value),
          }));
        setCurrencyOptions(options);
        // Default to AED (the base currency the rates arrive in).
        const aed = options.find((o) => o.code === "AED");
        setSelectedCurrency(aed || options[0] || null);
      } catch {
        setCurrencyOptions([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AED is the base currency /api/hotel-rooms/search returns rates in.
  // Normalising against the AED master row's stored value keeps AED→AED
  // always ×1 no matter how the row is configured. Falls back to 1
  // until the currency list loads.
  const aedBaseRate = useMemo(() => {
    const aed = currencyOptions.find((o) => o.code === "AED");
    return aed && Number.isFinite(aed.rate) && aed.rate > 0 ? aed.rate : 1;
  }, [currencyOptions]);

  const displayCurrencyCode = selectedCurrency?.code || "AED";

  const convertFromAed = (aedPrice) => {
    if (aedPrice == null) return aedPrice;
    const targetRate =
      selectedCurrency && Number.isFinite(selectedCurrency.rate)
        ? selectedCurrency.rate
        : aedBaseRate;
    return Number(aedPrice) * (targetRate / aedBaseRate);
  };

  // ── Option-normalisation helpers ─────────────────────────────
  // react-select's built-in filter calls option.label.replace(...)
  // internally, so ANY non-string label (null / number / Promise /
  // object) crashes the whole page the next time the menu opens
  // ("str.replace is not a function"). Same defence AgentSelect.jsx
  // documents — coerce to a clean string and drop rows without a
  // usable name.
  const toStr = (v) => {
    if (v === null || v === undefined) return "";
    return typeof v === "string" ? v : String(v);
  };

  const mapProvinceRows = (rows) =>
    (Array.isArray(rows) ? rows : [])
      .map((c) => {
        const name = toStr(c && (c.stateName ?? c.name));
        if (!name) return null;
        const country = toStr(c && c.country);
        return {
          value: c && c.id,
          label: country ? `${name},${country}` : name,
          countryId: c && c.countryId,
          code: c && c.countryCode,
        };
      })
      .filter(Boolean);

  const mapCountryRows = (rows) =>
    (Array.isArray(rows) ? rows : [])
      .map((c) => {
        const name = toStr(c && c.name);
        if (!name) return null;
        return {
          value: c && c.id,
          label: name,
          code: c && c.code,
        };
      })
      .filter(Boolean);

  const loadPopularDestinations = async () => {
    try {
      setIsDestinationLoading(true);
      const res = await axiosInstance.get("/api/province?limit=50");
      setDestinationOptions(mapProvinceRows(res.data));
    } catch {
      setDestinationOptions([]);
    } finally {
      setIsDestinationLoading(false);
    }
  };

  const cityList = async (search) => {
    if (!search || search.length < 2) return;
    try {
      setIsDestinationLoading(true);
      const res = await axiosInstance.get(`/api/province?search=${search}`);
      setDestinationOptions(mapProvinceRows(res.data));
    } catch {
      setDestinationOptions([]);
    } finally {
      setIsDestinationLoading(false);
    }
  };

  const loadPopularCountries = async () => {
    try {
      setIsNationalityLoading(true);
      const res = await axiosInstance.get("/api/country?limit=50");
      setNationalityList(mapCountryRows(res.data));
    } catch {
      setNationalityList([]);
    } finally {
      setIsNationalityLoading(false);
    }
  };

  const fetchCountriesForSearch = async (value) => {
    try {
      setIsNationalityLoading(true);
      const res = await axiosInstance.get(`/api/country?search=${value}`);
      setNationalityList(mapCountryRows(res.data));
    } catch {
      setNationalityList([]);
    } finally {
      setIsNationalityLoading(false);
    }
  };

  // NOT async: react-select's onInputChange treats a Promise return as an
  // input-value override, which is what put "[object Promise]" in the box
  // and then blew up trimString on the next filter pass. Fire-and-forget
  // the async fetch and return synchronously.
  const handleCountryInputChange = (value, { action } = {}) => {
    if (action !== "input-change") return;
    if (!value || value.length < 2) return;
    fetchCountriesForSearch(value);
  };

  // ── Keep nights ↔ dates in sync (mirrors HotelSearch.jsx) ──────
  useEffect(() => {
    if (!checkIn || !checkOut) return;
    if (isAutoCorrectingNights.current) {
      isAutoCorrectingNights.current = false;
      return;
    }
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    if (diff > MAX_NIGHTS) {
      const capped = addDays(start, MAX_NIGHTS);
      isAutoCorrectingNights.current = true;
      setNights(MAX_NIGHTS);
      setCheckOut(formatIsoDate(capped));
      setErrors((prev) => ({ ...prev, nights: NIGHTS_LIMIT_MESSAGE }));
    } else {
      setNights(diff);
      clearError("nights");
    }
  }, [checkIn, checkOut]);

  const handleNightsChange = (value) => {
    const raw = Math.max(1, Number(value) || 1);
    const capped = Math.min(raw, MAX_NIGHTS);
    setNights(capped);
    if (raw > MAX_NIGHTS) {
      setErrors((prev) => ({ ...prev, nights: NIGHTS_LIMIT_MESSAGE }));
    } else {
      clearError("nights");
    }
    if (checkIn) {
      const out = addDays(new Date(checkIn), capped);
      if (raw > MAX_NIGHTS) isAutoCorrectingNights.current = true;
      setCheckOut(formatIsoDate(out));
    }
  };

  const validate = () => {
    const next = {};
    if (!isAgentRole && !agent) next.agent = "Agent is required";
    if (!selectedDestination) next.destination = "Destination is required";
    if (!selectedNationality) next.nationality = "Nationality is required";
    if (!checkIn) next.checkIn = "Check-in is required";
    if (!checkOut) next.checkOut = "Check-out is required";
    if (checkIn && checkOut && checkOut <= checkIn) {
      next.checkOut = "Check-out must be after check-in";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSearching(true);
    setHasSearched(true);
    setIsEditingSearch(false); // collapse the form once a search is in flight
    try {
      // Destination + dates are all the backend needs to gate promotion
      // validity. Agent / Nationality / Employee / Rooms & Guests are
      // collected for parity with the standard hotel search and to seed
      // the downstream booking context — the promotion filter itself
      // doesn't consume them.
      const payload = {
        destinationCountryId: selectedDestination?.countryId ?? null,
        destinationCityId: selectedDestination?.value ?? null,
        checkIn,
        checkOut,
      };
      const res = await axiosInstance.post(
        "/api/hotelPromotions/search-hotels",
        payload,
      );
      const hotels = Array.isArray(res.data) ? res.data : [];
      // Rates for each card come inline on the promotion response
      // (backend calls InhouseHotelSearchApiCaller.computeStartingRate
      // for every qualifying hotel), so no per-hotel follow-up call is
      // needed — the card reads h.startingRate directly.
      setResults(hotels);
    } catch (err) {
      console.error("Promotion hotel search failed", err);
      toast.error("Failed to search hotels with promotions");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Builds the /api/hotel-rooms/search payload for a single promoted
  // hotel. Shared by openRoomListForHotel (which navigates to /room-list
  // via sessionStorage) and fetchHotelRates (which reads back the
  // cheapest rate to display on the card). Kept as a single source of
  // truth so the rate shown on the card and the rate the booking flow
  // shows are computed from an identical request.
  const buildRoomSearchPayload = (h) => {
    const rawCode = (selectedNationality?.code || "").trim().toUpperCase();
    // Nationality must be an ISO-2 uppercase code — the room-search DTO
    // is annotated @Pattern("[A-Z]{2}"); default to "IN" when missing/
    // malformed so the request still validates.
    const nationalityCode = /^[A-Z]{2}$/.test(rawCode) ? rawCode : "IN";
    const roomsPayload = rooms.map((r) => ({
      adults: r.adults || 1,
      children: r.children || 0,
      childAges: r.childAges || [],
      adultAges: Array.from({ length: r.adults || 1 }, () => 30),
    }));
    const pickedAgent = (Array.isArray(agents) ? agents : []).find(
      (a) => String(a?.id) === String(agent),
    );
    const agentName = isAgentRole
      ? loggedInAgentName || ""
      : pickedAgent
        ? pickedAgent.companyName ||
          pickedAgent.name ||
          `${pickedAgent.firstName || ""} ${pickedAgent.lastName || ""}`.trim()
        : "";
    // Inhouse room service runs agent-markup lookup; an empty agentId
    // NPEs, so fall back to "1" (matches HotelSearch's own default).
    const agentIdForPayload = String(agent || "1");
    return {
      checkInDate: checkIn,
      checkOutDate: checkOut,
      hotelCode: `IN${h.hotelId}`,
      nationality: nationalityCode,
      agentId: agentIdForPayload,
      agentName,
      destinationLabel: selectedDestination?.label || "",
      nationalityLabel: selectedNationality?.label || "",
      employeeName: isAgentRole
        ? agentName || null
        : selectedEmployee?.label || null,
      nightsCount: nights,
      apiId: 1, // INHOUSE — promotion results are always inhouse
      rooms: roomsPayload,
      parentBookingCode: null,
      employeeId: isAgentRole ? null : selectedEmployee?.value || null,
      is24HourCheckin: false,
      checkInTime: null,
      checkOutTime: null,
      twentyFourHourPercentage: null,
    };
  };

  // Mirror of HotelSearch.jsx#openRoomListForHotel for the INHOUSE case
  // (promotion results are always in-house). Builds the same
  // roomListPayload + meta + currency shape HotelSearch stashes into
  // sessionStorage under "roomListPayload", then opens /room-list in a
  // new tab so downstream RoomList / HotelBookingPage code continues to
  // work unchanged.
  const openRoomListForHotel = (h) => {
    if (!h || !h.hotelId) return;
    if (!checkIn || !checkOut) {
      toast.error("Please pick check-in and check-out dates first.");
      return;
    }
    const payload = buildRoomSearchPayload(h);
    const meta = {
      hotelName: h.hotelName,
      address:
        h.hotelAddress ||
        [h.cityName, h.countryName].filter(Boolean).join(", ") ||
        "",
      starRating: h.starRating || 0,
      phone: "",
      hotelImage: h.hotelImage,
    };
    // Promotion page has no live FX table; forward the selected code as
    // a passthrough with factor 1 so the downstream RoomList still
    // renders the AED base rate correctly.
    const currency = {
      code: selectedCurrency?.value || "AED",
      factor: 1,
    };
    sessionStorage.setItem(
      "roomListPayload",
      JSON.stringify({ payload, meta, currency }),
    );
    setTimeout(() => window.open("/room-list", "_blank"), 50);
  };

  // Hex colours for the inline-styled "Active Promotions" pills in
  // the horizontal result card (matches the deal-pill style used on
  // HotelSearch's per-hotel "Also Available Deals" strip).
  const badgeBgFor = (type) => {
    const key = (type || "").toLowerCase();
    if (key.includes("special")) return "#0dcaf0"; // info
    if (key.includes("discount")) return "#f0ad4e"; // warning
    if (key.includes("stay")) return "#198754"; // success
    return "#6c757d"; // secondary
  };

  // Common react-select styles matching HotelSearch.
  const selectStyles = {
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    control: (base) => ({
      ...base,
      minHeight: "42px",
      border: "1px solid #dee2e6",
      "&:hover": { borderColor: "#86b7fe" },
    }),
    menu: (base) => ({ ...base, zIndex: 9999, maxHeight: "200px" }),
    option: (base, state) => ({
      ...base,
      cursor: "pointer",
      backgroundColor: state.isSelected
        ? "#EC0B43"
        : state.isFocused
          ? "#fff0f3"
          : "white",
      color: state.isSelected ? "white" : "#212529",
    }),
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          {/* Collapsed sticky-summary strip — mirrors HotelSearch.jsx.
              Shown after a search returns; "Modify Search" flips
              isEditingSearch to re-expand the full form. */}
          {collapseSearch && (
            <div className="hs-summary-bar mb-3">
              <Button
                type="button"
                className="hs-summary-modify"
                onClick={() => {
                  setIsEditingSearch(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <FaSearch className="me-2" />
                Modify Search
              </Button>
              <div className="hs-summary-chips">
                {selectedDestination?.label && (
                  <span className="hs-summary-chip hs-summary-chip-main">
                    {selectedDestination.label}
                  </span>
                )}
                {checkIn && (
                  <span className="hs-summary-chip">
                    {checkIn}
                    {checkOut ? ` → ${checkOut}` : ""}
                  </span>
                )}
                <span className="hs-summary-chip">
                  {nights} night{nights > 1 ? "s" : ""}
                </span>
                <span className="hs-summary-chip">
                  {rooms.reduce((a, r) => a + r.adults, 0)} adults
                  {rooms.reduce((a, r) => a + r.children, 0)
                    ? `, ${rooms.reduce((a, r) => a + r.children, 0)} child`
                    : ""}{" "}
                  · {rooms.length} room{rooms.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}

          {!collapseSearch && (
          <Card className="shadow-sm rounded-xl mb-3">
            <Card.Body>
              <div className="d-flex align-items-center gap-2 mb-2">
                <FaTag className="text-danger" />
                <h3 className="fw-bold text-danger mb-0">
                  Find Hotels with Active Promotions
                </h3>
              </div>
              <p className="text-muted mb-4">
                Only in-house hotels with live, in-validity promotions for the
                selected dates are shown.
              </p>

              <Form onSubmit={handleSearchSubmit}>
                <Row className="g-4">
                  {/* 1. Agent */}
                  {!isAgentRole && (
                    <Col lg={4} md={6}>
                      <Form.Group>
                        <Form.Label className="fw-semibold text-dark">
                          Agent
                        </Form.Label>
                        <AgentSelect
                          agents={agents}
                          value={agent}
                          isInvalid={!!errors.agent}
                          onChange={(v) => {
                            setAgent(v);
                            if (v) clearError("agent");
                          }}
                        />
                        {errors.agent && (
                          <div className="text-danger small mt-1">
                            {errors.agent}
                          </div>
                        )}
                      </Form.Group>
                    </Col>
                  )}

                  {/* 2. Destination / City */}
                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Destination / City
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
                        isLoading={isDestinationLoading}
                        className="modern-select"
                        onMenuOpen={() => {
                          if (destinationOptions.length === 0)
                            loadPopularDestinations();
                        }}
                        onInputChange={(v, { action }) => {
                          if (action === "input-change") cityList(v);
                        }}
                        menuPortalTarget={document.body}
                        styles={selectStyles}
                      />
                      {errors.destination && (
                        <div className="text-danger small mt-1">
                          {errors.destination}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  {/* 3. Nationality */}
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
                        onInputChange={handleCountryInputChange}
                        isLoading={isNationalityLoading}
                        placeholder="Select nationality"
                        isSearchable
                        isClearable
                        className="modern-select"
                        menuPortalTarget={document.body}
                        styles={selectStyles}
                      />
                      {errors.nationality && (
                        <div className="text-danger small mt-1">
                          {errors.nationality}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  {/* Booking Done By Employee / (Agent) */}
                  {isAgentRole ? (
                    <Col lg={4} md={6}>
                      <Form.Group>
                        <Form.Label className="fw-semibold text-dark">
                          Booking Done By
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={loggedInAgentName || "—"}
                          readOnly
                          disabled
                          className="form-control-modern"
                          style={{ height: "42px" }}
                        />
                      </Form.Group>
                    </Col>
                  ) : (
                    <Col lg={4} md={6}>
                      <Form.Group>
                        <Form.Label className="fw-semibold text-dark">
                          Booking Done By Employee{" "}
                          <span className="text-muted small">(optional)</span>
                        </Form.Label>
                        <Select
                          options={employees
                            .map((e) => {
                              const label = `${toStr(e && e.firstName)} ${toStr(e && e.lastName)}`.trim();
                              if (!label) return null;
                              return { value: e && e.employeeId, label };
                            })
                            .filter(Boolean)}
                          value={selectedEmployee}
                          onChange={setSelectedEmployee}
                          placeholder="Select employee"
                          isSearchable
                          isClearable
                          className="modern-select"
                          menuPortalTarget={document.body}
                          styles={selectStyles}
                        />
                      </Form.Group>
                    </Col>
                  )}

                  {/* 4. Check-In */}
                  <Col lg={3} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Check-In
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={checkIn}
                        min={today}
                        isInvalid={!!errors.checkIn}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCheckIn(v);
                          if (v) {
                            clearError("checkIn");
                            setCheckOut(formatIsoDate(addDays(v, 1)));
                            clearError("checkOut");
                          }
                        }}
                        style={{ height: "42px" }}
                        className="form-control-modern"
                      />
                      {errors.checkIn && (
                        <div className="text-danger small mt-1">
                          {errors.checkIn}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  {/* 5. Nights */}
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
                        max={MAX_NIGHTS}
                        value={nights}
                        onChange={(e) => handleNightsChange(e.target.value)}
                      />
                      {errors.nights && (
                        <div className="text-danger small mt-1">
                          {errors.nights}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  {/* 6. Check-Out */}
                  <Col lg={3} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Check-Out
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={checkOut}
                        min={minCheckOutDate}
                        isInvalid={!!errors.checkOut}
                        onChange={(e) => {
                          setCheckOut(e.target.value);
                          if (e.target.value) clearError("checkOut");
                        }}
                        style={{ height: "42px" }}
                        className="form-control-modern"
                      />
                      {errors.checkOut && (
                        <div className="text-danger small mt-1">
                          {errors.checkOut}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  {/* 7. Rooms & Guests */}
                  <Col lg={4} md={6}>
                    <Form.Label className="fw-semibold text-dark">
                      Rooms & Guests
                    </Form.Label>
                    <div className="d-flex flex-wrap gap-2">
                      <Button
                        variant="outline-primary"
                        className="flex-grow-1 text-start rooms-summary-btn-modern"
                        type="button"
                        onClick={() => setRoomsOpen((o) => !o)}
                      >
                        {rooms.reduce((a, r) => a + r.adults, 0)} adults
                        {rooms.reduce((a, r) => a + r.children, 0)
                          ? `, ${rooms.reduce((a, r) => a + r.children, 0)} child`
                          : ""}{" "}
                        · {rooms.length} room{rooms.length > 1 ? "s" : ""}
                        <span className="float-end">
                          {roomsOpen ? "▴" : "▾"}
                        </span>
                      </Button>
                      <Button
                        type="button"
                        className="flex-shrink-0 btn-add-room-premium hs-add-room-btn-red"
                        disabled={roomsOpen && rooms.length >= MAX_ROOMS}
                        onClick={() => {
                          if (!roomsOpen) {
                            setRoomsOpen(true);
                          } else {
                            setRooms((prev) =>
                              prev.length >= MAX_ROOMS
                                ? prev
                                : [
                                    ...prev,
                                    { adults: 1, children: 0, childAges: [] },
                                  ],
                            );
                          }
                        }}
                      >
                        <span className="add-room-plus">+</span>
                        <span>Add Room</span>
                      </Button>
                    </div>
                    {roomsOpen && (
                      <div className="mt-2">
                        <RoomGuestSelector value={rooms} onChange={setRooms} />
                      </div>
                    )}
                  </Col>
                </Row>

                <div className="d-flex justify-content-center mt-4">
                  <Button
                    variant="danger"
                    type="submit"
                    size="lg"
                    disabled={isSearching}
                    style={{ minWidth: 220 }}
                  >
                    {isSearching ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          className="me-2"
                        />
                        Searching...
                      </>
                    ) : (
                      <>
                        <FaSearch className="me-2" />
                        SEARCH
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
          )}

          {/* Results — full HotelSearch-style layout (sidebar + top strip
              + horizontal cards). Sidebar filters apply client-side to
              the promotion results: hotel-name substring, star rating,
              hotel type and available deals. Channel is INHOUSE-only
              because the promotion tables are inhouse-scoped. */}
          {hasSearched && (
            <div>
              <div className="hs-page-heading">
                <h3 className="hs-page-heading-title">Accommodation</h3>
              </div>

              {(() => {
                // Filter / sort / clearAllFilters live at component scope
                // now so the "Explore on Map" modal can share them. The
                // local `sorted` alias keeps the JSX below unchanged.
                const sorted = filteredSortedResults;

                return (
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
                                {ENABLE_MAP_PREVIEW && (
                                  <button
                                    type="button"
                                    className="map-overlay-btn"
                                    onClick={() => setShowMapModal(true)}
                                  >
                                    EXPLORE ON MAP 📍
                                  </button>
                                )}
                              </div>

                              <Form.Control
                                type="text"
                                placeholder="Search Hotel Name..."
                                className="ps-3 mb-2"
                                value={hotelSearchTerm}
                                onChange={(e) => setHotelSearchTerm(e.target.value)}
                              />

                              <Form.Group className="mb-2">
                                <Form.Label className="fw-semibold small">
                                  Currency
                                </Form.Label>
                                <Select
                                  options={currencyOptions}
                                  value={selectedCurrency}
                                  onChange={setSelectedCurrency}
                                  placeholder="Select currency"
                                  isSearchable
                                  className="modern-select-sm"
                                  menuPortalTarget={document.body}
                                  styles={{
                                    control: (base) => ({
                                      ...base,
                                      minHeight: "36px",
                                      background: "#fff",
                                      color: "#000",
                                    }),
                                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                    menu: (base) => ({ ...base, zIndex: 9999 }),
                                  }}
                                />
                              </Form.Group>

                              <hr />

                              <Form.Group className="mb-2">
                                <Form.Label className="fw-semibold small">
                                  Hotel Type
                                </Form.Label>
                                <div className="filter-checkbox-list">
                                  {hotelTypeOptions.map((item) => (
                                    <Form.Check
                                      key={item.value}
                                      type="checkbox"
                                      id={`p-hotel-type-${item.value}`}
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

                              {/* Channel filter intentionally hidden on the
                                  Promotion page — every promotion result is
                                  INHOUSE-scoped (supplier APIs don't expose
                                  the in-house promotion tables), so the
                                  checkbox added no user-facing value. Kept
                                  as a comment for easy restoration. */}
                              {/*
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
                                      id={`p-channel-${item.value}`}
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
                              */}

                              <hr />

                              <Form.Group>
                                <Form.Label className="fw-semibold small d-flex justify-content-between align-items-center">
                                  <span>Available Deals</span>
                                  {availableDeals.length > 0 && (
                                    <span
                                      role="button"
                                      className="text-primary small"
                                      style={{ cursor: "pointer", fontWeight: 500 }}
                                      onClick={() => setAvailableDeals([])}
                                    >
                                      Clear
                                    </span>
                                  )}
                                </Form.Label>
                                <div className="filter-checkbox-list">
                                  {availableDealsOptions.map((item) => (
                                    <Form.Check
                                      key={item.value}
                                      type="checkbox"
                                      id={`p-deal-${item.value}`}
                                      label={item.label}
                                      checked={availableDeals.some(
                                        (d) => d.value === item.value,
                                      )}
                                      onChange={(e) => {
                                        if (e.target.checked)
                                          setAvailableDeals([...availableDeals, item]);
                                        else
                                          setAvailableDeals(
                                            availableDeals.filter(
                                              (d) => d.value !== item.value,
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
                                value={starFilter}
                                onChange={setStarFilter}
                                placeholder="All Stars"
                                isClearable
                                className="modern-select-sm"
                                menuPortalTarget={document.body}
                                styles={{
                                  control: (base) => ({
                                    ...base,
                                    height: "36px",
                                    minHeight: "36px",
                                    width: "180px",
                                    background: "#fff",
                                    color: "#000",
                                    marginLeft: "30px",
                                  }),
                                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                  menu: (base) => ({ ...base, zIndex: 9999 }),
                                }}
                              />

                              <div className="d-flex gap-2">
                                <Button
                                  size="sm"
                                  className={`sort-pill ${sortBy === "starAsc" ? "active" : ""}`}
                                  onClick={() => setSortBy("starAsc")}
                                >
                                  Low to High
                                </Button>
                                <Button
                                  size="sm"
                                  className={`sort-pill ${sortBy === "starDesc" ? "active" : ""}`}
                                  onClick={() => setSortBy("starDesc")}
                                >
                                  High to Low
                                </Button>
                              </div>

                              <Button
                                className="clear-pill"
                                variant="outline-primary"
                                size="sm"
                                onClick={clearAllFilters}
                              >
                                Clear
                              </Button>
                            </div>
                          </Card.Body>
                        </Card>

                        {sorted.length > 0 && (
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <small className="text-muted fw-semibold">
                              Showing 1 to {sorted.length} of {sorted.length}{" "}
                              entries
                            </small>
                          </div>
                        )}

                        {isSearching ? (
                          <Card className="shadow-sm rounded-xl mb-4">
                            <Card.Body className="text-center py-4">
                              <Spinner animation="border" variant="danger" />
                              <p className="text-muted mt-2 mb-0">
                                Searching hotels with active promotions…
                              </p>
                            </Card.Body>
                          </Card>
                        ) : sorted.length === 0 ? (
                          <Card className="shadow-sm rounded-xl">
                            <Card.Body className="text-center text-muted py-5">
                              <FaSearch className="display-4 text-muted mb-3" />
                              <h5>No hotels found</h5>
                              <p className="mb-0">
                                No hotels with active promotions match the
                                selected filters.
                              </p>
                            </Card.Body>
                          </Card>
                        ) : (
                          <Row className="g-4">
                            {sorted.map((h) => (
                              <Col xs={12} key={h.hotelId}>
                                <div
                                  style={{
                                    position: "relative",
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
                                          minHeight: 220,
                                          padding: "10px",
                                        }}
                                      >
                                        <img
                                          src={
                                            h.hotelImage ||
                                            "https://details/assets/details/profilepic/hotel/hoteldefault.jpg"
                                          }
                                          alt={h.hotelName}
                                          style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            borderRadius: "9px",
                                          }}
                                          onError={(e) => {
                                            e.currentTarget.src =
                                              "https://details/assets/details/profilepic/hotel/hoteldefault.jpg";
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
                                          {h.starRating || 0}
                                          <span
                                            style={{
                                              marginLeft: "5px",
                                              backgroundColor: "#6c757d",
                                              padding: "2px 6px",
                                              borderRadius: "10px",
                                            }}
                                          >
                                            INHOUSE
                                          </span>
                                        </div>
                                      </div>
                                    </Col>

                                    <Col md={8}>
                                      <div
                                        style={{
                                          padding: "12px 14px",
                                          display: "flex",
                                          flexDirection: "column",
                                          height: "100%",
                                        }}
                                      >
                                        <h6
                                          style={{
                                            fontSize: "1.0rem",
                                            fontWeight: 600,
                                            marginBottom: "4px",
                                            color: "#333",
                                          }}
                                        >
                                          {h.hotelName ||
                                            "Hotel Name Not Available"}
                                        </h6>

                                        <p
                                          style={{
                                            fontSize: "0.875rem",
                                            color: "#666",
                                            marginBottom: "4px",
                                          }}
                                        >
                                          📍{" "}
                                          {h.hotelAddress ||
                                            [h.cityName, h.countryName]
                                              .filter(Boolean)
                                              .join(", ") ||
                                            "Address Not Available"}
                                        </p>

                                        <div
                                          style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: "6px",
                                            marginBottom: "6px",
                                            alignItems: "center",
                                          }}
                                        >
                                          <span
                                            style={{
                                              backgroundColor: "#28a745",
                                              color: "white",
                                              padding: "4px 8px",
                                              borderRadius: "4px",
                                              fontSize: "0.75rem",
                                            }}
                                          >
                                            Promotion Available
                                          </span>
                                        </div>

                                        <div className="available-deals-wrap">
                                          <div className="available-deals-label">
                                            Active Promotions
                                          </div>
                                          <div className="deal-pills-row">
                                            {(h.promotionTypes || []).map((t) => (
                                              <span
                                                key={t}
                                                className="deal-pill"
                                                style={{
                                                  backgroundColor: badgeBgFor(t),
                                                  color: "#fff",
                                                }}
                                              >
                                                {t}
                                              </span>
                                            ))}
                                          </div>
                                        </div>

                                        <div
                                          style={{
                                            fontSize: "0.8rem",
                                            color: "#666",
                                            marginBottom: "6px",
                                          }}
                                        >
                                          {h.promotionCount || 0} active
                                          promotion
                                          {h.promotionCount === 1 ? "" : "s"}
                                        </div>
                                        <div
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            marginTop: "auto",
                                            paddingTop: "8px",
                                            borderTop: "1px solid #eee",
                                          }}
                                        >
                                          {/* Rate line — same style /new-booking/hotel
                                              uses (e.g. "INR 11.89"). The
                                              rate comes from
                                              /api/hotel-rooms/search so
                                              it already reflects any
                                              applicable Special Rate /
                                              Discount / Stay-Pay
                                              promotion applied by the
                                              inhouse room service, and
                                              matches what "View Rooms"
                                              will show. Displayed in
                                              the currency picked in the
                                              sidebar; conversion mirrors
                                              HotelSearch's aedBaseRate
                                              path. */}
                                          <div
                                            style={{
                                              fontSize: "1.1rem",
                                              fontWeight: 600,
                                              color: "#333",
                                            }}
                                          >
                                            {h.startingRate != null
                                              ? `${displayCurrencyCode} ${convertFromAed(
                                                  h.startingRate,
                                                ).toLocaleString(undefined, {
                                                  minimumFractionDigits: 2,
                                                  maximumFractionDigits: 2,
                                                })}`
                                              : (
                                                <span className="text-muted">
                                                  Rate on request
                                                </span>
                                              )}
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={() =>
                                              openRoomListForHotel(h)
                                            }
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
                        )}
                      </Col>
                    </Row>
                  </div>
                );
              })()}
            </div>
          )}

          <MapModal
            show={showMapModal}
            onHide={() => setShowMapModal(false)}
            markers={filteredSortedResults.map((h) => ({
              id: h.hotelId,
              name: h.hotelName,
              lat: h.latitude,
              lng: h.longitude,
              address: h.hotelAddress,
              image: h.hotelImage,
              rating: h.starRating,
              dealLabels: h.promotionTypes,
            }))}
            title="Hotels with Active Promotions"
            onHotelSelect={(id) => {
              setShowMapModal(false);
              const picked = results.find((h) => h.hotelId === id);
              if (picked) openRoomListForHotel(picked);
            }}
            starOptions={starOptions}
            starRating={starFilter}
            onStarRatingChange={setStarFilter}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortAscValue="starAsc"
            sortDescValue="starDesc"
            onClearFilters={clearAllFilters}
          />
        </main>
      </div>
    </div>
  );
}
