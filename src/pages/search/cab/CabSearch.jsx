import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Spinner,
  Table,
  ProgressBar,
  Modal,
} from "react-bootstrap";
import { FaCar, FaSearch } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import Select from "react-select";
import AgentSelect from "../../../components/AgentSelect";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import AgentBalanceDisplay from "../../../components/AgentBalanceDisplay";
import AdvertisementCarousel from "../../../components/AdvertisementCarousel";

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
          style={{
            backgroundColor: "#e0e0e0",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
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
            transition: "opacity 0.3s ease-in-out",
          }}
        />
      )}
    </div>
  );
}

// ── Demo / dummy cab inventory ────────────────────────────────────────
// Sample transfers surfaced for the test route "Dubai International Airport
// → Test Hotel" so the search → results → booking flow can be demonstrated
// without live cab inventory. Each cab carries BOTH an SIC (Shared) and a
// Private rate row so the Shared/Private toggle has data either way.
// Shapes mirror what /api/cab-search/search returns (see mapping below).
const DUMMY_ORIGIN_NAME = "Dubai International Airport";
const DUMMY_DEST_NAME = "Test Hotel";
const DUMMY_CAB_RESULTS = [
  {
    cabid: "demo-sedan",
    cabname: "Toyota Camry (Sedan)",
    cabdetails: "Comfortable 3-seater sedan with luggage space",
    cabpic:
      "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=480&q=60",
    noOfCabs: 1,
    cabProviderId: null,
    cabProviderName: "Dubai City Transfers",
    originLocationName: DUMMY_ORIGIN_NAME,
    destinationLocationName: DUMMY_DEST_NAME,
    capacityMin: 1,
    capacityMax: 3,
    searchCabDetailsDTO: [
      {
        types: "SIC",
        location: DUMMY_ORIGIN_NAME,
        dropOff: DUMMY_DEST_NAME,
        sicRate: 55,
        totalRate: 55,
        totalRateWithoutMarkup: 50,
      },
      {
        types: "Private",
        location: DUMMY_ORIGIN_NAME,
        dropOff: DUMMY_DEST_NAME,
        privateRate: 130,
        privateTotalRate: 130,
        totalRate: 130,
        totalRateWithoutMarkup: 120,
      },
    ],
  },
  {
    cabid: "demo-suv",
    cabname: "Toyota Land Cruiser (SUV)",
    cabdetails: "Premium 6-seater SUV, ideal for families",
    cabpic:
      "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=480&q=60",
    noOfCabs: 1,
    cabProviderId: null,
    cabProviderName: "Dubai City Transfers",
    originLocationName: DUMMY_ORIGIN_NAME,
    destinationLocationName: DUMMY_DEST_NAME,
    capacityMin: 1,
    capacityMax: 6,
    searchCabDetailsDTO: [
      {
        types: "SIC",
        location: DUMMY_ORIGIN_NAME,
        dropOff: DUMMY_DEST_NAME,
        sicRate: 70,
        totalRate: 70,
        totalRateWithoutMarkup: 64,
      },
      {
        types: "Private",
        location: DUMMY_ORIGIN_NAME,
        dropOff: DUMMY_DEST_NAME,
        privateRate: 220,
        privateTotalRate: 220,
        totalRate: 220,
        totalRateWithoutMarkup: 200,
      },
    ],
  },
  {
    cabid: "demo-van",
    cabname: "Toyota Hiace (Van)",
    cabdetails: "Spacious 10-seater van for groups",
    cabpic:
      "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=480&q=60",
    noOfCabs: 1,
    cabProviderId: null,
    cabProviderName: "Dubai City Transfers",
    originLocationName: DUMMY_ORIGIN_NAME,
    destinationLocationName: DUMMY_DEST_NAME,
    capacityMin: 1,
    capacityMax: 10,
    searchCabDetailsDTO: [
      {
        types: "SIC",
        location: DUMMY_ORIGIN_NAME,
        dropOff: DUMMY_DEST_NAME,
        sicRate: 45,
        totalRate: 45,
        totalRateWithoutMarkup: 40,
      },
      {
        types: "Private",
        location: DUMMY_ORIGIN_NAME,
        dropOff: DUMMY_DEST_NAME,
        privateRate: 300,
        privateTotalRate: 300,
        totalRate: 300,
        totalRateWithoutMarkup: 275,
      },
    ],
  },
];

export const CabSearch = () => {
  const navigate = useNavigate();
  const location = useLocation();

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

  // Try to use state from previous page if available
  const searchCriteria = location.state || {};

  // Form State
  const [nationality, setNationality] = useState(
    searchCriteria.nationality || null,
  );
  const [destination, setDestination] = useState(
    searchCriteria.destination || null,
  );

  const [transferPickupDate, setTransferPickupDate] = useState(
    searchCriteria.travelDate || "",
  );
  const [transferDropoffDate, setTransferDropoffDate] = useState(
    searchCriteria.travelDate || "",
  );
  const [transferAdults, setTransferAdults] = useState(
    searchCriteria.adults || 1,
  );
  const [transferChildren, setTransferChildren] = useState(
    searchCriteria.children || 0,
  );
  const [transferChildAges, setTransferChildAges] = useState(
    searchCriteria.childAges || [],
  );

  // Results State
  const [transferResults, setTransferResults] = useState([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [hasTransferSearched, setHasTransferSearched] = useState(false);

  // ── View modal — shows full transfer details for one (cab, detail) row.
  // Held as { cab, detail } or null. Driven by the View button on each
  // search-result card. Does not touch the booking flow.
  const [viewModal, setViewModal] = useState(null);

  // ── Booking type toggle for search results ───────────────────────────
  // "Shared"  → show SIC rates priced by passenger count
  //             (paying pax = adults + children whose age > 3).
  // "Private" → show private rates as returned by the backend
  //             (privateTotal flat, falling back to privatePerPax × pax).
  // Affects ONLY how rows are filtered & priced in the results table —
  // does not change the search request payload, so backend behaviour
  // and other flows are untouched.
  const [transferType, setTransferType] = useState("Shared");

  // ── Result-page filter / sort / pagination state ─────────────────────
  // Mirrors the Juniper-style result page in the reference screenshot:
  //   - free-text "Search by Transfer Name"
  //   - multi-select "Suppliers" (built from the unique cab providers
  //     in the current result set)
  //   - sort by Price (default) or Transfer Name
  //   - basic page-of-N pagination, default 5 cards/page
  // None of these touch the search API — they're applied on top of the
  // already-fetched transferResults array.
  const [nameFilter, setNameFilter] = useState("");
  const [pendingNameFilter, setPendingNameFilter] = useState("");
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [pendingSuppliers, setPendingSuppliers] = useState([]);
  const [sortBy, setSortBy] = useState("price");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

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

  // ── Currency dropdown ────────────────────────────────────────────────
  // Sourced from /api/currency and rendered as currencyCode-only options
  // (the master row's `name` / `value` aren't surfaced in the picker per
  // spec). The picked code is carried through to the booking page state
  // so downstream conversion logic can use it; the search payload itself
  // is unchanged, so no other flow is affected.
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const [isCurrencyLoading, setIsCurrencyLoading] = useState(false);
  const [currency, setCurrency] = useState(null);

  const loadAgents = async () => {
    try {
      const res = await axiosInstance.get("/api/agent?activeOnly=true");
      setAgents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load agents:", err);
      setAgents([]);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  // Load currencies once on mount. The endpoint is paginated; we ask for a
  // generous limit so the whole master list comes back in one call. We map
  // each row to a {value, label} where label is *only* the currencyCode —
  // per spec the user picks "AED" / "INR" etc, not the full currency name.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsCurrencyLoading(true);
        const res = await axiosInstance.get("/api/currency", {
          params: { page: 0, limit: 200 },
        });
        if (cancelled) return;
        const arr = Array.isArray(res.data) ? res.data : [];
        const opts = arr
          .filter((c) => c && c.currencyCode && !c.isDeleted)
          .map((c) => ({
            value: c.currencyCode,
            label: c.currencyCode,
            currencyId: c.currencyId,
          }));
        setCurrencyOptions(opts);
      } catch (err) {
        if (!cancelled) {
          console.warn("Currency lookup failed:", err);
          setCurrencyOptions([]);
        }
      } finally {
        if (!cancelled) setIsCurrencyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── New search criteria (Juniper-style layout) ────────────────────────
  const [tripType, setTripType] = useState("ONE_WAY"); // "ONE_WAY" | "ROUND_TRIP"
  const [timeType, setTimeType] = useState("PICKUP_TIME"); // "PICKUP_TIME" | "FLIGHT_TIME"
  const [origin, setOrigin] = useState(null);
  const [departureTime, setDepartureTime] = useState("");
  const [returnTime, setReturnTime] = useState("");

  // ── NEW simplified Transfer search criteria ───────────────────────────
  // city: the master_state row chosen via api/province (drives the
  //   pickup/drop facility lists). Shape: { value, label, countryId }.
  // pickupKind / dropoffKind: "AIRPORT" | "HOTEL" | "PLACE" | ""
  // pickupItem / dropoffItem: the selected option from the dependent
  //   dropdown — { value, label, source, locationId, locationName }
  // arrivalTime: HH:mm string (mapped to the search payload as
  //   departureTime since the backend uses the same field for both
  //   pickup-time and flight/arrival-time depending on timeType).
  const [city, setCity] = useState(null);
  const [cityOptions, setCityOptions] = useState([]);
  const [isCityLoading, setIsCityLoading] = useState(false);
  const [pickupKind, setPickupKind] = useState("");
  const [pickupItem, setPickupItem] = useState(null);
  const [dropoffKind, setDropoffKind] = useState("");
  const [dropoffItem, setDropoffItem] = useState(null);
  const [arrivalTime, setArrivalTime] = useState("");
  // Drop-side departure time — separate from the pickup-side arrival time
  // above. Sent as `dropoffTime` in the search payload.
  const [dropDepartureTime, setDropDepartureTime] = useState("");

  // "Change drop off city?" — when toggled on, a second City select appears
  // and the drop-side facility lists load from that city instead of the
  // pickup city. When off (default), pickup + drop facilities share the
  // single City selection above.
  const [changeDropCity, setChangeDropCity] = useState(false);
  const [dropCity, setDropCity] = useState(null);
  const [dropCityOptions, setDropCityOptions] = useState([]);
  const [isDropCityLoading, setIsDropCityLoading] = useState(false);

  // Per-kind option lists keyed off the chosen city.
  // Pickup side — always filtered by the main `city`.
  const [airportOpts, setAirportOpts] = useState([]);
  const [hotelOpts, setHotelOpts] = useState([]);
  const [placeOpts, setPlaceOpts] = useState([]);
  const [isAirportLoading, setIsAirportLoading] = useState(false);
  const [isHotelOptsLoading, setIsHotelOptsLoading] = useState(false);
  const [isPlaceLoading, setIsPlaceLoading] = useState(false);

  // Drop side — filtered by `dropCity` when changeDropCity is on, otherwise
  // mirrors the pickup-side lists. We always store the drop options in a
  // separate piece of state so toggling the checkbox doesn't blow away the
  // pickup user's selection.
  const [dropAirportOpts, setDropAirportOpts] = useState([]);
  const [dropHotelOpts, setDropHotelOpts] = useState([]);
  const [dropPlaceOpts, setDropPlaceOpts] = useState([]);
  const [isDropAirportLoading, setIsDropAirportLoading] = useState(false);
  const [isDropHotelLoading, setIsDropHotelLoading] = useState(false);
  const [isDropPlaceLoading, setIsDropPlaceLoading] = useState(false);

  // Shared helper: hit /api/province?search= and return city options shaped
  // for react-select. Used by both the pickup City and the optional Drop
  // City selectors so they show identical results for the same query.
  const fetchCityOptions = async (q) => {
    const res = await axiosInstance.get(
      `/api/province?search=${encodeURIComponent(q || "")}&limit=20`,
    );
    const arr = Array.isArray(res.data) ? res.data : [];
    return arr.slice(0, 50).map((p) => ({
      value: p.id,
      label: `${p.stateName || p.name || ""}${
        p.country ? `, ${p.country}` : ""
      }`,
      countryId: p.countryId || null,
      stateName: p.stateName || p.name || "",
    }));
  };

  // City search hits api/province?search= directly so the dropdown shows the
  // matching state rows (id, stateName, country).
  const debouncedCityProvinceSearch = useRef(
    debounce(async (q = "") => {
      try {
        setIsCityLoading(true);
        const opts = await fetchCityOptions(q);
        setCityOptions(opts);
      } catch {
        setCityOptions([]);
      } finally {
        setIsCityLoading(false);
      }
    }, 300),
  ).current;

  // Same logic but for the optional Drop City selector. Kept as a separate
  // debounced ref so typing in one search box doesn't race the other.
  const debouncedDropCityProvinceSearch = useRef(
    debounce(async (q = "") => {
      try {
        setIsDropCityLoading(true);
        const opts = await fetchCityOptions(q);
        setDropCityOptions(opts);
      } catch {
        setDropCityOptions([]);
      } finally {
        setIsDropCityLoading(false);
      }
    }, 300),
  ).current;

  // Fetch airports filtered by the chosen city. AirportController now accepts
  // an optional cityId query param so the dropdown only surfaces airports in
  // the selected state. Setters are injected so the same helper can populate
  // either the pickup-side or the drop-side option list.
  const fetchAirportsForCity = async (cityId, setOpts, setLoading) => {
    if (!cityId) {
      setOpts([]);
      return;
    }
    try {
      setLoading(true);
      const res = await axiosInstance.get(
        `/api/airport?page=0&limit=50&cityId=${cityId}`,
      );
      const arr = Array.isArray(res.data) ? res.data : [];
      setOpts(
        arr.map((a) => ({
          value: a.id,
          label: `${a.airportName}${a.airportCode ? ` (${a.airportCode})` : ""}`,
          source: "AIRPORT",
          locationId: a.id,
          locationName: a.airportName,
          // Per-airport meet-and-greet buffer configured on the airport
          // master; surfaced read-only on /cab-booking-page so it
          // travels through with the selected airport.
          estimatedArrivalTime: a.estimatedArrivalTime || "",
        })),
      );
    } catch {
      setOpts([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch hotels filtered by city (and country if known). /api/hotels/lookup
  // accepts both cityId and countryId so we narrow as much as possible.
  const fetchHotelsForCity = async (cityId, countryId, setOpts, setLoading) => {
    if (!cityId) {
      setOpts([]);
      return;
    }
    try {
      setLoading(true);
      const params = { cityId };
      if (countryId) params.countryId = countryId;
      const res = await axiosInstance.get("/api/hotels/lookup", { params });
      const arr = Array.isArray(res.data) ? res.data : [];
      setOpts(
        arr.map((h) => ({
          value: h.hotelId,
          label: h.hotelName || `Hotel #${h.hotelId}`,
          source: "HOTEL",
          locationId: h.hotelId,
          locationName: h.hotelName,
        })),
      );
    } catch {
      setOpts([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch places (master_place) under the selected state. The state's id is
  // the same value the api/province row carries, so we hit /api/destination/
  // getplaces/{stateId} to surface every place inside that state.
  const fetchPlacesForCity = async (cityId, setOpts, setLoading) => {
    if (!cityId) {
      setOpts([]);
      return;
    }
    try {
      setLoading(true);
      const res = await axiosInstance.get(
        `/api/destination/getplaces/${cityId}`,
      );
      const arr = Array.isArray(res.data) ? res.data : [];
      setOpts(
        arr.map((p) => ({
          value: p.id,
          label: p.name,
          source: "PLACE",
          locationId: p.id,
          locationName: p.name,
        })),
      );
    } catch {
      setOpts([]);
    } finally {
      setLoading(false);
    }
  };

  // Pickup-side lists — always filtered by the main `city` selection.
  useEffect(() => {
    const cityId = city?.value;
    const countryId = city?.countryId;
    if (!cityId) {
      setAirportOpts([]);
      setHotelOpts([]);
      setPlaceOpts([]);
      return;
    }
    if (pickupKind === "AIRPORT") {
      fetchAirportsForCity(cityId, setAirportOpts, setIsAirportLoading);
    }
    if (pickupKind === "HOTEL") {
      fetchHotelsForCity(cityId, countryId, setHotelOpts, setIsHotelOptsLoading);
    }
    if (pickupKind === "PLACE") {
      fetchPlacesForCity(cityId, setPlaceOpts, setIsPlaceLoading);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, pickupKind]);

  // Drop-side lists — filtered by `dropCity` when "Change drop off city?" is
  // ticked, otherwise mirror the pickup city. We re-derive the effective
  // drop city inside the effect so toggling the checkbox immediately
  // refreshes the drop dropdown options.
  useEffect(() => {
    const effective = changeDropCity ? dropCity : city;
    const cityId = effective?.value;
    const countryId = effective?.countryId;
    if (!cityId) {
      setDropAirportOpts([]);
      setDropHotelOpts([]);
      setDropPlaceOpts([]);
      return;
    }
    if (dropoffKind === "AIRPORT") {
      fetchAirportsForCity(
        cityId,
        setDropAirportOpts,
        setIsDropAirportLoading,
      );
    }
    if (dropoffKind === "HOTEL") {
      fetchHotelsForCity(
        cityId,
        countryId,
        setDropHotelOpts,
        setIsDropHotelLoading,
      );
    }
    if (dropoffKind === "PLACE") {
      fetchPlacesForCity(cityId, setDropPlaceOpts, setIsDropPlaceLoading);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, dropCity, changeDropCity, dropoffKind]);

  // Combined Origin / Destination options grouped into Zones / Hotels /
  // Airports. Sourced from the new /api/cab-search/lookup endpoint, which
  // searches across master_sub_locations, master_place, hotel, and
  // master_airport in parallel so a single typed query like "burj" surfaces
  // matches across every type.
  const [zoneLocationOptions, setZoneLocationOptions] = useState([]); // grouped
  const [isZoneOptsLoading, setIsZoneOptsLoading] = useState(false);

  const buildLookupOption = (item) => ({
    // value is unique across the four sources
    value: `${item.source}:${item.id}`,
    label: item.name,
    subtitle: item.subtitle || "",
    source: item.source,
    locationId: Number(item.id),
    locationName: item.name,
    code: item.code || null,
    subLocationId: item.subLocationId || null,
    subLocationName: item.subLocationName || null,
  });

  const fetchLookup = (search = "") => {
    setIsZoneOptsLoading(true);
    axiosInstance
      .get(
        `/api/cab-search/lookup?search=${encodeURIComponent(search)}&limit=20`,
      )
      .then((res) => {
        const d = res?.data || {};
        const groups = [];
        const zones = Array.isArray(d.zones) ? d.zones : [];
        const hotels = Array.isArray(d.hotels) ? d.hotels : [];
        const airports = Array.isArray(d.airports) ? d.airports : [];
        if (zones.length > 0) {
          groups.push({
            label: "ZONES",
            options: zones.map(buildLookupOption),
          });
        }
        if (hotels.length > 0) {
          groups.push({
            label: "HOTELS",
            options: hotels.map(buildLookupOption),
          });
        }
        if (airports.length > 0) {
          groups.push({
            label: "AIRPORTS",
            options: airports.map(buildLookupOption),
          });
        }
        setZoneLocationOptions(groups);
      })
      .catch(() => setZoneLocationOptions([]))
      .finally(() => setIsZoneOptsLoading(false));
  };

  useEffect(() => {
    fetchLookup("");
  }, []);

  // Custom react-select option renderer: name on top, light subtitle below.
  const formatLookupOptionLabel = (opt) => (
    <div>
      <div className="fw-semibold">{opt.label}</div>
      {opt.subtitle && <small className="text-muted">{opt.subtitle}</small>}
    </div>
  );

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
          `/api/province?search=${searchText}`,
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
    }, 300),
  ).current;

  // Debounced country search function
  const debouncedCountrySearch = useRef(
    debounce(async (search) => {
      try {
        setIsNationalityLoading(true);
        const response = await axiosInstance.get(
          `/api/country?search=${search}`,
        );
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
    }, 300),
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
        if (destination?.value) params.cityId = destination.value;
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
    return () => {
      cancelled = true;
    };
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
  // Mirrors the simplified Transfer search layout: Agent → City → Date →
  // Pickup (type + facility) → Arrival time → Drop (type + facility) → Pax.
  const buildValidationErrors = () => {
    const errs = {};

    if (!isAgentRole && !agent) errs.agent = "Agent is required.";
    if (!city) errs.city = "City is required.";
    if (changeDropCity && !dropCity) errs.dropCity = "Drop city is required.";
    if (!transferPickupDate) errs.pickupDate = "Transfer date is required.";

    if (!pickupKind) errs.pickupKind = "Pickup type is required.";
    if (pickupKind && !pickupItem)
      errs.pickupItem =
        pickupKind === "AIRPORT"
          ? "Please select a pickup airport."
          : pickupKind === "HOTEL"
            ? "Please select a pickup accommodation."
            : "Please select a pickup place.";

    if (!arrivalTime) errs.arrivalTime = "Arrival time is required.";

    if (!dropoffKind) errs.dropoffKind = "Drop type is required.";
    if (dropoffKind && !dropoffItem)
      errs.dropoffItem =
        dropoffKind === "AIRPORT"
          ? "Please select a drop airport."
          : dropoffKind === "HOTEL"
            ? "Please select a drop accommodation."
            : "Please select a drop place.";

    return errs;
  };

  // ── Real cab ids for the demo route ──────────────────────────────────
  // The booking API (/api/cab/book) requires an existing Cab row, so the
  // demo cards must carry REAL cab ids to be bookable. We pull them from the
  // cab-provider registry: each provider exposes a nested cabList; if that's
  // empty we fall back to the per-provider /cabs/{id} endpoint. Returns up to
  // a handful of { cabId, name, cabpic }.
  const fetchRealCabsForDemo = async () => {
    try {
      const res = await axiosInstance.get("/api/cabProvider", {
        params: { page: 0, limit: 50 },
      });
      const providers = Array.isArray(res.data) ? res.data : [];
      const cabs = [];
      providers.forEach((p) => {
        (Array.isArray(p.cabList) ? p.cabList : []).forEach((c) => {
          if (c?.cabId != null)
            cabs.push({ cabId: c.cabId, name: c.name, cabpic: c.cabpic });
        });
      });
      // Fallback: providers came back without a nested cabList — query the
      // first provider's cabs directly (CabListDTO → { cabId, cabName }).
      if (cabs.length === 0 && providers[0]?.cabprovider != null) {
        const cl = await axiosInstance.get(
          `/api/cabProvider/cabs/${providers[0].cabprovider}`,
        );
        (Array.isArray(cl.data) ? cl.data : []).forEach((c) => {
          if (c?.cabId != null) cabs.push({ cabId: c.cabId, name: c.cabName });
        });
      }
      return cabs;
    } catch (e) {
      console.warn("Demo cab lookup failed:", e);
      return [];
    }
  };

  const handleTransferSearchSubmit = async (e) => {
    e.preventDefault();

    // Run validation. If anything's wrong, surface inline + a single toast
    // pointing the user at the form, then short-circuit.
    const errs = buildValidationErrors();
    setValidationErrors(errs);
    if (Object.keys(errs).length > 0) {
      // toast.error("Please fix the highlighted fields and try again.");
      return;
    }

    setTransferLoading(true);
    setHasTransferSearched(true);
    setTransferResults([]);

    try {
      const agentId =
        (agent && String(agent)) ||
        sessionStorage.getItem("makeYourOwnPackageAgentId") ||
        localStorage.getItem("makeYourOwnPackageAgentId") ||
        "1";

      // New zone-based search payload — built from the simplified Transfer
      // criteria (Agent / City / Date / Pickup / Arrival time / Drop / Pax).
      // The backend CabSearchRequestDTO uses originSource+id / destinationSource+id
      // which we derive from the chosen pickup + drop facility.
      const transferPayload = {
        originSource: pickupItem?.source || "AIRPORT",
        originLocationId: pickupItem?.locationId || null,
        originLocationName: pickupItem?.locationName || null,
        destinationSource: dropoffItem?.source || "HOTEL",
        destinationLocationId: dropoffItem?.locationId || null,
        destinationLocationName: dropoffItem?.locationName || null,
        tripType: "ONE_WAY",
        timeType: "FLIGHT_TIME",
        departureDate: transferPickupDate || null,
        // arrivalTime drives the search's time field — the backend uses it
        // alongside timeType to match rate-validity windows when configured.
        departureTime: arrivalTime || null,
        // Optional drop-side departure time, carried through to the booking
        // page so the operator can show it on the order summary / PDF.
        dropoffTime: dropDepartureTime || null,
        returnDate: null,
        returnTime: null,
        adults: transferAdults || 1,
        children: transferChildren || 0,
        childAges:
          transferChildAges && transferChildAges.length > 0
            ? transferChildAges.map((age) => parseInt(age) || 0)
            : transferChildren > 0
              ? Array(transferChildren).fill(0)
              : [],
        agentId: agentId ? Number(agentId) : null,
      };

      const response = await axiosInstance.post(
        "/api/cab-search/search",
        transferPayload,
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
            // Additions surfaced by the new /api/cab-search/search endpoint.
            cabProviderId: cab.cabProviderId || null,
            cabProviderName: cab.cabProviderName || "",
            originLocationName: cab.originLocationName || "",
            destinationLocationName: cab.destinationLocationName || "",
            capacityMin: cab.capacityMin ?? null,
            capacityMax: cab.capacityMax ?? null,
            // Normalise per-row rate fields so the UI can rely on a single
            // shape regardless of what the backend names them:
            //   totalRate              → final price WITH agent markup
            //   totalRateWithoutMarkup → base price WITHOUT agent markup
            // Older payloads used `totalRateWithoutMrk` for the base — we
            // map that into `totalRateWithoutMarkup` so legacy responses
            // still render. Any pre-existing per-row fields (sicRate,
            // privateRate, privateTotalRate, privatePerPaxRate, types,
            // location, dropOff, etc.) are preserved as-is.
            searchCabDetailsDTO: Array.isArray(cab.searchCabDetailsDTO)
              ? cab.searchCabDetailsDTO.map((d) => ({
                  ...d,
                  totalRate:
                    d?.totalRate != null
                      ? Number(d.totalRate)
                      : d?.totalRateWithMrk != null
                        ? Number(d.totalRateWithMrk)
                        : null,
                  totalRateWithoutMarkup:
                    d?.totalRateWithoutMarkup != null
                      ? Number(d.totalRateWithoutMarkup)
                      : d?.totalRateWithoutMrk != null
                        ? Number(d.totalRateWithoutMrk)
                        : null,
                }))
              : [],
          }))
        : [];

      // ── Demo route injection ──────────────────────────────────────────
      // When searching the sample route "Dubai International Airport →
      // Test Hotel", surface the dummy cab inventory so the flow can be
      // demonstrated even when no live rates are configured. Matching is
      // lenient (case-insensitive substring) on the picked origin/dest
      // labels. Any real results still show alongside the demo cabs.
      const originLabel = (
        origin?.label ||
        origin?.locationName ||
        ""
      ).toLowerCase();
      const destLabel = (
        destination?.label ||
        destination?.locationName ||
        ""
      ).toLowerCase();
      const isDemoRoute =
        originLabel.includes("dubai") &&
        originLabel.includes("airport") &&
        destLabel.includes("test hotel");

      if (isDemoRoute) {
        // Attach REAL cab ids to the demo cards so they can be booked. We keep
        // the demo names / images / rates but point each card at an existing
        // Cab row (cycling through whatever's registered).
        const realCabs = await fetchRealCabsForDemo();
        if (realCabs.length === 0) {
          toast.error(
            "No registered cabs found — demo cards will show but can't be booked. Register a cab first.",
          );
        }
        const demoResults = DUMMY_CAB_RESULTS.map((tpl, i) => {
          const real = realCabs.length ? realCabs[i % realCabs.length] : null;
          return {
            ...tpl,
            cabid: real ? real.cabId : tpl.cabid,
          };
        });
        setTransferResults([...mappedResults, ...demoResults]);
      } else {
        setTransferResults(mappedResults);
      }
    } catch (err) {
      console.error("Transfer search failed:", err);
      toast.error("Failed to search for transfers.");
      setTransferResults([]);
    } finally {
      setTransferLoading(false);
    }
  };

  // ── Paying pax for SIC pricing ───────────────────────────────────────
  // SIC (Seat-In-Coach / Shared) is per-seat. Adults always pay. Children
  // are charged only when their age is strictly greater than 3 (toddlers
  // age 0–3 ride free). When child ages are not collected yet we
  // conservatively count all children as paying.
  const sicPayingPax = (() => {
    const adults = Number(transferAdults) || 0;
    const childCount = Number(transferChildren) || 0;
    if (childCount <= 0) return adults;
    if (Array.isArray(transferChildAges) && transferChildAges.length > 0) {
      const payingChildren = transferChildAges
        .slice(0, childCount)
        .filter((age) => Number(age) > 3).length;
      return adults + payingChildren;
    }
    return adults + childCount;
  })();

  // Total head-count (used for Private per-pax fallback pricing).
  const totalPax =
    (Number(transferAdults) || 0) + (Number(transferChildren) || 0);

  // Price a single search-result row for the currently selected transfer
  // type. Returns { total, baseTotal, perUnit, label } where:
  //   total     → headline price WITH agent markup (what the user pays)
  //   baseTotal → price WITHOUT markup (kept for the booking summary)
  //   perUnit   → per-pax rate used for the "× N pax" breakdown
  //   label     → "× N pax" qualifier (empty when not applicable)
  // We prefer the backend's `totalRate` (markup-applied on the server)
  // whenever it's present so the displayed price always matches the
  // billable amount. If the backend hasn't sent it (older responses /
  // markup misconfigured) we fall back to the per-pax rule for SIC and
  // the existing chain for Private — the UI still works, just without
  // markup applied.
  const priceDetail = (detail) => {
    if (!detail) return { total: 0, baseTotal: 0, perUnit: 0, label: "" };

    const backendWithMarkup =
      detail.totalRate != null ? Number(detail.totalRate) : null;
    const backendBase =
      detail.totalRateWithoutMarkup != null
        ? Number(detail.totalRateWithoutMarkup)
        : null;

    const rowType = String(detail.types || "").toUpperCase();
    const isSharedRow =
      rowType === "SIC" ||
      (rowType === "" && transferType === "Shared");

    if (isSharedRow) {
      const per = Number(detail.sicRate) || 0;
      const fallbackTotal = per * sicPayingPax;
      // Prefer backend's markup-applied total; fall back to per-seat × pax.
      const total =
        backendWithMarkup != null && backendWithMarkup > 0
          ? backendWithMarkup
          : fallbackTotal;
      const baseTotal =
        backendBase != null && backendBase > 0 ? backendBase : fallbackTotal;
      return {
        total,
        baseTotal,
        perUnit: per,
        label: sicPayingPax > 0 ? `× ${sicPayingPax} pax` : "",
      };
    }

    // Private: backend markup-applied total wins. Fall back through
    // privateRate → privatePerPaxRate × totalPax → privateTotalRate
    // (existing behaviour, retained for backwards compatibility).
    if (backendWithMarkup != null && backendWithMarkup > 0) {
      return {
        total: backendWithMarkup,
        baseTotal:
          backendBase != null && backendBase > 0
            ? backendBase
            : backendWithMarkup,
        perUnit: 0,
        label: "",
      };
    }
    const privateRate = Number(detail.privateRate) || 0;
    if (privateRate > 0)
      return {
        total: privateRate,
        baseTotal: privateRate,
        perUnit: 0,
        label: "",
      };
    const perPax = Number(detail.privatePerPaxRate) || 0;
    if (perPax > 0 && totalPax > 0) {
      const computed = perPax * totalPax;
      return {
        total: computed,
        baseTotal: computed,
        perUnit: perPax,
        label: `× ${totalPax} pax`,
      };
    }
    const flat = Number(detail.privateTotalRate) || 0;
    return { total: flat, baseTotal: flat, perUnit: 0, label: "" };
  };

  const handleBookNow = (cab, cabDetail) => {
    // Recompute the row's price the same way the table shows it so the
    // booking page receives a consistent total. We carry BOTH the
    // markup-applied price (`totalRate`, what the user pays) and the
    // base price (`totalRateWithoutMarkup`, used by the order summary
    // to display the markup separately). For backwards compatibility
    // with CabBookingPage we also keep `totalRateWithoutMrk` aligned
    // to the markup-applied total, since that's the field it reads as
    // its initial billable amount.
    const { total: rowTotal, baseTotal } = priceDetail(cabDetail);
    const detailType = String(cabDetail.types || "").toUpperCase();
    const resolvedType =
      detailType === "SIC" || detailType === "PRIVATE"
        ? detailType === "SIC"
          ? "SIC"
          : "Private"
        : transferType === "Shared"
          ? "SIC"
          : "Private";
    const enrichedSelectedOption = {
      ...cabDetail,
      types: resolvedType,
      // New, explicitly named fields:
      totalRate: rowTotal, // billable price WITH agent markup
      totalRateWithoutMarkup: baseTotal, // base price WITHOUT agent markup
      // Legacy field name preserved for backwards compatibility with
      // CabBookingPage's API payload (totalRateWithoutmrk). This MUST
      // stay equal to the base (no-markup) price so the booked rate
      // and the supplier-side base reconcile correctly downstream.
      totalRateWithoutMrk: baseTotal,
    };
    // Navigate to CabBookingPage and carry over search data and selected cab data
    navigate("/cab-booking-page", {
      state: {
        cab,
        selectedOption: enrichedSelectedOption,
        searchCriteria: {
          nationality,
          destination,
          city,
          pickupDate: transferPickupDate,
          dropoffDate: transferDropoffDate,
          adults: transferAdults,
          children: transferChildren,
          childAges: transferChildAges,
          // Carry the simplified Transfer criteria forward so the booking
          // summary can display facility names and (where present) times.
          pickupType: pickupKind === "HOTEL" ? "HOTEL" : pickupKind,
          pickupName: pickupItem?.locationName || "",
          pickupTime: arrivalTime,
          // Master-configured estimated arrival buffer for the picked
          // airport — carried through so the booking page renders it
          // read-only instead of asking the operator to retype it.
          pickupEstimatedArrivalTime:
            pickupKind === "AIRPORT"
              ? pickupItem?.estimatedArrivalTime || ""
              : "",
          dropoffType: dropoffKind === "HOTEL" ? "HOTEL" : dropoffKind,
          dropoffName: dropoffItem?.locationName || "",
          dropoffTime: dropDepartureTime || "",
          arrivalTime,
          // Currency code (e.g. "AED") chosen on the search page — carried
          // through so the booking page / downstream invoice can apply
          // conversion. Null when the user didn't pick one.
          currencyCode: currency?.value || null,
        },
      },
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

        <main className="flex-grow-1 p-4 hs-page">
          <Card className="shadow-sm rounded-xl mb-4 border-0">
            <Card.Body>
              {/* 🔷 Header */}
              <div className="mb-4 d-flex justify-content-between align-items-start">
                <div>
                  <h4 className="fw-bold text-primary mb-1">
                    Transfers Search
                  </h4>
                  <p className="text-muted small mb-0">
                    Search and compare available transfer options
                  </p>
                </div>
              </div>

              {/* ── Search Card + Ads ── */}
              <div className="d-flex gap-3 align-items-start mb-4 hs-search-ads-row">
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
              {/* 🔷 Search Card */}
              <Card className="border-0 shadow-sm rounded-4 bg-white h-100">
                <Card.Body>
                  <Form onSubmit={handleTransferSearchSubmit}>
                    {/* ── Simplified Transfer search criteria ───────────────
                        Layout per spec:
                          1. Agent (hidden for Agent-role logins)
                          2. City  — api/province?search=
                          3. Transfer Date
                          4. Pickup type + dependent facility
                          5. Arrival time
                          6. Drop type + dependent facility
                          7. Pax (Adults + Children + Child ages) */}
                    {/* Row 1 — Agent / City / Transfer Date
                        align-items-start keeps all three labels on the same
                        baseline; the "Change drop off city?" checkbox under
                        the City Select just hangs below without pushing the
                        Agent / Transfer Date controls down. */}
                    <Row className="g-3 mb-3 align-items-start">
                      {!isAgentRole && (
                        <Col md={3}>
                          <Form.Label className="fw-semibold">
                            Agent <span className="text-danger">*</span>
                          </Form.Label>
                          <AgentSelect
                            agents={agents}
                            value={agent}
                            isInvalid={!!validationErrors.agent}
                            onChange={(v) => {
                              setAgent(v);
                              if (v) clearError("agent");
                            }}
                          />
                          {validationErrors.agent && (
                            <div className="text-danger small mt-1">
                              {validationErrors.agent}
                            </div>
                          )}
                          {agent && <AgentBalanceDisplay agentId={agent} />}
                        </Col>
                      )}
                      <Col md={isAgentRole ? 9 : 6}>
                        <Form.Label className="fw-semibold">
                          City <span className="text-danger">*</span>
                        </Form.Label>
                        <Select
                          options={cityOptions}
                          value={city}
                          isLoading={isCityLoading}
                          onChange={(opt) => {
                            setCity(opt);
                            // Picking a different city invalidates whatever
                            // facility was selected for pickup / dropoff —
                            // clear them so the user re-selects within the
                            // new city's lists.
                            setPickupItem(null);
                            setDropoffItem(null);
                            if (opt) clearError("city");
                          }}
                          onInputChange={(input, { action }) => {
                            if (action !== "input-change") return;
                            debouncedCityProvinceSearch(input || "");
                          }}
                          onFocus={() => {
                            if (cityOptions.length === 0) {
                              debouncedCityProvinceSearch("");
                            }
                          }}
                          filterOption={() => true}
                          placeholder="Search city (e.g. Dubai)"
                          isSearchable
                          isClearable
                          menuPortalTarget={document.body}
                          styles={{
                            ...customSelectStyles,
                            control: (base) => ({
                              ...customSelectStyles.control(base),
                              borderColor: validationErrors.city
                                ? "#dc3545"
                                : base.borderColor,
                            }),
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          }}
                        />
                        {validationErrors.city && (
                          <div className="text-danger small mt-1">
                            {validationErrors.city}
                          </div>
                        )}
                        {/* Toggle that reveals the optional Drop City
                            selector (rendered in its own row below) so the
                            operator can search a route that ends in a
                            different city than the pickup city. */}
                        <Form.Check
                          type="checkbox"
                          id="cab-change-drop-city"
                          label="Change drop off city?"
                          className="mt-2"
                          checked={changeDropCity}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setChangeDropCity(next);
                            // Either way, the current drop facility was
                            // bound to a list filtered by the *previous*
                            // effective city — clear it so the user picks
                            // afresh once the dropdown reloads.
                            setDropoffItem(null);
                            if (!next) setDropCity(null);
                          }}
                        />
                      </Col>
                      <Col md={3}>
                        <Form.Label className="fw-semibold">
                          Transfer Date{" "}
                          <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          style={{ height: "46px" }}
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

                    {changeDropCity && (
                      <Row className="g-3 mb-3 align-items-end">
                        <Col md={6}>
                          <Form.Label className="fw-semibold">
                            Drop City{" "}
                            <span className="text-danger">*</span>
                          </Form.Label>
                          <Select
                            options={dropCityOptions}
                            value={dropCity}
                            isLoading={isDropCityLoading}
                            onChange={(opt) => {
                              setDropCity(opt);
                              // Picking a different drop city invalidates
                              // whatever drop facility was selected.
                              setDropoffItem(null);
                              if (opt) clearError("dropCity");
                            }}
                            onInputChange={(input, { action }) => {
                              if (action !== "input-change") return;
                              debouncedDropCityProvinceSearch(input || "");
                            }}
                            onFocus={() => {
                              if (dropCityOptions.length === 0) {
                                debouncedDropCityProvinceSearch("");
                              }
                            }}
                            filterOption={() => true}
                            placeholder="Search drop city"
                            isSearchable
                            isClearable
                            menuPortalTarget={document.body}
                            styles={{
                              ...customSelectStyles,
                              control: (base) => ({
                                ...customSelectStyles.control(base),
                                borderColor: validationErrors.dropCity
                                  ? "#dc3545"
                                  : base.borderColor,
                              }),
                              menuPortal: (base) => ({
                                ...base,
                                zIndex: 9999,
                              }),
                            }}
                          />
                          {validationErrors.dropCity && (
                            <div className="text-danger small mt-1">
                              {validationErrors.dropCity}
                            </div>
                          )}
                        </Col>
                      </Row>
                    )}

                    <Row className="g-3 mb-3 align-items-end">


                      <Col md={3}>
                        <Form.Label className="fw-semibold">
                          Pickup <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Select
                          style={{ height: "46px" }}
                          value={pickupKind}
                          isInvalid={!!validationErrors.pickupKind}
                          onChange={(e) => {
                            setPickupKind(e.target.value);
                            setPickupItem(null);
                            if (e.target.value) clearError("pickupKind");
                            clearError("pickupItem");
                          }}
                        >
                          <option value="">— Select —</option>
                          <option value="AIRPORT">Airport</option>
                          <option value="HOTEL">Accommodation</option>
                          <option value="PLACE">Place</option>
                        </Form.Select>
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.pickupKind}
                        </Form.Control.Feedback>
                      </Col>

                      <Col md={3}>
                        <Form.Label className="fw-semibold">
                          {pickupKind === "AIRPORT"
                            ? "Airport"
                            : pickupKind === "HOTEL"
                              ? "Accommodation"
                              : pickupKind === "PLACE"
                                ? "Place"
                                : "Pickup Facility"}{" "}
                          {pickupKind ? (
                            <span className="text-danger">*</span>
                          ) : null}
                        </Form.Label>
                        <Select
                          options={
                            pickupKind === "AIRPORT"
                              ? airportOpts
                              : pickupKind === "HOTEL"
                                ? hotelOpts
                                : pickupKind === "PLACE"
                                  ? placeOpts
                                  : []
                          }
                          value={pickupItem}
                          isLoading={
                            pickupKind === "AIRPORT"
                              ? isAirportLoading
                              : pickupKind === "HOTEL"
                                ? isHotelOptsLoading
                                : pickupKind === "PLACE"
                                  ? isPlaceLoading
                                  : false
                          }
                          isDisabled={!pickupKind || !city}
                          onChange={(opt) => {
                            setPickupItem(opt);
                            if (opt) clearError("pickupItem");
                          }}
                          isSearchable
                          isClearable
                          placeholder={
                            !city
                              ? "Pick a city first"
                              : !pickupKind
                                ? "Pick a type first"
                                : `Select ${
                                    pickupKind === "AIRPORT"
                                      ? "airport"
                                      : pickupKind === "HOTEL"
                                        ? "accommodation"
                                        : "place"
                                  }`
                          }
                          menuPortalTarget={document.body}
                          styles={{
                            ...customSelectStyles,
                            control: (base) => ({
                              ...customSelectStyles.control(base),
                              borderColor: validationErrors.pickupItem
                                ? "#dc3545"
                                : base.borderColor,
                            }),
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          }}
                        />
                        {validationErrors.pickupItem && (
                          <div className="text-danger small mt-1">
                            {validationErrors.pickupItem}
                          </div>
                        )}
                      </Col>

                      <Col md={3}>
                        <Form.Label className="fw-semibold">
                          Arrival Time{" "}
                          <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          style={{ height: "46px" }}
                          type="time"
                          value={arrivalTime}
                          isInvalid={!!validationErrors.arrivalTime}
                          onChange={(e) => {
                            setArrivalTime(e.target.value);
                            if (e.target.value) clearError("arrivalTime");
                          }}
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.arrivalTime}
                        </Form.Control.Feedback>
                      </Col>
                    </Row>

                    <Row className="g-3 mb-3 align-items-end">
                      <Col md={3}>
                        <Form.Label className="fw-semibold">
                          Drop <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Select
                          style={{ height: "46px" }}
                          value={dropoffKind}
                          isInvalid={!!validationErrors.dropoffKind}
                          onChange={(e) => {
                            setDropoffKind(e.target.value);
                            setDropoffItem(null);
                            // Accommodation drops don't carry a departure
                            // time — clear any previously entered value so a
                            // stale time isn't sent once the field is hidden.
                            if (e.target.value === "HOTEL")
                              setDropDepartureTime("");
                            if (e.target.value) clearError("dropoffKind");
                            clearError("dropoffItem");
                          }}
                        >
                          <option value="">— Select —</option>
                          <option value="AIRPORT">Airport</option>
                          <option value="HOTEL">Accommodation</option>
                          <option value="PLACE">Place</option>
                        </Form.Select>
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.dropoffKind}
                        </Form.Control.Feedback>
                      </Col>

                      <Col md={3}>
                        <Form.Label className="fw-semibold">
                          {dropoffKind === "AIRPORT"
                            ? "Airport"
                            : dropoffKind === "HOTEL"
                              ? "Accommodation"
                              : dropoffKind === "PLACE"
                                ? "Place"
                                : "Drop Facility"}{" "}
                          {dropoffKind ? (
                            <span className="text-danger">*</span>
                          ) : null}
                        </Form.Label>
                        <Select
                          options={
                            dropoffKind === "AIRPORT"
                              ? dropAirportOpts
                              : dropoffKind === "HOTEL"
                                ? dropHotelOpts
                                : dropoffKind === "PLACE"
                                  ? dropPlaceOpts
                                  : []
                          }
                          value={dropoffItem}
                          isLoading={
                            dropoffKind === "AIRPORT"
                              ? isDropAirportLoading
                              : dropoffKind === "HOTEL"
                                ? isDropHotelLoading
                                : dropoffKind === "PLACE"
                                  ? isDropPlaceLoading
                                  : false
                          }
                          isDisabled={
                            !dropoffKind ||
                            (changeDropCity ? !dropCity : !city)
                          }
                          onChange={(opt) => {
                            setDropoffItem(opt);
                            if (opt) clearError("dropoffItem");
                          }}
                          isSearchable
                          isClearable
                          placeholder={
                            (changeDropCity ? !dropCity : !city)
                              ? changeDropCity
                                ? "Pick a drop city first"
                                : "Pick a city first"
                              : !dropoffKind
                                ? "Pick a type first"
                                : `Select ${
                                    dropoffKind === "AIRPORT"
                                      ? "airport"
                                      : dropoffKind === "HOTEL"
                                        ? "accommodation"
                                        : "place"
                                  }`
                          }
                          menuPortalTarget={document.body}
                          styles={{
                            ...customSelectStyles,
                            control: (base) => ({
                              ...customSelectStyles.control(base),
                              borderColor: validationErrors.dropoffItem
                                ? "#dc3545"
                                : base.borderColor,
                            }),
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          }}
                        />
                        {validationErrors.dropoffItem && (
                          <div className="text-danger small mt-1">
                            {validationErrors.dropoffItem}
                          </div>
                        )}
                      </Col>

                      {/* Departure Time is hidden when the drop is an
                          Accommodation — a hotel drop has no onward
                          departure time to capture. Widens to md=6 so the
                          row stays balanced now that Adults / Children
                          have moved to their own row below. */}
                      {dropoffKind !== "HOTEL" && (
                        <Col md={6}>
                          <Form.Label className="fw-semibold">
                            Departure Time
                          </Form.Label>
                          <Form.Control
                            style={{ height: "46px" }}
                            type="time"
                            value={dropDepartureTime}
                            onChange={(e) =>
                              setDropDepartureTime(e.target.value)
                            }
                          />
                        </Col>
                      )}
                    </Row>

                    {/* Row 4 — Adults / Children / Nationality */}
                    <Row className="g-3 mb-3 align-items-end">
                      <Col md={3}>
                        <Form.Label className="fw-semibold">Adults</Form.Label>
                        <Form.Select
                          style={{ height: "46px" }}
                          value={transferAdults}
                          onChange={(e) =>
                            setTransferAdults(parseInt(e.target.value) || 1)
                          }
                        >
                          {Array.from({ length: 9 }, (_, i) => i + 1).map(
                            (num) => (
                              <option key={num} value={num}>
                                {num} Adult{num > 1 ? "s" : ""}
                              </option>
                            ),
                          )}
                        </Form.Select>
                      </Col>

                      <Col md={3}>
                        <Form.Label className="fw-semibold">
                          Children
                        </Form.Label>
                        <Form.Select
                          style={{ height: "46px" }}
                          value={transferChildren}
                          onChange={(e) =>
                            setTransferChildren(parseInt(e.target.value) || 0)
                          }
                        >
                          {Array.from({ length: 6 }, (_, i) => i).map((num) => (
                            <option key={num} value={num}>
                              {num} Child{num !== 1 ? "ren" : ""}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>

                      {/* Nationality — reuses the existing nationalityList +
                          debouncedCountrySearch hooks that were already wired
                          for the legacy form (kept invisible until now). The
                          dropdown is sourced from /api/country?limit=50 on
                          mount and re-queried as the user types. */}
                      <Col md={6}>
                        <Form.Label className="fw-semibold">
                          Nationality
                        </Form.Label>
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
                          menuPortalTarget={document.body}
                          styles={{
                            ...customSelectStyles,
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          }}
                        />
                        {/* Surface UAE-resident status to the operator
                            so they can apply the resident rate. Matches
                            ISO-2 "AE", ISO-3 "ARE", shorthand "UAE",
                            and falls back to label text. */}
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
                              The guest is a resident of the UAE.
                            </div>
                          ) : null;
                        })()}
                      </Col>
                    </Row>

                    {/* Row 5 — Currency selector (currencyCode-only). The
                        chosen code is carried forward to the booking page
                        for downstream conversion; the search payload is
                        unchanged. */}
                    <Row className="g-3 mb-3 align-items-end">
                      <Col md={3}>
                        <Form.Label className="fw-semibold">
                          Currency
                        </Form.Label>
                        <Select
                          options={currencyOptions}
                          value={currency}
                          isLoading={isCurrencyLoading}
                          onChange={(opt) => setCurrency(opt)}
                          placeholder="Select currency"
                          isSearchable
                          isClearable
                          menuPortalTarget={document.body}
                          styles={{
                            ...customSelectStyles,
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          }}
                        />
                      </Col>
                    </Row>

                    {/* Legacy/hidden fields kept in state but invisible.
                        The original Trip Type radios + Origin/Destination/
                        Time-type rows are no longer rendered — the simplified
                        criteria above replace them. */}
                    <div className="d-none">
                      <Form.Check
                        type="radio"
                        checked={tripType === "ONE_WAY"}
                        onChange={() => setTripType("ONE_WAY")}
                        label="One way"
                      />

                    {/* ── NEW: Origin / Destination / Passengers row ──────── */}
                    <Row className="g-3 mb-3">
                      <Col md={4}>
                        <Form.Label className="fw-semibold">Origin<span className="text-danger">*</span></Form.Label>
                        <Select
                          options={zoneLocationOptions}
                          value={origin}
                          onChange={(opt) => {
                            setOrigin(opt);
                            if (opt) clearError("origin");
                          }}
                          onInputChange={(input, { action }) => {
                            if (action !== "input-change") return;
                            clearTimeout(window.__cabOriginDebounce);
                            window.__cabOriginDebounce = setTimeout(
                              () => fetchLookup(input || ""),
                              300,
                            );
                          }}
                          filterOption={() => true}
                          formatOptionLabel={formatLookupOptionLabel}
                          isLoading={isZoneOptsLoading}
                          placeholder="Search zone / hotel / airport"
                          isSearchable
                          isClearable
                          className="modern-select-sm"
                          menuPortalTarget={document.body}
                          noOptionsMessage={({ inputValue }) =>
                            inputValue ? "No matches" : "Type to search…"
                          }
                          styles={{
                            ...customSelectStyles,
                            control: (base) => ({
                              ...customSelectStyles.control(base),
                              borderColor: validationErrors.origin
                                ? "#dc3545"
                                : base.borderColor,
                            }),
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                            groupHeading: (base) => ({
                              ...base,
                              fontWeight: 700,
                              color: "#212529",
                              textTransform: "uppercase",
                              fontSize: "0.75rem",
                            }),
                          }}
                        />
                        {validationErrors.origin && (
                          <div className="text-danger small mt-1">
                            {validationErrors.origin}
                          </div>
                        )}
                      </Col>

                      <Col md={4}>
                        <Form.Label className="fw-semibold">
                          Destination<span className="text-danger">*</span>
                        </Form.Label>
                        <Select
                          options={zoneLocationOptions}
                          value={
                            destination && destination.source
                              ? destination
                              : null
                          }
                          onChange={(opt) => {
                            setDestination(opt);
                            if (opt) clearError("destination");
                          }}
                          onInputChange={(input, { action }) => {
                            if (action !== "input-change") return;
                            clearTimeout(window.__cabDestDebounce);
                            window.__cabDestDebounce = setTimeout(
                              () => fetchLookup(input || ""),
                              300,
                            );
                          }}
                          filterOption={() => true}
                          formatOptionLabel={formatLookupOptionLabel}
                          isLoading={isZoneOptsLoading}
                          placeholder="Search zone / hotel / airport"
                          isSearchable
                          isClearable
                          className="modern-select-sm"
                          menuPortalTarget={document.body}
                          noOptionsMessage={({ inputValue }) =>
                            inputValue ? "No matches" : "Type to search…"
                          }
                          styles={{
                            ...customSelectStyles,
                            control: (base) => ({
                              ...customSelectStyles.control(base),
                              borderColor: validationErrors.destination
                                ? "#dc3545"
                                : base.borderColor,
                            }),
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                            groupHeading: (base) => ({
                              ...base,
                              fontWeight: 700,
                              color: "#212529",
                              textTransform: "uppercase",
                              fontSize: "0.75rem",
                            }),
                          }}
                        />
                        {validationErrors.destination && (
                          <div className="text-danger small mt-1">
                            {validationErrors.destination}
                          </div>
                        )}
                      </Col>

                      <Col md={4}>
                        <Form.Label className="fw-semibold">
                          Passengers<span className="text-danger">*</span>
                        </Form.Label>
                        <Row className="g-2">
                          <Col xs={6}>
                            <Form.Select
                              style={{ height: "46px" }}
                              value={transferAdults}
                              onChange={(e) =>
                                setTransferAdults(parseInt(e.target.value) || 1)
                              }
                            >
                              {Array.from({ length: 9 }, (_, i) => i + 1).map(
                                (num) => (
                                  <option key={num} value={num}>
                                    {num} Adult{num > 1 ? "s" : ""}
                                  </option>
                                ),
                              )}
                            </Form.Select>
                          </Col>
                          <Col xs={6}>
                            <Form.Select
                              style={{ height: "46px" }}
                              value={transferChildren}
                              onChange={(e) =>
                                setTransferChildren(
                                  parseInt(e.target.value) || 0,
                                )
                              }
                            >
                              {Array.from({ length: 6 }, (_, i) => i).map(
                                (num) => (
                                  <option key={num} value={num}>
                                    {num} Child{num !== 1 ? "ren" : ""}
                                  </option>
                                ),
                              )}
                            </Form.Select>
                          </Col>
                        </Row>
                      </Col>
                    </Row>

                    {/* ── NEW: Time Type + Departure / Return rows ────────── */}
                    <Row className="g-3 mb-3 align-items-end">
                      <Col md={2}>
                        <Form.Label className="fw-semibold">
                          Time Type
                        </Form.Label>
                        <Form.Select
                          style={{ height: "46px" }}
                          value={timeType}
                          onChange={(e) => setTimeType(e.target.value)}
                        >
                          <option value="">--SELECT--</option>
                          <option value="PICKUP_TIME">Pickup time</option>
                          <option value="FLIGHT_TIME">Flight time</option>
                        </Form.Select>
                      </Col>

                      <Col md={3}>
                        <Form.Label className="fw-semibold">
                          Departure<span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          style={{ height: "46px" }}
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

                      <Col md={2}>
                        <Form.Label className="fw-semibold">
                          {timeType === "FLIGHT_TIME"
                            ? "Flight time"
                            : "Pickup time"}
                        </Form.Label>
                        <Form.Control
                          style={{ height: "46px" }}
                          type="time"
                          value={departureTime}
                          onChange={(e) => setDepartureTime(e.target.value)}
                        />
                      </Col>

                      <Col md={3}>
                        <Form.Label className="fw-semibold">Return</Form.Label>
                        <Form.Control
                          style={{ height: "46px" }}
                          type="date"
                          value={transferDropoffDate}
                          disabled={tripType === "ONE_WAY"}
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

                      <Col md={2}>
                        <Form.Label className="fw-semibold">
                          {timeType === "FLIGHT_TIME"
                            ? "Flight time"
                            : "Pickup time"}
                        </Form.Label>
                        <Form.Control
                          style={{ height: "46px" }}
                          type="time"
                          value={returnTime}
                          disabled={tripType === "ONE_WAY"}
                          onChange={(e) => setReturnTime(e.target.value)}
                        />
                      </Col>
                    </Row>

                    {/* Nationality + Agent — kept on the same row so the
                        operator can pick the traveller's nationality and the
                        booking agent side-by-side. Both fields are required
                        (agent drives markup + balance lookup downstream). */}
                    <Row className="g-3 mb-3">
                      <Col md={4}>
                        <Form.Label className="fw-semibold">
                          Nationality<span className="text-danger">*</span>
                        </Form.Label>
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
                              borderColor: validationErrors.nationality
                                ? "#dc3545"
                                : base.borderColor,
                            }),
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          }}
                        />
                        {validationErrors.nationality && (
                          <div className="text-danger small mt-1">
                            {validationErrors.nationality}
                          </div>
                        )}
                        {/* Surface UAE-resident status to the operator
                            so they can apply the resident rate. Matches
                            ISO-2 "AE", ISO-3 "ARE", shorthand "UAE",
                            and falls back to label text. */}
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
                              The guest is a resident of the UAE.
                            </div>
                          ) : null;
                        })()}
                      </Col>
                      {!isAgentRole && (
                      <Col md={4}>
                        <Form.Label className="fw-semibold">
                          Agent <span className="text-danger">*</span>
                        </Form.Label>
                        <AgentSelect
                          agents={agents}
                          value={agent}
                          isInvalid={!!validationErrors.agent}
                          onChange={(v) => {
                            setAgent(v);
                            if (v) clearError("agent");
                          }}
                        />
                        {validationErrors.agent && (
                          <div className="text-danger small mt-1">
                            {validationErrors.agent}
                          </div>
                        )}
                        {agent && <AgentBalanceDisplay agentId={agent} />}
                      </Col>
                      )}
                    </Row>

                    {/* ── Legacy form rows hidden — values still tracked in state for
                    backward compat with the existing search payload. */}
                    <div className="d-none">
                      <Row className="g-3 mb-3">
                        <Col md={4}>
                          <Form.Label className="fw-semibold">
                            Destination
                          </Form.Label>
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
                                borderColor: validationErrors.destination
                                  ? "#dc3545"
                                  : base.borderColor,
                              }),
                              menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                            }}
                          />
                          {validationErrors.destination && (
                            <div className="text-danger small mt-1">
                              {validationErrors.destination}
                            </div>
                          )}
                        </Col>
                        <Col md={4}>
                          <Form.Label className="fw-semibold">
                            Pickup Date
                          </Form.Label>
                          <Form.Control
                            style={{ height: "46px" }}
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
                          <Form.Label className="fw-semibold">
                            Dropoff Date
                          </Form.Label>
                          <Form.Control
                            style={{ height: "46px" }}
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
                          <Form.Label className="fw-semibold">
                            Adults
                          </Form.Label>
                          <Form.Select
                            style={{ height: "46px" }}
                            value={transferAdults}
                            onChange={(e) =>
                              setTransferAdults(parseInt(e.target.value) || 1)
                            }
                          >
                            {Array.from({ length: 9 }, (_, i) => i + 1).map(
                              (num) => (
                                <option key={num} value={num}>
                                  {num}
                                </option>
                              ),
                            )}
                          </Form.Select>
                        </Col>

                        <Col md={4}>
                          <Form.Label className="fw-semibold">
                            Children
                          </Form.Label>
                          <Form.Select
                            style={{ height: "46px" }}
                            value={transferChildren}
                            onChange={(e) =>
                              setTransferChildren(parseInt(e.target.value) || 0)
                            }
                          >
                            {Array.from({ length: 6 }, (_, i) => i).map(
                              (num) => (
                                <option key={num} value={num}>
                                  {num}
                                </option>
                              ),
                            )}
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
                          <Form.Label className="fw-semibold">
                            Pickup Type
                          </Form.Label>
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
                            Pickup{" "}
                            {pickupType === "HOTEL"
                              ? "Hotel"
                              : pickupType === "AIRPORT"
                                ? "Airport"
                                : "Name"}
                            {pickupType ? " *" : ""}
                          </Form.Label>
                          {pickupType === "HOTEL" ? (
                            // Dropdown sourced from /api/hotels/lookup filtered by
                            // destination country + city. Sends the hotel NAME to
                            // the backend search, matching how cab_location.pickup
                            // stores plain text.
                            <Select
                              options={hotelOptions}
                              value={
                                hotelOptions.find(
                                  (o) => o.value === pickupName,
                                ) || null
                              }
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
                                    ? destination
                                      ? "No hotels for this city"
                                      : "No hotels found"
                                    : destination
                                      ? "Select a hotel"
                                      : "Select a hotel (choose destination to filter)"
                              }
                              noOptionsMessage={() =>
                                isHotelLoading
                                  ? "Loading..."
                                  : "No hotels found"
                              }
                              menuPortalTarget={document.body}
                              styles={{
                                ...customSelectStyles,
                                control: (base) => ({
                                  ...customSelectStyles.control(base),
                                  borderColor: validationErrors.pickupName
                                    ? "#dc3545"
                                    : base.borderColor,
                                }),
                                menuPortal: (base) => ({
                                  ...base,
                                  zIndex: 9999,
                                }),
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
                                if (e.target.value.trim())
                                  clearError("pickupName");
                              }}
                            />
                          )}
                          {validationErrors.pickupName && (
                            <div className="text-danger small mt-1">
                              {validationErrors.pickupName}
                            </div>
                          )}
                        </Col>

                        <Col md={4}>
                          <Form.Label className="fw-semibold">
                            Pickup Time{" "}
                            {pickupType === "AIRPORT" ? "*" : "(optional)"}
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
                          <Form.Label className="fw-semibold">
                            Dropoff Type
                          </Form.Label>
                          <Form.Select
                            style={{ height: "46px" }}
                            value={dropoffType}
                            onChange={(e) => {
                              setDropoffType(e.target.value);
                              setDropoffName("");
                              clearError("dropoffName");
                              if (e.target.value !== "AIRPORT")
                                setDropoffTime("");
                            }}
                          >
                            <option value="">— Select —</option>
                            <option value="HOTEL">Hotel</option>
                            <option value="AIRPORT">Airport</option>
                          </Form.Select>
                        </Col>

                        <Col md={4}>
                          <Form.Label className="fw-semibold">
                            Dropoff{" "}
                            {dropoffType === "HOTEL"
                              ? "Hotel"
                              : dropoffType === "AIRPORT"
                                ? "Airport"
                                : "Name"}
                            {dropoffType ? " *" : ""}
                          </Form.Label>
                          {dropoffType === "HOTEL" ? (
                            <Select
                              options={hotelOptions}
                              value={
                                hotelOptions.find(
                                  (o) => o.value === dropoffName,
                                ) || null
                              }
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
                                    ? destination
                                      ? "No hotels for this city"
                                      : "No hotels found"
                                    : destination
                                      ? "Select a hotel"
                                      : "Select a hotel (choose destination to filter)"
                              }
                              noOptionsMessage={() =>
                                isHotelLoading
                                  ? "Loading..."
                                  : "No hotels found"
                              }
                              menuPortalTarget={document.body}
                              styles={{
                                ...customSelectStyles,
                                control: (base) => ({
                                  ...customSelectStyles.control(base),
                                  borderColor: validationErrors.dropoffName
                                    ? "#dc3545"
                                    : base.borderColor,
                                }),
                                menuPortal: (base) => ({
                                  ...base,
                                  zIndex: 9999,
                                }),
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
                                if (e.target.value.trim())
                                  clearError("dropoffName");
                              }}
                            />
                          )}
                          {validationErrors.dropoffName && (
                            <div className="text-danger small mt-1">
                              {validationErrors.dropoffName}
                            </div>
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
                    </div>
                    </div>

                    <Row className="justify-content-center">
                      <Col
                        md={4}
                        className="d-flex justify-content-center mt-3"
                      >
                        <Button
                          variant="warning"
                          className="px-5 py-2 fw-bold"
                          type="submit"
                          disabled={transferLoading}
                        >
                          {transferLoading ? (
                            <>
                              <Spinner
                                animation="border"
                                size="sm"
                                className="me-2"
                              />
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
                          <Form.Label className="mb-2 fw-semibold">
                            Child Ages
                          </Form.Label>
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
                                  handleTransferChildAgeChange(
                                    index,
                                    e.target.value,
                                  )
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
                </div>
                {/* Ads carousel — city matches first, then all active ads */}
                <AdvertisementCarousel
                  cityId={city?.value}
                  cityName={city?.label}
                />
              </div>

              {/* Loading State */}
              {transferLoading && (
                <Card className="shadow-sm rounded-xl mb-4 mt-4 border-0">
                  <Card.Body className="text-center py-5">
                    <Spinner
                      animation="border"
                      variant="primary"
                      style={{ width: "3rem", height: "3rem" }}
                    />
                    <h5 className="text-primary fw-bold mt-3 mb-1">
                      Searching Transfers...
                    </h5>
                    <p className="text-muted small mb-0">
                      {transferPickupDate
                        ? `Searching for transfer from ${transferPickupDate}${
                            tripType === "ROUND_TRIP" && transferDropoffDate
                              ? ` to ${transferDropoffDate}`
                              : ""
                          }`
                        : "Finding available transfer options for you"}
                    </p>
                    <div className="mt-3 mx-auto" style={{ maxWidth: 480 }}>
                      <ProgressBar animated now={100} variant="primary" />
                    </div>
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
              {hasTransferSearched &&
                !transferLoading &&
                transferResults.length > 0 &&
                (() => {
                  // ── Flatten cabs into (cab, detail) rows so each option
                  //   shows as its own card (matches the reference UI).
                  //   Then apply name + supplier filters and sort by the
                  //   currently selected key.
                  const rows = [];
                  transferResults.forEach((cab) => {
                    const details = Array.isArray(cab.searchCabDetailsDTO)
                      ? cab.searchCabDetailsDTO.filter((d) => {
                          const t = String(d.types || "").toUpperCase();
                          if (transferType === "Shared") return t === "SIC";
                          if (transferType === "Private") return t === "PRIVATE";
                          return t === "SIC" || t === "PRIVATE";
                        })
                      : [];
                    details.forEach((d) => rows.push({ cab, detail: d }));
                  });

                  const supplierNames = Array.from(
                    new Set(
                      transferResults
                        .map((c) => c.cabProviderName)
                        .filter(Boolean),
                    ),
                  );

                  const trimmedName = nameFilter.trim().toLowerCase();
                  const filtered = rows.filter(({ cab }) => {
                    if (
                      trimmedName &&
                      !String(cab.cabname || "")
                        .toLowerCase()
                        .includes(trimmedName)
                    ) {
                      return false;
                    }
                    if (
                      selectedSuppliers.length > 0 &&
                      !selectedSuppliers.includes(cab.cabProviderName)
                    ) {
                      return false;
                    }
                    return true;
                  });

                  filtered.sort((a, b) => {
                    if (sortBy === "name") {
                      return String(a.cab.cabname || "").localeCompare(
                        String(b.cab.cabname || ""),
                      );
                    }
                    const pa = priceDetail(a.detail).total || 0;
                    const pb = priceDetail(b.detail).total || 0;
                    return pa - pb;
                  });

                  const totalPages = Math.max(
                    1,
                    Math.ceil(filtered.length / pageSize),
                  );
                  const safePage = Math.min(currentPage, totalPages);
                  const pageStart = (safePage - 1) * pageSize;
                  const pageRows = filtered.slice(
                    pageStart,
                    pageStart + pageSize,
                  );

                  const renderPagination = () => (
                    <div className="d-flex justify-content-end align-items-center gap-2 small">
                      <Button
                        size="sm"
                        variant="link"
                        className="text-decoration-none p-1"
                        disabled={safePage === 1}
                        onClick={() => setCurrentPage(1)}
                      >
                        First
                      </Button>
                      <Button
                        size="sm"
                        variant="link"
                        className="text-decoration-none p-1"
                        disabled={safePage === 1}
                        onClick={() => setCurrentPage(safePage - 1)}
                      >
                        Previous
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (p) => (
                          <Button
                            key={p}
                            size="sm"
                            variant={p === safePage ? "primary" : "outline-secondary"}
                            className="px-2 py-0"
                            onClick={() => setCurrentPage(p)}
                          >
                            {p}
                          </Button>
                        ),
                      )}
                      <Button
                        size="sm"
                        variant="link"
                        className="text-decoration-none p-1"
                        disabled={safePage === totalPages}
                        onClick={() => setCurrentPage(safePage + 1)}
                      >
                        Next
                      </Button>
                      <Button
                        size="sm"
                        variant="link"
                        className="text-decoration-none p-1"
                        disabled={safePage === totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        Last
                      </Button>
                    </div>
                  );

                  return (
                    <div className="mt-4">
                      <Row className="g-3">
                        {/* ── LEFT: Filter panel ─────────────────────── */}
                        <Col lg={3} md={4}>
                          <Card className="border-0 shadow-sm rounded-3 mb-3">
                            <Card.Header className="bg-white border-bottom fw-semibold d-flex justify-content-between align-items-center">
                              <span className="text-primary">
                                Search by Transfer Name
                              </span>
                              <span className="text-muted small">▾</span>
                            </Card.Header>
                            <Card.Body className="p-3">
                              <div className="d-flex gap-2">
                                <Form.Control
                                  type="text"
                                  size="sm"
                                  placeholder="Search"
                                  value={pendingNameFilter}
                                  onChange={(e) =>
                                    setPendingNameFilter(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      setNameFilter(pendingNameFilter);
                                      setCurrentPage(1);
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="primary"
                                  className="px-3"
                                  onClick={() => {
                                    setNameFilter(pendingNameFilter);
                                    setCurrentPage(1);
                                  }}
                                >
                                  GO
                                </Button>
                              </div>
                            </Card.Body>
                          </Card>

                          <Card className="border-0 shadow-sm rounded-3 mb-3">
                            <Card.Header className="bg-white border-bottom fw-semibold d-flex justify-content-between align-items-center">
                              <span className="text-primary">Suppliers</span>
                              <span className="text-muted small">▾</span>
                            </Card.Header>
                            <Card.Body className="p-3">
                              {supplierNames.length === 0 ? (
                                <div className="text-muted small">
                                  No suppliers in results.
                                </div>
                              ) : (
                                supplierNames.map((s) => (
                                  <Form.Check
                                    key={s}
                                    type="checkbox"
                                    id={`supplier-${s}`}
                                    label={s}
                                    className="small"
                                    checked={pendingSuppliers.includes(s)}
                                    onChange={(e) => {
                                      setPendingSuppliers((prev) =>
                                        e.target.checked
                                          ? [...prev, s]
                                          : prev.filter((x) => x !== s),
                                      );
                                    }}
                                  />
                                ))
                              )}
                            </Card.Body>
                          </Card>

                          <Card className="border-0 shadow-sm rounded-3 mb-3">
                            <Card.Header className="bg-white border-bottom fw-semibold d-flex justify-content-between align-items-center">
                              <span className="text-primary">Transfer Type</span>
                              <span className="text-muted small">▾</span>
                            </Card.Header>
                            <Card.Body className="p-3">
                              <Form.Check
                                type="radio"
                                id="filter-all"
                                name="filterTransferType"
                                label="All"
                                className="small"
                                checked={transferType === "All"}
                                onChange={() => {
                                  setTransferType("All");
                                  setCurrentPage(1);
                                }}
                              />
                              <Form.Check
                                type="radio"
                                id="filter-shared"
                                name="filterTransferType"
                                label="Shared (SIC)"
                                className="small"
                                checked={transferType === "Shared"}
                                onChange={() => {
                                  setTransferType("Shared");
                                  setCurrentPage(1);
                                }}
                              />
                              <Form.Check
                                type="radio"
                                id="filter-private"
                                name="filterTransferType"
                                label="Private"
                                className="small"
                                checked={transferType === "Private"}
                                onChange={() => {
                                  setTransferType("Private");
                                  setCurrentPage(1);
                                }}
                              />
                            </Card.Body>
                          </Card>

                          <Button
                            variant="primary"
                            className="w-100 fw-bold"
                            onClick={() => {
                              setNameFilter(pendingNameFilter);
                              setSelectedSuppliers(pendingSuppliers);
                              setCurrentPage(1);
                            }}
                          >
                            APPLY FILTERS
                          </Button>
                        </Col>

                        {/* ── RIGHT: Results column ──────────────────── */}
                        <Col lg={9} md={8}>
                          {/* Sort bar */}
                          <Card className="border-0 shadow-sm rounded-3 mb-3">
                            <Card.Body className="py-2 px-3 d-flex flex-wrap align-items-center gap-2">
                              <span className="text-muted small me-1">
                                Sort By:
                              </span>
                              <Button
                                size="sm"
                                variant={
                                  sortBy === "price" ? "primary" : "light"
                                }
                                className="px-3"
                                onClick={() => setSortBy("price")}
                              >
                                ↕ Price
                              </Button>
                              <Button
                                size="sm"
                                variant={
                                  sortBy === "name" ? "primary" : "light"
                                }
                                className="px-3"
                                onClick={() => setSortBy("name")}
                              >
                                ↕ Transfer Name
                              </Button>
                            </Card.Body>
                          </Card>

                          {/* Page-of-N + count */}
                          <div className="d-flex justify-content-between align-items-center mb-2 small text-muted">
                            <div>
                              Page {safePage} of {totalPages} ({filtered.length}{" "}
                              records)
                            </div>
                            {totalPages > 1 && renderPagination()}
                          </div>

                          {(transferType === "Shared" ||
                            transferType === "All") && (
                            <div className="text-muted small mb-2">
                              Pricing for {sicPayingPax} paying pax (adults +
                              children aged &gt; 3) for shared transfers.
                            </div>
                          )}

                          {filtered.length === 0 ? (
                            <div className="text-center text-muted py-5 bg-white rounded-3 border">
                              No{" "}
                              {transferType === "Shared"
                                ? "shared (SIC)"
                                : transferType === "Private"
                                  ? "private"
                                  : ""}{" "}
                              transfers match your filters.
                            </div>
                          ) : (
                            <Row className="g-3">
                              {pageRows.map(({ cab, detail }, idx) => {
                                const {
                                  total: totalRate,
                                  perUnit,
                                  label,
                                } = priceDetail(detail);
                                return (
                                  <Col xs={12} key={`${cab.cabid}-${idx}`}>
                                    <Card className="border-0 shadow-sm rounded-3 overflow-hidden">
                                      <Card.Header className="bg-light py-2 px-3 fw-semibold text-dark">
                                        {cab.cabname || "Transfer Vehicle"}
                                      </Card.Header>
                                      <Card.Body className="p-3">
                                        <Row className="align-items-center g-3">
                                          {/* Image */}
                                          <Col xs={12} md={3}>
                                            <div
                                              style={{
                                                width: "100%",
                                                height: "120px",
                                                overflow: "hidden",
                                                borderRadius: "8px",
                                              }}
                                            >
                                              <LazyImage
                                                src={cab.cabpic}
                                                alt={cab.cabname}
                                              />
                                            </div>
                                          </Col>

                                          {/* Details */}
                                          <Col xs={12} md={6}>
                                            {(() => {
                                              const rowType = String(detail.types || "").toUpperCase();
                                              const isPrivate = rowType === "PRIVATE";
                                              return (
                                                <div className="small mb-1">
                                                  <span className="text-muted">
                                                    Transfer Type:{" "}
                                                  </span>
                                                  <span
                                                    className={`fw-medium ${
                                                      isPrivate
                                                        ? "text-success"
                                                        : "text-primary"
                                                    }`}
                                                  >
                                                    {isPrivate
                                                      ? "Private Transfer"
                                                      : "Shared (SIC)"}
                                                  </span>
                                                </div>
                                              );
                                            })()}
                                            <div className="small mb-1">
                                              <span className="text-muted">
                                                Vehicle:{" "}
                                              </span>
                                              <span className="text-dark">
                                                {cab.cabname || "—"}
                                              </span>
                                            </div>
                                            <div className="small mb-1 d-flex flex-wrap gap-3">
                                              <span>
                                                <span className="text-muted">
                                                  Max Pax Per Vehicle :{" "}
                                                </span>
                                                <span className="text-dark">
                                                  {cab.capacityMax ??
                                                    cab.noOfCabs ??
                                                    "—"}
                                                </span>
                                              </span>
                                              <span>
                                                <span className="text-muted">
                                                  Max Luggage Per Vehicle :{" "}
                                                </span>
                                                <span className="text-dark">
                                                  {cab.capacityMax ?? "—"}
                                                </span>
                                              </span>
                                            </div>
                                            {(detail.location ||
                                              detail.dropOff) && (
                                              <div className="small text-muted mb-1">
                                                {detail.location || "N/A"} →{" "}
                                                {detail.dropOff || "N/A"}
                                              </div>
                                            )}
                                            {cab.cabProviderName && (
                                              <div className="small text-muted">
                                                by {cab.cabProviderName}
                                              </div>
                                            )}
                                          </Col>

                                          {/* Price + action */}
                                          <Col
                                            xs={12}
                                            md={3}
                                            className="text-md-end"
                                          >
                                            <div className="text-success small fw-semibold mb-1">
                                              Available
                                            </div>
                                            <div className="fw-bold fs-5 mb-1">
                                              AED{" "}
                                              {Number(
                                                totalRate || 0,
                                              ).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                              })}
                                            </div>
                                            {label && (
                                              <div className="small text-muted mb-2">
                                                {perUnit > 0
                                                  ? `AED ${perUnit.toLocaleString()} ${label}`
                                                  : label}
                                              </div>
                                            )}
                                            <div className="d-flex gap-2 justify-content-md-end">
                                              <Button
                                                variant="outline-secondary"
                                                className="px-3 fw-semibold"
                                                onClick={() =>
                                                  setViewModal({ cab, detail })
                                                }
                                              >
                                                View
                                              </Button>
                                              <Button
                                                variant="primary"
                                                className="px-4 fw-semibold"
                                                onClick={() =>
                                                  handleBookNow(cab, detail)
                                                }
                                              >
                                                Select
                                              </Button>
                                            </div>
                                          </Col>
                                        </Row>
                                      </Card.Body>
                                    </Card>
                                  </Col>
                                );
                              })}
                            </Row>
                          )}

                          {totalPages > 1 && (
                            <div className="d-flex justify-content-end mt-3">
                              {renderPagination()}
                            </div>
                          )}
                        </Col>
                      </Row>
                    </div>
                  );
                })()}

              {/* No Results */}
              {hasTransferSearched &&
                !transferLoading &&
                transferResults.length === 0 && (
                  <div className="text-center text-muted mt-5 py-5 bg-white rounded-4 shadow-sm border-0">
                    <FaCar className="display-4 text-warning mb-3 opacity-75" />
                    <h5 className="text-dark">No transfers found</h5>
                    <p>
                      Try selecting different dates or destinations for your
                      search.
                    </p>
                  </div>
                )}
            </Card.Body>
          </Card>
        </main>
      </div>

      {/* ── Transfer details view modal ────────────────────────────────
          Triggered by the "View" button on each result-card row. Shows the
          fields prescribed by spec:
          - title:        "<Transfer Type> - <Vehicle Name>"
          - From / To:    location names + the source label (Airport /
                          Accommodation / Place) the user picked on the
                          form (pickupKind / dropoffKind).
          - table row:    Transfer Date / Transfer Type / Nationality /
                          Duration / Passenger / Vehicle Name
          - Transfer Info: driverWaitingTime + distance (from the backend
                          rate row — null falls back to "—").
          - Vehicle Capacity: vehicleMaxCapacity / vehicleMaxLuggage on the
                          cab row (falls back to capacityMax when not set).
          - Disclaimer:   static legal text (intentional — same on every
                          row, supplied by the business). */}
      <Modal
        show={!!viewModal}
        onHide={() => setViewModal(null)}
        size="lg"
        centered
      >
        {viewModal && (() => {
          const { cab, detail } = viewModal;
          const labelForKind = (k) =>
            k === "AIRPORT"
              ? "Airport"
              : k === "HOTEL"
                ? "Accommodation"
                : k === "PLACE"
                  ? "Place"
                  : "";
          const transferTypeLabel =
            String(detail.types || "").toUpperCase() === "SIC"
              ? "Shared Transfer"
              : "Private Transfer";
          const totalChildren = Number(transferChildren) || 0;
          const totalAdults = Number(transferAdults) || 0;
          const passengerLabel = `${totalAdults} Adult${
            totalAdults !== 1 ? "s" : ""
          }${
            totalChildren > 0
              ? `, ${totalChildren} Child${totalChildren !== 1 ? "ren" : ""}`
              : ""
          }`;
          const transferDateLabel = transferPickupDate
            ? new Date(transferPickupDate).toLocaleDateString(undefined, {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "—";
          const fromLabel = `${
            cab.originLocationName || detail.pickup || "—"
          }${pickupKind ? ` (${labelForKind(pickupKind)})` : ""}`;
          const toLabel = `${
            cab.destinationLocationName || detail.dropOff || "—"
          }${dropoffKind ? ` (${labelForKind(dropoffKind)})` : ""}`;
          const waitingTime = detail.driverWaitingTime || "—";
          const distanceLabel =
            detail.distance != null
              ? `${Number(detail.distance).toFixed(3)} Km`
              : "—";
          const maxPax =
            cab.vehicleMaxCapacity ?? cab.capacityMax ?? "—";
          const maxLuggage =
            cab.vehicleMaxLuggage ?? "—";
          return (
            <>
              <Modal.Header closeButton>
                <Modal.Title className="fs-5">
                  {transferTypeLabel} — {cab.cabname || "Vehicle"} or similar
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <div className="mb-3">
                  <div>
                    <strong>From:</strong> {fromLabel}
                  </div>
                  <div>
                    <strong>To:</strong> {toLabel}
                  </div>
                </div>

                <Table responsive bordered size="sm" className="mb-3">
                  <thead className="table-light">
                    <tr>
                      <th>Transfer Date</th>
                      <th>Transfer Type</th>
                      <th>Nationality</th>
                      <th>Duration</th>
                      <th>Passenger</th>
                      <th>Vehicle Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{transferDateLabel}</td>
                      <td>{transferTypeLabel}</td>
                      <td>{nationality?.label || "—"}</td>
                      <td>{detail.hourDetails || "NA"}</td>
                      <td>{passengerLabel}</td>
                      <td>
                        {transferTypeLabel.split(" ")[0]} — {cab.cabname}{" "}
                        or similar
                      </td>
                    </tr>
                  </tbody>
                </Table>

                <h6 className="fw-bold mt-4 mb-2">Transfer Info</h6>
                <div className="mb-1">
                  <strong>Driver Waiting Time:</strong> {waitingTime}
                </div>
                <div className="mb-3">
                  <strong>Distance:</strong> {distanceLabel}
                </div>

                <h6 className="fw-bold mt-4 mb-2">Vehicle Capacity</h6>
                <div className="mb-3">
                  Max Pax Per Vehicle : {maxPax}
                  {"    |    "}
                  Max Luggage Per Vehicle : {maxLuggage}
                </div>

                <h6 className="fw-bold mt-4 mb-2">Disclaimer</h6>
                <p className="small text-muted mb-0">
                  Whilst we believe all our transfer information and reports
                  to be accurate we shall not be liable in any way to you or
                  to any third parties should any such information or reports
                  prove to be incorrect or incomplete in any way.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="secondary"
                  onClick={() => setViewModal(null)}
                >
                  Close
                </Button>
              </Modal.Footer>
            </>
          );
        })()}
      </Modal>
    </div>
  );
};
