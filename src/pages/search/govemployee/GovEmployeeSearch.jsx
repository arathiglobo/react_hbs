/**
 * GovEmployeeSearch.jsx
 *
 * "Search hotels for a government employee" page.
 *
 * Reference: HotelSearch.jsx — same UX, but talks to
 *   - POST /api/gov-employee-hotel-search/search
 *   - GET  /api/gov-employee-hotel-search/results/{searchId}
 *
 * The response shape is identical to the normal hotel search, EXCEPT
 * each hotel's `baseRate` is already returned with the gov-employee
 * discount applied (computed server-side).
 *
 * Verification of the government employee (employee code or ID
 * document upload) is captured on the BOOKING page — not here — so
 * this screen is intentionally just dates / destination / occupancy.
 */

import React, { useEffect, useRef, useState } from "react";
import { Card, Button, Row, Col, Form, Spinner } from "react-bootstrap";
import { FaSearch, FaStar, FaIdBadge } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import "../../../styles/HotelSearch.css";

export default function GovEmployeeSearch() {
  const navigate = useNavigate();

  // ── form state ───────────────────────────────────────────────────
  // Destination dropdown options (cities) loaded from /api/province?limit=50
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  // Nationality dropdown options (countries) loaded from /api/country?limit=50
  const [nationalityList, setNationalityList] = useState([]);
  const [selectedNationality, setSelectedNationality] = useState(null);

  const [agents, setAgents] = useState([]);
  const [agent, setAgent] = useState("");
  const [agentBalance, setAgentBalance] = useState(null);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const resultsRef = useRef(null);

  // ── load destinations (cities) + nationalities (countries) + agents
  //    — mirrors HotelSearch.jsx behaviour ────────────────────────────
  useEffect(() => {
    // Destinations — same /api/province?limit=50 endpoint HotelSearch uses.
    (async () => {
      try {
        const { data } = await axiosInstance.get("/api/province?limit=50");
        const list = Array.isArray(data) ? data : data?.content || data?.data || [];
        setDestinationOptions(
          list.map((city) => ({
            value: city.id ?? city.provinceId,
            // Match HotelSearch label shape so the dropdown reads the
            // same way (e.g. "Dubai, United Arab Emirates").
            label: `${city.stateName ?? city.name ?? ""}, ${city.country ?? ""}`,
            countryId: city.countryId,
          }))
        );
      } catch (e) { /* silent */ }
    })();

    // Nationalities — same /api/country?limit=50 endpoint HotelSearch uses.
    (async () => {
      try {
        const { data } = await axiosInstance.get("/api/country?limit=50");
        const list = Array.isArray(data) ? data : data?.content || [];
        setNationalityList(
          list.map((c) => ({
            value: c.id,
            label: c.name,
            code: c.countryCode,
          }))
        );
      } catch (e) { /* silent */ }
    })();

    // Agents — for the agent dropdown + credit-limit display.
    (async () => {
      try {
        const { data } = await axiosInstance.get("/api/agent");
        const list = Array.isArray(data) ? data : data?.content || [];
        setAgents(list);
      } catch (e) { /* silent */ }
    })();
  }, []);

  // ── load agent credit balance when an agent is chosen ───────────
  useEffect(() => {
    if (!agent) { setAgentBalance(null); return; }
    (async () => {
      try {
        const { data } = await axiosInstance.get(`/api/agent-credit-limit/agent/${agent}`);
        setAgentBalance(data?.availableCreditLimit ?? null);
      } catch (e) { setAgentBalance(null); }
    })();
  }, [agent]);

  // ── form validation ─────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!selectedDestination) e.destination = "Required";
    if (!selectedNationality) e.nationality = "Required";
    if (!checkIn) e.checkIn = "Required";
    if (!checkOut) e.checkOut = "Required";
    if (!agent) e.agent = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── initiate search + poll for results ──────────────────────────
  const handleSearch = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setResults([]);
    try {
      const payload = {
        agentId: Number(agent),
        checkIn,
        checkOut,
        // City + country mirror HotelSearch's payload shape so the
        // backend search service can reuse the same fields.
        destinationCityId: selectedDestination.value,
        destinationCountryId: selectedDestination.countryId ?? selectedDestination.value,
        nationalityId: selectedNationality?.value,
        nationalityCode: selectedNationality?.code,
        noOfRooms: rooms,
        roomConfigurations: Array.from({ length: rooms }).map(() => ({
          adults,
          children,
          childAges: [],
        })),
      };
      const { data } = await axiosInstance.post("/api/gov-employee-hotel-search/search", payload);
      const searchId = data?.searchId;
      if (!searchId) { setIsLoading(false); return; }

      // poll results — same pattern as HotelSearch
      let attempts = 0;
      const poll = async () => {
        attempts += 1;
        try {
          const { data: r } = await axiosInstance.get(
            `/api/gov-employee-hotel-search/results/${searchId}` +
            `?agentId=${agent}&page=0&size=50&checkInDate=${checkIn}`
          );
          setResults(r?.result || []);
          if (r?.finalStatus === "COMPLETED" || attempts >= 10) {
            setIsLoading(false);
            return;
          }
          setTimeout(poll, 1500);
        } catch (e) { setIsLoading(false); }
      };
      poll();
    } catch (e) {
      setIsLoading(false);
    }
  };

  // ── click "View Rooms" → navigate to room-list (verification
  //    happens later on the booking page) ─────────────────────────
  //  We carry the provider info ("apiType") and 2-letter nationality
  //  forward so the room-list page can build the correct
  //  HotelRoomSearchRequest body for POST /api/hotel-rooms/search.
  const apiIdFromType = (apiType) => {
    const map = { inhouse: 1, jumeirah: 10, iwtx: 12, x3: 15, ratehawk: 14, darina: 16, atharva: 3 };
    return map[(apiType || "").toLowerCase()] || 1;
  };
  const handleBookHotel = (h) => {
    navigate("/gov-employee-room-list", {
      state: {
        // hotelCode is what /api/hotel-rooms/search expects (the
        // provider-specific code, e.g. "IN2"). hotelId is the numeric
        // master id when available.
        hotelCode: h.hotelCode,
        hotelId: h.hotelCode,          // raw value kept for display
        hotelName: h.hotelName,
        hotelImage: h.hotelImage,
        address: h.hotelAddress,
        starRating: h.starRating,
        apiType: h.apiType,            // e.g. "INHOUSE" / "IWTX"
        apiId: apiIdFromType(h.apiType),
        // 2-letter ISO code; backend validates with @Pattern([A-Z]{2}).
        nationalityCode: (selectedNationality?.code || "").length === 2
          ? selectedNationality.code : "IN",
        checkIn,
        checkOut,
        noOfRooms: rooms,
        adults,
        children,
        agentId: agent,
      },
    });
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm border-0">
            <Card.Body>
              <h5 className="mb-3">
                <FaIdBadge className="me-2 text-primary" />
                Government Employee — Hotel Search
              </h5>
              <p className="text-muted small">
                Browse hotels with the configured government-employee discount applied.
                You'll verify the employee (code or ID upload) on the booking page.
              </p>

              {/* Search form */}
              <Row className="g-3">
                {/* Destination — dropdown of cities from /api/province?limit=50 */}
                <Col md={4}>
                  <Form.Label>Destination *</Form.Label>
                  <Select
                    options={destinationOptions}
                    value={selectedDestination}
                    onChange={setSelectedDestination}
                    placeholder="Select city / destination"
                    isClearable
                    isSearchable
                  />
                  {errors.destination && <small className="text-danger">{errors.destination}</small>}
                </Col>

                {/* Nationality — dropdown of countries from /api/country?limit=50 */}
                <Col md={3}>
                  <Form.Label>Nationality *</Form.Label>
                  <Select
                    options={nationalityList}
                    value={selectedNationality}
                    onChange={setSelectedNationality}
                    placeholder="Select nationality"
                    isClearable
                    isSearchable
                  />
                  {errors.nationality && <small className="text-danger">{errors.nationality}</small>}
                </Col>

                <Col md={2}>
                  <Form.Label>Check-In *</Form.Label>
                  <Form.Control type="date" value={checkIn}
                                onChange={(e) => setCheckIn(e.target.value)} />
                  {errors.checkIn && <small className="text-danger">{errors.checkIn}</small>}
                </Col>
                <Col md={2}>
                  <Form.Label>Check-Out *</Form.Label>
                  <Form.Control type="date" value={checkOut}
                                onChange={(e) => setCheckOut(e.target.value)} />
                  {errors.checkOut && <small className="text-danger">{errors.checkOut}</small>}
                </Col>

                <Col md={1}>
                  <Form.Label>Rooms</Form.Label>
                  <Form.Control type="number" min="1" value={rooms}
                                onChange={(e) => setRooms(Number(e.target.value))} />
                </Col>
                <Col md={1}>
                  <Form.Label>Adults</Form.Label>
                  <Form.Control type="number" min="1" value={adults}
                                onChange={(e) => setAdults(Number(e.target.value))} />
                </Col>
                <Col md={1}>
                  <Form.Label>Children</Form.Label>
                  <Form.Control type="number" min="0" value={children}
                                onChange={(e) => setChildren(Number(e.target.value))} />
                </Col>
                {/* Child-age inputs are intentionally NOT shown — HotelSearch
                    asks for them but for the gov-employee flow we keep the
                    form lighter. The booking page captures per-guest data. */}

                <Col md={4}>
                  <Form.Label>Agent *</Form.Label>
                  <Form.Select value={agent} onChange={(e) => setAgent(e.target.value)}>
                    <option value="">-- Select Agent --</option>
                    {agents.map((a) => (
                      <option key={a.id || a.agentId} value={a.id || a.agentId}>
                        {a.companyName || a.firstName + " " + a.lastName}
                      </option>
                    ))}
                  </Form.Select>
                  {errors.agent && <small className="text-danger">{errors.agent}</small>}
                  {agentBalance !== null && (
                    <div className="text-danger small mt-1">
                      Available credit: <strong>{agentBalance}</strong>
                    </div>
                  )}
                </Col>

                <Col md={8} className="d-flex align-items-end justify-content-end">
                  <Button variant="primary" onClick={handleSearch} disabled={isLoading}>
                    {isLoading ? <Spinner size="sm" className="me-1" /> : <FaSearch className="me-1" />}
                    Search Hotels
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Results */}
          <div className="mt-3" ref={resultsRef}>
            {isLoading && (
              <div className="text-center py-3">
                <Spinner animation="border" />
                <div className="text-muted small mt-2">Searching with government discount applied…</div>
              </div>
            )}
            {!isLoading && results.length === 0 && <div className="text-muted">No results yet.</div>}
            {results.map((h, idx) => (
              <Card key={idx} className="mb-2 shadow-sm">
                <Card.Body>
                  <Row className="align-items-center">
                    <Col md={2}>
                      {h.hotelImage ? (
                        <img src={h.hotelImage} alt={h.hotelName} className="img-fluid rounded" />
                      ) : (
                        <div className="bg-light p-3 text-center text-muted">No Image</div>
                      )}
                    </Col>
                    <Col md={6}>
                      <h6 className="mb-1">{h.hotelName}</h6>
                      <div className="text-muted small">{h.hotelAddress}</div>
                      <div>
                        {Array.from({ length: h.starRating || 0 }).map((_, i) => (
                          <FaStar key={i} className="text-warning" />
                        ))}
                      </div>
                    </Col>
                    <Col md={2}>
                      <div className="text-muted small">Govt-Discounted Rate</div>
                      <div className="h5 mb-0 text-success">
                        {h.baseRate != null ? h.baseRate.toFixed(2) : "-"}
                      </div>
                    </Col>
                    <Col md={2} className="text-end">
                      <Button size="sm" variant="primary" onClick={() => handleBookHotel(h)}>
                        View Rooms
                      </Button>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
