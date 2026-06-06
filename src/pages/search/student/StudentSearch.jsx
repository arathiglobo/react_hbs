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

// ─────────────────────────────────────────────
// Counter — same +/- counter as HotelSearch.jsx.
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
// RoomGuestSelector — copied from HotelSearch.jsx so the Student
// search exposes the same per-room adults / children / child-ages
// editor instead of the three separate top-level number inputs it
// used before. Aggregate totals are derived in the page component for
// the existing search payload + handoff payload.
// ─────────────────────────────────────────────
function RoomGuestSelector({ value, onChange }) {
  const [rooms, setRooms] = useState(value);
  const update = (next) => {
    setRooms(next);
    onChange && onChange(next);
  };
  const addRoom = () => update([...rooms, { adults: 1, children: 0, childAges: [] }]);
  const removeRoom = (i) => update(rooms.filter((_, j) => j !== i));
  const setAdults = (i, a) =>
    update(rooms.map((r, j) => (j === i ? { ...r, adults: a } : r)));
  const setChildren = (i, c) =>
    update(
      rooms.map((r, j) =>
        j === i
          ? {
              ...r,
              children: c,
              childAges: Array.from({ length: c }, (_, k) => r.childAges[k] || 5),
            }
          : r
      )
    );
  const setChildAge = (i, idx, age) =>
    update(
      rooms.map((r, j) => {
        if (j !== i) return r;
        const ages = [...r.childAges];
        ages[idx] = age;
        return { ...r, childAges: ages };
      })
    );

  return (
    <div className="rgs-wrap">
      <div className="rgs-grid">
        {rooms.map((room, i) => (
          <div key={i} className="rgs-room-card">
            <div className="rgs-room-header">
              <span className="rgs-room-label">🛏 Room {i + 1}</span>
              {rooms.length > 1 && (
                <button type="button" className="rgs-remove-btn" onClick={() => removeRoom(i)}>
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
                      <Form.Select
                        size="sm"
                        value={room.childAges[idx] || 5}
                        onChange={(e) => setChildAge(i, idx, parseInt(e.target.value))}
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

export default function StudentSearch() {
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

  // ── form state ───────────────────────────────────────────────────
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [nationalityList, setNationalityList] = useState([]);
  const [selectedNationality, setSelectedNationality] = useState(null);

  // Optional "Booking Done By Employee" — moved here from
  // StudentBookingPage. employeeId rides on navigate state through
  // StudentRoomList → StudentBookingPage's bookingData.payload.
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axiosInstance.get("/api/employee?page=0&limit=1000");
        if (res.data && Array.isArray(res.data)) setEmployees(res.data);
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
    };
    fetchEmployees();
  }, []);

  const [agents, setAgents] = useState([]);
  const [agent, setAgent] = useState("");
  const [agentBalance, setAgentBalance] = useState(null);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  // ── Rooms & Guests — array-of-rooms model, mirrors HotelSearch.jsx.
  //
  // Each room carries its own adults / children / per-child ages. The
  // search endpoint already accepts a `roomConfigurations` array
  // (currently filled by duplicating the same totals N times); now we
  // populate it with the user's REAL per-room breakdown — a small
  // backend-compatible improvement.
  const [rooms, setRooms] = useState([{ adults: 1, children: 0, childAges: [] }]);
  const [roomsOpen, setRoomsOpen] = useState(false);

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const resultsRef = useRef(null);

  // ── date helpers — mirror HotelSearch.jsx so the auto-fill behaviour
  //    (picking check-in defaults check-out to the next day) matches. ──
  const formatDate = (d) => d.toISOString().split("T")[0];
  const getTomorrow = (from = new Date()) => {
    const t = new Date(from);
    t.setDate(t.getDate() + 1);
    return t;
  };
  const today = formatDate(new Date());
  const minCheckOutDate = checkIn
    ? formatDate(getTomorrow(new Date(checkIn)))
    : formatDate(getTomorrow());

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

  // ── Aggregate guest counts derived from the rooms array. Used by
  //    the search payload and the View-Rooms handoff. Backend already
  //    accepts a `roomConfigurations` array, so we now send the real
  //    per-room breakdown instead of duplicating one set N times.
  const totalAdults = rooms.reduce((a, r) => a + (Number(r.adults) || 0), 0);
  const totalChildren = rooms.reduce((a, r) => a + (Number(r.children) || 0), 0);
  const totalRooms = rooms.length;

  const validate = () => {
    const e = {};
    if (!selectedDestination) e.destination = "Required";
    if (!selectedNationality) e.nationality = "Required";
    if (!checkIn) e.checkIn = "Required";
    if (!checkOut) e.checkOut = "Required";
    if (!isAgentRole && !agent) e.agent = "Required";
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
        noOfRooms: totalRooms,
        // Per-room breakdown — each room sends its own adults /
        // children / childAges instead of the same numbers duplicated
        // N times.
        roomConfigurations: rooms.map((r) => ({
          adults: Number(r.adults) || 1,
          children: Number(r.children) || 0,
          childAges: r.childAges || [],
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
        checkIn,
        checkOut,
        noOfRooms: totalRooms,
        adults: totalAdults,
        children: totalChildren,
        agentId: agent,
        // Optional "Booking Done By Employee" selection.
        employeeId: selectedEmployee?.value || null,
      },
    });
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          {/* Heading + card shell matches /new-booking/senior-citizen
              (search-card-modern + h2 fw-semibold text-primary) so all
              the dedicated-flow search pages share one look. */}
          <Card className="shadow-sm rounded-xl mb-4 search-card-modern bg-white">
            <Card.Body className="p-4">
              <div className="mb-4 text-start">
                <h2 className="fw-semibold text-primary mb-1 d-flex align-items-center">
                  <FaGraduationCap className="me-2" /> Student — Hotel Search
                </h2>
                <p className="text-muted">
                  Browse hotels with the configured student discount applied. You'll verify the
                  student (ID upload + institution + ID number + expiry) on the booking page.
                </p>
              </div>

              {/* Field order mirrors /new-booking/hotel (HotelSearch.jsx):
                    1. Agent  2. Destination / City  3. Nationality
                    4. Check-In  5. Check-Out  6. Rooms & Guests
                  (Student has no Nights field — Check-In/Check-Out
                  define the stay directly.) The Adults / Children /
                  Rooms trio is replaced with one "Rooms & Guests"
                  button + collapsible RoomGuestSelector, identical to
                  HotelSearch's pattern. */}
              <Row className="g-4">
                {/* 1. Agent */}
                {!isAgentRole && (
                <Col lg={3} md={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold text-dark">Agent *</Form.Label>
                    <Form.Select
                      style={{ height: "46px" }}
                      value={agent}
                      onChange={(e) => setAgent(e.target.value)}
                    >
                      <option value="">-- Select Agent --</option>
                      {agents.map((a) => (
                        <option key={a.id || a.agentId} value={a.id || a.agentId}>
                          {a.companyName || a.firstName + " " + a.lastName}
                        </option>
                      ))}
                    </Form.Select>
                    {errors.agent && (
                      <div className="text-danger small mt-1">{errors.agent}</div>
                    )}
                    {agentBalance !== null && (
                      <div className="mt-1 small">
                        <span className="fw-semibold" style={{ color: "#dc3545" }}>
                          Available Balance: {Number(agentBalance).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </Form.Group>
                </Col>
                )}

                {/* 2. Destination / City */}
                <Col lg={4} md={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold text-dark">Destination *</Form.Label>
                    <Select
                      options={destinationOptions}
                      value={selectedDestination}
                      onChange={setSelectedDestination}
                      placeholder="Select city / destination"
                      isClearable isSearchable
                      menuPortalTarget={document.body}
                      styles={{
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        control: (base) => ({ ...base, minHeight: "42px" }),
                      }}
                    />
                    {errors.destination && (
                      <div className="text-danger small mt-1">{errors.destination}</div>
                    )}
                  </Form.Group>
                </Col>

                {/* 3. Nationality */}
                <Col lg={4} md={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold text-dark">Nationality *</Form.Label>
                    <Select
                      options={nationalityList}
                      value={selectedNationality}
                      onChange={setSelectedNationality}
                      placeholder="Select nationality"
                      isClearable isSearchable
                      menuPortalTarget={document.body}
                      styles={{
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        control: (base) => ({ ...base, minHeight: "42px" }),
                      }}
                    />
                    {errors.nationality && (
                      <div className="text-danger small mt-1">{errors.nationality}</div>
                    )}
                  </Form.Group>
                </Col>

                {/* Booking Done By Employee — OPTIONAL.
                    Replaces the Card that used to live on
                    StudentBookingPage. Threaded through as employeeId. */}
                <Col lg={4} md={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold text-dark">
                      Booking Done By Employee{" "}
                      <span className="text-muted small">(optional)</span>
                    </Form.Label>
                    <Select
                      options={employees.map((e) => ({
                        value: e.employeeId,
                        label: `${e.firstName || ""} ${e.lastName || ""}`.trim(),
                      }))}
                      value={selectedEmployee}
                      onChange={(opt) => setSelectedEmployee(opt)}
                      placeholder="Select employee"
                      isClearable isSearchable
                      menuPortalTarget={document.body}
                      styles={{
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        control: (base) => ({ ...base, minHeight: "42px" }),
                      }}
                    />
                  </Form.Group>
                </Col>

                {/* 4. Check-In */}
                <Col lg={4} md={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold text-dark">Check-In *</Form.Label>
                    <Form.Control
                      style={{ height: "42px" }}
                      type="date"
                      value={checkIn}
                      min={today}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      onChange={(e) => {
                        const newCheckIn = e.target.value;
                        setCheckIn(newCheckIn);
                        if (newCheckIn) {
                          const nextDay = formatDate(getTomorrow(new Date(newCheckIn)));
                          if (!checkOut || checkOut <= newCheckIn) {
                            setCheckOut(nextDay);
                          }
                        }
                      }}
                    />
                    {errors.checkIn && (
                      <div className="text-danger small mt-1">{errors.checkIn}</div>
                    )}
                  </Form.Group>
                </Col>

                {/* 5. Check-Out */}
                <Col lg={3} md={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold text-dark">Check-Out *</Form.Label>
                    <Form.Control
                      style={{ height: "42px" }}
                      type="date"
                      value={checkOut}
                      min={minCheckOutDate}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      onChange={(e) => setCheckOut(e.target.value)}
                    />
                    {errors.checkOut && (
                      <div className="text-danger small mt-1">{errors.checkOut}</div>
                    )}
                  </Form.Group>
                </Col>

                {/* 6. Rooms & Guests */}
                <Col lg={4} md={6}>
                  <Form.Label className="fw-semibold text-dark">Rooms & Guests</Form.Label>
                  <Button
                    variant="outline-primary"
                    className="w-100 text-start rooms-summary-btn-modern"
                    type="button"
                    onClick={() => setRoomsOpen((o) => !o)}
                  >
                    {totalAdults} adult{totalAdults !== 1 ? "s" : ""}
                    {totalChildren
                      ? `, ${totalChildren} child${totalChildren !== 1 ? "ren" : ""}`
                      : ""}{" "}
                    · {totalRooms} room{totalRooms !== 1 ? "s" : ""}
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

              {/* Centered submit row — same SC pattern (btn-search-modern,
                  size lg) so the visual rhythm matches the rest of the
                  search pages. */}
              <Row className="mt-3">
                <Col className="d-flex justify-content-center gap-3">
                  <Button
                    type="button"
                    className="btn-search-modern"
                    onClick={handleSearch}
                    disabled={isLoading}
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
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
