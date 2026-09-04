import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  Row,
  Col,
  Button,
  Badge,
  Spinner,
  Alert,
  Modal,
} from "react-bootstrap";
import {
  FaPlaneDeparture,
  FaSearch,
  FaCheck,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaChevronDown,
  FaArrowLeft,
  FaMinus,
  FaClock,
  FaTicketAlt,
  FaUndo,
  FaChild,
  FaInfoCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import axiosInstance from "../../../components/AxiosInstance";

// Fixed localStorage key used by FlightSearch to hand off the selected
// recommendation across the new-tab boundary. Kept out of the URL so the
// link stays short. MUST match the constant of the same name in
// FlightSearch.jsx.
const FBPC_PAYLOAD_STORAGE_KEY = "fbpc:pendingPayload";

// Fixed localStorage key used to hand the priced fare + selected family
// from THIS page to FlightBookPage across a new-tab window.open(). Same
// trade-off as FBPC_PAYLOAD_STORAGE_KEY: only one "Book Now" click can
// be in flight at a time; a second click overwrites the pending payload.
// MUST match the constant of the same name in FlightBookPage.jsx.
const FBP_PAYLOAD_STORAGE_KEY = "fbp:pendingPayload";

/*
 * Flight Best Price Check page — reached from /new-booking/flight when the
 * user clicks "View Fares" on a search result card. Selected recommendation
 * flows in via React Router state (see FlightResults / FlightSearch).
 *
 * Layout mirrors the reference "Best Price Options" screen: a coloured
 * header banner, a "MORE FARE OPTIONS" info banner with the route + times,
 * then a horizontal carousel of fare family cards. Each card carries
 * Baggage / Flexibility / Seats-Meals sections plus FARE RULE + BOOK NOW
 * CTAs.
 *
 * Backend contract today: /api/amadeus/fareInformationPrice returns a
 * flat FareInformationPriceResponse (one fare family — TIPNR is a single-
 * recommendation operation). To keep the carousel N-family ready for when
 * the Best Pricing (TIBFPWQ) call lands, this page wraps the single fare
 * into a 1-element `fareFamilies` array before rendering — swapping the
 * backend to return an array requires zero UI changes.
 */

const parseIso = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmtWeekdayDate = (iso) => {
  const d = parseIso(iso);
  if (!d) return "—";
  return d.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
};

const fmtTime = (iso) => {
  const d = parseIso(iso);
  if (!d) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};

const fmtAmount = (v) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

/* ── Fare Rules modal — category grouping ──────────────────────────────
 * The backend returns a flat list of up to 26 ATPCO categories (see
 * AmadeusFareRulesResponseMapper.CATEGORY_TITLES for the full code→title
 * map). Bucketing them into a handful of labelled sections — with the
 * refund/penalty section surfaced first — makes the list scannable instead
 * of a wall of 20+ identical accordion rows. "Other Conditions" is the
 * catch-all for any code not explicitly grouped, so nothing is ever lost.
 */
const RULE_GROUPS = [
  { key: "changes", label: "Changes & Refunds", icon: FaUndo, accent: "#dc2626", codes: ["16", "18", "31", "33"] },
  { key: "stay", label: "Stay & Travel Dates", icon: FaClock, accent: "#2b5fdd", codes: ["02", "03", "06", "07", "08", "11"] },
  { key: "booking", label: "Booking & Eligibility", icon: FaTicketAlt, accent: "#7c3aed", codes: ["01", "04", "05", "09", "10", "15"] },
  { key: "discounts", label: "Discounts", icon: FaChild, accent: "#16a34a", codes: ["19", "20", "21", "22"] },
  { key: "other", label: "Other Conditions", icon: FaInfoCircle, accent: "#6b7280", codes: null }, // catch-all
];

const KEY_RULE_CODES = new Set(["16", "31", "33"]); // penalties / refunds / changes — flagged inline

function groupFareCategories(categories) {
  const groups = RULE_GROUPS.map((g) => ({ ...g, items: [] }));
  const catchAll = groups[groups.length - 1];
  (categories || []).forEach((cat) => {
    const target = groups.find((g) => g.codes && g.codes.includes(cat.code));
    (target || catchAll).items.push(cat);
  });
  return groups.filter((g) => g.items.length > 0);
}

const categoryMatchesFilter = (cat, needle) => {
  if (!needle) return true;
  const n = needle.toLowerCase();
  if ((cat.title || "").toLowerCase().includes(n)) return true;
  if ((cat.code || "").toLowerCase().includes(n)) return true;
  return (cat.lines || []).some((l) => l.toLowerCase().includes(n));
};

// Build the pricing request payload from the selected search recommendation.
// The backend needs primitive segment fields plus passenger counts —
// sending the full FlightRecommendation would just bloat the wire.
const buildPricingPayload = (rec, pax, fareCurrency) => {
  const segments = [];
  let group = 1;
  (rec?.legs || []).forEach((leg) => {
    (leg.segments || []).forEach((s) => {
      // bookingClass fallback — FMPTBQ doesn't always surface an RBD on
      // every segment. First letter of fareBasis (e.g. "QQWDE" → "Q") is
      // the accepted convention.
      const bookingClassFallback =
        s.bookingClass ||
        (s.fareBasis && s.fareBasis.length > 0 ? s.fareBasis.charAt(0) : null) ||
        null;
      segments.push({
        from: s.departureAirportCode || s.from || leg.from,
        to: s.arrivalAirportCode || s.to || leg.to,
        departureDateTime: s.departureDateTime,
        arrivalDateTime: s.arrivalDateTime,
        marketingCarrier: s.marketingCarrier,
        operatingCarrier: s.operatingCarrier || s.marketingCarrier,
        flightNumber: s.flightNumber,
        bookingClass: bookingClassFallback,
        connectionGroup: group,
      });
    });
    group += 1;
  });
  return {
    adult: Number(pax?.adult ?? 1),
    children: Number(pax?.children ?? 0),
    infant: Number(pax?.infant ?? 0),
    fareCurrency: fareCurrency || null,
    recommendationIndex:
      rec?.recommendationIndex != null ? String(rec.recommendationIndex) : null,
    segments,
  };
};

/* ─── Fare-family card — matches the reference "Best Price Options" tile ─── */
const FareFamilyCard = ({ family, selected, onSelect, onFareRule, onBookNow }) => {
  const {
    familyCode,
    price,
    netFare,
    currency,
    baggage,
    flexibility,
    seatsAndMeals,
  } = family;

  return (
    <Card
      onClick={onSelect}
      className="h-100"
      style={{
        minWidth: 260,
        maxWidth: 300,
        border: selected ? "2px solid #e11d48" : "1px solid #e5e7eb",
        borderRadius: 12,
        cursor: "pointer",
        boxShadow: selected ? "0 4px 12px rgba(225,29,72,0.15)" : "none",
        transition: "border-color 120ms ease, box-shadow 120ms ease",
      }}
    >
      <Card.Body className="d-flex flex-column p-3">
        {/* Family code pill */}
        <div>
          <span
            style={{
              background: "#f3f4f6",
              color: "#374151",
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 6,
              letterSpacing: 0.4,
            }}
          >
            {familyCode || "FARE"}
          </span>
        </div>

        {/* Price + label */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#e11d48", lineHeight: 1.1 }}>
            {currency || "AED"} {fmtAmount(price)}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Total Price</div>
          {/* Raw Amadeus fare-informative price (pre-markup) — shown as a
              secondary reference figure alongside the sell price above. */}
          {netFare != null && netFare !== price && (
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
              Net Fare: {currency || "AED"} {fmtAmount(netFare)}
            </div>
          )}
        </div>

        <hr style={{ margin: "14px 0 10px" }} />

        {/* Baggage */}
        <div>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 0.5 }}>
            BAGGAGE
          </div>
          <div className="mt-1" style={{ fontSize: 13 }}>
            <IconLine ok label={baggage?.cabin || "7 Kgs Cabin Baggage"} />
            <IconLine
              ok={Boolean(baggage?.checkinIncluded)}
              label={baggage?.checkin || "No check-in baggage included"}
            />
          </div>
        </div>

        {/* Flexibility */}
        <div className="mt-3">
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 0.5 }}>
            FLEXIBILITY
          </div>
          <div className="mt-1" style={{ fontSize: 13 }}>
            <IconLine
              ok={flexibility?.refundable === true}
              label={flexibility?.cancellation || "Non-refundable"}
            />
            <IconLine
              ok={flexibility?.dateChangeAllowed === true}
              label={flexibility?.dateChange || "Date change not permitted"}
            />
          </div>
        </div>

        {/* Seats, Meals & More */}
        <div className="mt-3">
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 0.5 }}>
            SEATS, MEALS &amp; MORE
          </div>
          <div className="mt-1" style={{ fontSize: 13 }}>
            <IconLine neutral label={seatsAndMeals?.seats || "Chargeable Seats"} />
            <IconLine
              ok={false}
              label={seatsAndMeals?.meals || "Meal as per airline policy"}
            />
          </div>
        </div>

        {/* CTAs */}
        <div className="d-flex gap-2 mt-auto pt-3">
          <Button
            variant="outline-primary"
            size="sm"
            style={{ flex: 1, fontWeight: 600, textTransform: "uppercase" }}
            onClick={(e) => {
              e.stopPropagation();
              onFareRule?.(family);
            }}
          >
            Fare Rule
          </Button>
          <Button
            size="sm"
            style={{
              flex: 1,
              background: "#e11d48",
              border: "none",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onBookNow?.(family);
            }}
          >
            Book Now
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

/* Line item with a leading tick / cross / dash — matches the reference. */
const IconLine = ({ ok, neutral, label }) => {
  let icon;
  if (neutral) icon = <FaMinus style={{ color: "#f59e0b", marginRight: 6 }} />;
  else if (ok) icon = <FaCheck style={{ color: "#16a34a", marginRight: 6 }} />;
  else icon = <FaTimes style={{ color: "#dc2626", marginRight: 6 }} />;
  return (
    <div style={{ display: "flex", alignItems: "center", marginTop: 2 }}>
      {icon}
      <span style={{ color: "#111827" }}>{label}</span>
    </div>
  );
};

const FlightBestPriceCheck = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get("agentId") || "";

  // "View Fares" opens this page in a new tab (see FlightSearch.jsx), so
  // the selected recommendation can't travel via React Router's in-memory
  // navigation state — a fresh tab has no access to it. It's stashed in
  // localStorage under a fixed key (FBPC_PAYLOAD_STORAGE_KEY) so the URL
  // stays clean (agentId only, no dataKey query param).
  //
  // location.state is still checked first for any caller that stays in
  // the same tab. useMemo is read-only so it survives React 18's
  // double-invoke in dev; the effect below removes the entry once after
  // mount so the payload doesn't leak to a subsequent unrelated visit.
  const storedPayload = useMemo(() => {
    try {
      const raw = localStorage.getItem(FBPC_PAYLOAD_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem(FBPC_PAYLOAD_STORAGE_KEY);
    } catch (e) {
      /* ignore — nothing to clean up if storage is unavailable */
    }
  }, []);

  const rec = location.state?.rec || storedPayload?.rec || null;
  const pax = location.state?.pax || storedPayload?.pax || { adult: 1, children: 0, infant: 0 };
  const fareCurrency = location.state?.fareCurrency || storedPayload?.fareCurrency || null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fare, setFare] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState(null);
  const [rulesData, setRulesData] = useState(null);
  // Fare Rules modal — free-text search across category titles/codes/lines,
  // and which category rows are expanded. Re-seeded whenever fresh rules
  // data arrives (see effect below).
  const [ruleFilter, setRuleFilter] = useState("");
  const [expandedRuleCodes, setExpandedRuleCodes] = useState(() => new Set());
  const [selectedIdx, setSelectedIdx] = useState(0);
  const scrollerRef = useRef(null);

  // Default-open the highest-priority category (penalties/refunds/changes)
  // so the thing a customer cares about most is visible without a click;
  // falls back to the first category when none of those are present.
  useEffect(() => {
    const cats = rulesData?.categories;
    if (!cats || cats.length === 0) {
      setExpandedRuleCodes(new Set());
      return;
    }
    const priority = cats.find((c) => KEY_RULE_CODES.has(c.code)) || cats[0];
    setExpandedRuleCodes(new Set(priority ? [priority.code] : []));
  }, [rulesData]);

  const toggleRuleCategory = (code) => {
    setExpandedRuleCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const closeRulesModal = () => {
    setShowRules(false);
    setRuleFilter("");
  };

  useEffect(() => {
    if (!rec) {
      setError("No flight selected — please pick a flight from the search results first.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    const payload = buildPricingPayload(rec, pax, fareCurrency);
    // Override AxiosInstance's global 30s timeout — TIPNR re-pricing is
    // usually fast (1-2s), but under load it's a real Amadeus SOAP call
    // like search, so it gets the same generous ceiling.
    axiosInstance
      .post("/api/amadeus/fareInformationPrice", payload, { timeout: 90000 })
      .then((res) => {
        if (cancelled) return;
        const priced = res.data || null;
        setFare(priced);

        // Eagerly fetch fare rules NOW while the Amadeus session is still
        // fresh. Amadeus test/prod sessions can time out in <60s, so waiting
        // for the user to click "Fare Rule" often means the session is
        // already dead by then (surfaces as "12|Presentation|soap message
        // header incorrect"). Prefetching once, right after pricing, is
        // reliable and lets the modal render instantly on click.
        const token = priced?.sessionToken;
        if (!token) return;
        setRulesLoading(true);
        setRulesError(null);
        axiosInstance
          .post(
            "/api/amadeus/fareCheckRules",
            {
              sessionToken: token,
              fareReference: 1,
              fareBasis: priced.fareFamily || null,
            },
            { timeout: 90000 },
          )
          .then((r) => {
            if (cancelled) return;
            setRulesData(r.data || null);
            // Session was used — clear token locally so nothing tries to
            // reuse it. Rules data lives in state and is instant to show.
            setFare((prev) => (prev ? { ...prev, sessionToken: null } : prev));
          })
          .catch((err) => {
            if (cancelled) return;
            const msg =
              err?.response?.data?.message ||
              err?.response?.data?.error ||
              err?.message ||
              "Failed to fetch fare rules.";
            setRulesError(msg);
          })
          .finally(() => {
            if (!cancelled) setRulesLoading(false);
          });
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to fetch fare details.";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rec, pax, fareCurrency]);

  // Route header — first-leg board point → last-leg off point plus the
  // marketing carrier + concatenated flight numbers (e.g. "DE 4214" or
  // "VF 12 -> VF 143" for a multi-segment trip).
  const route = useMemo(() => {
    if (!rec?.legs?.length) return null;
    const flatSegs = rec.legs.flatMap((l) => l.segments || []);
    if (flatSegs.length === 0) return null;
    const first = flatSegs[0];
    const last = flatSegs[flatSegs.length - 1];
    const carrier = first?.marketingCarrier || rec?.validatingCarrier || "";
    const flightPath = flatSegs
      .map((s) => `${s.marketingCarrier || carrier} ${s.flightNumber || ""}`.trim())
      .join(" -> ");
    return {
      fromCode: first?.departureAirportCode || first?.from,
      toCode: last?.arrivalAirportCode || last?.to,
      departure: first?.departureDateTime,
      arrival: last?.arrivalDateTime,
      airlineName: first?.airLineName,
      flightPath,
    };
  }, [rec]);

  // Fare families to render in the carousel. The backend currently returns
  // a single fare, so we wrap it into a one-element list. When TIBFPWQ
  // support lands and the response starts returning `fareFamilies[]`, this
  // memo just reads that array directly — no other UI change needed.
  //
  // Currency shown here MUST match what the search results page showed for
  // the same recommendation — the agent picked a flight labelled "AED N"
  // there, so displaying "EUR N" here would look like a bait-and-switch.
  // We pass `fareCurrency` (captured from rec.pricing.currency at search
  // time) as the display currency; normaliseFamily prefers it over the
  // TIPNR-returned currency so the label carries through consistently.
  const families = useMemo(() => {
    if (!fare) return [];
    const displayCurrency = fareCurrency || fare.currency;
    // Future shape: fare.fareFamilies is an array. Prefer it when present.
    if (Array.isArray(fare.fareFamilies) && fare.fareFamilies.length > 0) {
      return fare.fareFamilies.map((f) => normaliseFamily(f, displayCurrency));
    }
    return [normaliseFamily(fare, displayCurrency)];
  }, [fare, fareCurrency]);

  // Rules are pre-fetched at page load (see the pricing useEffect) while
  // the Amadeus session is still alive — this button just opens the modal
  // over the cached data, so it's instant and can't race the session TTL.
  const handleFareRule = () => setShowRules(true);

  const handleBookNow = (family) => {
    // Open the booking page in a NEW tab so the agent can keep the fare
    // comparison tab open for reference. window.open drops React Router
    // state across the tab boundary, so we stash the full booking payload
    // in localStorage under a fixed key (FBP_PAYLOAD_STORAGE_KEY) — the
    // destination reads it once on mount, removes it, and the URL stays
    // short (agentId query only, no dataKey).
    const payload = { rec, pax, fare, fareCurrency, selectedFamily: family, agentId };
    try {
      localStorage.setItem(FBP_PAYLOAD_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      toast.error("Could not open booking page — please try again.");
      return;
    }
    const params = new URLSearchParams();
    if (agentId) params.set("agentId", agentId);
    const qs = params.toString();
    window.open(
      `/new-booking/flightBookPage${qs ? `?${qs}` : ""}`,
      "_blank",
    );
  };

  const scrollBy = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  return (
    <div>
      <TopBar />
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: "24px", background: "#f7f8fa" }}>
          {/* Header banner — red gradient to stay consistent with the
              project's brand palette (TopBar / Globosoft header colour). */}
          <Card
            className="mb-3 border-0"
            style={{
              background: "linear-gradient(135deg, #e11d48 0%, #b91c1c 100%)",
              color: "#fff",
              borderRadius: 12,
            }}
          >
            <Card.Body className="d-flex align-items-center gap-3">
              <Button
                variant="light"
                size="sm"
                onClick={() =>
                  // Explicit route beats navigate(-1) — the latter breaks on
                  // cold reloads and bookmark visits where there's no prior
                  // history entry to pop to. agentId is preserved so the
                  // search page reopens in the same agent context.
                  navigate(
                    `/new-booking/flight${agentId ? `?agentId=${encodeURIComponent(agentId)}` : ""}`,
                  )
                }
                style={{ fontWeight: 600 }}
              >
                <FaArrowLeft style={{ marginRight: 6 }} />
                Back
              </Button>
              <div className="d-flex align-items-center">
                <div
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                  }}
                >
                  <FaSearch />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>Best Price Options</div>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    Compare and select the best pricing option for your flight
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Route / flight-path info banner. */}
          {route && (
            <Card className="mb-3 shadow-sm">
              <Card.Body>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                  <FaPlaneDeparture style={{ color: "#2b5fdd", marginRight: 8 }} />
                  MORE FARE OPTIONS available for your trip.
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>
                  {route.fromCode} → {route.toCode}
                  {route.flightPath ? (
                    <span className="text-muted ms-2" style={{ fontWeight: 500 }}>
                      {route.flightPath}
                    </span>
                  ) : null}
                </div>
                <div className="text-muted mt-1" style={{ fontSize: 13 }}>
                  {fmtWeekdayDate(route.departure)} • Departure at {fmtTime(route.departure)} - Arrival at {fmtTime(route.arrival)}
                  {route.airlineName ? (
                    <span className="ms-2">• {route.airlineName}</span>
                  ) : null}
                </div>
              </Card.Body>
            </Card>
          )}

          {loading && (
            <Card className="text-center p-5">
              <Spinner animation="border" variant="primary" className="mx-auto" />
              <div className="text-muted mt-3">Fetching best price from Amadeus…</div>
            </Card>
          )}

          {!loading && error && (
            <Alert variant="danger">
              <strong>Failed to load fare details.</strong> {error}
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline-danger"
                  onClick={() => navigate("/new-booking/flight")}
                >
                  Back to search
                </Button>
              </div>
            </Alert>
          )}

          {!loading && !error && families.length > 0 && (
            <div style={{ position: "relative" }}>
              {/* Prev arrow — only useful when families overflow the row. */}
              {families.length > 3 && (
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={() => scrollBy(-1)}
                  style={arrowStyle("left")}
                >
                  <FaChevronLeft />
                </button>
              )}

              <div
                ref={scrollerRef}
                style={{
                  display: "flex",
                  gap: 16,
                  overflowX: "auto",
                  padding: "4px 8px",
                  scrollBehavior: "smooth",
                }}
              >
                {families.map((f, i) => (
                  <FareFamilyCard
                    key={i}
                    family={f}
                    selected={selectedIdx === i}
                    onSelect={() => setSelectedIdx(i)}
                    onFareRule={handleFareRule}
                    onBookNow={handleBookNow}
                  />
                ))}
              </div>

              {families.length > 3 && (
                <button
                  type="button"
                  aria-label="Next"
                  onClick={() => scrollBy(1)}
                  style={arrowStyle("right")}
                >
                  <FaChevronRight />
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Fare Rules modal — fetches Amadeus FARQNQ on open, renders each
          category as its own collapsible panel. Falls back to raw text when
          the mapper could not group categories. */}
      <Modal show={showRules} onHide={closeRulesModal} centered size="xl" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>
            Fare Rules
            {rulesData?.fareBasis ? (
              <span className="text-muted ms-2" style={{ fontSize: 14, fontWeight: 400 }}>
                · {rulesData.fareBasis}
              </span>
            ) : null}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {rulesLoading && (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <div className="text-muted mt-3">Fetching fare rules from Amadeus…</div>
            </div>
          )}

          {!rulesLoading && rulesError && (
            <>
              <Alert variant="danger" className="mb-2">
                <strong>Failed to load fare rules.</strong>
                {" "}A copy of the raw Amadeus error is below — share this
                text so it can be diagnosed.
              </Alert>
              {/* Scrollable + copyable block. Long SOAP fault bodies would
                  otherwise blow the modal out sideways and hide the tail
                  where the actual fault text lives. */}
              <pre
                style={{
                  background: "#f8f9fa",
                  border: "1px solid #e5e7eb",
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 300,
                  overflow: "auto",
                  marginBottom: 8,
                }}
              >
                {rulesError}
              </pre>
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(rulesError);
                    toast.success("Error copied to clipboard");
                  } catch {
                    /* fall through — the block is already selectable */
                  }
                }}
              >
                Copy error text
              </Button>
            </>
          )}

          {!rulesLoading && !rulesError && rulesData && (
            <>
              {rulesData.sessionContinued === false && (
                <Alert variant="warning" style={{ fontSize: 13 }}>
                  Amadeus session was not continued from the pricing call —
                  results may be incomplete. Re-run the fare price check if
                  the rules below look truncated.
                </Alert>
              )}

              {rulesData.categories && rulesData.categories.length > 0 ? (
                <>
                  {/* Search box — only worth the screen space once there's
                      enough to search through. */}
                  {rulesData.categories.length > 3 && (
                    <div className="mb-3" style={{ position: "relative" }}>
                      <FaSearch
                        style={{
                          position: "absolute",
                          left: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#9ca3af",
                          fontSize: 13,
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Search rules — e.g. refund, penalty, baggage…"
                        value={ruleFilter}
                        onChange={(e) => setRuleFilter(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px 10px 34px",
                          borderRadius: 8,
                          border: "1px solid #d1d5db",
                          fontSize: 13.5,
                          outline: "none",
                        }}
                      />
                    </div>
                  )}

                  {(() => {
                    const groups = groupFareCategories(rulesData.categories)
                      .map((g) => ({
                        ...g,
                        items: g.items.filter((c) => categoryMatchesFilter(c, ruleFilter)),
                      }))
                      .filter((g) => g.items.length > 0);

                    if (groups.length === 0) {
                      return (
                        <div className="text-center text-muted py-4" style={{ fontSize: 13 }}>
                          No rules match "{ruleFilter}".
                        </div>
                      );
                    }

                    return groups.map((group) => {
                      const GroupIcon = group.icon;
                      return (
                        <div key={group.key} className="mb-3">
                          <div
                            className="d-flex align-items-center mb-2"
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: group.accent,
                              letterSpacing: 0.4,
                              textTransform: "uppercase",
                            }}
                          >
                            <GroupIcon style={{ marginRight: 6 }} />
                            {group.label}
                          </div>
                          <div
                            style={{
                              border: "1px solid #eef1f5",
                              borderRadius: 10,
                              overflow: "hidden",
                            }}
                          >
                            {group.items.map((cat, i) => {
                              const isOpen = expandedRuleCodes.has(cat.code);
                              const isKeyRule = KEY_RULE_CODES.has(cat.code);
                              return (
                                <div
                                  key={cat.code || i}
                                  style={{ borderTop: i === 0 ? "none" : "1px solid #f1f3f5" }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleRuleCategory(cat.code)}
                                    className="d-flex align-items-center justify-content-between w-100"
                                    style={{
                                      background: isOpen ? "#f8f9fb" : "#fff",
                                      border: "none",
                                      padding: "12px 14px",
                                      textAlign: "left",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <span className="d-flex align-items-center" style={{ gap: 8 }}>
                                      <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>
                                        {cat.title || `Category ${cat.code || "?"}`}
                                      </span>
                                      {isKeyRule && (
                                        <FaExclamationTriangle
                                          title="Key rule — read before booking"
                                          style={{ color: "#dc2626", fontSize: 12 }}
                                        />
                                      )}
                                    </span>
                                    <span className="d-flex align-items-center" style={{ gap: 10 }}>
                                      <Badge bg="light" text="dark" style={{ fontWeight: 500, fontSize: 11 }}>
                                        {cat.code || "??"}
                                      </Badge>
                                      <FaChevronDown
                                        style={{
                                          fontSize: 11,
                                          color: "#9ca3af",
                                          transition: "transform 150ms ease",
                                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                                        }}
                                      />
                                    </span>
                                  </button>
                                  {isOpen && (
                                    <div style={{ padding: "0 14px 14px 14px" }}>
                                      {cat.lines && cat.lines.length > 0 ? (
                                        <ul
                                          className="mb-0"
                                          style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 18, color: "#374151" }}
                                        >
                                          {cat.lines.map((l, j) => (
                                            <li key={j}>{l}</li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <div className="text-muted small">
                                          No text returned for this category.
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </>
              ) : rulesData.rawText ? (
                <>
                  <Alert variant="info" style={{ fontSize: 13 }}>
                    Amadeus returned rule text that could not be grouped into
                    ATPCO categories — showing it verbatim below.
                  </Alert>
                  <pre
                    style={{
                      background: "#f8f9fa",
                      padding: 12,
                      borderRadius: 6,
                      fontSize: 12,
                      whiteSpace: "pre-wrap",
                      maxHeight: 400,
                      overflow: "auto",
                      marginBottom: 0,
                    }}
                  >
                    {rulesData.rawText}
                  </pre>
                </>
              ) : (
                <Alert variant="info" className="mb-0" style={{ fontSize: 13 }}>
                  {rulesData.notice ||
                    "Amadeus returned no rule text for this fare. This is typical for airline-negotiated or private fares where rule details are not published via the standard Fare_CheckRules payload. Contact the airline directly or consult the fare's contract terms for the applicable rules."}
                </Alert>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeRulesModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

/**
 * Turn a backend fare-family record (either the current flat
 * FareInformationPriceResponse or a future fareFamilies[] entry) into the
 * shape the card expects. Centralised so both branches of the `families`
 * memo produce identical objects.
 */
function normaliseFamily(f, currencyFallback) {
  const cancellationRaw = f.flexibility?.cancellation || f.fareType || "";
  const dateChangeRaw = f.flexibility?.dateChange || "";
  return {
    familyCode: f.fareFamily || f.familyCode || "FARE",
    // Sell price (what the customer pays) — matches the search-results
    // list, which shows totalRateWithMarkup as the headline price. Falls
    // back to the raw totalFare only if the backend didn't compute markup
    // (e.g. an older cached response).
    price: f.totalRateWithMarkup ?? f.totalFare ?? f.totalRate ?? null,
    // Raw Amadeus fare-informative price, pre-markup — shown alongside the
    // sell price so the agent can see both figures on this page.
    netFare: f.totalFare ?? null,
    // Prefer the caller-provided currency (the search page's display
    // currency for this recommendation) over the TIPNR-returned fare
    // currency, so the label stays consistent with what the agent picked.
    currency: currencyFallback || f.currency || "AED",
    baggage: {
      cabin: f.baggageDetails?.cabinBaggage || "7 Kgs Cabin Baggage",
      checkin: f.baggageDetails?.checkinBaggage || "No check-in baggage included",
      checkinIncluded: Boolean(f.baggageDetails?.checkinBaggage),
    },
    flexibility: {
      cancellation: cancellationRaw || "Non-refundable",
      dateChange: dateChangeRaw || "Date change not permitted",
      // We keep the boolean flags in sync with the human strings so the
      // tick/cross icons render correctly even when the backend enriches
      // the shape later with structured booleans.
      refundable: /refundable/i.test(cancellationRaw) && !/non-?refundable/i.test(cancellationRaw),
      dateChangeAllowed: /permitted|allowed|free/i.test(dateChangeRaw),
    },
    seatsAndMeals: {
      seats: f.seatsAndMeals?.seats || "Chargeable Seats",
      meals: f.seatsAndMeals?.meals || "Meal as per airline policy",
    },
  };
}

/** Floating circular carousel arrow. Only rendered when we overflow. */
function arrowStyle(side) {
  return {
    position: "absolute",
    top: "50%",
    [side]: -18,
    transform: "translateY(-50%)",
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: "1px solid #2b5fdd",
    background: "#fff",
    color: "#2b5fdd",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    zIndex: 2,
  };
}

export default FlightBestPriceCheck;
