import React, { useState, useRef, useEffect } from "react";
import { Card, Row, Col, Form, Button, Spinner, Badge } from "react-bootstrap";
import { FaCar, FaSearch, FaClock, FaRoad, FaUsers } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import Select from "react-select";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import AgentBalanceDisplay from "../../../components/AgentBalanceDisplay";
import AdvertisementCarousel from "../../../components/AdvertisementCarousel";
import AgentCreditBalance from "../../../components/AgentCreditBalance";

function LazyImage({ src, alt, className }) {
  const containerRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        });
      });
      observer.observe(el);
      return () => observer.disconnect();
    } else {
      setInView(true);
    }
  }, []);

  const imageSrc = src || "https://via.placeholder.com/480x270?text=Chauffeur";

  return (
    <div
      ref={containerRef}
      className={`ratio ratio-16x9 rounded-top overflow-hidden ${className || ""}`}
      style={{ height: "100%", width: "100%", position: "relative" }}
    >
      {!loaded && (
        <div
          className="skeleton w-100 h-100"
          style={{ backgroundColor: "#e0e0e0", position: "absolute", inset: 0 }}
        />
      )}
      {inView && (
        <img
          src={imageSrc}
          loading="lazy"
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            e.currentTarget.src = "https://via.placeholder.com/480x270?text=Chauffeur";
          }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.3s ease-in-out",
          }}
        />
      )}
    </div>
  );
}

/**
 * Chauffeur-rental search. Replaces the old transfer-style
 * origin/destination/oneway/roundtrip screen with a time-and-distance based
 * rental search: City + Pickup Date/Time + Rental Package + Cab Type +
 * Nationality + Agent + Passengers. Talks to /api/scheffer-rental-search.
 */
export const SchefferDriverSearch = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const activeRole = (localStorage.getItem("currentActiveRole") || "").trim().toUpperCase();
  const storedRoles = (localStorage.getItem("userRole") || "").toUpperCase();
  const isAgentRole = activeRole
    ? activeRole === "AGENT"
    : storedRoles.includes("AGENT") && !storedRoles.includes("ADMIN");

  const prior = location.state || {};

  // ---- form state ----
  const [city, setCity] = useState(prior.city || null);
  const [pickupDate, setPickupDate] = useState(prior.pickupDate || "");
  const [pickupTime, setPickupTime] = useState(prior.pickupTime || "");
  const [hoursFilter, setHoursFilter] = useState(prior.hoursFilter || "");
  const [pickup, setPickup] = useState(prior.pickup || null);
  const [dropoff, setDropoff] = useState(prior.dropoff || null);
  const [adults, setAdults] = useState(prior.adults || 1);
  const [children, setChildren] = useState(prior.children || 0);
  const [childAges, setChildAges] = useState(prior.childAges || []);
  const [nationality, setNationality] = useState(prior.nationality || null);
  const [agent, setAgent] = useState("");

  // ---- lookups ----
  const [cityOptions, setCityOptions] = useState([]);
  const [nationalityList, setNationalityList] = useState([]);
  const [locationGroups, setLocationGroups] = useState([]);  // grouped Zones/Hotels/Airports
  const [isLocLoading, setIsLocLoading] = useState(false);
  const [isNationalityLoading, setIsNationalityLoading] = useState(false);
  const [agents, setAgents] = useState([]);

  // ---- results ----
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  // When results are on screen the big search form collapses into a sticky
  // summary strip. Clicking "Modify Search" flips this true to re-expand it.
  const [isEditingSearch, setIsEditingSearch] = useState(false);

  const [validationErrors, setValidationErrors] = useState({});
  const clearError = (field) =>
    setValidationErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _omit, ...rest } = prev;
      return rest;
    });

  // ---- load lookups ----
  // Only cities are needed in the search form now — Cab Type and Package are
  // no longer search inputs; the search returns every chauffeur available in
  // the chosen city and the operator picks one from the result cards.
  const loadRentalLookup = async () => {
    try {
      const res = await axiosInstance.get("/api/scheffer-rental-search/lookup");
      const d = res.data || {};
      setCityOptions((d.cities || []).map((c) => ({ value: c.id, label: c.name })));
    } catch (e) {
      console.error("Failed to load rental lookup:", e);
    }
  };

  // Pickup / Dropoff lookup — grouped Zones / Hotels / Airports, same shape as
  // the cab transfer search. Used by both selects below.
  const buildLocOption = (item) => ({
    value: `${item.source}:${item.id}`,
    label: item.name,
    subtitle: item.subtitle || "",
    source: item.source,
    locationId: Number(item.id),
    locationName: item.name,
    code: item.code || null,
  });

  // Dedicated chauffeur-rental lookup. NOT the legacy /api/cab-search/lookup
  // (which belongs to the transfer cab flow and uses "zones" — that label
  // conflicts with the rental operators' mental model). The rental endpoint
  // groups results as "places" instead.
  const fetchLocationLookup = (q = "") => {
    setIsLocLoading(true);
    axiosInstance
      .get(`/api/scheffer-rental-search/locations?search=${encodeURIComponent(q)}&limit=20`)
      .then((res) => {
        const d = res?.data || {};
        const groups = [];
        const places = Array.isArray(d.places) ? d.places : [];
        const hotels = Array.isArray(d.hotels) ? d.hotels : [];
        const airports = Array.isArray(d.airports) ? d.airports : [];
        if (places.length) groups.push({ label: "PLACES", options: places.map(buildLocOption) });
        if (hotels.length) groups.push({ label: "HOTELS", options: hotels.map(buildLocOption) });
        if (airports.length) groups.push({ label: "AIRPORTS", options: airports.map(buildLocOption) });
        setLocationGroups(groups);
      })
      .catch(() => setLocationGroups([]))
      .finally(() => setIsLocLoading(false));
  };

  const formatLocOption = (opt) => (
    <div>
      <div className="fw-semibold">{opt.label}</div>
      {opt.subtitle && <small className="text-muted">{opt.subtitle}</small>}
    </div>
  );

  const loadAgents = async () => {
    try {
      const res = await axiosInstance.get("/api/agent?activeOnly=true");
      setAgents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load agents:", err);
      setAgents([]);
    }
  };

  function debounce(func, wait) {
    let timeout;
    return function executed(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  const debouncedCountrySearch = useRef(
    debounce(async (search) => {
      try {
        setIsNationalityLoading(true);
        const response = await axiosInstance.get(`/api/country?search=${search}`);
        const options = Array.isArray(response.data)
          ? response.data.map((country) => ({
              value: country.id,
              label: country.name,
              code: country.countryCode,
            }))
          : [];
        setNationalityList(options);
      } catch (error) {
        setNationalityList([]);
      } finally {
        setIsNationalityLoading(false);
      }
    }, 300)
  ).current;

  const loadCountries = async () => {
    try {
      setIsNationalityLoading(true);
      const response = await axiosInstance.get("/api/country?limit=50");
      const options = Array.isArray(response.data)
        ? response.data.map((c) => ({ value: c.id, label: c.name, code: c.countryCode }))
        : [];
      setNationalityList(options);
    } catch (e) {
      setNationalityList([]);
    } finally {
      setIsNationalityLoading(false);
    }
  };

  useEffect(() => {
    loadRentalLookup();
    loadAgents();
    loadCountries();
    fetchLocationLookup("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep child-age array sized to children count
  useEffect(() => {
    if (children > 0) {
      setChildAges((prev) => {
        const next = [...prev];
        while (next.length < children) next.push(5);
        if (next.length > children) next.splice(children);
        return next;
      });
    } else {
      setChildAges([]);
    }
  }, [children]);

  const handleChildAgeChange = (index, value) => {
    const next = [...childAges];
    next[index] = parseInt(value) || 0;
    setChildAges(next);
  };

  const validate = () => {
    const errs = {};
    // Only City + Date + Time are mandatory — the search returns every
    // chauffeur available in the city so the operator can browse. Cab
    // Type / Package / Hours are optional filters layered on top.
    if (!city) errs.city = "City is required.";
    if (!pickupDate) errs.pickupDate = "Pickup date is required.";
    if (!pickupTime) errs.pickupTime = "Pickup time is required.";
    if (!nationality) errs.nationality = "Nationality is required.";
    if (!isAgentRole && !agent) errs.agent = "Agent is required.";
    return errs;
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const errs = validate();
    setValidationErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setHasSearched(true);
    setIsEditingSearch(false);
    setResults([]);

    try {
      const agentId =
        (agent && String(agent)) ||
        sessionStorage.getItem("makeYourOwnPackageAgentId") ||
        localStorage.getItem("makeYourOwnPackageAgentId") ||
        null;

      const payload = {
        cityId: city?.value || null,
        cityName: city?.label || null,
        cabType: null,
        packageName: null,
        // Optional duration filter — empty means "any duration".
        hours: hoursFilter ? parseInt(hoursFilter, 10) : null,
        pickupDate: pickupDate || null,
        pickupTime: pickupTime || null,
        adults: adults || 1,
        children: children || 0,
        childAges: childAges && childAges.length ? childAges.map((a) => parseInt(a) || 0) : [],
        nationality: nationality?.label || null,
        agentId: agentId ? Number(agentId) : null,
      };

      const res = await axiosInstance.post("/api/scheffer-rental-search/search", payload);
      setResults(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Rental search failed:", err);
      toast.error("Failed to search rentals.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = (card) => {
    const price = card.basePriceWithMarkup != null ? card.basePriceWithMarkup : card.basePrice;
    const selectedOption = {
      ...card,
      // unified pricing fields the booking page reads
      totalRate: price,
      totalRateWithoutMarkup: card.basePrice,
      totalRateWithoutMrk: card.basePrice,
    };
    navigate("/scheffer-driver-booking-page", {
      state: {
        cab: {
          cabid: card.cabId,
          cabname: card.cabName,
          cabpic: card.cabPic,
          cabProviderId: card.cabProviderId,
          cabProviderName: card.cabProviderName,
        },
        selectedOption,
        searchCriteria: {
          nationality,
          cityId: card.cityId,
          cityName: card.cityName,
          pickupDate,
          pickupTime,
          adults,
          children,
          childAges,
          // Operational pickup / dropoff (place / hotel / airport) — saved
          // onto the booking record so the driver knows where to meet the
          // customer. NOT a filter for the rental search.
          pickup,
          dropoff,
          pickupType: pickup?.source || null,
          pickupName: pickup?.locationName || null,
          dropoffType: dropoff?.source || null,
          dropoffName: dropoff?.locationName || null,
        },
      },
    });
  };

  const customSelectStyles = {
    control: (base) => ({ ...base, minHeight: "46px", height: "46px", borderRadius: "0.375rem" }),
    valueContainer: (base) => ({ ...base, height: "46px", padding: "0 8px" }),
    indicatorsContainer: (base) => ({ ...base, height: "46px" }),
  };

  const money = (v) => (v == null ? "-" : `${Number(v).toLocaleString()} AED`);

  // Results are on screen once a search has run. Collapse the full form into
  // the sticky summary strip then, unless the user chose to modify the search.
  const collapseSearch = hasSearched && !isEditingSearch;

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4 hs-page">
          <Card className="shadow-sm rounded-xl mb-4 border-0">
            <Card.Body>
              <div className="mb-4 d-flex justify-content-between align-items-start flex-wrap gap-2">
                <div>
                  <h4 className="fw-bold text-primary mb-1">
                    <FaCar className="me-2" />
                    Chauffeur Driver Search
                  </h4>
                  <p className="text-muted small mb-0">
                    Book an hourly chauffeur rental — travel anywhere within the city for the package duration.
                  </p>
                </div>
                {/* Agent logins see their available credit balance at the
                    right end of the heading row (renders nothing for other
                    roles). */}
                <AgentCreditBalance />
              </div>

              {/* ── Collapsed sticky search summary strip ──
                  Shown once results are on screen. "Modify Search" re-expands
                  the full form by flipping isEditingSearch. */}
              {collapseSearch && (
                <div className="hs-summary-bar">
                  <div className="hs-summary-chips">
                    {city?.label && (
                      <span className="hs-summary-chip hs-summary-chip-main">
                        {city.label}
                      </span>
                    )}
                    {pickupDate && (
                      <span className="hs-summary-chip">{pickupDate}</span>
                    )}
                    <span className="hs-summary-chip">
                      {adults} adults
                      {children ? `, ${children} child` : ""}
                    </span>
                  </div>
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
                </div>
              )}

              {/* ── Search Card + Ads ── */}
              {!collapseSearch && (
              <div className="d-flex gap-3 align-items-start mb-4 hs-search-ads-row">
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                  <Card className="border-0 shadow-sm rounded-4 bg-white mb-4">
                <Card.Body>
                  <Form onSubmit={handleSearch}>
                    <Row className="g-3 mb-3">
                      <Col md={6}>
                        <Form.Label className="fw-semibold">
                          City / Location<span className="text-danger">*</span>
                        </Form.Label>
                        <Select
                          options={cityOptions}
                          value={city}
                          onChange={(opt) => {
                            setCity(opt);
                            if (opt) clearError("city");
                          }}
                          placeholder="Select city"
                          isSearchable
                          isClearable
                          menuPortalTarget={document.body}
                          styles={{
                            ...customSelectStyles,
                            control: (base) => ({
                              ...customSelectStyles.control(base),
                              borderColor: validationErrors.city ? "#dc3545" : base.borderColor,
                            }),
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          }}
                        />
                        {validationErrors.city && (
                          <div className="text-danger small mt-1">{validationErrors.city}</div>
                        )}
                      </Col>

                      <Col md={3}>
                        <Form.Label className="fw-semibold">
                          Hours <small className="text-muted">(optional)</small>
                        </Form.Label>
                        <Form.Select
                          style={{ height: "46px" }}
                          value={hoursFilter}
                          onChange={(e) => setHoursFilter(e.target.value)}
                        >
                          <option value="">Any</option>
                          <option value="4">4 hours</option>
                          <option value="6">6 hours</option>
                          <option value="8">8 hours</option>
                          <option value="10">10 hours</option>
                          <option value="12">12 hours</option>
                          <option value="24">24 hours</option>
                        </Form.Select>
                      </Col>
                    </Row>

                    {/* Pickup / Dropoff (operational; carried into the booking) */}
                    <Row className="g-3 mb-3">
                      <Col md={6}>
                        <Form.Label className="fw-semibold">
                          Pickup <small className="text-muted">(place / hotel / airport)</small>
                        </Form.Label>
                        <Select
                          options={locationGroups}
                          value={pickup}
                          onChange={(opt) => setPickup(opt)}
                          onInputChange={(input, { action }) => {
                            if (action !== "input-change") return;
                            clearTimeout(window.__schPickupDebounce);
                            window.__schPickupDebounce = setTimeout(
                              () => fetchLocationLookup(input || ""),
                              300
                            );
                          }}
                          filterOption={() => true}
                          formatOptionLabel={formatLocOption}
                          isLoading={isLocLoading}
                          placeholder="Search place / hotel / airport"
                          isSearchable
                          isClearable
                          menuPortalTarget={document.body}
                          styles={{
                            ...customSelectStyles,
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                            groupHeading: (base) => ({
                              ...base,
                              fontWeight: 700,
                              color: "#212529",
                              textTransform: "uppercase",
                              fontSize: "0.75rem",
                            }),
                          }}
                          noOptionsMessage={({ inputValue }) =>
                            inputValue ? "No matches" : "Type to search…"
                          }
                        />
                      </Col>
                      <Col md={6}>
                        <Form.Label className="fw-semibold">
                          Dropoff <small className="text-muted">(place / hotel / airport)</small>
                        </Form.Label>
                        <Select
                          options={locationGroups}
                          value={dropoff}
                          onChange={(opt) => setDropoff(opt)}
                          onInputChange={(input, { action }) => {
                            if (action !== "input-change") return;
                            clearTimeout(window.__schDropoffDebounce);
                            window.__schDropoffDebounce = setTimeout(
                              () => fetchLocationLookup(input || ""),
                              300
                            );
                          }}
                          filterOption={() => true}
                          formatOptionLabel={formatLocOption}
                          isLoading={isLocLoading}
                          placeholder="Search place / hotel / airport"
                          isSearchable
                          isClearable
                          menuPortalTarget={document.body}
                          styles={{
                            ...customSelectStyles,
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                            groupHeading: (base) => ({
                              ...base,
                              fontWeight: 700,
                              color: "#212529",
                              textTransform: "uppercase",
                              fontSize: "0.75rem",
                            }),
                          }}
                          noOptionsMessage={({ inputValue }) =>
                            inputValue ? "No matches" : "Type to search…"
                          }
                        />
                      </Col>
                    </Row>

                    <Row className="g-3 mb-3">
                      <Col md={3}>
                        <Form.Label className="fw-semibold">
                          Pickup Date<span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          style={{ height: "46px" }}
                          type="date"
                          value={pickupDate}
                          isInvalid={!!validationErrors.pickupDate}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(e) => {
                            setPickupDate(e.target.value);
                            if (e.target.value) clearError("pickupDate");
                          }}
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.pickupDate}
                        </Form.Control.Feedback>
                      </Col>
                      <Col md={3}>
                        <Form.Label className="fw-semibold">
                          Pickup Time<span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          style={{ height: "46px" }}
                          type="time"
                          value={pickupTime}
                          isInvalid={!!validationErrors.pickupTime}
                          onChange={(e) => {
                            setPickupTime(e.target.value);
                            if (e.target.value) clearError("pickupTime");
                          }}
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.pickupTime}
                        </Form.Control.Feedback>
                      </Col>
                      <Col md={3}>
                        <Form.Label className="fw-semibold">Adults</Form.Label>
                        <Form.Select
                          style={{ height: "46px" }}
                          value={adults}
                          onChange={(e) => setAdults(parseInt(e.target.value) || 1)}
                        >
                          {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n} Adult{n > 1 ? "s" : ""}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                      <Col md={3}>
                        <Form.Label className="fw-semibold">Children</Form.Label>
                        <Form.Select
                          style={{ height: "46px" }}
                          value={children}
                          onChange={(e) => setChildren(parseInt(e.target.value) || 0)}
                        >
                          {Array.from({ length: 6 }, (_, i) => i).map((n) => (
                            <option key={n} value={n}>
                              {n} Child{n !== 1 ? "ren" : ""}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Row>

                    <Row className="g-3 mb-3">
                      <Col md={4}>
                        <Form.Label className="fw-semibold">
                          Nationality<span className="text-danger">*</span>
                        </Form.Label>
                        <Select
                          options={nationalityList}
                          value={nationality}
                          onChange={(opt) => {
                            setNationality(opt);
                            if (opt) clearError("nationality");
                          }}
                          onInputChange={(val) => {
                            if (val && val.length >= 2) debouncedCountrySearch(val);
                          }}
                          isLoading={isNationalityLoading}
                          placeholder="Search Nationality"
                          isSearchable
                          isClearable
                          menuPortalTarget={document.body}
                          styles={{
                            ...customSelectStyles,
                            control: (base) => ({
                              ...customSelectStyles.control(base),
                              borderColor: validationErrors.nationality ? "#dc3545" : base.borderColor,
                            }),
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          }}
                        />
                        {validationErrors.nationality && (
                          <div className="text-danger small mt-1">{validationErrors.nationality}</div>
                        )}
                        {/* Surface UAE-resident status to the operator
                            so they can apply the resident rate. Matches
                            both the ISO-2 ("AE"), ISO-3 ("ARE") and
                            common shorthand ("UAE") country codes, and
                            falls back to a label-text check so the note
                            still fires if the backend leaves the code
                            blank. */}
                        {(() => {
                          const code = (nationality?.code || "")
                            .toString()
                            .trim()
                            .toUpperCase();
                          const label = (nationality?.label || "")
                            .toString()
                            .trim()
                            .toLowerCase();
                          const isUAE =
                            code === "AE" ||
                            code === "ARE" ||
                            code === "UAE" ||
                            label.includes("united arab emirates") ||
                            label === "uae";
                          return isUAE ? (
                            <div
                              className="mt-1 small fw-semibold"
                              style={{ color: "#0f7a3a" }}
                            >
                              Select "United Arab Emirates" if guest resident of UAE
                            </div>
                          ) : null;
                        })()}
                      </Col>
                      {!isAgentRole && (
                        <Col md={4}>
                          <Form.Label className="fw-semibold">
                            Agent <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Select
                            style={{ height: "46px" }}
                            value={agent}
                            isInvalid={!!validationErrors.agent}
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
                          {validationErrors.agent && (
                            <div className="text-danger small mt-1">
                              {validationErrors.agent}
                            </div>
                          )}
                          {agent && <AgentBalanceDisplay agentId={agent} />}
                        </Col>
                      )}
                    </Row>

                    {children > 0 && (
                      <Row className="g-2 mb-3">
                        <Col md={12}>
                          <Form.Label className="mb-2 fw-semibold">Child Ages</Form.Label>
                          <div className="d-flex flex-wrap gap-2">
                            {childAges.map((age, index) => (
                              <Form.Control
                                key={index}
                                type="number"
                                min="0"
                                max="17"
                                placeholder="Age"
                                value={age}
                                style={{ width: "80px" }}
                                onChange={(e) => handleChildAgeChange(index, e.target.value)}
                              />
                            ))}
                          </div>
                        </Col>
                      </Row>
                    )}

                    <Row className="justify-content-center">
                      <Col md={4} className="d-flex justify-content-center mt-2">
                        <Button
                          variant="warning"
                          className="px-5 py-2 fw-bold"
                          type="submit"
                          disabled={loading}
                        >
                          {loading ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-2" />
                              Searching...
                            </>
                          ) : (
                            <>
                              <FaSearch className="me-2" /> Search Rentals
                            </>
                          )}
                        </Button>
                      </Col>
                    </Row>
                  </Form>
                </Card.Body>
              </Card>
                </div>
                {/* Ads carousel — only on first entry, before any search has run.
                    Re-opening the form via "Modify Search" keeps it hidden. */}
                {!hasSearched && (
                  <AdvertisementCarousel
                    cityId={city?.value}
                    cityName={city?.label}
                  />
                )}
              </div>
              )}

              {/* Results */}
              {loading && (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                  <p className="text-muted mt-2">Finding chauffeur rentals…</p>
                </div>
              )}

              {!loading && hasSearched && results.length === 0 && (
                <Card className="border-0 shadow-sm">
                  <Card.Body className="text-center py-5 text-muted">
                    <FaCar className="display-4 text-secondary mb-3 opacity-50 d-block mx-auto" />
                    No rental packages found for your search. Try a different city, package or cab type.
                  </Card.Body>
                </Card>
              )}

              {!hasSearched && !loading && (
                <div className="text-center text-muted mt-3 py-5 bg-white rounded-4 shadow-sm border-0">
                  <FaCar className="display-4 text-secondary mb-3 opacity-50" />
                  <h5>Ready to book a chauffeur?</h5>
                  <p>Select a city, package and cab type, then search.</p>
                </div>
              )}

              {!loading && results.length > 0 && (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-3 px-1">
                    <h5 className="fw-semibold mb-0">
                      Available Chauffeurs in {city?.label || "city"}
                    </h5>
                    <span className="text-muted small">{results.length} packages found</span>
                  </div>
                  <Row className="g-4">
                    {results.map((card, idx) => {
                      const price =
                        card.basePriceWithMarkup != null
                          ? card.basePriceWithMarkup
                          : card.basePrice;
                      const hasSurcharges =
                        (card.nightCharge && card.nightCharge > 0) ||
                        (card.waitingCharge && card.waitingCharge > 0) ||
                        (card.airportPickupCharge && card.airportPickupCharge > 0) ||
                        (card.airportDropCharge && card.airportDropCharge > 0);
                      return (
                        <Col md={6} lg={4} key={`${card.rentalRateId}-${card.packageId}-${idx}`}>
                          <Card className="h-100 shadow-sm border-0 rounded-4 overflow-hidden">
                            <LazyImage src={card.cabPic} alt={card.cabName} />
                            <Card.Body className="d-flex flex-column">
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                  <h5 className="fw-bold mb-0">{card.cabName}</h5>
                                  <small className="text-muted">{card.cabProviderName}</small>
                                </div>
                                {card.cabType && (
                                  <Badge bg="info" className="text-dark">
                                    {card.cabType}
                                  </Badge>
                                )}
                              </div>

                              <div className="mb-2 d-flex flex-wrap gap-1">
                                <Badge bg="light" text="dark" className="border">
                                  {card.cityName}
                                </Badge>
                                <Badge bg="primary">{card.packageName}</Badge>
                                {card.rateCode && (
                                  <Badge bg="secondary" pill>
                                    {card.rateCode}
                                  </Badge>
                                )}
                              </div>

                              <ul className="list-unstyled small text-muted mb-2">
                                <li className="mb-1">
                                  <FaClock className="me-2 text-secondary" />
                                  <strong className="text-dark">{card.hoursIncluded ?? "—"}</strong>{" "}
                                  hours included
                                </li>
                                <li className="mb-1">
                                  <FaRoad className="me-2 text-secondary" />
                                  <strong className="text-dark">{card.kmIncluded ?? "—"}</strong>{" "}
                                  km included
                                </li>
                                <li className="mb-1">
                                  <FaUsers className="me-2 text-secondary" />
                                  Extra Hour: <strong className="text-dark">{money(card.extraHourRate)}</strong>{" "}
                                  · Extra KM:{" "}
                                  <strong className="text-dark">{money(card.extraKmRate)}</strong>
                                </li>
                              </ul>

                              {hasSurcharges && (
                                <div className="border-top pt-2 mb-2 small text-muted">
                                  <div className="mb-1 fw-semibold text-dark">Surcharges</div>
                                  {card.nightCharge > 0 && (
                                    <div>Night: {money(card.nightCharge)}</div>
                                  )}
                                  {card.waitingCharge > 0 && (
                                    <div>Waiting: {money(card.waitingCharge)}</div>
                                  )}
                                  {card.airportPickupCharge > 0 && (
                                    <div>Airport Pickup: {money(card.airportPickupCharge)}</div>
                                  )}
                                  {card.airportDropCharge > 0 && (
                                    <div>Airport Drop: {money(card.airportDropCharge)}</div>
                                  )}
                                </div>
                              )}

                              {(card.validityFrom || card.validityTo) && (
                                <div className="small text-muted mb-2">
                                  Valid: {card.validityFrom || "—"} → {card.validityTo || "—"}
                                </div>
                              )}

                              <div className="mt-auto">
                                <div className="d-flex justify-content-between align-items-end mb-2">
                                  <span className="text-muted small">Package price</span>
                                  <span className="fw-bold fs-5 text-success">
                                    {money(price)}
                                  </span>
                                </div>
                                <Button
                                  variant="success"
                                  className="w-100 fw-semibold"
                                  onClick={() => handleBookNow(card)}
                                >
                                  Book Now
                                </Button>
                              </div>
                            </Card.Body>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                </>
              )}
            </Card.Body>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default SchefferDriverSearch;
