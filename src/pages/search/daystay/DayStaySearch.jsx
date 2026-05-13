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
import { FaSearch, FaStar, FaClock } from "react-icons/fa";
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

  const [nationalityList, setNationalityList] = useState([]);
  const [selectedNationality, setSelectedNationality] = useState(null);
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [agents, setAgents] = useState([]);
  const [agent, setAgent] = useState("");
  const [agentBalance, setAgentBalance] = useState(null);
  const [agentBalanceLoading, setAgentBalanceLoading] = useState(false);

  const [checkInDate, setCheckInDate] = useState("");
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
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

  // Default check-out time to 2 hours after the chosen check-in.
  useEffect(() => {
    if (checkInTime && !checkOutTime) {
      const [hh, mm] = checkInTime.split(":").map(Number);
      const total = (hh + 2) * 60 + mm;
      const h = Math.min(23, Math.floor(total / 60));
      const m = total % 60;
      setCheckOutTime(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      );
    }
  }, [checkInTime]);

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
    if (!checkInTime) e.checkInTime = "Check-in time is required";
    if (!checkOutTime) e.checkOutTime = "Check-out time is required";
    if (checkInTime && checkOutTime && checkOutTime <= checkInTime)
      e.checkOutTime = "Check-out time must be after check-in time";
    if (!agent) e.agent = "Agent is required";
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
      const payload = {
        destinationCityId: selectedDestination?.value || null,
        agentId: Number(agent),
        nationalityCode: selectedNationality?.code || null,
        checkInDate,
        checkInTime,
        checkOutTime,
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

                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Agent
                      </Form.Label>
                      <Form.Select
                        style={{ height: "42px" }}
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

                  <Col lg={4} md={3}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        <FaClock className="me-2 text-primary" />
                        Check-in Time
                      </Form.Label>
                      <Form.Control
                        style={{ height: "42px" }}
                        type="time"
                        value={checkInTime}
                        onChange={(e) => {
                          setCheckInTime(e.target.value);
                          if (e.target.value) clearError("checkInTime");
                        }}
                      />
                      {errors.checkInTime && (
                        <div className="text-danger small mt-1">
                          {errors.checkInTime}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  <Col lg={4} md={3}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        <FaClock className="me-2 text-primary" />
                        Check-out Time
                      </Form.Label>
                      <Form.Control
                        style={{ height: "42px" }}
                        type="time"
                        value={checkOutTime}
                        onChange={(e) => {
                          setCheckOutTime(e.target.value);
                          if (e.target.value) clearError("checkOutTime");
                        }}
                      />
                      {errors.checkOutTime && (
                        <div className="text-danger small mt-1">
                          {errors.checkOutTime}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  <Col lg={2} md={4}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Adults
                      </Form.Label>
                      <Form.Control
                        style={{ height: "42px" }}
                        type="number"
                        min={1}
                        value={adults}
                        onChange={(e) => setAdults(e.target.value)}
                      />
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
                      <Form.Control
                        style={{ height: "42px" }}
                        type="number"
                        min={0}
                        value={children}
                        onChange={(e) => setChildren(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col lg={2} md={4}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Rooms
                      </Form.Label>
                      <Form.Control
                        style={{ height: "42px" }}
                        type="number"
                        min={1}
                        value={rooms}
                        onChange={(e) => setRooms(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>

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
                {results.map((hotel) => {
                  const baseRate = Number(hotel.dayStayRate || 0);
                  const pct = Number(hotel.percentage || 0);
                  const displayRate =
                    baseRate > 0
                      ? +(baseRate * (1 + pct / 100)).toFixed(2)
                      : null;
                  return (
                    <Col xs={12} key={hotel.contractId}>
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
                            <div style={{ padding: "15px" }}>
                              <img
                                src={
                                  hotel.hotelImage ||
                                  "https://via.placeholder.com/480x270?text=Day+Stay"
                                }
                                alt={hotel.hotelName}
                                style={{
                                  width: "100%",
                                  height: "180px",
                                  objectFit: "cover",
                                  borderRadius: "9px",
                                }}
                              />
                            </div>
                          </Col>
                          <Col md={8}>
                            <div style={{ padding: "16px" }}>
                              <h6
                                style={{
                                  fontSize: "1.0rem",
                                  fontWeight: "600",
                                  marginBottom: "8px",
                                }}
                              >
                                {hotel.hotelName || "Hotel"}
                                {hotel.starRating > 0 && (
                                  <span className="ms-2 text-warning small">
                                    <FaStar /> {hotel.starRating}
                                  </span>
                                )}
                              </h6>
                              <p
                                style={{
                                  fontSize: "0.875rem",
                                  color: "#666",
                                  marginBottom: "4px",
                                }}
                              >
                                📍 {hotel.hotelAddress || hotel.city || "—"}
                              </p>
                              <Badge bg="info" className="me-2">
                                Day Stay Window: {hotel.checkInStartTime} –{" "}
                                {hotel.checkInEndTime}
                              </Badge>
                              {pct > 0 && (
                                <Badge bg="warning" text="dark">
                                  +{pct}% markup
                                </Badge>
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
                                  }}
                                >
                                  {displayRate != null
                                    ? `AED ${displayRate.toLocaleString()}`
                                    : "Rate on request"}
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
                                    const payload = {
                                      hotelId: hotel.hotelId,
                                      hotelName: hotel.hotelName,
                                      hotelAddress: hotel.hotelAddress,
                                      hotelImage: hotel.hotelImage,
                                      contractId: hotel.contractId,
                                      dayStayRate: displayRate,
                                      basePctRate: pct,
                                      checkInDate,
                                      checkInTime,
                                      checkOutTime,
                                      windowStart: hotel.checkInStartTime,
                                      windowEnd: hotel.checkInEndTime,
                                      agentId: agent,
                                      nationality:
                                        selectedNationality?.code || "",
                                      adults: Number(adults),
                                      children: Number(children),
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
