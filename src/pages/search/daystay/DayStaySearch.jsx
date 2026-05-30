import React, { useEffect, useRef, useState } from "react";
import {
  Card,
  Button,
  Row,
  Col,
  Form,
  Spinner,
  Badge,
} from "react-bootstrap";
import { FaSearch, FaStar } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import "../../../styles/HotelSearch.css";

/**
 * DayStaySearch — modelled after HotelSearch.jsx but for the Day Stay flow.
 *
 *  - Search criteria includes a date + time check-in (datetime-local) and a
 *    time check-out.
 *  - Validation on all required fields.
 *  - Destination and Agent dropdowns are loaded from the same APIs as
 *    HotelSearch (/api/province, /api/agent).
 *  - When an agent is selected the available credit balance is shown
 *    in red (matching HotelSearch behaviour).
 *  - On submit calls POST /api/day-stay-booking/search and pages over results.
 */
export default function DayStaySearch() {
  const navigate = useNavigate();

  // Agent logins book under themselves — the backend forces the booking to
  // the logged-in agent, so the manual Agent picker is hidden and the
  // agent-required validation is skipped. currentActiveRole isn't set for
  // single-role logins, so fall back to userRole; admin/super-admin/staff
  // keep the picker exactly as before.
  const activeRole = (localStorage.getItem("currentActiveRole") || "")
    .trim()
    .toUpperCase();
  const storedRoles = (localStorage.getItem("userRole") || "").toUpperCase();
  const isAgentRole = activeRole
    ? activeRole === "AGENT"
    : storedRoles.includes("AGENT") && !storedRoles.includes("ADMIN");

  const [nationalityList, setNationalityList] = useState([]);
  const [selectedNationality, setSelectedNationality] = useState(null);
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [agents, setAgents] = useState([]);
  const [agent, setAgent] = useState("");
  const [agentBalance, setAgentBalance] = useState(null);
  const [agentBalanceLoading, setAgentBalanceLoading] = useState(false);

  const [checkInDate, setCheckInDate] = useState("");
  // Day Stay no longer asks the agent for a specific check-in / out
  // time. We always send a full-day range (00:00 → 23:59) so the
  // backend returns every hotel that has a day-stay contract for the
  // picked date, regardless of its hourly window. The View Rooms
  // button still picks up each contract's own checkInStartTime /
  // checkInEndTime when launching the room list.
  const [checkInTime] = useState("00:00");
  const [checkOutTime] = useState("23:59");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  // Per-child ages (0-17). Length tracks `children`. Default age 5.
  const [childAges, setChildAges] = useState([]);
  const [rooms, setRooms] = useState(1);

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);
  const [isNationalityLoading, setIsNationalityLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState([]);
  const [clickedHotelIds, setClickedHotelIds] = useState([]);
  const resultsRef = useRef(null);

  // Reuse the HotelSearch debounce helper.
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
          `/api/province?search=${searchText}`
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
    }, 300)
  ).current;

  const debouncedCountrySearch = useRef(
    debounce(async (search) => {
      try {
        setIsNationalityLoading(true);
        const response = await axiosInstance.get(
          `/api/country?search=${search}`
        );
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
      } finally {
        setIsNationalityLoading(false);
      }
    }, 300)
  ).current;

  const loadInitialCountries = async () => {
    try {
      setIsNationalityLoading(true);
      const res = await axiosInstance.get("/api/country?limit=50");
      const opts = Array.isArray(res.data)
        ? res.data.map((c) => ({
            value: c.id,
            label: c.name,
            code: c.countryCode,
          }))
        : [];
      setNationalityList(opts);
    } catch {
      setNationalityList([]);
    } finally {
      setIsNationalityLoading(false);
    }
  };

  const loadPopularDestinations = async () => {
    if (destinationOptions.length > 0) return;
    try {
      setIsDestinationLoading(true);
      const response = await axiosInstance.get("/api/province?limit=50");
      const cityApiRes = Array.isArray(response.data) ? response.data : [];
      const options = cityApiRes.map((city) => ({
        value: city.id,
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

  const loadAgents = async () => {
    try {
      const res = await axiosInstance.get("/api/agent");
      setAgents(res.data || []);
    } catch {
      setAgents([]);
    }
  };

  useEffect(() => {
    loadInitialCountries();
    loadAgents();
  }, []);

  // Agent credit balance lookup — same endpoint as HotelSearch.
  useEffect(() => {
    if (!agent) {
      setAgentBalance(null);
      return;
    }
    let cancelled = false;
    setAgentBalanceLoading(true);
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${agent}`)
      .then((res) => {
        if (!cancelled)
          setAgentBalance(res?.data?.availableCreditLimit ?? null);
      })
      .catch(() => {
        if (!cancelled) setAgentBalance(null);
      })
      .finally(() => {
        if (!cancelled) setAgentBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agent]);

  // Keep childAges length in lock-step with the children count.
  useEffect(() => {
    setChildAges((prev) => {
      const n = Number(children) || 0;
      if (prev.length === n) return prev;
      if (prev.length < n) {
        return [...prev, ...Array.from({ length: n - prev.length }, () => 5)];
      }
      return prev.slice(0, n);
    });
  }, [children]);

  // (Removed) Default check-out time auto-fill — time is no longer
  // captured on this page. The full-day range is sent as-is.

  const clearError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _omit, ...rest } = prev;
      return rest;
    });
  };

  const validate = () => {
    const e = {};
    if (!selectedNationality) e.nationality = "Nationality is required";
    if (!selectedDestination) e.destination = "Destination is required";
    if (!checkInDate) e.checkInDate = "Check-in date is required";
    // Time-window validation removed — Day Stay search returns every
    // hotel with a contract for the date, regardless of hourly window.
    if (!isAgentRole && !agent) e.agent = "Agent is required";
    if (!adults || Number(adults) < 1) e.adults = "At least one adult required";
    return e;
  };

  const handleSearch = async (ev) => {
    ev.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setIsLoading(true);
    setHasSearched(true);
    setResults([]);
    try {
      // checkInTime / checkOutTime intentionally omitted — Day Stay
      // search now lists every hotel with a contract for the picked
      // date regardless of hourly window. Sending the full-day range
      // 00:00–23:59 still excluded hotels whose contract window was
      // narrower (e.g. 09:00–17:00) because the backend compared the
      // request times against the contract window. Omitting the fields
      // tells the backend "no time filter".
      const payload = {
        destinationCityId: selectedDestination?.value || null,
        agentId: Number(agent),
        nationalityCode: selectedNationality?.code || null,
        checkInDate,
        adults: Number(adults),
        children: Number(children),
        rooms: Number(rooms),
      };
      const res = await axiosInstance.post(
        "/api/day-stay-booking/search",
        payload
      );
      setResults(Array.isArray(res.data) ? res.data : []);
      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 0);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl mb-4 search-card-modern bg-white">
            <Card.Body className="p-4">
              <div className="mb-4 text-start">
                <h2 className="fw-semibold text-primary mb-1">
                  Day Stay Booking
                </h2>
                <p className="text-muted">
                  Book a hotel for a few hours within the hotel's daily
                  day-stay window.
                </p>
              </div>

              <Form onSubmit={handleSearch} noValidate>
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
                          if (action === "input-change")
                            debouncedCitySearch(inputValue);
                        }}
                        menuPortalTarget={document.body}
                        styles={{
                          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          control: (base) => ({
                            ...base,
                            minHeight: "42px",
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
                        onInputChange={(v, { action }) => {
                          if (action === "input-change" && v.length >= 2)
                            debouncedCountrySearch(v);
                        }}
                        isLoading={isNationalityLoading}
                        placeholder="Select nationality"
                        isSearchable
                        isClearable
                        menuPortalTarget={document.body}
                        styles={{
                          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          control: (base) => ({
                            ...base,
                            minHeight: "42px",
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

                  {!isAgentRole && (
                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Agent
                      </Form.Label>
                      <Form.Select
                        style={{ height: "46px" }}
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
                      {agent && (
                        <div className="mt-1 small">
                          {agentBalanceLoading ? (
                            <span className="text-muted">
                              Loading available balance…
                            </span>
                          ) : agentBalance != null ? (
                            <span
                              className="fw-semibold"
                              style={{ color: "#dc3545" }}
                            >
                              Available Balance:{" "}
                              {Number(agentBalance).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-muted">
                              Available balance unavailable
                            </span>
                          )}
                        </div>
                      )}
                    </Form.Group>
                  </Col>
                  )}

                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Check-in Date
                      </Form.Label>
                      <Form.Control
                        style={{ height: "42px" }}
                        type="date"
                        value={checkInDate}
                        min={today}
                        onChange={(e) => {
                          setCheckInDate(e.target.value);
                          if (e.target.value) clearError("checkInDate");
                        }}
                      />
                      {errors.checkInDate && (
                        <div className="text-danger small mt-1">
                          {errors.checkInDate}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  {/* Check-in / Check-out Time fields removed — Day Stay
                      search now lists every hotel with a contract on
                      the picked date regardless of hourly window. The
                      contract's own start/end times are picked up when
                      the operator clicks "View Rooms". */}

                  <Col lg={2} md={4}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Adults
                      </Form.Label>
                      <Form.Select
                        style={{ height: "42px" }}
                        value={adults}
                        onChange={(e) => setAdults(Number(e.target.value))}
                      >
                        {Array.from({ length: 9 }).map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                          </option>
                        ))}
                      </Form.Select>
                      {errors.adults && (
                        <div className="text-danger small mt-1">
                          {errors.adults}
                        </div>
                      )}
                    </Form.Group>
                  </Col>
                  <Col lg={2} md={4}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Children
                      </Form.Label>
                      <Form.Select
                        style={{ height: "42px" }}
                        value={children}
                        onChange={(e) => setChildren(Number(e.target.value))}
                      >
                        {Array.from({ length: 10 }).map((_, i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col lg={2} md={4}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Rooms
                      </Form.Label>
                      <Form.Select
                        style={{ height: "42px" }}
                        value={rooms}
                        onChange={(e) => setRooms(Number(e.target.value))}
                      >
                        {Array.from({ length: 9 }).map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                {/* Child ages — one age-dropdown per child (0-17). */}
                {Number(children) > 0 && (
                  <Row className="mt-3 g-2 align-items-end">
                    <Col md={2}>
                      <Form.Label className="fw-semibold text-dark mb-0">
                        Child Ages
                      </Form.Label>
                    </Col>
                    {Array.from({ length: Number(children) }).map((_, idx) => (
                      <Col md={2} key={idx}>
                        <Form.Label className="small text-muted mb-1">
                          Child {idx + 1}
                        </Form.Label>
                        <Form.Select
                          size="sm"
                          value={childAges[idx] ?? 5}
                          onChange={(e) =>
                            setChildAges((prev) => {
                              const next = [...prev];
                              next[idx] = Number(e.target.value);
                              return next;
                            })
                          }
                        >
                          {Array.from({ length: 18 }).map((__, age) => (
                            <option key={age} value={age}>
                              {age} {age === 1 ? "yr" : "yrs"}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    ))}
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
                          SEARCH DAY STAY
                        </>
                      )}
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>

          {!hasSearched && (
            <Card className="shadow-sm rounded-xl">
              <Card.Body className="text-center text-muted py-5">
                <FaSearch className="display-4 text-muted mb-3" />
                <h4>Find a Day Stay Hotel</h4>
                <p>
                  Pick a date + time and we'll show hotels that accept a
                  day-stay check-in during that window.
                </p>
              </Card.Body>
            </Card>
          )}

          {hasSearched && (
            <div ref={resultsRef}>
              {results.length === 0 && !isLoading && (
                <Card className="shadow-sm rounded-xl">
                  <Card.Body className="text-center text-muted py-5">
                    <FaSearch className="display-4 text-muted mb-3" />
                    <h5>No Day Stay hotels available</h5>
                    <p>
                      Try a different time or date — your selected check-in
                      may be outside every hotel's day-stay window.
                    </p>
                  </Card.Body>
                </Card>
              )}

              <Row className="g-4">
                {/* Dedupe: one card per hotel, pick the contract with the
                    lowest day-stay rate. The full list of matching contract
                    ids is forwarded to the room list so the user can see
                    every window the hotel offers. */}
                {Object.values(
                  results.reduce((acc, h) => {
                    const key = h.hotelId;
                    const rate = Number(h.dayStayRate || 0);
                    if (
                      !acc[key] ||
                      rate < Number(acc[key].dayStayRate || Infinity)
                    ) {
                      acc[key] = {
                        ...h,
                        allContractIds: [
                          ...((acc[key] && acc[key].allContractIds) || []),
                          h.contractId,
                        ].filter((v, i, a) => a.indexOf(v) === i),
                      };
                    } else if (acc[key]) {
                      acc[key] = {
                        ...acc[key],
                        allContractIds: [
                          ...(acc[key].allContractIds || []),
                          h.contractId,
                        ].filter((v, i, a) => a.indexOf(v) === i),
                      };
                    }
                    return acc;
                  }, {})
                ).map((hotel) => {
                  const baseRate = Number(hotel.dayStayRate || 0);
                  const pct = Number(hotel.percentage || 0);
                  // Pax-adjusted: base rate per room + extra adults + children.
                  // First adult is included in base, extras pay adultRate;
                  // children pay childRate.
                  const adultsN = Number(adults) || 1;
                  const childrenN = Number(children) || 0;
                  const roomsN = Number(rooms) || 1;
                  const adultPer = Number(hotel.minAdultRate || 0);
                  const childPer = Number(hotel.minChildRate || 0);
                  const perRoom =
                    baseRate +
                    Math.max(0, adultsN - 1) * adultPer +
                    childrenN * childPer;
                  const grossPerRoom = +(perRoom * (1 + pct / 100)).toFixed(2);
                  const displayRate = baseRate > 0 ? grossPerRoom * roomsN : null;
                  const cats = Array.isArray(hotel.roomCategories)
                    ? hotel.roomCategories
                    : [];
                  return (
                    <Col xs={12} key={hotel.contractId}>
                      {/* Mirrors HotelSearch.jsx result-card layout */}
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
                              <img
                                src={
                                  hotel.hotelImage ||
                                  "https://via.placeholder.com/480x270?text=Day+Stay"
                                }
                                alt={hotel.hotelName}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  borderRadius: "9px",
                                  minHeight: "180px",
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
                                {hotel.starRating || 0}
                                <span
                                  style={{
                                    marginLeft: "5px",
                                    backgroundColor: "#6c757d",
                                    padding: "2px 6px",
                                    borderRadius: "10px",
                                  }}
                                >
                                  DAY STAY
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
                                {hotel.hotelName || "Hotel Name Not Available"}
                              </h6>

                              <p
                                style={{
                                  fontSize: "0.875rem",
                                  color: "#666",
                                  marginBottom: "8px",
                                }}
                              >
                                📍{" "}
                                {hotel.hotelAddress ||
                                  hotel.city ||
                                  "Address Not Available"}
                              </p>

                              {cats.length > 0 && (
                                <div className="mb-2">
                                  <small className="text-muted me-2">
                                    Categories:
                                  </small>
                                  {cats.map((c) => (
                                    <Badge
                                      key={c}
                                      bg="light"
                                      text="dark"
                                      className="border me-1"
                                      style={{ fontSize: "0.7rem" }}
                                    >
                                      {c}
                                    </Badge>
                                  ))}
                                </div>
                              )}

                              <span
                                style={{
                                  backgroundColor: "#28a745",
                                  color: "white",
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  fontSize: "0.75rem",
                                  display: "inline-block",
                                  marginBottom: "12px",
                                  marginRight: "6px",
                                }}
                              >
                                Day Stay Window:{" "}
                                {(hotel.checkInStartTime || "").slice(0, 5)} –{" "}
                                {(hotel.checkInEndTime || "").slice(0, 5)}
                              </span>
                              {pct > 0 && (
                                <span
                                  style={{
                                    backgroundColor: "#ffc107",
                                    color: "#212529",
                                    padding: "4px 8px",
                                    borderRadius: "4px",
                                    fontSize: "0.75rem",
                                    display: "inline-block",
                                    marginBottom: "12px",
                                  }}
                                >
                                  +{pct}% markup
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
                                <div>
                                  <div
                                    style={{
                                      fontSize: "1.1rem",
                                      fontWeight: "600",
                                      color: "#333",
                                    }}
                                  >
                                    {displayRate != null
                                      ? `AED ${displayRate.toLocaleString()}`
                                      : "Rate on request"}
                                  </div>
                                  <small className="text-muted">
                                    {adultsN} adult
                                    {adultsN > 1 ? "s" : ""}
                                    {childrenN
                                      ? `, ${childrenN} child${
                                          childrenN > 1 ? "ren" : ""
                                        }`
                                      : ""}{" "}
                                    · {roomsN} room
                                    {roomsN > 1 ? "s" : ""}
                                  </small>
                                </div>
                                <Button
                                  size="sm"
                                  variant={
                                    clickedHotelIds.includes(hotel.contractId)
                                      ? "secondary"
                                      : "primary"
                                  }
                                  onClick={() => {
                                    setClickedHotelIds((prev) => [
                                      ...prev,
                                      hotel.contractId,
                                    ]);
                                    // Use the contract's window times as the
                                    // actual booking check-in / check-out
                                    // (the user's typed time is only used
                                    // to filter which contracts match).
                                    const cStart = (hotel.checkInStartTime || checkInTime || "")
                                      .slice(0, 5);
                                    const cEnd = (hotel.checkInEndTime || checkOutTime || "")
                                      .slice(0, 5);
                                    const payload = {
                                      hotelId: hotel.hotelId,
                                      hotelName: hotel.hotelName,
                                      hotelAddress: hotel.hotelAddress,
                                      hotelImage: hotel.hotelImage,
                                      contractId: hotel.contractId,
                                      // All matching contract ids — room
                                      // list shows each as its own window.
                                      allContractIds:
                                        hotel.allContractIds &&
                                        hotel.allContractIds.length > 0
                                          ? hotel.allContractIds
                                          : [hotel.contractId],
                                      dayStayRate: baseRate,
                                      basePctRate: pct,
                                      minAdultRate: hotel.minAdultRate || 0,
                                      minChildRate: hotel.minChildRate || 0,
                                      checkInDate,
                                      // Contract window is the actual stay
                                      // span — booking saves these times.
                                      checkInTime: cStart,
                                      checkOutTime: cEnd,
                                      windowStart: cStart,
                                      windowEnd: cEnd,
                                      agentId: agent,
                                      nationality:
                                        selectedNationality?.code || "",
                                      nationalityLabel:
                                        selectedNationality?.label || "",
                                      adults: Number(adults),
                                      children: Number(children),
                                      childAges: childAges,
                                      rooms: Number(rooms),
                                    };
                                    sessionStorage.setItem(
                                      "dayStayRoomListPayload",
                                      JSON.stringify(payload)
                                    );
                                    window.open(
                                      "/day-stay-room-list",
                                      "_blank"
                                    );
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
                  );
                })}
              </Row>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
