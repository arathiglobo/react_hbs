import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Spinner,
  Table,
} from "react-bootstrap";
import { FaCar, FaSearch } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import Select from "react-select";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import AgentBalanceDisplay from "../../../components/AgentBalanceDisplay";

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

  const imageSrc = src || "https://via.placeholder.com/480x270";

  return (
    <div
      ref={containerRef}
      className={`ratio ratio-16x9 rounded-top overflow-hidden ${
        className || ""
      }`}
      style={{ height: "100%", width: "100%", position: "relative" }}
    >
      {!loaded && (
        <div 
           className="skeleton w-100 h-100" 
           style={{ backgroundColor: '#e0e0e0', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
        />
      )}
      {inView && (
        <img
          src={imageSrc}
          loading="lazy"
          alt={alt}
          onLoad={() => setLoaded(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out'
          }}
        />
      )}
    </div>
  );
}

export const CabSearch = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Try to use state from previous page if available
  const searchCriteria = location.state || {};
  
  // Form State
  const [nationality, setNationality] = useState(searchCriteria.nationality || null);
  const [destination, setDestination] = useState(searchCriteria.destination || null);
  
  const [transferPickupDate, setTransferPickupDate] = useState(searchCriteria.travelDate || "");
  const [transferDropoffDate, setTransferDropoffDate] = useState(searchCriteria.travelDate || "");
  const [transferAdults, setTransferAdults] = useState(searchCriteria.adults || 1);
  const [transferChildren, setTransferChildren] = useState(searchCriteria.children || 0);
  const [transferChildAges, setTransferChildAges] = useState(searchCriteria.childAges || []);
  
  // Results State
  const [transferResults, setTransferResults] = useState([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [hasTransferSearched, setHasTransferSearched] = useState(false);

  // Country & Destination state
  const [nationalityList, setNationalityList] = useState([]);
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);
  const [isNationalityLoading, setIsNationalityLoading] = useState(false);

  // ── NEW: Pickup / Drop-off detail fields ────────────────────────────
  // pickupType / dropoffType: "HOTEL" | "AIRPORT" | "" (none chosen yet)
  // pickupName / dropoffName: free-text for AIRPORT, dropdown value for HOTEL
  // pickupTime: required only when pickupType === "AIRPORT"
  // dropoffTime: optional, only meaningful when dropoffType === "AIRPORT"
  const [pickupType, setPickupType] = useState("");
  const [pickupName, setPickupName] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropoffType, setDropoffType] = useState("");
  const [dropoffName, setDropoffName] = useState("");
  const [dropoffTime, setDropoffTime] = useState("");

  // Hotel-lookup options used when either pickupType OR dropoffType is HOTEL.
  // Fetched from the new lightweight endpoint /api/hotels/lookup,
  // filtered by the current destination's countryId + cityId.
  const [hotelOptions, setHotelOptions] = useState([]);
  const [isHotelLoading, setIsHotelLoading] = useState(false);

  // ── Agent selector (mirrors HotelSearch.jsx pattern) ─────────────────
  const [agent, setAgent] = useState("");
  const [agents, setAgents] = useState([]);

  const loadAgents = async () => {
    try {
      const res = await axiosInstance.get("/api/agent");
      setAgents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load agents:", err);
      setAgents([]);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  // ── Per-field validation errors ──────────────────────────────────────
  // Keyed by field name; values are the error message to display under the
  // corresponding input. Cleared as the user edits each field.
  const [validationErrors, setValidationErrors] = useState({});
  const clearError = (field) =>
    setValidationErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _omit, ...rest } = prev;
      return rest;
    });

  // Debounce utility function
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

  // Debounced city search function
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
      } catch (error) {
        console.log("axios call error for city list:", error);
        setDestinationOptions([]);
      } finally {
        setIsDestinationLoading(false);
      }
    }, 300)
  ).current;

  // Debounced country search function
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
        console.log("axios call error for country list:", error);
        setNationalityList([]);
      } finally {
        setIsNationalityLoading(false);
      }
    }, 300)
  ).current;

  const countryList = async (search = "") => {
    if (search) {
      debouncedCountrySearch(search);
    } else {
      try {
        setIsNationalityLoading(true);
        const response = await axiosInstance.get("/api/country?limit=50");
        const options = Array.isArray(response.data)
          ? response.data.map((country) => ({
            value: country.id,
            label: country.name,
            code: country.countryCode,
          }))
          : [];
        setNationalityList(options);
      } catch (error) {
        console.log("error for country list:", error);
        setNationalityList([]);
      } finally {
        setIsNationalityLoading(false);
      }
    }
  };

  const handleCountryInputChange = (inputValue) => {
    if (inputValue.length >= 2) {
      debouncedCountrySearch(inputValue);
    }
  };

  const cityList = (searchText = "") => {
    debouncedCitySearch(searchText);
  };

  const loadPopularDestinations = async () => {
    if (destinationOptions.length > 0) return;

    try {
      setIsDestinationLoading(true);
      const response = await axiosInstance.get("/api/province?limit=20");
      const cityApiRes = Array.isArray(response.data) ? response.data : [];
      const options = cityApiRes.map((city) => ({
        value: city.id,
        label: `${city.stateName}, ${city.country}`,
        countryId: city.countryId,
      }));
      setDestinationOptions(options);
    } catch (error) {
      console.log("Error loading popular destinations:", error);
    } finally {
      setIsDestinationLoading(false);
    }
  };

  // Fetch initial master data
  useEffect(() => {
    countryList();
  }, []);

  // ── Fetch hotel list whenever pickup or dropoff type is HOTEL ────────
  // The backend /api/hotels/lookup endpoint accepts optional countryId /
  // cityId. We pass the destination filters when they're available so the
  // list is narrowed to the search city, but we ALSO fire the lookup with
  // no filters when the user hasn't picked a destination yet — that way the
  // dropdown is never empty just because the destination field is blank.
  useEffect(() => {
    const needsHotelList = pickupType === "HOTEL" || dropoffType === "HOTEL";
    if (!needsHotelList) {
      setHotelOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setIsHotelLoading(true);
        // Build params dynamically — undefined values are skipped by axios.
        const params = {};
        if (destination?.countryId) params.countryId = destination.countryId;
        if (destination?.value)     params.cityId    = destination.value;
        const res = await axiosInstance.get("/api/hotels/lookup", { params });
        if (cancelled) return;
        const opts = Array.isArray(res.data)
          ? res.data.map((h) => ({
              value: String(h.hotelName || ""),
              label: h.hotelName || `Hotel #${h.hotelId}`,
              hotelId: h.hotelId,
              address: h.address,
            }))
          : [];
        setHotelOptions(opts);
      } catch (err) {
        if (!cancelled) {
          console.warn("Hotel lookup failed:", err);
          setHotelOptions([]);
        }
      } finally {
        if (!cancelled) setIsHotelLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [destination, pickupType, dropoffType]);

  // Update transfer child ages when number of children changes
  useEffect(() => {
    if (transferChildren > 0) {
      setTransferChildAges((prevAges) => {
        const currentAges = [...prevAges];
        while (currentAges.length < transferChildren) {
          currentAges.push(5); // Default age
        }
        if (currentAges.length > transferChildren) {
          currentAges.splice(transferChildren);
        }
        return currentAges;
      });
    } else {
      setTransferChildAges([]);
    }
  }, [transferChildren]);

  const handleTransferChildAgeChange = (index, value) => {
    const updatedAges = [...transferChildAges];
    updatedAges[index] = parseInt(value) || 5;
    setTransferChildAges(updatedAges);
  };

  // ── Build per-field error map ─────────────────────────────────────────
  // Returns {} when the form is valid; otherwise an object whose keys are
  // field names and values are user-facing error strings rendered inline.
  const buildValidationErrors = () => {
    const errs = {};

    // Mandatory fields (existing behaviour, now per-field).
    if (!nationality) errs.nationality = "Nationality is required.";
    if (!destination) errs.destination = "Destination is required.";
    if (!transferPickupDate) errs.pickupDate = "Pickup date is required.";

    // Drop-off date (already required by data flow); flag if check-out
    // somehow falls strictly before pickup.
    if (
      transferPickupDate &&
      transferDropoffDate &&
      transferDropoffDate < transferPickupDate
    ) {
      errs.dropoffDate = "Dropoff date cannot be before pickup date.";
    }

    // Pickup section — only meaningful once a type is chosen.
    if (pickupType) {
      if (!pickupName || !pickupName.trim()) {
        errs.pickupName =
          pickupType === "HOTEL"
            ? "Please select a pickup hotel."
            : "Please enter the pickup airport name.";
      }
      if (pickupType === "AIRPORT") {
        if (!pickupTime) {
          errs.pickupTime = "Pickup time is required for airport pickup.";
        }
      }
    }

    // Drop-off section — name required once type is chosen; time is optional.
    if (dropoffType) {
      if (!dropoffName || !dropoffName.trim()) {
        errs.dropoffName =
          dropoffType === "HOTEL"
            ? "Please select a drop-off hotel."
            : "Please enter the drop-off airport name.";
      }
    }

    return errs;
  };

  const handleTransferSearchSubmit = async (e) => {
    e.preventDefault();

    // Run validation. If anything's wrong, surface inline + a single toast
    // pointing the user at the form, then short-circuit.
    const errs = buildValidationErrors();
    setValidationErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix the highlighted fields and try again.");
      return;
    }

    setTransferLoading(true);
    setHasTransferSearched(true);
    setTransferResults([]);

    try {
      const agentId = (agent && String(agent))
                   || sessionStorage.getItem("makeYourOwnPackageAgentId")
                   || localStorage.getItem("makeYourOwnPackageAgentId")
                   || "1";

      const transferPayload = {
        checkIn: transferPickupDate,
        checkOut: transferDropoffDate || transferPickupDate,
        nativeCountryId: nationality.value ? Number(nationality.value) : null,
        destinationCountryId: destination.countryId || "",
        destinationCityId: destination.value || "",
        searchCorCtype: "city",
        agentid: String(agentId),
        childAge: transferChildAges && transferChildAges.length > 0
            ? transferChildAges.map((age) => parseInt(age) || 0)
            : transferChildren > 0
              ? Array(transferChildren).fill(0)
              : [],
        adult: transferAdults || 1,
        child: transferChildren || 0,
        // ── NEW: pickup / drop-off details ─────────────────────────
        // Sent only when the user filled them in — empty/blank values
        // are sent as null so the backend's IS NULL guards skip the
        // extra filter clauses (backwards compatible).
        pickupType: pickupType || null,
        pickupName: pickupName?.trim() || null,
        pickupTime: pickupType === "AIRPORT" && pickupTime ? pickupTime : null,
        dropoffType: dropoffType || null,
        dropoffName: dropoffName?.trim() || null,
        dropoffTime: dropoffTime || null,
      };

      const response = await axiosInstance.post(
        "/api/makeYourOwnPackage/getTransferInhouse",
        transferPayload
      );

      const ensureHttpImage = (imageUrl) => {
        if (!imageUrl) {
          return "https://via.placeholder.com/400x225?text=Transfer";
        }
        if (/^https?:\/\//i.test(imageUrl)) {
          return imageUrl;
        }
        if (typeof imageUrl === "string") {
          const fileName = imageUrl.split(/[/\\]/).pop();
          if (fileName) {
            return `https://b2b.choosenfly.com/assets/details/profilepic/hotel/${fileName}`;
          }
        }
        return "https://via.placeholder.com/400x225?text=Transfer";
      };

      const mappedResults = Array.isArray(response.data)
        ? response.data.map((cab, index) => ({
          cabid: cab.cabid || cab.cabId || `cab-${index}`,
          cabname: cab.cabname || cab.cabName || "Transfer Vehicle",
          cabdetails: cab.cabdetails || "",
          cabpic: ensureHttpImage(cab.cabpic || cab.cabPic),
          noOfCabs: cab.noOfCabs || 1,
          searchCabDetailsDTO: Array.isArray(cab.searchCabDetailsDTO)
            ? cab.searchCabDetailsDTO
            : [],
        }))
        : [];

      setTransferResults(mappedResults);
    } catch (err) {
      console.error("Transfer search failed:", err);
      toast.error("Failed to search for transfers.");
      setTransferResults([]);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleBookNow = (cab, cabDetail) => {
    // Navigate to CabBookingPage and carry over search data and selected cab data
    navigate("/cab-booking-page", {
      state: {
        cab,
        selectedOption: cabDetail,
        searchCriteria: {
          nationality,
          destination,
          pickupDate: transferPickupDate,
          dropoffDate: transferDropoffDate,
          adults: transferAdults,
          children: transferChildren,
          childAges: transferChildAges,
          // ── NEW: pickup / drop-off details carried into the booking page.
          //    Booking Summary / Order Summary read these to render the
          //    facility name (hotel or airport) + optional times. The booking
          //    POST already picks them up from the same searchCriteria too.
          pickupType,
          pickupName,
          pickupTime,
          dropoffType,
          dropoffName,
          dropoffTime,
        }
      }
    });
  };

  const customSelectStyles = {
  control: (base) => ({
    ...base,
    minHeight: "46px",
    height: "46px",
    borderRadius: "0.375rem", // matches bootstrap
  }),
  valueContainer: (base) => ({
    ...base,
    height: "46px",
    padding: "0 8px",
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: "46px",
  }),
};

  return (
   <div className="min-vh-100 bg-light d-flex flex-column">
  <TopBar />

  <div className="d-flex flex-grow-1">
    <Sidebar />

    <main className="flex-grow-1 p-4">
      <Card className="shadow-sm rounded-xl mb-4 border-0">
        <Card.Body>

          {/* 🔷 Header */}
          <div className="mb-4 d-flex justify-content-between align-items-start">
            <div>
              <h4 className="fw-bold text-primary mb-1">Transfers Search</h4>
              <p className="text-muted small mb-0">
                Search and compare available transfer options
              </p>
            </div>
            <div style={{ minWidth: 260 }}>
              <Form.Label className="fw-semibold text-dark mb-1 small">
                Agent
              </Form.Label>
              <Form.Select
                style={{ height: "42px" }}
                className="form-control-modern"
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
              >
                <option value="">Select Agent</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.companyName}
                  </option>
                ))}
              </Form.Select>
              <AgentBalanceDisplay agentId={agent} />
            </div>
          </div>

          {/* 🔷 Search Card */}
          <Card className="border-0 shadow-sm rounded-4 bg-white mb-4">
            <Card.Body>
              <Form onSubmit={handleTransferSearchSubmit}>

                {/* Row 1 */}
                <Row className="g-3 mb-3">
                  <Col md={4}>
                    <Form.Label className="fw-semibold">Nationality</Form.Label>
                    {/* react-select can't take isInvalid directly; we apply a
                        red border via the styles override below, and render a
                        manual error message under the control. */}
                    <Select
                      options={nationalityList}
                      value={nationality}
                      onChange={(opt) => {
                        setNationality(opt);
                        if (opt) clearError("nationality");
                      }}
                      onInputChange={handleCountryInputChange}
                      isLoading={isNationalityLoading}
                      placeholder="Search Nationality"
                      isSearchable
                      isClearable
                      className="modern-select-sm"
                      menuPortalTarget={document.body}
                      styles={{
                          ...customSelectStyles,
                        control: (base) => ({
                          ...customSelectStyles.control(base),
                          borderColor: validationErrors.nationality ? "#dc3545" : base.borderColor,
                        }),
                        menuPortal: base => ({ ...base, zIndex: 9999 }),
                      }}
                    />
                    {validationErrors.nationality && (
                      <div className="text-danger small mt-1">{validationErrors.nationality}</div>
                    )}
                  </Col>

                  <Col md={4}>
                    <Form.Label className="fw-semibold">Destination</Form.Label>
                    <Select
                      options={destinationOptions}
                      value={destination}
                      onChange={(opt) => {
                        setDestination(opt);
                        if (opt) clearError("destination");
                      }}
                      placeholder="Search destinations..."
                      isSearchable
                      isClearable
                      className="modern-select-sm"
                      isLoading={isDestinationLoading}
                      noOptionsMessage={() =>
                        isDestinationLoading
                          ? "Searching destinations..."
                          : "Type to search destinations..."
                      }
                      onMenuOpen={() => {
                        if (destinationOptions.length === 0) {
                          loadPopularDestinations();
                        }
                      }}
                      onInputChange={(inputValue, { action }) => {
                        if (action === "input-change") {
                          cityList(inputValue);
                        }
                      }}
                      menuPortalTarget={document.body}
                       styles={{
                          ...customSelectStyles,
                        control: (base) => ({
                          ...customSelectStyles.control(base),
                          borderColor: validationErrors.destination ? "#dc3545" : base.borderColor,
                        }),
                        menuPortal: base => ({ ...base, zIndex: 9999 }),
                      }}
                    />
                    {validationErrors.destination && (
                      <div className="text-danger small mt-1">{validationErrors.destination}</div>
                    )}
                  </Col>
                     <Col md={4}>
                    <Form.Label className="fw-semibold">Pickup Date</Form.Label>
                    <Form.Control
                    style={{height:"46px"}}
                      type="date"
                      value={transferPickupDate}
                      isInvalid={!!validationErrors.pickupDate}
                      onChange={(e) => {
                        setTransferPickupDate(e.target.value);
                        if (e.target.value) clearError("pickupDate");
                      }}
                      min={new Date().toISOString().split("T")[0]}
                    />
                    <Form.Control.Feedback type="invalid">
                      {validationErrors.pickupDate}
                    </Form.Control.Feedback>
                  </Col>
                </Row>

                {/* Row 2 */}
                <Row className="g-3 align-items-end">



                  <Col md={4}>
                    <Form.Label className="fw-semibold">Dropoff Date</Form.Label>
                    <Form.Control
                     style={{height:"46px"}}
                      type="date"
                      value={transferDropoffDate}
                      isInvalid={!!validationErrors.dropoffDate}
                      onChange={(e) => {
                        setTransferDropoffDate(e.target.value);
                        clearError("dropoffDate");
                      }}
                      min={transferPickupDate || undefined}
                    />
                    <Form.Control.Feedback type="invalid">
                      {validationErrors.dropoffDate}
                    </Form.Control.Feedback>
                  </Col>

                  <Col md={4}>
                    <Form.Label className="fw-semibold">Adults</Form.Label>
                    <Form.Select
                     style={{height:"46px"}}
                      value={transferAdults}
                      onChange={(e) => setTransferAdults(parseInt(e.target.value) || 1)}
                    >
                      {Array.from({ length: 9 }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num}>
                          {num}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>

                  <Col md={4}>
                    <Form.Label className="fw-semibold">Children</Form.Label>
                    <Form.Select
                     style={{height:"46px"}}
                      value={transferChildren}
                      onChange={(e) => setTransferChildren(parseInt(e.target.value) || 0)}
                    >
                      {Array.from({ length: 6 }, (_, i) => i).map((num) => (
                        <option key={num} value={num}>
                          {num}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>

                  {/* <Col md={4} className="d-flex justify-content-md-end mt-3 mt-md-0">
                    <Button
                      variant="warning"
                      className="px-5 py-2 fw-bold w-100 w-md-auto"
                      type="submit"
                      disabled={transferLoading}
                    >
                      {transferLoading ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-2" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <FaSearch className="me-2" /> Search Cabs
                        </>
                      )}
                    </Button>
                  </Col> */}

                </Row>

                {/* ── NEW: Pickup details row ───────────────────────────────
                    Type drives both the name input shape (dropdown vs. text)
                    and the visibility / requiredness of the time input. */}
                <Row className="g-3 align-items-end mt-1">
                  <Col md={4}>
                    <Form.Label className="fw-semibold">Pickup Type</Form.Label>
                    <Form.Select
                      style={{ height: "46px" }}
                      value={pickupType}
                      onChange={(e) => {
                        setPickupType(e.target.value);
                        // Reset name/time when the type changes — what was
                        // valid for AIRPORT (free text) won't be valid for
                        // HOTEL (must come from the dropdown). Also clear
                        // related field errors so they don't linger.
                        setPickupName("");
                        clearError("pickupName");
                        if (e.target.value !== "AIRPORT") {
                          setPickupTime("");
                          clearError("pickupTime");
                        }
                      }}
                    >
                      <option value="">— Select —</option>
                      <option value="HOTEL">Hotel</option>
                      <option value="AIRPORT">Airport</option>
                    </Form.Select>
                  </Col>

                  <Col md={4}>
                    <Form.Label className="fw-semibold">
                      Pickup {pickupType === "HOTEL" ? "Hotel" : pickupType === "AIRPORT" ? "Airport" : "Name"}
                      {pickupType ? " *" : ""}
                    </Form.Label>
                    {pickupType === "HOTEL" ? (
                      // Dropdown sourced from /api/hotels/lookup filtered by
                      // destination country + city. Sends the hotel NAME to
                      // the backend search, matching how cab_location.pickup
                      // stores plain text.
                      <Select
                        options={hotelOptions}
                        value={hotelOptions.find((o) => o.value === pickupName) || null}
                        onChange={(opt) => {
                          setPickupName(opt ? opt.value : "");
                          if (opt) clearError("pickupName");
                        }}
                        isLoading={isHotelLoading}
                        isClearable
                        placeholder={
                          isHotelLoading
                            ? "Loading hotels..."
                            : hotelOptions.length === 0
                            ? (destination
                                ? "No hotels for this city"
                                : "No hotels found")
                            : (destination
                                ? "Select a hotel"
                                : "Select a hotel (choose destination to filter)")
                        }
                        noOptionsMessage={() =>
                          isHotelLoading ? "Loading..." : "No hotels found"
                        }
                        menuPortalTarget={document.body}
                        styles={{
                          ...customSelectStyles,
                          control: (base) => ({
                            ...customSelectStyles.control(base),
                            borderColor: validationErrors.pickupName ? "#dc3545" : base.borderColor,
                          }),
                          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        }}
                      />
                    ) : (
                      // Free text input for AIRPORT and the empty default.
                      <Form.Control
                        style={{ height: "46px" }}
                        type="text"
                        placeholder={
                          pickupType === "AIRPORT"
                            ? "Airport name"
                            : "Pick a type first"
                        }
                        value={pickupName}
                        isInvalid={!!validationErrors.pickupName}
                        disabled={!pickupType}
                        onChange={(e) => {
                          setPickupName(e.target.value);
                          if (e.target.value.trim()) clearError("pickupName");
                        }}
                      />
                    )}
                    {validationErrors.pickupName && (
                      <div className="text-danger small mt-1">{validationErrors.pickupName}</div>
                    )}
                  </Col>

                  <Col md={4}>
                    <Form.Label className="fw-semibold">
                      Pickup Time {pickupType === "AIRPORT" ? "*" : "(optional)"}
                    </Form.Label>
                    <Form.Control
                      style={{ height: "46px" }}
                      type="time"
                      // Only meaningful for airport pickups; disabled otherwise
                      // so the form stays clean.
                      disabled={pickupType !== "AIRPORT"}
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
                </Row>

                {/* ── NEW: Dropoff details row ─────────────────────────────
                    Same pattern as pickup; time is always optional. */}
                <Row className="g-3 align-items-end mt-1">
                  <Col md={4}>
                    <Form.Label className="fw-semibold">Dropoff Type</Form.Label>
                    <Form.Select
                      style={{ height: "46px" }}
                      value={dropoffType}
                      onChange={(e) => {
                        setDropoffType(e.target.value);
                        setDropoffName("");
                        clearError("dropoffName");
                        if (e.target.value !== "AIRPORT") setDropoffTime("");
                      }}
                    >
                      <option value="">— Select —</option>
                      <option value="HOTEL">Hotel</option>
                      <option value="AIRPORT">Airport</option>
                    </Form.Select>
                  </Col>

                  <Col md={4}>
                    <Form.Label className="fw-semibold">
                      Dropoff {dropoffType === "HOTEL" ? "Hotel" : dropoffType === "AIRPORT" ? "Airport" : "Name"}
                      {dropoffType ? " *" : ""}
                    </Form.Label>
                    {dropoffType === "HOTEL" ? (
                      <Select
                        options={hotelOptions}
                        value={hotelOptions.find((o) => o.value === dropoffName) || null}
                        onChange={(opt) => {
                          setDropoffName(opt ? opt.value : "");
                          if (opt) clearError("dropoffName");
                        }}
                        isLoading={isHotelLoading}
                        isClearable
                        placeholder={
                          isHotelLoading
                            ? "Loading hotels..."
                            : hotelOptions.length === 0
                            ? (destination
                                ? "No hotels for this city"
                                : "No hotels found")
                            : (destination
                                ? "Select a hotel"
                                : "Select a hotel (choose destination to filter)")
                        }
                        noOptionsMessage={() =>
                          isHotelLoading ? "Loading..." : "No hotels found"
                        }
                        menuPortalTarget={document.body}
                        styles={{
                          ...customSelectStyles,
                          control: (base) => ({
                            ...customSelectStyles.control(base),
                            borderColor: validationErrors.dropoffName ? "#dc3545" : base.borderColor,
                          }),
                          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        }}
                      />
                    ) : (
                      <Form.Control
                        style={{ height: "46px" }}
                        type="text"
                        placeholder={
                          dropoffType === "AIRPORT"
                            ? "Airport name"
                            : "Pick a type first"
                        }
                        value={dropoffName}
                        isInvalid={!!validationErrors.dropoffName}
                        disabled={!dropoffType}
                        onChange={(e) => {
                          setDropoffName(e.target.value);
                          if (e.target.value.trim()) clearError("dropoffName");
                        }}
                      />
                    )}
                    {validationErrors.dropoffName && (
                      <div className="text-danger small mt-1">{validationErrors.dropoffName}</div>
                    )}
                  </Col>

                  <Col md={4}>
                    <Form.Label className="fw-semibold">
                      Dropoff Time (optional)
                    </Form.Label>
                    <Form.Control
                      style={{ height: "46px" }}
                      type="time"
                      // Per spec, drop-off time is optional even for airport
                      // drops. Disabled until a type is chosen for clarity.
                      disabled={!dropoffType}
                      value={dropoffTime}
                      onChange={(e) => setDropoffTime(e.target.value)}
                    />
                  </Col>
                </Row>

             <Row className="justify-content-center">
  <Col md={4} className="d-flex justify-content-center mt-3">
    <Button
      variant="warning"
      className="px-5 py-2 fw-bold"
      type="submit"
      disabled={transferLoading}
    >
      {transferLoading ? (
        <>
          <Spinner animation="border" size="sm" className="me-2" />
          Searching...
        </>
      ) : (
        <>
          <FaSearch className="me-2" /> Search Cabs
        </>
      )}
    </Button>
  </Col>
</Row>

                {/* Child Ages */}
                {transferChildren > 0 && (
                  <Row className="g-2 mt-3">
                    <Col md={12}>
                      <Form.Label className="mb-2 fw-semibold">Child Ages</Form.Label>
                      <div className="d-flex flex-wrap gap-2">
                        {transferChildAges.map((age, index) => (
                          <Form.Control
                            key={index}
                            type="number"
                            min="0"
                            max="17"
                            placeholder="Age"
                            value={age}
                            style={{ width: "80px" }}
                            onChange={(e) =>
                              handleTransferChildAgeChange(index, e.target.value)
                            }
                          />
                        ))}
                      </div>
                    </Col>
                  </Row>
                )}

              </Form>
            </Card.Body>
          </Card>

          {/* Loading State */}
          {transferLoading && (
            <Card className="shadow-sm rounded-xl mb-4 mt-4 border-0">
              <Card.Body className="text-center py-5">
                <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
                <h5 className="text-primary fw-bold mt-3 mb-1">
                  Searching Transfers...
                </h5>
                <p className="text-muted small mb-0">
                  Finding available transfer options for you
                </p>
              </Card.Body>
            </Card>
          )}

          {/* Empty State */}
          {!hasTransferSearched && !transferLoading && (
            <div className="text-center text-muted mt-5 py-5 bg-white rounded-4 shadow-sm border-0">
              <FaCar className="display-4 text-secondary mb-3 opacity-50" />
              <h5>Ready to book a transfer?</h5>
              <p>Run a search to view available cabs and options.</p>
            </div>
          )}

          {/* Results Display */}
          {hasTransferSearched && !transferLoading && transferResults.length > 0 && (
            <div className="mt-4">

  {/* Header */}
  <div className="d-flex justify-content-between align-items-center mb-3 px-1">
    <h5 className="fw-semibold mb-0">Transfer Results</h5>
    <span className="text-muted small">
      {transferResults.length} found
    </span>
  </div>

  <Row className="g-3 justify-content-center">
    {transferResults.map((cab) => (
      <Col key={cab.cabid} lg={12} xl={12}> {/* 🔥 wider */}

        <Card className="border-0 shadow-sm bg-white">
          <Card.Body className="p-4"> {/* 🔥 more padding */}

            {/* HEADER */}
            <div className="d-flex justify-content-between align-items-center mb-3">

              {/* LEFT */}
              <div>
                <h5 className="fw-semibold mb-1">
                  {cab.cabname || "Transfer Vehicle"}
                </h5>

                <span className="text-muted small">
                  <FaCar className="me-1" />
                  {cab.noOfCabs || "1"} Vehicle
                </span>
              </div>

              {/* RIGHT IMAGE */}
              <div
                style={{
                  width: "160px",   // 🔥 bigger
                  height: "95px",
                  overflow: "hidden",
                }}
              >
                <LazyImage
                  src={cab.cabpic}
                  alt={cab.cabname}
                  className="rounded"
                />
              </div>

            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid #f1f5f9", marginBottom: "10px" }} />

            {/* TABLE */}
            {cab.searchCabDetailsDTO?.length > 0 ? (
              <div>

                <table className="w-100" style={{ fontSize: "0.95rem" }}>
                  
                  <thead>
                    <tr className="text-muted small">
                      <th className="pb-2 fw-normal">Route</th>
                      <th className="pb-2 fw-normal">Type</th>
                      <th className="pb-2 fw-normal text-end">Price</th>
                      <th className="pb-2 text-end"></th>
                    </tr>
                  </thead>

                  <tbody>
                    {cab.searchCabDetailsDTO.map((detail, idx) => {
                      const rate =
                        detail.types === "SIC"
                          ? detail.sicRate
                          : detail.privateRate;

                      const totalRate =
                        detail.totalRateWithoutMrk || rate || 0;

                      return (
                        <tr
                          key={idx}
                          style={{
                            borderTop: "1px solid #f1f5f9",
                          }}
                          className="hover-row"
                        >

                          {/* Route */}
                          <td className="py-3"> {/* 🔥 more spacing */}
                            {detail.location || "N/A"}{" "}
                            <span className="text-muted mx-1">→</span>{" "}
                            {detail.dropOff || "N/A"}
                          </td>

                          {/* Type */}
                          <td className="py-3">
                            <span
                              className={`fw-medium ${
                                detail.types === "Private"
                                  ? "text-success"
                                  : "text-primary"
                              }`}
                            >
                              {detail.types}
                            </span>
                          </td>

                          {/* Price */}
                          <td className="py-3 text-end fw-semibold">
                            AED {totalRate.toLocaleString()}
                          </td>

                          {/* Button */}
                          <td className="py-3 text-end">
                            <Button
                              size="sm"
                              variant="primary"
                              className="px-3"
                              onClick={() =>
                                handleBookNow(cab, detail)
                              }
                            >
                              Book
                            </Button>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>

                </table>

              </div>
            ) : (
              <div className="text-muted small mt-2">
                No options available
              </div>
            )}

          </Card.Body>
        </Card>

      </Col>
    ))}
  </Row>
</div>
          )}

          {/* No Results */}
          {hasTransferSearched && !transferLoading && transferResults.length === 0 && (
            <div className="text-center text-muted mt-5 py-5 bg-white rounded-4 shadow-sm border-0">
              <FaCar className="display-4 text-warning mb-3 opacity-75" />
              <h5 className="text-dark">No transfers found</h5>
              <p>Try selecting different dates or destinations for your search.</p>
            </div>
          )}

        </Card.Body>
      </Card>
    </main>
  </div>
</div>
  );
};
