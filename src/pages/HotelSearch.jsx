import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  Button,
  Row,
  Col,
  Form,
  Pagination,
  Spinner,
} from "react-bootstrap";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import Select from "react-select";
import AgentSelect from "../components/AgentSelect";
import AgentCreditBalance from "../components/AgentCreditBalance";
import axiosInstance from "../components/AxiosInstance";
import AdvertisementCarousel from "../components/AdvertisementCarousel";
import TimeApplyPicker from "../components/TimeApplyPicker";
import RateCalendar from "../components/RateCalendar";
import MapModal from "../components/map/MapModal";
import { ENABLE_MAP_PREVIEW } from "../config/featureFlags";
import { FaSearch, FaStar, FaInfoCircle } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/HotelSearch.css";

// ─────────────────────────────────────────────
// Search Progress Bar
// ─────────────────────────────────────────────
// Default supplier list — used when the caller has no company restriction
// or when the parent hasn't computed a narrower list yet. Kept out of
// component body so its identity is stable across renders.
const DEFAULT_PROGRESS_CHANNELS = [
  "inhouse",
  "iwtx",
  "x3",
  "ratehawk",
  "darina",
  "atharva",
  "jumeirah",
  "grn",
];

function SearchProgressBar({ pollStatus, completedChannels, channels }) {
  const effectiveChannels =
    Array.isArray(channels) && channels.length > 0
      ? channels
      : DEFAULT_PROGRESS_CHANNELS;
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pollStatus === "IN_PROGRESS") {
      setVisible(true);
      const done = completedChannels.size;
      const target =
        done === 0
          ? 12
          : Math.min(90, 12 + (done / effectiveChannels.length) * 78);
      setProgress(target);
    } else if (pollStatus === "COMPLETED") {
      setProgress(100);
      const timer = setTimeout(() => setVisible(false), 900);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      setProgress(0);
    }
  }, [pollStatus, completedChannels]);

  if (!visible) return null;

  return (
    <div className="search-progress-bar-wrap">
      {/* Label row */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="search-progress-label">Searching hotels...</span>
        <span className="search-progress-percent">{Math.round(progress)}%</span>
      </div>

      {/* Bar */}
      <div className="search-progress-track">
        <div
          className="search-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Channel pills */}
      {/* <div className="search-progress-channels">
        {channels.map((ch) => {
          const done = completedChannels.has(ch);
          return (
            <span key={ch} className={`channel-pill ${done ? "done" : "pending"}`}>
              {done ? "✓" : <span className="pill-dot" />}
              {ch}
            </span>
          );
        })}
      </div> */}
    </div>
  );
}

// ─────────────────────────────────────────────
// Counter Button helper
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

// Maximum number of rooms allowed per booking.
const MAX_ROOMS = 5;

// ─────────────────────────────────────────────
// Room Guest Selector
// ─────────────────────────────────────────────
function RoomGuestSelector({ value, onChange }) {
  const [rooms, setRooms] = useState(value);

  // Sync internal state when the parent updates the rooms list externally
  // (e.g. the "Add Room" button beside the Rooms & Guests trigger).
  useEffect(() => {
    setRooms(value);
  }, [value]);

  const update = (next) => {
    setRooms(next);
    onChange && onChange(next);
  };

  const addRoom = () => {
    // Enforce the per-booking room cap.
    if (rooms.length >= MAX_ROOMS) return;
    update([...rooms, { adults: 1, children: 0, childAges: [] }]);
  };
  const removeRoom = (index) => update(rooms.filter((_, i) => i !== index));

  const setAdults = (index, adults) =>
    update(rooms.map((r, i) => (i === index ? { ...r, adults } : r)));

  const setChildren = (index, children) =>
    update(
      rooms.map((r, i) =>
        i === index
          ? {
              ...r,
              children,
              childAges: Array.from(
                { length: children },
                (_, j) => r.childAges[j] || 5,
              ),
            }
          : r,
      ),
    );

  const setChildAge = (roomIdx, childIdx, age) =>
    update(
      rooms.map((r, i) => {
        if (i !== roomIdx) return r;
        const ages = [...r.childAges];
        ages[childIdx] = age;
        return { ...r, childAges: ages };
      }),
    );

  return (
    <div className="rgs-wrap">
      <div className="rgs-grid">
        {rooms.map((room, i) => (
          <div key={i} className="rgs-room-card">
            <div className="rgs-room-header">
              <span className="rgs-room-label">🛏 Room {i + 1}</span>
              {rooms.length > 1 && (
                <button
                  type="button"
                  className="rgs-remove-btn"
                  onClick={() => removeRoom(i)}
                >
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
                <Counter
                  value={room.adults}
                  min={1}
                  max={6}
                  onChange={(v) => setAdults(i, v)}
                />
              </div>
              <div className="rgs-counter-row">
                <div className="rgs-counter-info">
                  <span className="rgs-counter-title">Children</span>
                  <span className="rgs-counter-sub">Age 0–17</span>
                </div>
                <Counter
                  value={room.children}
                  min={0}
                  max={4}
                  onChange={(v) => setChildren(i, v)}
                />
              </div>
            </div>

            {/* Informational guidance only — shown ONLY when this room has
                more than 2 children, so users planning that case understand
                they may need an additional room. Does NOT validate or
                restrict; the counter, child-age inputs, search payload, and
                booking flow are all unchanged. */}
            {room.children > 2 && (
              <div
                role="note"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  border: "1px solid #b6e0fe",
                  backgroundColor: "#eaf6ff",
                  color: "#084c8d",
                  borderRadius: "4px",
                  padding: "8px 10px",
                  marginTop: "8px",
                  fontSize: "0.78rem",
                  lineHeight: 1.35,
                }}
              >
                <FaInfoCircle
                  style={{ marginTop: "2px", flexShrink: 0 }}
                  aria-hidden="true"
                />
                <span>
                  Most hotels allow up to <strong>2 children per room</strong>.
                  If you have more than 2 children, you may need to book an
                  additional room.
                </span>
              </div>
            )}

            {room.children > 0 && (
              <div className="rgs-child-ages">
                <span className="rgs-child-ages-label">Child ages</span>
                <div className="rgs-child-ages-row">
                  {Array.from({ length: room.children }).map((_, idx) => (
                    <div key={idx} className="rgs-child-age-select">
                      <label className="rgs-child-age-label">
                        Child {idx + 1}
                      </label>
                      <Form.Select
                        size="sm"
                        value={room.childAges[idx] || 5}
                        onChange={(e) =>
                          setChildAge(i, idx, parseInt(e.target.value))
                        }
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

        <button
          type="button"
          className="rgs-add-room-btn"
          onClick={addRoom}
          disabled={rooms.length >= MAX_ROOMS}
        >
          <span className="rgs-add-icon">+</span>
          <span>Add Room</span>
        </button>
        {rooms.length >= MAX_ROOMS && (
          <div className="text-danger small mt-2">
            A maximum of {MAX_ROOMS} rooms can be added per booking.
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Lazy Image
// ─────────────────────────────────────────────
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

  const buildSrcSet = (url) => {
    try {
      const safeUrl = url || "https://via.placeholder.com/480x270";
      const pattern = /\/(\d+)\/(\d+)$/;
      const small = pattern.test(safeUrl)
        ? safeUrl.replace(pattern, "/320/180")
        : `${safeUrl}?w=320&h=180`;
      const medium = pattern.test(safeUrl)
        ? safeUrl.replace(pattern, "/480/270")
        : `${safeUrl}?w=480&h=270`;
      const large = pattern.test(safeUrl)
        ? safeUrl.replace(pattern, "/640/360")
        : `${safeUrl}?w=640&h=360`;
      return `${small} 320w, ${medium} 480w, ${large} 640w`;
    } catch {
      return undefined;
    }
  };

  const imageSrc = src || "https://via.placeholder.com/480x270";

  return (
    <div
      ref={containerRef}
      className={`ratio rounded-xl overflow-hidden ${className || ""}`}
      style={{ "--bs-aspect-ratio": "66.25%" }}
    >
      {!loaded && <div className="skeleton w-100 h-100" />}
      {inView && (
        <img
          src={imageSrc}
          srcSet={buildSrcSet(imageSrc)}
          sizes="(min-width:1200px) 33vw, (min-width:768px) 50vw, 100vw"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          alt={alt}
          onLoad={() => setLoaded(true)}
          className={`img-cover ${loaded ? "img-loaded" : "img-loading"}`}
        />
      )}
    </div>
  );
}

const fullText = "Search Hotel Name...";

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
// ── Props ────────────────────────────────────────────────────────────
// `force24Hour` (default false) is a hard opt-in for the dedicated
// "24 Hour Check-In" route at /new-booking/hotel-24hr. When true the
// search runs in 24-hour mode permanently (the toggle row is hidden,
// time inputs are always shown, and post-processing always probes the
// 24-hour configs). When false (the default `/new-booking/hotel` flow)
// the 24-hour UI is hidden entirely so the page is a clean normal
// hotel-booking flow — no toggle, no post-processing, no probe call.
// `religiousMode` (default false) is the same pattern as force24Hour —
// a hard opt-in for the dedicated Religious search route at
// /new-booking/religious. When true:
//   • the Destination / City picker is locked to a hardcoded list of
//     Mecca + Medina (no /api/province cascade, no search),
//   • the page heading picks up a "Religious" tag,
//   • the "View Rooms" navigation targets /religious-room-list instead
//     of /room-list, so RoomListReligious/HotelBookingPageReligious can
//     thread the flag through to the create payload + booking list
//     without touching the normal hotel-booking route.
export default function HotelSearch({
  force24Hour = false,
  religiousMode = false,
} = {}) {
  // Hardcoded destination options for the Religious flow — see
  // planning notes above. IDs pulled from master_state:
  //   5219  = Makkah (Saudi Arabia, country_id 233)
  //   10773 = Al Madinah Al Munawwarah (Saudi Arabia, country_id 233)
  // Kept as a module-level constant so it's trivially removable if the
  // religious flow is ever wound down.
  const RELIGIOUS_DESTINATIONS = [
    { value: 5219,  label: "Mecca (Makkah)",           countryId: 233, code: "SA" },
    { value: 10773, label: "Medina (Al Madinah)",     countryId: 233, code: "SA" },
  ];
  const [placeholder, setPlaceholder] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Agent logins book under themselves — the backend forces the booking,
  // quote and search markup to the logged-in agent (see
  // LongStayBookingController / LongStaySearchController), so the manual
  // Agent picker is hidden and the agent-required validation is skipped.
  // currentActiveRole isn't set for single-role logins, so fall back to
  // userRole; admin/super-admin/staff keep the picker exactly as before.
  const activeRole = (localStorage.getItem("currentActiveRole") || "")
    .trim()
    .toUpperCase();
  const storedRoles = (localStorage.getItem("userRole") || "").toUpperCase();
  const isAgentRole = activeRole
    ? activeRole === "AGENT"
    : storedRoles.includes("AGENT") && !storedRoles.includes("ADMIN");

  // Logged-in agent's name — for agent logins the booking is "done by" the
  // agent themselves, so the "Booking Done By Employee" picker is hidden and
  // this name is shown (and sent) instead. Same source the payload's
  // agentName uses for agent logins. Empty for admin/staff.
  const loggedInAgentName =
    localStorage.getItem("UserName") ||
    sessionStorage.getItem("UserName") ||
    "";

  // When user came here via "Edit -> Book Again" from a booking detail page,
  // parentBookingCode is in the URL (e.g. ?parentBookingCode=GLBIN37). It is
  // threaded through to HotelBookingPage so the new booking is saved as a
  // child of that primary booking (GLBIN37/1, GLBIN37/2, ...).
  const parentBookingCode = new URLSearchParams(location.search).get(
    "parentBookingCode"
  );
  const [nationalityList, setNationalityList] = useState([]);
  const [selectedNationality, setSelectedNationality] = useState(null);
  // Optional "Booking Done By Employee" selector — moved here from
  // HotelBookingPage. When set, the employeeId rides on the payload all
  // the way through RoomList → HotelBookingPage → /api/hotel-booking/create
  // so it's persisted on the new HotelBooking row.
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axiosInstance.get("/api/employee?page=0&limit=1000");
        if (res.data && Array.isArray(res.data)) {
          setEmployees(res.data);
        }
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
    };
    fetchEmployees();
  }, []);
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [nights, setNights] = useState(1);
  // Longest stay this search form allows. Enforced both when the user types
  // directly into the Nights field and when they pick a Check-Out date more
  // than MAX_NIGHTS days after Check-In.
  const MAX_NIGHTS = 15;
  const NIGHTS_LIMIT_MESSAGE = `Maximum stay allowed is ${MAX_NIGHTS} nights.`;
  // Guards the checkIn/checkOut effect below from immediately clearing the
  // limit error on the render that follows our own auto-corrective
  // setCheckOut call (see that effect for details).
  const isAutoCorrectingNights = useRef(false);
  const [agent, setAgent] = useState("");
  const [agentBalance, setAgentBalance] = useState(null);
  const [agentBalanceLoading, setAgentBalanceLoading] = useState(false);

  useEffect(() => {
    if (!agent) {
      setAgentBalance(null);
      return;
    }
    let cancelled = false;
    setAgentBalanceLoading(true);
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${agent}`)
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
  }, [agent]);
  const [rooms, setRooms] = useState([
    { adults: 1, children: 0, childAges: [] },
  ]);
  const [roomsOpen, setRoomsOpen] = useState(false);

  const [starRating, setStarRating] = useState(null);
  const [hotelType, setHotelType] = useState([]);
  const [channelType, setChannelType] = useState([]);
  // Per-company supplier allow-list — populated once on mount from
  // /api/hotel-search/my-allowed-suppliers. When `channelsUnrestricted`
  // is true (no company assigned or no picks made yet) the sidebar
  // channel filter keeps every option visible. Otherwise it narrows to
  // the codes in `allowedChannels` so admins/agents only see the
  // suppliers the super_admin has actually enabled for their company.
  //
  // Purely presentational — the server-side HotelApiCallerContext is
  // still the authoritative gate on which suppliers are queried.
  const [allowedChannels, setAllowedChannels] = useState(new Set());
  const [channelsUnrestricted, setChannelsUnrestricted] = useState(true);
  // Available Deals multi-select filter (array of option values).
  // Empty array = no filter. Matching is OR across selected options.
  const [availableDeals, setAvailableDeals] = useState([]);
  const [sortBy, setSortBy] = useState("priceAsc");
  const [hotelSearchTerm, setHotelSearchTerm] = useState("");
  const [errors, setErrors] = useState({});
  // "Explore on Map" modal — shows every currently-visible hotel with
  // usable coordinates. See components/map/MapModal.jsx.
  const [showMapModal, setShowMapModal] = useState(false);

  // ── Currency conversion (display only) ────────────────────────────────
  // Search rates come back in AED (the base currency). The currency dropdown
  // lets the operator view the same rates in another currency: each option
  // carries the master_currency `value` (multiplier relative to AED), so the
  // displayed price is baseRate(AED) × (target.value / AED.value). This is a
  // pure display transform — hotel.price (AED) and every downstream payload
  // stay in AED, so no other flow is affected.
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  // Once the operator picks a currency manually we stop auto-defaulting it to
  // the agent's currency (so their choice sticks).
  const currencyTouchedRef = useRef(false);
  // For agent logins, the agent's own id (resolved below) used to default the
  // display currency to that agent's configured currency.
  const [selfAgentId, setSelfAgentId] = useState("");

  // ── 24 Hour Check-In opt-in state ────────────────────────────────────
  // When `is24HourCheckin` is true, the search post-processes results: each
  // hotel is probed against /api/24-hour-checkin/probe-bulk; ineligible
  // hotels are filtered out and the displayed rate is uplifted by the
  // configured percentage. When false, the search behaves exactly as before.
  // Seeded from `force24Hour` so the dedicated 24-hour route ships in
  // 24-hour mode from first render (no flicker). The normal route keeps
  // this false and the entire 24-hour code path stays dormant.
  const [is24HourCheckin, setIs24HourCheckin] = useState(force24Hour);
  const [checkInTime24, setCheckInTime24] = useState("14:00");
  const [checkOutTime24, setCheckOutTime24] = useState("14:00"); // +24h default
  // Map of hotelId → { eligible, percentage } returned by the probe endpoint.
  const [twentyFourHourMap, setTwentyFourHourMap] = useState({});
  const [clickedHotelIds, setClickedHotelIds] = useState([]);

  // Map of hotelId → { longStay, twentyFourHourCheckIn, lastMinute, dayStay,
  // meetAndSpace, govEmployeeDiscount, studentDiscount } returned by
  // /api/hotel-feature-flags. Drives the scrolling "Exclusive Deals" banner
  // above the search results and the per-hotel blinking "Flash Sale" pill.
  const [featureFlagsMap, setFeatureFlagsMap] = useState({});

  const [allResults, setAllResults] = useState([]);
  const [finalHotelSearchTerm, setFinalHotelSearchTerm] = useState("");
  // Mirror of finalHotelSearchTerm so the poll callback (a closure captured
  // at handleSearchSubmit-time) can read the live value and skip its merge
  // while a name filter is active. Without this the poll keeps repopulating
  // allResults with unfiltered rows, undoing /filter-by-name mid-poll.
  const finalHotelSearchTermRef = useRef("");
  useEffect(() => {
    finalHotelSearchTermRef.current = finalHotelSearchTerm;
  }, [finalHotelSearchTerm]);

  // Fetch the caller's per-company supplier allow-list once on mount so
  // the Channel sidebar filter can show only the suppliers the caller is
  // actually allowed to hit. Fail-open: any error keeps every channel
  // visible (matches the server-side "empty allow-list = no restriction"
  // rule) so a transient DB hiccup never accidentally narrows the UI.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get(
          "/api/hotel-search/my-allowed-suppliers",
        );
        if (cancelled) return;
        const unrestricted = res?.data?.unrestricted !== false;
        const codes = Array.isArray(res?.data?.codes) ? res.data.codes : [];
        setChannelsUnrestricted(unrestricted);
        setAllowedChannels(
          new Set(codes.map((c) => String(c || "").toLowerCase())),
        );
      } catch (_) {
        if (!cancelled) {
          setChannelsUnrestricted(true);
          setAllowedChannels(new Set());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // Sequence guard for /filter-by-name — an older response can arrive after
  // a newer one (500 ms debounce, no XHR cancel) and stomp results for the
  // wrong term. Only the response whose seq matches the latest issued call
  // is allowed to write to state.
  const nameSearchSeqRef = useRef(0);
  const [agents, setAgents] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  // When results are on screen the big search form collapses into a sticky
  // summary strip. Clicking "Modify Search" flips this true to re-expand it.
  const [isEditingSearch, setIsEditingSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasSearchResult, setHasSearchResult] = useState(false);
  const [pollStatus, setPollStatus] = useState("IDLE");
  const completedChannelsRef = useRef(new Set());
  const [completedChannels, setCompletedChannels] = useState(new Set());
  const [searchId, setSearchId] = useState(null);
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);
  const resultsRef = useRef(null);
  const [isInitialResultsLoaded, setIsInitialResultsLoaded] = useState(false);
  const [isNationalityLoading, setIsNationalityLoading] = useState(false);

  const starOptions = [
    { value: 5, label: "5 Stars" },
    { value: 4, label: "4 Stars" },
    { value: 3, label: "3 Stars" },
    { value: 2, label: "2 Stars" },
    { value: 1, label: "1 Star" },
  ];

  const hotelTypeOptions = [
    { value: "hotel", label: "Hotel" },
    { value: "villa", label: "Villa" },
    { value: "resort", label: "Resort" },
    { value: "apartment", label: "Apartment" },
  ];

  const channelTypeOptions = [
    { value: "inhouse", label: "Inhouse" },
     { value: "iwtx", label: "Iwtx" },
     { value: "x3", label: "x3" },
     { value: "atharva", label: "Atharva" },
     { value: "jumeirah", label: "Jumeirah" },
     { value: "ratehawk", label: "Ratehawk" },
     { value: "darina", label: "Darina" },
     { value: "grn", label: "GRN" },
     { value: "goglobal", label: "GoGlobal" },
  ];

  // Narrows the Channel sidebar filter (and the SearchProgressBar pills)
  // to the suppliers this caller's company has enabled. When the caller
  // is unrestricted — no company assignment, or the allow-list is empty —
  // every option stays visible, so no existing flow is affected.
  const visibleChannelTypeOptions = channelsUnrestricted
    ? channelTypeOptions
    : channelTypeOptions.filter((o) => allowedChannels.has(o.value));
  const visibleProgressChannels = channelsUnrestricted
    ? undefined // let SearchProgressBar keep its own default
    : channelTypeOptions
        .filter((o) => allowedChannels.has(o.value))
        .map((o) => o.value);

  // Available Deals filter options. Each option maps to a per-hotel
  // predicate evaluated against the feature-flag map and the search
  // DTO's hasDestinationSales flag. "Flash Sale" matches any hotel
  // with at least one feature label (mirrors the corner badge logic).
  const availableDealsOptions = [
    { value: "flashSale",        label: "Flash Sale" },
    { value: "longStay",         label: "Long Stay" },
    { value: "twentyFourHour",   label: "24 Hour Check-In" },
    { value: "lastMinute",       label: "Last Minute" },
    { value: "dayStay",          label: "Day Stay" },
    { value: "meetingSpace",     label: "Meeting & Space" },
    { value: "govEmployee",      label: "Govt Employee Discount" },
    { value: "studentDiscount",  label: "Student Discount" },
    { value: "seniorCitizen",    label: "Senior Citizen" },
    { value: "destinationSales", label: "Destination Sales" },
  ];

  useEffect(() => {
    let index = 0;
    let isDeleting = false;
    const interval = setInterval(() => {
      if (!isDeleting) {
        setPlaceholder(fullText.slice(0, index + 1));
        index++;
        if (index === fullText.length)
          setTimeout(() => (isDeleting = true), 900);
      } else {
        setPlaceholder(fullText.slice(0, index - 1));
        index--;
        if (index === 0) isDeleting = false;
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

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

  const debouncedCitySearch = useRef(
    debounce(async (searchText = "") => {
      // Religious flow — freeze the dropdown to Mecca + Medina; typed
      // input never triggers a network search and can never surface any
      // other city. Filter the fixed list by the typed prefix so the
      // dropdown still narrows as the user types.
      if (religiousMode) {
        const q = (searchText || "").trim().toLowerCase();
        setDestinationOptions(
          q
            ? RELIGIOUS_DESTINATIONS.filter((o) =>
                o.label.toLowerCase().includes(q),
              )
            : RELIGIOUS_DESTINATIONS,
        );
        return;
      }
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
          code: city.countryCode,
        }));
        setDestinationOptions(options);
      } catch {
        setDestinationOptions([]);
      } finally {
        setIsDestinationLoading(false);
      }
    }, 300),
  ).current;

  const debouncedSetFinalTerm = useRef(
    debounce((term) => {
      setFinalHotelSearchTerm(term);
    }, 500),
  ).current;

  useEffect(() => {
    if (checkIn && checkOut) {
      // Skip the recompute that follows our own corrective setCheckOut call
      // below — otherwise this second pass would immediately recompute a
      // within-limit diff and clear the error message before the user sees it.
      if (isAutoCorrectingNights.current) {
        isAutoCorrectingNights.current = false;
        return;
      }
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      const diff = Math.max(
        1,
        Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
      );
      if (diff > MAX_NIGHTS) {
        const cappedOut = new Date(start);
        cappedOut.setDate(start.getDate() + MAX_NIGHTS);
        const iso = new Date(
          cappedOut.getTime() - cappedOut.getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 10);
        isAutoCorrectingNights.current = true;
        setNights(MAX_NIGHTS);
        setCheckOut(iso);
        setErrors((prev) => ({ ...prev, nights: NIGHTS_LIMIT_MESSAGE }));
      } else {
        setNights(diff);
        clearError("nights");
      }
    }
  }, [checkIn, checkOut]);

  const handleNightsChange = (value) => {
    const raw = Math.max(1, Number(value) || 1);
    const capped = Math.min(raw, MAX_NIGHTS);
    setNights(capped);
    if (raw > MAX_NIGHTS) {
      setErrors((prev) => ({ ...prev, nights: NIGHTS_LIMIT_MESSAGE }));
    } else {
      clearError("nights");
    }
    if (checkIn) {
      const start = new Date(checkIn);
      const out = new Date(start);
      out.setDate(start.getDate() + capped);
      const iso = new Date(out.getTime() - out.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
      // Capped means the checkOut we're about to set already reflects
      // MAX_NIGHTS, so suppress the checkIn/checkOut effect's own recompute
      // for the same reason as above.
      if (raw > MAX_NIGHTS) isAutoCorrectingNights.current = true;
      setCheckOut(iso);
    }
  };

  // ── Hotel feature flags ───────────────────────────────────────────────
  // Backend: GET /api/hotel-feature-flags?ids=1,2,3
  // Returns { hotels: { "1": { longStay, twentyFourHour, lastMinute, dayStay,
  // meetingSpace, govEmployee, studentDiscount, anyFeature, features: [...] }},
  // summary: { anyFeature, features: [...] } }. We re-fetch whenever the result
  // set changes (new search, channel filter, pagination) so the banner only
  // surfaces features actually present in the visible hotels.

  // Pull the numeric tail off the hotelCode ("IN5" → 5) — same trick the
  // 24-hour probe uses, so the feature-flag map (keyed by numeric id) lines
  // up with the search result rows (keyed by prefixed code).
  const extractHotelNumericId = (h) => {
    if (h?.hotelId != null) return String(h.hotelId);
    const raw = String(h?.hotelCode || h?.id || "");
    const m = raw.match(/(\d+)$/);
    return m ? m[1] : null;
  };

  // Comma-joined, sorted, de-duped id list. Sorted so the dependency string
  // stays stable when the underlying array is just reordered — avoids a
  // spurious re-fetch.
  const resultHotelIdsCsv = useMemo(() => {
    const ids = new Set();
    allResults.forEach((h) => {
      const id = extractHotelNumericId(h);
      if (id) ids.add(id);
    });
    return Array.from(ids).sort((a, b) => Number(a) - Number(b)).join(",");
  }, [allResults]);

  useEffect(() => {
    if (!resultHotelIdsCsv) {
      setFeatureFlagsMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get(
          `/api/hotel-feature-flags?ids=${resultHotelIdsCsv}`
        );
        if (cancelled) return;
        const hotels = res?.data?.hotels || {};
        setFeatureFlagsMap(hotels);
      } catch (err) {
        console.warn("hotel-feature-flags fetch failed (non-fatal):", err);
        if (!cancelled) setFeatureFlagsMap({});
      }
    })();
    return () => { cancelled = true; };
  }, [resultHotelIdsCsv]);

  const getHotelFeatureLabels = (hotel) => {
    const id = extractHotelNumericId(hotel);
    if (!id) return [];
    const flags = featureFlagsMap[id];
    if (!flags) return [];
    return Array.isArray(flags.features) ? flags.features : [];
  };

  // Maps each canonical feature label to a CSS modifier class AND the
  // dedicated booking-page route the user is sent to when they click the
  // pill. Unknown labels degrade to the default pill styling and the
  // click is a no-op (we skip the navigation when route is undefined).
  const DEAL_PILL_META = {
    "Last Minute":             { cls: "deal-last-minute", route: "/new-booking/last-minute-booking" },
    "Long Stay":               { cls: "deal-long-stay",   route: "/new-booking/long-stay"           },
    "Day Stay":                { cls: "deal-day-stay",    route: "/new-booking/day-stay"            },
    "24 Hour Check-In":        { cls: "deal-24h",         route: "/new-booking/hotel-24hr"          },
    "Govt Employee Discount":  { cls: "deal-gov",         route: "/new-booking/gov-employee"        },
    "Student Discount":        { cls: "deal-student",     route: "/new-booking/student"             },
    "Meeting & Space":         { cls: "deal-meeting",     route: "/new-booking/meet-and-space"      },
    "Honeymoon":               { cls: "deal-honeymoon",   route: "/new-booking/honeymoon"           },
  };

  const filteredResults = useMemo(() => {
    let results = allResults;

    if (starRating) {
      results = results.filter(
        (hotel) => Number(hotel.rating) === Number(starRating.value),
      );
    }
    if (hotelType.length > 0) {
      const selectedTypes = hotelType.map((t) => t.value);
      results = results.filter((hotel) =>
        selectedTypes.includes(hotel.hotelType),
      );
    }
    if (channelType.length > 0) {
      const selectedChannels = channelType.map((c) => c.value);
      results = results.filter((hotel) =>
        selectedChannels.includes(hotel.channelType),
      );
    }

    // Available Deals — OR-match across the selected option values.
    if (availableDeals.length > 0) {
      const selected = new Set(availableDeals.map((d) => d.value));
      const hasFeatureLabel = (hotel, label) =>
        getHotelFeatureLabels(hotel).some(
          (f) => String(f).toLowerCase() === String(label).toLowerCase()
        );
      results = results.filter((hotel) => {
        if (selected.has("flashSale") && getHotelFeatureLabels(hotel).length > 0) return true;
        if (selected.has("longStay") && hasFeatureLabel(hotel, "Long Stay")) return true;
        if (selected.has("twentyFourHour") && hasFeatureLabel(hotel, "24 Hour Check-In")) return true;
        if (selected.has("lastMinute") && hasFeatureLabel(hotel, "Last Minute")) return true;
        if (selected.has("dayStay") && hasFeatureLabel(hotel, "Day Stay")) return true;
        if (selected.has("meetingSpace") && hasFeatureLabel(hotel, "Meeting & Space")) return true;
        if (selected.has("govEmployee") &&
            (hasFeatureLabel(hotel, "Govt Employee Discount") || hasFeatureLabel(hotel, "Govt Employee"))) return true;
        if (selected.has("studentDiscount") && hasFeatureLabel(hotel, "Student Discount")) return true;
        if (selected.has("seniorCitizen") && hasFeatureLabel(hotel, "Senior Citizen")) return true;
        if (selected.has("destinationSales") && hotel.hasDestinationSales === true) return true;
        return false;
      });
    }

    // ── 24 Hour Check-In transform ──────────────────────────────────
    // When the toggle is on, keep ONLY hotels the probe marked eligible
    // and uplift the displayed price by the configured percentage.
    //
    // The probe-bulk response is keyed by the numeric hotel_id ("5"), but
    // hotel.hotelCode is the prefixed string ("IN5"). Strip the non-digit
    // prefix the same way we did when building the probe payload, so the
    // map lookup actually hits.
    if (is24HourCheckin) {
      const numericId = (code) => {
        const m = String(code || "").match(/(\d+)$/);
        return m ? m[1] : null;
      };
      results = results
        .filter((hotel) => {
          const meta = twentyFourHourMap[numericId(hotel.hotelCode)];
          return meta && meta.eligible;
        })
        .map((hotel) => {
          const meta = twentyFourHourMap[numericId(hotel.hotelCode)];
          const pct = Number(meta?.percentage || 0);
          const base = Number(hotel.price || 0);
          const uplifted = +(base * (1 + pct / 100)).toFixed(2);
          return { ...hotel, price: uplifted, _twentyFourHourPercentage: pct };
        });
    }

    return results;
  }, [allResults, hotelSearchTerm, starRating, hotelType, channelType,
      availableDeals, featureFlagsMap,
      is24HourCheckin, twentyFourHourMap]);

  // "Explore on Map" markers — one per currently-visible (filtered) hotel.
  // MapModal itself drops any entry whose lat/lng isn't a finite number, so
  // no need to pre-filter here.
  const mapMarkers = useMemo(
    () =>
      filteredResults.map((hotel) => ({
        id: hotel.id,
        name: hotel.name,
        lat: hotel.latitude,
        lng: hotel.longitude,
        address: hotel.address,
        contactNumber: hotel.contactNumber,
      })),
    [filteredResults],
  );

  // Union of active feature labels across hotels currently in view. Order
  // mirrors the backend's canonical ordering (Long Stay → 24 Hour Check-In
  // → Last Minute → Day Stay → Meeting & Space → Govt Employee Discount →
  // Student Discount) so the marquee text stays stable across renders.
  // Empty → deals banner is suppressed entirely.
  const activeFeatureLabels = useMemo(() => {
    const canonical = [
      "Long Stay",
      "24 Hour Check-In",
      "Last Minute",
      "Day Stay",
      "Meeting & Space",
      "Govt Employee Discount",
      "Student Discount",
    ];
    const set = new Set();
    filteredResults.forEach((h) => {
      getHotelFeatureLabels(h).forEach((label) => set.add(label));
    });
    return canonical.filter((l) => set.has(l));
  }, [filteredResults, featureFlagsMap]);

  const effectiveTotalPages = useMemo(
    () => Math.max(1, totalPages),
    [totalPages],
  );

  // Counter reflects rows that are actually rendered on screen, not the
  // raw server count. On the 24-hour route (and any flow where a
  // client-side filter — 24hr eligibility, star rating, deals, etc. —
  // trims the fetched page), filteredResults.length can be smaller than
  // the backend's totalElements. Using filteredResults for the range and
  // capping the "of X" at what's visible keeps the "Showing 1 to N of N"
  // pill honest without touching pagination controls (which still use
  // totalPages / totalElements from the server).
  const shownCount = filteredResults.length;
  const startEntry = shownCount === 0 ? 0 : pageIndex * pageSize + 1;
  const endEntry = pageIndex * pageSize + shownCount;
  const displayTotal =
    shownCount < allResults.length ? endEntry : Math.max(totalElements, endEntry);

  const pageNumbers = useMemo(() => {
    const current = pageIndex + 1;
    const total = effectiveTotalPages;
    const nums = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) nums.push(i);
    } else {
      nums.push(1);
      const left = Math.max(2, current - 1);
      const right = Math.min(total - 1, current + 1);
      if (left > 2) nums.push("ellipsis-left");
      for (let i = left; i <= right; i++) nums.push(i);
      if (right < total - 1) nums.push("ellipsis-right");
      nums.push(total);
    }
    return nums;
  }, [pageIndex, effectiveTotalPages]);

  const goToPage = (idx) => {
    const total = effectiveTotalPages;
    if (idx < 0 || idx >= total) return;
    setPageIndex(idx);
    setTimeout(() => {
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 0);
  };

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
        console.error("error for country search:", error);
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
        console.error("error for country list:", error);
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

  const cityList = (searchText = "") => debouncedCitySearch(searchText);

  const loadPopularDestinations = async () => {
    // Religious flow is scoped to Mecca + Medina only — skip the master
    // cities fetch entirely so the dropdown can't ever surface any other
    // city, even transiently while the async load is in flight.
    if (religiousMode) {
      setDestinationOptions(RELIGIOUS_DESTINATIONS);
      return;
    }
    if (destinationOptions.length > 0) return;
    try {
      setIsDestinationLoading(true);
      const response = await axiosInstance.get("/api/province?limit=50");
      const cityApiRes = Array.isArray(response.data) ? response.data : [];
      const options = cityApiRes.map((city) => ({
        value: city.id,
        // label: `${city.name}, ${city.state} , ${city.country}`,
         label: `${city.stateName},${city.country}`,
        countryId: city.countryId,
        code: city.countryCode,
      }));
      setDestinationOptions(options);
    } catch {
      // silently fail
    } finally {
      setIsDestinationLoading(false);
    }
  };

  const agentList = async () => {
    try {
      const response = await axiosInstance.get("/api/agent?activeOnly=true");
      setAgents(response.data);
    } catch {
      setAgents([]);
    }
  };

  useEffect(() => {
    countryList();
    agentList();
  }, []);

  // Maps /api/currency rows to react-select options. master_currency.value is
  // a numeric string ("0.2723"); coerce it once here so the conversion is
  // plain arithmetic downstream.
  const mapCurrencyOptions = (list) =>
    (Array.isArray(list) ? list : [])
      .filter((c) => c && c.currencyCode)
      .map((c) => ({
        value: c.currencyId,
        label: c.currencyCode,
        code: c.currencyCode,
        rate: Number(c.value),
      }));

  // Fetches the currency list, passing the typed text as the backend `search`
  // param (server matches on currency name, e.g. "US dollar").
  const fetchCurrencies = async (search = "") => {
    const q = search ? `&search=${encodeURIComponent(search)}` : "";
    const res = await axiosInstance.get(`/api/currency?page=0${q}`);
    return mapCurrencyOptions(res.data);
  };

  const debouncedCurrencySearch = useRef(
    debounce(async (search) => {
      try {
        setCurrencyOptions(await fetchCurrencies(search));
      } catch (err) {
        console.warn("currency search failed (non-fatal):", err);
      }
    }, 300),
  ).current;

  // Load the currency list for the display-currency dropdown and default the
  // selection to AED (the base currency the rates arrive in).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const options = await fetchCurrencies("");
        if (cancelled) return;
        setCurrencyOptions(options);
        const aed = options.find((o) => o.code === "AED");
        setSelectedCurrency(aed || options[0] || null);
      } catch (err) {
        console.warn("currency list fetch failed (non-fatal):", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // For agent logins, resolve the agent's own id (cached userId else
  // /api/personalProfile/{UserName}) so we can look up their currency below.
  useEffect(() => {
    if (!isAgentRole) return;
    const cached = localStorage.getItem("userId");
    if (cached) { setSelfAgentId(cached); return; }
    const userName =
      localStorage.getItem("UserName") || sessionStorage.getItem("UserName");
    if (!userName) return;
    let cancelled = false;
    axiosInstance
      .get(`/api/personalProfile/${userName}`)
      .then((res) => {
        if (cancelled) return;
        if (res?.data?.id != null) {
          const idv = String(res.data.id);
          localStorage.setItem("userId", idv);
          setSelfAgentId(idv);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAgentRole]);

  // Default the display currency to the agent's configured currency (instead
  // of AED): admins use the picked agent, agent logins their own id. Rates are
  // still quoted in AED — this only sets the initial dropdown selection so the
  // operator sees the agent's currency by default. Stops once the operator
  // changes the currency manually (currencyTouchedRef).
  const currencyAgentId = isAgentRole ? selfAgentId : agent;
  useEffect(() => {
    if (currencyTouchedRef.current) return;
    if (!currencyAgentId || currencyOptions.length === 0) return;
    let cancelled = false;
    axiosInstance
      .get(`/api/agent/${currencyAgentId}`)
      .then((res) => {
        const code = res?.data?.currencyCode;
        if (cancelled || !code || currencyTouchedRef.current) return;
        const opt = currencyOptions.find((o) => o.code === code);
        if (opt) setSelectedCurrency(opt);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currencyAgentId, currencyOptions]);

  // AED is the base the search rates are quoted in. We normalise against its
  // stored value so AED→AED is always ×1 regardless of how the master row is
  // configured. Falls back to 1 until the list loads.
  const aedBaseRate = useMemo(() => {
    const aed = currencyOptions.find((o) => o.code === "AED");
    return aed && Number.isFinite(aed.rate) && aed.rate > 0 ? aed.rate : 1;
  }, [currencyOptions]);

  const displayCurrencyCode = selectedCurrency?.code || "AED";

  const convertFromAed = (aedPrice) => {
    if (aedPrice == null) return aedPrice;
    const targetRate =
      selectedCurrency && Number.isFinite(selectedCurrency.rate)
        ? selectedCurrency.rate
        : aedBaseRate;
    return Number(aedPrice) * (targetRate / aedBaseRate);
  };

  useEffect(() => {
    setPageIndex(0);
    if (hasSearchResult && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [starRating, hotelType, channelType, sortBy]);

  // After a fresh search, jump the viewport to the very top of the page so
  // the operator sees the "Hotel / Accommodation" heading and summary strip
  // first, not just the results list further down. Fires once the first
  // batch of hotels actually arrives.
  useEffect(() => {
    if (!hasSearched || !isInitialResultsLoaded) return;
    const id = window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [hasSearched, isInitialResultsLoaded]);

  const formatDate = (date) => date.toISOString().split("T")[0];
  const getTomorrow = (date = new Date()) => {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  };

  const today = formatDate(new Date());
  const minCheckOutDate = checkIn
    ? formatDate(getTomorrow(new Date(checkIn)))
    : formatDate(getTomorrow());

  const validateForm = () => {
    const newErrors = {};
    if (!selectedNationality) newErrors.nationality = "Nationality is required";
    if (!selectedDestination) newErrors.destination = "Destination is required";
    if (!checkIn) newErrors.checkIn = "Check-in date is required";
    if (!checkOut) newErrors.checkOut = "Check-out date is required";
    if (nights > MAX_NIGHTS) newErrors.nights = NIGHTS_LIMIT_MESSAGE;
    // Agent logins book under themselves (backend forces the agent id and the
    // picker is hidden), so the agent is never set manually — skip this check
    // for them or the search can never pass validation.
    if (!isAgentRole && !agent) newErrors.agent = "Agent is required";
    return newErrors;
  };

  const clearError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _omit, ...rest } = prev;
      return rest;
    });
  };

  const fetchHotels = async (page, sid, agentId, nameSearch = "") => {
    try {
      const isNameSearching = !!nameSearch.trim();
      // Capture a per-call seq only for name-search. Basic (unfiltered)
      // fetches don't need this — the poll loop is already the sole writer
      // for them and never races with itself.
      const mySeq = isNameSearching ? ++nameSearchSeqRef.current : null;
      const endpoint = isNameSearching
        ? `/api/hotel-search/results/${sid}/filter-by-name`
        : `/api/hotel-search/results/${sid}`;

      const params = {
        agentId:
          agentId || (isAgentRole ? selfAgentId : agent) || 1,
        page,
        pageSize,
        sortBy:
          sortBy === "priceAsc" || sortBy === "priceDesc" ? "baseRate" : sortBy,
        sortOrder:
          sortBy === "priceAsc" ||
          sortBy === "ratingAsc" ||
          sortBy === "nameAsc"
            ? "asc"
            : "desc",
        starRating: starRating ? starRating.value : undefined,
        apiType:
          channelType.map((c) => c.value.toUpperCase()).join(",") || undefined,
      };

      if (isNameSearching) {
        params.hotelName = nameSearch.trim();
      }

      const res = await axiosInstance.get(endpoint, {
        params,
      });

      // Drop stale name-search responses so an older term can't overwrite
      // results for the term the user is actually looking at.
      if (isNameSearching && mySeq !== nameSearchSeqRef.current) {
        return res.data;
      }

      const mappedResults = Array.isArray(res.data.result)
        ? res.data.result.map((hotel, index) => ({
            id: hotel.hotelCode
              ? `${sid}-${hotel.hotelCode}`
              : `${sid}-h${index + 1}`,
            searchId: sid,
            hotelCode: hotel.hotelCode || null,
            name: hotel.hotelName || "Unknown Hotel",
            address: hotel.hotelAddress || "",
            city: hotel.hotelAddress
              ? hotel.hotelAddress.split(", ").pop() || "Unknown City"
              : "Unknown City",
            price: hotel.baseRate || null,
            badge: hotel.baseRate ? "Rate Available" : "Rate Unavailable",
            image:
              hotel.hotelImage ||
              "https://details/assets/details/profilepic/hotel/hoteldefault.jpg",
            rating: hotel.starRating || 0,
            hotelType: "hotel",
            channelType: hotel.apiType?.toLowerCase() || "inhouse",
            // Surface the backend-computed promotion flag so the
            // "Destination Sales" pill and filter actually work.
            hasDestinationSales: !!hotel.hasDestinationSales,
            flashSale: !!hotel.flashSale,
            latitude: hotel.latitude,
            longitude: hotel.longitude,
            contactNumber: hotel.contactNumber || "",
          }))
        : [];

      if (mappedResults.length > 0 || isNameSearching) {
        if (pollStatus === "IN_PROGRESS" && !isNameSearching) {
          setAllResults((prev) => {
            const map = new Map(prev.map((h) => [h.id, h]));
            mappedResults.forEach((h) => map.set(h.id, h));
            return Array.from(map.values());
          });
        } else {
          setAllResults(mappedResults);
        }
      } else if (!isNameSearching && pollStatus !== "IN_PROGRESS") {
        setAllResults([]);
      }

      setTotalElements(Number(res.data.totalResults) || mappedResults.length);
      setTotalPages(
        Math.max(
          1,
          Math.ceil(
            (Number(res.data.totalResults) || mappedResults.length) / pageSize,
          ),
        ),
      );
      setHasSearchResult(true);
      return res.data;
    } catch (err) {
      console.error("Fetch hotels failed:", err);
      if (!nameSearch) setPollStatus("ERROR");
      throw err;
    }
  };

  const pollUntilComplete = async (
    url,
    params,
    checkComplete,
    onUpdate,
    intervalMs = 2000,
    timeoutMs = 20000,
    initialDelay = 2000,
  ) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let localPollCount = 0;

      const poll = async () => {
        try {
          localPollCount++;
          const res = await axiosInstance.get(url, { params });
          if (onUpdate) onUpdate(res.data, localPollCount);
          if (checkComplete(res.data)) {
            setPollStatus("COMPLETED");
            return resolve(res.data);
          }
          if (Date.now() - startTime >= timeoutMs) {
            setPollStatus("TIMEOUT");
            return reject(new Error("Polling timed out"));
          }
          setTimeout(poll, intervalMs);
        } catch (err) {
          console.error("Poll failed:", err);
          setPollStatus("ERROR");
          reject(err);
        }
      };

      setPollStatus("IN_PROGRESS");
      setTimeout(poll, initialDelay);
    });
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      setHasSearched(false);
      return;
    }

    setErrors({});
    setIsLoading(true);
    setHasSearched(true);
    setIsEditingSearch(false);
    setHasSearchResult(false);
    setAllResults([]);
    setPollStatus("IDLE");
    setPageIndex(0);
    setTotalElements(0);
    setTotalPages(1);
    setIsInitialResultsLoaded(false);
    completedChannelsRef.current = new Set();
    setCompletedChannels(new Set());

    try {
      const nationalityId = selectedNationality.value;
      const nationalityCode = selectedNationality.code;
      const destinationCityId = selectedDestination.value;
      const destinationCountryId = selectedDestination.countryId;
      const noOfRooms = String(rooms.length);

      const roomConfigurations = rooms.map((room, index) => ({
        roomNo: index + 1,
        adultCount: String(room.adults || 1),
        childCount: String(room.children || 0),
        childAges: room.childAges?.length ? room.childAges : [0],
        adultAges: room.adultAges?.length ? room.adultAges : [25],
      }));

      const agentId = (isAgentRole ? selfAgentId : agent) || 1;

      const searchPayloadReq = {
        nationalityId,
        nationalityCode,
        destinationCityId,
        destinationCountryId,
        checkIn,
        checkOut,
        noOfRooms,
        roomConfigurations,
        agentId,
      };

      const searchKeyRes = await axiosInstance.post(
        "/api/hotel-search/search",
        searchPayloadReq,
      );
      const newSearchId = searchKeyRes.data.searchId;
      if (!newSearchId) throw new Error("No searchId returned");
      setSearchId(newSearchId);

      const params = {
        agentId,
        page: 0,
        pageSize,
        sortBy:
          sortBy === "priceAsc" || sortBy === "priceDesc" ? "baseRate" : sortBy,
        sortOrder:
          sortBy === "priceAsc" ||
          sortBy === "ratingAsc" ||
          sortBy === "nameAsc"
            ? "asc"
            : "desc",
        starRating: starRating ? starRating.value : undefined,
        apiType:
          channelType.map((c) => c.value.toUpperCase()).join(",") || undefined,
      };

      const expectedChannels = [
        "inhouse",
        // "iwtx",
        // "x3",
        "ratehawk",
        // "darina",
        // "atharva",
        // "jumeirah",
      ];

      const finalPollData = await pollUntilComplete(
        `/api/hotel-search/results/${newSearchId}`,
        params,
        (data) => data.finalStatus === "COMPLETED",
        (data, pollCount) => {
          const mappedResults = Array.isArray(data.result)
            ? data.result.map((hotel, index) => ({
                id: hotel.hotelCode
                  ? `${newSearchId}-${hotel.hotelCode}`
                  : `${newSearchId}-h${index + 1}`,
                searchId: newSearchId,
                hotelCode: hotel.hotelCode || null,
                name: hotel.hotelName || "Unknown Hotel",
                address: hotel.hotelAddress || "",
                city: hotel.hotelAddress
                  ? hotel.hotelAddress.split(", ").pop() || "Unknown City"
                  : "Unknown City",
                price: hotel.baseRate || null,
                badge: hotel.baseRate ? "Rate Available" : "Rate Unavailable",
                image:
                  hotel.hotelImage ||
                  "https://details/assets/details/profilepic/hotel/hoteldefault.jpg",
                rating: hotel.starRating || 0,
                hotelType: "hotel",
                channelType: hotel.apiType?.toLowerCase() || "inhouse",
                // Surface backend promotion flags so the
                // "Destination Sales" pill + filter actually work.
                hasDestinationSales: !!hotel.hasDestinationSales,
                flashSale: !!hotel.flashSale,
                latitude: hotel.latitude,
                longitude: hotel.longitude,
                contactNumber: hotel.contactNumber || "",
              }))
            : [];

          // When a hotel-name filter is active, /filter-by-name owns
          // allResults. Merging the poll's unfiltered payload here would
          // repopulate the list with non-matching hotels every 2 s and
          // undo the filter. Clearing the box unblocks this branch on the
          // next poll tick, and the poll returns the full Redis payload so
          // the unfiltered list rebuilds naturally.
          if (!finalHotelSearchTermRef.current.trim()) {
            setAllResults((prev) => {
              const map = new Map(prev.map((h) => [h.id, h]));
              mappedResults.forEach((h) => map.set(h.id, h));
              return Array.from(map.values());
            });
          }

          const currentStatuses = data.status || {};
          expectedChannels.forEach((ch) => {
            if (
              currentStatuses[ch] === "COMPLETED" &&
              !completedChannelsRef.current.has(ch)
            ) {
              completedChannelsRef.current.add(ch);
            }
          });
          setCompletedChannels(new Set(completedChannelsRef.current));

          if (pollCount === 1 || mappedResults.length > 0) {
            setHasSearchResult(true);
            if (
              completedChannelsRef.current.size >= 1 ||
              mappedResults.length > 0
            ) {
              setIsInitialResultsLoaded(true);
            }
          }

          // Same reason as the setAllResults guard above — while a name
          // filter is active the /filter-by-name response owns the paging
          // counts; the unfiltered poll totals would flash the wrong page
          // count next to a filtered list.
          if (!finalHotelSearchTermRef.current.trim()) {
            setTotalElements(Number(data.totalResults) || mappedResults.length);
            setTotalPages(
              Math.max(
                1,
                Math.ceil(
                  (Number(data.totalResults) || mappedResults.length) / pageSize,
                ),
              ),
            );
          }
        },
        2000,
        // 60 s timeout — GRN Connect's fan-out over ~300 hotel codes for a
        // Dubai search finishes in ~30-40 s against the sandbox. The prior
        // 20 s ceiling would reject before GRN completed, and the catch
        // below then set hasSearched=false, silently blocking every
        // subsequent filter change (e.g. ticking Channel = GRN) from
        // re-fetching. 60 s covers observed GRN latency; faster suppliers
        // still resolve early via the finalStatus=COMPLETED check.
        60000,
        2000,
      );
      // ── 24 Hour Check-In post-processing ───────────────────────────
      // Probe each hotel's 24-hour config eligibility for the requested
      // check-in date+time. The result map keys hotelId -> { eligible,
      // percentage }; filteredResults uses it to filter non-eligible hotels
      // and uplift displayed rates.
      //
      // We read `finalPollData.result` (the freshest payload from the last
      // poll) rather than `allResults`, because setAllResults inside the
      // poll's onUpdate callback hasn't been flushed back into this
      // closure — reading allResults here returns the stale value (empty
      // list on the first search), which would cause the probe to receive
      // no IDs and return {}, filtering every hotel out.
      if (is24HourCheckin) {
        try {
          // hotelCode comes back as a string like "IN5" / "IN12" — the
          // numeric tail is the real hotel_id. Strip the leading "IN" (or
          // any non-digit prefix) before sending to the probe endpoint.
          const idsAfterSearch = (finalPollData?.result || [])
            .map((h) => {
              const raw = String(h.hotelCode || "");
              const m = raw.match(/(\d+)$/);
              return m ? Number(m[1]) : NaN;
            })
            .filter((n) => Number.isFinite(n) && n > 0);

          if (idsAfterSearch.length > 0 && checkIn && checkInTime24) {
            const probeRes = await axiosInstance.post(
              "/api/24-hour-checkin/probe-bulk",
              {
                hotelIds: idsAfterSearch,
                date: checkIn,
                time: checkInTime24,
              }
            );
            setTwentyFourHourMap(probeRes.data || {});
          } else {
            setTwentyFourHourMap({});
          }
        } catch (probeErr) {
          console.warn("24-hour probe failed (non-fatal):", probeErr);
          setTwentyFourHourMap({});
        }
      }
    } catch (err) {
      console.error("Search failed:", err);
      setHasSearched(false);
      setPollStatus("ERROR");
    } finally {
      setIsLoading(false);
    }
  };

  // const showResultsDuringPolling =
  //   hasSearchResult &&
  //   isInitialResultsLoaded &&
  //   (pollStatus === "IN_PROGRESS" || pollStatus === "COMPLETED");

  const showResultsDuringPolling = hasSearchResult || allResults.length > 0;

  // Collapse the full search form into the sticky summary strip once results
  // are on screen, unless the user explicitly chose to modify the search.
  const collapseSearch = showResultsDuringPolling && !isEditingSearch;

  useEffect(() => {
    if (!searchId || !hasSearched) return;
    // Gate basic (unfiltered) fetches until polling finishes so we don't
    // double-write allResults alongside the poll's merge. Name-search
    // (/filter-by-name) is exempt — it targets a separate endpoint,
    // REPLACES allResults on its own, and is protected from stale-response
    // races by nameSearchSeqRef. Without this exemption, typing a hotel
    // name during the initial supplier poll silently no-ops until poll
    // completes, which is the "sometimes it doesn't work" symptom.
    //
    // Filter-driven fetches (channelType, starRating) are ALSO exempt from
    // the guard: they issue a filtered /results call (e.g. apiType=GRN)
    // that returns a different result set than the unfiltered poll, so
    // the "double-write" concern doesn't apply. Blocking them meant that
    // ticking Channel = GRN while a slow supplier (GRN itself, ~30-40 s
    // for Dubai) was still polling silently zeroed the list.
    const hasActiveFilter =
      (channelType && channelType.length > 0) ||
      !!starRating ||
      (hotelType && hotelType.length > 0);
    if (
      pollStatus === "IN_PROGRESS" &&
      !finalHotelSearchTerm.trim() &&
      !hasActiveFilter
    ) return;
    setIsLoading(true);
    fetchHotels(pageIndex, searchId, agent, finalHotelSearchTerm).finally(() =>
      setIsLoading(false),
    );
  }, [
    pageIndex,
    sortBy,
    starRating,
    channelType,
    hotelType,
    searchId,
    agent,
    hasSearched,
    pollStatus,
    finalHotelSearchTerm,
  ]);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />

        <main className="flex-grow-1 p-4 hs-page">
          {/* ── Results-page heading ──
              Shown once actual results have arrived (not just on search
              click — avoids flashing the heading during the loading/poll
              phase), above the search summary / form. Stays visible whether
              the summary is collapsed or re-expanded via "Modify Search". */}
          {showResultsDuringPolling && (
            <div className="hs-page-heading">
              <h3 className="hs-page-heading-title">
                {force24Hour ? "24 Hours" : "Accommodation"}
              </h3>
              {/* <p className="hs-page-heading-subtitle">
                Browse and book hotels, resorts, villas and apartments.
              </p> */}
            </div>
          )}

          {/* ── Collapsed sticky search summary strip ──
              Shown once results are on screen. "Modify Search" re-expands
              the full form by flipping isEditingSearch. */}
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
                {selectedDestination?.label && (
                  <span className="hs-summary-chip hs-summary-chip-main">
                    {selectedDestination.label}
                  </span>
                )}
                {checkIn && (
                  <span className="hs-summary-chip">
                    {checkIn}
                    {checkOut ? ` → ${checkOut}` : ""}
                  </span>
                )}
                <span className="hs-summary-chip">
                  {nights} night{nights > 1 ? "s" : ""}
                </span>
                <span className="hs-summary-chip">
                  {rooms.reduce((a, r) => a + r.adults, 0)} adults
                  {rooms.reduce((a, r) => a + r.children, 0)
                    ? `, ${rooms.reduce((a, r) => a + r.children, 0)} child`
                    : ""}{" "}
                  · {rooms.length} room{rooms.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}

          {/* ── Search Card + Ads ── */}
          {!collapseSearch && (
          <div className="d-flex gap-3 align-items-start mb-2 hs-search-ads-row">
           <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <Card className="shadow-sm rounded-xl search-card-modern bg-white h-100">
            <Card.Body className={force24Hour ? "p-4 hs24-compact" : "p-4"}>
              <div
                className={
                  force24Hour
                    ? "mb-2 text-start d-flex justify-content-between align-items-start flex-wrap gap-2"
                    : "mb-4 text-start d-flex justify-content-between align-items-start flex-wrap gap-2"
                }
              >
                <div>
                  <h2 className="fw-semibold text-primary mb-1 d-inline-flex align-items-center gap-2">
                    {force24Hour
                      ? "24 Hours"
                      : "Find Your Perfect Stay"}
                    {religiousMode && (
                      <span
                        className="badge bg-warning-subtle text-warning border border-warning-subtle"
                        style={{ fontSize: "0.65em", padding: "4px 10px", verticalAlign: "middle" }}
                        title="Religious flow — destination restricted to Mecca / Medina"
                      >
                        Religious
                      </span>
                    )}
                  </h2>
                  <p className={force24Hour ? "text-muted mb-0" : "text-muted"}>
                    {force24Hour
                      ? "Pick a check-in time — we'll filter to hotels with an active 24-hour config and apply the per-hotel uplift."
                      : religiousMode
                        ? "Search hotels in Mecca and Medina."
                        : "Discover amazing hotels and exclusive deals"}
                  </p>
                </div>
                {/* Agent logins see their available credit balance at the
                    right end of the heading row (renders nothing for other
                    roles). */}
                <AgentCreditBalance />
              </div>

              <Form onSubmit={handleSearchSubmit}>
                {/*
                  Search criteria order (per spec):
                    1. Agent
                    2. Destination / City
                    3. Nationality
                    4. Check-In
                    5. Nights
                    6. Check-Out
                    7. Rooms & Guests
                  Row totals stay 12 on lg so the form keeps its
                  responsive feel — first row holds Agent + Destination +
                  Nationality (4/4/4), second row holds Check-In + Nights +
                  Check-Out + Rooms & Guests (3/2/3/4). On the 24-hour route,
                  Check-In Time + Check-Out Time join Rooms & Guests as a
                  third 4/4/4 row (rather than a separate Row below) purely
                  to cut vertical space so the form fits on screen.
                */}
                <Row className={force24Hour ? "g-3" : "g-4"}>
                  {/* 1. Agent */}
                  {!isAgentRole && (
                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Agent
                      </Form.Label>
                      <AgentSelect
                        agents={agents}
                        value={agent}
                        isInvalid={!!errors.agent}
                        onChange={(v) => {
                          setAgent(v);
                          if (v) clearError("agent");
                        }}
                      />
                      {errors.agent && (
                        <div className="text-danger small mt-1">
                          {errors.agent}
                        </div>
                      )}
                      {agent && (
                        <div className="mt-1 small">
                          {agentBalanceLoading ? (
                            <span className="text-muted">
                              Loading available balance…
                            </span>
                          ) : agentBalance != null ? (
                            <span className="fw-semibold" style={{ color: "#dc3545" }}>
                              Available Balance: {Number(agentBalance).toFixed(2)} AED
                            </span>
                          ) : (
                            <span className="text-muted">
                              Available balance unavailable
                            </span>
                          )}
                        </div>
                      )}
                    </Form.Group>
                  </Col>
                  )}

                  {/* 2. Destination / City */}
                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Destination / City
                      </Form.Label>
                      <Select
                        options={destinationOptions}
                        value={selectedDestination}
                        onChange={(option) => {
                          setSelectedDestination(option);
                          if (option) clearError("destination");
                        }}
                        placeholder="Where do you want to go?"
                        isSearchable
                        isClearable
                        className="modern-select"
                        isLoading={isDestinationLoading}
                        noOptionsMessage={() =>
                          isDestinationLoading
                            ? "Searching destinations..."
                            : "Type to search destinations..."
                        }
                        onMenuOpen={() => {
                          if (destinationOptions.length === 0)
                            loadPopularDestinations();
                        }}
                        onInputChange={(inputValue, { action }) => {
                          if (action === "input-change") cityList(inputValue);
                        }}
                        menuPortalTarget={document.body}
                        styles={{
                          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          control: (base) => ({
                            ...base,
                            minHeight: "42px",
                            border: "1px solid #dee2e6",
                            "&:hover": { borderColor: "#86b7fe" },
                          }),
                          menu: (base) => ({
                            ...base,
                            zIndex: 9999,
                            maxHeight: "200px",
                          }),
                          option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isFocused
                              ? "#f8f9fa"
                              : "white",
                            color: state.isSelected ? "white" : "#212529",
                            "&:active": { backgroundColor: "#0d6efd" },
                          }),
                          clearIndicator: (base) => ({
                            ...base,
                            color: "#6c757d",
                            "&:hover": { color: "#dc3545" },
                          }),
                        }}
                      />
                      {errors.destination && (
                        <div className="text-danger small mt-1">
                          {errors.destination}
                        </div>
                      )}
                      {/* Surface UAE-resident status when the selected
                          destination city belongs to the UAE so the operator
                          can apply the resident rate. Matched on the city's
                          country code "AE" (from master_country) so a label
                          change can't break the rule. */}
                      {selectedDestination?.code === "AE" && (
                        <div
                          className="mt-1 small"
                          style={{ color: "#0f7a3a", lineHeight: 1.25 }}
                        >
                          For UAE resident holders, please mention the nationality as United Arab Emirates regardless of the actual nationality.
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  {/* 3. Nationality */}
                  <Col lg={4} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Nationality
                      </Form.Label>
                       <Select
                        options={nationalityList}
                        value={selectedNationality}
                        onChange={(option) => {
                          setSelectedNationality(option);
                          if (option) clearError("nationality");
                        }}
                        onInputChange={handleCountryInputChange}
                        isLoading={isNationalityLoading}
                        placeholder="Select nationality"
                        isSearchable
                        isClearable
                        className="modern-select"
                        menuPortalTarget={document.body}
                        styles={{
                          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          control: (base) => ({
                            ...base,
                            minHeight: "42px",
                            border: "1px solid #dee2e6",
                            "&:hover": { borderColor: "#86b7fe" },
                          }),
                        }}
                      />
                      {errors.nationality && (
                        <div className="text-danger small mt-1">
                          {errors.nationality}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  {/* Booking Done By — for AGENT logins the booking is done
                      by the logged-in agent, so the staff-employee picker is
                      hidden and the agent's own name is shown (read-only) and
                      carried on the payload. Admin/staff keep the optional
                      employee dropdown exactly as before. */}
                  {isAgentRole ? (
                    <Col lg={4} md={6}>
                      <Form.Group>
                        <Form.Label className="fw-semibold text-dark">
                          Booking Done By
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={loggedInAgentName || "—"}
                          readOnly
                          disabled
                          className="form-control-modern"
                          style={{ height: "42px" }}
                        />
                      </Form.Group>
                    </Col>
                  ) : (
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
                          onChange={(option) => setSelectedEmployee(option)}
                          placeholder="Select employee"
                          isSearchable
                          isClearable
                          className="modern-select"
                          menuPortalTarget={document.body}
                          styles={{
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                            control: (base) => ({
                              ...base,
                              minHeight: "42px",
                              border: "1px solid #dee2e6",
                              "&:hover": { borderColor: "#86b7fe" },
                            }),
                          }}
                        />
                      </Form.Group>
                    </Col>
                  )}

                  {/* 4. Check-In — RateCalendar renders a picker that
                       shows the "starting from" nightly rate under each day
                       (from GET /api/hotel-search/rate-calendar). Same
                       ISO yyyy-MM-dd contract in value/onChange as the
                       previous <Form.Control type="date">, so all downstream
                       consumers (nights sync, submit payload, sticky summary
                       strip) work unchanged. */}
                  <Col lg={3} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Check-In
                      </Form.Label>
                      <RateCalendar
                        value={checkIn}
                        min={today}
                        stateId={selectedDestination?.value}
                        currency="AED"
                        isInvalid={!!errors.checkIn}
                        ariaLabel="Check-in date"
                        onChange={(newCheckIn) => {
                          setCheckIn(newCheckIn);
                          if (newCheckIn) {
                            clearError("checkIn");
                            setCheckOut(
                              formatDate(getTomorrow(new Date(newCheckIn))),
                            );
                            clearError("checkOut");
                          }
                        }}
                      />
                      {errors.checkIn && (
                        <div className="text-danger small mt-1">
                          {errors.checkIn}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  {/* 5. Nights */}
                  <Col lg={2} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Nights
                      </Form.Label>
                      <Form.Control
                        style={{ height: "42px" }}
                        className="form-control-modern"
                        type="number"
                        min={1}
                        max={MAX_NIGHTS}
                        value={nights}
                        onChange={(e) => handleNightsChange(e.target.value)}
                      />
                      {errors.nights && (
                        <div className="text-danger small mt-1">
                          {errors.nights}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  {/* 6. Check-Out — same RateCalendar treatment as Check-In.
                       min={minCheckOutDate} keeps operators from picking a
                       date before/equal to check-in (the picker greys those
                       days out and refuses selection). */}
                  <Col lg={3} md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold text-dark">
                        Check-Out
                      </Form.Label>
                      <RateCalendar
                        value={checkOut}
                        min={minCheckOutDate}
                        stateId={selectedDestination?.value}
                        currency="AED"
                        isInvalid={!!errors.checkOut}
                        ariaLabel="Check-out date"
                        onChange={(newCheckOut) => {
                          setCheckOut(newCheckOut);
                          if (newCheckOut) clearError("checkOut");
                        }}
                      />
                      {errors.checkOut && (
                        <div className="text-danger small mt-1">
                          {errors.checkOut}
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  {/* 7. Rooms & Guests */}
                  <Col lg={4} md={6}>
                    <Form.Label className="fw-semibold text-dark">
                      Rooms & Guests
                    </Form.Label>
                    <div className="d-flex flex-wrap gap-2">
                      <Button
                        variant="outline-primary"
                        className="flex-grow-1 text-start rooms-summary-btn-modern"
                        type="button"
                        onClick={() => setRoomsOpen((o) => !o)}
                      >
                        {rooms.reduce((a, r) => a + r.adults, 0)} adults
                        {rooms.reduce((a, r) => a + r.children, 0)
                          ? `, ${rooms.reduce((a, r) => a + r.children, 0)} child`
                          : ""}{" "}
                        · {rooms.length} room{rooms.length > 1 ? "s" : ""}
                        <span className="float-end">
                          {roomsOpen ? "▴" : "▾"}
                        </span>
                      </Button>
                     <Button
  type="button"
  className="flex-shrink-0 btn-add-room-premium hs-add-room-btn-red"
  disabled={roomsOpen && rooms.length >= MAX_ROOMS}
  onClick={() => {
    if (!roomsOpen) {
      setRoomsOpen(true); // first click: just open
    } else {
      // later clicks: add room, but never exceed the cap
      setRooms((prev) =>
        prev.length >= MAX_ROOMS
          ? prev
          : [...prev, { adults: 1, children: 0, childAges: [] }]
      );
    }
  }}
>
  <span className="add-room-plus">+</span>
  <span>Add Room</span>
</Button>
                    </div>
                  </Col>

                  {/* ── 24 Hour Check-In time inputs ─────────────────────
                      Rendered ONLY on the dedicated 24-hour route
                      (force24Hour=true). Kept as plain columns in the same
                      Row as the rest of the criteria (rather than a
                      separate Row below) purely so the form fits on screen
                      without extra scrolling — same fields, same handlers,
                      just laid out more compactly. The 24-hour
                      post-processing / probe call still only runs when
                      is24HourCheckin is true, which on the normal route
                      stays false for the entire lifetime of the page. */}
                  {force24Hour && (
                    <>
                      <Col lg={4} md={6}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-dark">
                            Check-In Time (24-hour)
                          </Form.Label>
                          {/* Same OK/Cancel + AM-PM picker used on
                              hotel-actions/{id}/occupancy-and-minimumlength —
                              stepper + AM/PM toggle + read-only display. Value
                              stays as an "HH:MM" 24-hour string so downstream
                              usage (probe call, booking payload) is unchanged. */}
                          <TimeApplyPicker
                            value={checkInTime24}
                            onApply={(v) => {
                              setCheckInTime24(v);
                              // Auto-bump check-out to the same time → 24h later.
                              // User can override afterwards.
                              if (v) setCheckOutTime24(v);
                            }}
                            placeholder="Select check-in time"
                          />
                        </Form.Group>
                      </Col>
                      <Col lg={4} md={6}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-dark">
                            Check-Out Time
                          </Form.Label>
                          <TimeApplyPicker
                            value={checkOutTime24}
                            onApply={(v) => setCheckOutTime24(v)}
                            placeholder="Select check-out time"
                          />
                        </Form.Group>
                      </Col>
                    </>
                  )}
                </Row>

                {roomsOpen && (
                  <Row className="g-3 mt-3">
                    <Col md={12}>
                      <RoomGuestSelector value={rooms} onChange={setRooms} />
                    </Col>
                  </Row>
                )}

                <Row className={force24Hour ? "mt-2" : "mt-3"}>
                  <Col className="d-flex justify-content-center gap-3">
                    <Button
                      type="submit"
                      className="btn-search-modern"
                      disabled={isLoading}
                      size="lg"
                    >
                      {isLoading ? (
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
                          <FaSearch className="me-2" />
                          {force24Hour
                            ? "SEARCH"
                            : "SEARCH"}
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
                cityId={selectedDestination?.value}
                cityName={selectedDestination?.label}
              />
            )}
          </div>
          )}

          {/* ── Progress Bar ── */}
          <SearchProgressBar
            pollStatus={pollStatus}
            completedChannels={completedChannels}
            channels={visibleProgressChannels}
          />

          {/* ── Loading skeleton ──
          {hasSearched && !showResultsDuringPolling && (
            <Card className="shadow-sm rounded-xl mb-4">
              <Card.Body className="text-center py-5">
                <div className="results-loader">
                  <div className="loader-ring">
                    <span></span><span></span><span></span><span></span>
                  </div>
                  <h4 className="text-primary fw-bold mt-3 mb-1">
                    Fetching Best Results...
                  </h4>
                  <p className="text-muted small mb-0">
                    Comparing rates across multiple providers
                  </p>
                </div>
              </Card.Body>
            </Card>
          )} */}

          {/* ── Empty state ── */}
          {!hasSearched && !hasSearchResult && (
            <Card className="shadow-sm rounded-xl">
              <Card.Body className="text-center text-muted py-5">
                <FaSearch className="display-4 text-muted mb-3" />
                <h4>Ready to Find Your Perfect Stay?</h4>
                <p>
                  Use the search form above to discover amazing hotels and
                  exclusive deals.
                </p>
              </Card.Body>
            </Card>
          )}

          {/* ── Results section ── */}
          {/* {hasSearched && ( */}
          {(hasSearchResult || allResults.length > 0) && (
            <div ref={resultsRef}>
              <div className="search-layout">
                {/* ── Exclusive deals scrolling banner ───────────────────
                    Surfaces the union of feature flags (Long Stay, 24 Hour
                    Check-In, Last Minute, Day Stay, Meeting & Space, Govt
                    Employee Discount, Student Discount) across the hotels
                    in view. Suppressed entirely when no hotel has any flag
                    set so we don't render an empty marquee. */}
              {/* Exclusive Deals marquee hidden — per-hotel deal pills on each
                  card now surface the same information in context. */}
              {false && activeFeatureLabels.length > 0 && (
  <div style={{ overflow: "hidden", width: "100%", marginBottom: "14px" }}>
    <div className="deals-banner" style={{ marginBottom: 0 }}>
      <div className="deals-banner-tag">
        <FaStar className="deals-banner-icon" /> EXCLUSIVE DEALS
      </div>
      <div className="deals-banner-scroll">
        <div className="deals-banner-track">
          {[0, 1].map((dup) => (
            <React.Fragment key={dup}>
              {activeFeatureLabels.map((label, i) => (
                <React.Fragment key={`${dup}-${i}`}>
                  <strong>{label}</strong>
                  <span style={{ color: "#94a3b8", margin: "0 6px" }}>·</span>
                </React.Fragment>
              ))}
              <span style={{ color: "#cbd5e1", marginRight: "56px" }}>
                Unlock special rates at preferred hotels.
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  </div>
)}
                <Row className="g-4">
                  {/* Left Sidebar */}
                  <Col lg={3} className="leftside d-none d-lg-block">
                    <div className="left-fixed">
                      <Card className="shadow-sm rounded-xl filtersection">
                        <Card.Body className="p-2">
                          <div className="map-preview-wrapper mb-2">
                            <img
                              src="/images/map.jpg"
                              alt="Map preview"
                              className="map-preview-img"
                            />
                            {ENABLE_MAP_PREVIEW && (
                              <button
                                type="button"
                                className="map-overlay-btn"
                                onClick={() => setShowMapModal(true)}
                              >
                                EXPLORE ON MAP 📍
                              </button>
                            )}
                          </div>

                          <Form.Control
                            type="text"
                            placeholder={placeholder}
                            className="ps-3 mb-2"
                            value={hotelSearchTerm}
                            onChange={(e) => {
                              const val = e.target.value;
                              setHotelSearchTerm(val);
                              setPageIndex(0);
                              debouncedSetFinalTerm(val);
                            }}
                          />

                          {/* Display currency — converts the shown rates from
                              AED into the chosen currency using the
                              master_currency multiplier. Display-only: it does
                              not alter the search/booking payloads.
                              For an AGENT login the field is hidden entirely
                              and locked to the agent's configured currency
                              (auto-populated from /api/agent/{id} above); only
                              Admin/SuperAdmin see and can switch it. */}
                          {!isAgentRole && (
                            <>
                              <Form.Group className="mb-2">
                                <Form.Label className="fw-semibold small">
                                  Currency
                                </Form.Label>
                                <Select
                                  options={currencyOptions}
                                  value={selectedCurrency}
                                  onChange={(opt) => {
                                    // Operator override — stop auto-defaulting
                                    // to the agent's currency from here on.
                                    currencyTouchedRef.current = true;
                                    setSelectedCurrency(opt);
                                  }}
                                  placeholder="Select currency"
                                  isSearchable
                                  // Server-side search: the backend filters the
                                  // list by the `search` param, so we disable
                                  // react-select's own client filtering to avoid
                                  // double-filtering the returned options.
                                  filterOption={() => true}
                                  onInputChange={(value, { action }) => {
                                    if (action === "input-change")
                                      debouncedCurrencySearch(value);
                                  }}
                                  className="modern-select-sm"
                                  menuPortalTarget={document.body}
                                  styles={{
                                    control: (base) => ({
                                      ...base,
                                      minHeight: "36px",
                                      background: "#ffffff",
                                      color: "#000000",
                                    }),
                                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                    menu: (base) => ({ ...base, zIndex: 9999 }),
                                  }}
                                />
                              </Form.Group>

                              <hr />
                            </>
                          )}

                          <Form.Group className="mb-2">
                            <Form.Label className="fw-semibold small">
                              Hotel Type
                            </Form.Label>
                            <div className="filter-checkbox-list">
                              {hotelTypeOptions.map((item) => (
                                <Form.Check
                                  key={item.value}
                                  type="checkbox"
                                  id={`hotel-type-${item.value}`}
                                  label={item.label}
                                  checked={hotelType.some(
                                    (t) => t.value === item.value,
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked)
                                      setHotelType([...hotelType, item]);
                                    else
                                      setHotelType(
                                        hotelType.filter(
                                          (t) => t.value !== item.value,
                                        ),
                                      );
                                  }}
                                />
                              ))}
                            </div>
                          </Form.Group>

                          <hr />

                          {/* Channel — supplier/channel checkbox filter.
                              Hidden for AGENT logins (agents book only
                              through their contracted channel and the
                              backend already scopes results). */}
                          {!isAgentRole && (
                            <>
                              <Form.Group>
                                <Form.Label className="fw-semibold small">
                                  Channel
                                </Form.Label>
                                <div className="filter-checkbox-list">
                                  {visibleChannelTypeOptions.map((item) => (
                                    <Form.Check
                                      key={item.value}
                                      type="checkbox"
                                      id={`channel-${item.value}`}
                                      label={item.label}
                                      checked={channelType.some(
                                        (c) => c.value === item.value,
                                      )}
                                      onChange={(e) => {
                                        if (e.target.checked)
                                          setChannelType([...channelType, item]);
                                        else
                                          setChannelType(
                                            channelType.filter(
                                              (c) => c.value !== item.value,
                                            ),
                                          );
                                      }}
                                    />
                                  ))}
                                </div>
                              </Form.Group>

                              <hr />
                            </>
                          )}

                          <Form.Group>
                            <Form.Label className="fw-semibold small d-flex justify-content-between align-items-center">
                              <span>Available Deals</span>
                              {availableDeals.length > 0 && (
                                <span
                                  role="button"
                                  className="text-primary small"
                                  style={{ cursor: "pointer", fontWeight: 500 }}
                                  onClick={() => setAvailableDeals([])}
                                >
                                  Clear
                                </span>
                              )}
                            </Form.Label>
                            <div className="filter-checkbox-list">
                              {availableDealsOptions.map((item) => (
                                <Form.Check
                                  key={item.value}
                                  type="checkbox"
                                  id={`deal-${item.value}`}
                                  label={item.label}
                                  checked={availableDeals.some(
                                    (d) => d.value === item.value,
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked)
                                      setAvailableDeals([...availableDeals, item]);
                                    else
                                      setAvailableDeals(
                                        availableDeals.filter(
                                          (d) => d.value !== item.value,
                                        ),
                                      );
                                  }}
                                />
                              ))}
                            </div>
                          </Form.Group>
                        </Card.Body>
                      </Card>
                    </div>
                  </Col>

                  {/* Right Content */}
                  <Col lg={9}>
                    <Card className="shadow-sm rounded-xl mb-3 filtersection">
                      <Card.Body className="p-2">
                        <div className="d-flex align-items-center gap-3 flex-wrap">
                          <Select
                            options={starOptions}
                            value={starRating}
                            onChange={setStarRating}
                            placeholder="All Stars"
                            className="modern-select-sm"
                            menuPortalTarget={document.body}
                            styles={{
                              control: (base) => ({
                                ...base,
                                height: "36px",
                                minHeight: "36px",
                                width: "180px",
                                background: "#ffffff",
                                color: "#000000",
                                marginLeft: "30px",
                              }),
                              menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                              menu: (base) => ({ ...base, zIndex: 9999 }),
                            }}
                          />

                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              className={`sort-pill ${sortBy === "priceAsc" ? "active" : ""}`}
                              onClick={() => setSortBy("priceAsc")}
                            >
                              Low to High
                            </Button>
                            <Button
                              size="sm"
                              className={`sort-pill ${sortBy === "priceDesc" ? "active" : ""}`}
                              onClick={() => setSortBy("priceDesc")}
                            >
                              High to Low
                            </Button>
                          </div>

                          <Button
                            className="clear-pill"
                            variant="outline-primary"
                            size="sm"
                            onClick={() => {
                              setStarRating(null);
                              setHotelType([]);
                              setChannelType([]);
                              setAvailableDeals([]);
                              setSortBy("priceAsc");
                              setHotelSearchTerm("");
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>

                    {/* {hasSearched && ( */}
                    {(hasSearchResult || allResults.length > 0) && (
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <small className="text-muted fw-semibold">
                          Showing {startEntry} to {endEntry} of {displayTotal}{" "}
                          entries
                          {pollStatus === "IN_PROGRESS" && (
                            <span className="ms-1 text-primary">
                              (updating…)
                            </span>
                          )}
                        </small>
                      </div>
                    )}

                    {isLoading && pollStatus !== "IN_PROGRESS" && (
                      <Card className="shadow-sm rounded-xl mb-4">
                        <Card.Body className="text-center py-4">
                          <Spinner animation="border" variant="primary" />
                          <p className="text-muted mt-2 mb-0">
                            Loading results…
                          </p>
                        </Card.Body>
                      </Card>
                    )}

                    <Row className="g-4">
                      {filteredResults.length > 0 ? (
                        filteredResults.map((hotel) => (
                          <Col xs={12} key={hotel.id}>
                            <div
                              style={{
                                position: "relative",
                                backgroundColor: "white",
                                border: "1px solid #dee2e6",
                                borderRadius: "12px",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                overflow: "hidden",
                              }}
                            >
                              {/* Corner Flash Sale logo removed — the badge
                                  next to "Rate Available" carries the same
                                  signal and is more prominent there. */}
                              <Row className="g-0">
                                <Col md={4}>
                                  <div
                                    style={{
                                      position: "relative",
                                      height: "100%",
                                      padding: "10px",
                                    }}
                                  >
                                    <LazyImage
                                      src={hotel.image}
                                      alt={hotel.name}
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        borderRadius: "9px",
                                      }}
                                    />
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: "25px",
                                        left: "25px",
                                        backgroundColor: "rgba(0,0,0,0.7)",
                                        color: "white",
                                        padding: "5px 10px",
                                        borderRadius: "15px",
                                        fontSize: "12px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "5px",
                                      }}
                                    >
                                      <FaStar className="text-warning" />
                                      {hotel.rating}
                                      {/* Supplier / channel-type pill
                                          (INHOUSE / IWTX / DARINA …). Only
                                          admin-side roles need to see which
                                          supplier a hotel came from —
                                          agents book against a single
                                          curated inventory and the label
                                          just adds noise. Guarded on
                                          isAgentRole so admin / super
                                          admin / all other roles keep it. */}
                                      {!isAgentRole && (
                                        <span
                                          style={{
                                            marginLeft: "5px",
                                            backgroundColor: "#6c757d",
                                            padding: "2px 6px",
                                            borderRadius: "10px",
                                          }}
                                        >
                                          {(
                                            hotel.channelType || ""
                                          ).toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </Col>

                                <Col md={8}>
                                  <div
                                    style={{
                                      padding: "12px 14px",
                                      display: "flex",
                                      flexDirection: "column",
                                      height: "100%",
                                    }}
                                  >
                                    <h6
                                      style={{
                                        fontSize: "1.0rem",
                                        fontWeight: "600",
                                        marginBottom: "4px",
                                        color: "#333",
                                      }}
                                    >
                                      {hotel.name || "Hotel Name Not Available"}
                                    </h6>

                                    <p
                                      style={{
                                        fontSize: "0.875rem",
                                        color: "#666",
                                        marginBottom: "4px",
                                      }}
                                    >
                                      📍{" "}
                                      {hotel.address ||
                                        hotel.city ||
                                        "Address Not Available"}
                                    </p>

                                    <div
                                      style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "6px",
                                        marginBottom: "6px",
                                        alignItems: "center",
                                      }}
                                    >
                                      {hotel.badge && (
                                        <span
                                          style={{
                                            backgroundColor: "#28a745",
                                            color: "white",
                                            padding: "4px 8px",
                                            borderRadius: "4px",
                                            fontSize: "0.75rem",
                                            display: "inline-block",
                                          }}
                                        >
                                          {hotel.badge}
                                        </span>
                                      )}
                                      {/* Flash Sale badge — shown beside Rate Available
                                          when the hotel has any active deal feature.
                                          Uses the same /images/flash-sale-logo.png asset
                                          as the corner badge; falls back to a text pill
                                          so the indicator never disappears silently. */}
                                      {!force24Hour && getHotelFeatureLabels(hotel).length > 0 && (
                                        <span
                                          className="flash-sale-badge flash-sale-inline"
                                          aria-label="Flash Sale"
                                          title="Flash Sale"
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            height: "64px",
                                          }}
                                        >
                                          <img
                                            src="/images/flash-sale-logo.png"
                                            alt="Flash Sale"
                                            style={{ height: "60px", width: "auto" }}
                                            onError={(e) => {
                                              const fallback = document.createElement("span");
                                              fallback.style.background = "#ff3b30";
                                              fallback.style.color = "#fff";
                                              fallback.style.padding = "8px 18px";
                                              fallback.style.borderRadius = "8px";
                                              fallback.style.fontSize = "1.1rem";
                                              fallback.style.fontWeight = "800";
                                              fallback.style.letterSpacing = "0.5px";
                                              fallback.textContent = "FLASH SALE";
                                              e.target.replaceWith(fallback);
                                            }}
                                          />
                                        </span>
                                      )}
                                    </div>

                                    {/* Per-hotel "Also Available Deals" — each
                                        pill is a clickable shortcut to the
                                        dedicated booking flow for that deal
                                        type (Long Stay → /new-booking/long-stay,
                                        Last Minute → /new-booking/last-minute-booking,
                                        Day Stay → /new-booking/day-stay, etc.).
                                        Falls back to a non-clickable pill if the
                                        label isn't in DEAL_PILL_META.route.
                                        stopPropagation is added because a future
                                        row-level click handler shouldn't swallow
                                        the navigation.
                                        Hidden in the dedicated 24-hour search
                                        (force24Hour) — the operator is already
                                        committed to that flow, listing other
                                        deals here would be a distraction. */}
                                    {!force24Hour && (getHotelFeatureLabels(hotel).length > 0 || hotel.hasDestinationSales) && (
                                      <div className="available-deals-wrap">
                                        <div className="available-deals-label">
                                          Also Available Deals
                                        </div>
                                        <div className="deal-pills-row">
                                          {/* Destination Sales — display-only badge that
                                              indicates the hotel has at least one of:
                                              Special Rate / Discount / Stay Pay. Not
                                              clickable; no navigation. */}
                                          {hotel.hasDestinationSales && (
                                            <span
                                              className="deal-pill deal-destination-sales"
                                              title="Destination Sales"
                                              style={{
                                                backgroundColor: "#6f42c1",
                                                color: "#fff",
                                                cursor: "default",
                                              }}
                                            >
                                              Destination Sales
                                            </span>
                                          )}
                                          {getHotelFeatureLabels(hotel).map((label) => {
                                            const meta = DEAL_PILL_META[label] || { cls: "" };
                                            const isClickable = !!meta.route;
                                            return (
                                              <span
                                                key={label}
                                                role={isClickable ? "button" : undefined}
                                                tabIndex={isClickable ? 0 : undefined}
                                                className={`deal-pill ${meta.cls}${isClickable ? " deal-pill-clickable" : ""}`}
                                                title={isClickable ? `Open ${label} booking` : label}
                                                style={isClickable ? { cursor: "pointer" } : undefined}
                                                onClick={(e) => {
                                                  if (!isClickable) return;
                                                  e.stopPropagation();
                                                  navigate(meta.route);
                                                }}
                                                onKeyDown={(e) => {
                                                  if (!isClickable) return;
                                                  if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    navigate(meta.route);
                                                  }
                                                }}
                                              >
                                                {label}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginTop: "auto",
                                        paddingTop: "8px",
                                        borderTop: "1px solid #eee",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: "1.1rem",
                                          fontWeight: "600",
                                          color: "#333",
                                        }}
                                      >
                                        {hotel.price
                                          ? `${displayCurrencyCode} ${convertFromAed(
                                              hotel.price,
                                            ).toLocaleString(undefined, {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}`
                                          : "Price on request"}
                                      </div>

                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          alignItems: "flex-end",
                                          gap: "6px",
                                        }}
                                      >
                                      <Button
                                        size="sm"
                                        variant={
                                          clickedHotelIds.includes(hotel.id)
                                            ? "secondary"
                                            : "primary"
                                        }
                                        onClick={() => {
                                          setClickedHotelIds((prev) => [
                                            ...prev,
                                            hotel.id,
                                          ]);
                                          const nationalityCode =
                                            (selectedNationality?.code || "")
                                              .length === 2
                                              ? selectedNationality.code
                                              : " ";
                                          const roomsPayload = rooms.map(
                                            (r) => ({
                                              adults: r.adults || 1,
                                              children: r.children || 0,
                                              childAges: r.childAges || [],
                                              adultAges: Array.from(
                                                { length: r.adults || 1 },
                                                () => 30,
                                              ),
                                            }),
                                          );
                                          const apiIdMapping = {
                                            jumeirah: 10,
                                            iwtx: 12,
                                            x3: 15,
                                            inhouse: 1,
                                            ratehawk: 14,
                                            darina: 16,
                                            atharva: 3,
                                            // GRN Connect. Room list backend
                                            // routes apiId=20 to the new
                                            // GrnHotelRoomSearchService which
                                            // returns bundled rates only.
                                            // 20 avoids colliding with the
                                            // existing Juniper booking's 17.
                                            grn: 20,
                                          };
                                          const apiId =
                                            apiIdMapping[
                                              hotel.channelType?.toLowerCase()
                                            ] || 0;
                                         
                                          // Display labels for values the
                                          // payload otherwise carries only
                                          // as ids/codes. Additive — they
                                          // ride through RoomList into the
                                          // booking page, which posts them
                                          // to /api/search-history/save so
                                          // the admin "Hotel Booking
                                          // History" report can show the
                                          // search context even if the
                                          // booking tab is closed before
                                          // the booking is created.
                                          const pickedAgentId = String(
                                            isAgentRole ? selfAgentId : agent,
                                          );
                                          const pickedAgent = (
                                            Array.isArray(agents) ? agents : []
                                          ).find(
                                            (a) => String(a?.id) === pickedAgentId,
                                          );
                                          const agentName = isAgentRole
                                            ? localStorage.getItem("UserName") ||
                                              sessionStorage.getItem("UserName") ||
                                              ""
                                            : pickedAgent
                                              ? pickedAgent.companyName ||
                                                pickedAgent.name ||
                                                `${pickedAgent.firstName || ""} ${pickedAgent.lastName || ""}`.trim()
                                              : "";
                                          const payload = {
                                            checkInDate: checkIn,
                                            checkOutDate: checkOut,
                                            hotelCode:
                                              hotel.hotelCode ||
                                              hotel.id
                                                ?.split("-")
                                                .slice(1)
                                                .join("-") ||
                                              "",
                                            nationality: nationalityCode,
                                            agentId: String(
                                              isAgentRole ? selfAgentId : agent
                                            ),
                                            agentName,
                                            destinationLabel:
                                              selectedDestination?.label || "",
                                            nationalityLabel:
                                              selectedNationality?.label || "",
                                            // Agent logins: booking is done by
                                            // the logged-in agent, so carry the
                                            // agent's own name (no staff
                                            // employee is picked). Admin/staff:
                                            // the selected employee's label.
                                            employeeName: isAgentRole
                                              ? agentName || null
                                              : selectedEmployee?.label || null,
                                            nightsCount: nights,
                                            apiId,
                                            rooms: roomsPayload,
                                            parentBookingCode:
                                              parentBookingCode || null,
                                            // Optional "Booking Done By"
                                            // selection — null when the
                                            // user skipped the dropdown.
                                            // Flows through RoomList ->
                                            // HotelBookingPage unchanged
                                            // (those layers spread payload
                                            // through transparently). Agent
                                            // logins never pick a staff
                                            // employee, so this stays null.
                                            employeeId: isAgentRole
                                              ? null
                                              : selectedEmployee?.value || null,
                                            // 24 Hour Check-In flags — only
                                            // populated when the user opted
                                            // in. RoomList / HotelBookingPage
                                            // forward these to the create-
                                            // booking endpoint, which stamps
                                            // them onto the new HotelBooking
                                            // row (additive, non-breaking).
                                            is24HourCheckin: !!is24HourCheckin,
                                            checkInTime: is24HourCheckin
                                              ? checkInTime24
                                              : null,
                                            checkOutTime: is24HourCheckin
                                              ? checkOutTime24
                                              : null,
                                            twentyFourHourPercentage:
                                              hotel._twentyFourHourPercentage ||
                                              null,
                                          };
                                          const meta = {
                                            hotelName: hotel.name,
                                            address:
                                              hotel.address || hotel.city,
                                            starRating: hotel.rating || 0,
                                            phone: "",
                                            hotelImage: hotel.image,
                                          };
                                          // Carry the chosen display currency
                                          // into the room list so it shows
                                          // rates in the same currency. `factor`
                                          // is the AED→target multiplier; rates
                                          // stay AED in every payload (display
                                          // only). AED → factor 1.
                                          const currency = {
                                            code: displayCurrencyCode,
                                            factor:
                                              selectedCurrency &&
                                              Number.isFinite(
                                                selectedCurrency.rate,
                                              ) &&
                                              aedBaseRate
                                                ? selectedCurrency.rate /
                                                  aedBaseRate
                                                : 1,
                                          };
                                          sessionStorage.setItem(
                                            "roomListPayload",
                                            JSON.stringify({ payload, meta, currency }),
                                          );
                                          setTimeout(() => {
                                            // Dedicated 24-hour route in
                                            // 24-hour mode so the
                                            // downstream room list and
                                            // booking page can render
                                            // 24-hour-specific UI without
                                            // touching the inhouse
                                            // /room-list flow.
                                            // religiousMode > force24Hour > apiId — religious
                                            // is only supported for the inhouse flow (apiId 1);
                                            // it never touches /api-room-list.
                                            const route =
                                              religiousMode && apiId === 1
                                                ? "/religious-room-list"
                                                : force24Hour
                                                  ? "/room-list-24hr"
                                                  : apiId === 1
                                                    ? "/room-list"
                                                    : "/api-room-list";
                                            window.open(route, "_blank");
                                          }, 50);
                                        }}
                                      >
                                        View Rooms
                                      </Button>
                                      </div>
                                    </div>
                                  </div>
                                </Col>
                              </Row>
                            </div>
                          </Col>
                        ))
                      ) : (
                        <Col xs={12}>
                          <Card className="shadow-sm rounded-xl">
                            <Card.Body className="text-center text-muted py-5">
                              <FaSearch className="display-4 text-muted mb-3" />
                              <h5>No hotels found</h5>
                              <p>
                                {channelType.length > 0
                                  ? `No hotels found for selected channel(s): ${channelType
                                      .map((c) => c.label)
                                      .join(", ")}`
                                  : "We couldn't find any hotels matching your selected criteria. Try adjusting your dates, room preferences, or destination to discover available alternatives."}
                              </p>
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => {
                                  setStarRating(null);
                                  setHotelType([]);
                                  setChannelType([]);
                                  setSortBy("priceAsc");
                                  setHotelSearchTerm("");
                                }}
                              >
                                Clear All Filters
                              </Button>
                            </Card.Body>
                          </Card>
                        </Col>
                      )}
                    </Row>

                    {/* {hasSearched && */}
                    {filteredResults.length > 0 &&
                      totalElements > 0 &&
                      !(hotelSearchTerm || hotelType.length > 0) && (
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4 mt-3">
                          <small className="text-muted fw-semibold"></small>
                          <Pagination className="mb-0 pagination-modern">
                            <Pagination.Prev
                              disabled={pageIndex === 0}
                              onClick={() => goToPage(pageIndex - 1)}
                            />
                            {pageNumbers.map((n) =>
                              typeof n === "number" ? (
                                <Pagination.Item
                                  key={n}
                                  active={n === pageIndex + 1}
                                  onClick={() => goToPage(n - 1)}
                                >
                                  {n}
                                </Pagination.Item>
                              ) : (
                                <Pagination.Ellipsis key={n} disabled />
                              ),
                            )}
                            <Pagination.Next
                              disabled={pageIndex >= effectiveTotalPages - 1}
                              onClick={() => goToPage(pageIndex + 1)}
                            />
                          </Pagination>
                        </div>
                      )}
                  </Col>
                </Row>
              </div>
            </div>
          )}

          {ENABLE_MAP_PREVIEW && (
            <MapModal
              show={showMapModal}
              onHide={() => setShowMapModal(false)}
              markers={mapMarkers}
              title="Explore on Map"
            />
          )}
        </main>
      </div>
    </div>
  );
}
