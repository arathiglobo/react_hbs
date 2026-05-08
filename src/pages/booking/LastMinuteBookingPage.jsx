import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  Button,
  Row,
  Col,
  Form,
  Spinner,
  Badge,
  Pagination,
} from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import Select from "react-select";
import axiosInstance from "../../components/AxiosInstance";
import { FaSearch, FaStar, FaMapMarkerAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import "../../styles/HotelSearch.css";

// Default placeholder when the hotel has no image.
const DEFAULT_HOTEL_IMAGE =
  "https://details/assets/details/profilepic/hotel/hoteldefault.jpg";

// Lightweight progress bar to mimic HotelSearch's polling visual.
// Last Minute search is single-shot, so the bar just animates from 0 → 100
// while we wait for the backend response.
function SearchProgressBar({ active }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }
    setProgress(15);
    const t1 = setTimeout(() => setProgress(55), 300);
    const t2 = setTimeout(() => setProgress(85), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active]);
  if (!active && progress === 0) return null;
  const display = active ? progress : 100;
  return (
    <div className="search-progress-bar-wrap mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="search-progress-label">Searching last minute deals...</span>
        <span className="search-progress-percent">{display}%</span>
      </div>
      <div className="search-progress-track">
        <div className="search-progress-fill" style={{ width: `${display}%` }} />
      </div>
    </div>
  );
}

/**
 * LastMinuteBookingPage — search + listing for the Last Minute Booking flow.
 *
 * UI mirrors /new-booking/hotel (HotelSearch.jsx) with all the same fields:
 *   destination, nationality, agent, nights, check-in, check-out, rooms & guests.
 *
 * Difference from normal hotel search:
 *   • Check-in is hard-clamped to today / +1 / +2 days (Last Minute rule).
 *   • Hits ONLY /api/last-minute-hotel-search/search.
 *   • Each result row shows the discount % vs the matching normal contract rate.
 */

// ─── small helper components, copied to keep self-contained ─────────────────
function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function Counter({ value, min, max, onChange }) {
  return (
    <div className="rgs-counter">
      <button type="button" className="rgs-counter-btn"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}>−</button>
      <span className="rgs-counter-val">{value}</span>
      <button type="button" className="rgs-counter-btn"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}>+</button>
    </div>
  );
}

function RoomGuestSelector({ value, onChange }) {
  const [rooms, setRooms] = useState(value);
  const update = (next) => { setRooms(next); onChange?.(next); };
  const addRoom = () => update([...rooms, { adults: 1, children: 0, childAges: [] }]);
  const removeRoom = (i) => update(rooms.filter((_, idx) => idx !== i));
  const setAdults = (i, adults) => update(rooms.map((r, idx) => idx === i ? { ...r, adults } : r));
  const setChildren = (i, children) =>
    update(rooms.map((r, idx) => idx === i
      ? { ...r, children, childAges: Array.from({ length: children }, (_, j) => r.childAges[j] || 5) }
      : r));
  const setChildAge = (rIdx, cIdx, age) =>
    update(rooms.map((r, idx) => {
      if (idx !== rIdx) return r;
      const ages = [...r.childAges]; ages[cIdx] = age;
      return { ...r, childAges: ages };
    }));

  return (
    <div className="rgs-wrap">
      <div className="rgs-grid">
        {rooms.map((room, i) => (
          <div key={i} className="rgs-room-card">
            <div className="rgs-room-header">
              <span className="rgs-room-label">🛏 Room {i + 1}</span>
              {rooms.length > 1 && (
                <button type="button" className="rgs-remove-btn" onClick={() => removeRoom(i)}>✕</button>
              )}
            </div>
            <div className="rgs-counters-col">
              <div className="rgs-counter-row">
                <div className="rgs-counter-info">
                  <span className="rgs-counter-title">Adults</span>
                  <span className="rgs-counter-sub">Age 18+</span>
                </div>
                <Counter value={room.adults} min={1} max={6} onChange={(v) => setAdults(i, v)} />
              </div>
              <div className="rgs-counter-row">
                <div className="rgs-counter-info">
                  <span className="rgs-counter-title">Children</span>
                  <span className="rgs-counter-sub">Age 0–17</span>
                </div>
                <Counter value={room.children} min={0} max={4} onChange={(v) => setChildren(i, v)} />
              </div>
            </div>
            {room.children > 0 && (
              <div className="rgs-child-ages">
                <span className="rgs-child-ages-label">Child ages</span>
                <div className="rgs-child-ages-row">
                  {Array.from({ length: room.children }).map((_, idx) => (
                    <div key={idx} className="rgs-child-age-select">
                      <label className="rgs-child-age-label">Child {idx + 1}</label>
                      <Form.Select size="sm"
                        value={room.childAges[idx] || 5}
                        onChange={(e) => setChildAge(i, idx, parseInt(e.target.value))}
                        className="rgs-age-dropdown">
                        {Array.from({ length: 18 }).map((__, age) => (
                          <option key={age} value={age}>{age} {age === 1 ? "yr" : "yrs"}</option>
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

// ─── date helpers ──────────────────────────────────────────────────────────
const formatDate = (d) => d.toISOString().split("T")[0];
const addDays = (date, days) => {
  const d = new Date(date); d.setDate(d.getDate() + days); return d;
};

// ─── main page ─────────────────────────────────────────────────────────────
export default function LastMinuteBookingPage() {
  // Number of days the check-in calendar should stay open from today —
  // pulled from the backend at mount (driven by the "Check-in Window (Days)"
  // configured on each Last Minute Contract Rate). Default 2.
  const [checkInWindowDays, setCheckInWindowDays] = useState(2);

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get("/api/last-minute-hotel-search/check-in-window")
      .then((res) => {
        const v = Number(res?.data?.maxDays);
        if (!cancelled && Number.isFinite(v) && v > 0) setCheckInWindowDays(v);
      })
      .catch(() => {
        // silent — fall back to the default of 2 days
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Allowed check-in dates (today / +1 / ... / +checkInWindowDays). Used to clamp the date input.
  const allowedCheckIns = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= checkInWindowDays; i++) arr.push(formatDate(addDays(new Date(), i)));
    return arr;
  }, [checkInWindowDays]);
  const today = allowedCheckIns[0];
  const maxCheckIn = allowedCheckIns[allowedCheckIns.length - 1];

  // ── form state ──
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);

  const [nationalityList, setNationalityList] = useState([]);
  const [selectedNationality, setSelectedNationality] = useState(null);
  const [isNationalityLoading, setIsNationalityLoading] = useState(false);

  const [agents, setAgents] = useState([]);
  const [agent, setAgent] = useState("");

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(formatDate(addDays(new Date(today), 1)));
  const [nights, setNights] = useState(1);

  const [rooms, setRooms] = useState([{ adults: 1, children: 0, childAges: [] }]);
  const [roomsOpen, setRoomsOpen] = useState(false);

  const [errors, setErrors] = useState({});

  // ── results state ──
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);

  // ── load static dropdowns ─────────────────────────────────────────────────
  const loadCountries = async (search = "") => {
    try {
      setIsNationalityLoading(true);
      const url = search ? `/api/country?search=${search}` : `/api/country?limit=50`;
      const res = await axiosInstance.get(url);
      setNationalityList((res.data || []).map((c) => ({
        value: c.id, label: c.name, code: c.countryCode,
      })));
    } catch {
      setNationalityList([]);
    } finally {
      setIsNationalityLoading(false);
    }
  };
  const debouncedCountrySearch = useRef(debounce(loadCountries, 300)).current;

  const loadDestinations = async () => {
    if (destinationOptions.length > 0) return;
    try {
      setIsDestinationLoading(true);
      const res = await axiosInstance.get("/api/province?limit=50");
      const opts = (res.data || []).map((c) => ({
        value: c.id,
        label: `${c.stateName},${c.country}`,
        countryId: c.countryId,
      }));
      setDestinationOptions(opts);
    } catch {
      setDestinationOptions([]);
    } finally {
      setIsDestinationLoading(false);
    }
  };
  const debouncedCitySearch = useRef(
    debounce(async (search) => {
      try {
        setIsDestinationLoading(true);
        const res = await axiosInstance.get(`/api/province?search=${search}`);
        setDestinationOptions((res.data || []).map((c) => ({
          value: c.id,
          label: `${c.stateName},${c.country}`,
          countryId: c.countryId,
        })));
      } catch {
        // silent
      } finally {
        setIsDestinationLoading(false);
      }
    }, 300)
  ).current;

  const loadAgents = async () => {
    try {
      const res = await axiosInstance.get("/api/agent");
      setAgents(res.data || []);
    } catch {
      setAgents([]);
    }
  };

  useEffect(() => {
    loadCountries();
    loadAgents();
  }, []);

  // ── auto-update checkout when check-in or nights change ──
  useEffect(() => {
    if (!checkIn) return;
    setCheckOut(formatDate(addDays(new Date(checkIn), Math.max(1, Number(nights) || 1))));
  }, [checkIn, nights]);

  // ── helpers ──
  const clearError = (field) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _ignore, ...rest } = prev;
      return rest;
    });

  const handleNightsChange = (val) => {
    const n = Math.max(1, Math.min(60, Number(val) || 1));
    setNights(n);
  };

  const validate = () => {
    const e = {};
    if (!selectedDestination) e.destination = "Destination is required";
    if (!selectedNationality) e.nationality = "Nationality is required";
    if (!agent) e.agent = "Agent is required";
    if (!checkIn) e.checkIn = "Check-in date is required";
    if (!checkOut) e.checkOut = "Check-out date is required";
    if (checkIn && (checkIn < today || checkIn > maxCheckIn)) {
      e.checkIn = `Check-in must be within today + ${checkInWindowDays} day(s)`;
    }
    if (checkIn && checkOut && checkOut <= checkIn) {
      e.checkOut = "Check-out must be after check-in";
    }
    return e;
  };

  // ── search ────────────────────────────────────────────────────────────────
  const handleSearch = async (event) => {
    event?.preventDefault?.();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});

    const totalAdults = rooms.reduce((a, r) => a + (r.adults || 0), 0);
    const totalChildren = rooms.reduce((a, r) => a + (r.children || 0), 0);

    const payload = {
      hotelId: null,
      cityId: selectedDestination?.value ?? null,
      checkInDate: checkIn ? `${checkIn}T00:00:00` : null,
      checkOutDate: checkOut ? `${checkOut}T00:00:00` : null,
      adults: totalAdults,
      children: totalChildren,
      rooms: rooms.length,
      roomGuests: rooms.map((r) => ({
        adults: r.adults || 1,
        children: r.children || 0,
        childAges: r.childAges || [],
      })),
    };

    try {
      setSearching(true);
      setResults(null);
      const res = await axiosInstance.post(
        "/api/last-minute-hotel-search/search",
        payload
      );
      if (res.data?.success) {
        setResults(res.data);
      } else {
        toast.error(res.data?.message || "Search failed");
        setResults({ ...(res.data || {}), hotels: [] });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || "Search failed";
      toast.error(msg);
      setResults({ hotels: [] });
    } finally {
      setSearching(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          {/* ── Search Card ── */}
          <Card className="shadow-sm rounded-xl mb-4 search-card-modern bg-white">
            <Card.Body className="p-4">
              <div className="mb-4 d-flex justify-content-between align-items-start">
                <div>
                  <h2 className="fw-semibold text-primary mb-1">Last Minute Deals</h2>
                  <p className="text-muted mb-0">Discounted rooms for check-in within 2 days</p>
                </div>
                <Badge bg="warning" text="dark" className="align-self-center">
                  Check-in: today through +{checkInWindowDays} day{checkInWindowDays === 1 ? "" : "s"} only
                </Badge>
              </div>

              <Form onSubmit={handleSearch}>
                <Row className="g-4">
                  {/* Destination */}
                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">Destination</Form.Label>
                      <Select
                        options={destinationOptions}
                        value={selectedDestination}
                        onChange={(opt) => { setSelectedDestination(opt); if (opt) clearError("destination"); }}
                        placeholder="Where do you want to go?"
                        isSearchable
                        isClearable
                        className="modern-select"
                        isLoading={isDestinationLoading}
                        noOptionsMessage={() => isDestinationLoading
                          ? "Searching destinations..."
                          : "Type to search destinations..."}
                        onMenuOpen={loadDestinations}
                        onInputChange={(input, { action }) => {
                          if (action === "input-change" && input) debouncedCitySearch(input);
                        }}
                        menuPortalTarget={document.body}
                        styles={{
                          menuPortal: (b) => ({ ...b, zIndex: 9999 }),
                          control: (b) => ({ ...b, minHeight: "42px", border: "1px solid #dee2e6" }),
                        }}
                      />
                      {errors.destination && <div className="text-danger small mt-1">{errors.destination}</div>}
                    </Form.Group>
                  </Col>

                  {/* Nationality */}
                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">Nationality</Form.Label>
                      <Select
                        options={nationalityList}
                        value={selectedNationality}
                        onChange={(opt) => { setSelectedNationality(opt); if (opt) clearError("nationality"); }}
                        onInputChange={(input) => { if (input?.length >= 2) debouncedCountrySearch(input); }}
                        isLoading={isNationalityLoading}
                        placeholder="Select nationality"
                        isSearchable
                        isClearable
                        className="modern-select"
                        menuPortalTarget={document.body}
                        styles={{
                          menuPortal: (b) => ({ ...b, zIndex: 9999 }),
                          control: (b) => ({ ...b, minHeight: "42px", border: "1px solid #dee2e6" }),
                        }}
                      />
                      {errors.nationality && <div className="text-danger small mt-1">{errors.nationality}</div>}
                    </Form.Group>
                  </Col>

                  {/* Agent */}
                  <Col lg={3} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">Agent</Form.Label>
                      <Form.Select
                        style={{ height: "42px" }}
                        className="form-control-modern"
                        value={agent}
                        onChange={(e) => { setAgent(e.target.value); if (e.target.value) clearError("agent"); }}
                      >
                        <option value="">Select Agent</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>{a.companyName}</option>
                        ))}
                      </Form.Select>
                      {errors.agent && <div className="text-danger small mt-1">{errors.agent}</div>}
                    </Form.Group>
                  </Col>

                  {/* Nights */}
                  <Col lg={2} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">Nights</Form.Label>
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

                  {/* Check-in (clamped to today/+1/+2) */}
                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">Check-in</Form.Label>
                      <Form.Control
                        style={{ height: "42px" }}
                        className="form-control-modern"
                        type="date"
                        value={checkIn}
                        min={today}
                        max={maxCheckIn}
                        onClick={(e) => e.target.showPicker && e.target.showPicker()}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCheckIn(v);
                          if (v) clearError("checkIn");
                        }}
                      />
                      {errors.checkIn && <div className="text-danger small mt-1">{errors.checkIn}</div>}
                    </Form.Group>
                  </Col>

                  {/* Check-out */}
                  <Col lg={3} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">Check-out</Form.Label>
                      <Form.Control
                        style={{ height: "42px" }}
                        className="form-control-modern"
                        type="date"
                        value={checkOut}
                        min={checkIn ? formatDate(addDays(new Date(checkIn), 1)) : today}
                        onClick={(e) => e.target.showPicker && e.target.showPicker()}
                        onChange={(e) => {
                          setCheckOut(e.target.value);
                          if (e.target.value) clearError("checkOut");
                        }}
                      />
                      {errors.checkOut && <div className="text-danger small mt-1">{errors.checkOut}</div>}
                    </Form.Group>
                  </Col>

                  {/* Rooms & Guests */}
                  <Col lg={4} md={6}>
                    <Form.Label className="fw-semibold text-dark">Rooms & Guests</Form.Label>
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
                      disabled={searching}
                      size="lg"
                    >
                      {searching ? (
                        <><Spinner animation="border" size="sm" className="me-2" />Searching...</>
                      ) : (
                        <><FaSearch className="me-2" />SEARCH LAST MINUTE DEALS</>
                      )}
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>

          {/* ── Progress Bar (mirrors HotelSearch.jsx) ── */}
          <SearchProgressBar active={searching} />

          {/* ── Results layout — left filter sidebar + right card grid ── */}
          {searching ? (
            <Card className="shadow-sm rounded-xl mb-4">
              <Card.Body className="text-center py-4">
                <Spinner animation="border" variant="primary" />
                <p className="text-muted mt-2 mb-0">Loading last minute deals...</p>
              </Card.Body>
            </Card>
          ) : results ? (
            <ResultsWithFilters
              results={results}
              searchContext={{
                checkIn,
                checkOut,
                rooms,
                nationality: selectedNationality,
                agent,
              }}
            />
          ) : (
            <Card className="shadow-sm rounded-xl">
              <Card.Body className="text-center text-muted py-5">
                <FaSearch className="display-4 text-muted mb-3" />
                <h4>Ready to Find Last Minute Deals?</h4>
                <p>Use the search form above to discover discounted rooms for the next 2 days.</p>
              </Card.Body>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Filter constants — mirror HotelSearch.jsx ────────────────────────────
const STAR_OPTIONS = [
  { value: "", label: "All Stars" },
  { value: 1, label: "1 Star" },
  { value: 2, label: "2 Star" },
  { value: 3, label: "3 Star" },
  { value: 4, label: "4 Star" },
  { value: 5, label: "5 Star" },
];

const HOTEL_TYPE_OPTIONS = [
  { value: "hotel", label: "Hotel" },
  { value: "villa", label: "Villa" },
  { value: "resort", label: "Resort" },
  { value: "apartment", label: "Apartment" },
];

const CHANNEL_OPTIONS = [
  { value: "inhouse", label: "Inhouse" },
];

const PAGE_SIZE = 10;

// ─── ResultsWithFilters — full HotelSearch.jsx layout clone ────────────────
//
// Renders:
//   • Left sidebar (lg=3): map preview, hotel name search, hotel type
//     checkboxes, channel checkboxes.
//   • Right column (lg=9): top filter bar (star dropdown + sort pills + clear),
//     "Showing X to Y of N entries" line, hotel cards, pagination footer.
//
// All filtering happens client-side over `results.hotels` since the backend
// returns the full set in one shot.
function ResultsWithFilters({ results, searchContext }) {
  const navigate = useNavigate();

  // Filter state
  const [hotelSearchTerm, setHotelSearchTerm] = useState("");
  const [hotelType, setHotelType] = useState([]);
  const [channelType, setChannelType] = useState([]);
  const [starRating, setStarRating] = useState(STAR_OPTIONS[0]);
  const [sortBy, setSortBy] = useState("priceAsc");
  const [pageIndex, setPageIndex] = useState(0);

  // Apply filters + sort
  const filteredAndSorted = useMemo(() => {
    let list = Array.isArray(results?.hotels) ? [...results.hotels] : [];

    // Name filter
    if (hotelSearchTerm.trim()) {
      const q = hotelSearchTerm.trim().toLowerCase();
      list = list.filter((h) => (h.hotelName || "").toLowerCase().includes(q));
    }

    // Star rating filter
    if (starRating?.value) {
      list = list.filter((h) => Number(h.starRating) === Number(starRating.value));
    }

    // Hotel type — filter on category name (best we can do without a discrete type field)
    if (hotelType.length > 0) {
      const wanted = hotelType.map((t) => t.value.toLowerCase());
      list = list.filter((h) => {
        const cat = (h.categoryName || "").toLowerCase();
        return wanted.some((w) => cat.includes(w));
      });
    }

    // Channel — last-minute is single-source ("inhouse"). When the user
    // checks Inhouse, we keep everything; when they check something else,
    // we'd return nothing. So treat empty/inhouse-only as no-op.
    if (channelType.length > 0 && !channelType.some((c) => c.value === "inhouse")) {
      list = [];
    }

    // Sort
    const cheapest = (h) => (h.fromRate != null ? Number(h.fromRate) : Infinity);
    if (sortBy === "priceAsc") list.sort((a, b) => cheapest(a) - cheapest(b));
    else if (sortBy === "priceDesc") list.sort((a, b) => cheapest(b) - cheapest(a));

    return list;
  }, [results, hotelSearchTerm, starRating, hotelType, channelType, sortBy]);

  // Pagination
  const totalElements = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));
  useEffect(() => { if (pageIndex >= totalPages) setPageIndex(0); }, [totalPages, pageIndex]);
  const startEntry = totalElements === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const endEntry = Math.min(totalElements, (pageIndex + 1) * PAGE_SIZE);
  const pageHotels = filteredAndSorted.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);
  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return [];
    const pages = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }, [totalPages]);

  // View Rooms handler — same sessionStorage handoff as before.
  const handleViewRooms = (hotel) => {
    const payload = { hotel, results: { ...results }, searchContext };
    try {
      sessionStorage.setItem("lastMinuteRoomListPayload", JSON.stringify(payload));
    } catch (e) {
      console.error("Failed to write sessionStorage:", e);
    }
    window.open("/last-minute-room-list", "_blank");
  };

  const clearAllFilters = () => {
    setStarRating(STAR_OPTIONS[0]);
    setHotelType([]);
    setChannelType([]);
    setSortBy("priceAsc");
    setHotelSearchTerm("");
  };

  return (
    <div className="search-layout">
      <Row className="g-4">
        {/* ─── Left sidebar — same structure as HotelSearch.jsx ─── */}
        <Col lg={3} className="leftside d-none d-lg-block">
          <div className="left-fixed">
            <Card className="shadow-sm rounded-xl filtersection">
              <Card.Body className="p-2">
                {/* Map preview */}
                <div className="map-preview-wrapper mb-2">
                  <img src="/images/map.jpg" alt="Map preview" className="map-preview-img" />
                  <button className="map-overlay-btn">EXPLORE ON MAP 📍</button>
                </div>

                {/* Name search */}
                <Form.Control
                  type="text"
                  placeholder="Search Hotel Name"
                  className="ps-3 mb-2"
                  value={hotelSearchTerm}
                  onChange={(e) => { setHotelSearchTerm(e.target.value); setPageIndex(0); }}
                />

                {/* Hotel type */}
                <Form.Group className="mb-2">
                  <Form.Label className="fw-semibold small">Hotel Type</Form.Label>
                  <div className="filter-checkbox-list">
                    {HOTEL_TYPE_OPTIONS.map((item) => (
                      <Form.Check
                        key={item.value}
                        type="checkbox"
                        id={`lm-hotel-type-${item.value}`}
                        label={item.label}
                        checked={hotelType.some((t) => t.value === item.value)}
                        onChange={(e) => {
                          if (e.target.checked) setHotelType([...hotelType, item]);
                          else setHotelType(hotelType.filter((t) => t.value !== item.value));
                          setPageIndex(0);
                        }}
                      />
                    ))}
                  </div>
                </Form.Group>

                <hr />

                {/* Channel */}
                <Form.Group>
                  <Form.Label className="fw-semibold small">Channel</Form.Label>
                  <div className="filter-checkbox-list">
                    {CHANNEL_OPTIONS.map((item) => (
                      <Form.Check
                        key={item.value}
                        type="checkbox"
                        id={`lm-channel-${item.value}`}
                        label={item.label}
                        checked={channelType.some((c) => c.value === item.value)}
                        onChange={(e) => {
                          if (e.target.checked) setChannelType([...channelType, item]);
                          else setChannelType(channelType.filter((c) => c.value !== item.value));
                          setPageIndex(0);
                        }}
                      />
                    ))}
                  </div>
                </Form.Group>
              </Card.Body>
            </Card>
          </div>
        </Col>

        {/* ─── Right column — filter bar, count, hotel cards, pagination ─── */}
        <Col lg={9}>
          <Card className="shadow-sm rounded-xl mb-3 filtersection">
            <Card.Body className="p-2">
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <Select
                  options={STAR_OPTIONS}
                  value={starRating}
                  onChange={(opt) => { setStarRating(opt); setPageIndex(0); }}
                  placeholder="All Stars"
                  className="modern-select-sm"
                  menuPortalTarget={document.body}
                  styles={{
                    control: (base) => ({
                      ...base,
                      height: "36px", minHeight: "36px", width: "180px",
                      background: "#ffffff", color: "#000000", marginLeft: "30px",
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
                  onClick={clearAllFilters}
                >
                  Clear
                </Button>
              </div>
            </Card.Body>
          </Card>

          <div className="d-flex justify-content-between align-items-center mb-3">
            <small className="text-muted fw-semibold">
              Showing {startEntry} to {endEntry} of {totalElements} entries
            </small>
          </div>

          <Row className="g-4">
            {pageHotels.length > 0 ? (
              pageHotels.map((h) => (
                <Col xs={12} key={h.hotelId}>
                  <HotelCard hotel={h} onViewRooms={() => handleViewRooms(h)} />
                </Col>
              ))
            ) : (
              <Col xs={12}>
                <Card className="shadow-sm rounded-xl">
                  <Card.Body className="text-center text-muted py-5">
                    <FaSearch className="display-4 text-muted mb-3" />
                    <h5>No results found</h5>
                    <p>Try adjusting your filters or search criteria.</p>
                    <Button variant="outline-primary" size="sm" onClick={clearAllFilters}>
                      Clear All Filters
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            )}
          </Row>

          {totalElements > 0 && totalPages > 1 && (
            <div className="d-flex justify-content-end align-items-center mt-3 mb-4">
              <Pagination className="mb-0 pagination-modern">
                <Pagination.Prev
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex(pageIndex - 1)}
                />
                {pageNumbers.map((n) => (
                  <Pagination.Item
                    key={n}
                    active={n === pageIndex + 1}
                    onClick={() => setPageIndex(n - 1)}
                  >
                    {n}
                  </Pagination.Item>
                ))}
                <Pagination.Next
                  disabled={pageIndex >= totalPages - 1}
                  onClick={() => setPageIndex(pageIndex + 1)}
                />
              </Pagination>
            </div>
          )}
        </Col>
      </Row>
    </div>
  );
}

// Single hotel card — extracted so it can be reused / kept readable.
function HotelCard({ hotel: h, onViewRooms }) {
  return (
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
        {/* Image (left) */}
        <Col md={4}>
          <div style={{ position: "relative", height: "100%", padding: "15px" }}>
            <div
              className="ratio rounded-xl overflow-hidden"
              style={{ "--bs-aspect-ratio": "66.25%" }}
            >
              <img
                src={h.hotelImage || DEFAULT_HOTEL_IMAGE}
                alt={h.hotelName}
                loading="lazy"
                decoding="async"
                style={{
                  width: "100%", height: "100%", objectFit: "cover", borderRadius: "9px",
                }}
                onError={(ev) => { ev.currentTarget.src = DEFAULT_HOTEL_IMAGE; }}
              />
            </div>
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
              {h.starRating != null ? h.starRating : "—"}
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

        {/* Info (right) */}
        <Col md={8}>
          <div style={{ padding: "16px" }}>
            <h6 style={{ fontSize: "1.0rem", fontWeight: 600, marginBottom: 8, color: "#333" }}>
              {h.hotelName || "Hotel Name Not Available"}
            </h6>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: 8 }}>
              <FaMapMarkerAlt className="me-1" />
              {h.address || h.cityName || "Address Not Available"}
            </p>
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
              Rate Available
            </span>

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
              <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#333" }}>
                {h.fromRate != null
                  ? `AED ${Number(h.fromRate).toLocaleString()}`
                  : "Price on request"}
              </div>
              <Button size="sm" variant="primary" onClick={onViewRooms}>
                View Rooms
              </Button>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
}

