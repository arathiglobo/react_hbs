/**
 * StudentSearch.jsx
 *
 * "Search hotels for a Student" page (reference: HotelSearch.jsx).
 *
 *  - Destination dropdown (cities) — /api/province?limit=50
 *  - Nationality dropdown (countries) — /api/country?limit=50
 *  - Agent + credit balance
 *  - Same search shape as HotelSearch (no child-age section)
 *  - Calls:
 *      POST /api/student-hotel-search/search
 *      GET  /api/student-hotel-search/results/{searchId}
 *    — backend returns the standard SearchResponse but with the
 *      student discount already applied to each result's baseRate.
 *
 *  Verification of the student happens later on the booking page.
 */

import React, { useEffect, useRef, useState } from "react";
import { Card, Button, Row, Col, Form, Spinner } from "react-bootstrap";
import { FaSearch, FaStar, FaGraduationCap } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import "../../../styles/HotelSearch.css";

export default function StudentSearch() {
  const navigate = useNavigate();

  // ── form state ───────────────────────────────────────────────────
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
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

  // ── load destinations + nationalities + agents ───────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axiosInstance.get("/api/province?limit=50");
        const list = Array.isArray(data) ? data : data?.content || data?.data || [];
        setDestinationOptions(
          list.map((city) => ({
            value: city.id ?? city.provinceId,
            label: `${city.stateName ?? city.name ?? ""}, ${city.country ?? ""}`,
            countryId: city.countryId,
          }))
        );
      } catch (e) { /* silent */ }
    })();
    (async () => {
      try {
        const { data } = await axiosInstance.get("/api/country?limit=50");
        const list = Array.isArray(data) ? data : data?.content || [];
        setNationalityList(list.map((c) => ({ value: c.id, label: c.name, code: c.countryCode })));
      } catch (e) { /* silent */ }
    })();
    (async () => {
      try {
        const { data } = await axiosInstance.get("/api/agent");
        const list = Array.isArray(data) ? data : data?.content || [];
        setAgents(list);
      } catch (e) { /* silent */ }
    })();
  }, []);

  useEffect(() => {
    if (!agent) { setAgentBalance(null); return; }
    (async () => {
      try {
        const { data } = await axiosInstance.get(`/api/agent-credit-limit/agent/${agent}`);
        setAgentBalance(data?.availableCreditLimit ?? null);
      } catch (e) { setAgentBalance(null); }
    })();
  }, [agent]);

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

  const handleSearch = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setResults([]);
    try {
      const payload = {
        agentId: Number(agent),
        checkIn,
        checkOut,
        destinationCityId: selectedDestination.value,
        destinationCountryId: selectedDestination.countryId ?? selectedDestination.value,
        nationalityId: selectedNationality?.value,
        nationalityCode: selectedNationality?.code,
        noOfRooms: rooms,
        roomConfigurations: Array.from({ length: rooms }).map(() => ({
          adults, children, childAges: [],
        })),
      };
      const { data } = await axiosInstance.post("/api/student-hotel-search/search", payload);
      const searchId = data?.searchId;
      if (!searchId) { setIsLoading(false); return; }

      // Poll for results
      let attempts = 0;
      const poll = async () => {
        attempts += 1;
        try {
          const { data: r } = await axiosInstance.get(
            `/api/student-hotel-search/results/${searchId}` +
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

  const apiIdFromType = (apiType) => {
    const m = { inhouse: 1, jumeirah: 10, iwtx: 12, x3: 15, ratehawk: 14, darina: 16, atharva: 3 };
    return m[(apiType || "").toLowerCase()] || 1;
  };
  const handleViewRooms = (h) => {
    navigate("/student-room-list", {
      state: {
        hotelCode: h.hotelCode,
        hotelId: h.hotelCode,
        hotelName: h.hotelName,
        hotelImage: h.hotelImage,
        address: h.hotelAddress,
        starRating: h.starRating,
        apiType: h.apiType,
        apiId: apiIdFromType(h.apiType),
        nationalityCode: (selectedNationality?.code || "").length === 2
          ? selectedNationality.code : "IN",
        checkIn, checkOut, noOfRooms: rooms, adults, children, agentId: agent,
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
                <FaGraduationCap className="me-2 text-primary" /> Student — Hotel Search
              </h5>
              <p className="text-muted small">
                Browse hotels with the configured student discount applied. You'll verify the
                student (ID upload + institution + ID number + expiry) on the booking page.
              </p>

              <Row className="g-3">
                <Col md={4}>
                  <Form.Label>Destination *</Form.Label>
                  <Select options={destinationOptions} value={selectedDestination}
                          onChange={setSelectedDestination}
                          placeholder="Select city / destination" isClearable isSearchable />
                  {errors.destination && <small className="text-danger">{errors.destination}</small>}
                </Col>
                <Col md={3}>
                  <Form.Label>Nationality *</Form.Label>
                  <Select options={nationalityList} value={selectedNationality}
                          onChange={setSelectedNationality}
                          placeholder="Select nationality" isClearable isSearchable />
                  {errors.nationality && <small className="text-danger">{errors.nationality}</small>}
                </Col>
                <Col md={2}>
                  <Form.Label>Check-In *</Form.Label>
                  <Form.Control type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
                  {errors.checkIn && <small className="text-danger">{errors.checkIn}</small>}
                </Col>
                <Col md={2}>
                  <Form.Label>Check-Out *</Form.Label>
                  <Form.Control type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
                  {errors.checkOut && <small className="text-danger">{errors.checkOut}</small>}
                </Col>
                <Col md={1}>
                  <Form.Label>Rooms</Form.Label>
                  <Form.Control type="number" min="1" value={rooms} onChange={(e) => setRooms(Number(e.target.value))} />
                </Col>
                <Col md={1}>
                  <Form.Label>Adults</Form.Label>
                  <Form.Control type="number" min="1" value={adults} onChange={(e) => setAdults(Number(e.target.value))} />
                </Col>
                <Col md={1}>
                  <Form.Label>Children</Form.Label>
                  <Form.Control type="number" min="0" value={children} onChange={(e) => setChildren(Number(e.target.value))} />
                </Col>

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

          <div className="mt-3" ref={resultsRef}>
            {isLoading && (
              <div className="text-center py-3">
                <Spinner animation="border" />
                <div className="text-muted small mt-2">Searching with student discount applied…</div>
              </div>
            )}
            {!isLoading && results.length === 0 && <div className="text-muted">No results yet.</div>}
            {results.map((h, idx) => (
              <Card key={idx} className="mb-2 shadow-sm">
                <Card.Body>
                  <Row className="align-items-center">
                    <Col md={2}>
                      {h.hotelImage
                        ? <img src={h.hotelImage} alt={h.hotelName} className="img-fluid rounded" />
                        : <div className="bg-light p-3 text-center text-muted">No Image</div>}
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
                      <div className="text-muted small">Student-Discounted Rate</div>
                      <div className="h5 mb-0 text-success">
                        {h.baseRate != null ? h.baseRate.toFixed(2) : "-"}
                      </div>
                    </Col>
                    <Col md={2} className="text-end">
                      <Button size="sm" variant="primary" onClick={() => handleViewRooms(h)}>
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
