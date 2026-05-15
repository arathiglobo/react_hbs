import React, { useEffect, useRef, useState } from "react";
import {
  Card,
  Form,
  Row,
  Col,
  Button,
  ProgressBar,
  Spinner,
  Badge,
  Container,
  InputGroup,
} from "react-bootstrap";
import {
  FaSearch,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUserFriends,
  FaUtensils,
  FaUserTie,
  FaConciergeBell,
  FaClock,
} from "react-icons/fa";
import Select from "react-select";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import RestaurantCard from "./RestaurantCard";

const MEAL_TYPES = ["Any", "Breakfast", "Lunch", "Dinner", "High Tea"];
const today = () => new Date().toISOString().slice(0, 10);

/**
 * 30-minute time slot list (08:00 → 23:30). Backend filters against the
 * restaurant's open/close window, so any picked slot outside a venue's hours
 * simply drops it from the result.
 */
const TIME_SLOTS = (() => {
  const out = [];
  for (let h = 8; h <= 23; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

/** "19:30" → "07:30 PM" */
const formatSlot = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${String(hr).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
};

/**
 * Restaurant Booking — search criteria + result list.
 *
 * Mirrors the HotelSearch.jsx pattern:
 *   - Destination: typeahead against /api/province (debounced).
 *   - Agent:       /api/agent dropdown of companies.
 *
 * Validation errors render inline beside each field. On valid submit, a
 * 3-second progress bar runs while the backend search is in flight.
 */
const RestaurantSearch = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    bookingDate: today(),
    bookingTime: "19:00",
    destination: null, // { value, label }
    agentId: "",
    agentName: "",
    memberCount: 2,
    mealType: "Any",
  });

  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [destinationLoading, setDestinationLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [errors, setErrors] = useState({});
  /** Result layout — "grid" shows 3-up cards, "list" shows horizontal rows. */
  const [viewMode, setViewMode] = useState("grid");

  /** Load agents from /api/agent — same source HotelSearch uses. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAgentsLoading(true);
      try {
        const res = await axiosInstance.get("/api/agent");
        if (!cancelled) setAgents(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        if (!cancelled) setAgents([]);
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Debounced destination lookup against /api/province?search=. */
  const debounceRef = useRef(null);
  const searchDestinations = (input) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!input || input.length < 2) {
      setDestinationOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setDestinationLoading(true);
      try {
        const res = await axiosInstance.get(`/api/province?search=${encodeURIComponent(input)}`);
        const rows = Array.isArray(res.data) ? res.data : [];
        setDestinationOptions(
          rows.slice(0, 50).map((c) => ({
            value: c.id,
            label: `${c.stateName}${c.country ? ", " + c.country : ""}`,
            stateName: c.stateName,
            countryId: c.countryId,
          }))
        );
      } catch {
        setDestinationOptions([]);
      } finally {
        setDestinationLoading(false);
      }
    }, 300);
  };

  const setField = (name, value) => {
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const onAgentChange = (e) => {
    const id = e.target.value;
    const agent = agents.find((a) => String(a.id) === String(id));
    setForm((p) => ({
      ...p,
      agentId: id,
      agentName: agent?.companyName || "",
    }));
    if (errors.agentId) setErrors((prev) => ({ ...prev, agentId: "" }));
  };

  const validate = () => {
    const err = {};
    if (!form.bookingDate) err.bookingDate = "Booking date is required";
    else if (form.bookingDate < today()) err.bookingDate = "Booking date cannot be in the past";
    if (!form.bookingTime) err.bookingTime = "Time slot is required";
    if (!form.destination) err.destination = "Destination is required";
    if (!form.agentId) err.agentId = "Agent is required";
    if (!form.memberCount || Number(form.memberCount) < 1)
      err.memberCount = "At least 1 member";
    return err;
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    const err = validate();
    setErrors(err);
    if (Object.keys(err).length) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setLoading(true);
    setHasSearched(true);
    setResults([]);
    setProgress(0);

    // 3-second progress animation, then fire the search.
    const start = Date.now();
    const interval = setInterval(() => {
      setProgress(Math.min(95, Math.round(((Date.now() - start) / 3000) * 100)));
    }, 100);

    setTimeout(async () => {
      try {
        const payload = {
          bookingDate: form.bookingDate,
          bookingTime: form.bookingTime,
          destination: form.destination?.stateName || form.destination?.label,
          agentId: Number(form.agentId) || null,
          memberCount: Number(form.memberCount),
          mealType: form.mealType === "Any" ? null : form.mealType,
        };
        const res = await axiosInstance.post("/api/restaurant/search", payload);
        const data = Array.isArray(res.data) ? res.data : res.data?.content || [];
        setResults(data);
      } catch (err) {
        console.error(err);
        toast.error("Search failed — please try again.");
        setResults([]);
      } finally {
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => setLoading(false), 250);
      }
    }, 3000);
  };

  const goToBooking = (restaurant) => {
    navigate("/new-booking/restaurant/booking", {
      state: {
        restaurant,
        bookingDate: form.bookingDate,
        bookingTime: form.bookingTime,
        memberCount: form.memberCount,
        agentId: form.agentId,
        agentName: form.agentName,
      },
    });
  };

  const goToView = (restaurant) => {
    navigate(`/restaurant/view/${restaurant.id}`, { state: { restaurant } });
  };

  // react-select style override that renders invalid state inline.
  const rsStyles = (isInvalid) => ({
    control: (base, state) => ({
      ...base,
      minHeight: 42,
      borderColor: isInvalid ? "#dc3545" : state.isFocused ? "#86b7fe" : "#ced4da",
      boxShadow: state.isFocused
        ? isInvalid
          ? "0 0 0 .25rem rgba(220,53,69,.25)"
          : "0 0 0 .25rem rgba(13,110,253,.25)"
        : "none",
      "&:hover": { borderColor: isInvalid ? "#dc3545" : "#86b7fe" },
    }),
    menu: (base) => ({ ...base, zIndex: 5 }),
  });

  return (
    <div
      className="min-vh-100 bg-gradient-light d-flex flex-column"
      style={{ background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)" }}
    >
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="text-primary mb-1">
                  <FaConciergeBell className="me-2" />
                  Restaurant Booking
                </h2>
                <p className="text-muted mb-0">
                  Search restaurants by destination and book a table for your guests.
                </p>
              </div>
            </div>

            {/* Search form card */}
            <Card className="shadow-lg border-0 rounded-4 mb-4">
              <Card.Header className="bg-gradient-primary text-white border-0 rounded-top-4">
                <h5 className="mb-0 d-flex align-items-center">
                  <FaSearch className="me-2" />
                  Search Criteria
                </h5>
              </Card.Header>
              <Card.Body className="p-4">
                <Form onSubmit={handleSearch} noValidate>
                  <Row className="g-3">
                    <Col lg={3} md={6}>
                      <Form.Label className="fw-semibold text-dark">
                        <FaCalendarAlt className="me-1 text-primary" /> Booking Date *
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={form.bookingDate}
                        onChange={(e) => setField("bookingDate", e.target.value)}
                        min={today()}
                        isInvalid={!!errors.bookingDate}
                        style={{ height: "42px" }}
                      />
                      <Form.Control.Feedback type="invalid">{errors.bookingDate}</Form.Control.Feedback>
                    </Col>

                    <Col lg={3} md={6}>
                      <Form.Label className="fw-semibold text-dark">
                        <FaClock className="me-1 text-info" /> Time Slot *
                      </Form.Label>
                      <Form.Select
                        value={form.bookingTime}
                        onChange={(e) => setField("bookingTime", e.target.value)}
                        isInvalid={!!errors.bookingTime}
                        style={{ height: "42px" }}
                      >
                        <option value="">Select a time slot</option>
                        {TIME_SLOTS.map((t) => (
                          <option key={t} value={t}>
                            {formatSlot(t)}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Control.Feedback type="invalid">{errors.bookingTime}</Form.Control.Feedback>
                    </Col>

                    <Col lg={3} md={6}>
                      <Form.Label className="fw-semibold text-dark">
                        <FaMapMarkerAlt className="me-1 text-danger" /> Destination *
                      </Form.Label>
                      <Select
                        inputId="restaurant-destination"
                        options={destinationOptions}
                        value={form.destination}
                        onChange={(opt) => setField("destination", opt)}
                        onInputChange={(input, meta) => {
                          if (meta.action === "input-change") searchDestinations(input);
                        }}
                        isLoading={destinationLoading}
                        isClearable
                        placeholder="Type a city or state..."
                        noOptionsMessage={({ inputValue }) =>
                          inputValue && inputValue.length < 2
                            ? "Type at least 2 characters"
                            : destinationLoading
                            ? "Searching..."
                            : "No matches"
                        }
                        styles={rsStyles(!!errors.destination)}
                      />
                      {errors.destination && (
                        <div className="text-danger small mt-1">{errors.destination}</div>
                      )}
                    </Col>

                    <Col lg={3} md={6}>
                      <Form.Label className="fw-semibold text-dark">
                        <FaUserTie className="me-1 text-info" /> Agent *
                      </Form.Label>
                      <Form.Select
                        value={form.agentId}
                        onChange={onAgentChange}
                        isInvalid={!!errors.agentId}
                        style={{ height: "42px" }}
                        disabled={agentsLoading}
                      >
                        <option value="">
                          {agentsLoading ? "Loading agents..." : "Select Agent"}
                        </option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.companyName || a.name || `Agent #${a.id}`}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Control.Feedback type="invalid">{errors.agentId}</Form.Control.Feedback>
                    </Col>

                    <Col lg={3} md={6}>
                      <Form.Label className="fw-semibold text-dark">
                        <FaUserFriends className="me-1 text-success" /> Members *
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min={1}
                        value={form.memberCount}
                        onChange={(e) => setField("memberCount", e.target.value)}
                        isInvalid={!!errors.memberCount}
                        style={{ height: "42px" }}
                      />
                      <Form.Control.Feedback type="invalid">{errors.memberCount}</Form.Control.Feedback>
                    </Col>

                    <Col lg={3} md={6}>
                      <Form.Label className="fw-semibold text-dark">
                        <FaUtensils className="me-1 text-warning" /> Meal Type
                      </Form.Label>
                      <Form.Select
                        value={form.mealType}
                        onChange={(e) => setField("mealType", e.target.value)}
                        style={{ height: "42px" }}
                      >
                        {MEAL_TYPES.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </Form.Select>
                    </Col>

                    <Col lg={6} md={12} className="d-flex align-items-end">
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="w-100 rounded-pill"
                        disabled={loading}
                      >
                        <FaSearch className="me-2" /> Search Restaurants
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </Card.Body>
            </Card>

            {/* Progress while searching */}
            {loading && (
              <Card className="shadow-sm border-0 rounded-4 mb-3">
                <Card.Body className="text-center py-4">
                  <Spinner animation="border" variant="primary" className="mb-2" />
                  <div className="mb-2 fw-semibold">Finding the best restaurants...</div>
                  <ProgressBar
                    animated
                    striped
                    variant="primary"
                    now={progress}
                    label={`${progress}%`}
                  />
                </Card.Body>
              </Card>
            )}

            {/* Empty state */}
            {!loading && hasSearched && results.length === 0 && (
              <Card className="shadow-sm border-0 rounded-4">
                <Card.Body className="text-center text-muted py-5">
                  <FaUtensils size={48} className="mb-2 opacity-50" />
                  <h6 className="mb-1">No restaurants found</h6>
                  <small>Try changing the destination or member count.</small>
                </Card.Body>
              </Card>
            )}

            {/* Results */}
            {!loading && results.length > 0 && (
              <>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">
                    <Badge bg="primary" className="me-2">
                      {results.length}
                    </Badge>
                    restaurants in {form.destination?.label}
                  </h5>
                  {/* Grid / List view toggle — same pattern as RoomList.jsx */}
                  <div className="btn-group shadow-sm gap-1" role="group" aria-label="View mode">
                    <Button
                      variant={viewMode === "grid" ? "primary" : "outline-primary"}
                      onClick={() => setViewMode("grid")}
                      size="sm"
                      className="d-flex align-items-center gap-2"
                      aria-pressed={viewMode === "grid"}
                    >
                      <span className="fs-5" style={{ lineHeight: 1 }}>⊞</span>
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "primary" : "outline-primary"}
                      onClick={() => setViewMode("list")}
                      size="sm"
                      className="d-flex align-items-center gap-2"
                      aria-pressed={viewMode === "list"}
                    >
                      <span className="fs-5" style={{ lineHeight: 1 }}>☰</span>
                    </Button>
                  </div>
                </div>
                <Row className="g-3">
                  {results.map((r) => (
                    <Col
                      key={r.id}
                      md={viewMode === "grid" ? 6 : 12}
                      lg={viewMode === "grid" ? 4 : 12}
                    >
                      <RestaurantCard
                        restaurant={r}
                        viewMode={viewMode}
                        onView={() => goToView(r)}
                        onBook={() => goToBooking(r)}
                      />
                    </Col>
                  ))}
                </Row>
              </>
            )}
          </Container>
        </main>
      </div>
    </div>
  );
};

export default RestaurantSearch;
