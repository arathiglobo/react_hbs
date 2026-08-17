import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Spinner,
} from "react-bootstrap";
import {
  FaPlaneDeparture,
  FaPlaneArrival,
  FaSearch,
  FaUsers,
  FaExchangeAlt,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";
import AgentSelect from "../../../components/AgentSelect";
import FlightLocationSelect from "./FlightLocationSelect";
import CountrySelect from "./CountrySelect";
import FlightResults from "./FlightResults";
import "../../../styles/HotelSearch.css";

/* Amadeus cabin codes. Values match backend {@code normalizeCabin} mapping.
 * An empty value (Any Cabin) is the safe default — it tells the backend
 * NOT to send a <travelFlightInfo><cabinId> block, so Amadeus returns
 * recommendations across every cabin the fare is available in (Economy +
 * Premium Economy + Business + First). Sending a specific cabin like "M"
 * on every search silently drops premium fares and cuts the result count
 * (observed: DXB→BOM returned 48 rows in Economy-only vs. 67 with any-cabin). */
const CABIN_OPTIONS = [
  { value: "",  label: "Any Cabin" },
  { value: "M", label: "Economy" },
  { value: "W", label: "Premium Economy" },
  { value: "C", label: "Business" },
  { value: "F", label: "First" },
];

const JOURNEY_TYPES = [
  { value: "1", label: "One-way" },
  { value: "2", label: "Round-trip" },
  { value: "3", label: "Multi-city" },
];

// Flight preferred = max number of stops. Values are integers because the
// backend's Amadeus request builder accepts a numeric maxConnections; empty
// string means "no preference" and is preserved as such in the payload.
const FLIGHT_PREFERRED = [
  { value: "0", label: "Non Stop" },
  { value: "1", label: "One Stop" },
  { value: "2", label: "Two Stop" },
];

// dd/MM/yyyy for the backend contract.
const toDdMmYyyy = (isoDate) => {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
};

// Each leg keeps the picked suggestion object so the display line survives
// re-renders (and a swap correctly moves the full object across).
const emptyLeg = () => ({ fromLoc: null, toLoc: null, departure: "" });

const FlightSearch = () => {
  const navigate = useNavigate();
  const [journeyType, setJourneyType] = useState("1");
  const [legs, setLegs] = useState([emptyLeg()]);
  const [adult, setAdult] = useState("1");
  const [children, setChildren] = useState("0");
  const [infant, setInfant] = useState("0");
  // Default to "Any Cabin" (blank) — see CABIN_OPTIONS comment for why.
  // The user can still narrow via the Class dropdown when they want to.
  const [classOfService, setClassOfService] = useState("");
  // Native country is now a full CountrySuggestion object so the dropdown
  // can render the selected name back to the user; we send its code as the
  // request payload's nativeCountry value.
  const [nativeCountry, setNativeCountry] = useState(null);
  const [flightType, setFlightType] = useState("");
  const [agentId, setAgentId] = useState("");
  const [agents, setAgents] = useState([]);

  // Load the active agent list once — same endpoint HotelSearch uses so the
  // list stays consistent across booking pages. Failure is silent; the picker
  // just shows an empty option list. Response is guarded (array-only) and
  // no cap is applied — HotelSearch uses this same endpoint without issue,
  // so the list size is known-safe for react-select rendering.
  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get("/api/agent?activeOnly=true")
      .then((res) => {
        if (cancelled) return;
        const data = Array.isArray(res.data) ? res.data : [];
        setAgents(data);
      })
      .catch(() => { if (!cancelled) setAgents([]); });
    return () => { cancelled = true; };
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  // Mirrors HotelSearch's collapse-to-summary-bar pattern: once a search
  // completes, the full form gives way to a compact strip with a "Modify
  // Search" button. Set true to re-expand; a fresh search always collapses
  // it again (see `search()` below).
  const [isEditingSearch, setIsEditingSearch] = useState(false);

  // Round-trip is a 2-leg one-way + return; keep the legs array in sync
  // with the journey type in BOTH directions — expand when switching to a
  // wider type, and trim when switching to a narrower one. Without the
  // trim, a user who added 4 legs on Multi-city and then switched back to
  // Round-trip would still POST 4 legs to Amadeus, silently over-searching.
  const onJourneyTypeChange = (v) => {
    setJourneyType(v);
    if (v === "1") {
      // One-way: exactly 1 leg; keep the first if the user already picked one.
      setLegs(legs.length ? [legs[0]] : [emptyLeg()]);
    } else if (v === "2") {
      // Round-trip: exactly 2 legs. Grow to 2 if shorter; truncate to 2 if longer.
      if (legs.length < 2) setLegs([legs[0] || emptyLeg(), emptyLeg()]);
      else if (legs.length > 2) setLegs(legs.slice(0, 2));
    } else if (v === "3" && legs.length < 2) {
      // Multi-city needs at least 2 legs; expand from 1.
      setLegs([legs[0] || emptyLeg(), emptyLeg()]);
    }
  };

  const updateLeg = (idx, field, value) => {
    setLegs((prev) => prev.map((leg, i) => (i === idx ? { ...leg, [field]: value } : leg)));
  };

  const swapLeg = (idx) => {
    setLegs((prev) =>
      prev.map((leg, i) => (i === idx ? { ...leg, fromLoc: leg.toLoc, toLoc: leg.fromLoc } : leg)),
    );
  };

  const addLeg = () => setLegs((prev) => [...prev, emptyLeg()]);
  const removeLeg = (idx) => setLegs((prev) => prev.filter((_, i) => i !== idx));

  const validate = () => {
    if (!legs.length) return "At least one route is required.";
    for (let i = 0; i < legs.length; i++) {
      const l = legs[i];
      if (!l.fromLoc?.airportcode) return `Please pick an origin (row ${i + 1}) from the suggestions.`;
      if (!l.toLoc?.airportcode) return `Please pick a destination (row ${i + 1}) from the suggestions.`;
      if (!l.departure) return `Departure date (row ${i + 1}) is required.`;
    }
    if (Number(adult) < 1) return "At least one adult is required.";
    return null;
  };

  const search = async (e) => {
    e?.preventDefault();
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }

    const payload = {
      originDtls: legs.map((l) => ({
        from: (l.fromLoc?.airportcode || "").toUpperCase(),
        to: (l.toLoc?.airportcode || "").toUpperCase(),
        departure: toDdMmYyyy(l.departure),
      })),
      journeyType,
      adult,
      children,
      infant,
      classOfService,
      childrenAge: [],
      agent_id: agentId,
      infantAge: [],
      nativeCountry: nativeCountry?.code || "",
      flightType,
    };

    setLoading(true);
    setError(null);
    setResults([]);
    setSearched(true);
    setIsEditingSearch(false);
    try {
      // Override AxiosInstance's global 30s timeout — a busy long-haul
      // route can legitimately take Amadeus 40s+ to price (observed:
      // 46.7s for a CDG-BOM search with 56 recommendations across 17
      // airlines), well past the 30s default but still under the
      // backend's own 60s Amadeus read-timeout. Without this the frontend
      // gives up on a search that was about to succeed.
      const res = await axiosInstance.post("/custom/amadeus/search", payload, {
        timeout: 90000,
      });
      const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
      setResults(data);
      if (!data.length) toast("No flights found for the selected criteria.", { icon: "ℹ️" });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Flight search failed. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const canRemoveLeg = journeyType === "3" && legs.length > 1;
  const showAddLeg = journeyType === "3";
  // Collapse the full form into the sticky summary strip once a search has
  // completed, unless the user explicitly chose to modify it — same rule
  // HotelSearch uses (see `collapseSearch` there).
  const collapseSearch = searched && !loading && !isEditingSearch;
  const journeyTypeLabel =
    JOURNEY_TYPES.find((o) => o.value === journeyType)?.label || "";
  // Short "CODE" or "City (CODE)" label for a leg endpoint — mirrors the
  // compact chip style HotelSearch uses for its destination.
  const legEndpointLabel = (loc) =>
    loc ? (loc.referencecity ? `${loc.referencecity} (${loc.airportcode})` : loc.airportcode) : "";
  const paxSummary = (() => {
    const a = Number(adult) || 0;
    const c = Number(children) || 0;
    const i = Number(infant) || 0;
    const parts = [`${a} adult${a === 1 ? "" : "s"}`];
    if (c) parts.push(`${c} child${c === 1 ? "" : "ren"}`);
    if (i) parts.push(`${i} infant${i === 1 ? "" : "s"}`);
    return parts.join(", ");
  })();

  return (
    <div>
      <TopBar />
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: "24px", background: "#f7f8fa" }}>
          <h4 style={{ marginBottom: 4 }}>
            <FaPlaneDeparture style={{ marginRight: 8 }} /> Flight Search
          </h4>
          <p style={{ color: "#6b7280", marginBottom: 20 }}>
            Search live flight availability powered by Amadeus.
          </p>

          {/* ── Collapsed sticky search summary strip ──
              Shown once a search has completed. "Modify Search" re-expands
              the full form below by flipping isEditingSearch — same pattern
              as HotelSearch's hs-summary-bar. */}
          {collapseSearch && (
            <div className="hs-summary-bar">
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
                <span className="hs-summary-chip hs-summary-chip-main">
                  {legs
                    .map((l) => `${legEndpointLabel(l.fromLoc)} → ${legEndpointLabel(l.toLoc)}`)
                    .join("  |  ")}
                </span>
                {legs[0]?.departure && (
                  <span className="hs-summary-chip">
                    {legs[0].departure}
                    {journeyType === "2" && legs[1]?.departure ? ` → ${legs[1].departure}` : ""}
                  </span>
                )}
                <span className="hs-summary-chip">{journeyTypeLabel}</span>
                <span className="hs-summary-chip">{paxSummary}</span>
              </div>
            </div>
          )}

          {!collapseSearch && (
          <Card className="mb-4">
            <Card.Body>
              <Form onSubmit={search}>
                <Row className="g-3 align-items-end">
                  <Col md={3}>
                    <Form.Label>Journey Type</Form.Label>
                    <Form.Select
                      value={journeyType}
                      onChange={(e) => onJourneyTypeChange(e.target.value)}
                    >
                      {JOURNEY_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={3}>
                    <Form.Label>Class</Form.Label>
                    <Form.Select
                      value={classOfService}
                      onChange={(e) => setClassOfService(e.target.value)}
                    >
                      {CABIN_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={2}>
                    <Form.Label><FaUsers style={{ marginRight: 4 }} /> Adults</Form.Label>
                    <Form.Control
                      type="number" min={1} max={9}
                      value={adult}
                      onChange={(e) => setAdult(e.target.value)}
                    />
                  </Col>
                  <Col md={2}>
                    <Form.Label>Children</Form.Label>
                    <Form.Control
                      type="number" min={0} max={9}
                      value={children}
                      onChange={(e) => setChildren(e.target.value)}
                    />
                  </Col>
                  <Col md={2}>
                    <Form.Label>Infants</Form.Label>
                    <Form.Control
                      type="number" min={0} max={9}
                      value={infant}
                      onChange={(e) => setInfant(e.target.value)}
                    />
                  </Col>
                </Row>

                {legs.map((leg, idx) => (
                  <Row className="g-3 align-items-end mt-2" key={idx}>
                    <Col md={3}>
                      <FlightLocationSelect
                        label="From"
                        icon={<FaPlaneDeparture style={{ marginRight: 4 }} />}
                        placeholder="City or airport (e.g. CDG, Paris)"
                        value={leg.fromLoc}
                        onChange={(s) => updateLeg(idx, "fromLoc", s)}
                      />
                    </Col>
                    <Col md={1} className="text-center">
                      <Button
                        variant="light"
                        title="Swap"
                        style={{ marginBottom: 2 }}
                        onClick={() => swapLeg(idx)}
                        type="button"
                      >
                        <FaExchangeAlt />
                      </Button>
                    </Col>
                    <Col md={3}>
                      <FlightLocationSelect
                        label="To"
                        icon={<FaPlaneArrival style={{ marginRight: 4 }} />}
                        placeholder="City or airport (e.g. FRA, Frankfurt)"
                        value={leg.toLoc}
                        onChange={(s) => updateLeg(idx, "toLoc", s)}
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Label>Departure</Form.Label>
                      <Form.Control
                        type="date"
                        value={leg.departure}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => updateLeg(idx, "departure", e.target.value)}
                      />
                    </Col>
                    <Col md={2} className="d-flex" style={{ gap: 8 }}>
                      {canRemoveLeg && (
                        <Button variant="outline-danger" size="sm" type="button"
                          onClick={() => removeLeg(idx)}>
                          Remove
                        </Button>
                      )}
                    </Col>
                  </Row>
                ))}

                {showAddLeg && (
                  <div className="mt-2">
                    <Button variant="outline-primary" size="sm" type="button" onClick={addLeg}>
                      + Add another leg
                    </Button>
                  </div>
                )}

                <Row className="g-3 mt-3">
                  <Col md={4}>
                    <Form.Label>Search Agent</Form.Label>
                    <AgentSelect
                      agents={agents}
                      value={agentId}
                      onChange={(v) => setAgentId(v)}
                      placeholder="SELECT"
                    />
                  </Col>
                  <Col md={4}>
                    <CountrySelect
                      label="Native Country of Guest"
                      placeholder="SELECT"
                      value={nativeCountry}
                      onChange={setNativeCountry}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Label>Flight Preferred</Form.Label>
                    <div className="d-flex" style={{ gap: 16, paddingTop: 6 }}>
                      {FLIGHT_PREFERRED.map((o) => (
                        <Form.Check
                          key={o.value}
                          type="radio"
                          id={`flight-pref-${o.value}`}
                          name="flightPreferred"
                          label={o.label}
                          value={o.value}
                          checked={flightType === o.value}
                          onChange={(e) => setFlightType(e.target.value)}
                        />
                      ))}
                    </div>
                  </Col>
                </Row>

                <Row className="g-3 mt-3">
                  <Col className="d-flex justify-content-center">
                    <Button
                      type="submit"
                      size="lg"
                      disabled={loading}
                      style={{
                        background: "linear-gradient(135deg, #EC0B43 0%, #C90939 100%)",
                        border: "none",
                        borderRadius: 50,
                        padding: "14px 40px",
                        fontSize: "1.05rem",
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                        color: "#fff",
                        boxShadow: "0 4px 15px rgba(236, 11, 67, 0.3)",
                      }}
                    >
                      {loading ? (
                        <>
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Searching…
                        </>
                      ) : (
                        <>
                          <FaSearch className="me-2" />
                          SEARCH FLIGHTS
                        </>
                      )}
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>
          )}

          <FlightResults
            loading={loading}
            error={error}
            searched={searched}
            results={results}
            onSelect={(rec) => {
              // "View Fares" opens in a new tab so the agent can keep
              // comparing search results without losing their place. A new
              // tab from window.open has no access to React Router's
              // in-memory navigation state, so the payload can't travel via
              // `navigate(path, {state})` like it used to when this stayed
              // in the same tab — it's stashed in localStorage instead
              // (shared across all tabs of this origin, unlike
              // sessionStorage which browsers only copy into a new tab
              // inconsistently). Keyed uniquely per click so two "View
              // Fares" clicks in a row never collide; the destination page
              // reads it once on mount and removes it immediately so
              // nothing accumulates.
              const payload = {
                rec,
                pax: {
                  adult: Number(adult) || 1,
                  children: Number(children) || 0,
                  infant: Number(infant) || 0,
                },
                fareCurrency: rec?.pricing?.currency || null,
              };
              const dataKey = `fbpc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              try {
                localStorage.setItem(dataKey, JSON.stringify(payload));
              } catch (e) {
                toast.error("Could not open fare details — please try again.");
                return;
              }
              const params = new URLSearchParams();
              if (agentId) params.set("agentId", agentId);
              params.set("dataKey", dataKey);
              window.open(`/new-booking/flightBestPriceCheck?${params.toString()}`, "_blank");
            }}
          />
        </main>
      </div>
    </div>
  );
};

export default FlightSearch;
