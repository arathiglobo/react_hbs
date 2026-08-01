import React, { useEffect, useMemo, useState } from "react";
import { Card, Row, Col, Button, Badge, Collapse, Spinner, Alert, Form } from "react-bootstrap";
import {
  FaPlaneDeparture,
  FaPlaneArrival,
  FaClock,
  FaExchangeAlt,
  FaSuitcase,
  FaChevronDown,
  FaChevronUp,
  FaInfoCircle,
  FaSearch,
} from "react-icons/fa";
import axiosInstance from "../../../components/AxiosInstance";

/*
 * Flight search results panel.
 * Design mirrors /new-booking/hotel: a shell wrapping the count line +
 * per-item card, with left-side details (airline, route, duration, stops)
 * and a right-side price column with a primary CTA. Each card can expand
 * to show the per-segment breakdown and fare / baggage details.
 *
 * The panel is pure presentation — the parent owns the loading / error /
 * results state and passes them in as props. A left-hand filter sidebar
 * (currency, price sort, stops, refund type, airline) mirrors the
 * /new-booking/hotel filtersection styling, but — per requirement — filters
 * only take effect once the user clicks "Apply Filters"; adjusting a filter
 * control alone does not change the displayed results.
 */

const STOP_OPTIONS = [
  { value: "0", label: "Non-stop" },
  { value: "1", label: "1 Stop" },
  { value: "2", label: "2+ Stops" },
];

const REFUND_OPTIONS = [
  { value: "refundable", label: "Refundable" },
  { value: "nonrefundable", label: "Non-Refundable" },
];

const emptyFilters = () => ({
  currency: null, // { code, rate } | null = show each row's native currency
  priceSort: "", // "" | "lowToHigh" | "highToLow"
  stops: [], // subset of STOP_OPTIONS values
  refundType: [], // subset of REFUND_OPTIONS values
  airlines: [], // subset of carrier codes
});

const carrierOf = (rec) =>
  rec.validatingCarrier || rec.legs?.[0]?.segments?.[0]?.marketingCarrier || null;

const airlineNameOf = (rec) =>
  rec.legs?.[0]?.segments?.[0]?.airLineName || carrierOf(rec) || "Unknown";

const maxStopsOf = (rec) =>
  Math.max(0, ...(rec.legs || []).map((l) => Math.max(0, (l.segments?.length || 1) - 1)));

const priceOf = (rec) => Number(rec.pricing?.totalRateWithMarkup ?? rec.pricing?.total ?? 0);

const CABIN_LABELS = {
  M: "Economy",
  Y: "Economy",
  W: "Premium Economy",
  C: "Business",
  F: "First",
};

const cabinLabel = (code) => CABIN_LABELS[code] || code || "Economy";

// Fallback airline logo if the DB row has no logo_url — a monogram circle
// built from the carrier code so the layout stays stable.
const AirlineLogo = ({ src, code }) => {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={code || "airline"}
        onError={() => setBroken(true)}
        style={{ width: 56, height: 56, objectFit: "contain", background: "#fff", borderRadius: 8, padding: 4, border: "1px solid #eef1f5" }}
      />
    );
  }
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 8, background: "#e7f1ff",
      color: "#0d6efd", display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: 14, border: "1px solid #cfe2ff",
    }}>
      {code || "??"}
    </div>
  );
};

const parseDt = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmtTime = (iso) => {
  const d = parseDt(iso);
  if (!d) return "--:--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};

const fmtDate = (iso) => {
  const d = parseDt(iso);
  if (!d) return "";
  return d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
};

const durationBetween = (fromIso, toIso) => {
  const a = parseDt(fromIso);
  const b = parseDt(toIso);
  if (!a || !b) return null;
  const mins = Math.max(0, Math.round((b - a) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
};

const legDuration = (leg) => {
  if (!leg?.segments?.length) return null;
  const first = leg.segments[0];
  const last = leg.segments[leg.segments.length - 1];
  return durationBetween(first.departureDateTime, last.arrivalDateTime);
};

const stopsLabel = (leg) => {
  const n = Math.max(0, (leg?.segments?.length || 0) - 1);
  if (n === 0) return "Non-stop";
  if (n === 1) return "1 stop";
  return `${n} stops`;
};

const stopCities = (leg) =>
  (leg?.segments || []).slice(0, -1).map((s) => s.arrivalAirportCode).filter(Boolean);

const fmtAmount = (v, cur) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return `${cur || ""} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`.trim();
};

/* ─── Single result card (matches /new-booking/hotel card shape) ─── */
const FlightCard = ({ rec, onSelect, convert }) => {
  const [open, setOpen] = useState(false);
  const legs = rec.legs || [];
  const firstLeg = legs[0];
  const firstSeg = firstLeg?.segments?.[0];
  const airline = firstSeg?.airLineName || rec.validatingCarrier || "";
  const carrier = firstSeg?.marketingCarrier || rec.validatingCarrier;
  const cabin = firstSeg?.cabin;
  const pax0 = rec.passengers?.[0];
  const fd = pax0?.fareDetails;
  const conv = convert || ((amount, code) => ({ amount, code }));
  const totalConv = conv(rec.pricing?.totalRateWithMarkup ?? rec.pricing?.total, rec.pricing?.currency);
  const taxConv = conv(rec.pricing?.totalTax, rec.pricing?.currency);

  return (
    <Card className="mb-3 shadow-sm" style={{ border: "1px solid #eef1f5" }}>
      <Card.Body>
        <Row className="g-3">
          {/* Left column — airline + route summary */}
          <Col lg={8} md={7}>
            <Row className="g-3 align-items-center">
              <Col xs="auto">
                <AirlineLogo src={firstSeg?.airlineLogo} code={carrier} />
              </Col>
              <Col>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{airline || carrier}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {carrier}
                  {firstSeg?.flightNumber ? ` · ${carrier}${firstSeg.flightNumber}` : ""}
                  {cabin ? ` · ${cabinLabel(cabin)}` : ""}
                </div>
              </Col>
            </Row>

            {/* Per-leg summary row */}
            {legs.map((leg, i) => {
              const first = leg.segments?.[0];
              const last = leg.segments?.[leg.segments.length - 1];
              return (
                <div key={i} style={{ marginTop: 14, borderTop: i > 0 ? "1px dashed #e9ecef" : "none", paddingTop: i > 0 ? 10 : 0 }}>
                  <Row className="g-2 align-items-center">
                    <Col xs={3}>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{fmtTime(first?.departureDateTime)}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{first?.departureAirportCode || leg.from}</div>
                      <div className="text-muted" style={{ fontSize: 11 }}>{fmtDate(first?.departureDateTime)}</div>
                    </Col>
                    <Col xs={6} className="text-center">
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        <FaClock style={{ marginRight: 4 }} />
                        {legDuration(leg) || "—"}
                      </div>
                      <div style={{
                        height: 2, background: "#dee2e6", position: "relative", margin: "6px 4px",
                      }}>
                        <FaPlaneDeparture style={{
                          position: "absolute", right: -6, top: -8, color: "#0d6efd",
                        }} />
                      </div>
                      <Badge bg={leg.segments?.length > 1 ? "warning" : "success"} style={{ fontSize: 11 }}>
                        {stopsLabel(leg)}
                        {stopCities(leg).length > 0 ? ` · via ${stopCities(leg).join(", ")}` : ""}
                      </Badge>
                    </Col>
                    <Col xs={3} className="text-end">
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{fmtTime(last?.arrivalDateTime)}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{last?.arrivalAirportCode || leg.to}</div>
                      <div className="text-muted" style={{ fontSize: 11 }}>{fmtDate(last?.arrivalDateTime)}</div>
                    </Col>
                  </Row>
                </div>
              );
            })}

            <div className="mt-3 d-flex" style={{ gap: 12, flexWrap: "wrap" }}>
              <span className="text-muted" style={{ fontSize: 12 }}>
                <FaSuitcase style={{ marginRight: 4 }} />
                Baggage: {fd?.baggageDetails?.checkInBaggage ||
                  (fd?.baggage ? `${fd.baggage.allowance ?? ""} ${fd.baggage.unit ?? ""}`.trim() : "As per airline")}
              </span>
              <Button
                variant="link"
                size="sm"
                style={{ padding: 0, fontSize: 12 }}
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
              >
                {open ? <FaChevronUp /> : <FaChevronDown />} {open ? "Hide" : "Show"} flight details
              </Button>
            </div>
          </Col>

          {/* Right column — price + CTA */}
          <Col lg={4} md={5} className="d-flex flex-column align-items-end justify-content-between">
            <div className="text-end">
              <div className="text-muted" style={{ fontSize: 12 }}>
                Total ({totalConv.code || "AED"})
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#0d6efd" }}>
                {fmtAmount(totalConv.amount, totalConv.code)}
              </div>
              <div className="text-muted" style={{ fontSize: 11 }}>
                tax {fmtAmount(taxConv.amount, taxConv.code)}
              </div>
              <Badge
                bg={rec.pricing?.refundable ? "success" : "secondary"}
                className="mt-1"
                style={{ fontSize: 11 }}
              >
                {rec.pricing?.fareType || (rec.pricing?.refundable ? "Refundable" : "Non-refundable")}
              </Badge>
            </div>
            <Button
              variant="primary"
              className="mt-3"
              style={{ minWidth: 140 }}
              onClick={() => onSelect?.(rec)}
            >
              View Fares
            </Button>
          </Col>
        </Row>

        {/* Expandable segment breakdown */}
        <Collapse in={open}>
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid #f1f3f5" }}>
            {legs.map((leg, i) => (
              <div key={i} className="mb-3">
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  Leg {leg.legIndex || i + 1}: {leg.from} → {leg.to}
                  <span className="text-muted ms-2" style={{ fontSize: 12 }}>
                    {legDuration(leg)}
                  </span>
                </div>
                {leg.segments?.map((s, j) => (
                  <div
                    key={j}
                    style={{ padding: 8, background: "#f8f9fa", borderRadius: 6, marginBottom: 6, fontSize: 13 }}
                  >
                    <Row className="g-2 align-items-center">
                      <Col md={3}>
                        <FaPlaneDeparture className="text-muted" style={{ marginRight: 6 }} />
                        <strong>{s.departureAirportCode}</strong> {fmtTime(s.departureDateTime)}
                        <div className="text-muted" style={{ fontSize: 11 }}>
                          {fmtDate(s.departureDateTime)} {s.departureTerminal ? `· T${s.departureTerminal}` : ""}
                        </div>
                      </Col>
                      <Col md={2} className="text-center">
                        <FaClock style={{ opacity: 0.6, marginRight: 4 }} />
                        <span className="text-muted" style={{ fontSize: 12 }}>
                          {durationBetween(s.departureDateTime, s.arrivalDateTime)}
                        </span>
                      </Col>
                      <Col md={3}>
                        <FaPlaneArrival className="text-muted" style={{ marginRight: 6 }} />
                        <strong>{s.arrivalAirportCode}</strong> {fmtTime(s.arrivalDateTime)}
                        <div className="text-muted" style={{ fontSize: 11 }}>
                          {fmtDate(s.arrivalDateTime)} {s.arrivalTerminal ? `· T${s.arrivalTerminal}` : ""}
                        </div>
                      </Col>
                      <Col md={4}>
                        <span style={{ fontSize: 12 }}>
                          <strong>{s.marketingCarrier}{s.flightNumber}</strong>
                          {s.aircraft ? ` · ${s.aircraft}` : ""}
                          {s.cabin ? ` · ${cabinLabel(s.cabin)}` : ""}
                          {s.bookingClass ? ` (${s.bookingClass})` : ""}
                        </span>
                        {s.airLineName && (
                          <div className="text-muted" style={{ fontSize: 11 }}>{s.airLineName}</div>
                        )}
                      </Col>
                    </Row>
                  </div>
                ))}
              </div>
            ))}

            {/* Fare details */}
            <div className="pt-2" style={{ borderTop: "1px solid #f1f3f5" }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                <FaInfoCircle style={{ marginRight: 6 }} /> Fare & baggage
              </div>
              {rec.passengers?.map((p, i) => {
                const baseConv = conv(p.fareDetails?.totalFare, p.fareDetails?.currency);
                const paxTaxConv = conv(p.fareDetails?.totalTax, p.fareDetails?.currency);
                return (
                  <Row key={i} className="g-2" style={{ fontSize: 13 }}>
                    <Col md={3}>
                      <strong>{p.type}</strong> × {p.count}
                    </Col>
                    <Col md={3}>
                      Base: {fmtAmount(baseConv.amount, baseConv.code)}
                    </Col>
                    <Col md={3}>
                      Tax: {fmtAmount(paxTaxConv.amount, paxTaxConv.code)}
                    </Col>
                    <Col md={3}>
                      {p.fareDetails?.baggage
                        ? `${p.fareDetails.baggage.allowance ?? ""} ${p.fareDetails.baggage.unit ?? ""}`.trim()
                        : "As per airline"}
                    </Col>
                  </Row>
                );
              })}
            </div>
          </div>
        </Collapse>
      </Card.Body>
    </Card>
  );
};

/* ─── Panel wrapper: handles loading / error / empty / results states ─── */
const FlightResults = ({ loading, error, searched, results, onSelect }) => {
  const rows = useMemo(() => (Array.isArray(results) ? results : []), [results]);

  // draftFilters = what the sidebar controls currently show; appliedFilters =
  // what actually filters/sorts `rows` below. They only sync when the user
  // clicks "Apply Filters" (or "Reset") — adjusting a control alone must not
  // change the displayed results, per requirement.
  const [draftFilters, setDraftFilters] = useState(emptyFilters());
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters());
  const [currencyOptions, setCurrencyOptions] = useState([]);

  // Currency list mirrors /new-booking/hotel's master_currency lookup
  // (currencyCode + value = multiplier). Loaded once; independent of search.
  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get("/api/currency?page=0")
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setCurrencyOptions(
          list
            .filter((c) => c && c.currencyCode)
            .map((c) => ({ code: c.currencyCode, rate: Number(c.value) })),
        );
      })
      .catch(() => {
        if (!cancelled) setCurrencyOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A fresh search should not carry over the previous search's filter
  // selections.
  useEffect(() => {
    setDraftFilters(emptyFilters());
    setAppliedFilters(emptyFilters());
  }, [results]);

  // Airline checklist is derived from the full (unfiltered) result set so
  // unchecking an airline doesn't make its own checkbox disappear.
  const airlineOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const code = carrierOf(r);
      if (code && !map.has(code)) map.set(code, airlineNameOf(r));
    });
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // Display-only currency conversion — mirrors HotelSearch's convertFromAed,
  // generalised to whichever currency a row's pricing actually came back in
  // (rather than hardcoding AED), since it never alters the search payload.
  const convert = (amount, nativeCode) => {
    if (amount == null || !appliedFilters.currency) return { amount, code: nativeCode };
    const nativeOpt = currencyOptions.find((o) => o.code === nativeCode);
    const nativeRate = nativeOpt && Number.isFinite(nativeOpt.rate) && nativeOpt.rate > 0 ? nativeOpt.rate : 1;
    const targetRate = Number.isFinite(appliedFilters.currency.rate) ? appliedFilters.currency.rate : nativeRate;
    return { amount: Number(amount) * (targetRate / nativeRate), code: appliedFilters.currency.code };
  };

  const visibleRows = useMemo(() => {
    let list = rows.slice();

    if (appliedFilters.stops.length) {
      list = list.filter((r) => {
        const s = maxStopsOf(r);
        const bucket = s === 0 ? "0" : s === 1 ? "1" : "2";
        return appliedFilters.stops.includes(bucket);
      });
    }

    if (appliedFilters.refundType.length) {
      list = list.filter((r) => {
        const key = r.pricing?.refundable ? "refundable" : "nonrefundable";
        return appliedFilters.refundType.includes(key);
      });
    }

    if (appliedFilters.airlines.length) {
      list = list.filter((r) => appliedFilters.airlines.includes(carrierOf(r)));
    }

    if (appliedFilters.priceSort === "lowToHigh") {
      list.sort((a, b) => priceOf(a) - priceOf(b));
    } else if (appliedFilters.priceSort === "highToLow") {
      list.sort((a, b) => priceOf(b) - priceOf(a));
    }

    return list;
  }, [rows, appliedFilters]);

  const toggleDraft = (key, value) => {
    setDraftFilters((f) => {
      const set = f[key].includes(value)
        ? f[key].filter((v) => v !== value)
        : [...f[key], value];
      return { ...f, [key]: set };
    });
  };

  const resetFilters = () => {
    setDraftFilters(emptyFilters());
    setAppliedFilters(emptyFilters());
  };

  if (loading) {
    return (
      <div className="text-center p-5">
        <Spinner animation="border" variant="primary" />
        <div className="text-muted mt-3">Searching Amadeus for the best fares…</div>
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="danger" className="mt-3">
        <strong>Search failed.</strong> {error}
      </Alert>
    );
  }
  if (!searched) return null;
  if (rows.length === 0) {
    return (
      <Card className="mt-3">
        <Card.Body className="text-center py-5">
          <FaSearch style={{ fontSize: 34, opacity: 0.35 }} />
          <div className="mt-3" style={{ fontWeight: 600 }}>No flights found</div>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Try a different date, cabin class, or route.
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className="mt-3">
      <Row className="g-4">
        {/* Left filter sidebar — mirrors /new-booking/hotel's filtersection
            Card styling. Hidden below lg, matching the hotel page's own
            sidebar behaviour on small screens. */}
        <Col lg={3} className="d-none d-lg-block">
          <Card className="shadow-sm rounded-xl filtersection">
            <Card.Body className="p-2">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-semibold">Filters</span>
                <span
                  role="button"
                  className="text-primary small"
                  style={{ cursor: "pointer", fontWeight: 500 }}
                  onClick={resetFilters}
                >
                  Reset
                </span>
              </div>

              <Form.Group className="mb-2">
                <Form.Label className="fw-semibold small">Change Currency</Form.Label>
                <Form.Select
                  size="sm"
                  value={draftFilters.currency?.code || ""}
                  onChange={(e) => {
                    const opt = currencyOptions.find((o) => o.code === e.target.value) || null;
                    setDraftFilters((f) => ({ ...f, currency: opt }));
                  }}
                >
                  <option value="">Native (as returned)</option>
                  {currencyOptions.map((o) => (
                    <option key={o.code} value={o.code}>{o.code}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <hr />

              <Form.Group className="mb-2">
                <Form.Label className="fw-semibold small">Price Sort</Form.Label>
                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    className={`sort-pill ${draftFilters.priceSort === "lowToHigh" ? "active" : ""}`}
                    onClick={() =>
                      setDraftFilters((f) => ({
                        ...f,
                        priceSort: f.priceSort === "lowToHigh" ? "" : "lowToHigh",
                      }))
                    }
                  >
                    Lowest Price
                  </Button>
                  <Button
                    size="sm"
                    className={`sort-pill ${draftFilters.priceSort === "highToLow" ? "active" : ""}`}
                    onClick={() =>
                      setDraftFilters((f) => ({
                        ...f,
                        priceSort: f.priceSort === "highToLow" ? "" : "highToLow",
                      }))
                    }
                  >
                    Highest Price
                  </Button>
                </div>
              </Form.Group>

              <hr />

              <Form.Group className="mb-2">
                <Form.Label className="fw-semibold small">Preferred Flights</Form.Label>
                <div className="filter-checkbox-list">
                  {STOP_OPTIONS.map((item) => (
                    <Form.Check
                      key={item.value}
                      type="checkbox"
                      id={`stops-${item.value}`}
                      label={item.label}
                      checked={draftFilters.stops.includes(item.value)}
                      onChange={() => toggleDraft("stops", item.value)}
                    />
                  ))}
                </div>
              </Form.Group>

              <hr />

              <Form.Group className="mb-2">
                <Form.Label className="fw-semibold small">Refund Type</Form.Label>
                <div className="filter-checkbox-list">
                  {REFUND_OPTIONS.map((item) => (
                    <Form.Check
                      key={item.value}
                      type="checkbox"
                      id={`refund-${item.value}`}
                      label={item.label}
                      checked={draftFilters.refundType.includes(item.value)}
                      onChange={() => toggleDraft("refundType", item.value)}
                    />
                  ))}
                </div>
              </Form.Group>

              {airlineOptions.length > 0 && (
                <>
                  <hr />
                  <Form.Group className="mb-2">
                    <Form.Label className="fw-semibold small">Airline</Form.Label>
                    <div className="filter-checkbox-list">
                      {airlineOptions.map((item) => (
                        <Form.Check
                          key={item.code}
                          type="checkbox"
                          id={`airline-${item.code}`}
                          label={item.name !== item.code ? `${item.name} (${item.code})` : item.code}
                          checked={draftFilters.airlines.includes(item.code)}
                          onChange={() => toggleDraft("airlines", item.code)}
                        />
                      ))}
                    </div>
                  </Form.Group>
                </>
              )}

              <Button
                variant="primary"
                className="w-100 mt-2"
                onClick={() => setAppliedFilters(draftFilters)}
              >
                Apply Filters
              </Button>
            </Card.Body>
          </Card>
        </Col>

        {/* Results */}
        <Col lg={9}>
          <div className="mb-2 d-flex justify-content-between align-items-center">
            <div>
              <strong>{visibleRows.length}</strong> flight{visibleRows.length !== 1 ? "s" : ""} found
              {visibleRows.length !== rows.length && (
                <span className="text-muted small ms-1">(filtered from {rows.length})</span>
              )}
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              Prices shown include markup and taxes
            </div>
          </div>
          {visibleRows.length === 0 ? (
            <Card>
              <Card.Body className="text-center py-5">
                <FaSearch style={{ fontSize: 34, opacity: 0.35 }} />
                <div className="mt-3" style={{ fontWeight: 600 }}>No flights match these filters</div>
                <div className="text-muted" style={{ fontSize: 13 }}>
                  Try adjusting or resetting the filters.
                </div>
              </Card.Body>
            </Card>
          ) : (
            visibleRows.map((r) => (
              <FlightCard key={r.id ?? r.recommendationIndex} rec={r} onSelect={onSelect} convert={convert} />
            ))
          )}
        </Col>
      </Row>
    </div>
  );
};

export default FlightResults;
