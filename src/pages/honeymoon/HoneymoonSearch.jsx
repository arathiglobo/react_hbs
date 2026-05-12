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
} from "react-bootstrap";
import {
  FaSearch,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUserFriends,
  FaUserTie,
  FaPlaneDeparture,
  FaBed,
  FaChild,
  FaWallet,
  FaSuitcaseRolling,
} from "react-icons/fa";
import Select from "react-select";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/TopBar";
import axiosInstance from "../../components/AxiosInstance";
import HoneymoonCard from "./HoneymoonCard";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Debounced shared lookup for /api/province — used by both Starting From
 * and Going To inputs.
 */
const useProvinceLookup = () => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const search = (input) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!input || input.length < 2) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await axiosInstance.get(`/api/province?search=${encodeURIComponent(input)}`);
        const rows = Array.isArray(r.data) ? r.data : [];
        setOptions(
          rows.slice(0, 50).map((p) => ({
            value: p.id,
            label: `${p.stateName}${p.country ? ", " + p.country : ""}`,
            stateName: p.stateName,
            country: p.country,
            countryId: p.countryId,
          }))
        );
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };
  return { options, loading, search };
};

const HoneymoonSearch = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    startingFrom: null,
    destination: null,
    startingDate: today(),
    rooms: 1,
    adults: 2,
    children: 0,
    agentId: "",
    agentName: "",
    markupPercent: 0,
  });
  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // Agent balance — same flow as HotelSearch.jsx (calls /api/agent-credit-limit/agent/{id}).
  const [agentBalance, setAgentBalance] = useState(null);
  const [agentBalanceLoading, setAgentBalanceLoading] = useState(false);

  // Two independent province lookups so each typeahead has its own option list.
  const fromLookup = useProvinceLookup();
  const toLookup = useProvinceLookup();

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAgentsLoading(true);
      try {
        const res = await axiosInstance.get("/api/agent");
        if (!cancelled) setAgents(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setAgents([]);
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch credit-limit balance whenever the selected agent changes.
  useEffect(() => {
    if (!form.agentId) {
      setAgentBalance(null);
      return;
    }
    let cancelled = false;
    setAgentBalanceLoading(true);
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${form.agentId}`)
      .then((res) => {
        if (!cancelled) setAgentBalance(res?.data?.availableCreditLimit ?? null);
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
  }, [form.agentId]);

  const setField = (n, v) => {
    setForm((p) => ({ ...p, [n]: v }));
    if (errors[n]) setErrors((p) => ({ ...p, [n]: "" }));
  };

  const onAgentChange = (e) => {
    const id = e.target.value;
    const a = agents.find((x) => String(x.id) === String(id));
    setForm((p) => ({
      ...p,
      agentId: id,
      agentName: a?.companyName || a?.name || "",
      markupPercent:
        a?.markupPercentage != null
          ? Number(a.markupPercentage)
          : a?.markup != null
          ? Number(a.markup)
          : 10,
    }));
    if (errors.agentId) setErrors((p) => ({ ...p, agentId: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.startingFrom) e.startingFrom = "Starting From is required";
    if (!form.destination) e.destination = "Destination is required";
    if (!form.startingDate) e.startingDate = "Starting date is required";
    else if (form.startingDate < today()) e.startingDate = "Date cannot be in the past";
    if (!form.rooms || Number(form.rooms) < 1) e.rooms = "At least 1 room";
    if (!form.adults || Number(form.adults) < 1) e.adults = "At least 1 adult";
    if (!form.agentId) e.agentId = "Agent is required";
    return e;
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

    const start = Date.now();
    const interval = setInterval(() => {
      setProgress(Math.min(95, Math.round(((Date.now() - start) / 3000) * 100)));
    }, 100);

    setTimeout(async () => {
      try {
        const payload = {
          startingFrom: form.startingFrom?.stateName || form.startingFrom?.label,
          destination: form.destination?.stateName || form.destination?.label,
          startingDate: form.startingDate,
          rooms: Number(form.rooms),
          adults: Number(form.adults),
          children: Number(form.children),
          agentId: Number(form.agentId) || null,
          markupPercent: Number(form.markupPercent) || 0,
        };
        const res = await axiosInstance.post("/api/honeymoon/search", payload);
        const data = Array.isArray(res.data) ? res.data : res.data?.content || [];
        setResults(data);
      } catch (err) {
        console.error(err);
        toast.error("Search failed");
        setResults([]);
      } finally {
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => setLoading(false), 250);
      }
    }, 3000);
  };

  const goToView = (pkg) =>
    navigate(`/honeymoon/view/${pkg.id}`, { state: { pkg, searchForm: form } });
  const goToBook = (pkg) =>
    navigate("/honeymoon/book", { state: { pkg, searchForm: form } });

  const rsStyles = (isInvalid) => ({
    control: (b, s) => ({
      ...b,
      minHeight: 42,
      borderColor: isInvalid ? "#dc3545" : s.isFocused ? "#86b7fe" : "#ced4da",
      boxShadow: s.isFocused
        ? isInvalid
          ? "0 0 0 .25rem rgba(220,53,69,.25)"
          : "0 0 0 .25rem rgba(13,110,253,.25)"
        : "none",
    }),
    menu: (b) => ({ ...b, zIndex: 5 }),
  });

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: "#f5f7fb" }}>
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            <div className="mb-4">
              <h2 className="text-primary mb-1">
                <FaSuitcaseRolling className="me-2" />
                Honeymoon Package Booking
              </h2>
              <p className="text-muted mb-0">
                Find the perfect romantic getaway for your couple.
              </p>
            </div>

            <Card className="shadow-lg border-0 rounded-4 mb-4">
              <Card.Header className="bg-gradient-primary text-white border-0 rounded-top-4">
                <h5 className="mb-0">
                  <FaSearch className="me-2" /> Search Criteria
                </h5>
              </Card.Header>
              <Card.Body className="p-4">
                <Form onSubmit={handleSearch} noValidate>
                  <Row className="g-3">
                    <Col lg={3} md={6}>
                      <Form.Label className="fw-semibold">
                        <FaPlaneDeparture className="me-1 text-primary" /> Starting From *
                      </Form.Label>
                      <Select
                        options={fromLookup.options}
                        value={form.startingFrom}
                        onChange={(opt) => setField("startingFrom", opt)}
                        onInputChange={(input, meta) => {
                          if (meta.action === "input-change") fromLookup.search(input);
                        }}
                        isLoading={fromLookup.loading}
                        isClearable
                        placeholder="Search origin..."
                        noOptionsMessage={({ inputValue }) =>
                          inputValue && inputValue.length < 2
                            ? "Type at least 2 characters"
                            : fromLookup.loading
                            ? "Searching..."
                            : "No matches"
                        }
                        styles={rsStyles(!!errors.startingFrom)}
                      />
                      {errors.startingFrom && (
                        <div className="text-danger small mt-1">{errors.startingFrom}</div>
                      )}
                    </Col>

                    <Col lg={3} md={6}>
                      <Form.Label className="fw-semibold">
                        <FaMapMarkerAlt className="me-1 text-danger" /> Going To *
                      </Form.Label>
                      <Select
                        options={toLookup.options}
                        value={form.destination}
                        onChange={(opt) => setField("destination", opt)}
                        onInputChange={(input, meta) => {
                          if (meta.action === "input-change") toLookup.search(input);
                        }}
                        isLoading={toLookup.loading}
                        isClearable
                        placeholder="Search destination..."
                        noOptionsMessage={({ inputValue }) =>
                          inputValue && inputValue.length < 2
                            ? "Type at least 2 characters"
                            : toLookup.loading
                            ? "Searching..."
                            : "No matches"
                        }
                        styles={rsStyles(!!errors.destination)}
                      />
                      {errors.destination && (
                        <div className="text-danger small mt-1">{errors.destination}</div>
                      )}
                    </Col>

                    <Col lg={2} md={6}>
                      <Form.Label className="fw-semibold">
                        <FaCalendarAlt className="me-1 text-primary" /> Start Date *
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={form.startingDate}
                        onChange={(e) => setField("startingDate", e.target.value)}
                        min={today()}
                        isInvalid={!!errors.startingDate}
                        style={{ height: 42 }}
                      />
                      <Form.Control.Feedback type="invalid">{errors.startingDate}</Form.Control.Feedback>
                    </Col>

                    <Col lg={2} md={6}>
                      <Form.Label className="fw-semibold">
                        <FaBed className="me-1 text-success" /> Rooms *
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min={1}
                        value={form.rooms}
                        onChange={(e) => setField("rooms", e.target.value)}
                        isInvalid={!!errors.rooms}
                        style={{ height: 42 }}
                      />
                      <Form.Control.Feedback type="invalid">{errors.rooms}</Form.Control.Feedback>
                    </Col>

                    <Col lg={2} md={6}>
                      <Form.Label className="fw-semibold">
                        <FaUserFriends className="me-1 text-success" /> Adults *
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min={1}
                        value={form.adults}
                        onChange={(e) => setField("adults", e.target.value)}
                        isInvalid={!!errors.adults}
                        style={{ height: 42 }}
                      />
                      <Form.Control.Feedback type="invalid">{errors.adults}</Form.Control.Feedback>
                    </Col>

                    <Col lg={2} md={6}>
                      <Form.Label className="fw-semibold">
                        <FaChild className="me-1 text-warning" /> Children
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min={0}
                        value={form.children}
                        onChange={(e) => setField("children", e.target.value)}
                        style={{ height: 42 }}
                      />
                    </Col>

                    <Col lg={4} md={6}>
                      <Form.Label className="fw-semibold">
                        <FaUserTie className="me-1 text-info" /> Agent *
                      </Form.Label>
                      <Form.Select
                        value={form.agentId}
                        onChange={onAgentChange}
                        isInvalid={!!errors.agentId}
                        disabled={agentsLoading}
                        style={{ height: 42 }}
                      >
                        <option value="">{agentsLoading ? "Loading..." : "Select Agent"}</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.companyName || a.name || `Agent #${a.id}`}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Control.Feedback type="invalid">{errors.agentId}</Form.Control.Feedback>
                      {form.agentId && (
                        <div className="mt-1">
                          {agentBalanceLoading ? (
                            <Badge bg="light" text="dark" className="border">
                              <Spinner animation="border" size="sm" className="me-1" />
                              Checking balance...
                            </Badge>
                          ) : agentBalance != null ? (
                            <Badge bg="success" className="px-2 py-1">
                              <FaWallet className="me-1" />
                              Available Balance: {Number(agentBalance).toFixed(2)}
                            </Badge>
                          ) : (
                            <Badge bg="secondary" className="px-2 py-1">
                              <FaWallet className="me-1" /> Balance unavailable
                            </Badge>
                          )}
                        </div>
                      )}
                    </Col>

                    <Col lg={4} md={6} className="d-flex align-items-end">
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="w-100 rounded-pill"
                        disabled={loading}
                      >
                        <FaSearch className="me-2" /> Search Packages
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </Card.Body>
            </Card>

            {loading && (
              <Card className="shadow-sm border-0 rounded-4 mb-3">
                <Card.Body className="text-center py-4">
                  <Spinner animation="border" variant="primary" className="mb-2" />
                  <div className="mb-2 fw-semibold">Finding the perfect getaway...</div>
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

            {!loading && hasSearched && results.length === 0 && (
              <Card className="shadow-sm border-0 rounded-4">
                <Card.Body className="text-center text-muted py-5">
                  <FaSuitcaseRolling size={48} className="mb-2 opacity-50" />
                  <h6 className="mb-1">No packages found</h6>
                  <small>Try changing the destination or date.</small>
                </Card.Body>
              </Card>
            )}

            {!loading && results.length > 0 && (
              <>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">
                    <Badge bg="primary" className="me-2">
                      {results.length}
                    </Badge>
                    honeymoon packages for {form.destination?.label}
                  </h5>
                </div>
                <Row className="g-3">
                  {results.map((p) => (
                    <Col key={p.id} md={6} lg={4}>
                      <HoneymoonCard pkg={p} onView={() => goToView(p)} onBook={() => goToBook(p)} />
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

export default HoneymoonSearch;
