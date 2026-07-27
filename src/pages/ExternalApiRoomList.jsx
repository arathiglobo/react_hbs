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

  // Agent credit gate. Same pattern as Inhouse — soft warning, never
  // blocks; user clicks "OK, continue" and we resume the queued booking
  // handler with skipCreditCheck=true so downstream flow is unchanged.
  const [agentBalance, setAgentBalance] = useState(null);
  const [showInsufficientCreditModal, setShowInsufficientCreditModal] =
    useState(false);
  const [pendingBookingFn, setPendingBookingFn] = useState(null);

  // Cancellation Policies & Terms modal — sourced from the search
  // response; no extra API call for external suppliers.
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [policiesModalData, setPoliciesModalData] = useState({
    cancellationPolicies: [],
    termsAndConditions: [],
    selectedRoomLabel: "",
  });

  const location = useLocation();
  const navigate = useNavigate();

  const apiIdMapping = {
    JUMEIRAH: 10,
    IWTX: 12,
    X3: 15,
    RATEHAWK: 14,
    DARINA: 16,
    ATHARVA: 3,
  };

  const activeUserRole = localStorage.getItem("currentActiveRole");

  // ─────────────────────────── helpers ────────────────────────────────
  const openPoliciesModal = (rate, hotelDetail) => {
    const cancellation = Array.isArray(rate?.cancellationPolicies)
      ? rate.cancellationPolicies
      : Array.isArray(hotelDetail?.cancellationPolicies)
        ? hotelDetail.cancellationPolicies
        : [];
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
    setPoliciesModalData({
      cancellationPolicies: cancellation,
      termsAndConditions: inlineTerms,
      selectedRoomLabel: label,
      nonRefundable: isNonRefundable,
    });
    setShowPoliciesModal(true);
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

        const res = await axiosInstance.post("/api/hotel-rooms/search", payload);

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
  const mapRateForPayload = (rate, hotelObj, roomNo) => ({
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
    cancellationPolicy: rate?.cancellationPolicies,
    // IWTX booking payload fields — forwarded from the search response
    // so IwtxHotelBookingService can build its JSON BookHotel body.
    roomTypeCode: rate?.roomTypeCode,
    mealPlanCode: rate?.mealPlanCode,
    contractTokenId: rate?.contractTokenId,
  });

  const handleRateSelect = (roomIndex, rate, hotelId, hotelName) => {
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
                                    {hotel.guestBreakdown}
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
                            ).filter(rateMatches);
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
                                                  <div className="feature-item">
                                                    <FaInfoCircle className="me-2 text-muted" />
                                                    {rate.contractLabel}
                                                  </div>

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
                                                  <Form.Check
                                                    type="radio"
                                                    id={`rate-radio-grid-${roomSlotIndex}-${index}-${rateIndex}`}
                                                    name={`rate-radio-grid-room-${roomSlotIndex}`}
                                                    className="w-100 mt-1 mb-1"
                                                    label={
                                                      selectedRooms[
                                                        roomSlotIndex
                                                      ]?.selectedRate === rate
                                                        ? `Selected for Room ${roomSlotIndex + 1}`
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
                                                    <Form.Check
                                                      type="radio"
                                                      id={`rate-radio-list-${roomSlotIndex}-${index}-${rateIndex}`}
                                                      name={`rate-radio-list-room-${roomSlotIndex}`}
                                                      label={
                                                        selectedRooms[
                                                          roomSlotIndex
                                                        ]?.selectedRate === rate
                                                          ? `Selected for Room ${roomSlotIndex + 1}`
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
                                  <Badge bg="success" className="ms-2">
                                    {slotSelection.selectedRate.roomCategory}
                                    {" — "}
                                    {formatPrice(
                                      slotSelection.selectedRate.totalRate ||
                                        0,
                                    )}
                                  </Badge>
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

      {/* Accurate-rate confirm modal (apiId 12/15). Preserves the ARRAY
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
            Confirm Booking
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
                      {policy?.policyText || ""}
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
                const text =
                  typeof term === "string"
                    ? term
                    : term?.description ||
                      term?.policyText ||
                      term?.text ||
                      "";
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
