import React, { useEffect, useRef, useState } from "react";
import { Card, Button, Row, Col, Form, Spinner, Modal } from "react-bootstrap";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import Select from "react-select";
import axiosInstance from "../../../components/AxiosInstance";
import AgentBalanceDisplay from "../../../components/AgentBalanceDisplay";
import AgentCreditBalance from "../../../components/AgentCreditBalance";
import {
  FaSearch,
  FaEye,
  FaCalendarAlt,
  FaInfoCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaClipboardList,
  FaMapMarkerAlt,
  FaHotel,
  FaCar,
  FaHiking,
  FaMoneyBillWave,
  FaTag,
  FaFileContract,
  FaPlaneDeparture,
  FaExclamationTriangle,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import "../../../styles/PackageSearch.css";

// ─────────────────────────────────────────────
// Counter Button helper
// (mirrors the "Rooms & Guests" selector on /new-booking/hotel — HotelSearch.jsx)
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

// Maximum number of rooms allowed per booking.
const MAX_ROOMS = 5;

// ─────────────────────────────────────────────
// Room Guest Selector
// ─────────────────────────────────────────────
function RoomGuestSelector({ value, onChange }) {
  const [rooms, setRooms] = useState(value);

  // Sync internal state when the parent updates the rooms list externally
  // (e.g. the "Add Room" button beside the Rooms & Guests trigger).
  useEffect(() => {
    setRooms(value);
  }, [value]);

  const update = (next) => {
    setRooms(next);
    onChange && onChange(next);
  };

  const addRoom = () => {
    // Enforce the per-booking room cap.
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
                  <span className="rgs-counter-sub">Age 12+</span>
                </div>
                <Counter
                  value={room.adults}
                  min={1}
                  max={3}
                  onChange={(v) => setAdults(i, v)}
                />
              </div>
              <div className="rgs-counter-row">
                <div className="rgs-counter-info">
                  <span className="rgs-counter-title">Children</span>
                  <span className="rgs-counter-sub">Age 0–12</span>
                </div>
                <Counter
                  value={room.children}
                  min={0}
                  max={4}
                  onChange={(v) => setChildren(i, v)}
                />
              </div>
            </div>

            {/* Informational guidance only — shown ONLY when this room has
                more than 2 children, so users planning that case understand
                they may need an additional room. Does NOT validate or
                restrict. */}
            {room.children > 2 && (
              <div
                role="note"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  border: "1px solid #b6e0fe",
                  backgroundColor: "#eaf6ff",
                  color: "#084c8d",
                  borderRadius: "4px",
                  padding: "8px 10px",
                  marginTop: "8px",
                  fontSize: "0.78rem",
                  lineHeight: 1.35,
                }}
              >
                <FaInfoCircle
                  style={{ marginTop: "2px", flexShrink: 0 }}
                  aria-hidden="true"
                />
                <span>
                  Most hotels allow up to <strong>2 children per room</strong>.
                  If you have more than 2 children, you may need to book an
                  additional room.
                </span>
              </div>
            )}

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
                        {/* Children are age 0–12, so the age options stop at 12. */}
                        {Array.from({ length: 13 }).map((__, age) => (
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

const PackageSearch = () => {
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState("");
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  // Rooms & Guests filter — mirrors /new-booking/hotel (HotelSearch.jsx).
  // Each room holds its own adult/children counts and per-child ages.
  const [rooms, setRooms] = useState([
    { adults: 1, children: 0, childAges: [] },
  ]);
  // Controls the expandable Rooms & Guests selector below the trigger button.
  const [roomsOpen, setRoomsOpen] = useState(false);
  // Flight Details filter (optional) — the traveller's arrival & departure
  // date/time. When both are set they are sent with the search so the backend
  // flags packages whose itinerary is longer than this travel window.
  const [arrivalDateTime, setArrivalDateTime] = useState("");
  const [departureDateTime, setDepartureDateTime] = useState("");
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  // When results are on screen the big search form collapses into a sticky
  // summary strip. Clicking "Modify Search" flips this true to re-expand it.
  const [isEditingSearch, setIsEditingSearch] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(null);
  const resultsRef = useRef(null);

  // After a fresh search, jump the viewport to the results so the operator
  // sees them without having to scroll past the search card. Fires once the
  // first batch of packages actually arrives.
  useEffect(() => {
    if (!hasSearched || results.length === 0) return;
    const id = window.setTimeout(() => {
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
    return () => window.clearTimeout(id);
  }, [hasSearched, results.length]);
  const navigate = useNavigate();
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // ─────────────────────────────────────────────
  // Helper: Debounce function
  // ─────────────────────────────────────────────
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // ─────────────────────────────────────────────
  // Progress Bar Helpers
  // ─────────────────────────────────────────────
  const startProgress = () => {
    setProgress(0);
    let current = 0;
    progressRef.current = setInterval(() => {
      current += Math.random() * 8 + 2;
      if (current >= 90) {
        current = 90;
        clearInterval(progressRef.current);
      }
      setProgress(Math.min(current, 90));
    }, 200);
  };

  const completeProgress = () => {
    clearInterval(progressRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 600);
  };

  // ─────────────────────────────────────────────
  // API: Fetch Agents
  // ─────────────────────────────────────────────
  const fetchAgents = async () => {
    try {
      const response = await axiosInstance.get("/api/agent?activeOnly=true");
      setAgents(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching agents:", error);
      setAgents([]);
    }
  };

  // ─────────────────────────────────────────────
  // API: Fetch Destinations (Initial & Search)
  // ─────────────────────────────────────────────
  const loadInitialDestinations = async () => {
    try {
      setIsDestinationLoading(true);
      const response = await axiosInstance.get("/api/province?limit=50");
      const cityApiRes = Array.isArray(response.data) ? response.data : [];
      const options = cityApiRes.map((city) => ({
        value: city.id,
        label: `${city.stateName}, ${city.country}`,
        countryId: city.countryId,
      }));
      setDestinationOptions(options);
    } catch (error) {
      console.error("Error loading initial destinations:", error);
    } finally {
      setIsDestinationLoading(false);
    }
  };

  const debouncedCitySearch = useRef(
    debounce(async (searchText = "") => {
      if (!searchText || searchText.length < 2) {
        loadInitialDestinations();
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
      } catch (error) {
        console.error("Error searching cities:", error);
        setDestinationOptions([]);
      } finally {
        setIsDestinationLoading(false);
      }
    }, 300),
  ).current;

  useEffect(() => {
    fetchAgents();
    loadInitialDestinations();
  }, []);

  // ─────────────────────────────────────────────
  // Form Submission
  // ─────────────────────────────────────────────
  const validateForm = () => {
    const newErrors = {};
    if (!selectedDestination) newErrors.destination = "Destination is required";
    if (!agentId) newErrors.agent = "Agent is required";
    // Flight Details are optional, but if the user starts filling them in the
    // pair must be complete and in the correct order.
    if (arrivalDateTime && !departureDateTime)
      newErrors.departureDateTime = "Departure date & time is required";
    if (departureDateTime && !arrivalDateTime)
      newErrors.arrivalDateTime = "Arrival date & time is required";
    if (
      arrivalDateTime &&
      departureDateTime &&
      new Date(departureDateTime) <= new Date(arrivalDateTime)
    )
      newErrors.departureDateTime = "Departure must be after arrival";
    return newErrors;
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);
    startProgress();
    setHasSearched(true);
    setIsEditingSearch(false);
    setResults([]);

    try {
      const totalAdults = rooms.reduce((a, r) => a + (r.adults || 0), 0);
      const totalChildren = rooms.reduce((a, r) => a + (r.children || 0), 0);
      const payload = {
        countryId: selectedDestination.countryId || "",
        cityId: selectedDestination.value || "",
        agentId: agentId || "",
        // Flight Details filter — sent only when both ends are provided.
        arrivalDateTime: arrivalDateTime || "",
        departureDateTime: departureDateTime || "",
        // Occupancy filter — the backend returns only packages that have a
        // category able to accommodate this group, along with the matched
        // category (matchedCategoryId/Name) used later by the booking flow.
        adultCount: totalAdults || 1,
        childCount: totalChildren,
      };

      console.log("Package search payload:", payload);
      const response = await axiosInstance.post(
        "/api/v1/package-booking/search",
        payload,
      );

      console.log("Package search response:", response.data);
      setResults(Array.isArray(response.data) ? response.data : []);

      if (response.data.length > 0) {
        toast.success(`Found ${response.data.length} packages!`);
      } else {
        toast.error("No packages found for the selected criteria.");
      }
    } catch (error) {
      console.error("Package search failed:", error);
      toast.error(error.response?.data?.message || "Package search failed");
      setResults([]);
    } finally {
      setIsLoading(false);
      completeProgress();
    }
  };

  const handleBookNow = (pkg) => {
    // Flight Details filter: this package's itinerary is longer than the
    // selected travel window. Warn and let the user accept before booking.
    if (pkg.exceedsTravelWindow) {
      const proceed = window.confirm(
        `${
          pkg.travelWindowWarning ||
          "This package's itinerary is longer than your selected flight window."
        }\n\nDo you want to continue booking this package?`,
      );
      if (!proceed) return;
    }

    // Open the booking page in a new browser tab. location.state isn't
    // preserved across windows, so we pipe the context through query
    // params and let PackageBooking read it back from either source.
    const params = new URLSearchParams();
    if (agentId) params.set("agentId", agentId);
    if (selectedDestination?.countryId)
      params.set("destinationCountryId", String(selectedDestination.countryId));
    if (pkg.rate != null) params.set("searchRate", String(pkg.rate));
    if (pkg.rateType) params.set("searchRateType", pkg.rateType);
    params.set("searchCurrency", pkg.currencyCode || "AED");

    // Carry the Rooms & Guests selection into the booking page so its Pax
    // counts default to what was chosen on the search screen. A package
    // booking uses a single pax set, so forward the aggregate totals across
    // all rooms. PackageBooking seeds its initial searchParams from these.
    const totalAdults = rooms.reduce((a, r) => a + (r.adults || 0), 0);
    const totalChildren = rooms.reduce((a, r) => a + (r.children || 0), 0);
    const allChildAges = rooms.flatMap((r) => r.childAges || []);
    params.set("adultCount", String(totalAdults || 1));
    params.set("childCount", String(totalChildren));
    if (allChildAges.length) params.set("childAges", allChildAges.join(","));
    params.set("noOfRooms", String(rooms.length));

    // Carry the category the search resolved for this occupancy so the booking
    // (Hotels step + submit) uses it directly — the Basic Details step and its
    // category picker have been removed.
    if (pkg.matchedCategoryId != null)
      params.set("packageCategory", String(pkg.matchedCategoryId));
    if (pkg.matchedCategoryName)
      params.set("packageCategoryName", pkg.matchedCategoryName);

    // ADD NEW ITEM flow: PackageBookingDetailView navigates here with
    // ?parentBookingCode=GPKG-... so the booking that gets created
    // becomes a child of an existing primary booking. Forward it through
    // verbatim so PackageBooking → PaxInformation can stamp the POST /book
    // payload, and the backend writes "{parent}/{n}" for bookingCode.
    const incomingParent = new URLSearchParams(window.location.search).get(
      "parentBookingCode",
    );
    if (incomingParent) params.set("parentBookingCode", incomingParent);

    const url = `/new-booking/package-booking/${pkg.packageId}?${params.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Resolve image paths the same way PackageDetailedView does, so saved
  // absolute Windows paths still render in-browser.
  const getImageUrl = (imagePath) => {
    if (!imagePath) return "";
    if (imagePath.startsWith("http")) return imagePath;
    if (imagePath.includes("\\") || imagePath.includes(":")) {
      const filename = imagePath.split("\\").pop();
      return `${process.env.REACT_APP_API_BASE_URL}/api/files/${filename}`;
    }
    return `${process.env.REACT_APP_API_BASE_URL}/api/files/${imagePath}`;
  };

  const handleView = React.useCallback(async (packageId) => {
    try {
      setIsDetailLoading(true);
      setSelectedPackage(null);
      setShowDetailModal(true);

      const response = await axiosInstance.get(
        `/api/TravelPackage/view/${packageId}`,
      );
      setSelectedPackage(response.data);
    } catch (error) {
      console.error("Error fetching package details:", error);
      toast.error("Failed to fetch package details");
      setShowDetailModal(false);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  // Results are on screen once a search has run. Collapse the full form into
  // the sticky summary strip then, unless the user chose to modify the search.
  const collapseSearch = hasSearched && !isEditingSearch;
  const selectedAgentName = agents.find(
    (a) => String(a.id) === String(agentId),
  )?.companyName;

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 package-search-container">
          {/* ── Collapsed sticky search summary strip ──
              Shown once results are on screen. "Modify Search" re-expands
              the full form by flipping isEditingSearch. */}
          {collapseSearch && (
            <div className="hs-summary-bar">
              <div className="hs-summary-chips">
                {selectedDestination?.label && (
                  <span className="hs-summary-chip hs-summary-chip-main">
                    {selectedDestination.label}
                  </span>
                )}
                {selectedAgentName && (
                  <span className="hs-summary-chip">{selectedAgentName}</span>
                )}
                <span className="hs-summary-chip">
                  {rooms.reduce((a, r) => a + r.adults, 0)} adults ·{" "}
                  {rooms.reduce((a, r) => a + r.children, 0)} Child
                </span>
                {arrivalDateTime && departureDateTime && (
                  <span className="hs-summary-chip">
                    ✈ {arrivalDateTime.replace("T", " ")} →{" "}
                    {departureDateTime.replace("T", " ")}
                  </span>
                )}
              </div>
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
            </div>
          )}

          {!collapseSearch && (
          <Card className="search-card-modern shadow-sm border-0 hs-form-expand">
            <Card.Body>
              <div className="mb-4 d-flex justify-content-between align-items-start flex-wrap gap-2">
                <div>
                  <h2 className="fw-bold text-primary mb-1">Package Search</h2>
                  <p className="text-muted">
                    Find the best travel packages for your clients
                  </p>
                </div>
                {/* Agent logins see their available credit balance at the
                    right end of the heading row (renders nothing for other
                    roles). */}
                <AgentCreditBalance />
              </div>

              <Form onSubmit={handleSearchSubmit}>
                <Row className="g-4">
                  {/* Agent Dropdown */}
                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label>Agent</Form.Label>
                      <Form.Select
                        className="form-control-modern"
                        value={agentId}
                        onChange={(e) => {
                          setAgentId(e.target.value);
                          if (e.target.value)
                            setErrors((prev) => ({ ...prev, agent: null }));
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
                      <AgentBalanceDisplay agentId={agentId} />
                    </Form.Group>
                  </Col>

                  {/* Destination Dropdown */}
                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label>Destination</Form.Label>
                      <Select
                        className="modern-select"
                        classNamePrefix="react-select"
                        options={destinationOptions}
                        value={selectedDestination}
                        isLoading={isDestinationLoading}
                        onInputChange={(val) => debouncedCitySearch(val)}
                        onChange={(option) => {
                          setSelectedDestination(option);
                          if (option)
                            setErrors((prev) => ({
                              ...prev,
                              destination: null,
                            }));
                        }}
                        placeholder="Search for Country or City..."
                        isSearchable
                        isClearable
                      />
                      {errors.destination && (
                        <div className="text-danger small mt-1">
                          {errors.destination}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  {/* Rooms & Guests — same selector as /new-booking/hotel.
                      The summary button shows the aggregate adults/children/
                      rooms and toggles the expandable RoomGuestSelector; the
                      Add Room button appends a room (up to MAX_ROOMS). */}
                  <Col lg={4} md={6}>
                    <Form.Label>Number of Adults and Children</Form.Label>
                    <div className="d-flex flex-wrap gap-2">
                      <Button
                        variant="outline-primary"
                        className="flex-grow-1 text-start rooms-summary-btn-modern"
                        type="button"
                        onClick={() => setRoomsOpen((o) => !o)}
                      >
                        {rooms.reduce((a, r) => a + r.adults, 0)} adults ·{" "}
                        {rooms.reduce((a, r) => a + r.children, 0)} Child
                        <span className="float-end">
                          {roomsOpen ? "▴" : "▾"}
                        </span>
                      </Button>
                      <Button
                        type="button"
                        className="flex-shrink-0 btn-add-room-premium"
                        disabled={roomsOpen && rooms.length >= MAX_ROOMS}
                        onClick={() => {
                          if (!roomsOpen) {
                            setRoomsOpen(true); // first click: just open
                          } else {
                            // later clicks: add room, but never exceed the cap
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
                  </Col>
                </Row>

                {/* Expandable Rooms & Guests selector */}
                {roomsOpen && (
                  <Row className="g-3 mt-2">
                    <Col md={12}>
                      <RoomGuestSelector value={rooms} onChange={setRooms} />
                    </Col>
                  </Row>
                )}

                {/* Flight Details filter — arrival & departure date/time.
                    Optional; when both are set the backend flags packages
                    whose itinerary is longer than this travel window so the
                    user is warned before booking. */}
                <Row className="mt-3">
                  <Col xs={12}>
                    <div className="flight-details-group">
                      <div className="flight-details-title">
                        <FaPlaneDeparture className="me-2" />
                        Flight Details
                        <span className="flight-details-hint">
                          Filter packages that fit your travel window
                        </span>
                      </div>
                      <Row className="g-3">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label>Arrival (Date &amp; Time)</Form.Label>
                            <Form.Control
                              type="datetime-local"
                              className="form-control-modern"
                              value={arrivalDateTime}
                              onChange={(e) => {
                                setArrivalDateTime(e.target.value);
                                setErrors((prev) => ({
                                  ...prev,
                                  arrivalDateTime: null,
                                  departureDateTime: null,
                                }));
                              }}
                            />
                            {errors.arrivalDateTime && (
                              <div className="text-danger small mt-1">
                                {errors.arrivalDateTime}
                              </div>
                            )}
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label>
                              Departure (Date &amp; Time)
                            </Form.Label>
                            <Form.Control
                              type="datetime-local"
                              className="form-control-modern"
                              value={departureDateTime}
                              min={arrivalDateTime || undefined}
                              onChange={(e) => {
                                setDepartureDateTime(e.target.value);
                                setErrors((prev) => ({
                                  ...prev,
                                  departureDateTime: null,
                                }));
                              }}
                            />
                            {errors.departureDateTime && (
                              <div className="text-danger small mt-1">
                                {errors.departureDateTime}
                              </div>
                            )}
                          </Form.Group>
                        </Col>
                      </Row>
                    </div>
                  </Col>
                </Row>

                <div className="d-flex justify-content-center mt-5">
                  <Button
                    type="submit"
                    className="btn-search-modern d-flex align-items-center gap-2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Spinner animation="border" size="sm" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <FaSearch size={18} />
                        SEARCH PACKAGES
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
          )}

          {/* Progress Bar */}
          {progress > 0 && (
            <div className="progress-bar-wrap">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Results / Empty State */}
          <div ref={resultsRef}>
          {!hasSearched ? (
            <Card className="empty-state-card mt-5 text-center py-5">
              <Card.Body>
                <div className="empty-state-icon">
                  <FaSearch />
                </div>
                <h4 className="fw-bold text-dark mb-2">Ready to Search?</h4>
                <p className="text-muted mx-auto" style={{ maxWidth: "500px" }}>
                  Select a destination and an agent to discover available travel
                  packages and special offers.
                </p>
              </Card.Body>
            </Card>
          ) : results.length > 0 ? (
            <div className="mt-4">
              {/* Results Header */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold mb-0 text-dark">Search Results</h5>
                <span className="text-muted fw-medium">
                  {results.length} Packages Found
                </span>
              </div>

              {/* Card Grid */}
              <Row className="g-3">
                {results.map((pkg) => (
                  <Col key={pkg.packageId} xl={4} lg={4} md={6}>
                    <div className="result-card-wrap">
                      <Card className="result-card border-0">
                        {/* Image */}
                        <div className="package-image-wrap">
                          <img
                            src={
                              getImageUrl(pkg.packageImage) ||
                              "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80"
                            }
                            alt={pkg.packageName}
                            className="package-image"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src =
                                "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80";
                            }}
                          />
                          <div className="duration-badge">
                            <FaClock className="me-1 mb-1" size={11} />
                            {pkg.duration} Night(s)
                          </div>
                        </div>

                        {/* Body */}
                        <Card.Body className="d-flex flex-column p-3">
                          <span className="package-type-tag">
                            {pkg.packageType}
                          </span>
                          <h6 className="package-name">{pkg.packageName}</h6>
                          <p
                            className="text-muted mb-3"
                            style={{ fontSize: "0.78rem" }}
                          >
                            {pkg.packageCategory}
                          </p>

                          {/* Flight Details filter warning — shown when the
                              package itinerary is longer than the selected
                              arrival→departure window. */}
                          {pkg.exceedsTravelWindow && (
                            <div className="pkg-window-warning" role="note">
                              <FaExclamationTriangle
                                className="pkg-window-warning-icon"
                                aria-hidden="true"
                              />
                              <span>{pkg.travelWindowWarning}</span>
                            </div>
                          )}

                          {/* Price + Book */}
                          <div className="price-box d-flex justify-content-between align-items-center mt-auto">
                            <div>
                              <span className="price-currency">AED </span>
                              <span className="price-value">{pkg.rate}</span>
                              <span className="price-unit">
                                /{pkg.rateType}
                              </span>
                            </div>
                            <Button
                              variant="success"
                              size="sm"
                              className="px-2 d-flex align-items-center justify-content-center"
                              onClick={() => handleView(pkg.packageId)}
                            >
                             <FaEye size={15}/>
                              
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              className="rounded-pill px-3 fw-bold"
                              style={{ fontSize: "0.78rem" }}
                              onClick={() => handleBookNow(pkg)}
                            >
                              Book Now
                            </Button>
                          </div>
                        </Card.Body>
                      </Card>
                    </div>
                  </Col>
                ))}
              </Row>
            </div>
          ) : (
            <Card className="empty-state-card mt-5 text-center py-5">
              <Card.Body>
                <div className="empty-state-icon text-muted opacity-50">
                  <FaSearch />
                </div>
                <h4 className="fw-bold text-dark mb-2">No Packages Found</h4>
                <p className="text-muted mx-auto" style={{ maxWidth: "500px" }}>
                  We couldn't find any packages matching your selection. Try
                  adjusting your destination or agent.
                </p>
                <Button
                  variant="outline-primary"
                  className="mt-3 rounded-pill"
                  onClick={() => {
                    setHasSearched(false);
                    setResults([]);
                  }}
                >
                  Clear Search
                </Button>
              </Card.Body>
            </Card>
          )}
          </div>
        </main>
      </div>
      {/* Package Detail Modal */}
      <Modal
        show={showDetailModal}
        onHide={() => setShowDetailModal(false)}
        size="lg"
        centered
        scrollable
        className="package-detail-modal"
      >
        <Modal.Header closeButton className="detail-modal-header">
          <Modal.Title className="detail-modal-title">
            {isDetailLoading
              ? "Loading package details..."
              : selectedPackage?.packageName || "Package Details"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0 detail-modal-body">
          {isDetailLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="danger" />
              <p className="mt-3 small text-muted mb-0">
                Fetching package details...
              </p>
            </div>
          ) : selectedPackage ? (
            <div className="modal-content-inner">
              {/* ─── Hero ─────────────────────────────────────────── */}
              <div className="detail-hero-image-container">
                <img
                  src={
                    getImageUrl(selectedPackage.packageImage) ||
                    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80"
                  }
                  alt={selectedPackage.packageName}
                  className="detail-hero-image"
                  onError={(e) => {
                    e.target.src =
                      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80";
                  }}
                />
                <div className="detail-hero-overlay">
                  <div className="detail-hero-text">
                    <span className="detail-hero-type">
                      {selectedPackage.packageTypeName || "Travel Package"}
                    </span>
                    <h4 className="detail-hero-name">
                      {selectedPackage.packageName}
                    </h4>
                    <div className="detail-hero-meta">
                      {selectedPackage.arriveCountryName && (
                        <span>
                          <FaMapMarkerAlt className="me-1" size={11} />
                          {selectedPackage.arriveCountryName}
                        </span>
                      )}
                      {selectedPackage.noOfNights != null && (
                        <span>
                          <FaClock className="me-1" size={11} />
                          {selectedPackage.noOfNights} Night(s)
                        </span>
                      )}
                      {selectedPackage.packageCode && (
                        <span>
                          <FaTag className="me-1" size={11} />
                          {selectedPackage.packageCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="detail-body-content p-3">
                {/* ─── Highlight Strip ───────────────────────────── */}
                <div className="highlight-strip">
                  <div className="highlight-item">
                    <FaMoneyBillWave className="highlight-icon" />
                    <div>
                      <div className="highlight-label">Basic Rate</div>
                      <div className="highlight-value">
                        {selectedPackage.currencyName
                          ? `${selectedPackage.currencyName} `
                          : ""}
                        {selectedPackage.packageBasicRate ?? "-"}
                      </div>
                    </div>
                  </div>
                  <div className="highlight-item">
                    <FaClock className="highlight-icon" />
                    <div>
                      <div className="highlight-label">Duration</div>
                      <div className="highlight-value">
                        {selectedPackage.noOfNights ?? "-"} Night(s)
                      </div>
                    </div>
                  </div>
                  <div className="highlight-item">
                    <FaCheckCircle className="highlight-icon" />
                    <div>
                      <div className="highlight-label">Status</div>
                      <div
                        className={`highlight-value ${
                          selectedPackage.liveStatus
                            ? "text-success"
                            : "text-muted"
                        }`}
                      >
                        {selectedPackage.liveStatus ? "Active" : "Inactive"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ─── Includes Chips ────────────────────────────── */}
                <div className="includes-row">
                  <span
                    className={`include-chip ${
                      selectedPackage.containHotel === 1 ? "active" : ""
                    }`}
                  >
                    <FaHotel className="me-1" /> Hotel
                  </span>
                  <span
                    className={`include-chip ${
                      selectedPackage.containCab === 1 ? "active" : ""
                    }`}
                  >
                    <FaCar className="me-1" /> Cab
                  </span>
                  <span
                    className={`include-chip ${
                      selectedPackage.containActivity === 1 ? "active" : ""
                    }`}
                  >
                    <FaHiking className="me-1" /> Activity
                  </span>
                </div>

                {/* ─── Basic Details ─────────────────────────────── */}
                <section className="detail-section">
                  <h6 className="section-title">
                    <FaInfoCircle className="me-2 text-danger" />
                    Basic Information
                  </h6>
                  <div className="details-grid-card">
                    <Row className="g-3">
                      <Col md={6}>
                        <div className="info-row">
                          <span className="info-label">Package Code</span>
                          <span className="info-value">
                            {selectedPackage.packageCode || "-"}
                          </span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Package Type</span>
                          <span className="info-value">
                            {selectedPackage.packageTypeName || "-"}
                          </span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Currency</span>
                          <span className="info-value">
                            {selectedPackage.currencyName || "-"}
                          </span>
                        </div>
                      </Col>
                      <Col md={6}>
                        <div className="info-row">
                          <span className="info-label">Arrive Country</span>
                          <span className="info-value">
                            {selectedPackage.arriveCountryName || "-"}
                          </span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Arrive Places</span>
                          <span className="info-value">
                            {selectedPackage.arrivePlaces &&
                            selectedPackage.arrivePlaces.length > 0
                              ? selectedPackage.arrivePlaces
                                  .map((p) => p.name)
                                  .filter(Boolean)
                                  .join(", ") || "-"
                              : "-"}
                          </span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Categories</span>
                          <span className="info-value">
                            {selectedPackage.packageCategories &&
                            selectedPackage.packageCategories.length > 0
                              ? selectedPackage.packageCategories
                                  .map((c) => c.name)
                                  .filter(Boolean)
                                  .join(", ") || "-"
                              : "-"}
                          </span>
                        </div>
                      </Col>
                    </Row>
                  </div>
                </section>

                {/* ─── Overview ──────────────────────────────────── */}
                {selectedPackage.overview && (
                  <section className="detail-section">
                    <h6 className="section-title">
                      <FaClipboardList className="me-2 text-danger" />
                      Overview
                    </h6>
                    <div className="overview-card">
                      {selectedPackage.overview}
                    </div>
                  </section>
                )}

                {/* ─── Itinerary ─────────────────────────────────── */}
                <section className="detail-section">
                  <h6 className="section-title">
                    <FaCalendarAlt className="me-2 text-danger" />
                    Itinerary
                  </h6>
                  <div className="itinerary-container">
                    {selectedPackage.itineraries &&
                    selectedPackage.itineraries.length > 0 ? (
                      [...selectedPackage.itineraries]
                        .sort((a, b) => a.day - b.day)
                        .map((item, idx, arr) => (
                          <div key={idx} className="timeline-item">
                            {idx !== arr.length - 1 && (
                              <div className="timeline-line"></div>
                            )}
                            <div className="timeline-dot">
                              <div className="dot-inner">{item.day}</div>
                            </div>
                            <div className="timeline-card">
                              <div className="timeline-heading">
                                {item.heading || `Day ${item.day}`}
                              </div>
                              {item.placeName && (
                                <div className="timeline-place">
                                  <FaMapMarkerAlt
                                    className="me-1"
                                    size={10}
                                  />
                                  {item.placeName}
                                </div>
                              )}
                              {item.dayActivities && (
                                <div className="timeline-text">
                                  {item.dayActivities}
                                </div>
                              )}
                              {item.packageItinearyImage && (
                                <img
                                  src={getImageUrl(item.packageItinearyImage)}
                                  alt={`Day ${item.day}`}
                                  className="timeline-image"
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="small text-muted fst-italic">
                        No itinerary available.
                      </div>
                    )}
                  </div>
                </section>

                {/* ─── Inclusions / Exclusions ───────────────────── */}
                <Row className="g-3">
                  <Col md={6}>
                    <section className="detail-section h-100">
                      <h6 className="section-title">
                        <FaCheckCircle className="me-2 text-success" />
                        Inclusions
                      </h6>
                      <div className="list-card">
                        {selectedPackage.inclusions &&
                        selectedPackage.inclusions.length > 0 ? (
                          <ul className="detail-list">
                            {selectedPackage.inclusions.map((i) => (
                              <li key={i.otherId}>
                                <FaCheckCircle
                                  className="me-2 text-success"
                                  size={11}
                                />
                                {i.description}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="small text-muted fst-italic">
                            No inclusions.
                          </span>
                        )}
                      </div>
                    </section>
                  </Col>
                  <Col md={6}>
                    <section className="detail-section h-100">
                      <h6 className="section-title">
                        <FaTimesCircle className="me-2 text-danger" />
                        Exclusions
                      </h6>
                      <div className="list-card">
                        {selectedPackage.exclusions &&
                        selectedPackage.exclusions.length > 0 ? (
                          <ul className="detail-list">
                            {selectedPackage.exclusions.map((i) => (
                              <li key={i.otherId}>
                                <FaTimesCircle
                                  className="me-2 text-danger"
                                  size={11}
                                />
                                {i.description}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="small text-muted fst-italic">
                            No exclusions.
                          </span>
                        )}
                      </div>
                    </section>
                  </Col>
                </Row>

                {/* ─── Terms & Conditions ────────────────────────── */}
                <section className="detail-section">
                  <h6 className="section-title">
                    <FaFileContract className="me-2 text-danger" />
                    Terms & Conditions
                  </h6>
                  <div className="list-card">
                    {selectedPackage.termsAndConditions &&
                    selectedPackage.termsAndConditions.length > 0 ? (
                      <ul className="detail-list">
                        {selectedPackage.termsAndConditions.map((i) => (
                          <li key={i.otherId}>
                            <FaInfoCircle
                              className="me-2 text-secondary"
                              size={11}
                            />
                            {i.description}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="small text-muted fst-italic">
                        No terms and conditions.
                      </span>
                    )}
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer className="detail-modal-footer">
          <Button
            variant="outline-secondary"
            size="sm"
            className="px-3 rounded-pill"
            onClick={() => setShowDetailModal(false)}
          >
            Close
          </Button>
          {selectedPackage?.packageId && (
            <Button
              variant="danger"
              size="sm"
              className="px-3 rounded-pill fw-bold"
              onClick={() => {
                setShowDetailModal(false);
                const orig = results.find(
                  (r) => r.packageId === selectedPackage.packageId,
                );
                handleBookNow(
                  orig || {
                    packageId: selectedPackage.packageId,
                    rate: selectedPackage.packageBasicRate,
                    rateType: "Per Person",
                    currencyCode: selectedPackage.currencyName || "AED",
                  },
                );
              }}
            >
              Book Now
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PackageSearch;
