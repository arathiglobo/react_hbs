import React, { useState, useEffect } from "react";
import { useAccordionButton } from "react-bootstrap/AccordionButton";
import {
  Card,
  Button,
  Row,
  Col,
  Badge,
  Accordion,
  Spinner,
  Alert,
  Modal,
  Form,
} from "react-bootstrap";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import {
  FaBed,
  FaUtensils,
  FaStar,
  FaMapMarkerAlt,
  FaPhone,
  FaCalendarAlt,
  FaUsers,
  FaInfoCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaChevronDown,
  FaChevronUp,
  FaHotel,
  FaMoneyBillWave,
  FaShieldAlt,
  FaGlobe,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/RoomList.css";
import axiosInstance from "../components/AxiosInstance";
import toast from "react-hot-toast";
import { formatFlexibleDate } from "../utils/dateUtils";
import RoomFilters from "../components/roomlist/RoomFilters";
import useRoomFilters from "../hooks/useRoomFilters";

/**
 * Renders "Valid: <from> - <to>" for a policy validity period, or null when
 * neither date is usable — same helper Inhouse RoomList uses so the modal
 * output looks identical.
 */
const renderPolicyValidity = (fromDate, toDate) => {
  const from = formatFlexibleDate(fromDate);
  const to = formatFlexibleDate(toDate);
  if (!from && !to) return null;
  return `Valid: ${from || "N/A"} - ${to || "N/A"}`;
};

/**
 * ATHARVA-only per-rate deadline pill for the room list card. Source is the
 * raw supplier DeadLineDate carried on rate.deadlineDate as "DD-MMM-YYYY"
 * (e.g. "18-Jun-2023") — see AtharvaSingleHotelOrchestrator.java. We format
 * to "DD MMM YYYY" and stamp a static "11:59 PM (UAE)" time per the operator
 * spec. Returns null when the field is missing or the string doesn't parse,
 * so the pill silently disappears for non-Atharva rates and malformed rows.
 */
/**
 * Darina (apiId 16) per-rate free-cancellation deadline pill.
 * BE emits `rate.deadlineDate` as ISO `yyyy-MM-dd` — the toDate of the
 * "Free cancellation until X" band from Darina's WithFullResponseControl
 * search response. We render "Free cancellation until DD MMM YYYY, 11:59 PM UAE"
 * so the operator sees the exact cut-off before opening the policy modal.
 * Returns null for missing / malformed input.
 */
const renderDarinaDeadlinePill = (deadlineDate) => {
  if (!deadlineDate || typeof deadlineDate !== "string") return null;
  const parts = deadlineDate.trim().split("-");
  if (parts.length !== 3) return null;
  const [y, mm, d] = parts;
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monIdx = parseInt(mm, 10) - 1;
  if (!y || !d || Number.isNaN(monIdx) || monIdx < 0 || monIdx > 11) return null;
  return (
    <span
      className="text-danger fw-normal"
      title="deadline date"
    >
      Deadline Date:  {parseInt(d, 10)} {monthNames[monIdx]} {y}
    </span>
  );
};

const renderAtharvaDeadlinePill = (deadlineDate) => {
  if (!deadlineDate || typeof deadlineDate !== "string") return null;
  const parts = deadlineDate.trim().split("-");
  if (parts.length !== 3) return null;
  const [d, monShort, y] = parts;
  const monthMap = {
    jan: "Jan",
    feb: "Feb",
    mar: "Mar",
    apr: "Apr",
    may: "May",
    jun: "Jun",
    jul: "Jul",
    aug: "Aug",
    sep: "Sep",
    oct: "Oct",
    nov: "Nov",
    dec: "Dec",
  };
  const mon = monthMap[String(monShort || "").toLowerCase().slice(0, 3)];
  if (!d || !mon || !y) return null;
  return (
    <span
      bg="warning"
      text="dark"
      className="fw-normal"
      title="Cancel by this date/time to avoid charges"
    >
      Deadline: {d} {mon} {y}, 23:59
    </span>
  );
};

/**
 * Strip HTML markup out of a policy string so the modal shows plain text.
 * Some suppliers (RateHawk, ATHARVA remarks, etc.) return the cancellation
 * policy with embedded <div>, <p>, <br>, <ul>/<li>, <b> etc. We convert
 * block-level closes and <br> to newlines (the modal uses white-space:
 * pre-line, so newlines render as line breaks), then drop every tag, then
 * decode the handful of HTML entities suppliers actually send. Returns "" for
 * a null / undefined input so React never renders "undefined".
 */
const stripHtmlTags = (raw) => {
  if (raw == null) return "";
  const s = String(raw)
    // Block-level breaks first, so text on either side of a </div>/<br>
    // ends up on separate lines in the modal.
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6])>/gi, "\n")
    // Bulletise <li> entries so lists remain readable after tags are gone.
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/li>/gi, "")
    // Drop every other tag (including opening <p>, <b>, <ul>, attributes …).
    .replace(/<[^>]+>/g, "")
    // Common HTML entities we actually see in supplier payloads.
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse runs of blank lines and trim trailing whitespace on each line.
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
};

function AccordionToggleButton({ eventKey, isActive }) {
  const decoratedOnClick = useAccordionButton(eventKey);
  return (
    <Button
      variant="outline-primary"
      size="sm"
      onClick={decoratedOnClick}
      className="d-flex align-items-center gap-1"
    >
      {isActive ? "Hide Details/Book" : "View Details/Book"}
      {isActive ? <FaChevronUp /> : <FaChevronDown />}
    </Button>
  );
}

/**
 * External / API-supplier room list. Presentation mirrors the Inhouse
 * RoomList; business logic (fetch endpoint, per-supplier accurate-rate
 * re-fetch for apiId 12/15, sessionStorage.bookingData ARRAY shape that
 * ApiBookingPageForHotels.jsx consumes) is preserved verbatim.
 */
const ExternalApiRoomList = () => {
  // ─────────────────────────────── state ───────────────────────────────
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [hotelStaticData, setHotelStaticData] = useState(null);
  const [searchPayload, setSearchPayload] = useState(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  // `selectedRate` — array of rate rows used by the accurate-rate confirm
  // modal (apiId 12/15). Kept as an array because ApiBookingPageForHotels
  // reads bookingData.selectedRate via .map/.flatMap.
  const [selectedRate, setSelectedRate] = useState([]);

  // Display currency carried over from the hotel search. All rates remain
  // AED internally; this only re-formats numbers on screen.
  const [displayCurrency, setDisplayCurrency] = useState({
    code: "AED",
    factor: 1,
  });

  // Per-room-slot expansion keys so opening a category in Room 1 doesn't
  // also open it in Room 2 (multi-room searches only).
  const [activeAccordions, setActiveAccordions] = useState({});

  // One selection slot per requested room. Each entry: { roomNo,
  // selectedRate, hotelId, hotelName }. Matches the Inhouse shape so the
  // per-rate radio / bottom "Continue with Booking" flow lines up.
  const [selectedRooms, setSelectedRooms] = useState([]);

  // GRN-only bundle mode toggle (visible only for GRN multi-room searches).
  // "bundled"  = default, one rate covers all rooms (certified flow).
  // "non-bundled" = per-room rate picker; each room gets its own rateKey,
  //                 all picks must share the same group_code (tokenId).
  // Toggling clears selections so an incompatible mid-flight pick can't leak
  // into the booking payload. Non-GRN hotels ignore this state entirely.
  const [bundleMode, setBundleMode] = useState("bundled");

  // Agent credit gate. Same pattern as Inhouse — soft warning, never
  // blocks; user clicks "OK, continue" and we resume the queued booking
  // handler with skipCreditCheck=true so downstream flow is unchanged.
  const [agentBalance, setAgentBalance] = useState(null);
  const [showInsufficientCreditModal, setShowInsufficientCreditModal] =
    useState(false);
  const [pendingBookingFn, setPendingBookingFn] = useState(null);

  // Cancellation Policies & Terms modal — sourced from the search
  // response; no extra API call for external suppliers.
  //
  // Exception: ATHARVA (apiId 3). Their search response has no cancellation
  // policy — it is only produced by the HPreBooking call. When the user opens
  // the modal for an ATHARVA rate we call /api/hotel-booking/atharva/prebook,
  // display the returned policies, and cache the response keyed by rate so
  // subsequent opens are instant and the booking payload can pick up the
  // fresh TokenId / HKey / RateKey the vendor requires.
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [policiesModalData, setPoliciesModalData] = useState({
    cancellationPolicies: [],
    termsAndConditions: [],
    selectedRoomLabel: "",
  });
  const [prebookLoading, setPrebookLoading] = useState(false);
  const [prebookError, setPrebookError] = useState(null);
  // rateKey -> AtharvaPreBookResponseDTO (fresh tokenId/hKey/rateKey/policies)
  const [atharvaPrebookCache, setAtharvaPrebookCache] = useState({});
  // rateKey -> GrnRecheckResponseDTO (fresh price/policy/grnSearchId).
  // Populated the first time the guest opens the Cancellation Policies &
  // Terms modal for a GRN rate; subsequent opens are instant and the
  // booking payload will pull `grnSearchId` back out of here.
  const [grnRecheckCache, setGrnRecheckCache] = useState({});

  const location = useLocation();
  const navigate = useNavigate();

  const apiIdMapping = {
    JUMEIRAH: 10,
    IWTX: 12,
    X3: 15,
    RATEHAWK: 14,
    DARINA: 16,
    ATHARVA: 3,
    // GRN Connect. Rate-recheck path lives at /api/hotel-booking/grn/recheck
    // and is called only when the guest opens the Cancellation Policies &
    // Terms modal for a GRN rate — never on page load. apiId=20 avoids
    // colliding with the existing Juniper booking's apiId=17.
    GRN: 20,
  };

  const activeUserRole = localStorage.getItem("currentActiveRole");

  // ─────────────────────────── helpers ────────────────────────────────

  /**
   * Fetch ATHARVA HPreBooking for a single selected rate and turn its
   * `Policies[] × CancellationPolicy[]` into the same {policyText, fromDate,
   * toDate} shape the modal already renders. On success the response is
   * cached against the rate's `rateKey` so opening the modal again is free
   * and the booking payload can pull the fresh keys back out.
   *
   * Returns the response object (success or failure) so the caller can
   * decide whether to still open the modal, which we always do — showing the
   * error inside the same modal is more discoverable than a toast.
   */
  const fetchAtharvaPrebook = async (rate) => {
    if (!rate?.rateKey || !rate?.hKey || !rate?.tokenId) {
      return {
        success: false,
        message:
          "ATHARVA prebook: search response is missing tokenId / hKey / rateKey — cannot fetch policy.",
      };
    }
    if (atharvaPrebookCache[rate.rateKey]) {
      return atharvaPrebookCache[rate.rateKey];
    }
    const { payload } = roomData || {};
    const req = {
      agentId: payload?.agentId ? String(payload.agentId) : null,
      cityId: payload?.cityId || null,
      nationalityId: payload?.nationalityId || null,
      nationality: payload?.nationality || null,
      checkInDate: payload?.checkInDate,
      checkOutDate: payload?.checkOutDate,
      hotelCode: payload?.hotelCode,
      tokenId: rate.tokenId,
      hKey: rate.hKey,
      rooms: (payload?.rooms || []).map((r, i) => ({
        roomSrNo: i + 1,
        noOfAdult: r.adults,
        noOfChild: r.children || 0,
        childAges: r.childAges || [],
        rateKey: rate.rateKey,
      })),
    };
    try {
      const resp = await axiosInstance.post(
        "/api/hotel-booking/atharva/prebook",
        req,
      );
      const data = resp?.data || {};
      if (data.success) {
        setAtharvaPrebookCache((prev) => ({ ...prev, [rate.rateKey]: data }));
      }
      return data;
    } catch (err) {
      const backendMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Prebook request failed";
      return { success: false, message: backendMsg };
    }
  };

  /**
   * Fetch GRN Rate Recheck for a single selected rate. Turns GRN's response
   * into the same {policyText, fromDate, value, percentOrAmount} rows the
   * modal already renders for other suppliers. On success caches the
   * response against the rate's `rateKey` so opening the modal again is
   * free and the booking payload can pull the fresh grnSearchId / rateKey /
   * groupCode back out.
   */
  const fetchGrnRecheck = async (rate) => {
    if (!rate?.rateKey) {
      return {
        success: false,
        message: "GRN recheck: rate is missing rateKey — cannot verify policy.",
      };
    }
    if (grnRecheckCache[rate.rateKey]) {
      return grnRecheckCache[rate.rateKey];
    }
    const { payload } = roomData || {};
    const req = {
      hotelCode: payload?.hotelCode,
      checkInDate: payload?.checkInDate,
      checkOutDate: payload?.checkOutDate,
      nationality: payload?.nationality,
      agentId: payload?.agentId ? String(payload.agentId) : null,
      rooms: payload?.rooms || [],
      rateKey: rate.rateKey,
      groupCode: rate.tokenId || null,
      roomCode: rate.roomTypeCode || null,
    };
    try {
      const resp = await axiosInstance.post(
        "/api/hotel-booking/grn/recheck",
        req,
      );
      const data = resp?.data || {};
      if (data.success) {
        setGrnRecheckCache((prev) => ({ ...prev, [rate.rateKey]: data }));
      }
      return data;
    } catch (err) {
      const backendMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Recheck request failed";
      return { success: false, message: backendMsg };
    }
  };

  /**
   * Call /api/hotel-booking/darina/prebook for a single rate (search-time
   * values are enough — hotelCode + roomTypeCode + mealPlanCode + pax +
   * dates + nationality). Returns the DarinaPreBookResponseDTO shape:
   *   { success, message, contractTokenId, rate, ratePerNight,
   *     rateWithoutMarkup, cancellationPolicies, deadlineDate,
   *     nonRefundable, roomCategory, mealPlan }
   */
  const fetchDarinaPrebook = async (rate) => {
    const payload = roomData?.payload || {};
    const hotel = roomData?.hotels?.[0] || {};
    const firstRoom = payload?.rooms?.[0] || {};
    const req = {
      agentId: payload?.agentId ? String(payload.agentId) : null,
      nationality: payload?.nationality || null,
      checkInDate: payload?.checkInDate,
      checkOutDate: payload?.checkOutDate,
      hotelCode: payload?.hotelCode || hotel?.hotelId || null,
      roomTypeCode: rate?.roomTypeCode,
      mealPlanCode: rate?.mealPlanCode,
      // BE tolerates a null occupancyId; passing it when known helps the
      // supplier pick the exact rate serial we saw at search time.
      occupancyId: rate?.occupancyId || null,
      contractTokenId: rate?.contractTokenId || null,
      adults: firstRoom.adults ?? firstRoom.noOfAdult ?? 1,
      children: firstRoom.children ?? firstRoom.noOfChild ?? 0,
      childAges: firstRoom.childAges || [],
    };
    try {
      const resp = await axiosInstance.post(
        "/api/hotel-booking/darina/prebook",
        req,
      );
      return resp?.data || { success: false, message: "Empty response" };
    } catch (err) {
      const backendMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Prebook request failed";
      return { success: false, message: backendMsg };
    }
  };

  const openPoliciesModal = async (rate, hotelDetail) => {
    const label = [rate?.roomCategory, rate?.mealPlan]
      .filter(Boolean)
      .join(" • ");
    const inlineTerms = Array.isArray(rate?.termsAndConditions)
      ? rate.termsAndConditions
      : Array.isArray(hotelDetail?.termsAndConditions)
        ? hotelDetail.termsAndConditions
        : [];
    // IWTX (and other API suppliers) don't send policy rows for
    // non-refundable rates — the list arrives empty. Without carrying the
    // flag through, the modal used to fall back to "No cancellation
    // policies available", which reads as "we don't know" instead of
    // "you can't cancel". Match the wording the booking page already uses.
    const isNonRefundable =
      String(rate?.nonRefundable).toLowerCase() === "true";

    const supplierApiId = resolveApiId(hotelDetail);
    const isAtharva = supplierApiId === apiIdMapping.ATHARVA;
    const isGrn = supplierApiId === apiIdMapping.GRN;

    // GRN: policies come from a real-time recheck call. The Room List's
    // policy rows are the search-time snapshot; recheck gives us GRN's
    // authoritative price + cancellation + inclusions before the guest
    // proceeds to booking. Opens the modal immediately with the search-time
    // policies as a fallback, then swaps them for the rechecked values.
    if (isGrn) {
      const fallbackCancellation = Array.isArray(rate?.cancellationPolicies)
        ? rate.cancellationPolicies
        : [];
      setPrebookError(null);
      setPoliciesModalData({
        cancellationPolicies: fallbackCancellation,
        termsAndConditions: inlineTerms,
        selectedRoomLabel: label,
        nonRefundable: isNonRefundable,
      });
      setShowPoliciesModal(true);
      setPrebookLoading(true);
      try {
        const recheck = await fetchGrnRecheck(rate);
        if (recheck?.success) {
          setPoliciesModalData({
            cancellationPolicies: recheck.cancellationPolicies || fallbackCancellation,
            termsAndConditions: inlineTerms,
            selectedRoomLabel: label,
            // GRN's rate_comments carry pax_comments / remarks / MandatoryTax
            // etc — surface any of them as the top-of-modal notice so the
            // guest sees GRN's own remarks before proceeding.
            remark: recheck.policyText || null,
            nonRefundable:
              typeof recheck.nonRefundable === "boolean"
                ? recheck.nonRefundable
                : isNonRefundable,
          });
        } else {
          setPrebookError(recheck?.message || "Recheck failed.");
          console.warn("GRN recheck: no policy returned:", recheck?.message);
        }
      } finally {
        setPrebookLoading(false);
      }
      return;
    }

    // Non-ATHARVA: policies come from the search response, same as before.
    if (!isAtharva) {
      const cancellation = Array.isArray(rate?.cancellationPolicies)
        ? rate.cancellationPolicies
        : Array.isArray(hotelDetail?.cancellationPolicies)
          ? hotelDetail.cancellationPolicies
          : [];
      setPrebookError(null);
      setPoliciesModalData({
        cancellationPolicies: cancellation,
        termsAndConditions: inlineTerms,
        selectedRoomLabel: label,
        nonRefundable: isNonRefundable,
      });
      setShowPoliciesModal(true);
      return;
    }

    // ATHARVA: open the modal in a loading state, hit prebook, then fill it.
    setPrebookError(null);
    setPoliciesModalData({
      cancellationPolicies: [],
      termsAndConditions: inlineTerms,
      selectedRoomLabel: label,
      nonRefundable: isNonRefundable,
    });
    setShowPoliciesModal(true);
    setPrebookLoading(true);
    try {
      const prebook = await fetchAtharvaPrebook(rate);
      if (prebook?.success) {
        setPoliciesModalData({
          cancellationPolicies: prebook.cancellationPolicies || [],
          termsAndConditions: inlineTerms,
          selectedRoomLabel: label,
          // Aggregated Atharva Policies[].Remark from the prebook — shown as
          // a top-of-modal notice (includes "IMPORTANT NOTE …" content).
          remark: prebook.remark || null,
        });
      } else {
        // Supplier prebook returned no policy (e.g. Atharva "HPreBooking error
        // 2001: No Result Found."). Swallow the raw vendor text so the modal
        // shows only the "No cancellation policies available." / "No terms &
        // conditions available." placeholders instead of an alarming banner.
        // The vendor detail is still logged for operator triage.
        console.warn("Atharva prebook: no policy returned:", prebook?.message);
      }
    } finally {
      setPrebookLoading(false);
    }
  };

  const getMealPlanIcon = (mealPlan) => {
    switch (String(mealPlan || "").toLowerCase()) {
      case "room only":
        return <FaBed className="text-muted" />;
      case "breakfast":
        return <FaUtensils className="text-warning" />;
      case "full board":
        return <FaUtensils className="text-success" />;
      default:
        return <FaUtensils className="text-primary" />;
    }
  };

  const getRefundStatusBadgeInRoomList = (nonRefundable) => {
    const value = String(nonRefundable).toLowerCase();
    switch (value) {
      case "false":
        return <Badge bg="success">Flexible</Badge>;
      case "true":
        return <Badge bg="danger">Non-Refundable</Badge>;
      default:
        return <Badge bg="secondary">{String(nonRefundable)}</Badge>;
    }
  };

  const getRoomStatusBadge = (roomStatus) => {
    switch (roomStatus) {
      case "On Request":
        return (
          <small>
            This room can be booked{" "}
            <Badge
              bg="warning"
              text="dark"
              className="px-2 py-1 ms-1 fw-bold border border-warning shadow-sm"
            >
              On Request
            </Badge>
          </small>
        );
      case "Available":
        return (
          <small>
            <span style={{ color: "#198754", fontWeight: 700 }}>Available</span>
          </small>
        );
      default:
        return <small>This room is Available</small>;
    }
  };

  const getRefundStatusBadge = (refundStatus) => {
    switch (refundStatus) {
      case "FLEXIBLE":
        return <Badge bg="success">Flexible</Badge>;
      case "NON REFUNDABLE":
        return <Badge bg="danger">Non-Refundable</Badge>;
      default:
        return <Badge bg="secondary">{refundStatus}</Badge>;
    }
  };

  const formatPrice = (price) => {
    // Rates stay in AED; convert only for display using the carried-over
    // factor from the search page. bookingData / credit checks continue
    // to use raw AED so the API payload contract is unchanged.
    const converted = (Number(price) || 0) * (displayCurrency.factor || 1);
    return `${displayCurrency.code || "AED"} ${converted.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const renderStars = (rating) =>
    Array.from({ length: rating || 0 }, (_, i) => (
      <FaStar key={i} className="text-warning" />
    ));

  // Shared filter state — same hook every other room-list page uses.
  const filters = useRoomFilters();

  // Rate → normalised shape the shared predicate understands.
  const rateMatches = (rate) =>
    filters.rateMatches({
      isNonRefundable: String(rate.nonRefundable).toLowerCase() === "true",
      mealPlan: rate.mealPlan,
    });

  // ─────────────────────────── effects ────────────────────────────────
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        setError(null);

        let payload = location.state?.payload;
        let meta = location.state?.meta;
        let currencyInfo = location.state?.currency;

        if (!payload) {
          try {
            const stored = sessionStorage.getItem("roomListPayload");
            if (stored) {
              const parsed = JSON.parse(stored);
              payload = parsed.payload;
              meta = parsed.meta;
              currencyInfo = parsed.currency || currencyInfo;
              setHotelStaticData(meta);
              setSearchPayload(payload);
            }
          } catch (e) {
            console.error("Error parsing sessionStorage:", e);
          }
        }

        if (currencyInfo) {
          setDisplayCurrency({
            code: currencyInfo.code || "AED",
            factor:
              Number(currencyInfo.factor) > 0 ? Number(currencyInfo.factor) : 1,
          });
        }

        if (!payload) {
          setError("Missing search context. Please go back and try again.");
          setLoading(false);
          return;
        }

        // For GRN multi-room searches, ask the backend to include
        // non-bundled + partial-bundled rates alongside bundled ones in the
        // response. The rates come back tagged with a `bundleType` field so
        // the UI can toggle between "Book as one package" (bundled) and
        // "Pick per room" (non-bundled) without a second network trip.
        // Single-room and non-GRN searches are unaffected — the flag is
        // GRN-scoped on the backend and other suppliers ignore it.
        const isGrnMultiRoom =
          Number(payload?.apiId) === 20 && (payload?.rooms || []).length > 1;
        const searchBody = isGrnMultiRoom
          ? { ...payload, includeNonBundled: true }
          : payload;
        const res = await axiosInstance.post("/api/hotel-rooms/search", searchBody);

        if (!res.data || res.data.success === false) {
          const message = res.data?.message || "Search failed. Please try again.";
          if (message.toLowerCase().includes("no availability found")) {
            setShowUnavailableModal(true);
          } else {
            setError(message);
          }
          setLoading(false);
          return;
        }

        const enriched = {
          ...res.data,
          hotels: (res.data.hotels || []).map((h) => ({
            ...h,
            roomCategories: (h.roomCategories || []).map((c) => ({
              ...c,
              availableRates: (c.availableRates || [])
                .slice()
                .sort((a, b) => (a.totalRate || 0) - (b.totalRate || 0)),
            })),
          })),
          meta: meta || {},
          payload,
        };

        setRoomData(enriched);
      } catch (err) {
        console.error("Room search failed:", err);
        setError("Search failed. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, [location.state]);

  // Agent credit balance — same endpoint / same fallback keys as Inhouse.
  useEffect(() => {
    const aId = roomData?.payload?.agentId;
    if (!aId) {
      setAgentBalance(null);
      return;
    }
    let cancelled = false;
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${aId}`)
      .then((res) => {
        if (!cancelled) {
          setAgentBalance(
            res?.data?.effectiveAvailableCreditLimit ??
              res?.data?.availableCreditLimit ??
              null,
          );
        }
      })
      .catch(() => {
        if (!cancelled) setAgentBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [roomData]);

  // Initialise one selection slot per requested room the first time (or
  // whenever the slot count changes). Preserves picks across filter /
  // view-mode toggles.
  const numRooms = (roomData?.payload?.rooms || []).length || 1;
  const isMultiRoom = numRooms > 1;

  useEffect(() => {
    setSelectedRooms((prev) => {
      if (prev.length === numRooms) return prev;
      return Array.from({ length: numRooms }, (_, i) => ({
        roomNo: i + 1,
        selectedRate: null,
        hotelId: null,
        hotelName: null,
      }));
    });
  }, [numRooms]);

  const allRoomsSelected =
    selectedRooms.length > 0 &&
    selectedRooms.every((r) => r.selectedRate !== null);

  // GRN non-bundled UI is only relevant for a multi-room GRN search — the
  // toggle, per-room picker, and group_code guard are all no-ops otherwise.
  // Derived once so all downstream render code (filter chain, click handler,
  // empty-state message) reads a single truthy value.
  const isGrnMultiRoomFlow =
    Number(roomData?.payload?.apiId) === 20 && isMultiRoom;
  const isNonBundledMode = isGrnMultiRoomFlow && bundleMode === "non-bundled";

  // For the empty-state banner: does the search response actually contain
  // any non-bundled / partial-bundled rates? Some hotels have bundled-only
  // inventory even when includeNonBundled=true is set — in that case the
  // "Pick per room" mode has nothing to render and the user is stuck
  // wondering why. Precomputing this lets the toggle show a helpful
  // message instead of an empty accordion.
  const hasNonBundledRates =
    isGrnMultiRoomFlow &&
    (roomData?.hotels || []).some((h) =>
      (h?.roomCategories || []).some((c) =>
        (c?.availableRates || []).some(
          (r) => r?.bundleType === "non-bundled" || r?.bundleType === "partial-bundled",
        ),
      ),
    );

  // Handler for the mode toggle. Switching modes ALWAYS clears prior picks so
  // (a) a bundled rate can't leak into the per-room picker (or vice versa) and
  // (b) the group_code / rateKey combos stay coherent when the picker
  // re-renders with the new rate set.
  const switchBundleMode = (nextMode) => {
    if (nextMode === bundleMode) return;
    setBundleMode(nextMode);
    setSelectedRooms((prev) =>
      prev.map((r) => ({
        ...r,
        selectedRate: null,
        hotelId: null,
        hotelName: null,
      })),
    );
    setActiveAccordions({});
  };

  // ─────────────────── credit / booking handlers ──────────────────────
  const isInsufficientBalance = (requiredAmount) => {
    if (agentBalance == null) return false;
    const required = Number(requiredAmount) || 0;
    const available = Number(agentBalance) || 0;
    return required > available;
  };

  // Resolve the effective supplier apiId for the current search. External
  // responses come back with `apiType` on the hotel — map it back to the
  // numeric id that /api/hotel-booking/create and the accurate-rate
  // endpoints expect. Falls back to whatever the search payload carried.
  const resolveApiId = (hotelObj) => {
    const payloadApiId = roomData?.payload?.apiId;
    const apiType =
      hotelObj?.apiType ||
      (typeof hotelObj?.hotelName === "string"
        ? hotelObj.hotelName.split("(").pop().replace(")", "")
        : "");
    return apiIdMapping[String(apiType || "").toUpperCase()] || payloadApiId;
  };

  // Map a single rate onto the shape ApiBookingPageForHotels expects
  // (selectedRate is an ARRAY of these — .map / .flatMap on the far side).
  // Field set matches the pre-refactor direct-navigation payload exactly;
  // hotelCode is intentionally omitted here (matches prior behaviour —
  // the booking page falls back to "" via `hotelCode || ""`).
  //
  // Additive: roomTypeCode / mealPlanCode / contractTokenId — IWTX/IOL-X
  // BookHotel needs these three per room. Other suppliers ignore them.
  const mapRateForPayload = (rate, hotelObj, roomNo) => {
    // ATHARVA prebook keys: prefer the FRESH values from the cached prebook
    // response (HCreateBooking requires them) and fall back to the search
    // response values so a rate that wasn't prebooked yet still round-trips.
    // Also carry the cancellation policy the modal fetched, so the booking
    // page can compute the deadline the same way it does for other suppliers.
    const prebook = rate?.rateKey ? atharvaPrebookCache[rate.rateKey] : null;
    const prebookRoom = prebook?.rooms?.find(
      (r) => (r.roomSrNo ?? null) === roomNo,
    );
    // GRN recheck-time flag: pan_required=true means the booking page must
    // render mandatory PAN input on the primary guest form. Read from the
    // cached recheck response (populated when the operator opened the
    // Cancellation Policies modal). Falls back to false when recheck wasn't
    // run yet or the rate isn't GRN.
    const grnRecheck = rate?.rateKey ? grnRecheckCache[rate.rateKey] : null;

    return {
      roomNo,
      roomCategory: rate?.roomCategory,
      mealPlan: rate?.mealPlan,
      contractLabel: rate?.contractLabel,
      nonRefundable: rate?.nonRefundable,
      rate: rate?.totalRate,
      rateWithoutMarkup: rate?.totalRateWithoutMarkup,
      roomRateBasedOnRoomCount: rate?.roomRateBasedOnRoomCount,
      roomRateBasedOnRoomCount_WithoutMarkup:
        rate?.roomRateBasedOnRoomCount_WithoutMarkup,
      roomStatus: rate?.roomStatus,
      currency: "AED",
      hotelId: hotelObj?.hotelId,
      hotelName: hotelObj?.hotelName,
      // Prefer prebook cancellation policies over search-time ones for ATHARVA
      // (search response has none). For other suppliers the search value wins.
      cancellationPolicy:
        (prebook?.cancellationPolicies?.length && prebook.cancellationPolicies) ||
        rate?.cancellationPolicies,
      // IWTX booking payload fields — forwarded from the search response
      // so IwtxHotelBookingService can build its JSON BookHotel body.
      roomTypeCode: rate?.roomTypeCode,
      mealPlanCode: rate?.mealPlanCode,
      contractTokenId: rate?.contractTokenId,
      // ATHARVA-only carriers. Ignored by every other supplier's booking
      // service. `rateKey` prefers the prebook-refreshed value.
      atharvaRateKey: prebookRoom?.rateKey || rate?.rateKey || null,
      atharvaHKey: prebook?.hKey || rate?.hKey || null,
      atharvaTokenId: prebook?.tokenId || rate?.tokenId || null,
      // Search-time keys preserved untouched. The booking page's late
      // prebook (multi-room path) always needs to send the ORIGINAL
      // search-response values — the "atharva*" fields above may have
      // been overwritten with fresh keys from a per-rate prebook when
      // the operator opened the Cancellation Policies modal, and mixing
      // fresh + search values across rooms is what triggers Atharva's
      // "1005: Invalid RateKey" error on multi-room prebook.
      atharvaSearchRateKey: rate?.rateKey || null,
      atharvaSearchHKey: rate?.hKey || null,
      atharvaSearchTokenId: rate?.tokenId || null,
      // Flag: true when the tokens above came from a prior /atharva/prebook
      // call (operator opened the Cancellation Policies modal here). Booking
      // page uses this to decide whether it must run prebook itself before
      // submitting HCreateBooking — the search tokens alone won't work.
      atharvaPrebooked: !!prebook,
      // Operator-facing deadline (already earliest cancellation date minus
      // 2 days, computed on the backend). Booking page renders this in the
      // cancellation accordion header. Null when prebook wasn't run yet.
      atharvaDisplayDeadlineDate: prebook?.displayDeadlineDate || null,
      // GRN-only carry: whether the rechecked rate requires PAN on the
      // holder. Booking page uses this to render the PAN input card.
      // Defaults to false; other suppliers just ignore this key.
      panRequired: grnRecheck?.panRequired === true,
      // Darina (apiId 16) free-cancellation deadline (ISO yyyy-MM-dd). BE
      // emits it on rate.deadlineDate as the "Free cancellation until X"
      // band's toDate. Carried through so the booking page's accordion
      // header can show it and the outbound payload can echo it back.
      deadlineDate: rate?.deadlineDate || null,
    };
  };

  const handleRateSelect = (roomIndex, rate, hotelId, hotelName) => {
    // ATHARVA (apiId=3) multi-room constraint: every rateKey sent to
    // HPreBooking must belong to the same VendorList (same HKey). The
    // search response splits identical-looking rates across multiple
    // VendorList entries under distinct HKeys, so a flat rate list can
    // easily let the operator pick incompatible rates → Atharva returns
    // "1005: Invalid RateKey" on prebook. Reject cross-vendor picks up
    // front with a clear message so the operator reselects instead of
    // discovering the mismatch on the booking page.
    const currentApiId = String(roomData?.payload?.apiId || "");
    if (currentApiId === "3" && rate?.hKey) {
      const otherSelected = selectedRooms.find(
        (r, i) => i !== roomIndex && r?.selectedRate,
      );
      const otherHKey = otherSelected?.selectedRate?.hKey;
      if (otherHKey && otherHKey !== rate.hKey) {
        toast.error(
          "Atharva multi-room bookings require every room to be selected from the SAME rate group. Please clear the other room's selection first, or pick a rate from the same vendor group.",
        );
        return;
      }
    }

    // GRN (apiId=20) bundled multi-room: one rate_key covers ALL rooms.
    // A bundled rate returns rooms[] with one entry per physical room in
    // the search request; the backend then builds a single booking_items[]
    // with the requested pax split. Mirror the selection across every room
    // so what the operator picks in ANY accordion is what actually gets
    // booked (avoids the Room-1-only bug that produced Single-Standard-for
    // -both when the operator asked for Single+Double).
    //
    // NON-BUNDLED mode (bundleMode === "non-bundled"): the user picks a
    // different rate per room, all sharing the same group_code (enforced
    // by the picker filter above + the backend guard). Fall through to the
    // generic per-slot setter below — do NOT mirror.
    if (currentApiId === "20" && selectedRooms.length > 1 && bundleMode === "bundled") {
      setSelectedRooms((prev) => {
        const currentlySelectedInClicked =
          prev[roomIndex]?.selectedRate === rate;
        if (currentlySelectedInClicked) {
          // Toggle-off: clear the rate from every room in the bundle.
          return prev.map((r) => ({
            ...r,
            selectedRate: null,
            hotelId: null,
            hotelName: null,
          }));
        }
        // Select same rate for every room in the bundle.
        return prev.map((r) => ({
          ...r,
          selectedRate: rate,
          hotelId,
          hotelName,
        }));
      });
      return;
    }

    // GRN non-bundled AUTO-LINK: a rate with numberOfRooms > 1 (partial-
    // bundled) MUST be picked for exactly that many matching rooms — GRN
    // rejects the booking with error 5126 otherwise. Instead of blocking
    // the user with a mismatch modal at Continue Booking, we auto-fill
    // the clicked slot + the next (N-1) unpicked slots whose pax matches
    // the rate's occupancy. The rate card render adds "Linked to Room X"
    // badges so the auto-fill is visible. Toggle-off / re-pick clears the
    // whole linked group atomically. Scoped strictly to GRN + non-bundled
    // multi-room + numberOfRooms > 1 so every other flow falls through
    // to the generic per-slot setter below.
    const expectedRooms = Number(rate?.numberOfRooms) || 1;
    if (
      currentApiId === "20" &&
      bundleMode === "non-bundled" &&
      selectedRooms.length > 1 &&
      expectedRooms > 1
    ) {
      // Toggle-off: clicking the same rate in an already-linked slot
      // clears the whole group.
      const alreadyLinkedInClicked =
        selectedRooms[roomIndex]?.selectedRate?.rateKey === rate?.rateKey;
      if (alreadyLinkedInClicked) {
        setSelectedRooms((prev) =>
          prev.map((r) =>
            r?.selectedRate?.rateKey === rate?.rateKey
              ? { ...r, selectedRate: null, hotelId: null, hotelName: null }
              : r,
          ),
        );
        return;
      }

      // Re-pick in a slot that's currently part of a DIFFERENT linked
      // group: clear that whole group first, then fall through to the
      // fresh link below. Keeps groups atomic.
      const currentGroupKey = selectedRooms[roomIndex]?.selectedRate?.rateKey;
      const searchRooms = roomData?.payload?.rooms || [];
      const rateAdults = Number(rate?.paxAdults);
      const rateChildren = Number(rate?.paxChildren);
      const hasPaxOnRate = !Number.isNaN(rateAdults) && rate?.paxAdults != null;

      // Find (expectedRooms - 1) additional slots that:
      //   (a) aren't the clicked slot,
      //   (b) aren't part of some OTHER group (empty, or part of the
      //       group we're about to clear above), and
      //   (c) have matching pax (skip pax check if the rate doesn't
      //       expose paxAdults/paxChildren — filter chain already gates
      //       by occupancy so any visible rate is pax-safe for its slot).
      const linkTargets = [roomIndex];
      for (
        let i = 0;
        i < selectedRooms.length && linkTargets.length < expectedRooms;
        i++
      ) {
        if (i === roomIndex) continue;
        const otherKey = selectedRooms[i]?.selectedRate?.rateKey;
        const isFree =
          !otherKey || (currentGroupKey && otherKey === currentGroupKey);
        if (!isFree) continue;
        if (hasPaxOnRate) {
          const s = searchRooms[i];
          const roomAdults = Number(s?.adults) || 0;
          const roomChildren = Number(s?.children) || 0;
          if (roomAdults !== rateAdults || roomChildren !== rateChildren) {
            continue;
          }
        }
        linkTargets.push(i);
      }

      if (linkTargets.length < expectedRooms) {
        const label =
          rate?.roomTypeDescription || rate?.roomCategory || "This rate";
        toast.error(
          `"${label}" covers ${expectedRooms} rooms — only ${linkTargets.length} matching unpicked slot(s) available. Unpick another room first, or use "Book as one package".`,
        );
        return;
      }

      setSelectedRooms((prev) =>
        prev.map((r, i) => {
          // Clear any slot that was part of the group we're replacing.
          if (currentGroupKey && r?.selectedRate?.rateKey === currentGroupKey) {
            r = { ...r, selectedRate: null, hotelId: null, hotelName: null };
          }
          if (linkTargets.includes(i)) {
            return { ...r, selectedRate: rate, hotelId, hotelName };
          }
          return r;
        }),
      );
      return;
    }

    setSelectedRooms((prev) =>
      prev.map((r, i) => {
        if (i !== roomIndex) return r;
        if (r.selectedRate === rate) {
          return { ...r, selectedRate: null, hotelId: null, hotelName: null };
        }
        return { ...r, selectedRate: rate, hotelId, hotelName };
      }),
    );
  };

  /**
   * Single-room "View Details / Select" handler. Mirrors Inhouse's
   * handleBooking but produces the ARRAY-shaped bookingData that
   * ApiBookingPageForHotels reads. Preserves the apiId 12/15 accurate-rate
   * re-fetch flow.
   */
  const handleBooking = (rate, skipCreditCheck = false) => {
    const { payload, hotels } = roomData;
    const hotel = hotels?.[0];
    if (!hotel) return;

    if (
      !skipCreditCheck &&
      isInsufficientBalance(rate.roomRateBasedOnRoomCount)
    ) {
      setPendingBookingFn(() => () => handleBooking(rate, true));
      setShowInsufficientCreditModal(true);
      return;
    }

    const currentApiId = resolveApiId(hotel);

    // ─── DARINA (apiId=16) live-rate re-check per v5.1 docs. ────────────
    // Cached search response → LIVE re-check (CheckAvailabilityWithCancellation
    // _NoCache_LiveCalculation) → SubmitBooking. Reuse the same
    // "Fetching accurate rate…" spinner + "Room Details" confirm modal
    // as IWTX/X3 (apiId 12/15) — Darina hands back a FRESH <RequestID>
    // that gets stamped onto contractTokenId so SubmitBooking sends it.
    if (currentApiId === apiIdMapping.DARINA) {
      setLoadingRate(true);
      (async () => {
        try {
          const live = await fetchDarinaPrebook(rate);
          if (!live?.success) {
            setLoadingRate(false);
            alert(
              live?.message ||
                "Darina live-rate check failed. Please retry or reselect the rate.",
            );
            return;
          }
          // Build the same shape the Room Details modal reads (rate,
          // roomCategory, mealPlan, nonRefundable, contractLabel) and the
          // booking page's payload builder needs (contractTokenId,
          // deadlineDate, cancellationPolicy, rateWithoutMarkup).
          const accurateRates = [
            {
              roomNo: 1,
              hotelId: hotel.hotelId,
              hotelName: hotel.hotelName,
              hotelCode: payload.hotelCode || hotel.hotelId,
              roomCategory: live.roomCategory || rate.roomCategory,
              mealPlan: live.mealPlan || rate.mealPlan,
              // Contract label — surfaces "Live rate" so the operator
              // knows the modal isn't showing search-time cached data.
              contractLabel: rate.contractLabel || "Live rate (Darina)",
              nonRefundable:
                live.nonRefundable != null
                  ? live.nonRefundable
                  : rate.nonRefundable,
              rate: live.rate ?? rate.totalRate,
              rateWithoutMarkup:
                live.rateWithoutMarkup ?? rate.totalRateWithoutMarkup,
              currency: live.currency || "AED",
              roomTypeCode: rate.roomTypeCode,
              mealPlanCode: rate.mealPlanCode,
              // FRESH Darina <RequestID> from live-calc — MUST replace
              // the search-time contractTokenId so SubmitBooking works.
              contractTokenId: live.contractTokenId || rate.contractTokenId,
              // Live cancellation ladder + free-cancellation cut-off.
              cancellationPolicy:
                (live.cancellationPolicies?.length &&
                  live.cancellationPolicies) ||
                rate.cancellationPolicies,
              deadlineDate: live.deadlineDate ?? rate.deadlineDate,
            },
          ];
          setSelectedRate(accurateRates);
          setLoadingRate(false);
          setShowBookingModal(true);
        } catch (err) {
          console.error("Darina live-rate fetch failed:", err);
          setLoadingRate(false);
          const backendMsg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message;
          alert(
            backendMsg
              ? `Unable to fetch live rate: ${backendMsg}`
              : "Unable to fetch live rate. Please try again.",
          );
        }
      })();
      return;
    }

    // ─── GRN (apiId=20) single-room recheck. Mirrors the multi-room GRN
    //    branch in handleProceedBooking so the single-room "View Details /
    //    Select" path also runs GRN's mandatory /hotel-recheck before the
    //    booking page opens. Without this, single-room GRN bookings skip
    //    the recheck entirely — the room list shows search-time cached data
    //    and any stale rate / policy would only surface after Book Now,
    //    which the certification requires us to catch earlier.
    //
    //    Flow: fetchGrnRecheck (cached per rateKey, so if the operator
    //    already opened the Cancellation Policies modal this is a cache
    //    hit → zero round-trip) → on success, patch mapRateForPayload with
    //    the rechecked price / currency / non-refundable / policies (same
    //    fields the multi-room branch overwrites) → open the Room Details
    //    confirm modal. On failure, alert with the recheck message and
    //    keep the operator on the room list so they can reselect.
    if (currentApiId === apiIdMapping.GRN) {
      setLoadingRate(true);
      (async () => {
        try {
          const recheck = await fetchGrnRecheck(rate);
          if (!recheck?.success) {
            setLoadingRate(false);
            alert(
              recheck?.message ||
                "This rate is no longer available. Please reselect and try again.",
            );
            return;
          }
          const mapped = mapRateForPayload(rate, hotel, 1);
          if (recheck.totalPriceWithMarkup != null) {
            mapped.rate = recheck.totalPriceWithMarkup;
          } else if (recheck.totalPrice != null) {
            mapped.rate = recheck.totalPrice;
          }
          if (recheck.currency) {
            mapped.currency = recheck.currency;
          }
          if (recheck.nonRefundable != null) {
            mapped.nonRefundable = recheck.nonRefundable;
          }
          if (recheck.cancellationPolicies?.length) {
            mapped.cancellationPolicy = recheck.cancellationPolicies;
          }
          // panRequired already flows via mapRateForPayload → grnRecheckCache.
          setSelectedRate([mapped]);
          setLoadingRate(false);
          setShowBookingModal(true);
        } catch (err) {
          console.error("GRN recheck fetch failed:", err);
          setLoadingRate(false);
          const backendMsg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message;
          alert(
            backendMsg
              ? `Unable to verify rate: ${backendMsg}`
              : "Unable to verify rate. Please try again.",
          );
        }
      })();
      return;
    }

    if (currentApiId === 12 || currentApiId === 15) {
      // Accurate-rate re-fetch for IWTX / X3 — same request the current
      // code builds, just for a single room in this branch.
      setLoadingRate(true);
      setTimeout(async () => {
        try {
          // Child ages from the original search — the reprice endpoint (X3
          // in particular) validates that Adult+Child count matches the
          // contractTokenId that was issued for the searched pax mix.
          // Missing `child` on the payload gets rejected with "The child
          // count doesn't correspond selected contract token id".
          const searchChildAges = payload.rooms?.[0]?.childAges || [];
          const childArr = searchChildAges
            .filter((n) => Number(n) > 0)
            .map((age) => ({ age: String(age) }));

          const roomsArray = [
            {
              adult: {
                age: (
                  payload.rooms?.[0]?.adultAges?.[0] ?? 30
                ).toString(),
              },
              ...(childArr.length ? { child: childArr } : {}),
              roomTypeCode: rate.roomTypeCode,
              mealPlanCode: rate.mealPlanCode,
              contractTokenId: rate.contractTokenId || "0",
              roomConfigurationId: 1,
            },
          ];

          const priceCheckReq = {
            searchCriteria: {
              roomConfiguration: { room: roomsArray },
              startDate: payload.checkInDate,
              endDate: payload.checkOutDate,
              hotelCode: payload.hotelCode,
              nationality: payload.nationality,
              includeRateDetails: "Y",
              cancellationPolicy: "Y",
              groupByRooms: "Y",
            },
            // Send the caller-agent's id so the IWTX reprice endpoint can
            // apply the same markup IwtxResponseMapper already applied on
            // the list. Without this the modal/booking page would show
            // the raw net rate, mismatching the room-list card.
            agentId:
              payload?.agentId != null ? String(payload.agentId) : undefined,
          };

          const endpoint =
            currentApiId === 12
              ? "/api/iwtx/hotel/availability"
              : "/api/x3/hotel/availability";

          const response = await axiosInstance.post(endpoint, priceCheckReq);
          const respHotel = response.data.hotels.hotel[0];
          const rooms = respHotel.roomTypeDetails.rooms.room;
          const accurateRates = rooms
            .filter((room) => room != null)
            .map((room, i) => ({
              roomNo: i + 1,
              roomConfigurationId: room.roomConfigurationId,
              hotelId: respHotel.hotelId,
              hotelName: respHotel.hotelName,
              hotelCode: respHotel.hotelCode,
              roomCategory: room.roomType,
              mealPlan: room.mealPlan,
              contractLabel: room.contractLabel,
              nonRefundable: room.nonRefundable,
              // IWTX Rate = total for stay (matches the room-list card).
              // rateDetails.rate is per-night, which was previously used
              // here and silently under-priced the booking. Both fields
              // are marked-up server-side.
              rate: room.rate,
              rateWithoutMarkup: room.rateWithoutMarkup,
              currency: room.currCode,
              // IWTX BookHotel requires RoomTypeCode / MealPlanCode /
              // ContractTokenId per room. Prefer the accurate response's
              // values; fall back to the originally-picked rate so the
              // booking never posts nulls (which IWTX rejects with
              // "ContractTokenID not found, RoomType not found, MealPlan
              // not found").
              roomTypeCode: room.roomTypeCode ?? rate.roomTypeCode,
              mealPlanCode: room.mealPlanCode ?? rate.mealPlanCode,
              contractTokenId: room.contractTokenId ?? rate.contractTokenId,
              // Carry the search-time cancellation policies through so
              // ApiBookingPageForHotels can compute the deadlineDate
              // (2 days before the earliest fromDate). Without this the
              // deadline column on the booking list stays blank.
              cancellationPolicy: rate.cancellationPolicies || [],
            }));

          setSelectedRate(accurateRates);
          setLoadingRate(false);
          setShowBookingModal(true);
        } catch (err) {
          console.error("Accurate rate fetch failed:", err);
          setLoadingRate(false);
          // Surface backend context when available so the operator has
          // something more actionable than "please try again" — e.g. a
          // supplier config error or an upstream 502.
          const backendMsg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message;
          alert(
            backendMsg
              ? `Unable to fetch accurate rate: ${backendMsg}`
              : "Unable to fetch accurate rate. Please try again.",
          );
        }
      }, 3000);
    } else {
      // Direct navigation path — build the 1-element array shape and open
      // the API booking page.
      try {
        const bookingData = {
          selectedRate: [mapRateForPayload(rate, hotel, 1)],
          hotelStaticData: roomData.meta,
          payload: { ...payload, apiId: currentApiId },
        };
        sessionStorage.setItem("bookingData", JSON.stringify(bookingData));
        window.open("/api-booking-page-hotels", "_blank");
      } catch (err) {
        console.error("Error preparing booking data:", err);
        alert("Unable to proceed with booking. Please try again.");
      }
    }
  };

  /**
   * Multi-room "Continue with Booking" handler. Combines the per-room
   * picks into the ARRAY-shaped bookingData ApiBookingPageForHotels reads.
   * Preserves the apiId 12/15 accurate-rate re-fetch flow (one request,
   * N rooms).
   */
  const handleProceedBooking = (skipCreditCheck = false) => {
    if (!allRoomsSelected || !roomData) return;
    const { payload, hotels } = roomData;
    const hotel = hotels?.[0];
    if (!hotel) {
      alert("Hotel context missing. Please refresh and try again.");
      return;
    }

    // NOTE: GRN partial-bundled pick-count guard used to live here as a
    // blocking modal. handleRateSelect now auto-links partial-bundled
    // rates across the exact number of slots they cover, so a mismatch
    // is unreachable through the UI. Backend still enforces the same
    // invariant as a safety net.

    const sum = (key) =>
      selectedRooms.reduce(
        (acc, r) => acc + (Number(r.selectedRate?.[key]) || 0),
        0,
      );

    if (!skipCreditCheck && isInsufficientBalance(sum("totalRate"))) {
      setPendingBookingFn(() => () => handleProceedBooking(true));
      setShowInsufficientCreditModal(true);
      return;
    }

    const currentApiId = resolveApiId(hotel);

    // ─── GRN "Continue with Booking" recheck. Mirrors what IWTX / X3 /
    //    DARINA do on this same click: fire the supplier-mandated
    //    availability/rate-verify call, then open the same "Room Details"
    //    modal with the fresh values so the operator can review before
    //    the actual booking. Previously this recheck happened on the
    //    booking-page Confirm (inside GrnHotelBookingService.createBooking);
    //    moved here per client requirement so a stale rate never survives
    //    into the booking-page render. Backend recheck call is removed too.
    //
    //    Recheck fanout — one call per UNIQUE rate_key:
    //     • Bundled multi-room → all slots share one rate_key → 1 call.
    //     • Partial-bundled + auto-linked → linked slots share the rate_key
    //       so still 1 call per group.
    //     • Fully-independent non-bundled → N calls (one per rate).
    //    fetchGrnRecheck caches by rate_key, so any rate whose Cancellation
    //    Policies modal was already opened is a cache hit here — zero
    //    duplicate calls.
    if (currentApiId === apiIdMapping.GRN) {
      setLoadingRate(true);
      (async () => {
        try {
          const uniqueRates = [];
          const seenKeys = new Set();
          selectedRooms.forEach((r) => {
            const rk = r?.selectedRate?.rateKey;
            if (!rk || seenKeys.has(rk)) return;
            seenKeys.add(rk);
            uniqueRates.push(r.selectedRate);
          });
          if (uniqueRates.length === 0) {
            setLoadingRate(false);
            alert("No rate selected. Please pick a rate and try again.");
            return;
          }

          const results = await Promise.all(
            uniqueRates.map((r) => fetchGrnRecheck(r)),
          );
          const failed = results.find((r) => !r?.success);
          if (failed) {
            setLoadingRate(false);
            alert(
              failed.message ||
                "This rate is no longer available. Please reselect and try again.",
            );
            return;
          }

          // Map to the same shape ApiBookingPageForHotels reads. Overwrite
          // rate / nonRefundable / cancellationPolicy with the rechecked
          // values so the modal + downstream booking use guaranteed data,
          // not the (potentially stale) search-time snapshot.
          const rechkByKey = new Map();
          uniqueRates.forEach((r, i) => rechkByKey.set(r.rateKey, results[i]));
          const accurateRates = selectedRooms.map((slot, i) => {
            const mapped = mapRateForPayload(slot.selectedRate, hotel, i + 1);
            const recheck = rechkByKey.get(slot.selectedRate?.rateKey);
            if (recheck?.success) {
              if (recheck.totalPriceWithMarkup != null) {
                mapped.rate = recheck.totalPriceWithMarkup;
              } else if (recheck.totalPrice != null) {
                mapped.rate = recheck.totalPrice;
              }
              if (recheck.currency) {
                mapped.currency = recheck.currency;
              }
              if (recheck.nonRefundable != null) {
                mapped.nonRefundable = recheck.nonRefundable;
              }
              if (recheck.cancellationPolicies?.length) {
                mapped.cancellationPolicy = recheck.cancellationPolicies;
              }
              // panRequired already flows via mapRateForPayload → grnRecheckCache.
            }
            return mapped;
          });
          setSelectedRate(accurateRates);
          setLoadingRate(false);
          setShowBookingModal(true);
        } catch (err) {
          console.error("GRN recheck fetch failed:", err);
          setLoadingRate(false);
          const backendMsg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message;
          alert(
            backendMsg
              ? `Unable to verify rate: ${backendMsg}`
              : "Unable to verify rate. Please try again.",
          );
        }
      })();
      return;
    }

    // ─── DARINA multi-room live-rate re-check. One prebook per selected
    //    rate (Darina's live-calc op takes a single hotel + room type +
    //    meal plan per call). Fire in parallel, stitch the responses
    //    into the same "Room Details" modal IWTX/X3 use.
    if (currentApiId === apiIdMapping.DARINA) {
      const rates = selectedRooms.map((r) => r.selectedRate);
      setLoadingRate(true);
      (async () => {
        try {
          const results = await Promise.all(rates.map((r) => fetchDarinaPrebook(r)));
          const firstFail = results.find((r) => !r?.success);
          if (firstFail) {
            setLoadingRate(false);
            alert(
              firstFail.message ||
                "One of the selected rates is no longer available. Please reselect.",
            );
            return;
          }
          const accurateRates = rates.map((r, i) => {
            const live = results[i] || {};
            return {
              roomNo: i + 1,
              hotelId: hotel.hotelId,
              hotelName: hotel.hotelName,
              hotelCode: payload.hotelCode || hotel.hotelId,
              roomCategory: live.roomCategory || r.roomCategory,
              mealPlan: live.mealPlan || r.mealPlan,
              contractLabel: r.contractLabel || "Live rate (Darina)",
              nonRefundable:
                live.nonRefundable != null
                  ? live.nonRefundable
                  : r.nonRefundable,
              rate: live.rate ?? r.totalRate,
              rateWithoutMarkup:
                live.rateWithoutMarkup ?? r.totalRateWithoutMarkup,
              currency: live.currency || "AED",
              roomTypeCode: r.roomTypeCode,
              mealPlanCode: r.mealPlanCode,
              contractTokenId: live.contractTokenId || r.contractTokenId,
              cancellationPolicy:
                (live.cancellationPolicies?.length &&
                  live.cancellationPolicies) ||
                r.cancellationPolicies,
              deadlineDate: live.deadlineDate ?? r.deadlineDate,
            };
          });
          setSelectedRate(accurateRates);
          setLoadingRate(false);
          setShowBookingModal(true);
        } catch (err) {
          console.error("Darina multi-room live-rate fetch failed:", err);
          setLoadingRate(false);
          const backendMsg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message;
          alert(
            backendMsg
              ? `Unable to fetch live rate: ${backendMsg}`
              : "Unable to fetch live rate. Please try again.",
          );
        }
      })();
      return;
    }

    if (currentApiId === 12 || currentApiId === 15) {
      setLoadingRate(true);
      setTimeout(async () => {
        try {
          // Same reason as the single-room branch above: without `child`
          // the X3 reprice rejects with "The child count doesn't
          // correspond selected contract token id" whenever the searched
          // pax mix included children.
          const buildRoomBlock = (r, i) => {
            const searchChildAges =
              payload.rooms?.[i]?.childAges ||
              payload.rooms?.[0]?.childAges ||
              [];
            const childArr = searchChildAges
              .filter((n) => Number(n) > 0)
              .map((age) => ({ age: String(age) }));
            return {
              adult: {
                age: (
                  payload.rooms?.[i]?.adultAges?.[0] ??
                  payload.rooms?.[0]?.adultAges?.[0] ??
                  30
                ).toString(),
              },
              ...(childArr.length ? { child: childArr } : {}),
              roomTypeCode: r.selectedRate?.roomTypeCode,
              mealPlanCode: r.selectedRate?.mealPlanCode,
              contractTokenId: r.selectedRate?.contractTokenId || "0",
            };
          };

          const baseSearchCriteria = {
            startDate: payload.checkInDate,
            endDate: payload.checkOutDate,
            hotelCode: payload.hotelCode,
            nationality: payload.nationality,
            includeRateDetails: "Y",
            cancellationPolicy: "Y",
            groupByRooms: "Y",
          };
          const agentIdArg =
            payload?.agentId != null ? String(payload.agentId) : undefined;

          // X3 (apiId 15) on runtime inventory — per IOL-X docs, Hotel
          // Availability "validates the rate and availability for a
          // specific rate" (singular). The vendor rejects any request
          // with more than one <Room> in <RoomConfiguration> with
          // "Not supported RoomConfigurationId". So for X3 multi-room
          // we fire ONE reprice per selected room in parallel and stitch
          // the responses back in the original order. IWTX (apiId 12)
          // and every single-room path keep the original one-shot call
          // (the IWTX vendor accepts multi-room reprice).
          let accurateRates;
          if (currentApiId === 15 && selectedRooms.length > 1) {
            const perRoomRequests = selectedRooms.map((r, i) => ({
              searchCriteria: {
                roomConfiguration: {
                  room: [{ ...buildRoomBlock(r, i), roomConfigurationId: 1 }],
                },
                ...baseSearchCriteria,
              },
              agentId: agentIdArg,
            }));

            const responses = await Promise.all(
              perRoomRequests.map((req) =>
                axiosInstance.post("/api/x3/hotel/availability", req),
              ),
            );

            // Surface the vendor's own error text on the first failing
            // room — the shared catch below only reads err.message /
            // response.data.message, but IOL-X puts the reason at
            // errorMessage.msg, so throw a synthetic error so the catch
            // shows something actionable.
            responses.forEach((resp, i) => {
              const vendorErr = resp.data?.errorMessage?.msg;
              if (vendorErr) {
                const e = new Error(`Room ${i + 1}: ${vendorErr}`);
                e.response = { data: { message: `Room ${i + 1}: ${vendorErr}` } };
                throw e;
              }
            });

            accurateRates = responses.map((resp, i) => {
              const respHotel = resp.data.hotels.hotel[0];
              const room = respHotel.roomTypeDetails.rooms.room.find(
                (rr) => rr != null,
              );
              return {
                roomNo: i + 1,
                // Each per-room reprice is a self-contained call, so the
                // vendor always echoes roomConfigurationId=1. Stamp the
                // FE-side room slot number (i + 1) instead so downstream
                // booking-payload construction still keys rooms correctly.
                roomConfigurationId: i + 1,
                hotelId: respHotel.hotelId,
                hotelName: respHotel.hotelName,
                hotelCode: respHotel.hotelCode,
                roomCategory: room.roomType,
                mealPlan: room.mealPlan,
                contractLabel: room.contractLabel,
                nonRefundable: room.nonRefundable,
                rate: room.rate,
                rateWithoutMarkup: room.rateWithoutMarkup,
                currency: room.currCode,
                roomTypeCode:
                  room.roomTypeCode ??
                  selectedRooms[i]?.selectedRate?.roomTypeCode,
                mealPlanCode:
                  room.mealPlanCode ??
                  selectedRooms[i]?.selectedRate?.mealPlanCode,
                contractTokenId:
                  room.contractTokenId ??
                  selectedRooms[i]?.selectedRate?.contractTokenId,
                cancellationPolicy:
                  selectedRooms[i]?.selectedRate?.cancellationPolicies || [],
              };
            });
          } else {
            const roomsArray = selectedRooms.map((r, i) => ({
              ...buildRoomBlock(r, i),
              roomConfigurationId: i + 1,
            }));

            const priceCheckReq = {
              searchCriteria: {
                roomConfiguration: { room: roomsArray },
                ...baseSearchCriteria,
              },
              // Send the caller-agent's id so the IWTX reprice endpoint can
              // apply the same markup IwtxResponseMapper already applied on
              // the list. Without this the modal/booking page would show
              // the raw net rate, mismatching the room-list card.
              agentId: agentIdArg,
            };

            const endpoint =
              currentApiId === 12
                ? "/api/iwtx/hotel/availability"
                : "/api/x3/hotel/availability";

            const response = await axiosInstance.post(endpoint, priceCheckReq);
            const respHotel = response.data.hotels.hotel[0];
            const rooms = respHotel.roomTypeDetails.rooms.room;
            accurateRates = rooms
              .filter((room) => room != null)
              .map((room, i) => ({
                roomNo: i + 1,
                roomConfigurationId: room.roomConfigurationId,
                hotelId: respHotel.hotelId,
                hotelName: respHotel.hotelName,
                hotelCode: respHotel.hotelCode,
                roomCategory: room.roomType,
                mealPlan: room.mealPlan,
                contractLabel: room.contractLabel,
                nonRefundable: room.nonRefundable,
                // IWTX Rate = total for stay (matches the room-list card).
                // rateDetails.rate is per-night, which was previously used
                // here and silently under-priced the booking. Both fields
                // are marked-up server-side.
                rate: room.rate,
                rateWithoutMarkup: room.rateWithoutMarkup,
                currency: room.currCode,
                // IWTX BookHotel requires these three per room. Prefer the
                // accurate response; fall back to the operator's originally
                // selected rate in each slot so we never post nulls.
                roomTypeCode:
                  room.roomTypeCode ??
                  selectedRooms[i]?.selectedRate?.roomTypeCode,
                mealPlanCode:
                  room.mealPlanCode ??
                  selectedRooms[i]?.selectedRate?.mealPlanCode,
                contractTokenId:
                  room.contractTokenId ??
                  selectedRooms[i]?.selectedRate?.contractTokenId,
                // Cancellation policies from search — needed so the
                // booking page can compute deadlineDate. Same reason as
                // single-room path.
                cancellationPolicy:
                  selectedRooms[i]?.selectedRate?.cancellationPolicies || [],
              }));
          }

          setSelectedRate(accurateRates);
          setLoadingRate(false);
          setShowBookingModal(true);
        } catch (err) {
          console.error("Accurate rate fetch failed:", err);
          setLoadingRate(false);
          // Surface backend context when available so the operator has
          // something more actionable than "please try again" — e.g. a
          // supplier config error or an upstream 502.
          const backendMsg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message;
          alert(
            backendMsg
              ? `Unable to fetch accurate rate: ${backendMsg}`
              : "Unable to fetch accurate rate. Please try again.",
          );
        }
      }, 3000);
    } else {
      try {
        const bookingData = {
          selectedRate: selectedRooms.map((r, i) =>
            mapRateForPayload(r.selectedRate, hotel, i + 1),
          ),
          hotelStaticData: roomData.meta,
          payload: { ...payload, apiId: currentApiId },
        };
        sessionStorage.setItem("bookingData", JSON.stringify(bookingData));
        window.open("/api-booking-page-hotels", "_blank");
      } catch (err) {
        console.error("Error preparing multi-room bookingData:", err);
        alert("Unable to proceed with booking. Please try again.");
      }
    }
  };

  const sampleGallery = [
    "/images/01.png",
    "/images/02.png",
    "/images/03.png",
    "/images/04.jpg",
    "/images/04.png",
    "/images/05.jpg",
    "/images/06.png",
    "/images/07.png",
    "/images/main-slider.jpg",
    "/images/small-img.jpg",
  ];

  // ─────────────────── loading / error / empty ────────────────────────
  if (loading) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center">
            <div className="text-center results-loader">
              <div className="loader-ring">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
              <h4 className="text-primary fw-bold mt-3 mb-1">
                Fetching Best Room Options...
              </h4>
              <p className="text-muted small mb-0">
                Comparing rates across providers
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center p-3">
            <div className="w-100" style={{ maxWidth: 480 }}>
              <Alert variant="danger" className="mb-3">
                <Alert.Heading>Error</Alert.Heading>
                <p className="mb-0">{error}</p>
              </Alert>
              <Button
                variant="primary"
                onClick={() => navigate("/new-booking/hotel")}
              >
                Back to Search
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!roomData || !roomData.hotels || roomData.hotels.length === 0) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <TopBar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 d-flex justify-content-center align-items-center p-3">
            <Alert
              variant="info"
              className="text-center"
              style={{ maxWidth: 480 }}
            >
              <Alert.Heading>No Rooms Available</Alert.Heading>
              <p>No room data found for this hotel.</p>
              <Button
                variant="primary"
                onClick={() => navigate("/new-booking/hotel")}
              >
                Back to Search
              </Button>
            </Alert>
          </main>
        </div>
      </div>
    );
  }

  const hotel = roomData.hotels[0];
  const payload = roomData.payload || {};

  return (
    <div className="min-vh-100 bg-light d-flex flex-column room-list-container">
      <TopBar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main
          className="content-wrapper flex-grow-1"
          style={{ minWidth: 0, overflowX: "hidden" }}
        >
          <div className="container-fluid" style={{ paddingTop: "10px" }}>
            {/* Results-page heading — mirrors Inhouse. */}
            <div className="hs-page-heading">
              <h3 className="hs-page-heading-title">Accommodation</h3>
            </div>

            {/* Top toolbar: Back to Search + agent balance */}
            <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => navigate("/new-booking/hotel")}
                className="back-to-search-btn"
              >
                ← Back to Search
              </Button>
              {agentBalance != null && (
                <span
                  className="fw-bold"
                  style={{ color: "#dc3545", fontSize: "0.95rem" }}
                >
                  Available Balance: {Number(agentBalance).toFixed(2)}
                </span>
              )}
            </div>

            {/* Loader modal for accurate-rate re-fetch (apiId 12/15). */}
            <Modal
              show={loadingRate}
              centered
              backdrop="static"
              keyboard={false}
            >
              <Modal.Body className="text-center p-4">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3 mb-0 fw-bold text-primary">
                  Fetching accurate rate...
                </p>
              </Modal.Body>
            </Modal>

            {/* Insufficient-credit soft gate — same UX as Inhouse. */}
            <Modal
              show={showInsufficientCreditModal}
              onHide={() => {
                setShowInsufficientCreditModal(false);
                setPendingBookingFn(null);
              }}
              centered
              backdrop="static"
              keyboard={false}
            >
              <Modal.Header closeButton>
                <Modal.Title>Insufficient Credit Limit</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <p className="mb-2">
                  Your available credit limit is not enough to cover this
                  booking.
                </p>
                <p className="mb-0 text-muted small">
                  You can still continue — please choose{" "}
                  <strong>online payment</strong> on the booking page to
                  complete this reservation.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowInsufficientCreditModal(false);
                    setPendingBookingFn(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    const fn = pendingBookingFn;
                    setShowInsufficientCreditModal(false);
                    setPendingBookingFn(null);
                    if (typeof fn === "function") fn();
                  }}
                >
                  OK, continue
                </Button>
              </Modal.Footer>
            </Modal>

            {/* No-availability modal. */}
            <Modal
              show={showUnavailableModal}
              onHide={() => {
                setShowUnavailableModal(false);
                navigate("/new-booking/hotel");
              }}
              centered
              backdrop="static"
              keyboard={false}
            >
              <Modal.Header closeButton>
                <Modal.Title>No Rooms Available</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <p className="mb-0">
                  Rooms not available for the selected dates.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="primary"
                  onClick={() => {
                    setShowUnavailableModal(false);
                    navigate("/new-booking/hotel");
                  }}
                >
                  Back to Search
                </Button>
              </Modal.Footer>
            </Modal>

            {/* Hotel header — visually identical to Inhouse. */}
            <Card className="hotel-header-card mb-4">
              <Card.Body className="p-4">
                <Row>
                  <Col md={8}>
                    <div className="d-flex align-items-start gap-3">
                      <div className="hotel-icon">
                        <FaHotel size={40} className="text-primary" />
                      </div>
                      <div className="hotel-info">
                        <h2 className="hotel-name mb-2">{hotel.hotelName}</h2>
                        <div className="d-flex align-items-center gap-3 mb-2">
                          <div className="star-rating">
                            {renderStars(hotel.starRating)}
                          </div>
                          {hotel.propertyType && (
                            <Badge bg="primary">{hotel.propertyType}</Badge>
                          )}
                          {hotel.chain && (
                            <Badge bg="info">{hotel.chain}</Badge>
                          )}
                        </div>
                        <div className="hotel-details">
                          <p className="mb-1">
                            <FaMapMarkerAlt className="text-muted me-2" />
                            {hotel.hotelAddress}
                          </p>
                          {hotel.hotelPhoneNumber && (
                            <p className="mb-0">
                              <FaPhone className="text-muted me-2" />
                              {hotel.hotelPhoneNumber}
                            </p>
                          )}
                          <div className="mt-2">
                            <small className="text-muted">
                              <strong>Please note:</strong>{" "}
                              <p className="someproperties">
                                Some properties may collect additional charges
                                such as city tax, resort fees, or security
                                deposits during check-in. Policies such as
                                check-in time, child accommodation, and
                                cancellation rules can vary by room and
                                provider.
                              </p>
                            </small>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <Card className="booking-summary">
                      <Card.Body className="p-3">
                        <h6 className="mb-3">Booking Summary</h6>
                        <div className="booking-details">
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaCalendarAlt className="text-muted me-2" />
                              Check-in:
                            </span>
                            <span className="fw-semibold">
                              {payload.checkInDate || hotel.checkInDate}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>
                              <FaCalendarAlt className="text-muted me-2" />
                              Check-out:
                            </span>
                            <span className="fw-semibold">
                              {payload.checkOutDate || hotel.checkOutDate}
                            </span>
                          </div>
                          <div className="mb-2">
                            <div className="d-flex justify-content-between">
                              <span>
                                <FaUsers className="text-muted me-2" />
                                Guests:
                              </span>
                              {Array.isArray(payload.rooms) &&
                                payload.rooms.length <= 1 && (
                                  <span className="fw-semibold">
                                    {(() => {
                                      // Build from payload.rooms[0] — `hotel.guestBreakdown`
                                      // is only populated by the DayStay flow and is
                                      // undefined here, so previously the span was blank.
                                      const r = payload.rooms?.[0];
                                      const a = r?.adults || 0;
                                      const c = r?.children || 0;
                                      const parts = [];
                                      if (a) parts.push(`${a} adult${a > 1 ? "s" : ""}`);
                                      if (c) parts.push(`${c} child${c > 1 ? "ren" : ""}`);
                                      return parts.join(", ") || hotel.guestBreakdown || "—";
                                    })()}
                                  </span>
                                )}
                            </div>
                            {Array.isArray(payload.rooms) &&
                              payload.rooms.length > 1 && (
                                <div className="mt-1 ps-4 guest-breakdown-list">
                                  {payload.rooms.map((r, i) => {
                                    const a = r.adults || 0;
                                    const c = r.children || 0;
                                    const parts = [];
                                    if (a)
                                      parts.push(
                                        `${a} adult${a > 1 ? "s" : ""}`,
                                      );
                                    if (c)
                                      parts.push(
                                        `${c} child${c > 1 ? "ren" : ""}`,
                                      );
                                    return (
                                      <div
                                        key={i}
                                        className="d-flex justify-content-between small"
                                      >
                                        <span className="text-muted">
                                          Room {i + 1}:
                                        </span>
                                        <span className="fw-semibold">
                                          {parts.join(", ") || "—"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                          </div>
                          <div className="d-flex justify-content-between">
                            <span>
                              <FaBed className="text-muted me-2" />
                              Rooms:
                            </span>
                            <span className="fw-semibold">
                              {hotel.numberOfRooms}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span>
                              <FaGlobe className="text-muted me-2" />
                              Nationality:
                            </span>
                            <span className="fw-semibold">
                              {hotel.nationality}
                            </span>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Room categories area — grid/list toggle + filter sidebar +
                per-room accordion (only in multi-room mode). */}
            <div className="room-categories-section">
              {/* GRN multi-room mode toggle. Bundled = default certified
                  flow; Non-bundled = per-room picker (all picks must share
                  the same group_code, enforced below). Hidden completely
                  for single-room or non-GRN searches. */}
              {isGrnMultiRoomFlow && (
                <div className="mb-3 p-3 rounded shadow-sm bg-white border">
                  <div className="d-flex flex-wrap align-items-center gap-3">
                    <div>
                      <div className="fw-semibold">Booking mode</div>
                      <small className="text-muted">
                        {bundleMode === "bundled"
                          ? "One package rate covers all rooms."
                          : "Pick a different rate for each room (must share the same rate group)."}
                      </small>
                    </div>
                    <div className="btn-group ms-auto" role="group" aria-label="Booking mode">
                      <Button
                        variant={
                          bundleMode === "bundled" ? "primary" : "outline-primary"
                        }
                        size="sm"
                        onClick={() => switchBundleMode("bundled")}
                      >
                        Book as one package
                      </Button>
                      <Button
                        variant={
                          bundleMode === "non-bundled" ? "primary" : "outline-primary"
                        }
                        size="sm"
                        onClick={() => switchBundleMode("non-bundled")}
                        disabled={!hasNonBundledRates}
                        title={
                          hasNonBundledRates
                            ? "Pick a different rate for each room"
                            : "This hotel doesn't have per-room rates for your search"
                        }
                      >
                        Pick per room
                      </Button>
                    </div>
                  </div>
                  {isNonBundledMode && !hasNonBundledRates && (
                    <Alert variant="warning" className="mt-3 mb-0">
                      This hotel doesn't offer non-bundled (per-room) rates
                      for your dates and occupancy. Switch back to
                      <b> Book as one package</b> to see available rates.
                    </Alert>
                  )}
                </div>
              )}

              <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="mb-0">Available Room Categories</h4>
                <div className="btn-group shadow-sm gap-1" role="group">
                  <Button
                    variant={
                      viewMode === "grid" ? "primary" : "outline-primary"
                    }
                    onClick={() => setViewMode("grid")}
                    className="d-flex align-items-center gap-2"
                    size="sm"
                  >
                    <span className="fs-5" style={{ lineHeight: 1 }}>
                      ⊞
                    </span>
                  </Button>
                  <Button
                    variant={
                      viewMode === "list" ? "primary" : "outline-primary"
                    }
                    onClick={() => setViewMode("list")}
                    className="d-flex align-items-center gap-2"
                    size="sm"
                  >
                    <span className="fs-5" style={{ lineHeight: 1 }}>
                      ☰
                    </span>
                  </Button>
                </div>
              </div>

              <Row className="g-3">
                <Col lg={3} md={4}>
                  <RoomFilters filters={filters} />
                </Col>

                <Col lg={9} md={8}>
                  {(isMultiRoom ? selectedRooms : [null]).map(
                    (_slot, roomSlotIndex) => {
                      const slotActiveKey =
                        activeAccordions[roomSlotIndex] ?? null;
                      const setSlotActiveKey = (key) =>
                        setActiveAccordions((prev) => ({
                          ...prev,
                          [roomSlotIndex]: key,
                        }));

                      const inner = (
                        <Accordion
                          activeKey={slotActiveKey}
                          onSelect={(key) => setSlotActiveKey(key)}
                        >
                          {hotel.roomCategories.map((category, index) => {
                            const eventKey = index.toString();
                            const isActive = slotActiveKey === eventKey;
                            const filteredRates = (
                              category.availableRates || []
                            )
                              .filter(rateMatches)
                              // GRN multi-room bundle-mode filter. When the
                              // user toggles "Book as one package" show only
                              // bundled rates (or rates that have no
                              // bundleType tag — those come from the certified
                              // bundled-only fetch and are always bundled).
                              // When they toggle "Pick per room" show only
                              // non-bundled + partial-bundled. No-op for
                              // non-GRN suppliers and single-room searches.
                              .filter((rate) => {
                                if (!isGrnMultiRoomFlow) return true;
                                const bt = rate?.bundleType;
                                if (bundleMode === "bundled") {
                                  return bt == null || bt === "bundled";
                                }
                                return bt === "non-bundled" || bt === "partial-bundled";
                              })
                              // GRN non-bundled group_code guard. Once ANY
                              // slot has picked a rate, every OTHER slot may
                              // only show rates whose tokenId (group_code)
                              // matches — GRN rejects the booking if the
                              // picked rates come from different groups. The
                              // backend has the same guard as a safety net;
                              // this UI check exists so the user sees why an
                              // incompatible rate isn't clickable, before
                              // they invest attention in picking it.
                              .filter((rate) => {
                                if (!isNonBundledMode) return true;
                                const anchor = selectedRooms.find(
                                  (r, i) => i !== roomSlotIndex && r?.selectedRate,
                                );
                                const anchorGroup = anchor?.selectedRate?.tokenId;
                                if (!anchorGroup) return true;
                                return rate?.tokenId === anchorGroup;
                              })
                              // GRN non-bundled per-room occupancy filter.
                              // Non-bundled rates are occupancy-specific — a
                              // 2A/0C rate cannot accept a child pax, and
                              // GRN 500s with a generic "Something went wrong"
                              // instead of a proper validation error. Show
                              // each rate ONLY in the room card whose
                              // adults+children match the rate's
                              // paxAdults+paxChildren. When the rate object
                              // doesn't carry those fields (bundled rates,
                              // other suppliers) the filter passes through.
                              .filter((rate) => {
                                if (!isNonBundledMode) return true;
                                if (rate?.paxAdults == null) return true;
                                const searchRoom = roomData?.payload?.rooms?.[roomSlotIndex];
                                if (!searchRoom) return true;
                                const roomAdults = Number(searchRoom.adults) || 0;
                                const roomChildren = Number(searchRoom.children) || 0;
                                const rateAdults = Number(rate.paxAdults) || 0;
                                const rateChildren = Number(rate.paxChildren) || 0;
                                return rateAdults === roomAdults && rateChildren === roomChildren;
                              })
                              // ATHARVA (apiId=3) multi-room disambiguation:
                              // the search response mixes rates for every
                              // RoomSrNo into one vendor list, so each slot
                              // must show only its own RoomSrNo rates,
                              // otherwise the operator picks incompatible
                              // rates and Atharva returns 1005: Invalid
                              // RateKey on prebook.
                              .filter((rate) => {
                                if (
                                  String(roomData?.payload?.apiId || "") !== "3" ||
                                  !isMultiRoom ||
                                  rate?.roomSrNo == null
                                ) {
                                  return true;
                                }
                                return rate.roomSrNo === roomSlotIndex + 1;
                              })
                              // For Atharva multi-room with FixedOption=true,
                              // once an EARLIER slot has picked a rate, this
                              // slot must be restricted to rates whose
                              // atharvaIndex forms a valid pair with the
                              // earlier picks per the vendor's Options[]
                              // combinations. Options entries look like
                              // "1,28" — one index per room slot in order.
                              // atharvaFixedOption / atharvaOptions are
                              // per-VENDOR (Atharva returns multiple vendors
                              // per hotel, each with its own FixedOption +
                              // Options[]), so they're carried on the RATE
                              // itself — reading them off `hotel.*` would
                              // cross-apply one vendor's Options[] to
                              // another vendor's rate.
                              .filter((rate) => {
                                if (
                                  String(roomData?.payload?.apiId || "") !== "3" ||
                                  !isMultiRoom ||
                                  rate?.atharvaFixedOption !== true ||
                                  !Array.isArray(rate?.atharvaOptions) ||
                                  rate.atharvaOptions.length === 0 ||
                                  rate?.atharvaIndex == null
                                ) {
                                  return true;
                                }
                                // Collect indices + vendor hKeys from any
                                // earlier slot with a selection; positions
                                // without a selection become wildcards.
                                const requiredIndices = selectedRooms.map(
                                  (r) => r?.selectedRate?.atharvaIndex ?? null,
                                );
                                const earlierPickHKey = selectedRooms
                                  .slice(0, roomSlotIndex)
                                  .map((r) => r?.selectedRate?.hKey)
                                  .find((k) => k);
                                const hasEarlierPick = requiredIndices
                                  .slice(0, roomSlotIndex)
                                  .some((v) => v != null);
                                if (!hasEarlierPick) return true;
                                // Cross-vendor guard — Options[] indices
                                // are only meaningful within the picked
                                // vendor. A candidate from a different
                                // vendor could false-match by index
                                // coincidence and then trip 1005: Invalid
                                // RateKey at prebook (handleRateSelect
                                // blocks the click too, but hiding the
                                // rate up front is the cleaner UX).
                                if (
                                  earlierPickHKey &&
                                  rate.hKey &&
                                  rate.hKey !== earlierPickHKey
                                ) {
                                  return false;
                                }
                                return rate.atharvaOptions.some((opt) => {
                                  const parts = String(opt)
                                    .split(",")
                                    .map((p) => Number(p.trim()));
                                  if (parts.length <= roomSlotIndex) return false;
                                  if (parts[roomSlotIndex] !== rate.atharvaIndex)
                                    return false;
                                  return requiredIndices.every((idx, i) => {
                                    if (i === roomSlotIndex) return true;
                                    if (idx == null) return true;
                                    return parts[i] === idx;
                                  });
                                });
                              });
                            if (filteredRates.length === 0) return null;

                            return (
                              <Accordion.Item
                                key={eventKey}
                                eventKey={eventKey}
                                className="room-category-item"
                              >
                                <Accordion.Header
                                  as="div"
                                  className="room-category-header"
                                >
                                  <div className="d-flex justify-content-between align-items-center w-100">
                                    <div className="room-category-info">
                                      <h5 className="mb-1">
                                        {category.roomCategory}
                                      </h5>
                                      <p className="mb-0 text-muted small">
                                        {category.baseRoomType}
                                      </p>
                                    </div>

                                    <div className="d-flex align-items-center gap-3">
                                      <div className="room-category-price text-end">
                                        <div className="price-range">
                                          From{" "}
                                          {formatPrice(
                                            Math.min(
                                              ...filteredRates.map(
                                                (rate) =>
                                                  rate.rate ||
                                                  rate.totalRate ||
                                                  0,
                                              ),
                                            ),
                                          )}
                                        </div>
                                        <div className="rates-count small text-muted">
                                          {filteredRates.length} rate
                                          {filteredRates.length !== 1
                                            ? "s"
                                            : ""}{" "}
                                          available
                                        </div>
                                      </div>

                                      <div className="d-flex flex-column align-items-end gap-1">
                                        <AccordionToggleButton
                                          eventKey={eventKey}
                                          isActive={isActive}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </Accordion.Header>

                                <Accordion.Body className="room-rates-section">
                                  <Row>
                                    {filteredRates.map((rate, rateIndex) => {
                                      const isSelectedForThisSlot =
                                        isMultiRoom &&
                                        selectedRooms[roomSlotIndex]
                                          ?.selectedRate === rate;
                                      // Auto-link visibility: does this rate
                                      // cover >1 slot (partial-bundled), and
                                      // if it's picked here, which OTHER
                                      // slots is it currently linked to?
                                      const rateCovers =
                                        Number(rate?.numberOfRooms) || 1;
                                      const linkedSlotNumbers =
                                        isNonBundledMode && rateCovers > 1
                                          ? selectedRooms
                                              .map((r, i) =>
                                                r?.selectedRate?.rateKey ===
                                                  rate?.rateKey &&
                                                i !== roomSlotIndex
                                                  ? i + 1
                                                  : null,
                                              )
                                              .filter(Boolean)
                                          : [];
                                      return (
                                        <Col
                                          key={rateIndex}
                                          lg={viewMode === "grid" ? 6 : 12}
                                          xl={viewMode === "grid" ? 4 : 12}
                                          className="mb-2"
                                        >
                                          <Card
                                            className={`rate-card h-100 shadow-sm${
                                              isSelectedForThisSlot
                                                ? " rate-card-selected"
                                                : ""
                                            }`}
                                            style={
                                              isSelectedForThisSlot
                                                ? {
                                                    borderColor: "#198754",
                                                    borderWidth: "2px",
                                                    backgroundColor: "#e8f5ec",
                                                    position: "relative",
                                                  }
                                                : undefined
                                            }
                                          >
                                            {isSelectedForThisSlot && (
                                              <span
                                                style={{
                                                  position: "absolute",
                                                  top: "6px",
                                                  right: "6px",
                                                  backgroundColor: "#198754",
                                                  color: "#fff",
                                                  fontSize: "0.7rem",
                                                  fontWeight: 700,
                                                  padding: "2px 6px",
                                                  borderRadius: "4px",
                                                  zIndex: 1,
                                                }}
                                              >
                                                ✓ Selected
                                              </span>
                                            )}
                                            {/* GRN partial-bundled indicator
                                                moved INLINE (below the rate
                                                features) — the earlier
                                                absolute-positioned corner
                                                badge collided with the
                                                refund-status pill. Rendered
                                                inside the card body a bit
                                                further down instead. */}
                                            {viewMode === "grid" ? (
                                              <Card.Body className="p-2 pb-0 d-flex flex-column gap-2">
                                                <div className="rate-header d-flex justify-content-between align-items-start">
                                                  <div>
                                                    <div className="d-flex align-items-center gap-2">
                                                      {getMealPlanIcon(
                                                        rate.mealPlan,
                                                      )}
                                                      <span className="fw-semibold small">
                                                        {rate.mealPlan}
                                                      </span>
                                                    </div>
                                                    <div className="mt-1">
                                                      {getRoomStatusBadge(
                                                        rate.roomStatus,
                                                      )}
                                                    </div>
                                                  </div>
                                                  {getRefundStatusBadgeInRoomList(
                                                    // Prefer the prebook-time
                                                    // signal (derived from the
                                                    // supplier's Remark text)
                                                    // when a prebook has been
                                                    // fetched for this rate;
                                                    // fall back to the search-
                                                    // time flag before that so
                                                    // the badge still shows on
                                                    // first render.
                                                    atharvaPrebookCache?.[
                                                      rate.rateKey
                                                    ]?.nonRefundable ??
                                                      rate.nonRefundable,
                                                  )}
                                                </div>

                                                <div className="rate-pricing text-center py-2">
                                                  <div className="current-price">
                                                    {formatPrice(
                                                      isMultiRoom
                                                        ? rate.totalRate || 0
                                                        : rate.roomRateBasedOnRoomCount ||
                                                            rate.totalRate ||
                                                            0,
                                                    )}
                                                  </div>
                                                  {!isMultiRoom && (
                                                    <div className="indivial-price-per-room-noofroom">
                                                      <div className="text-muted small">
                                                        {formatPrice(
                                                          rate.totalRate || 0,
                                                        )}{" "}
                                                        × {rate.numberOfRooms || 1}{" "}
                                                        rooms
                                                      </div>
                                                    </div>
                                                  )}
                                                  <div className="price-per-night small text-muted">
                                                    per night
                                                  </div>
                                                </div>

                                                <div className="rate-features small">
                                                  {/* GRN partial-bundled inline badge — placed
                                                      here (below pricing, above other feature
                                                      lines) so it's clearly visible inside the
                                                      card body without collide with the refund-
                                                      status pill in the top-right corner. Hidden
                                                      once the rate is picked because the radio
                                                      label below then says "Selected for Room X
                                                      + Y" which conveys the same info. */}
                                                  {isNonBundledMode &&
                                                    rateCovers > 1 &&
                                                    !isSelectedForThisSlot && (
                                                      <div className="feature-item">
                                                        <span
                                                          style={{
                                                            backgroundColor:
                                                              "#0d6efd",
                                                            color: "#fff",
                                                            fontSize: "0.7rem",
                                                            fontWeight: 700,
                                                            padding: "2px 6px",
                                                            borderRadius: "4px",
                                                          }}
                                                        >
                                                          Covers {rateCovers}{" "}
                                                          rooms
                                                        </span>
                                                      </div>
                                                    )}
                                                  <div className="feature-item">
                                                    <FaInfoCircle className="me-2 text-muted" />
                                                    {rate.contractLabel}
                                                  </div>

                                                  {/* ATHARVA (apiId 3) per-rate DeadLineDate pill,
                                                      sourced from HSearchByHotelCode_V2. Sits directly
                                                      above the Cancellation link so the operator
                                                      sees the cut-off before opening the policy
                                                      modal. Guarded on apiId now that Darina also
                                                      populates rate.deadlineDate (ISO yyyy-MM-dd) —
                                                      the Atharva helper expects DD-MMM-YYYY. */}
                                                  {resolveApiId(hotel) ===
                                                    apiIdMapping.ATHARVA &&
                                                    rate.deadlineDate && (
                                                      <div className="feature-item">
                                                        {renderAtharvaDeadlinePill(
                                                          rate.deadlineDate,
                                                        )}
                                                      </div>
                                                    )}

                                                  {/* Darina (apiId 16) free-cancellation deadline —
                                                      BE emits rate.deadlineDate in ISO yyyy-MM-dd
                                                      as the "Free cancellation until X" band's
                                                      toDate. Hidden for non-refundable / no-free
                                                      band rates (deadlineDate is null there). */}
                                                  {resolveApiId(hotel) ===
                                                    apiIdMapping.DARINA &&
                                                    rate.deadlineDate && (
                                                      <div className="feature-item">
                                                        {renderDarinaDeadlinePill(
                                                          rate.deadlineDate,
                                                        )}
                                                      </div>
                                                    )}

                                                  <div className="feature-item">
                                                    <Button
                                                      variant="link"
                                                      size="sm"
                                                      className="p-0 text-decoration-underline"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openPoliciesModal(
                                                          rate,
                                                          hotel,
                                                        );
                                                      }}
                                                    >
                                                      <FaShieldAlt className="me-2" />
                                                      Cancellation Policies
                                                      &amp; Terms &amp;
                                                      Conditions
                                                    </Button>
                                                  </div>
                                                </div>

                                                {isMultiRoom ? (
                                                  <>
                                                    <Form.Check
                                                      type="radio"
                                                      id={`rate-radio-grid-${roomSlotIndex}-${index}-${rateIndex}`}
                                                      name={`rate-radio-grid-room-${roomSlotIndex}`}
                                                      className="w-100 mt-1 mb-1"
                                                      label={
                                                        isSelectedForThisSlot
                                                          ? linkedSlotNumbers.length > 0
                                                            ? `Selected for Room ${roomSlotIndex + 1} + ${linkedSlotNumbers.join(", ")}`
                                                            : `Selected for Room ${roomSlotIndex + 1}`
                                                          : isNonBundledMode && rateCovers > 1
                                                            ? `Select — this rate books ${rateCovers} rooms together`
                                                            : `Select for Room ${roomSlotIndex + 1}`
                                                      }
                                                      checked={
                                                        selectedRooms[
                                                          roomSlotIndex
                                                        ]?.selectedRate === rate
                                                      }
                                                      onChange={() =>
                                                        handleRateSelect(
                                                          roomSlotIndex,
                                                          rate,
                                                          hotel.hotelId,
                                                          hotel.hotelName,
                                                        )
                                                      }
                                                    />
                                                    {isSelectedForThisSlot &&
                                                      linkedSlotNumbers.length >
                                                        0 && (
                                                        <div
                                                          className="small text-muted"
                                                          style={{
                                                            marginTop: "-4px",
                                                            paddingLeft: "1.5rem",
                                                          }}
                                                        >
                                                          Also applied to Room{" "}
                                                          {linkedSlotNumbers.join(
                                                            ", ",
                                                          )}{" "}
                                                          — click again to
                                                          unlink all.
                                                        </div>
                                                      )}
                                                  </>
                                                ) : (
                                                  <Button
                                                    variant="primary"
                                                    className="w-100 book-now-btn mt-1 mb-1"
                                                    onClick={() =>
                                                      handleBooking(rate)
                                                    }
                                                  >
                                                    <FaMoneyBillWave className="me-2" />
                                                    View Details / Select
                                                  </Button>
                                                )}
                                              </Card.Body>
                                            ) : (
                                              <Card.Body className="p-3 py-2 d-flex flex-row align-items-center gap-3 flex-wrap flex-md-nowrap">
                                                <div
                                                  className="d-flex flex-column flex-grow-1"
                                                  style={{ minWidth: 0 }}
                                                >
                                                  <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                                                    <div
                                                      className="d-flex align-items-center gap-2 flex-shrink-0"
                                                      style={{
                                                        whiteSpace: "nowrap",
                                                        minWidth: "200px",
                                                      }}
                                                    >
                                                      {getMealPlanIcon(
                                                        rate.mealPlan,
                                                      )}
                                                      <span className="fw-semibold text-truncate">
                                                        {rate.mealPlan}
                                                      </span>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                                      {getRefundStatusBadgeInRoomList(
                                                        rate.nonRefundable,
                                                      )}
                                                      {rate.roomStatus ===
                                                      "On Request" ? (
                                                        <Badge
                                                          bg="warning"
                                                          text="dark"
                                                          className="px-2 py-1 fw-bold border border-warning"
                                                        >
                                                          On Request
                                                        </Badge>
                                                      ) : (
                                                        <Badge bg="success">
                                                          Available
                                                        </Badge>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div
                                                    className="rate-features small text-muted d-flex flex-wrap gap-3"
                                                    style={{ minWidth: 0 }}
                                                  >
                                                    <div className="feature-item d-flex align-items-center text-truncate">
                                                      <FaInfoCircle className="me-2 flex-shrink-0" />
                                                      <span className="text-truncate">
                                                        {rate.contractLabel}
                                                      </span>
                                                    </div>
                                                    {/* ATHARVA (apiId 3) per-rate DeadLineDate pill,
                                                        sourced from HSearchByHotelCode_V2. Guarded
                                                        on apiId now that Darina also populates
                                                        rate.deadlineDate (different format). */}
                                                    {resolveApiId(hotel) ===
                                                      apiIdMapping.ATHARVA &&
                                                      rate.deadlineDate && (
                                                        <div className="feature-item d-flex align-items-center">
                                                          {renderAtharvaDeadlinePill(
                                                            rate.deadlineDate,
                                                          )}
                                                        </div>
                                                      )}
                                                    {/* Darina (apiId 16) free-cancellation deadline
                                                        pill. BE emits ISO yyyy-MM-dd; helper renders
                                                        "Free cancellation until DD MMM YYYY,
                                                        11:59 PM UAE". */}
                                                    {resolveApiId(hotel) ===
                                                      apiIdMapping.DARINA &&
                                                      rate.deadlineDate && (
                                                        <div className="feature-item d-flex align-items-center">
                                                          {renderDarinaDeadlinePill(
                                                            rate.deadlineDate,
                                                          )}
                                                        </div>
                                                      )}
                                                    <div className="feature-item d-flex align-items-center">
                                                      <Button
                                                        variant="link"
                                                        size="sm"
                                                        className="p-0 text-decoration-underline"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          openPoliciesModal(
                                                            rate,
                                                            hotel,
                                                          );
                                                        }}
                                                      >
                                                        <FaShieldAlt className="me-2" />
                                                        Cancellation Policies
                                                        &amp; Terms &amp;
                                                        Conditions
                                                      </Button>
                                                    </div>
                                                  </div>
                                                </div>

                                                <div
                                                  className="text-end px-3 border-start border-end flex-shrink-0"
                                                  style={{ minWidth: "150px" }}
                                                >
                                                  <div className="fs-5 fw-bold text-primary">
                                                    {formatPrice(
                                                      isMultiRoom
                                                        ? rate.totalRate || 0
                                                        : rate.roomRateBasedOnRoomCount ||
                                                            rate.totalRate ||
                                                            0,
                                                    )}
                                                  </div>
                                                  {!isMultiRoom && (
                                                    <div className="text-muted small">
                                                      {formatPrice(
                                                        rate.totalRate || 0,
                                                      )}{" "}
                                                      × {rate.numberOfRooms || 1}{" "}
                                                      rooms
                                                    </div>
                                                  )}
                                                  <div className="small text-muted">
                                                    per night
                                                  </div>
                                                </div>

                                                <div className="flex-shrink-0">
                                                  {isMultiRoom ? (
                                                    <div>
                                                      {isNonBundledMode &&
                                                        rateCovers > 1 &&
                                                        !isSelectedForThisSlot && (
                                                          <div
                                                            style={{
                                                              backgroundColor:
                                                                "#0d6efd",
                                                              color: "#fff",
                                                              fontSize: "0.7rem",
                                                              fontWeight: 700,
                                                              padding: "2px 6px",
                                                              borderRadius: "4px",
                                                              display: "inline-block",
                                                              marginBottom: "4px",
                                                            }}
                                                          >
                                                            Covers {rateCovers}{" "}
                                                            rooms
                                                          </div>
                                                        )}
                                                      <Form.Check
                                                        type="radio"
                                                        id={`rate-radio-list-${roomSlotIndex}-${index}-${rateIndex}`}
                                                        name={`rate-radio-list-room-${roomSlotIndex}`}
                                                        label={
                                                          isSelectedForThisSlot
                                                            ? linkedSlotNumbers.length > 0
                                                              ? `Selected for Room ${roomSlotIndex + 1} + ${linkedSlotNumbers.join(", ")}`
                                                              : `Selected for Room ${roomSlotIndex + 1}`
                                                            : isNonBundledMode && rateCovers > 1
                                                              ? `Select — this rate books ${rateCovers} rooms together`
                                                              : `Select for Room ${roomSlotIndex + 1}`
                                                        }
                                                        checked={
                                                          selectedRooms[
                                                            roomSlotIndex
                                                          ]?.selectedRate === rate
                                                        }
                                                        onChange={() =>
                                                          handleRateSelect(
                                                            roomSlotIndex,
                                                            rate,
                                                            hotel.hotelId,
                                                            hotel.hotelName,
                                                          )
                                                        }
                                                        style={{
                                                          whiteSpace: "nowrap",
                                                        }}
                                                      />
                                                      {isSelectedForThisSlot &&
                                                        linkedSlotNumbers.length >
                                                          0 && (
                                                          <div
                                                            className="small text-muted"
                                                            style={{
                                                              marginTop: "2px",
                                                              paddingLeft: "1.5rem",
                                                            }}
                                                          >
                                                            Also applied to Room{" "}
                                                            {linkedSlotNumbers.join(
                                                              ", ",
                                                            )}
                                                          </div>
                                                        )}
                                                    </div>
                                                  ) : (
                                                    <Button
                                                      variant="primary"
                                                      className="book-now-btn px-3 py-2"
                                                      onClick={() =>
                                                        handleBooking(rate)
                                                      }
                                                      style={{
                                                        whiteSpace: "nowrap",
                                                      }}
                                                    >
                                                      <FaMoneyBillWave className="me-2" />
                                                      View Details
                                                    </Button>
                                                  )}
                                                </div>
                                              </Card.Body>
                                            )}
                                          </Card>
                                        </Col>
                                      );
                                    })}
                                  </Row>
                                </Accordion.Body>
                              </Accordion.Item>
                            );
                          })}
                          {hotel.roomCategories.every(
                            (c) =>
                              (c.availableRates || []).filter(rateMatches)
                                .length === 0,
                          ) && (
                            <Alert variant="info" className="mb-0">
                              No rates match the selected filters.
                            </Alert>
                          )}
                        </Accordion>
                      );

                      if (!isMultiRoom) {
                        return (
                          <React.Fragment key="single-room">
                            {inner}
                          </React.Fragment>
                        );
                      }

                      const slotSelection = selectedRooms[roomSlotIndex];
                      // GRN partial-bundled: figure out if this slot is
                      // filled by a rate that primarily belongs to an
                      // earlier slot (auto-linked), so the header can
                      // show "Linked to Room X" instead of the plain
                      // "picked" badge — makes the atomic group visible.
                      const linkedPrimaryIndex =
                        isNonBundledMode && slotSelection?.selectedRate?.rateKey
                          ? selectedRooms.findIndex(
                              (r) =>
                                r?.selectedRate?.rateKey ===
                                slotSelection.selectedRate.rateKey,
                            )
                          : -1;
                      const isLinkedChildSlot =
                        linkedPrimaryIndex !== -1 &&
                        linkedPrimaryIndex !== roomSlotIndex;
                      return (
                        <Accordion
                          key={`room-slot-${roomSlotIndex}`}
                          className="mb-3 room-slot-accordion"
                        >
                          <Accordion.Item eventKey={`room-slot-${roomSlotIndex}`}>
                            <Accordion.Header>
                              <div className="d-flex w-100 justify-content-between align-items-center pe-3">
                                <span className="fw-semibold">
                                  <FaBed className="me-2 text-primary" />
                                  Room {roomSlotIndex + 1}
                                </span>
                                {slotSelection?.selectedRate ? (
                                  isLinkedChildSlot ? (
                                    <Badge bg="info" className="ms-2">
                                      Linked to Room{" "}
                                      {linkedPrimaryIndex + 1} —{" "}
                                      {
                                        slotSelection.selectedRate
                                          .roomCategory
                                      }
                                    </Badge>
                                  ) : (
                                    <Badge bg="success" className="ms-2">
                                      {slotSelection.selectedRate.roomCategory}
                                      {" — "}
                                      {formatPrice(
                                        slotSelection.selectedRate.totalRate ||
                                          0,
                                      )}
                                    </Badge>
                                  )
                                ) : (
                                  <Badge
                                    bg="warning"
                                    text="dark"
                                    className="ms-2"
                                  >
                                    Not selected
                                  </Badge>
                                )}
                              </div>
                            </Accordion.Header>
                            <Accordion.Body>{inner}</Accordion.Body>
                          </Accordion.Item>
                        </Accordion>
                      );
                    },
                  )}

                  {/* Multi-room "Continue with Booking" progress banner —
                      identical UX to Inhouse. */}
                  {isMultiRoom &&
                    (() => {
                      const selectedCount = selectedRooms.filter(
                        (r) => r.selectedRate,
                      ).length;
                      const pct =
                        numRooms > 0
                          ? Math.round((selectedCount / numRooms) * 100)
                          : 0;
                      const done = allRoomsSelected;
                      const accent = done ? "#198754" : "#fd7e14";
                      return (
                        <div
                          className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mt-3 p-3 rounded-3 shadow-sm"
                          style={{
                            borderLeft: `6px solid ${accent}`,
                            border: `1px solid ${done ? "#a7d7b8" : "#fed7aa"}`,
                            backgroundColor: done ? "#e8f5ec" : "#fff7ed",
                          }}
                        >
                          <div className="d-flex align-items-center gap-3">
                            <div
                              className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                              style={{
                                width: 46,
                                height: 46,
                                backgroundColor: accent,
                                color: "#fff",
                                fontSize: "1.3rem",
                              }}
                            >
                              {done ? <FaCheckCircle /> : <FaInfoCircle />}
                            </div>
                            <div>
                              <div
                                className="fw-bold"
                                style={{
                                  fontSize: "1.05rem",
                                  color: done ? "#14653a" : "#9a3412",
                                }}
                              >
                                {done
                                  ? `All ${numRooms} room${numRooms === 1 ? "" : "s"} selected`
                                  : `Select rates for your ${numRooms} rooms`}
                              </div>
                              <div className="small text-muted mb-2">
                                {done
                                  ? "You're ready to continue with your booking."
                                  : `Pick a rate for each room to continue — ${selectedCount} of ${numRooms} selected.`}
                              </div>
                              <div
                                className="progress"
                                style={{
                                  height: 6,
                                  width: 240,
                                  maxWidth: "100%",
                                  backgroundColor: "#e9ecef",
                                }}
                              >
                                <div
                                  className="progress-bar"
                                  role="progressbar"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: accent,
                                    transition: "width .3s ease",
                                  }}
                                  aria-valuenow={selectedCount}
                                  aria-valuemin={0}
                                  aria-valuemax={numRooms}
                                />
                              </div>
                            </div>
                          </div>
                          <Button
                            variant={done ? "success" : "primary"}
                            size="lg"
                            disabled={!allRoomsSelected}
                            onClick={() => handleProceedBooking()}
                            className="flex-shrink-0"
                          >
                            <FaMoneyBillWave className="me-2" />
                            Continue with Booking
                          </Button>
                        </div>
                      );
                    })()}
                </Col>
              </Row>
            </div>
          </div>
        </main>
      </div>

      {/* Accurate-rate confirm modal (apiId 12/15/16). Preserves the ARRAY
          shape ApiBookingPageForHotels reads from sessionStorage. */}
      <Modal
        show={showBookingModal}
        onHide={() => setShowBookingModal(false)}
        size="xl"
        aria-labelledby="room-detail-modal"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title id="room-detail-modal">Room Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRate?.map((rate, index) => (
            <Row key={index} className="g-4 mb-4">
              <Col md={6}>
                <h5>Room {index + 1}</h5>
                <div
                  id={`roomGallery-${index}`}
                  className="carousel slide acuurate-rate-details-modal"
                  data-bs-ride="carousel"
                >
                  <div className="carousel-inner rounded">
                    {sampleGallery
                      .slice(index * 3, index * 3 + 3)
                      .map((img, idx) => (
                        <div
                          key={idx}
                          className={`carousel-item ${idx === 0 ? "active" : ""}`}
                        >
                          <img src={img} className="d-block w-100" alt="Room" />
                        </div>
                      ))}
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <h5 className="mb-2">{rate.roomCategory}</h5>
                <p className="text-muted">{rate.roomTypeDescription}</p>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <Badge bg="secondary">High speed internet</Badge>
                  <Badge bg="secondary">Private bathroom</Badge>
                  <Badge bg="secondary">Kitchen</Badge>
                  <Badge bg="secondary">TV</Badge>
                </div>
                <div className="booking-details-modal">
                  <div className="d-flex justify-content-between mb-2">
                    <span>Meal Plan:</span>
                    <span className="fw-semibold">{rate.mealPlan}</span>
                  </div>
                  {activeUserRole === "ADMIN" && (
                    <div className="d-flex justify-content-between mb-2">
                      <span>Selling Price:</span>
                      <span className="fw-semibold text-primary">
                        {formatPrice(rate.rate)}
                      </span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mb-2">
                    <span>Total Rate:</span>
                    <span className="fw-semibold text-primary">
                      {formatPrice(rate.rate)}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span>Refund Status:</span>
                    <span>
                      {getRefundStatusBadge(
                        rate.nonRefundable === "Y"
                          ? "NON REFUNDABLE"
                          : "FLEXIBLE",
                      )}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>Contract:</span>
                    <span className="small text-muted">
                      {rate.contractLabel}
                    </span>
                  </div>
                </div>
              </Col>
            </Row>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowBookingModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="btn-confirm-booking"
            size="sm"
            onClick={() => {
              try {
                const currentApiId = resolveApiId(hotel);
                sessionStorage.setItem(
                  "bookingData",
                  JSON.stringify({
                    selectedRate,
                    hotelStaticData: roomData.meta,
                    payload: { ...payload, apiId: currentApiId },
                  }),
                );
              } catch (e) {
                console.error("Error storing bookingData:", e);
              }
              window.open("/api-booking-page-hotels", "_blank");
            }}
          >
            Continue
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancellation Policies & Terms modal — sourced from the search
          response so no extra API call is needed for external suppliers. */}
      <Modal
        show={showPoliciesModal}
        onHide={() => setShowPoliciesModal(false)}
        size="lg"
        centered
        scrollable
        aria-labelledby="policies-terms-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title id="policies-terms-modal">
            Cancellation Policies &amp; Terms &amp; Conditions
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {policiesModalData.selectedRoomLabel && (
            <div className="text-muted small mb-3">
              {policiesModalData.selectedRoomLabel}
            </div>
          )}

          {/* ATHARVA prebook feedback. Loading + error banners live above the
              policies list so they're visible without covering the T&C section. */}
          {prebookLoading && (
            <div className="alert alert-info py-2 mb-3" role="status">
              Fetching cancellation policy from supplier…
            </div>
          )}
          {prebookError && (
            <div className="alert alert-warning py-2 mb-3" role="alert">
              {prebookError}
            </div>
          )}

          {/* Atharva Policies[].Remark aggregated by the backend. Includes
              the "IMPORTANT NOTE …" line and any non-refundable notice as
              supplied by the vendor. whiteSpace: pre-line preserves the
              newlines the backend used when joining multiple Remarks. */}
          {policiesModalData.remark && (
            <div
              className="p-2 mb-3 border rounded"
              style={{ background: "#fff8e1", borderColor: "#f59e0b" }}
            >
              <div
                className="fw-semibold small mb-1"
                style={{ color: "#92400e" }}
              >
                Supplier Notes
              </div>
              <div
                className="small text-dark"
                style={{ whiteSpace: "pre-line" }}
              >
                {/* Strip supplier HTML (<p>, <b>, <div>, <ul>, <li> …) so
                    the notice reads as plain text. Same helper the
                    cancellation-policy rows below already use. */}
                {stripHtmlTags(policiesModalData.remark)}
              </div>
            </div>
          )}

          <h6 className="text-danger mb-2">
            <FaTimesCircle className="me-2" />
            Cancellation Policies
          </h6>
          {policiesModalData.cancellationPolicies?.length > 0 ? (
            <ul className="mb-4 ps-3">
              {policiesModalData.cancellationPolicies.map((policy, idx) => {
                const validity = renderPolicyValidity(
                  policy?.fromDate,
                  policy?.toDate,
                );
                return (
                  <li key={idx} className="mb-2">
                    <div style={{ whiteSpace: "pre-line" }}>
                      {stripHtmlTags(policy?.policyText)}
                    </div>
                    {validity && (
                      <small className="text-muted">{validity}</small>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : policiesModalData.nonRefundable ? (
            <div className="alert alert-danger py-2 px-3 mb-4 small">
              <strong>Non-refundable rate.</strong> No refund will be
              provided if this booking is cancelled. 100% cancellation
              charges apply.
            </div>
          ) : (
            <p className="text-muted mb-4">
              No cancellation policies available.
            </p>
          )}

          <h6 className="text-secondary mb-2 pt-2 border-top">
            <FaInfoCircle className="me-2" />
            Terms &amp; Conditions
          </h6>
          {policiesModalData.termsAndConditions?.length > 0 ? (
            <ul className="mb-0 ps-3">
              {policiesModalData.termsAndConditions.map((term, idx) => {
                const raw =
                  typeof term === "string"
                    ? term
                    : term?.description ||
                      term?.policyText ||
                      term?.text ||
                      "";
                const text = stripHtmlTags(raw);
                if (!text) return null;
                return (
                  <li
                    key={idx}
                    className="mb-2"
                    style={{ whiteSpace: "pre-line" }}
                  >
                    {text}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted mb-0">
              No terms &amp; conditions available.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowPoliciesModal(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ExternalApiRoomList;
